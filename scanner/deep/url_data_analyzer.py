"""
Scanly Scanner Engine - Phase F7 URL & Query Parameter Data Exposure Analyzer
Analyzes URLs, query parameters, and external links for PII, secrets, and referrer data leakage.
Guarantees: All sensitive query parameter values are masked before storage or reporting.
"""
from urllib.parse import urlparse, parse_qs
from typing import List, Dict, Any, Tuple, Set, Optional

from scanner.models import Finding, Severity, CheckStatus
from .models import CrawledPage
from .data_classification import (
    DataCategory,
    Confidence,
    classify_field_name,
    mask_email,
    mask_token,
)
from .data_security_finding_helper import make_data_finding

# Target sensitive parameter names
SENSITIVE_QUERY_PARAMS = {
    "email", "user_email", "mail", "phone", "mobile", "ssn", "pan",
    "password", "passwd", "pwd", "token", "auth_token", "reset_token",
    "magic_token", "access_token", "api_key", "secret", "card", "iban"
}


def analyze_url_data(
    crawled_pages: List[CrawledPage],
    target_domain: str = "",
    max_samples: int = 5,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Passively audits all page URLs, discovered links, and redirect targets
    for sensitive parameters and cross-origin referrer leakage risks.
    """
    findings: List[Finding] = []

    pii_in_urls: List[Dict[str, Any]] = []
    secrets_in_urls: List[Dict[str, Any]] = []
    referrer_leak_urls: List[Dict[str, Any]] = []

    seen_pii_urls: Set[str] = set()
    seen_secret_urls: Set[str] = set()

    for page in crawled_pages:
        # Check the page's own URL, its discovered links, and redirect targets
        urls_to_inspect = [page.url]
        if page.final_url and page.final_url != page.url:
            urls_to_inspect.append(page.final_url)
        if hasattr(page, "discovered_links") and page.discovered_links:
            urls_to_inspect.extend(page.discovered_links[:50])

        has_external_links = False
        page_has_sensitive_url = False

        for u in urls_to_inspect:
            try:
                parsed = urlparse(u)
            except Exception:
                continue

            # Check if link points to third-party domain
            if parsed.netloc and target_domain and not parsed.netloc.endswith(target_domain):
                has_external_links = True

            if not parsed.query:
                continue

            query_dict = parse_qs(parsed.query, keep_blank_values=True)
            for param_name, values in query_dict.items():
                p_lower = param_name.lower().strip()
                val = values[0] if values else ""
                if not val:
                    continue

                category, conf = classify_field_name(p_lower)

                if p_lower in ("email", "user_email", "mail") or "@" in val:
                    masked_val = mask_email(val) if "@" in val else mask_token(val)
                    key = f"{parsed.path}:{p_lower}:{masked_val}"
                    if key not in seen_pii_urls:
                        seen_pii_urls.add(key)
                        pii_in_urls.append({
                            "url": f"{parsed.scheme}://{parsed.netloc}{parsed.path}",
                            "parameter": param_name,
                            "masked_value": masked_val,
                            "category": DataCategory.PERSONAL,
                        })
                        page_has_sensitive_url = True

                elif p_lower in ("password", "passwd", "pwd", "token", "reset_token", "secret", "api_key") or category in (DataCategory.AUTHENTICATION, DataCategory.SECRET):
                    masked_val = mask_token(val)
                    key = f"{parsed.path}:{p_lower}:{masked_val}"
                    if key not in seen_secret_urls:
                        seen_secret_urls.add(key)
                        secrets_in_urls.append({
                            "url": f"{parsed.scheme}://{parsed.netloc}{parsed.path}",
                            "parameter": param_name,
                            "masked_value": masked_val,
                            "category": DataCategory.AUTHENTICATION,
                        })
                        page_has_sensitive_url = True

        # Check Referrer Leakage correlation
        if page_has_sensitive_url:
            headers = {k.lower(): v for k, v in page.headers.items()}
            ref_pol = headers.get("referrer-policy", "").lower()
            # If policy allows sending full URL (e.g. unsafe-url, default absent, or external downgrade)
            if "unsafe-url" in ref_pol or not ref_pol or (has_external_links and "no-referrer-when-downgrade" in ref_pol):
                referrer_leak_urls.append({
                    "page_url": page.url,
                    "referrer_policy": ref_pol or "default (not set)",
                })

    url_telemetry = {
        "pii_in_urls_count": len(pii_in_urls),
        "pii_in_urls": pii_in_urls[:max_samples],
        "pii_parameters": pii_in_urls[:max_samples],
        "secrets_in_urls_count": len(secrets_in_urls),
        "secrets_in_urls": secrets_in_urls[:max_samples],
        "secret_parameters": secrets_in_urls[:max_samples],
        "referrer_leak_urls_count": len(referrer_leak_urls),
        "referrer_leakage_risks_count": len(referrer_leak_urls),
        "referrer_leak_urls": referrer_leak_urls[:max_samples],
        "referrer_risks": referrer_leak_urls[:max_samples],
    }

    # Findings Generation
    if secrets_in_urls:
        sample_param = secrets_in_urls[0]["parameter"]
        findings.append(make_data_finding(
            check_type="deep_secret_in_url",
            title=f"Authentication Token or Secret Transmitted in Query Parameter: '{sample_param}'",
            description=(
                f"Sensitive authentication credentials or tokens were observed passed via URL query parameter ('{sample_param}'). "
                "URLs are routinely retained in web server access logs, browser history, and proxy telemetry."
            ),
            severity=Severity.HIGH,
            status=CheckStatus.HIGH,
            evidence=f"Observed in {secrets_in_urls[0]['url']}?{sample_param}={secrets_in_urls[0]['masked_value']}",
            how_to_fix="Transmit tokens and credentials in HTTP request headers (Authorization) or POST body rather than query strings.",
            data_category=DataCategory.AUTHENTICATION,
        ))

    if pii_in_urls:
        sample_pii = pii_in_urls[0]
        findings.append(make_data_finding(
            check_type="deep_pii_in_url",
            title=f"Personally Identifiable Information (PII) Passed in Query String: '{sample_pii['parameter']}'",
            description=(
                f"Personal user contact information (such as email or telephone) is transmitted in URL query parameters ('{sample_pii['parameter']}'). "
                "This exposes user identities to browser logs, proxy caches, and intermediate proxies."
            ),
            severity=Severity.MEDIUM,
            status=CheckStatus.WARNING,
            evidence=f"Observed in {sample_pii['url']}?{sample_pii['parameter']}={sample_pii['masked_value']}",
            how_to_fix="Pass user identifying parameters using request bodies (POST/PUT) or encrypted identifier tokens.",
            data_category=DataCategory.PERSONAL,
        ))

    if referrer_leak_urls and not findings:
        findings.append(make_data_finding(
            check_type="deep_sensitive_referrer_exposure",
            title="Potential Referrer Leakage of Sensitive Query Parameters",
            description=(
                "Pages containing sensitive URL query parameters link out to third-party external origins "
                "without enforcing 'Referrer-Policy: strict-origin-when-cross-origin' or 'no-referrer'."
            ),
            severity=Severity.LOW,
            status=CheckStatus.WARNING,
            evidence=f"Page {referrer_leak_urls[0]['page_url']} contains external links with Referrer-Policy: {referrer_leak_urls[0]['referrer_policy']}",
            how_to_fix="Configure 'Referrer-Policy: strict-origin-when-cross-origin' or 'no-referrer' to strip query strings upon cross-origin navigation.",
            data_category=DataCategory.PERSONAL,
        ))

    return url_telemetry, findings
