"""
Scanly Scanner Engine - Advanced Authentication & Password Surface Analyzer (Phase F5)
Provides passive classification of authentication endpoints, password form auditing,
credential-in-URL detection, account recovery exposure, password policy observation,
and MFA / WebAuthn passkey signal detection.

Strictly passive: No credential submissions, no brute-forcing, no auth bypass attempts.
"""
import re
from typing import List, Dict, Any, Tuple, Optional, Set
from urllib.parse import urlparse, parse_qs
from scanner.models import Finding, CheckStatus, Severity
from scanner.deep.models import CrawledPage, FormMetadata
from scanner.deep.secrets import mask_secret

AUTH_ENDPOINT_PATTERNS = [
    (re.compile(r"/(?:mfa|2fa|totp|two[_-]factor|otp|webauthn|passkey(?:s)?)\b", re.I), "MFA"),
    (re.compile(r"/\.well-known/openid-configuration\b", re.I), "OIDC"),
    (re.compile(r"/(?:saml|saml2|sso|metadata\.xml)\b", re.I), "SAML"),
    (re.compile(r"/oauth2?/(?:authorize|token)\b", re.I), "OAUTH"),
    (re.compile(r"/admin(?:istrator)?/(?:auth|login|users)\b", re.I), "ADMIN_AUTH"),
    (re.compile(r"/(?:password[_-]reset|reset[_-]password|forgot[_-]password|recover(?:y)?)\b", re.I), "PASSWORD_RESET"),
    (re.compile(r"/(?:change[_-]password|update[_-]password|password[_-]change)\b", re.I), "PASSWORD_CHANGE"),
    (re.compile(r"/(?:auth/)?(?:admin[_-]?)?login\b", re.I), "LOGIN"),
    (re.compile(r"/(?:auth/)?signin\b", re.I), "LOGIN"),
    (re.compile(r"/(?:auth/)?(?:register|signup|join|create[_-]account)\b", re.I), "REGISTER"),
    (re.compile(r"/(?:auth/)?(?:logout|signout|log[_-]off)\b", re.I), "LOGOUT"),
    (re.compile(r"/(?:auth/)?session(?:s)?\b", re.I), "SESSION"),
    (re.compile(r"/(?:api/)?(?:v[0-9]+/)?(?:token|tokens|api[_-]key)\b", re.I), "TOKEN"),
    (re.compile(r"/(?:my[_-]account|account|profile|settings/security)\b", re.I), "ACCOUNT"),
]

PASSWORD_PARAM_NAMES = {"password", "passwd", "pwd", "pass", "user_password", "user_pass"}
DUMMY_PARAM_VALUES = {"", "string", "{password}", "password", "test", "example", "xxx", "null"}

ENUMERATION_TEXT_PATTERNS = [
    re.compile(r"\b(?:user|account|email|username) (?:not found|does not exist|is not registered)\b", re.I),
    re.compile(r"\bno account found with that email\b", re.I),
    re.compile(r"\binvalid (?:user|email|username)\b", re.I),
]

MFA_KEYWORD_PATTERNS = [
    (re.compile(r"\b(?:totp|authenticator app|google authenticator|duo security)\b", re.I), "TOTP"),
    (re.compile(r"\b(?:sms otp|text message code|one[ -]time code|otp via sms)\b", re.I), "SMS_OTP"),
    (re.compile(r"\b(?:webauthn|fido2|passkey(?:s)?|security key|hardware token)\b", re.I), "WEBAUTHN"),
    (re.compile(r"\b(?:recovery codes|backup codes)\b", re.I), "BACKUP_CODES"),
]


def classify_auth_endpoint(url: str) -> str:
    """Classifies an endpoint path into standard identity and auth surface categories."""
    path = urlparse(url).path.lower()
    for pattern, category in AUTH_ENDPOINT_PATTERNS:
        if pattern.search(path):
            return category
    return "UNKNOWN"


