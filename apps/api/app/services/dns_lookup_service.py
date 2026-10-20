"""
Scanly API - Standalone DNS Lookup Service
Provides robust, bounded DNS resolution across A, AAAA, CNAME, MX, NS, TXT, SOA, and CAA records.
Follows safe networking practices, bounded timeouts, and transparent error reporting without full scanner invocation.
"""
import os
import time
import asyncio
import logging
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime, timezone

import dns.resolver
import dns.exception

from app.schemas.tools import (
    ALLOWED_DNS_RECORD_TYPES,
    DnsRecordItem,
    DnsTypeResult,
    DnsLookupSummary,
    DnsLookupResponse,
)

logger = logging.getLogger(__name__)

# Default resilient public nameservers (Cloudflare, Google, Quad9)
DEFAULT_PUBLIC_NAMESERVERS: List[str] = [
    "1.1.1.1",
    "8.8.8.8",
    "1.0.0.1",
    "8.8.4.4",
    "9.9.9.9",
]

# Configurable timeout per query (default 2.0 seconds)
DEFAULT_QUERY_TIMEOUT = 2.0
PER_NAMESERVER_TIMEOUT = 1.0
TOTAL_RESOLUTION_LIFETIME = 3.0


def create_resolver(timeout: float = DEFAULT_QUERY_TIMEOUT) -> dns.resolver.Resolver:
    """
    Creates a dnspython Resolver configured with bounded timeouts and resilient nameservers.
    - Honors explicit DNS_RESOLVER_NAMESERVERS or DNS_LOOKUP_NAMESERVERS overrides.
    - Defaults to fast, authoritative public resolvers (1.1.1.1, 8.8.8.8, etc.) followed by system nameservers.
    - Separates per-nameserver attempt timeout (min(timeout, 1.0)s) from total query lifetime (max(timeout, 3.0)s)
      to enable fast, automatic failover across nameservers when an upstream interface is unresponsive.
    """
    custom_ns_env = os.getenv("DNS_RESOLVER_NAMESERVERS") or os.getenv("DNS_LOOKUP_NAMESERVERS")
    if custom_ns_env:
        nameservers = [ns.strip() for ns in custom_ns_env.split(",") if ns.strip()]
        resolver = dns.resolver.Resolver(configure=False)
        resolver.nameservers = nameservers
    else:
        nameservers = list(DEFAULT_PUBLIC_NAMESERVERS)
        try:
            sys_res = dns.resolver.Resolver(configure=True)
            for ns in sys_res.nameservers:
                if ns not in nameservers:
                    nameservers.append(ns)
        except Exception:
            pass
        resolver = dns.resolver.Resolver(configure=False)
        resolver.nameservers = nameservers

    resolver.timeout = min(timeout, PER_NAMESERVER_TIMEOUT) if timeout >= 0.5 else timeout
    resolver.lifetime = max(timeout, TOTAL_RESOLUTION_LIFETIME)

    return resolver


