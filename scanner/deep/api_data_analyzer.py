"""
Scanly Scanner Engine - Phase F7 API Data Minimization & Public Response Analyzer
Analyzes public JSON responses and API payloads for unnecessary sensitive fields and cache leakage.
Guarantees: Pure passive inspection; zero active parameter tampering or IDOR testing.
"""
import json
from typing import List, Dict, Any, Tuple, Set, Optional

from scanner.models import Finding, Severity, CheckStatus
from .models import CrawledPage
from .data_classification import (
    DataCategory,
    Confidence,
    classify_field_name,
    mask_email,
    mask_phone,
)
from .data_security_finding_helper import make_data_finding

# Fields that represent high-risk data leaks in public responses
HIGH_RISK_RESPONSE_FIELDS = {
    "password_hash", "password", "hash", "salt", "secret", "private_key",
    "ssn", "social_security", "internal_notes", "admin_notes", "salary",
    "compensation", "credit_card", "cvv", "bank_account", "tax_id"
}

# Fields that represent personal data minimization risks on public APIs
PERSONAL_RESPONSE_FIELDS = {
    "email", "phone", "mobile", "address", "dob", "birth_date", "gender",
    "user_id", "customer_id", "last_name", "first_name", "full_name"
}


def _extract_keys_and_values(data: Any, max_depth: int = 5, depth: int = 0) -> List[Tuple[str, Any]]:
    """Recursively traverses JSON dictionaries and lists to extract (key, value) pairs."""
    if depth > max_depth or not data:
        return []

    results: List[Tuple[str, Any]] = []
    if isinstance(data, dict):
        for k, v in data.items():
            results.append((str(k), v))
            if isinstance(v, (dict, list)):
                results.extend(_extract_keys_and_values(v, max_depth, depth + 1))
    elif isinstance(data, list):
        for item in data[:10]:
            if isinstance(item, (dict, list)):
                results.extend(_extract_keys_and_values(item, max_depth, depth + 1))
    return results


