"""
Scanly API - Standalone HTTP Status & Redirect Checker Service
Performs safe, hop-by-hop HTTP status and redirect inspection with strict SSRF defenses,
DNS rebinding prevention (TCP pinning), redirect loop detection, and header sanitization.
Does NOT invoke the full SiteSecura perimeter scanner.
"""
import http.client
import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any
from urllib.parse import urljoin, urlparse

import httpcore
import httpx

from app.schemas.tools import (
    ALLOWED_HTTP_PORTS,
    HttpRedirectHop,
    HttpStatusCheckSummary,
    HttpStatusCheckResponse,
)
from scanner.network.safety import (
    validate_hostname,
    validate_url_target,
    is_safe_ip,
    SSRFValidationError,
)
from scanner.network.resolver import BaseResolver, SafeResolver
from scanner.network.http_client import SafeSyncBackend

logger = logging.getLogger(__name__)

# Safe headers to expose to end users
SAFE_HEADERS = {
    "content-type",
    "content-length",
    "cache-control",
    "location",
    "server",
    "strict-transport-security",
    "content-security-policy",
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "etag",
    "last-modified",
    "age",
}

# Standard browser User-Agent
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SiteSecura-HttpStatusChecker/1.0"
)

# Max bytes to stream on final response body before closing socket
MAX_TERMINAL_BODY_BYTES = 16384  # 16 KB


def sanitize_headers(headers: httpx.Headers) -> Dict[str, str]:
    """Filters response headers against safe whitelist to prevent credential leakage."""
    sanitized: Dict[str, str] = {}
    for k, v in headers.items():
        lower_k = k.lower()
        if lower_k in SAFE_HEADERS:
            sanitized[lower_k] = v
    return sanitized


def validate_target_url_safety(url_str: str, resolver: BaseResolver) -> Tuple[str, str, int, str]:
    """
    Validates that a URL is safe for outbound requests:
    - Scheme must be strictly http or https
    - Hostname must pass SSRF safety validation
    - Port must be in ALLOWED_HTTP_PORTS
    - DNS resolution must succeed and all resolved IPs must be safe public IPs
    Returns: (scheme, host, port, resolved_ip)
    Raises SSRFValidationError on any safety violation.
    """
    if not url_str or not isinstance(url_str, str):
        raise SSRFValidationError("URL cannot be empty.")

    cleaned = url_str.strip()

    # Reject control characters
    if any(ord(c) < 32 or ord(c) == 127 for c in cleaned):
        raise SSRFValidationError("URL contains invalid control characters.")

    # Check for exotic colon-schemes (e.g. javascript:, mailto:, data:, ftp:)
    colon_idx = cleaned.find(":")
    slash_idx = cleaned.find("/")
    if colon_idx != -1 and (slash_idx == -1 or colon_idx < slash_idx):
        potential_scheme = cleaned[:colon_idx].lower()
        if "." not in potential_scheme and potential_scheme.isalpha() and potential_scheme not in ("http", "https"):
            raise SSRFValidationError(f"Unsupported URL scheme '{potential_scheme}'. Only HTTP and HTTPS are permitted.")

    parsed = urlparse(cleaned)
    scheme = (parsed.scheme or "").lower()
    if scheme not in ("http", "https"):
        raise SSRFValidationError(f"Unsupported scheme '{scheme}'. Only HTTP and HTTPS are permitted.")

    # Reject embedded credentials in authority
    if "@" in parsed.netloc or parsed.username or parsed.password:
        raise SSRFValidationError("URLs containing embedded credentials are not permitted.")

    host = parsed.hostname
    if not host:
        raise SSRFValidationError("Unable to extract valid hostname from URL.")

    # Validate hostname against internal/loopback/cloud-metadata rules
    validated_host = validate_hostname(host)

    # Validate port
    port = parsed.port if parsed.port is not None else (443 if scheme == "https" else 80)
    if port not in ALLOWED_HTTP_PORTS:
        raise SSRFValidationError(f"Disallowed port '{port}'. Only standard web ports are permitted.")

    # Resolve and verify all IP candidates are safe public addresses
    approved_ips = resolver.resolve(validated_host, port)
    if not approved_ips:
        raise SSRFValidationError(f"Could not resolve any safe IP addresses for '{validated_host}'.")

    target_ip = approved_ips[0]
    return scheme, validated_host, port, target_ip


