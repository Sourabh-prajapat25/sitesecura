"""
Scanly Scanner Engine - Security Headers Check Module
Inspects HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
"""
from typing import Dict, Any, List
from .models import Finding, CheckStatus, Severity
from .recommendations import get_recommendation


def check_security_headers(headers: Dict[str, str]) -> Dict[str, Any]:
    """
    Evaluates presence and configuration of essential security headers.
    Headers are normalized to lowercase for resilient inspection.
    """
    findings: List[Finding] = []
    norm_headers = {k.lower(): v for k, v in headers.items()}

    headers_data: Dict[str, Any] = {
        "hsts": norm_headers.get("strict-transport-security"),
        "csp": norm_headers.get("content-security-policy"),
        "x_frame_options": norm_headers.get("x-frame-options"),
        "x_content_type_options": norm_headers.get("x-content-type-options"),
        "referrer_policy": norm_headers.get("referrer-policy"),
        "permissions_policy": norm_headers.get("permissions-policy"),
        "server": norm_headers.get("server"),
        "x_powered_by": norm_headers.get("x-powered-by"),
    }

    # 1. HSTS (Strict-Transport-Security)
    if headers_data["hsts"]:
        rec = get_recommendation("hsts_present")
        findings.append(
            Finding(
                check_type="hsts",
                name="Strict-Transport-Security",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="HSTS Header Configured",
                summary="HTTP Strict Transport Security is active.",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=0,
                documentation_url=rec["documentation_url"],
                evidence=headers_data["hsts"],
            )
        )
    else:
        rec = get_recommendation("hsts_missing")
        findings.append(
            Finding(
                check_type="hsts",
                name="Strict-Transport-Security",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-8,
                title=rec["title"],
                summary="Strict-Transport-Security header is missing from HTTPS responses.",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=rec["estimated_fix_minutes"],
                documentation_url=rec["documentation_url"],
                evidence="Header 'Strict-Transport-Security' not returned.",
            )
        )

    # 2. Content-Security-Policy (CSP)
    if headers_data["csp"]:
        rec = get_recommendation("csp_present")
        findings.append(
            Finding(
                check_type="csp",
                name="Content-Security-Policy",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Content Security Policy Active",
                summary="CSP header restricts authorized resource origins.",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=0,
                documentation_url=rec["documentation_url"],
                evidence=headers_data["csp"][:200] + "..." if len(headers_data["csp"]) > 200 else headers_data["csp"],
            )
        )
    else:
        rec = get_recommendation("csp_missing")
        findings.append(
            Finding(
                check_type="csp",
                name="Content-Security-Policy",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-8,
                title=rec["title"],
                summary="Content-Security-Policy header is missing.",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=rec["estimated_fix_minutes"],
                documentation_url=rec["documentation_url"],
                evidence="Header 'Content-Security-Policy' not returned.",
            )
        )

    # 3. X-Frame-Options
    if headers_data["x_frame_options"]:
        findings.append(
            Finding(
                check_type="x_frame_options",
                name="X-Frame-Options",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Clickjacking Protection Configured",
                summary=f"X-Frame-Options is set to '{headers_data['x_frame_options']}'.",
                why_it_matters="Prevents site framing and clickjacking attacks.",
                how_to_fix="Maintain current configuration.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options",
                evidence=headers_data["x_frame_options"],
            )
        )
    else:
        rec = get_recommendation("x_frame_options_missing")
        findings.append(
            Finding(
                check_type="x_frame_options",
                name="X-Frame-Options",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-4,
                title=rec["title"],
                summary="X-Frame-Options header is missing.",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=rec["estimated_fix_minutes"],
                documentation_url=rec["documentation_url"],
                evidence="Header 'X-Frame-Options' not returned.",
            )
        )

    # 4. X-Content-Type-Options
    if headers_data["x_content_type_options"]:
        findings.append(
            Finding(
                check_type="x_content_type_options",
                name="X-Content-Type-Options",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="MIME-Sniffing Protection Active",
                summary="X-Content-Type-Options is set to 'nosniff'.",
                why_it_matters="Prevents browsers from MIME-sniffing away from declared content-type.",
                how_to_fix="Maintain current configuration.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options",
                evidence=headers_data["x_content_type_options"],
            )
        )
    else:
        rec = get_recommendation("x_content_type_options_missing")
        findings.append(
            Finding(
                check_type="x_content_type_options",
                name="X-Content-Type-Options",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-3,
                title=rec["title"],
                summary="X-Content-Type-Options: nosniff is missing.",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=rec["estimated_fix_minutes"],
                documentation_url=rec["documentation_url"],
                evidence="Header 'X-Content-Type-Options' not returned.",
            )
        )

    # 5. Referrer-Policy
    if headers_data["referrer_policy"]:
        findings.append(
            Finding(
                check_type="referrer_policy",
                name="Referrer-Policy",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Referrer Policy Configured",
                summary=f"Referrer-Policy is set to '{headers_data['referrer_policy']}'.",
                why_it_matters="Controls how much referrer information is included with requests.",
                how_to_fix="Maintain current configuration.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy",
                evidence=headers_data["referrer_policy"],
            )
        )
    else:
        rec = get_recommendation("referrer_policy_missing")
        findings.append(
            Finding(
                check_type="referrer_policy",
                name="Referrer-Policy",
                status=CheckStatus.INFO,
                severity=Severity.LOW,
                score_impact=-2,
                title=rec["title"],
                summary="Referrer-Policy header is not explicitly set.",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=rec["estimated_fix_minutes"],
                documentation_url=rec["documentation_url"],
                evidence="Header 'Referrer-Policy' not returned.",
            )
        )

    # 6. Check for verbose Server / X-Powered-By leakage
    server_hdr = headers_data.get("server") or ""
    x_powered_hdr = headers_data.get("x_powered_by") or ""
    if any(char.isdigit() for char in server_hdr) or x_powered_hdr:
        rec = get_recommendation("server_version_disclosed")
        findings.append(
            Finding(
                check_type="info_disclosure",
                name="Server Version Disclosure",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-3,
                title=rec["title"],
                summary=f"Server exposes version details: Server='{server_hdr}' X-Powered-By='{x_powered_hdr}'",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=rec["estimated_fix_minutes"],
                documentation_url=rec["documentation_url"],
                evidence=f"Server: {server_hdr} | X-Powered-By: {x_powered_hdr}",
            )
        )

    return {"headers_data": headers_data, "findings": findings}
