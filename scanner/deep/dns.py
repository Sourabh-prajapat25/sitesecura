"""
Scanly Scanner Engine - Deep Scan Advanced DNS & Infrastructure Analysis
Audits DNS zone configurations: A, AAAA (IPv6 readiness), MX (with priorities),
NS redundancy, CAA (Certification Authority Authorization), and DNSSEC.
Safely bounded with query timeouts and defensive exception handling.
"""
from typing import Dict, Any, List, Optional, Tuple
import dns.resolver
from scanner.models import Finding, CheckStatus, Severity
from scanner.domain import normalize_domain


def _create_dns_resolver(timeout_seconds: float = 2.0, nameservers: Optional[List[str]] = None) -> dns.resolver.Resolver:
    """Builds a DNS resolver with fallback public resolvers and bounded timeouts."""
    res = dns.resolver.Resolver(configure=True)
    if nameservers:
        res.nameservers = nameservers
    else:
        # If default system nameservers are missing or look like loopback, provide public fallbacks
        if not res.nameservers or any(ns.startswith("127.") for ns in res.nameservers):
            res.nameservers = ["8.8.8.8", "1.1.1.1"]
    res.timeout = min(timeout_seconds, 2.5)
    res.lifetime = min(timeout_seconds, 2.5)
    return res