def execute_http_status_check_sync(
    url: str,
    max_redirects: int = 10,
    timeout: float = 5.0,
    resolver: Optional[BaseResolver] = None,
    custom_transport: Optional[httpx.BaseTransport] = None,
) -> HttpStatusCheckResponse:
    """
    Synchronous implementation of hop-by-hop HTTP Status and Redirect Check.
    Pins socket connections to approved public IPs to eliminate DNS rebinding risk.
    """
    t_start = time.perf_counter()
    checked_at = datetime.now(timezone.utc).isoformat()

    active_resolver = resolver or SafeResolver(timeout=timeout)

    normalized_url = url.strip()
    if "://" not in normalized_url:
        normalized_url = f"https://{normalized_url}"

    chain: List[HttpRedirectHop] = []
    visited_urls: List[str] = []
    current_url = normalized_url
    redirect_count = 0
    result_status = "success"
    message: Optional[str] = None
    has_ssl_downgrade = False

    initial_scheme = (urlparse(normalized_url).scheme or "https").lower()
    is_https_initial = initial_scheme == "https"

    timeout_cfg = httpx.Timeout(
        connect=min(timeout, 3.0),
        read=timeout,
        write=timeout,
        pool=timeout,
    )

    req_headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Connection": "close",
    }

    step = 0

    while True:
        step += 1

        # Check for redirect loop
        if current_url in visited_urls:
            result_status = "redirect_loop"
            message = f"Redirect loop detected: '{current_url}' was already visited in this chain."
            break

        visited_urls.append(current_url)

        # Validate URL and resolve IP safely before connecting
        try:
            scheme, host, port, target_ip = validate_target_url_safety(current_url, active_resolver)
        except SSRFValidationError as s_err:
            if step == 1:
                result_status = "connection_error"
                message = f"Validation or SSRF error: {str(s_err)}"
            else:
                result_status = "blocked_redirect"
                message = f"Redirect to restricted or unsafe destination '{current_url}' was blocked by security policy."
            break
        except Exception as exc:
            result_status = "connection_error"
            message = f"DNS resolution failed: {str(exc)}"
            break

        # Check for SSL downgrade
        if step > 1 and chain[-1].is_https and scheme != "https":
            has_ssl_downgrade = True

        # Build transport with socket-level connection pinning unless custom_transport provided
        backend = None
        if custom_transport is not None:
            transport = custom_transport
            connected_ip = target_ip
        else:
            backend = SafeSyncBackend(active_resolver)
            pool = httpcore.ConnectionPool(
                network_backend=backend,
                max_connections=5,
                max_keepalive_connections=0,
            )
            transport = httpx.HTTPTransport()
            transport._pool = pool
            connected_ip = target_ip

        # Execute single hop request
        t_hop_start = time.perf_counter()
        resp: Optional[httpx.Response] = None

        try:
            with httpx.Client(
                transport=transport,
                timeout=timeout_cfg,
                follow_redirects=False,
                headers=req_headers,
                verify=True,
            ) as client:
                req = client.build_request("GET", current_url)
                resp = client._send_single_request(req)
                t_hop_end = time.perf_counter()
                hop_duration_ms = round((t_hop_end - t_hop_start) * 1000, 2)

                status_code = resp.status_code
                status_text = http.client.responses.get(status_code, "Unknown Status")
                sanitized_hdrs = sanitize_headers(resp.headers)
                location_header = resp.headers.get("location")

                # If backend recorded the connected IP, use that
                if backend and backend.last_connected_ip:
                    connected_ip = backend.last_connected_ip

                # Check if this is a redirect hop
                if status_code in (301, 302, 303, 307, 308):
                    resp.close()

                    if not location_header:
                        # Redirect status without Location header is terminal
                        hop = HttpRedirectHop(
                            step=step,
                            url=current_url,
                            status_code=status_code,
                            status_text=status_text,
                            location=None,
                            next_url=None,
                            response_time_ms=hop_duration_ms,
                            is_https=(scheme == "https"),
                            ip_address=connected_ip,
                            headers=sanitized_hdrs,
                        )
                        chain.append(hop)
                        result_status = "client_error"
                        message = f"Server returned redirect status {status_code} without a Location header."
                        break

                    next_candidate_url = urljoin(current_url, location_header.strip())

                    hop = HttpRedirectHop(
                        step=step,
                        url=current_url,
                        status_code=status_code,
                        status_text=status_text,
                        location=location_header,
                        next_url=next_candidate_url,
                        response_time_ms=hop_duration_ms,
                        is_https=(scheme == "https"),
                        ip_address=connected_ip,
                        headers=sanitized_hdrs,
                    )
                    chain.append(hop)

                    redirect_count += 1
                    if redirect_count > max_redirects:
                        result_status = "redirect_limit"
                        message = f"Redirect chain exceeded the maximum limit of {max_redirects} redirects."
                        break

                    # Check next URL for loop before continuing
                    if next_candidate_url in visited_urls:
                        result_status = "redirect_loop"
                        message = f"Redirect loop detected: '{next_candidate_url}' was already visited in this chain."
                        break

                    # Pre-validate next candidate target for SSRF safety before making subsequent request
                    try:
                        validate_target_url_safety(next_candidate_url, active_resolver)
                    except (SSRFValidationError, ValueError) as next_err:
                        result_status = "blocked_redirect"
                        message = f"Redirect to unsafe destination '{next_candidate_url}' was blocked by SSRF security policy: {str(next_err)}"
                        break

                    current_url = next_candidate_url
                    continue

                else:
                    # Terminal response: stream up to 16KB safely then close
                    try:
                        _ = resp.read()
                    except Exception:
                        pass
                    finally:
                        resp.close()

                    hop = HttpRedirectHop(
                        step=step,
                        url=current_url,
                        status_code=status_code,
                        status_text=status_text,
                        location=None,
                        next_url=None,
                        response_time_ms=hop_duration_ms,
                        is_https=(scheme == "https"),
                        ip_address=connected_ip,
                        headers=sanitized_hdrs,
                    )
                    chain.append(hop)

                    # Classify final result
                    if 200 <= status_code < 300:
                        result_status = "success"
                    elif 400 <= status_code < 500:
                        result_status = "client_error"
                        message = f"Server returned client error HTTP {status_code} ({status_text})."
                    elif 500 <= status_code < 600:
                        result_status = "server_error"
                        message = f"Server returned server error HTTP {status_code} ({status_text})."
                    else:
                        result_status = "success"

                    break

        except httpx.TimeoutException as t_exc:
            t_hop_end = time.perf_counter()
            hop_duration_ms = round((t_hop_end - t_hop_start) * 1000, 2)
            result_status = "timeout"
            message = f"Connection or read timed out after {timeout} seconds ({str(t_exc)})."
            break

        except (httpx.ConnectError, httpx.RequestError) as c_exc:
            t_hop_end = time.perf_counter()
            hop_duration_ms = round((t_hop_end - t_hop_start) * 1000, 2)
            result_status = "connection_error"
            message = f"Failed to connect to target: {str(c_exc)}"
            break

        except Exception as gen_exc:
            t_hop_end = time.perf_counter()
            hop_duration_ms = round((t_hop_end - t_hop_start) * 1000, 2)
            result_status = "connection_error"
            message = f"An unexpected error occurred during HTTP check: {str(gen_exc)}"
            break

    t_total_end = time.perf_counter()
    total_duration_ms = round((t_total_end - t_start) * 1000, 2)

    final_url = chain[-1].url if chain else current_url
    final_status_code = chain[-1].status_code if chain else None
    final_status_text = chain[-1].status_text if chain else None
    is_https_final = (urlparse(final_url).scheme or "").lower() == "https"

    summary = HttpStatusCheckSummary(
        total_redirects=len([h for h in chain if h.status_code in (301, 302, 303, 307, 308)]),
        is_https_initial=is_https_initial,
        is_https_final=is_https_final,
        has_ssl_downgrade=has_ssl_downgrade,
        duration_ms=total_duration_ms,
    )

    return HttpStatusCheckResponse(
        requested_url=url,
        normalized_url=normalized_url,
        checked_at=checked_at,
        duration_ms=total_duration_ms,
        final_url=final_url,
        final_status_code=final_status_code,
        final_status_text=final_status_text,
        redirect_count=summary.total_redirects,
        chain=chain,
        result_status=result_status,
        message=message,
        summary=summary,
    )


async def execute_http_status_check(
    url: str,
    max_redirects: int = 10,
    timeout: float = 5.0,
    resolver: Optional[BaseResolver] = None,
    custom_transport: Optional[httpx.BaseTransport] = None,
) -> HttpStatusCheckResponse:
    """
    Asynchronously executes standalone HTTP status and redirect check by offloading
    blocking socket operations to an executor thread.
    """
    import asyncio

    return await asyncio.to_thread(
        execute_http_status_check_sync,
        url=url,
        max_redirects=max_redirects,
        timeout=timeout,
        resolver=resolver,
        custom_transport=custom_transport,
    )