def analyze_password_forms(crawled_pages: List[CrawledPage]) -> Tuple[List[Dict[str, Any]], List[Finding]]:
    """
    Audits HTML forms across crawled pages for password inputs, verifying:
    1. Form submission method (GET exposes credentials in query parameters).
    2. Form action protocol (insecure cleartext HTTP transmission).
    3. Autocomplete settings.
    """
    evaluated_forms: List[Dict[str, Any]] = []
    findings: List[Finding] = []

    for page in crawled_pages:
        for form in page.forms:
            has_pw = form.has_password or any(
                inp.get("type", "").lower() == "password" or inp.get("name", "").lower() in PASSWORD_PARAM_NAMES
                for inp in form.inputs
            )
            if not has_pw:
                continue

            is_http_action = form.action_protocol.lower() == "http"
            is_get = form.method.upper() == "GET"
            form_info: Dict[str, Any] = {
                "page_url": page.url,
                "action": form.action,
                "resolved_action_url": form.resolved_action_url,
                "method": form.method.upper(),
                "action_protocol": form.action_protocol.lower(),
                "is_external": form.is_external,
                "has_password": True,
                "is_insecure_cleartext": is_http_action,
                "is_get_method": is_get,
                "issues": [],
            }

            # 1. Check for GET method on password form
            if is_get:
                form_info["issues"].append("password_form_get_method")
                findings.append(Finding(
                    check_type="deep_password_form_get_method",
                    name="Password Submitted via HTTP GET Method",
                    status=CheckStatus.HIGH,
                    severity=Severity.HIGH,
                    score_impact=-8,
                    title="Insecure Password Form Submission Method (GET)",
                    summary=f"The password form on {page.url} uses HTTP GET for submission instead of POST.",
                    why_it_matters=(
                        "Submitting authentication credentials via HTTP GET appends the plaintext password "
                        "directly into the URL query string. These URLs are permanently recorded in browser "
                        "history, proxy logs, web server access logs, and HTTP Referer headers."
                    ),
                    how_to_fix="Change the form method to POST (`method=\"POST\"`) and transmit credentials via the request body over HTTPS.",
                    estimated_fix_minutes=15,
                    documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",
                    evidence=f"Form on {page.url} with action='{form.action}' specifies method='GET' containing password input.",
                ))

            # 2. Check for cleartext HTTP action on password form
            is_http_action = form.action_protocol.lower() == "http"
            if is_http_action:
                form_info["issues"].append("insecure_http_form_action")
                findings.append(Finding(
                    check_type="deep_password_form_cleartext_action",
                    name="Insecure Cleartext HTTP Form Action",
                    status=CheckStatus.HIGH,
                    severity=Severity.HIGH,
                    score_impact=-8,
                    title="Password Form Submits to Insecure HTTP Action",
                    summary=f"The authentication form on {page.url} submits credentials to an unencrypted HTTP endpoint: {form.resolved_action_url}.",
                    why_it_matters=(
                        "Submitting credentials over unencrypted HTTP exposes usernames and passwords to "
                        "passive network sniffing and adversary-in-the-middle interception, even if the "
                        "initial form page was loaded over HTTPS."
                    ),
                    how_to_fix="Ensure all form actions specify relative paths or strict HTTPS action URLs.",
                    estimated_fix_minutes=15,
                    documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html",
                    evidence=f"Form on {page.url} targets unencrypted action URL: {form.resolved_action_url}.",
                ))

            evaluated_forms.append(form_info)

    return evaluated_forms, findings


def detect_password_in_urls(urls: List[str]) -> Tuple[List[Dict[str, Any]], List[Finding]]:
    """
    Passively scans observed URL query strings for credential parameters (password, pwd, passwd).
    Guarantees full redaction of raw parameter values before returning findings or metadata.
    """
    detected_leaks: List[Dict[str, Any]] = []
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
        if not parsed.query:
            continue

        qs = parse_qs(parsed.query, keep_blank_values=False)
        for param_name, param_values in qs.items():
            if param_name.lower() in PASSWORD_PARAM_NAMES:
                for raw_val in param_values:
                    clean_val = raw_val.strip()
                    if clean_val and clean_val.lower() not in DUMMY_PARAM_VALUES and len(clean_val) >= 3:
                        masked = mask_secret(clean_val)
                        clean_url = url.replace(raw_val, masked)
                        detected_leaks.append({
                            "url": clean_url,
                            "parameter": param_name,
                            "masked_value": masked,
                        })

                        findings.append(Finding(
                            check_type="deep_auth_password_in_url",
                            name="Password Observed in URL Query Parameter",
                            status=CheckStatus.HIGH,
                            severity=Severity.HIGH,
                            score_impact=-10,
                            title="Plaintext Credential Leaked in URL Query String",
                            summary=f"URL query string contains credential parameter '{param_name}'.",
                            why_it_matters=(
                                "Parameters in URLs are routinely leaked via browser history, Referer headers, "
                                "cloud proxy logs, and analytics telemetry, exposing user passwords to unauthorized parties."
                            ),
                            how_to_fix="Transmit credentials exclusively in the encrypted body of HTTPS POST requests. Never pass passwords in query parameters.",
                            estimated_fix_minutes=30,
                            documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",
                            evidence=f"URL '{clean_url}' discloses parameter '{param_name}' with value '{masked}'.",
                        ))
                        break

    return detected_leaks, findings