def analyze_api_data_minimization(
    crawled_pages: List[CrawledPage],
    appsec_metadata: Optional[Dict[str, Any]] = None,
    max_samples: int = 5,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Passively audits public JSON responses discovered during crawling and Phase F4
    for excessive sensitive fields, data minimization signals, and cache leakage.
    """
    findings: List[Finding] = []

    inspected_endpoints: List[Dict[str, Any]] = []
    cache_leakage_endpoints: List[Dict[str, Any]] = []
    seen_urls: Set[str] = set()

    for page in crawled_pages:
        # Check if response is JSON
        ctype = (page.content_type or "").lower()
        body = (page.body_sample or "").strip()
        is_json = "json" in ctype or (body.startswith("{") and body.endswith("}")) or (body.startswith("[") and body.endswith("]"))
        if not is_json or not body:
            continue

        try:
            parsed_json = json.loads(body)
        except Exception:
            continue

        url = page.url
        if url in seen_urls:
            continue
        seen_urls.add(url)

        key_values = _extract_keys_and_values(parsed_json)
        if not key_values:
            continue

        discovered_high_risk: List[str] = []
        discovered_personal: List[str] = []

        for k, v in key_values:
            k_lower = k.lower().replace("-", "_").strip()
            category, conf = classify_field_name(k_lower)

            if k_lower in HIGH_RISK_RESPONSE_FIELDS or category in (DataCategory.AUTHENTICATION, DataCategory.FINANCIAL, DataCategory.INTERNAL):
                if k not in discovered_high_risk:
                    discovered_high_risk.append(k)
            elif k_lower in PERSONAL_RESPONSE_FIELDS or category in (DataCategory.PERSONAL, DataCategory.SENSITIVE_PERSONAL):
                if k not in discovered_personal:
                    discovered_personal.append(k)

        if discovered_high_risk or discovered_personal:
            endpoint_item = {
                "url": url,
                "high_risk_fields": discovered_high_risk[:10],
                "personal_fields": discovered_personal[:10],
                "fields_count": len(discovered_high_risk) + len(discovered_personal),
            }
            inspected_endpoints.append(endpoint_item)

            # Check Cache-Control correlation
            headers = {k.lower(): v for k, v in page.headers.items()}
            cache_ctrl = headers.get("cache-control", "").lower()
            if cache_ctrl and ("public" in cache_ctrl or "max-age" in cache_ctrl) and "no-store" not in cache_ctrl:
                cache_leakage_endpoints.append({
                    "url": url,
                    "cache_control": cache_ctrl,
                    "sensitive_fields": discovered_high_risk or discovered_personal,
                })

    all_sensitive_fields: List[Dict[str, Any]] = []
    minimization_signals: List[Dict[str, Any]] = []
    for e in inspected_endpoints:
        for f in e.get("high_risk_fields", []):
            all_sensitive_fields.append({
                "url": e["url"],
                "field_name": f,
                "category": "INTERNAL",
                "masked_sample": "***",
            })
        for f in e.get("personal_fields", []):
            all_sensitive_fields.append({
                "url": e["url"],
                "field_name": f,
                "category": "PERSONAL",
                "masked_sample": "***",
            })
        if len(e.get("high_risk_fields", [])) + len(e.get("personal_fields", [])) >= 2:
            minimization_signals.append({
                "url": e["url"],
                "message": f"Endpoint returns multiple sensitive fields ({', '.join(e['high_risk_fields'] + e['personal_fields'])})",
            })

    data_minimization_telemetry = {
        "endpoints_analyzed_count": len(inspected_endpoints),
        "sensitive_fields_observed_count": len(all_sensitive_fields),
        "sensitive_fields": all_sensitive_fields[:max_samples],
        "minimization_signals_count": len(minimization_signals),
        "minimization_signals": minimization_signals[:max_samples],
        "cache_exposure_count": len(cache_leakage_endpoints),
        "cache_exposures": cache_leakage_endpoints[:max_samples],
        "sensitive_endpoints": inspected_endpoints[:max_samples],
        "cached_sensitive_endpoints_count": len(cache_leakage_endpoints),
        "cached_sensitive_endpoints": cache_leakage_endpoints[:max_samples],
    }

    # Findings Generation
    if minimization_signals or len(all_sensitive_fields) >= 2:
        findings.append(make_data_finding(
            check_type="deep_data_minimization",
            title="Public API Exposes Multiple Sensitive User Fields",
            description="API endpoint returns rich objects with personal or sensitive fields that should be minimized.",
            severity=Severity.MEDIUM,
            status=CheckStatus.WARNING,
            evidence=f"Observed on {inspected_endpoints[0]['url']}",
            data_category=DataCategory.PERSONAL,
        ))

    high_risk_endpoints = [e for e in inspected_endpoints if e["high_risk_fields"]]
    if high_risk_endpoints:
        top_fields = high_risk_endpoints[0]["high_risk_fields"]
        findings.append(make_data_finding(
            check_type="deep_public_sensitive_data",
            title="Public API Exposes Internal or Credential Fields",
            description=(
                "An unauthenticated public JSON response was observed disclosing internal, credential, or "
                f"high-risk data fields ({', '.join(top_fields[:5])})."
            ),
            severity=Severity.HIGH,
            status=CheckStatus.HIGH,
            evidence=f"Endpoint: {high_risk_endpoints[0]['url']} exposes fields: {', '.join(top_fields)}",
            how_to_fix="Apply strict backend response serialization models (DTOs) to exclude internal notes, credentials, and administrative fields.",
            data_category=DataCategory.INTERNAL,
        ))

    personal_endpoints = [e for e in inspected_endpoints if e["personal_fields"] and not e["high_risk_fields"]]
    if personal_endpoints:
        top_fields = personal_endpoints[0]["personal_fields"]
        findings.append(make_data_finding(
            check_type="deep_public_pii_response",
            title="Public API Exposes Personal User Attributes (PII)",
            description=(
                "An unauthenticated public JSON endpoint returns personally identifying fields "
                f"({', '.join(top_fields[:5])}) without requiring customer authorization."
            ),
            severity=Severity.MEDIUM,
            status=CheckStatus.WARNING,
            evidence=f"Endpoint: {personal_endpoints[0]['url']} returns PII fields: {', '.join(top_fields)}",
            how_to_fix="Ensure personal contact details and user IDs are only accessible to authenticated owners or authorized roles.",
            data_category=DataCategory.PERSONAL,
        ))

    if cache_leakage_endpoints:
        findings.append(make_data_finding(
            check_type="deep_sensitive_data_cache_exposure",
            title="Sensitive Data Response Permits Public Intermediate Caching",
            description=(
                "A public endpoint returning sensitive personal or internal data specifies a Cache-Control "
                "directive permitting public or shared caching (missing 'no-store' or 'private')."
            ),
            severity=Severity.MEDIUM,
            status=CheckStatus.WARNING,
            evidence=f"Endpoint {cache_leakage_endpoints[0]['url']} returned Cache-Control: '{cache_leakage_endpoints[0]['cache_control']}'",
            how_to_fix="Set 'Cache-Control: no-store, no-cache, private' on all responses containing personal or sensitive information.",
            data_category=DataCategory.CONFIDENTIAL,
        ))

    return data_minimization_telemetry, findings


# Functional alias for orchestrators and tests
analyze_api_data = analyze_api_data_minimization
