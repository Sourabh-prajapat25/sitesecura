"""
Scanly Scanner Engine - Phase F8 Finding Normalization & Canonical Classification
Normalizes heterogeneous findings from Phases F1–F7 into standardized SecurityEvidence
with source phase attribution, canonical concept mapping, and deduplication.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Set, Tuple
from urllib.parse import urlparse
import re

from scanner.models import Finding, Severity, CheckStatus


@dataclass
class SecurityEvidence:
    """Normalized security evidence item extracted from scan findings and metadata."""
    finding_id: str
    check_type: str
    title: str
    severity: str
    status: str
    confidence: str
    category: str
    source_phase: str
    canonical_category: str
    url: Optional[str] = None
    asset: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "finding_id": self.finding_id,
            "check_type": self.check_type,
            "title": self.title,
            "severity": self.severity,
            "status": self.status,
            "confidence": self.confidence,
            "category": self.category,
            "source_phase": self.source_phase,
            "canonical_category": self.canonical_category,
            "url": self.url,
            "asset": self.asset,
            "metadata": self.metadata,
        }


# Canonical categories connecting disparate check types
CANONICAL_CATEGORY_MAP: Dict[str, str] = {
    # Internal topology & origin
    "deep_js_internal_url": "INTERNAL_TOPOLOGY_EXPOSURE",
    "deep_environment_internal_ip": "INTERNAL_TOPOLOGY_EXPOSURE",
    "deep_origin_exposure": "ORIGIN_EXPOSURE",
    "deep_cdn_origin_inconsistency": "ORIGIN_EXPOSURE",
    "deep_ipv6_origin_exposure": "ORIGIN_EXPOSURE",
    "deep_direct_ip_exposure": "ORIGIN_EXPOSURE",

    # Personal data & privacy
    "deep_public_pii": "PERSONAL_DATA_EXPOSURE",
    "deep_public_pii_response": "PERSONAL_DATA_EXPOSURE",
    "deep_pii_in_url": "PERSONAL_DATA_EXPOSURE",
    "deep_public_government_id": "PERSONAL_DATA_EXPOSURE",
    "deep_sensitive_parameter": "PERSONAL_DATA_EXPOSURE",
    "deep_sensitive_referrer": "PERSONAL_DATA_EXPOSURE",

    # Financial & card data
    "deep_public_payment_data": "FINANCIAL_DATA_EXPOSURE",
    "deep_public_financial_data": "FINANCIAL_DATA_EXPOSURE",
    "deep_financial_data": "FINANCIAL_DATA_EXPOSURE",

    # Authentication & Session
    "deep_public_auth_data": "AUTHENTICATION_SURFACE",
    "deep_auth_endpoint": "AUTHENTICATION_SURFACE",
    "deep_auth_login": "AUTHENTICATION_SURFACE",
    "deep_auth_password_reset": "AUTHENTICATION_SURFACE",
    "deep_weak_session_cookie": "AUTHENTICATION_SURFACE",
    "deep_missing_httponly_session": "AUTHENTICATION_SURFACE",
    "deep_csrf_sensitive_form": "AUTHENTICATION_SURFACE",
    "deep_secret_in_url": "AUTHENTICATION_SURFACE",

    # Administrative surfaces
    "deep_admin_endpoint": "ADMIN_SURFACE",
    "deep_unprotected_admin": "ADMIN_SURFACE",
    "deep_management_surface": "ADMIN_SURFACE",
    "deep_actuator_endpoint": "ADMIN_SURFACE",

    # Public API & Schema
    "deep_api_endpoint": "API_SURFACE",
    "deep_openapi_spec": "API_SURFACE",
    "deep_swagger_ui": "API_SURFACE",
    "deep_graphql_introspection": "API_SURFACE",
    "deep_data_minimization": "API_SURFACE",
    "deep_cache_sensitive": "API_SURFACE",

    # Cloud & Storage
    "deep_public_storage_bucket": "CLOUD_STORAGE_EXPOSURE",
    "deep_s3_bucket_exposure": "CLOUD_STORAGE_EXPOSURE",
    "deep_gcs_bucket_exposure": "CLOUD_STORAGE_EXPOSURE",
    "deep_azure_blob_exposure": "CLOUD_STORAGE_EXPOSURE",

    # Development & Debug Artifacts
    "deep_source_map_detected": "DEVELOPMENT_ARTIFACT",
    "deep_js_source_map": "DEVELOPMENT_ARTIFACT",
    "deep_git_exposure": "DEVELOPMENT_ARTIFACT",
    "deep_debug_page": "DEVELOPMENT_ARTIFACT",
    "deep_env_file_exposure": "DEVELOPMENT_ARTIFACT",
    "deep_stack_trace_disclosure": "DEVELOPMENT_ARTIFACT",
    "deep_dockerfile_exposure": "DEVELOPMENT_ARTIFACT",
    "deep_backup_file": "DEVELOPMENT_ARTIFACT",

    # Documents & Data dumps
    "deep_public_database_data": "DOCUMENT_EXPOSURE",
    "deep_public_data_export": "DOCUMENT_EXPOSURE",
    "deep_public_log_data": "DOCUMENT_EXPOSURE",
    "deep_document_internal_metadata": "DOCUMENT_EXPOSURE",

    # Tracking & Consent
    "deep_session_recording_detected": "TRACKING_SURFACE",
    "deep_advertising_tracking_detected": "TRACKING_SURFACE",
    "deep_tracker_before_consent": "TRACKING_SURFACE",
    "deep_privacy_policy_missing": "TRACKING_SURFACE",
    "deep_privacy_policy_signal": "TRACKING_SURFACE",

    # Transport & TLS
    "deep_tls_certificate_expired": "TRANSPORT_SECURITY",
    "deep_tls_weak_cipher": "TRANSPORT_SECURITY",
    "deep_tls_deprecated_protocol": "TRANSPORT_SECURITY",
    "deep_hsts_missing": "TRANSPORT_SECURITY",
    "deep_hsts_short_max_age": "TRANSPORT_SECURITY",

    # Security Headers
    "deep_csp_missing": "SECURITY_HEADERS",
    "deep_csp_unsafe_eval": "SECURITY_HEADERS",
    "deep_cors_wildcard_credentials": "SECURITY_HEADERS",
    "deep_x_frame_options_missing": "SECURITY_HEADERS",
}


def determine_source_phase(check_type: str, technical_details: Optional[Dict[str, Any]] = None) -> str:
    """Determines originating phase (F1 through F7) deterministically from check_type."""
    ct = (check_type or "").lower()
    details = technical_details or {}
    explicit_phase = details.get("phase") or details.get("source_phase")
    if explicit_phase in ("F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8"):
        return str(explicit_phase)

    # Phase F8
    if ct.startswith("deep_risk_chain"):
        return "F8"

    # Phase F7
    if any(k in ct for k in (
        "deep_data", "deep_pii", "deep_privacy", "deep_financial", "deep_health",
        "deep_location", "deep_payment", "deep_document", "deep_export",
        "deep_database", "deep_log_data", "deep_log_credential", "deep_tracking",
        "deep_consent", "deep_retention", "deep_deletion", "deep_access_request",
        "deep_gdpr", "deep_ccpa", "deep_session_recording", "deep_advertising_tracking",
        "deep_data_minimization", "deep_sensitive_parameter", "deep_sensitive_referrer",
        "deep_sensitive_data", "deep_public_auth_data", "deep_public_pii",
        "deep_public_government_id", "deep_public_financial", "deep_public_health",
        "deep_public_location", "deep_public_payment", "deep_public_data_export",
        "deep_public_database", "deep_tracker_before_consent"
    )):
        return "F7"

    # Phase F6
    if any(k in ct for k in (
        "deep_infra", "deep_cdn", "deep_origin", "deep_ipv6", "deep_cloud",
        "deep_storage", "deep_git", "deep_deployment", "deep_backup", "deep_dev",
        "deep_staging", "deep_internal", "deep_localhost", "deep_docker",
        "deep_kubernetes", "deep_serverless", "deep_management", "deep_monitoring",
        "deep_metrics", "deep_debug", "deep_actuator", "deep_takeover", "deep_logging",
        "deep_tracing"
    )):
        return "F6"

    # Phase F5
    if any(k in ct for k in (
        "deep_auth", "deep_oauth", "deep_oidc", "deep_saml", "deep_mfa",
        "deep_business", "deep_password", "deep_session", "deep_csrf"
    )):
        return "F5"

    # Phase F4
    if any(k in ct for k in (
        "deep_api", "deep_graphql", "deep_cors", "deep_cache", "deep_error",
        "deep_http", "deep_directory"
    )):
        return "F4"

    # Phase F3
    if any(k in ct for k in ("deep_js", "deep_source_map", "deep_resource")):
        return "F3"

    # Phase F2
    if any(k in ct for k in (
        "deep_tls", "deep_ssl", "deep_cert", "deep_dns", "deep_caa", "deep_dnssec",
        "deep_spf", "deep_dmarc", "deep_dkim", "deep_email", "deep_hsts", "deep_csp",
        "deep_coop", "deep_corp", "deep_coep", "deep_sec_header", "deep_permissions",
        "deep_x_frame", "deep_x_content", "deep_referrer"
    )):
        return "F2"

    # Phase F1 Fallback (crawler, robots, sitemap, mixed content, cookies, forms)
    return "F1"


def determine_canonical_category(check_type: str) -> str:
    """Maps check_type to high-level canonical concept for cross-phase correlation."""
    ct = (check_type or "").lower()
    for prefix, canonical in CANONICAL_CATEGORY_MAP.items():
        if ct.startswith(prefix) or prefix in ct:
            return canonical
    return "GENERAL_OBSERVATION"


def extract_asset_and_url(f: Finding) -> Tuple[Optional[str], Optional[str]]:
    """Extracts normalized asset and clean URL from finding evidence and technical details."""
    details = f.technical_details or {}
    url = details.get("url") or details.get("page_url") or details.get("endpoint")
    evidence = f.evidence or ""

    # Check evidence for URL if not in technical details
    if not url and ("http://" in evidence or "https://" in evidence):
        match = re.search(r"https?://[^\s,'\"<>)]+", evidence)
        if match:
            url = match.group(0).rstrip(".")

    asset = None
    if url:
        try:
            parsed = urlparse(url)
            path = parsed.path or "/"
            if path != "/":
                asset = path
            else:
                asset = parsed.netloc
        except Exception:
            asset = url
    elif details.get("parameter"):
        asset = f"param:{details['parameter']}"
    elif details.get("cookie"):
        asset = f"cookie:{details['cookie']}"
    elif details.get("provider"):
        asset = f"provider:{details['provider']}"
    elif details.get("header"):
        asset = f"header:{details['header']}"

    return asset, url


def normalize_findings(
    findings: List[Finding],
    scan_metadata: Optional[Dict[str, Any]] = None,
    max_findings: int = 500,
) -> List[SecurityEvidence]:
    """
    Transforms findings into normalized SecurityEvidence items with deduplication
    and source phase identification.
    """
    evidence_list: List[SecurityEvidence] = []
    seen_signatures: Set[str] = set()

    for idx, f in enumerate(findings[:max_findings]):
        ct = f.check_type or f"check_{idx}"
        phase = determine_source_phase(ct, f.technical_details)
        canonical = determine_canonical_category(ct)
        asset, url = extract_asset_and_url(f)

        sev_str = f.severity.value if hasattr(f.severity, "value") else str(f.severity).lower()
        status_str = f.status.value if hasattr(f.status, "value") else str(f.status).lower()

        conf_str = "HIGH"
        if getattr(f, "confidence", 1.0) < 0.6:
            conf_str = "LOW"
        elif getattr(f, "confidence", 1.0) < 0.85:
            conf_str = "MEDIUM"

        cat = f.technical_details.get("category", "") if f.technical_details else ""
        if not cat:
            cat = canonical.replace("_", " ").title()

        finding_id = f"ev_{phase}_{idx}_{ct}"

        # Deduplication signature based on canonical category + target asset
        sig = f"{canonical}:{asset or url or 'root'}:{ct}"
        if sig in seen_signatures:
            continue
        seen_signatures.add(sig)

        evidence = SecurityEvidence(
            finding_id=finding_id,
            check_type=ct,
            title=f.title or ct,
            severity=sev_str,
            status=status_str,
            confidence=conf_str,
            category=cat,
            source_phase=phase,
            canonical_category=canonical,
            url=url,
            asset=asset,
            metadata={
                "score_impact": f.score_impact,
                "evidence_snippet": (f.evidence[:160] + "...") if f.evidence and len(f.evidence) > 160 else f.evidence,
                "technical_details": {k: v for k, v in (f.technical_details or {}).items() if k not in ("raw_content", "body")},
            }
        )
        evidence_list.append(evidence)

    # Deterministic sort
    evidence_list.sort(key=lambda e: (e.source_phase, e.canonical_category, e.check_type))
    return evidence_list
