"""
Scanly Scanner Engine - Deep Scan Multi-Page Cookie Analysis Module
Aggregates Set-Cookie headers across all discovered pages and evaluates Secure, HttpOnly, and SameSite attributes.
"""
from typing import List, Dict, Any, Set
from scanner.models import Finding, CheckStatus, Severity
from scanner.cookies_check import parse_cookie_string, split_set_cookie_header
from .models import CrawledPage

# Common session or authentication cookie names
SESSION_COOKIE_PATTERNS = {"session", "sess", "token", "auth", "jwt", "sid", "connect.sid", "phpsessid", "jsessionid", "aspsessionid"}


def analyze_multi_page_cookies(crawled_pages: List[CrawledPage]) -> List[Finding]:
    """
    Evaluates all cookies set across all crawled pages.
    """
    findings: List[Finding] = []

    # Map: cookie_name -> {pages: set(), instances: list of ParsedCookie}
    cookies_map: Dict[str, Dict[str, Any]] = {}

    for page in crawled_pages:
        set_cookies = page.set_cookie_headers or []
        for raw_hdr in set_cookies:
            cookie_directives = split_set_cookie_header(raw_hdr)
            for c_str in cookie_directives:
                parsed = parse_cookie_string(c_str)
                if not parsed or not parsed.name:
                    continue

                c_name = parsed.name
                if c_name not in cookies_map:
                    cookies_map[c_name] = {"pages": set(), "instances": []}
                cookies_map[c_name]["pages"].add(page.url)
                cookies_map[c_name]["instances"].append(parsed)

    if not cookies_map:
        findings.append(
            Finding(
                check_type="deep_cookie_none",
                name="Cookie Security Audit",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="No Cookies Set Across Crawled Pages",
                summary="No Set-Cookie response directives were observed during the crawl.",
                why_it_matters="Stateless websites that do not set cookies avoid cookie theft and CSRF vulnerabilities associated with cookie transport.",
                how_to_fix="No action required.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies",
                evidence="Zero cookies observed across crawled pages.",
            )
        )
        return findings

    # Evaluate cookies
    insecure_cookies: List[str] = []
    missing_httponly_session_cookies: List[str] = []
    missing_samesite_cookies: List[str] = []

    for c_name, data in cookies_map.items():
        is_session_like = any(pat in c_name.lower() for pat in SESSION_COOKIE_PATTERNS)
        for inst in data["instances"]:
            # 1. Secure flag
            if not inst.secure:
                if c_name not in insecure_cookies:
                    insecure_cookies.append(c_name)

            # 2. HttpOnly flag on session-like cookies
            if is_session_like and not inst.httponly:
                if c_name not in missing_httponly_session_cookies:
                    missing_httponly_session_cookies.append(c_name)

            # 3. SameSite attribute
            if not inst.samesite or inst.samesite.lower() not in ("lax", "strict"):
                if c_name not in missing_samesite_cookies:
                    missing_samesite_cookies.append(c_name)

    # 1. Insecure Cookies finding
    if insecure_cookies:
        findings.append(
            Finding(
                check_type="deep_cookie_insecure",
                name="Cookies Missing 'Secure' Attribute",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-6,
                title="Cookies Transmitted Without 'Secure' Flag",
                summary=f"Found {len(insecure_cookies)} cookie(s) set without the Secure attribute: {', '.join(insecure_cookies[:5])}.",
                why_it_matters="Cookies without the Secure flag may be transmitted over unencrypted HTTP, exposing sensitive tokens to network sniffing.",
                how_to_fix="Add '; Secure' to all Set-Cookie directives in server responses.",
                estimated_fix_minutes=5,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restrict_access_to_cookies",
                evidence=f"Affected cookies: {', '.join(insecure_cookies)}",
            )
        )

    # 2. HttpOnly on session cookies
    if missing_httponly_session_cookies:
        findings.append(
            Finding(
                check_type="deep_cookie_httponly",
                name="Session Cookies Missing 'HttpOnly' Attribute",
                status=CheckStatus.WARNING,
                severity=Severity.HIGH,
                score_impact=-8,
                title="Session Cookies Accessible via JavaScript",
                summary=f"Session/auth cookie(s) missing HttpOnly: {', '.join(missing_httponly_session_cookies[:5])}.",
                why_it_matters="Without the HttpOnly flag, scripts executing via Cross-Site Scripting (XSS) can steal session tokens via document.cookie.",
                how_to_fix="Set '; HttpOnly' on all authentication and session identifiers.",
                estimated_fix_minutes=5,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restrict_access_to_cookies",
                evidence=f"Affected session cookies: {', '.join(missing_httponly_session_cookies)}",
            )
        )

    # 3. SameSite attribute
    if missing_samesite_cookies:
        findings.append(
            Finding(
                check_type="deep_cookie_samesite",
                name="Cookies Missing SameSite Flag",
                status=CheckStatus.INFO,
                severity=Severity.LOW,
                score_impact=-2,
                title="SameSite Attribute Not Explicitly Declared",
                summary=f"{len(missing_samesite_cookies)} cookie(s) lack an explicit SameSite=Lax or SameSite=Strict policy.",
                why_it_matters="SameSite controls whether cookies are sent on cross-site requests, mitigating Cross-Site Request Forgery (CSRF).",
                how_to_fix="Configure 'SameSite=Lax' (or 'SameSite=Strict') on all Set-Cookie directives.",
                estimated_fix_minutes=5,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite",
                evidence=f"Cookies: {', '.join(missing_samesite_cookies[:6])}",
            )
        )

    # Overall PASS if all cookies are properly secured
    if not insecure_cookies and not missing_httponly_session_cookies:
        findings.append(
            Finding(
                check_type="deep_cookie_secure_pass",
                name="Cookie Hardening",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Cookies Properly Hardened with Security Flags",
                summary=f"All {len(cookies_map)} observed cookies across crawled pages include the Secure attribute.",
                why_it_matters="Hardened cookies prevent credential leakage across unencrypted channels and client scripts.",
                how_to_fix="Maintain current cookie flags.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies",
                evidence=f"Audited {len(cookies_map)} unique cookie name(s).",
            )
        )

    return findings
