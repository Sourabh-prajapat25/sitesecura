"""
Scanly Scanner Engine - Deep Scan Advanced Semantic HSTS Analysis
Performs deep parsing and validation of Strict-Transport-Security (HSTS) headers:
- max-age evaluation (checking against 6-month / 1-year security thresholds)
- includeSubDomains directive verification
- preload directive eligibility
- anti-double-counting protection (suppresses redundant sub-findings if HSTS is completely missing)
"""
from typing import Dict, Any, List, Optional, Tuple
from scanner.models import Finding, CheckStatus, Severity
from .models import CrawledPage


# Thresholds: 6 months = 15552000s, 1 year = 31536000s
MIN_RECOMMENDED_MAX_AGE = 10886400   # ~126 days (minimum baseline)
OPTIMAL_MAX_AGE = 31536000          # 1 year (Chrome Preload requirement)


def parse_hsts_header(header_value: str) -> Dict[str, Any]:
    """Parses raw Strict-Transport-Security header value into directives and numerical max-age."""
    directives = [d.strip() for d in header_value.split(";") if d.strip()]
    max_age_val: Optional[int] = None
    includes_subdomains = False
    preload = False

    for d in directives:
        lower_d = d.lower()
        if lower_d.startswith("max-age="):
            try:
                max_age_val = int(lower_d.split("=")[1].strip())
            except ValueError:
                pass
        elif lower_d == "includesubdomains":
            includes_subdomains = True
        elif lower_d == "preload":
            preload = True

    return {
        "raw": header_value,
        "is_present": True,
        "max_age_seconds": max_age_val,
        "includes_subdomains": includes_subdomains,
        "preload": preload,
    }


def analyze_deep_hsts(crawled_pages: List[CrawledPage]) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Performs semantic HSTS analysis across crawled pages.
    Returns (hsts_data, findings).
    Anti-double-counting: If HSTS is missing across all pages, returns empty findings
    (since multi-page header consistency audit already reported deep_hsts_missing).
    """
    findings: List[Finding] = []
    hsts_data: Dict[str, Any] = {
        "is_present": False,
        "raw_header": None,
        "max_age_seconds": None,
        "includes_subdomains": False,
        "preload": False,
        "status": "missing",
    }

    # Find first page that returns HSTS header
    sample_page_url = None
    raw_header = None
    for p in crawled_pages:
        if p.status_code and p.status_code < 400:
            norm_headers = {k.lower(): v for k, v in p.headers.items()}
            val = norm_headers.get("strict-transport-security")
            if val and val.strip():
                raw_header = val.strip()
                sample_page_url = p.url
                break

    # If completely missing across all pages, suppress redundant sub-findings
    if not raw_header:
        return hsts_data, findings

    parsed = parse_hsts_header(raw_header)
    hsts_data.update(parsed)
    hsts_data["raw_header"] = raw_header

    max_age = parsed.get("max_age_seconds")
    subdomains = parsed.get("includes_subdomains", False)
    preload = parsed.get("preload", False)

    # 1. Evaluate max-age
    if max_age is None:
        findings.append(
            Finding(
                check_type="deep_hsts_invalid_syntax",
                name="Invalid HSTS max-age Directive",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-3,
                title="HSTS Header Missing Numerical max-age",
                summary="The Strict-Transport-Security header is present, but lacks a valid numerical 'max-age=<seconds>' directive.",
                why_it_matters="Browsers will disregard an HSTS header that fails RFC 6797 syntax requirements.",
                how_to_fix="Ensure your HSTS header defines max-age (e.g. `max-age=31536000; includeSubDomains; preload`).",
                estimated_fix_minutes=5,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security",
                evidence=raw_header,
            )
        )
    elif max_age < MIN_RECOMMENDED_MAX_AGE:
        days = max_age // 86400
        findings.append(
            Finding(
                check_type="deep_hsts_short_max_age",
                name="HSTS max-age Too Short",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-3,
                title=f"HSTS max-age Duration Too Short ({days} days)",
                summary=f"Strict-Transport-Security max-age is set to {max_age} seconds ({days} days). Security best practice recommends at least 6 months (15552000s) to 1 year (31536000s).",
                why_it_matters="Short HSTS durations leave returning visitors vulnerable to SSL-stripping attacks if they revisit after the brief window expires.",
                how_to_fix="Increase max-age to 31536000 (1 year): `Strict-Transport-Security: max-age=31536000; includeSubDomains`.",
                estimated_fix_minutes=5,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security",
                evidence=f"Configured max-age: {max_age} seconds ({days} days)",
            )
        )

    # 2. Evaluate includeSubDomains
    if not subdomains:
        findings.append(
            Finding(
                check_type="deep_hsts_missing_subdomains",
                name="HSTS includeSubDomains Missing",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-2,
                title="HSTS includeSubDomains Flag Missing",
                summary="Strict-Transport-Security does not declare the 'includeSubDomains' directive. Subdomains are not automatically protected by HSTS.",
                why_it_matters="Without includeSubDomains, an attacker who intercepts traffic to a subdomain (e.g., api.example.com or blog.example.com) can execute SSL-stripping.",
                how_to_fix="Add the `includeSubDomains` directive to your HSTS policy once all subdomains support HTTPS.",
                estimated_fix_minutes=5,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security",
                evidence=raw_header,
            )
        )

    # 3. Evaluate Preload Directive
    if preload:
        findings.append(
            Finding(
                check_type="deep_hsts_preload_ready",
                name="HSTS Preload Directive Configured",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="HSTS Preload Directive Enabled",
                summary="Strict-Transport-Security contains the 'preload' flag, declaring eligibility for hardcoded browser preload lists (hstspreload.org).",
                why_it_matters="Preloaded domains are connected exclusively over HTTPS from the very first request without ever making an unencrypted HTTP probe.",
                how_to_fix="Submit your domain to https://hstspreload.org if not already submitted.",
                estimated_fix_minutes=0,
                documentation_url="https://hstspreload.org",
                evidence=raw_header,
            )
        )

    # 4. Overall Strong HSTS policy
    if max_age and max_age >= MIN_RECOMMENDED_MAX_AGE and subdomains:
        hsts_data["status"] = "strong"
        findings.append(
            Finding(
                check_type="deep_hsts_strong",
                name="Robust HSTS Policy Enforced",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Robust HSTS Policy Enforced",
                summary=f"Strict-Transport-Security enforces a durable max-age ({max_age // 86400} days) and covers all subdomains.",
                why_it_matters="Robust HSTS protects your visitors against Man-in-the-Middle downgrades and cookie hijacking.",
                how_to_fix="Maintain existing web server HSTS configuration.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security",
                evidence=raw_header,
            )
        )
    elif max_age and max_age > 0:
        hsts_data["status"] = "acceptable"
    else:
        hsts_data["status"] = "weak"

    return hsts_data, findings