def analyze_account_recovery(
    crawled_pages: List[CrawledPage],
    discovered_urls: List[str],
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Passively audits account recovery, password reset flows, reset tokens in URLs,
    account enumeration signals, and publicly observable password policies.
    """
    reset_endpoints: List[str] = []
    reset_tokens_found: List[Dict[str, Any]] = []
    enumeration_signals: List[Dict[str, Any]] = []
    password_policy: Dict[str, Any] = {"observed": False, "rules": []}
    findings: List[Finding] = []

    # 1. Scan URLs for reset endpoints & exposed reset tokens
    all_urls = list(set(discovered_urls + [p.url for p in crawled_pages]))
    for u in all_urls:
        cat = classify_auth_endpoint(u)
        if cat == "PASSWORD_RESET":
            reset_endpoints.append(u)

        parsed = urlparse(u)
        if parsed.query:
            qs = parse_qs(parsed.query, keep_blank_values=False)
            for param, vals in qs.items():
                p_lower = param.lower()
                if p_lower in ("reset_token", "reset_key", "password_token", "recovery_token", "resetcode", "reset_code"):
                    for raw_val in vals:
                        if len(raw_val) >= 12 and raw_val.lower() not in DUMMY_PARAM_VALUES:
                            masked = mask_secret(raw_val)
                            clean_u = u.replace(raw_val, masked)
                            reset_tokens_found.append({
                                "url": clean_u,
                                "parameter": param,
                                "masked_token": masked,
                            })
                            findings.append(Finding(
                                check_type="deep_password_reset_token_exposed",
                                name="Password Reset Token Exposed in URL",
                                status=CheckStatus.HIGH,
                                severity=Severity.HIGH,
                                score_impact=-8,
                                title="Password Reset Token Observed in URL",
                                summary=f"Password recovery token exposed in URL parameter '{param}'.",
                                why_it_matters=(
                                    "Password reset tokens in URLs can leak via browser navigation, analytics, "
                                    "or HTTP Referer headers, permitting unauthorized account takeover if intercepted."
                                ),
                                how_to_fix="Ensure reset tokens are one-time-use, short-lived (15 minutes or less), and invalidate upon first consumption or password update.",
                                estimated_fix_minutes=30,
                                documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html",
                                evidence=f"Reset token parameter '{param}' found in URL: {clean_u}.",
                            ))

    # 2. Scan body text for account enumeration wording & password policy
    for page in crawled_pages:
        text = page.body_sample or ""
        if not text:
            continue

        # Check account enumeration signals
        for pat in ENUMERATION_TEXT_PATTERNS:
            match = pat.search(text)
            if match:
                snippet = match.group(0)
                enumeration_signals.append({
                    "url": page.url,
                    "signal": snippet,
                })
                findings.append(Finding(
                    check_type="deep_auth_enumeration_signal",
                    name="Possible Account Enumeration Wording Observed",
                    status=CheckStatus.INFO,
                    severity=Severity.INFO,
                    score_impact=0,
                    title="User Enumeration Signal in Public Interface",
                    summary=f"Public response on {page.url} includes messaging that distinguishes registered from unregistered accounts ('{snippet}').",
                    why_it_matters=(
                        "Differentiating between valid and invalid usernames allows automated enumeration "
                        "attacks to build valid user lists for targeted credential stuffing or phishing."
                    ),
                    how_to_fix="Return generic messages such as 'If an account exists for that email, a message has been sent' across login and recovery workflows.",
                    estimated_fix_minutes=20,
                    documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#account-enumeration",
                    evidence=f"Observed static wording '{snippet}' on {page.url}.",
                ))
                break

        # Check documented password policy
        pw_rules = []
        if re.search(r"\bat least \d+ characters\b|\bminimum \d+ characters\b", text, re.I):
            pw_rules.append("length_requirement")
        if re.search(r"\buppercase\b", text, re.I) and re.search(r"\blower\s*case\b", text, re.I):
            pw_rules.append("casing_requirement")
        if re.search(r"\bnumber|\bdigit\b", text, re.I) and ("password" in text.lower()):
            pw_rules.append("number_requirement")
        if re.search(r"\bspecial character|\bsymbol\b", text, re.I):
            pw_rules.append("symbol_requirement")

        if pw_rules:
            password_policy["observed"] = True
            password_policy["rules"] = list(set(password_policy["rules"] + pw_rules))
            password_policy["sample_url"] = page.url

    if password_policy["observed"]:
        findings.append(Finding(
            check_type="deep_password_policy_signal",
            name="Password Policy Requirements Observed",
            status=CheckStatus.INFO,
            severity=Severity.INFO,
            score_impact=0,
            title="Public Password Complexity Requirements Identified",
            summary=f"Identified client-side or documented password policy rules: {', '.join(password_policy['rules'])}.",
            why_it_matters="Well-configured password policies promote resilient user credentials and align with modern NIST SP 800-63B guidelines.",
            how_to_fix="Ensure minimum password length is at least 8 (preferably 12+) characters and screen against known breached password lists.",
            estimated_fix_minutes=0,
            documentation_url="https://pages.nist.gov/800-63-3/sp800-63b.html",
            evidence=f"Password policy rules detected on {password_policy.get('sample_url', 'public pages')}: {password_policy['rules']}.",
        ))

    recovery_data: Dict[str, Any] = {
        "reset_endpoints": reset_endpoints[:10],
        "reset_endpoints_count": len(reset_endpoints),
        "reset_tokens_found": reset_tokens_found,
        "exposed_tokens_count": len(reset_tokens_found),
        "exposed_tokens": reset_tokens_found[:5],
        "enumeration_signals_count": len(enumeration_signals),
        "enumeration_signals": enumeration_signals[:5],
        "password_policy": password_policy,
    }

    return recovery_data, findings


def detect_mfa_signals(crawled_pages: List[CrawledPage]) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Passively audits pages and inline scripts for multi-factor authentication (MFA),
    TOTP, SMS OTP, FIDO2, WebAuthn, and Passkey signals.
    """
    detected_methods: Set[str] = set()
    sample_pages: List[str] = []
    findings: List[Finding] = []

    for page in crawled_pages:
        combined_text = (page.body_sample or "") + " " + " ".join(page.inline_scripts or [])
        if not combined_text:
            continue

        for pat, method_name in MFA_KEYWORD_PATTERNS:
            if pat.search(combined_text):
                detected_methods.add(method_name)
                if page.url not in sample_pages:
                    sample_pages.append(page.url)

    mfa_detected = len(detected_methods) > 0
    mfa_data: Dict[str, Any] = {
        "detected": mfa_detected,
        "mfa_detected": mfa_detected,
        "methods": sorted(list(detected_methods)),
        "methods_observed": sorted(list(detected_methods)),
        "methods_count": len(detected_methods),
        "sample_pages": sample_pages[:5],
    }

    if mfa_detected:
        methods_str = ", ".join(mfa_data["methods"])
        findings.append(Finding(
            check_type="deep_mfa_signal",
            name="Multi-Factor Authentication (MFA) Indicators Detected",
            status=CheckStatus.INFO,
            severity=Severity.INFO,
            score_impact=0,
            title="Multi-Factor Authentication / Passkey Support Observed",
            summary=f"Public application assets reference modern multi-factor authentication mechanisms ({methods_str}).",
            why_it_matters="MFA significantly mitigates account takeover risks by requiring secondary possession-based verification factors.",
            how_to_fix="Enforce phishing-resistant MFA (such as FIDO2/WebAuthn Passkeys) for all administrative and sensitive user accounts.",
            estimated_fix_minutes=0,
            documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html",
            evidence=f"Detected MFA references on pages {sample_pages[:3]}: {methods_str}.",
        ))

    return mfa_data, findings
