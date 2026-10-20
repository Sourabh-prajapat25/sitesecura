"""
Scanly Scanner Engine - HTTP / HTTPS Check Module
Verifies availability, redirect behavior, and HTTPS enforcement using the safe network layer.
"""
from typing import Dict, Any, List, Optional

from .models import Finding, CheckStatus, Severity
from .recommendations import get_recommendation
from .domain import resolve_and_validate_target, SSRFValidationError
from .network.models import SafeNetworkConfig, SafeResponse
from .network.resolver import BaseResolver, SafeResolver
from .network.http_client import SafeHttpClient


def check_http_https(
    domain: str,
    timeout_seconds: float = 8.0,
    client: Optional[SafeHttpClient] = None,
    config: Optional[SafeNetworkConfig] = None,
    resolver: Optional[BaseResolver] = None,
) -> Dict[str, Any]:
    """
    Checks HTTP and HTTPS endpoints for the target domain safely:
    - Verifies port 80 (HTTP)
    - Verifies port 443 (HTTPS)
    - Checks whether HTTP redirects to HTTPS with SSRF-validated hops
    - Enforces response size limits and redirect bounds
    - Inspects response headers, cookies, and status codes
    """
    findings: List[Finding] = []
    http_data: Dict[str, Any] = {
        "http_available": False,
        "https_available": False,
        "http_status": None,
        "https_status": None,
        "redirects_to_https": False,
        "redirect_chain": [],
        "final_url": None,
        "headers": {},
        "cookies": {},
        "set_cookie_headers": [],
        "html_sample": "",
        "response_time_ms": 0,
        "resolved_ip": None,
    }

    # Prepare configuration and safe client
    net_config = config or SafeNetworkConfig(
        connect_timeout=min(timeout_seconds, 5.0),
        read_timeout=min(timeout_seconds, 5.0),
        total_timeout=timeout_seconds,
    )
    safe_resolver = resolver or SafeResolver(timeout=net_config.connect_timeout)
    safe_client = client or SafeHttpClient(config=net_config, resolver=safe_resolver)

    # Pre-validate domain & resolve target safely
    try:
        norm_domain, resolved_ip = resolve_and_validate_target(domain, resolver=safe_resolver)
        http_data["resolved_ip"] = resolved_ip
    except SSRFValidationError as e:
        rec = get_recommendation("https_missing")
        findings.append(
            Finding(
                check_type="domain_validation",
                name="Domain Validation Failed",
                status=CheckStatus.CRITICAL,
                severity=Severity.CRITICAL,
                score_impact=-30,
                title="Target Validation Failed",
                summary=str(e),
                why_it_matters="Scanly only assesses valid, public, reachable domain targets.",
                how_to_fix="Ensure domain is registered, DNS is configured, and domain is publicly accessible.",
                estimated_fix_minutes=5,
                documentation_url="https://owasp.org",
                evidence=str(e),
            )
        )
        return {"http_data": http_data, "findings": findings}

    # 1. Test Plain HTTP (port 80) and inspect redirection
    http_url = f"http://{norm_domain}"
    try:
        resp = safe_client.get(http_url)
        http_data["response_time_ms"] = resp.elapsed_ms
        http_data["redirect_chain"] = resp.redirect_chain

        if resp.error:
            if "Maximum redirect limit reached" in resp.error:
                http_data["http_available"] = False
                http_data["http_error"] = resp.error
                findings.append(
                    Finding(
                        check_type="http_redirect",
                        name="HTTP Redirect Limit Exceeded",
                        status=CheckStatus.UNKNOWN,
                        severity=Severity.MEDIUM,
                        score_impact=-10,
                        title="Maximum Redirect Limit Reached",
                        summary="The HTTP endpoint exceeded the maximum allowed number of redirects.",
                        why_it_matters="Excessive redirects degrade performance, confuse search crawlers, and may indicate misconfigured loops.",
                        how_to_fix="Reduce redirect hops to direct visitors immediately to the target HTTPS URL.",
                        estimated_fix_minutes=5,
                        documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections",
                        evidence=f"Redirect chain: {' -> '.join(resp.redirect_chain)}",
                    )
                )
            elif "Redirect loop detected" in resp.error:
                http_data["http_available"] = False
                http_data["http_error"] = resp.error
                findings.append(
                    Finding(
                        check_type="http_redirect",
                        name="HTTP Redirect Loop Detected",
                        status=CheckStatus.WARNING,
                        severity=Severity.HIGH,
                        score_impact=-15,
                        title="Infinite Redirect Loop Detected",
                        summary="HTTP requests encountered a circular redirect path.",
                        why_it_matters="Redirect loops prevent visitors and automated scanners from reaching the web page.",
                        how_to_fix="Ensure web server rewrite rules and HTTPS redirection do not point back to preceding URLs.",
                        estimated_fix_minutes=10,
                        documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections",
                        evidence=f"Redirect loop: {' -> '.join(resp.redirect_chain)}",
                    )
                )
            else:
                http_data["http_available"] = False
                http_data["http_error"] = resp.error
        else:
            http_data["http_available"] = True
            http_data["http_status"] = resp.status_code
            http_data["final_url"] = resp.final_url or str(resp.url)

            chain = resp.redirect_chain
            final_target = str(http_data["final_url"]).lower()

            if final_target.startswith("https://"):
                http_data["redirects_to_https"] = True
                rec = get_recommendation("https_available")
                findings.append(
                    Finding(
                        check_type="http_redirect",
                        name="HTTP to HTTPS Redirection",
                        status=CheckStatus.PASS,
                        severity=Severity.INFO,
                        score_impact=0,
                        title="HTTP Automatically Redirects to HTTPS",
                        summary=f"HTTP requests are redirected securely to {http_data['final_url']}",
                        why_it_matters=rec["why_it_matters"],
                        how_to_fix=rec["how_to_fix"],
                        estimated_fix_minutes=0,
                        documentation_url=rec["documentation_url"],
                        evidence=f"Redirect chain: {' -> '.join(chain)}",
                    )
                )
            else:
                rec = get_recommendation("http_redirect_missing")
                findings.append(
                    Finding(
                        check_type="http_redirect",
                        name="Missing HTTP to HTTPS Redirect",
                        status=CheckStatus.WARNING,
                        severity=Severity.MEDIUM,
                        score_impact=-10,
                        title=rec["title"],
                        summary=f"HTTP requests stay on unencrypted HTTP ({http_data['final_url']})",
                        why_it_matters=rec["why_it_matters"],
                        how_to_fix=rec["how_to_fix"],
                        estimated_fix_minutes=rec["estimated_fix_minutes"],
                        documentation_url=rec["documentation_url"],
                        evidence=f"Final URL: {http_data['final_url']}",
                    )
                )

    except SSRFValidationError as e:
        http_data["http_available"] = False
        http_data["http_error"] = str(e)
        findings.append(
            Finding(
                check_type="http_redirect",
                name="Unsafe Redirect Blocked",
                status=CheckStatus.UNKNOWN,
                severity=Severity.CRITICAL,
                score_impact=-25,
                title="Redirect to Prohibited Destination Blocked",
                summary="An outbound redirect attempted to navigate to a restricted local, private, or metadata address.",
                why_it_matters="Redirects must not expose internal networks or cloud infrastructure to Server-Side Request Forgery.",
                how_to_fix="Ensure all application redirects point exclusively to authorized public web endpoints.",
                estimated_fix_minutes=5,
                documentation_url="https://owasp.org/www-community/attacks/Server_Side_Request_Forgery",
                evidence=str(e),
            )
        )
    except Exception as e:
        http_data["http_available"] = False
        http_data["http_error"] = str(e)

    # 2. Test Direct HTTPS (port 443)
    https_url = f"https://{norm_domain}"
    try:
        # Limit HTML sample to min(config.max_response_bytes, 131072 bytes) for preview / tech fingerprinting
        preview_limit = min(net_config.max_response_bytes, 131072)
        resp = safe_client.get(https_url, max_response_bytes=preview_limit)
        if resp.error:
            http_data["https_available"] = False
            http_data["https_error"] = resp.error
            rec = get_recommendation("https_missing")
            findings.append(
                Finding(
                    check_type="https_availability",
                    name="HTTPS Unavailable",
                    status=CheckStatus.CRITICAL,
                    severity=Severity.CRITICAL,
                    score_impact=-25,
                    title=rec["title"],
                    summary=f"Could not establish secure HTTPS connection to {norm_domain}: {resp.error}",
                    why_it_matters=rec["why_it_matters"],
                    how_to_fix=rec["how_to_fix"],
                    estimated_fix_minutes=rec["estimated_fix_minutes"],
                    documentation_url=rec["documentation_url"],
                    evidence=resp.error,
                )
            )
        else:
            http_data["https_available"] = True
            http_data["https_status"] = resp.status_code
            http_data["headers"] = resp.headers
            http_data["cookies"] = resp.cookies
            http_data["set_cookie_headers"] = resp.set_cookie_headers
            http_data["html_sample"] = resp.text

            rec = get_recommendation("https_available")
            findings.append(
                Finding(
                    check_type="https_availability",
                    name="HTTPS Availability",
                    status=CheckStatus.PASS,
                    severity=Severity.INFO,
                    score_impact=0,
                    title="HTTPS Connection Active",
                    summary=f"HTTPS is operational with status HTTP {resp.status_code}.",
                    why_it_matters=rec["why_it_matters"],
                    how_to_fix=rec["how_to_fix"],
                    estimated_fix_minutes=0,
                    documentation_url=rec["documentation_url"],
                    evidence=f"Status: HTTP {resp.status_code} on {https_url}",
                )
            )

    except SSRFValidationError as e:
        http_data["https_available"] = False
        http_data["https_error"] = str(e)
        rec = get_recommendation("https_missing")
        findings.append(
            Finding(
                check_type="https_availability",
                name="HTTPS SSRF Rejection",
                status=CheckStatus.UNKNOWN,
                severity=Severity.CRITICAL,
                score_impact=-25,
                title="HTTPS Target Restricted",
                summary=f"Target resolved to a restricted network address: {str(e)}",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=rec["estimated_fix_minutes"],
                documentation_url=rec["documentation_url"],
                evidence=str(e),
            )
        )
    except Exception as e:
        http_data["https_available"] = False
        http_data["https_error"] = str(e)
        rec = get_recommendation("https_missing")
        findings.append(
            Finding(
                check_type="https_availability",
                name="HTTPS Unavailable",
                status=CheckStatus.CRITICAL,
                severity=Severity.CRITICAL,
                score_impact=-25,
                title=rec["title"],
                summary=f"Could not establish secure HTTPS connection to {norm_domain}: {str(e)}",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=rec["estimated_fix_minutes"],
                documentation_url=rec["documentation_url"],
                evidence=str(e),
            )
        )

    return {"http_data": http_data, "findings": findings}
