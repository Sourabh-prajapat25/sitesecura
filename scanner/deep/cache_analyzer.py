"""
Scanly Scanner Engine - Cache Security Analyzer (Phase F4)
Evaluates HTTP response caching behavior (Cache-Control, Pragma, Expires, Vary).
Detects public/shared caching on sensitive, authenticated, or user-specific endpoints.
Strictly passive; does NOT attempt cache poisoning or cache-busting attacks.
"""
from typing import Dict, List, Optional, Any, Set
from urllib.parse import urlparse

from scanner.models import Finding, CheckStatus, Severity

SENSITIVE_USER_ENDPOINTS = [
    "/api/me",
    "/api/user",
    "/api/users",
    "/api/profile",
    "/api/account",
    "/api/session",
    "/api/dashboard",
    "/api/billing",
    "/api/settings",
    "/auth/session",
    "/auth/me",
]


def is_user_sensitive_path(url: str) -> bool:
    """Returns True if the URL path typically serves user-specific or authenticated data."""
    path = urlparse(url).path.lower()
    return any(p in path for p in SENSITIVE_USER_ENDPOINTS)


def evaluate_cache_security(
    url: str,
    headers: Dict[str, str],
    status_code: Optional[int] = None,
    cookies_present: bool = False,
) -> Dict[str, Any]:
    """
    Evaluates response caching directives for a single endpoint.
    """
    lower = {k.lower(): v for k, v in headers.items()}
    cc_header = lower.get("cache-control", "").lower()
    pragma = lower.get("pragma", "").lower()
    expires = lower.get("expires")
    vary = lower.get("vary", "").lower()
    etag = lower.get("etag")
    age = lower.get("age")

    cc_directives = [d.strip() for d in cc_header.split(",") if d.strip()]
    is_public = "public" in cc_directives
    is_private = "private" in cc_directives
    is_no_store = "no-store" in cc_directives
    is_no_cache = "no-cache" in cc_directives
    has_max_age = any(d.startswith("max-age=") for d in cc_directives)
    
    is_sensitive = is_user_sensitive_path(url)
    
    issues: List[str] = []
    
    # Sensitive response cacheable: marked public, or has positive max-age without no-store/private
    if is_sensitive:
        if is_public:
            issues.append("sensitive_public_cache")
        elif not is_no_store and not is_private and has_max_age:
            issues.append("sensitive_cacheable_shared")

    # Authenticated cookie response marked public
    if cookies_present and is_public:
        issues.append("authenticated_response_public_cache")

    return {
        "url": url,
        "status_code": status_code,
        "is_sensitive": is_sensitive,
        "cache_control": cc_header or None,
        "is_public": is_public,
        "is_private": is_private,
        "is_no_store": is_no_store,
        "is_no_cache": is_no_cache,
        "vary": vary or None,
        "pragma": pragma or None,
        "expires": expires,
        "etag": bool(etag),
        "issues": issues,
    }


def build_cache_findings(evaluations: List[Dict[str, Any]]) -> List[Finding]:
    """
    Compiles canonical findings from cache evaluations.
    """
    findings: List[Finding] = []
    
    sensitive_cached = [
        ev for ev in evaluations
        if "sensitive_public_cache" in ev.get("issues", []) or "sensitive_cacheable_shared" in ev.get("issues", [])
    ]
    auth_public_cached = [
        ev for ev in evaluations
        if "authenticated_response_public_cache" in ev.get("issues", [])
    ]

    # 1. Sensitive Response Cacheable (MEDIUM)
    if sensitive_cached:
        sample = sensitive_cached[0]
        affected_urls = [ev["url"] for ev in sensitive_cached]
        evidence_text = f"Endpoint '{sample['url']}' returned Cache-Control: '{sample['cache_control']}' on user-specific path."
        findings.append(
            Finding(
                check_type="deep_cache",
                name="Sensitive User Data Response Cacheable",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-10,
                title="Sensitive User-Specific Response Marked Cacheable",
                summary=f"Endpoint(s) handling account or session data ({', '.join(affected_urls[:2])}) permit shared or public caching.",
                why_it_matters="If user-specific responses are cached by shared intermediate proxies or CDNs, private account data may be served to other unauthorized visitors.",
                how_to_fix="Add 'Cache-Control: no-store, no-cache, private' to all API and dashboard endpoints that return user-specific data.",
                estimated_fix_minutes=15,
                documentation_url="https://scanly.io/docs/api-response-caching",
                evidence=evidence_text,
            )
        )

    # 2. Authenticated Cookie with Public Cache (MEDIUM)
    elif auth_public_cached:
        sample = auth_public_cached[0]
        evidence_text = f"Endpoint '{sample['url']}' set session/auth cookies while specifying 'Cache-Control: public'."
        findings.append(
            Finding(
                check_type="deep_cache",
                name="Authenticated Response Set Public Cache",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-8,
                title="Authenticated Response Configured with Public Cache-Control",
                summary=f"The server set cookies while declaring 'Cache-Control: public' on {sample['url']}.",
                why_it_matters="CDNs and shared caches may store responses containing personalized session state when marked with public cache directives.",
                how_to_fix="Ensure endpoints that issue Set-Cookie headers use 'Cache-Control: no-store, private'.",
                estimated_fix_minutes=15,
                documentation_url="https://scanly.io/docs/api-response-caching",
                evidence=evidence_text,
            )
        )

    # Clean cache baseline check
    if not findings and evaluations:
        findings.append(
            Finding(
                check_type="deep_cache",
                name="Cache Control Security Baseline Verified",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Cache Headers Configured Appropriately",
                summary="Sensitive endpoints do not permit insecure shared caching.",
                why_it_matters="Appropriate cache control prevents session bleed and data leakage across shared web proxies.",
                how_to_fix="Maintain private no-store directives on sensitive API paths.",
                estimated_fix_minutes=0,
                documentation_url="https://scanly.io/docs/api-response-caching",
                evidence="Evaluated responses maintained secure cache boundaries.",
            )
        )

    return findings