def resolve_record_type_sync(
    domain: str,
    record_type: str,
    resolver: Optional[dns.resolver.Resolver] = None,
    timeout: float = DEFAULT_QUERY_TIMEOUT,
) -> DnsTypeResult:
    """
    Synchronously queries a specific DNS record type for the normalized domain.
    Distinguishes NXDOMAIN, NoAnswer, Timeout, and nameserver errors.
    Formats structured records with TTL and type-specific attributes.
    """
    res = resolver or create_resolver(timeout=timeout)
    upper_type = record_type.strip().upper()

    try:
        answers = res.resolve(domain, upper_type)
        ttl = answers.rrset.ttl if answers.rrset and hasattr(answers.rrset, "ttl") else None

        records: List[DnsRecordItem] = []

        for rdata in answers:
            if upper_type in ("A", "AAAA"):
                records.append(
                    DnsRecordItem(
                        value=rdata.address,
                        ttl=ttl,
                    )
                )

            elif upper_type == "CNAME":
                target = rdata.target.to_text().rstrip(".")
                records.append(
                    DnsRecordItem(
                        value=target,
                        ttl=ttl,
                    )
                )

            elif upper_type == "MX":
                exchange = rdata.exchange.to_text().rstrip(".")
                preference = rdata.preference
                records.append(
                    DnsRecordItem(
                        value=f"{preference} {exchange}",
                        ttl=ttl,
                        preference=preference,
                        exchange=exchange,
                    )
                )

            elif upper_type == "NS":
                target = rdata.target.to_text().rstrip(".")
                records.append(
                    DnsRecordItem(
                        value=target,
                        ttl=ttl,
                    )
                )

            elif upper_type == "TXT":
                # Join byte chunks cleanly according to RFC 1035 character-string conventions
                txt_str = "".join(
                    [
                        s.decode("utf-8", errors="replace") if isinstance(s, bytes) else str(s)
                        for s in rdata.strings
                    ]
                )
                records.append(
                    DnsRecordItem(
                        value=txt_str,
                        ttl=ttl,
                    )
                )

            elif upper_type == "SOA":
                mname = rdata.mname.to_text().rstrip(".")
                rname = rdata.rname.to_text().rstrip(".")
                serial = int(rdata.serial)
                refresh = int(rdata.refresh)
                retry = int(rdata.retry)
                expire = int(rdata.expire)
                minimum = int(rdata.minimum)

                formatted = (
                    f"{mname} {rname} (Serial: {serial}, Refresh: {refresh}s, "
                    f"Retry: {retry}s, Expire: {expire}s, Min: {minimum}s)"
                )

                records.append(
                    DnsRecordItem(
                        value=formatted,
                        ttl=ttl,
                        mname=mname,
                        rname=rname,
                        serial=serial,
                        refresh=refresh,
                        retry=retry,
                        expire=expire,
                        minimum=minimum,
                    )
                )

            elif upper_type == "CAA":
                flags = int(rdata.flags)
                tag = (
                    rdata.tag.decode("utf-8", errors="replace")
                    if isinstance(rdata.tag, bytes)
                    else str(rdata.tag)
                )
                val = (
                    rdata.value.decode("utf-8", errors="replace")
                    if isinstance(rdata.value, bytes)
                    else str(rdata.value)
                )

                records.append(
                    DnsRecordItem(
                        value=f'{flags} {tag} "{val}"',
                        ttl=ttl,
                        flags=flags,
                        tag=tag,
                    )
                )

            else:
                records.append(
                    DnsRecordItem(
                        value=rdata.to_text(),
                        ttl=ttl,
                    )
                )

        # Sort MX records by preference if present
        if upper_type == "MX":
            records.sort(key=lambda x: (x.preference if x.preference is not None else 999999, x.value))
        else:
            records.sort(key=lambda x: x.value)

        return DnsTypeResult(
            record_type=upper_type,
            status="success",
            records=records,
            message=f"Found {len(records)} {upper_type} record{'s' if len(records) != 1 else ''}.",
        )

    except dns.resolver.NXDOMAIN:
        return DnsTypeResult(
            record_type=upper_type,
            status="no_records",
            records=[],
            message="Domain does not exist (NXDOMAIN).",
        )

    except dns.resolver.NoAnswer:
        return DnsTypeResult(
            record_type=upper_type,
            status="no_records",
            records=[],
            message=f"No {upper_type} records were returned by the configured resolver.",
        )

    except (dns.resolver.LifetimeTimeout, dns.resolver.Timeout):
        return DnsTypeResult(
            record_type=upper_type,
            status="timeout",
            records=[],
            message=f"Query timed out while resolving {upper_type} records.",
        )

    except dns.resolver.NoNameservers:
        return DnsTypeResult(
            record_type=upper_type,
            status="error",
            records=[],
            message="Authoritative nameservers failed to respond or returned SERVFAIL.",
        )

    except Exception as exc:
        logger.warning(f"DNS query error for {domain} ({upper_type}): {type(exc).__name__}")
        return DnsTypeResult(
            record_type=upper_type,
            status="error",
            records=[],
            message=f"Resolver error while querying {upper_type} records.",
        )


async def execute_dns_lookup(
    domain: str,
    record_types: List[str],
    timeout: float = DEFAULT_QUERY_TIMEOUT,
    resolver: Optional[dns.resolver.Resolver] = None,
) -> DnsLookupResponse:
    """
    Asynchronously queries all requested DNS record types in parallel with bounded execution.
    Aggregates results and returns a structured DnsLookupResponse.
    """
    start_time = time.perf_counter()
    queried_at = datetime.now(timezone.utc).isoformat()

    res = resolver or create_resolver(timeout=timeout)

    # Concurrently execute queries via asyncio.to_thread to avoid blocking event loop
    tasks = [
        asyncio.to_thread(resolve_record_type_sync, domain, rt, res, timeout)
        for rt in record_types
    ]
    results: List[DnsTypeResult] = await asyncio.gather(*tasks)

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

    # Compute summary
    requested_types = len(record_types)
    successful_types = sum(1 for r in results if r.status in ("success", "no_records"))
    total_records = sum(len(r.records) for r in results)

    summary = DnsLookupSummary(
        requested_types=requested_types,
        successful_types=successful_types,
        total_records=total_records,
    )

    return DnsLookupResponse(
        domain=domain,
        queried_at=queried_at,
        duration_ms=duration_ms,
        results=results,
        summary=summary,
    )
