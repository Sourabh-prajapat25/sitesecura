"""
Scanly Scanner Engine - Deep Scan Advanced Security Headers Quality Inspection
Inspects quality, security values, and modern cross-origin isolation policies:
- Referrer-Policy security evaluation (identifying 'unsafe-url' leakage)
- Permissions-Policy API restriction audits (camera, microphone, geolocation)
- Modern cross-origin isolation policies (COOP, CORP, COEP)
- X-Content-Type-Options: nosniff validation
"""
from typing import Dict, Any, List, Optional, Tuple
from scanner.models import Finding, CheckStatus, Severity
from .models import CrawledPage

SAFE_REFERRER_POLICIES = {
    "strict-origin-when-cross-origin",
    "no-referrer",
    "same-origin",
    "strict-origin",
}

INSECURE_REFERRER_POLICIES = {
    "unsafe-url",
}


def analyze_deep_security_headers_quality(crawled_pages: List[CrawledPage]) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Evaluates quality and semantic correctness of security headers across crawled pages.
    Returns (headers_quality_data, findings).
    """
    findings: List[Finding] = []

    quality_data: Dict[str, Any] = {
        "referrer_policy": None,
        "referrer_policy_status": "missing",
        "permissions_policy": None,
        "permissions_policy_apis_restricted": [],
        "coop": None,
        "corp": None,
        "coep": None,
        "x_content_type_options": None,
    }

    # Find first successful page with headers
    sample_page = None
    for p in crawled_pages:
        if p.status_code and p.status_code < 400 and p.headers:
            sample_page = p
            break

    if not sample_page:
        return quality_data, findings

    norm_headers = {k.lower(): v.strip() for k, v in sample_page.headers.items()}

    # 1. Referrer-Policy Inspection
    ref_pol = norm_headers.get("referrer-policy")
    if ref_pol:
        quality_data["referrer_policy"] = ref_pol
        lower_ref = ref_pol.lower()

        # Handle multiple policies if comma-separated
        policies = [p.strip() for p in lower_ref.split(",")]
        effective_policy = policies[-1] if policies else lower_ref

        if effective_policy in INSECURE_REFERRER_POLICIES:
            quality_data["referrer_policy_status"] = "insecure"
            findings.append(
                Finding(
                    check_type="deep_referrer_policy_insecure",
                    name="Insecure Referrer-Policy",
                    status=CheckStatus.WARNING,
                    severity=Severity.MEDIUM,
                    score_impact=-5,
                    title="Insecure Referrer-Policy ('unsafe-url')",
                    summary="Referrer-Policy is configured as 'unsafe-url'. The browser will transmit the full URL (including query parameters and sensitive tokens) to all external sites.",
                    why_it_matters="Transmitting full URLs in Referer headers can leak private user IDs, password reset tokens, and sensitive query strings to external analytics or ad trackers.",
                    how_to_fix="Set Referrer-Policy to `strict-origin-when-cross-origin` or `no-referrer`.",
                    estimated_fix_minutes=5,
                    documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy",
                    evidence=f"Referrer-Policy: {ref_pol}",
                )
            )
        elif any(p in SAFE_REFERRER_POLICIES for p in policies):
            quality_data["referrer_policy_status"] = "safe"
            findings.append(
                Finding(
                    check_type="deep_referrer_policy_safe",
                    name="Safe Referrer-Policy Enforced",
                    status=CheckStatus.PASS,
                    severity=Severity.INFO,
                    score_impact=0,
                    title="Safe Referrer-Policy Enforced",
                    summary=f"Referrer-Policy enforces a privacy-preserving policy ({effective_policy}) that prevents URL leaks to cross-origin destinations.",
                    why_it_matters="Redacting path and query strings across third-party origins protects sensitive navigation context.",
                    how_to_fix="Maintain current Referrer-Policy.",
                    estimated_fix_minutes=0,
                    documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy",
                    evidence=f"Referrer-Policy: {ref_pol}",
                )
            )

    # 2. Permissions-Policy API Restrictions
    perm_pol = norm_headers.get("permissions-policy")
    if perm_pol:
        quality_data["permissions_policy"] = perm_pol
        lower_perm = perm_pol.lower()

        restricted_apis = []
        sensitive_apis = ["camera", "microphone", "geolocation", "payment", "usb", "screen-wake-lock", "interest-cohort"]
        for api in sensitive_apis:
            if f"{api}=()" in lower_perm:
                restricted_apis.append(api)

        quality_data["permissions_policy_apis_restricted"] = restricted_apis

        if restricted_apis:
            findings.append(
                Finding(
                    check_type="deep_permissions_policy_configured",
                    name="Permissions-Policy Restricts Sensitive APIs",
                    status=CheckStatus.PASS,
                    severity=Severity.INFO,
                    score_impact=0,
                    title="Permissions-Policy Restricts Browser Hardware APIs",
                    summary=f"Permissions-Policy explicitly disables unauthorized access to sensitive client features: {', '.join(restricted_apis)}.",
                    why_it_matters="Restricting browser APIs prevents embedded iframes or compromised third-party scripts from activating the microphone, camera, or location.",
                    how_to_fix="Maintain current Permissions-Policy rules.",
                    estimated_fix_minutes=0,
                    documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy",
                    evidence=f"Restricted APIs: {', '.join(restricted_apis)}",
                )
            )

    # 3. Modern Cross-Origin Policies (COOP, CORP, COEP)
    coop = norm_headers.get("cross-origin-opener-policy")
    corp = norm_headers.get("cross-origin-resource-policy")
    coep = norm_headers.get("cross-origin-embedder-policy")

    quality_data["coop"] = coop
    quality_data["corp"] = corp
    quality_data["coep"] = coep

    if coop and "same-origin" in coop.lower():
        findings.append(
            Finding(
                check_type="deep_coop_configured",
                name="Cross-Origin-Opener-Policy Active",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Cross-Origin-Opener-Policy (COOP) Configured",
                summary="COOP isolates your browsing context from cross-origin popups, preventing cross-window DOM manipulation attacks.",
                why_it_matters="COOP protects against Spectre-style side-channel attacks and window reference attacks.",
                how_to_fix="Maintain current COOP header.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy",
                evidence=f"Cross-Origin-Opener-Policy: {coop}",
            )
        )
    elif not coop:
        findings.append(
            Finding(
                check_type="deep_coop_missing",
                name="Cross-Origin-Opener-Policy Missing",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="Cross-Origin-Opener-Policy (COOP) Not Set",
                summary="Cross-Origin-Opener-Policy header is not configured. Consider setting `same-origin` to isolate top-level browsing contexts.",
                why_it_matters="COOP provides enhanced process isolation in modern browsers and protects against cross-origin window manipulation.",
                how_to_fix="Add `Cross-Origin-Opener-Policy: same-origin` to web server configuration.",
                estimated_fix_minutes=10,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy",
                evidence="COOP header not returned by server.",
            )
        )

    if corp:
        findings.append(
            Finding(
                check_type="deep_corp_configured",
                name="Cross-Origin-Resource-Policy Active",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Cross-Origin-Resource-Policy (CORP) Configured",
                summary=f"CORP ({corp}) prevents other origins from embedding your site's resources.",
                why_it_matters="CORP prevents cross-origin data inclusion and side-channel information leakage.",
                how_to_fix="Maintain current CORP header.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Resource-Policy",
                evidence=f"Cross-Origin-Resource-Policy: {corp}",
            )
        )

    if coep:
        findings.append(
            Finding(
                check_type="deep_coep_configured",
                name="Cross-Origin-Embedder-Policy Active",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Cross-Origin-Embedder-Policy (COEP) Active",
                summary=f"COEP ({coep}) ensures that all sub-resources loaded by your application explicitly grant cross-origin read permissions.",
                why_it_matters="COEP is a requirement for activating high-resolution timers and SharedArrayBuffer memory.",
                how_to_fix="Maintain current COEP header.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy",
                evidence=f"Cross-Origin-Embedder-Policy: {coep}",
            )
        )

    # 4. X-Content-Type-Options: nosniff validation
    xcto = norm_headers.get("x-content-type-options")
    quality_data["x_content_type_options"] = xcto
    if xcto and xcto.lower() != "nosniff":
        findings.append(
            Finding(
                check_type="deep_x_content_type_invalid",
                name="Invalid X-Content-Type-Options Value",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-3,
                title="Invalid X-Content-Type-Options Value",
                summary=f"X-Content-Type-Options is set to '{xcto}'. The only valid and recognized directive is 'nosniff'.",
                why_it_matters="Browsers only disable MIME sniffing when the header value is exactly 'nosniff'.",
                how_to_fix="Change header value to `X-Content-Type-Options: nosniff`.",
                estimated_fix_minutes=5,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options",
                evidence=f"Configured: {xcto}",
            )
        )

    return quality_data, findings