def analyze_deep_dns(
    domain: str,
    timeout_seconds: float = 2.0,
    nameservers: Optional[List[str]] = None,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Performs comprehensive passive DNS audit for target domain.
    Returns (dns_metadata, findings). Never throws uncaught exceptions.
    """
    norm_domain = normalize_domain(domain)
    findings: List[Finding] = []

    dns_data: Dict[str, Any] = {
        "domain": norm_domain,
        "a_records": [],
        "aaaa_records": [],
        "has_ipv6": False,
        "mx_records": [],
        "has_mx": False,
        "ns_records": [],
        "ns_count": 0,
        "has_redundant_ns": False,
        "caa_records": [],
        "caa_present": False,
        "allowed_cas": [],
        "dnssec_enabled": False,
        "error": None,
    }

    resolver = _create_dns_resolver(timeout_seconds, nameservers)

    # 1. A Records (IPv4)
    try:
        answers = resolver.resolve(norm_domain, "A")
        dns_data["a_records"] = sorted([r.to_text() for r in answers])
    except Exception:
        pass

    # 2. AAAA Records (IPv6 Readiness)
    try:
        answers = resolver.resolve(norm_domain, "AAAA")
        dns_data["aaaa_records"] = sorted([r.to_text() for r in answers])
        dns_data["has_ipv6"] = len(dns_data["aaaa_records"]) > 0
    except Exception:
        pass

    # 3. MX Records (Mail Exchangers with priority)
    try:
        answers = resolver.resolve(norm_domain, "MX")
        mx_items = []
        for r in answers:
            host = r.exchange.to_text().rstrip(".")
            prio = int(r.preference)
            mx_items.append({"host": host, "priority": pririo if "pririo" in dir() else prio})
        # Sort MX records by priority ascending
        mx_items.sort(key=lambda x: x["priority"])
        dns_data["mx_records"] = mx_items
        dns_data["has_mx"] = len(mx_items) > 0
    except Exception:
        pass

    # 4. NS Records (Name Servers)
    try:
        answers = resolver.resolve(norm_domain, "NS")
        dns_data["ns_records"] = sorted([r.to_text().rstrip(".") for r in answers])
        dns_data["ns_count"] = len(dns_data["ns_records"])
        dns_data["has_redundant_ns"] = dns_data["ns_count"] >= 2
    except Exception:
        pass

    # 5. CAA Records (RFC 8659)
    # Check target domain first, then parent domain if subdomain
    caa_records = []
    target_domains_to_try = [norm_domain]
    domain_parts = norm_domain.split(".")
    if len(domain_parts) > 2:
        parent_domain = ".".join(domain_parts[1:])
        target_domains_to_try.append(parent_domain)

    for query_target in target_domains_to_try:
        try:
            answers = resolver.resolve(query_target, "CAA")
            for r in answers:
                tag = r.tag.decode("utf-8", errors="ignore") if isinstance(r.tag, bytes) else str(r.tag)
                val = r.value.decode("utf-8", errors="ignore") if isinstance(r.value, bytes) else str(r.value)
                flags = int(getattr(r, "flags", 0))
                caa_records.append({
                    "tag": tag.lower(),
                    "value": val.strip('"'),
                    "flags": flags,
                    "queried_target": query_target,
                })
            if caa_records:
                break
        except Exception:
            continue

    dns_data["caa_records"] = caa_records
    dns_data["caa_present"] = len(caa_records) > 0

    allowed_cas = []
    for caa in caa_records:
        if caa["tag"] in ("issue", "issuewild"):
            ca_name = caa["value"].split(";")[0].strip()
            if ca_name and ca_name != ";" and ca_name not in allowed_cas:
                allowed_cas.append(ca_name)
    dns_data["allowed_cas"] = allowed_cas

    # 6. DNSSEC (DNSKEY records)
    try:
        answers = resolver.resolve(norm_domain, "DNSKEY")
        if answers and len(answers) > 0:
            dns_data["dnssec_enabled"] = True
    except Exception:
        dns_data["dnssec_enabled"] = False

    # =========================================================
    # Findings Generation
    # =========================================================

    # 1. CAA Record Finding
    if dns_data["caa_present"]:
        ca_summary = ", ".join(allowed_cas) if allowed_cas else "Explicit zero-issuance policy"
        findings.append(
            Finding(
                check_type="deep_caa_record",
                name="CAA Record Configured",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="CAA Record Restricts Authorized CAs",
                summary=f"Valid CAA records restrict certificate issuance to authorized authorities: {ca_summary}.",
                why_it_matters="CAA (Certification Authority Authorization) prevents rogue or compromised CAs from issuing fraudulent certificates for your domain.",
                how_to_fix="Maintain CAA record definitions in DNS.",
                estimated_fix_minutes=0,
                documentation_url="https://sslmate.com/caa/about",
                evidence=f"Authorized CAs: {ca_summary} ({len(caa_records)} rules active)",
            )
        )
    else:
        findings.append(
            Finding(
                check_type="deep_caa_record",
                name="Missing CAA Record",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-3,
                title="Missing CAA DNS Record",
                summary="No Certification Authority Authorization (CAA) record was detected for this domain.",
                why_it_matters="Without a CAA record, any publicly trusted Certificate Authority can issue certificates for this domain if an attacker compromises validation.",
                how_to_fix="Add CAA records in your DNS management console restricting issuance to your designated CA (e.g. `issue letsencrypt.org`).",
                estimated_fix_minutes=10,
                documentation_url="https://sslmate.com/caa/about",
                evidence="No CAA record returned during DNS query.",
            )
        )

    # 2. DNSSEC Finding
    if dns_data["dnssec_enabled"]:
        findings.append(
            Finding(
                check_type="deep_dnssec",
                name="DNSSEC Enabled",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="DNSSEC Cryptographic Signing Active",
                summary="Cryptographic DNSKEY records detected in zone, providing origin authentication and data integrity protection.",
                why_it_matters="DNSSEC protects visitors from DNS spoofing, cache poisoning, and Man-in-the-Middle hijacking.",
                how_to_fix="Ensure registrar DS records remain synchronized with zone keys.",
                estimated_fix_minutes=0,
                documentation_url="https://www.icann.org/resources/pages/dnssec-what-is-it-why-important-2019-03-05-en",
                evidence="Active DNSKEY records verified.",
            )
        )
    else:
        findings.append(
            Finding(
                check_type="deep_dnssec",
                name="DNSSEC Not Active",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="DNSSEC Not Enabled",
                summary="Zone does not advertise DNSSEC cryptographic signatures (DNSKEY).",
                why_it_matters="Without DNSSEC, resolver responses may be vulnerable to cache poisoning on unauthenticated local networks.",
                how_to_fix="Enable DNSSEC signing in your DNS provider (Cloudflare, AWS Route 53, etc.) and add the DS record at your registrar.",
                estimated_fix_minutes=15,
                documentation_url="https://www.icann.org/resources/pages/dnssec-what-is-it-why-important-2019-03-05-en",
                evidence="No DNSKEY records detected in zone.",
            )
        )

    # 3. NS Redundancy
    if dns_data["has_redundant_ns"]:
        findings.append(
            Finding(
                check_type="deep_dns_redundancy",
                name="Authoritative NS Redundancy",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Redundant Name Servers Configured",
                summary=f"Zone delegates authority across {dns_data['ns_count']} distinct authoritative nameservers.",
                why_it_matters="Redundant authoritative name servers ensure uninterrupted DNS availability during outages or DDoS incidents.",
                how_to_fix="Maintain multiple geographically diverse name servers.",
                estimated_fix_minutes=0,
                documentation_url="https://www.cloudflare.com/learning/dns/what-is-a-nameserver/",
                evidence=", ".join(dns_data["ns_records"][:4]),
            )
        )
    elif dns_data["ns_count"] == 1:
        findings.append(
            Finding(
                check_type="deep_dns_redundancy",
                name="Single Name Server Risk",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-3,
                title="Single Authoritative Name Server Detected",
                summary="Domain delegates to only 1 name server. A single point of failure exists for DNS resolution.",
                why_it_matters="If this single name server experiences downtime or packet loss, your website will become completely unreachable.",
                how_to_fix="Configure at least two independent authoritative name servers with your DNS provider and registrar.",
                estimated_fix_minutes=15,
                documentation_url="https://www.cloudflare.com/learning/dns/what-is-a-nameserver/",
                evidence=f"Configured NS: {dns_data['ns_records'][0]}",
            )
        )

    # 4. IPv6 Readiness
    if dns_data["has_ipv6"]:
        findings.append(
            Finding(
                check_type="deep_dns_ipv6",
                name="IPv6 Readiness",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="IPv6 Ready (AAAA Records Published)",
                summary=f"Domain publishes {len(dns_data['aaaa_records'])} AAAA records, ensuring native IPv6 connectivity.",
                why_it_matters="IPv6 improves mobile latency and ensures compatibility with IPv6-only networks worldwide.",
                how_to_fix="Maintain dual-stack A and AAAA record configuration.",
                estimated_fix_minutes=0,
                documentation_url="https://en.wikipedia.org/wiki/IPv6",
                evidence=", ".join(dns_data["aaaa_records"][:2]),
            )
        )
    else:
        findings.append(
            Finding(
                check_type="deep_dns_ipv6",
                name="IPv6 Not Available",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="IPv4 Only (No AAAA Records Detected)",
                summary="Domain only publishes IPv4 (A) records. Modern IPv6 clients must use translation mechanisms.",
                why_it_matters="IPv6 adoption continues to grow globally. Enabling IPv6 improves connectivity for modern cellular networks.",
                how_to_fix="Assign an IPv6 address to your server or enable IPv6 proxying on your CDN.",
                estimated_fix_minutes=15,
                documentation_url="https://en.wikipedia.org/wiki/IPv6",
                evidence="No AAAA records returned by DNS.",
            )
        )

    return dns_data, findings
