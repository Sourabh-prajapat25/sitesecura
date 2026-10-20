"""
Scanly Scanner Engine - Session Security & Token Transport Analyzer (Phase F5)
Provides passive auditing of authentication session cookies, cookie attribute context (HttpOnly, Secure, SameSite),
session identifiers in URL paths/queries, session token exposure, and JWT transport parameters.

Strictly passive: Zero session hijacking, zero session replay, zero live token usage.
Never stores or outputs raw cookie values or sensitive token payloads.
"""
import re
from typing import List, Dict, Any, Tuple, Optional, Set
from urllib.parse import urlparse, parse_qs
from scanner.models import Finding, CheckStatus, Severity
from scanner.deep.models import CrawledPage
from scanner.deep.secrets import mask_secret

AUTH_COOKIE_NAMES = {
    "session",
    "sessionid",
    "session_id",
    "sid",
    "auth",
    "auth_token",
    "authtoken",
    "access_token",
    "accesstoken",
    "refresh_token",
    "refreshtoken",
    "jwt",
    "id_token",
    "connect.sid",
    "laravel_session",
    "jsessionid",
    "asp.net_sessionid",
    "phpsessid",
    "remember_token",
    "token",
}

SESSION_PARAM_NAMES = {"session", "sessionid", "session_id", "sid", "jsessionid"}
TOKEN_PARAM_NAMES = {"token", "auth_token", "access_token", "id_token", "bearer_token"}
DUMMY_VALUES = {"", "null", "none", "undefined", "true", "false", "0", "1", "test", "string"}

JWT_REGEX = re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\b")


def parse_cookie_attributes(cookie_header: str) -> Dict[str, Any]:
    """
    Parses a single Set-Cookie header string into its name and security attributes.
    Never retains the actual cookie value.
    """
    parts = [p.strip() for p in cookie_header.split(";")]
    if not parts:
        return {}

    first_part = parts[0]
    eq_idx = first_part.find("=")
    cookie_name = first_part[:eq_idx].strip() if eq_idx != -1 else first_part.strip()

    attrs: Dict[str, Any] = {
        "name": cookie_name,
        "secure": False,
        "http_only": False,
        "same_site": None,
        "domain": None,
        "path": None,
        "is_persistent": False,
    }

    for p in parts[1:]:
        p_lower = p.lower()
        if p_lower == "secure":
            attrs["secure"] = True
        elif p_lower == "httponly":
            attrs["http_only"] = True
        elif p_lower.startswith("samesite="):
            val = p.split("=", 1)[1].strip()
            attrs["same_site"] = val.capitalize()
        elif p_lower.startswith("domain="):
            attrs["domain"] = p.split("=", 1)[1].strip()
        elif p_lower.startswith("path="):
            attrs["path"] = p.split("=", 1)[1].strip()
        elif p_lower.startswith("expires=") or p_lower.startswith("max-age="):
            attrs["is_persistent"] = True

    attrs["is_secure"] = attrs["secure"]
    attrs["is_http_only"] = attrs["http_only"]

    return attrs


