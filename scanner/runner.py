"""
Scanly Scanner Engine - Runner & Orchestrator
Executes all defensive security checks with modular exception isolation and bounded timeouts.
"""
from datetime import datetime, timezone
import time
from typing import List, Optional

from .models import ScanResult, Finding, CheckStatus, Severity, RiskLevel
from .domain import resolve_and_validate_target, SSRFValidationError
from .http_check import check_http_https
from .ssl_check import check_ssl_certificate
from .dns_check import check_dns_email_security
from .headers_check import check_security_headers
from .cookies_check import check_cookies
from .tech_check import check_technologies
from .scoring import calculate_score
from .network.models import SafeNetworkConfig
from .network.resolver import BaseResolver, SafeResolver


def run_security_scan(
    target_domain: str,
    timeout_seconds: float = 10.0,
    config: Optional[SafeNetworkConfig] = None,
    resolver: Optional[BaseResolver] = None,
) -> ScanResult:
    """
    Executes a complete, passive defensive security scan on target_domain:
    1. Domain validation & SSRF protection
    2. HTTP/HTTPS availability & redirects with SSRF validation
    3. SSL/TLS certificate validity, expiry, SAN (pinned IP to prevent rebinding)
    4. DNS & Email security (SPF, DMARC, DNSSEC, DKIM guidance)
    5. Security Headers (HSTS, CSP, X-Frame-Options, etc.)
    6. Cookie security attributes (parsed individually)
    7. Technology & CMS fingerprinting
    8. Deterministic score calculation
    """
    start_time = datetime.now(timezone.utc)
    t0 = time.time()

    all_findings: List[Finding] = []
    target_ip: Optional[str] = None
    normalized_domain = target_domain
    error_message: Optional[str] = None
    is_partial = False

    net_config = config or SafeNetworkConfig(
        connect_timeout=min(timeout_seconds, 5.0),
        read_timeout=min(timeout_seconds, 5.0),
        write_timeout=min(timeout_seconds, 5.0),
        pool_timeout=min(timeout_seconds, 5.0),
        total_timeout=timeout_seconds,
    )
    safe_resolver = resolver or SafeResolver(timeout=net_config.connect_timeout)

    # 1. Validation & SSRF Check
    try:
        normalized_domain, target_ip = resolve_and_validate_target(target_domain, resolver=safe_resolver)
    except SSRFValidationError as e:
        completed_at = datetime.now(timezone.utc)
        duration_ms = int((time.time() - t0) * 1000)
        return ScanResult(
            domain=target_domain,
            normalized_domain=target_domain,
            target_ip=None,
            score=0,
            risk_level=RiskLevel.CRITICAL,
            score_breakdown={},
            findings=[
                Finding(
                    check_type="domain_validation",
                    name="Target Validation Failed",
                    status=CheckStatus.CRITICAL,
                    severity=Severity.CRITICAL,
                    score_impact=-100,
                    title="Validation / SSRF Rejection",
                    summary=str(e),
                    why_it_matters="Scanly only scans valid public hostnames.",
                    how_to_fix="Please provide a valid public domain (e.g. example.com).",
                    estimated_fix_minutes=1,
                    documentation_url="https://scanly.io/docs/faq",
                    evidence=str(e),
                )
            ],
            passed_checks_count=0,
            total_checks_count=1,
            scan_duration_ms=duration_ms,
            started_at=start_time,
            completed_at=completed_at,
            error_message=str(e),
            is_partial=False,
        )

    # 2. HTTP / HTTPS Check (SSRF redirect validation & bounded response size)
    http_headers = {}
    raw_cookies = {}
    set_cookie_headers = []
    html_sample = ""
    try:
        http_res = check_http_https(
            normalized_domain,
            timeout_seconds=timeout_seconds,
            config=net_config,
            resolver=safe_resolver,
        )
        all_findings.extend(http_res["findings"])
        http_data = http_res["http_data"]
        http_headers = http_data.get("headers", {})
        raw_cookies = http_data.get("cookies", {})
        set_cookie_headers = http_data.get("set_cookie_headers", [])
        html_sample = http_data.get("html_sample", "")
    except Exception as e:
        is_partial = True
        error_message = f"HTTP check warning: {str(e)}"

    # 3. SSL / TLS Certificate Check (DNS rebinding pinned connection)
    try:
        ssl_res = check_ssl_certificate(
            normalized_domain,
            timeout_seconds=timeout_seconds,
            resolver=safe_resolver,
        )
        all_findings.extend(ssl_res["findings"])
    except Exception as e:
        is_partial = True
        error_message = f"SSL check warning: {str(e)}"

    # 4. DNS & Email Security Check
    try:
        dns_res = check_dns_email_security(normalized_domain, timeout_seconds=min(timeout_seconds, 2.0))
        all_findings.extend(dns_res["findings"])
    except Exception as e:
        is_partial = True
        error_message = f"DNS check warning: {str(e)}"

    # 5. Security Headers Check
    try:
        headers_res = check_security_headers(http_headers)
        all_findings.extend(headers_res["findings"])
    except Exception as e:
        is_partial = True

    # 6. Cookies Check (Individual evaluation)
    try:
        cookies_res = check_cookies(
            http_headers,
            raw_cookies=raw_cookies,
            set_cookie_headers=set_cookie_headers,
        )
        all_findings.extend(cookies_res["findings"])
    except Exception as e:
        is_partial = True

    # 7. Technology Detection
    try:
        tech_res = check_technologies(http_headers, html_sample)
        all_findings.extend(tech_res["findings"])
    except Exception as e:
        is_partial = True

    # 8. Deterministic Scoring
    score, risk_level, breakdown, passed_count, total_count = calculate_score(all_findings)

    completed_at = datetime.now(timezone.utc)
    duration_ms = int((time.time() - t0) * 1000)

    return ScanResult(
        domain=target_domain,
        normalized_domain=normalized_domain,
        target_ip=target_ip,
        score=score,
        risk_level=risk_level,
        score_breakdown=breakdown,
        findings=all_findings,
        passed_checks_count=passed_count,
        total_checks_count=len(all_findings),
        scan_duration_ms=duration_ms,
        started_at=start_time,
        completed_at=completed_at,
        error_message=error_message,
        is_partial=is_partial,
    )
