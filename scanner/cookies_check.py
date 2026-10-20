"""
Scanly Scanner Engine - Cookie Security Check Module
Inspects Set-Cookie headers and evaluates each cookie individually for Secure, HttpOnly, and SameSite attributes.
"""
import re
from typing import Dict, Any, List, Optional
from .models import Finding, CheckStatus, Severity
from .recommendations import get_recommendation
from .network.models import ParsedCookie

# Attribute names that are not cookie names
COOKIE_ATTR_NAMES = {"expires", "max-age", "path", "domain", "samesite", "secure", "httponly", "comment", "version"}


def split_set_cookie_header(header_val: str) -> List[str]:
    """
    Safely splits a folded Set-Cookie header string into individual cookie strings.
    Does not split on commas contained within standard Expires date stamps
    (e.g., 'Expires=Wed, 21 Oct 2026 07:28:00 GMT').
    """
    if not header_val or not isinstance(header_val, str):
        return []

    # Regex splits on commas that are followed by a valid cookie name=value pair
    # where the name is not one of the known cookie attribute keys.
    pattern = r',(?=\s*[a-zA-Z0-9_!#$%&\'*+\-.^_`|~]+=(?:(?!\b(?:expires|max-age|path|domain|samesite|secure|httponly)\b)[^;])*?;?)'
    parts = re.split(pattern, header_val, flags=re.IGNORECASE)
    return [p.strip() for p in parts if p.strip()]


def parse_cookie_string(cookie_str: str) -> Optional[ParsedCookie]:
    """
    Parses an individual Set-Cookie directive string into a typed ParsedCookie object.
    Extracts name, value, Secure, HttpOnly, SameSite, Domain, Path, Max-Age, and Expires.
    """
    if not cookie_str or not isinstance(cookie_str, str):
        return None

    directives = [d.strip() for d in cookie_str.split(";") if d.strip()]
    if not directives:
        return None

    # First directive must be name=value
    first_part = directives[0]
    if "=" not in first_part:
        # Malformed cookie without name=value
        return None

    cookie_name, cookie_val = first_part.split("=", 1)
    cookie_name = cookie_name.strip()
    cookie_val = cookie_val.strip()

    if not cookie_name:
        return None

    cookie = ParsedCookie(
        name=cookie_name,
        value=cookie_val,
        secure=False,
        httponly=False,
        samesite=None,
        domain=None,
        path=None,
        max_age=None,
        expires=None,
        raw=cookie_str,
    )

    for directive in directives[1:]:
        if "=" in directive:
            attr_name, attr_val = directive.split("=", 1)
            attr_name = attr_name.strip().lower()
            attr_val = attr_val.strip()
        else:
            attr_name = directive.strip().lower()
            attr_val = ""

        if attr_name == "secure":
            cookie.secure = True
        elif attr_name == "httponly":
            cookie.httponly = True
        elif attr_name == "samesite":
            val_lower = attr_val.lower()
            if val_lower == "lax":
                cookie.samesite = "Lax"
            elif val_lower == "strict":
                cookie.samesite = "Strict"
            elif val_lower == "none":
                cookie.samesite = "None"
            else:
                cookie.samesite = attr_val or None
        elif attr_name == "domain":
            cookie.domain = attr_val
        elif attr_name == "path":
            cookie.path = attr_val
        elif attr_name == "max-age":
            try:
                cookie.max_age = int(attr_val)
            except ValueError:
                cookie.max_age = None
        elif attr_name == "expires":
            cookie.expires = attr_val

    return cookie


