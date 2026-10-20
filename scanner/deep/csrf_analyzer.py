"""
Scanly Scanner Engine - CSRF Protection & Workflow Security Analyzer (Phase F5)
Passively analyzes forms, response headers, meta tags, and SameSite cookie attributes
for Cross-Site Request Forgery (CSRF) defenses.

Strictly passive: Zero CSRF attacks, zero form submissions, zero state-changing requests.
"""
import re
from typing import List, Dict, Any, Tuple, Optional, Set
from scanner.models import Finding, CheckStatus, Severity
from scanner.deep.models import CrawledPage, FormMetadata

CSRF_FIELD_NAMES = {
    "csrf",
    "_csrf",
    "csrf_token",
    "csrftoken",
    "xsrf",
    "_xsrf",
    "xsrf_token",
    "xsrftoken",
    "csrfmiddlewaretoken",
    "authenticity_token",
    "_token",
    "antiforgery",
    "__requestverificationtoken",
}

CSRF_HEADER_NAMES = {
    "x-csrf-token",
    "x-xsrf-token",
    "x-csrftoken",
    "csrf-token",
}

META_CSRF_REGEX = re.compile(r'<meta\s+name=["\'](?:csrf-token|csrf-param|X-CSRF-Token)["\']\s+content=["\']([^"\']+)["\']', re.I)


def evaluate_page_csrf_mechanisms(page: CrawledPage) -> Dict[str, Any]:
    """
    Inspects page headers, body HTML, and meta tags for CSRF protection signals.
    """
    has_meta_token = False
    has_header_token = False

    # 1. Header checks
    for h_name in page.headers:
        if h_name.lower() in CSRF_HEADER_NAMES:
            has_header_token = True
            break

    # 2. Meta tag checks
    if page.body_sample:
        if META_CSRF_REGEX.search(page.body_sample):
            has_meta_token = True

    return {
        "has_meta_token": has_meta_token,
        "has_header_token": has_header_token,
    }


def analyze_csrf_protection(
    crawled_pages: List[CrawledPage],
    session_cookies: List[Dict[str, Any]],
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Audits state-changing POST forms across pages, correlating form inputs with
    anti-CSRF tokens and session cookie SameSite protection.
    """
    evaluated_forms: List[Dict[str, Any]] = []
    findings: List[Finding] = []

    # Check if session cookies enforce SameSite=Lax or Strict
    samesite_secure = any(
        c.get("same_site") in ("Lax", "Strict") for c in session_cookies
    )
    samesite_none_or_missing = any(
        c.get("same_site") in (None, "", "None") for c in session_cookies
    )

    for page in crawled_pages:
        page_csrf_signals = evaluate_page_csrf_mechanisms(page)

        for form in page.forms:
            # We focus on state-changing POST/PUT forms
            if form.method.upper() not in ("POST", "PUT", "PATCH", "DELETE"):
                continue

            # Look for CSRF hidden input field
            has_form_token = False
            token_field_name = None
            for inp in form.inputs:
                inp_name = inp.get("name", "").lower()
                if inp_name in CSRF_FIELD_NAMES or any(k in inp_name for k in ("csrf", "xsrf", "verificationtoken")):
                    has_form_token = True
                    token_field_name = inp.get("name")
                    break

            is_protected = has_form_token or page_csrf_signals["has_meta_token"] or page_csrf_signals["has_header_token"]
            is_sensitive_form = form.has_password or form.has_sensitive_fields or any(
                k in form.resolved_action_url.lower() for k in ("login", "auth", "register", "password", "account", "settings")
            )

            confidence = "HIGH" if (is_sensitive_form and samesite_none_or_missing) else "MEDIUM"

            form_entry = {
                "page_url": page.url,
                "action": form.resolved_action_url,
                "method": form.method.upper(),
                "has_csrf_token": has_form_token,
                "token_field": token_field_name,
                "is_sensitive": is_sensitive_form,
                "is_protected": is_protected,
                "samesite_cookie_defense": samesite_secure,
                "confidence": confidence,
            }
            evaluated_forms.append(form_entry)

            # Potential CSRF finding on sensitive POST forms lacking observable token defense
            if is_sensitive_form and not is_protected:
                if not samesite_secure:
                    findings.append(Finding(
                        check_type="deep_csrf_missing_protection",
                        name="State-Changing Form Lacks Visible CSRF Protection",
                        status=CheckStatus.WARNING,
                        severity=Severity.MEDIUM,
                        score_impact=-5,
                        title=f"Potential CSRF-Sensitive Workflow Without Anti-Forgery Defense",
                        summary=(
                            f"The state-changing form on {page.url} submitting to {form.resolved_action_url} "
                            "does not include an observable CSRF token field, meta tag, or custom header."
                        ),
                        why_it_matters=(
                            "Without anti-CSRF synchronizer tokens or strict SameSite cookie enforcement, "
                            "malicious third-party sites can submit unauthorized requests on behalf of "
                            "authenticated users who visit the attacking site."
                        ),
                        how_to_fix=(
                            "Implement anti-forgery synchronizer tokens (e.g. CSRF middleware or double-submit cookie pattern) "
                            "and ensure session cookies specify `SameSite=Lax` or `SameSite=Strict`."
                        ),
                        estimated_fix_minutes=30,
                        documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html",
                        evidence=f"Form on {page.url} targets {form.resolved_action_url} via POST without CSRF token.",
                    ))

    # If CSRF defenses are observed across forms, emit a pass finding
    protected_count = len([f for f in evaluated_forms if f.get("is_protected") or f.get("has_csrf_token") or f.get("samesite_cookie_defense")])
    if evaluated_forms and protected_count == len(evaluated_forms):
        findings.append(Finding(
            check_type="deep_csrf_cookie_context",
            name="CSRF Defenses Observed on State-Changing Forms",
            status=CheckStatus.PASS,
            severity=Severity.INFO,
            score_impact=0,
            title="Anti-CSRF Controls Active Across Evaluated Forms",
            summary=f"Evaluated {len(evaluated_forms)} state-changing form(s); anti-forgery tokens or SameSite cookie protections were verified.",
            why_it_matters="Adequate CSRF defenses protect user accounts from unauthorized cross-origin state changes.",
            how_to_fix="Maintain anti-CSRF token verification across all authenticated state-changing endpoints.",
            estimated_fix_minutes=0,
            documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html",
            evidence=f"{protected_count} of {len(evaluated_forms)} evaluated forms exhibit active CSRF token or SameSite protection.",
        ))

    unprotected_sensitive = len([
        f for f in evaluated_forms
        if f.get("is_sensitive") and not f.get("is_protected") and not f.get("samesite_cookie_defense")
    ])

    csrf_summary: Dict[str, Any] = {
        "forms_evaluated_count": len(evaluated_forms),
        "evaluated_forms_count": len(evaluated_forms),
        "protected_forms_count": protected_count,
        "unprotected_sensitive_forms_count": unprotected_sensitive,
        "samesite_cookie_defense": samesite_secure,
        "forms": evaluated_forms[:10],
    }

    return csrf_summary, findings
