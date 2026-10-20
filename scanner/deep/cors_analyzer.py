"""
Scanly Scanner Engine - CORS Security Analyzer (Phase F4)
Evaluates Cross-Origin Resource Sharing (CORS) configurations:
wildcard origins, reflected origins, credentials exposure, missing Vary headers,
overbroad methods/headers, and sensitive endpoint exposure.
Enforces strictly safe, non-sensitive synthetic origin testing.
"""
from typing import Dict, List, Optional, Any, Tuple
from urllib.parse import urlparse

from scanner.models import Finding, CheckStatus, Severity
from scanner.network.http_client import SafeHttpClient

SYNTHETIC_TEST_ORIGIN = "https://scanly-cors-test.invalid"

SENSITIVE_PATH_KEYWORDS = [
    "/auth",
    "/admin",
    "/user",
    "/me",
    "/account",
    "/profile",
    "/session",
    "/login",
    "/token",
    "/payment",
    "/checkout",
    "/billing",
]


def is_sensitive_endpoint(url: str) -> bool:
    """Returns True if the URL path contains sensitive keywords."""
    path = urlparse(url).path.lower()
    return any(kw in path for kw in SENSITIVE_PATH_KEYWORDS)


def evaluate_cors_configuration(
    headers: Dict[str, str],
    url: str,
    origin_tested: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Evaluates CORS response headers against security best practices:
    - Access-Control-Allow-Origin
    - Access-Control-Allow-Credentials
    - Access-Control-Allow-Methods
    - Access-Control-Allow-Headers
    - Access-Control-Expose-Headers
    - Vary: Origin
    """
    # Case-insensitive header dictionary lookup
    lower_headers = {k.lower(): v for k, v in headers.items()}
    
    allow_origin = lower_headers.get("access-control-allow-origin")
    allow_credentials = lower_headers.get("access-control-allow-credentials", "").lower() == "true"
    allow_methods_raw = lower_headers.get("access-control-allow-methods", "")
    allow_headers_raw = lower_headers.get("access-control-allow-headers", "")
    expose_headers_raw = lower_headers.get("access-control-expose-headers", "")
    vary_header = lower_headers.get("vary", "").lower()

    if not allow_origin:
        return {
            "has_cors": False,
            "url": url,
            "allow_origin": None,
            "allow_credentials": False,
            "allow_methods": [],
            "allow_headers": [],
            "vary_origin": False,
            "issues": [],
        }

    allow_methods = [m.strip().upper() for m in allow_methods_raw.split(",") if m.strip()]
    allow_headers = [h.strip() for h in allow_headers_raw.split(",") if h.strip()]
    has_vary_origin = "origin" in [v.strip() for v in vary_header.split(",")]

    issues: List[str] = []
    is_wildcard = allow_origin.strip() == "*"
    is_reflected = bool(origin_tested and allow_origin.strip().lower() == origin_tested.lower())

    if is_wildcard and allow_credentials:
        issues.append("credentials_wildcard")
    elif is_reflected and allow_credentials:
        issues.append("credentials_reflected")
    elif is_reflected:
        issues.append("reflected_origin")
    elif is_wildcard:
        issues.append("wildcard_origin")

    if allow_origin != "*" and not has_vary_origin:
        issues.append("missing_vary_origin")

    # Overbroad methods check (e.g. TRACE or wildcard *)
    if "*" in allow_methods or "TRACE" in allow_methods:
        issues.append("overbroad_methods")

    # Overbroad headers check
    if "*" in allow_headers:
        issues.append("overbroad_headers")

    # Sensitive endpoint exposure
    if is_sensitive_endpoint(url) and (is_wildcard or is_reflected or allow_credentials):
        issues.append("sensitive_endpoint_cors")

    return {
        "has_cors": True,
        "url": url,
        "allow_origin": allow_origin,
        "allow_credentials": allow_credentials,
        "allow_methods": allow_methods,
        "allow_headers": allow_headers,
        "expose_headers": [h.strip() for h in expose_headers_raw.split(",") if h.strip()],
        "vary_origin": has_vary_origin,
        "is_wildcard": is_wildcard,
        "is_reflected": is_reflected,
        "is_sensitive": is_sensitive_endpoint(url),
        "issues": issues,
    }


def probe_cors_reflection_safe(
    url: str,
    client: SafeHttpClient,
    timeout_redirects: int = 2,
) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    Safely probes an endpoint with a synthetic, non-sensitive origin:
    'https://scanly-cors-test.invalid'.
    Does NOT use attacker domains, does NOT attempt credential theft,
    and adheres strictly to SafeHttpClient timeouts and SSRF validation.
    """
    headers = {
        "Origin": SYNTHETIC_TEST_ORIGIN,
        "Access-Control-Request-Method": "GET",
    }
    try:
        resp = client.options(
            url=url,
            headers=headers,
            max_redirects=timeout_redirects,
        )
        if resp.status_code is None or resp.error:
            # Fallback to GET if OPTIONS is not handled
            resp = client.get(
                url=url,
                headers={"Origin": SYNTHETIC_TEST_ORIGIN},
                max_redirects=timeout_redirects,
            )
        
        if resp.headers:
            evaluation = evaluate_cors_configuration(
                headers=resp.headers,
                url=url,
                origin_tested=SYNTHETIC_TEST_ORIGIN,
            )
            return evaluation, None
        return evaluate_cors_configuration({}, url), None
    except Exception as exc:
        return evaluate_cors_configuration({}, url), str(exc)


def build_cors_findings(evaluations: List[Dict[str, Any]]) -> List[Finding]:
    """
    Aggregates CORS evaluations and generates canonical SiteSecura findings.
    Enforces anti-double-counting and distinct severity assignments.
    """
    findings: List[Finding] = []
    seen_issues: Dict[str, List[str]] = {}

    for ev in evaluations:
        if not ev.get("has_cors"):
            continue
        u = ev.get("url", "")
        for iss in ev.get("issues", []):
            seen_issues.setdefault(iss, []).append(u)

    # 1. Credentials with Wildcard or Arbitrary Reflected Origin (HIGH/CRITICAL)
    if "credentials_wildcard" in seen_issues or "credentials_reflected" in seen_issues:
        affected = seen_issues.get("credentials_wildcard", []) + seen_issues.get("credentials_reflected", [])
        evidence_text = f"Endpoint(s) allow credentialed cross-origin requests with arbitrary origin: {', '.join(affected[:3])}"
        findings.append(
            Finding(
                check_type="deep_cors",
                name="Insecure CORS Credentials with Arbitrary Origin",
                status=CheckStatus.HIGH,
                severity=Severity.HIGH,
                score_impact=-15,
                title="Insecure CORS Credentials with Arbitrary Origin Allowed",
                summary="The application permits cross-origin requests with credentials (cookies/auth) from arbitrary origins.",
                why_it_matters="When Access-Control-Allow-Credentials is true and the origin is dynamically reflected or wildcarded, any external site can read sensitive private user data on behalf of an authenticated user.",
                how_to_fix="Maintain a strict explicit whitelist of trusted origins. Never dynamically reflect arbitrary Origin headers when credentials are supported.",
                estimated_fix_minutes=30,
                documentation_url="https://scanly.io/docs/cors-credentials-security",
                evidence=evidence_text,
            )
        )

    # 2. Reflected Origin without credentials (MEDIUM)
    elif "reflected_origin" in seen_issues:
        affected = seen_issues["reflected_origin"]
        findings.append(
            Finding(
                check_type="deep_cors",
                name="Permissive CORS Origin Reflection",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-8,
                title="CORS Origin Dynamically Reflected without Credentials",
                summary=f"The application dynamically reflects unvalidated Origin headers on {len(affected)} endpoint(s).",
                why_it_matters="Permissive origin reflection allows third-party websites to access application responses. While credentials may not be accepted, unauthenticated responses may expose internal data.",
                how_to_fix="Validate requested Origin against an explicit list of approved client domains instead of reflecting untrusted values.",
                estimated_fix_minutes=20,
                documentation_url="https://scanly.io/docs/cors-origin-reflection",
                evidence=f"Reflected synthetic origin on: {', '.join(affected[:3])}",
            )
        )

    # 3. Wildcard Origin on Sensitive Endpoints (MEDIUM)
    if "sensitive_endpoint_cors" in seen_issues:
        affected = seen_issues["sensitive_endpoint_cors"]
        findings.append(
            Finding(
                check_type="deep_cors",
                name="Permissive CORS on Sensitive Endpoint",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-10,
                title="Permissive CORS Configured on Sensitive API Endpoint",
                summary=f"Authentication, account, or administrative endpoints permit cross-origin access: {', '.join(affected[:3])}",
                why_it_matters="Sensitive endpoints handling user data or session state should restrict cross-origin access strictly to designated first-party origins.",
                how_to_fix="Remove CORS headers or restrict Access-Control-Allow-Origin to trusted application domains for sensitive endpoints.",
                estimated_fix_minutes=20,
                documentation_url="https://scanly.io/docs/cors-sensitive-endpoints",
                evidence=f"Sensitive endpoints with broad CORS: {', '.join(affected[:3])}",
            )
        )

    # 4. General Wildcard Origin (INFO / LOW)
    elif "wildcard_origin" in seen_issues and "sensitive_endpoint_cors" not in seen_issues:
        affected = seen_issues["wildcard_origin"]
        findings.append(
            Finding(
                check_type="deep_cors",
                name="Public CORS Wildcard Configured",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="Public Cross-Origin Access (Access-Control-Allow-Origin: *)",
                summary=f"Endpoint(s) allow universal cross-origin read access: {', '.join(affected[:3])}",
                why_it_matters="A wildcard origin is acceptable for public static assets and documentation, but should not be used on private API routes.",
                how_to_fix="Verify whether public cross-origin access is intended for these endpoints.",
                estimated_fix_minutes=10,
                documentation_url="https://scanly.io/docs/cors-wildcard",
                evidence=f"Wildcard CORS on: {', '.join(affected[:3])}",
            )
        )

    # 5. Missing Vary: Origin Header (LOW)
    if "missing_vary_origin" in seen_issues and "credentials_wildcard" not in seen_issues:
        affected = seen_issues["missing_vary_origin"]
        findings.append(
            Finding(
                check_type="deep_cors",
                name="Missing Vary: Origin Header on CORS Response",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-4,
                title="CORS Response Missing Vary: Origin Header",
                summary=f"CORS responses on {len(affected)} endpoint(s) do not specify 'Vary: Origin'.",
                why_it_matters="Intermediate caches (CDNs, reverse proxies) may serve a cached response generated for one origin to a different origin, causing CORS failures or cache leakage.",
                how_to_fix="Ensure the server includes 'Vary: Origin' whenever Access-Control-Allow-Origin is conditionally set.",
                estimated_fix_minutes=15,
                documentation_url="https://scanly.io/docs/cors-vary-origin",
                evidence=f"Missing Vary: Origin on: {', '.join(affected[:3])}",
            )
        )

    # 6. Overbroad Methods (LOW)
    if "overbroad_methods" in seen_issues:
        affected = seen_issues["overbroad_methods"]
        findings.append(
            Finding(
                check_type="deep_cors",
                name="Overbroad CORS Methods Permitted",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-3,
                title="Overbroad or Dangerous HTTP Methods Allowed via CORS",
                summary="The CORS policy advertises wildcard or dangerous HTTP methods (such as TRACE).",
                why_it_matters="Exposing unnecessary methods via CORS increases the attack surface for cross-origin abuse.",
                how_to_fix="Explicitly declare only the HTTP methods strictly required by the client application (e.g. GET, POST).",
                estimated_fix_minutes=15,
                documentation_url="https://scanly.io/docs/cors-methods",
                evidence=f"Affected: {', '.join(affected[:3])}",
            )
        )

    # 7. Overbroad Headers (INFO)
    if "overbroad_headers" in seen_issues:
        affected = seen_issues["overbroad_headers"]
        findings.append(
            Finding(
                check_type="deep_cors",
                name="Overbroad CORS Allowed Headers",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="Wildcard Access-Control-Allow-Headers Observed",
                summary="CORS configuration advertises wildcard header acceptance (Access-Control-Allow-Headers: *).",
                why_it_matters="Accepting arbitrary headers can complicate CSRF defense mechanisms relying on custom header presence.",
                how_to_fix="List specific authorized request headers (e.g. Content-Type, Authorization).",
                estimated_fix_minutes=10,
                documentation_url="https://scanly.io/docs/cors-headers",
                evidence=f"Affected: {', '.join(affected[:3])}",
            )
        )

    # Pass check if no issues
    if not findings and evaluations and any(ev.get("has_cors") for ev in evaluations):
        findings.append(
            Finding(
                check_type="deep_cors",
                name="CORS Policy Configured Safely",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="CORS Configuration Passes Security Baseline",
                summary="Observed CORS headers use safe origins, avoid credential wildcards, and maintain proper cache isolation.",
                why_it_matters="Properly configured CORS headers isolate user sessions while facilitating authorized client interactions.",
                how_to_fix="Continue maintaining explicit origin whitelists.",
                estimated_fix_minutes=0,
                documentation_url="https://scanly.io/docs/cors-best-practices",
                evidence="CORS headers checked against security baseline.",
            )
        )

    return findings


# Backward-compatible alias
test_cors_reflection_safe = probe_cors_reflection_safe