def analyze_session_security(
    crawled_pages: List[CrawledPage],
    target_is_https: bool = True,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Audits observed session cookies for appropriate HttpOnly, Secure, and SameSite attributes
    specifically within an identity/authentication context.
    """
    detected_cookies: List[Dict[str, Any]] = []
    seen_names: Set[str] = set()
    findings: List[Finding] = []

    for page in crawled_pages:
        cookie_headers = list(page.set_cookie_headers or [])
        for k, v in (page.headers or {}).items():
            if k.lower() == "set-cookie" and v not in cookie_headers:
                cookie_headers.append(v)

        for header in cookie_headers:
            attrs = parse_cookie_attributes(header)
            c_name = attrs.get("name", "").lower()
            if not c_name or c_name in seen_names:
                continue

            if c_name in AUTH_COOKIE_NAMES or any(k in c_name for k in ("session", "token", "auth")):
                seen_names.add(c_name)
                attrs["sample_page"] = page.url
                attrs["issues"] = []

                # Contextual audit: Missing HttpOnly on an identified session cookie
                if not attrs.get("http_only"):
                    attrs["issues"].append("missing_httponly")
                    findings.append(Finding(
                        check_type="deep_session_missing_httponly",
                        name="Session Authentication Cookie Lacks HttpOnly Flag",
                        status=CheckStatus.HIGH,
                        severity=Severity.HIGH,
                        score_impact=-4,
                        title=f"Authentication Session Cookie '{attrs['name']}' Missing HttpOnly",
                        summary=(
                            f"The primary session identifier cookie '{attrs['name']}' set on {page.url} "
                            "is accessible via client-side JavaScript."
                        ),
                        why_it_matters=(
                            "Session cookies lacking the HttpOnly directive can be read by malicious scripts "
                            "in the event of a Cross-Site Scripting (XSS) flaw, allowing session hijacking."
                        ),
                        how_to_fix=f"Configure the web application to set the `HttpOnly` flag on the '{attrs['name']}' cookie.",
                        estimated_fix_minutes=15,
                        documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#cookies",
                        evidence=f"Set-Cookie header on {page.url} defines '{attrs['name']}' without HttpOnly.",
                    ))

                # Contextual audit: Missing Secure on HTTPS
                if target_is_https and not attrs.get("secure"):
                    attrs["issues"].append("missing_secure")
                    findings.append(Finding(
                        check_type="deep_session_missing_secure",
                        name="Session Authentication Cookie Lacks Secure Flag",
                        status=CheckStatus.HIGH,
                        severity=Severity.HIGH,
                        score_impact=-4,
                        title=f"Authentication Session Cookie '{attrs['name']}' Missing Secure Directive",
                        summary=f"The session identifier cookie '{attrs['name']}' is transmitted without the Secure directive.",
                        why_it_matters=(
                            "Without the Secure flag, user agents may transmit the session cookie over "
                            "unencrypted HTTP connections if an insecure link or asset is requested."
                        ),
                        how_to_fix=f"Add the `Secure` attribute to the '{attrs['name']}' Set-Cookie header.",
                        estimated_fix_minutes=15,
                        documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#cookies",
                        evidence=f"Set-Cookie header on {page.url} defines '{attrs['name']}' without Secure.",
                    ))

                detected_cookies.append(attrs)

    insecure_count = sum(1 for c in detected_cookies if c.get("issues"))
    missing_httponly = sum(1 for c in detected_cookies if "missing_httponly" in c.get("issues", []))
    missing_secure = sum(1 for c in detected_cookies if "missing_secure" in c.get("issues", []))

    session_summary: Dict[str, Any] = {
        "auth_cookies_count": len(detected_cookies),
        "session_cookies": detected_cookies,
        "cookies": detected_cookies[:10],
        "insecure_session_cookies_count": insecure_count,
        "missing_httponly_count": missing_httponly,
        "missing_secure_count": missing_secure,
    }

    return session_summary, findings


def detect_session_tokens_in_urls(urls: Any) -> Tuple[List[Dict[str, Any]], List[Finding]]:
    """
    Passively scans observed URL paths and query parameters for exposed session IDs,
    access tokens, and JWT strings.
    All token values are cryptographically masked before inclusion in findings.
    """
    session_ids_found: List[Dict[str, Any]] = []
    tokens_found: List[Dict[str, Any]] = []
    jwts_found: List[Dict[str, Any]] = []
    findings: List[Finding] = []
    seen_urls: Set[str] = set()

    clean_urls: List[str] = []
    for item in urls:
        if isinstance(item, str):
            clean_urls.append(item)
        elif hasattr(item, "url") and isinstance(item.url, str):
            clean_urls.append(item.url)

    for url in clean_urls:
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)

        parsed = urlparse(url)

        # 1. Path-based session ID (e.g., ;jsessionid=ABC123)
        if ";jsessionid=" in url.lower():
            match = re.search(r";jsessionid=([A-Za-z0-9_\-\.]+)", url, re.I)
            if match:
                raw_id = match.group(1)
                masked_id = mask_secret(raw_id)
                clean_url = url.replace(raw_id, masked_id)
                session_ids_found.append({
                    "url": clean_url,
                    "type": "JSESSIONID_PATH",
                    "masked_id": masked_id,
                    "masked_token": masked_id,
                })
                findings.append(Finding(
                    check_type="deep_session_url_rewriting",
                    name="Session Identifier Exposed in URL Path (jsessionid)",
                    status=CheckStatus.HIGH,
                    severity=Severity.HIGH,
                    score_impact=-5,
                    title="Session Identifier Exposed in URL Path",
                    summary="Session ID detected in URL path parameter (;jsessionid=...).",
                    why_it_matters=(
                        "URL rewriting for session tracking exposes active session keys in browser history, "
                        "server logs, and external Referer headers, enabling session fixation and hijacking."
                    ),
                    how_to_fix="Disable URL-based session rewriting in your application server (e.g. tracking-mode COOKIE only in web.xml).",
                    estimated_fix_minutes=30,
                    documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#session-id-properties",
                    evidence=f"URL '{clean_url}' exposes session ID '{masked_id}'.",
                ))

        # 2. Query string inspection
        if parsed.query:
            qs = parse_qs(parsed.query, keep_blank_values=False)

            # 2a. Query parameter session IDs
            for p_name, p_vals in qs.items():
                p_lower = p_name.lower()
                if p_lower in SESSION_PARAM_NAMES:
                    for raw_val in p_vals:
                        if len(raw_val) >= 8 and raw_val.lower() not in DUMMY_VALUES:
                            masked_id = mask_secret(raw_val)
                            clean_url = url.replace(raw_val, masked_id)
                            session_ids_found.append({
                                "url": clean_url,
                                "type": "SESSION_QUERY_PARAM",
                                "param": p_name,
                                "masked_id": masked_id,
                                "masked_token": masked_id,
                            })
                            findings.append(Finding(
                                check_type="deep_session_token_in_url",
                                name="Session Identifier in URL Query String",
                                status=CheckStatus.HIGH,
                                severity=Severity.HIGH,
                                score_impact=-5,
                                title=f"Session ID Transmitted in Query Parameter '{p_name}'",
                                summary=f"Active session identifier observed in URL query parameter '{p_name}'.",
                                why_it_matters="Query parameters are logged in web access logs, proxy caches, and transmitted in Referer headers.",
                                how_to_fix="Store session state exclusively in secure HTTP-only cookies or Authorization headers.",
                                estimated_fix_minutes=30,
                                documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html",
                                evidence=f"URL '{clean_url}' discloses query session ID '{masked_id}'.",
                            ))
                            break

                # 2b. Query parameter authentication/access tokens
                elif p_lower in TOKEN_PARAM_NAMES:
                    for raw_val in p_vals:
                        if JWT_REGEX.search(raw_val):
                            continue
                        if len(raw_val) >= 12 and raw_val.lower() not in DUMMY_VALUES:
                            masked_token = mask_secret(raw_val)
                            clean_url = url.replace(raw_val, masked_token)
                            tokens_found.append({
                                "url": clean_url,
                                "type": "SESSION_QUERY_PARAM",
                                "param": p_name,
                                "masked_token": masked_token,
                            })
                            findings.append(Finding(
                                check_type="deep_session_token_in_url",
                                name="Authentication Token Exposed in URL Query Parameter",
                                status=CheckStatus.HIGH,
                                severity=Severity.HIGH,
                                score_impact=-8,
                                title=f"Access Token in URL Parameter '{p_name}'",
                                summary=f"Authentication bearer/access token transmitted in URL parameter '{p_name}'.",
                                why_it_matters=(
                                    "Sensitive access tokens in URLs leak through browser history, referrer logs, "
                                    "and CDN analytics, potentially granting full access to user accounts."
                                ),
                                how_to_fix="Transmit tokens via the Authorization request header (`Authorization: Bearer <token>`).",
                                estimated_fix_minutes=30,
                                documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html",
                                evidence=f"URL '{clean_url}' exposes token '{masked_token}'.",
                            ))
                            break

            # 2c. JWT in URL string
            jwt_match = JWT_REGEX.search(parsed.query)
            if jwt_match:
                raw_jwt = jwt_match.group(0)
                masked_jwt = mask_secret(raw_jwt)
                clean_url = url.replace(raw_jwt, masked_jwt)
                jwts_found.append({
                    "url": clean_url,
                    "type": "JWT_IN_URL",
                    "masked_jwt": masked_jwt,
                    "masked_token": masked_jwt,
                })
                findings.append(Finding(
                    check_type="deep_session_jwt_in_url",
                    name="JSON Web Token (JWT) Observed in URL",
                    status=CheckStatus.HIGH,
                    severity=Severity.HIGH,
                    score_impact=-8,
                    title="JSON Web Token (JWT) Transmitted in URL",
                    summary="Full JSON Web Token structure observed in URL query string.",
                    why_it_matters=(
                        "JWT tokens contain identity claims, signature data, and user scopes. Transporting "
                        "JWTs in URLs exposes them to third-party referrers, proxy caches, and browser telemetry."
                    ),
                    how_to_fix="Send JWTs in the HTTP `Authorization: Bearer <token>` header or within an HttpOnly, SameSite cookie.",
                    estimated_fix_minutes=30,
                    documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html",
                    evidence=f"URL '{clean_url}' contains JWT token '{masked_jwt}'.",
                ))

    all_leaks = session_ids_found + tokens_found + jwts_found
    return all_leaks, findings