def check_cookies(
    headers: Dict[str, str],
    raw_cookies: Optional[Dict[str, str]] = None,
    set_cookie_headers: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Analyzes cookies received in HTTP responses individually.
    - Accurately inspects each cookie's Secure, HttpOnly, and SameSite flags.
    - Prevents attribute leakage across distinct cookies.
    - If no cookies are observed, records status as INFO / NOT_APPLICABLE.
    """
    findings: List[Finding] = []
    norm_headers = {k.lower(): v for k, v in headers.items()}
    raw_cookies_dict = raw_cookies or {}

    # Collect individual Set-Cookie strings
    cookie_strings: List[str] = []
    if set_cookie_headers:
        cookie_strings.extend(set_cookie_headers)
    elif "set-cookie" in norm_headers and norm_headers["set-cookie"]:
        raw_val = norm_headers["set-cookie"]
        cookie_strings.extend(split_set_cookie_header(raw_val))

    parsed_cookies: List[ParsedCookie] = []
    for c_str in cookie_strings:
        parsed = parse_cookie_string(c_str)
        if parsed:
            parsed_cookies.append(parsed)

    has_cookies = bool(parsed_cookies or raw_cookies_dict)
    cookie_count = len(parsed_cookies) or len(raw_cookies_dict)

    cookies_data: Dict[str, Any] = {
        "cookies_found": has_cookies,
        "cookie_count": cookie_count,
        "missing_secure": False,
        "missing_httponly": False,
        "missing_samesite": False,
        "cookies": [c.to_dict() for c in parsed_cookies],
    }

    # Case 1: No cookies observed
    if not has_cookies:
        findings.append(
            Finding(
                check_type="cookie_security",
                name="Cookie Security Flags",
                status=CheckStatus.NOT_APPLICABLE,
                severity=Severity.INFO,
                score_impact=0,
                title="No Cookies Set on Apex Request",
                summary="The initial web response did not attach any Set-Cookie headers.",
                why_it_matters="Static sites or token-based applications do not require session cookies.",
                how_to_fix="Ensure any future session cookies set Secure and HttpOnly flags.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies",
                evidence="No Set-Cookie header present.",
            )
        )
        return {"cookies_data": cookies_data, "findings": findings}

    # Case 2: Cookies found but unparsed (e.g. only raw cookie dictionary without Set-Cookie attributes)
    if not parsed_cookies and raw_cookies_dict:
        # Fallback when only name/value pairs are known
        cookies_data["missing_secure"] = True
        cookies_data["missing_httponly"] = True
        cookies_data["missing_samesite"] = True
        rec = get_recommendation("cookies_insecure")
        findings.append(
            Finding(
                check_type="cookie_security",
                name="Insecure Cookie Attributes",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-10,
                title="Cookies Missing Recommended Security Flags",
                summary=f"Detected {len(raw_cookies_dict)} cookie(s) without observable Secure/HttpOnly/SameSite directives.",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=rec["estimated_fix_minutes"],
                documentation_url=rec["documentation_url"],
                evidence=f"Cookies: {', '.join(raw_cookies_dict.keys())}",
            )
        )
        return {"cookies_data": cookies_data, "findings": findings}

    # Case 3: Evaluate individual parsed cookies
    insecure_cookie_summaries: List[str] = []
    any_missing_secure = False
    any_missing_httponly = False
    any_missing_samesite = False

    for c in parsed_cookies:
        cookie_flaws = []
        if not c.secure:
            any_missing_secure = True
            cookie_flaws.append("missing 'Secure'")
        if not c.httponly:
            any_missing_httponly = True
            cookie_flaws.append("missing 'HttpOnly'")
        if not c.samesite:
            any_missing_samesite = True
            cookie_flaws.append("missing 'SameSite'")

        if cookie_flaws:
            insecure_cookie_summaries.append(f"'{c.name}': {', '.join(cookie_flaws)}")

    cookies_data["missing_secure"] = any_missing_secure
    cookies_data["missing_httponly"] = any_missing_httponly
    cookies_data["missing_samesite"] = any_missing_samesite

    # All cookies are secure
    if not any_missing_secure and not any_missing_httponly and not any_missing_samesite:
        rec = get_recommendation("cookies_secure")
        findings.append(
            Finding(
                check_type="cookie_security",
                name="Cookie Security Flags",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Cookies Configured with Secure Attributes",
                summary=f"All {len(parsed_cookies)} cookie(s) contain Secure, HttpOnly, and SameSite flags.",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=0,
                documentation_url=rec["documentation_url"],
                evidence="; ".join(f"{c.name} (Secure, HttpOnly, SameSite={c.samesite})" for c in parsed_cookies),
                technical_details={"cookies": cookies_data["cookies"]},
            )
        )
    else:
        # Deductions aligned with original scoring model
        impact = 0
        overall_issues = []
        if any_missing_secure:
            overall_issues.append("missing 'Secure'")
            impact -= 5
        if any_missing_httponly:
            overall_issues.append("missing 'HttpOnly'")
            impact -= 3
        if any_missing_samesite:
            overall_issues.append("missing 'SameSite'")
            impact -= 2

        rec = get_recommendation("cookies_insecure")
        findings.append(
            Finding(
                check_type="cookie_security",
                name="Insecure Cookie Attributes",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=impact,
                title="Cookies Missing Recommended Security Flags",
                summary=f"Cookies detected with {', '.join(overall_issues)} flags: {'; '.join(insecure_cookie_summaries[:5])}",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=rec["estimated_fix_minutes"],
                documentation_url=rec["documentation_url"],
                evidence="; ".join(insecure_cookie_summaries[:10]),
                technical_details={"cookies": cookies_data["cookies"]},
            )
        )

    return {"cookies_data": cookies_data, "findings": findings}
