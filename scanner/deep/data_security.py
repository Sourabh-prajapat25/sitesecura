"""
Scanly Scanner Engine - Phase F7 Master Orchestrator: Advanced Data Security, Privacy & Sensitive Information Exposure
Coordinates PII discovery, financial data, health/location/auth exposure, API minimization,
URL data leaks, form collection, public documents/exports, privacy policies, and tracking/consent.
Guarantees: Strict request budget (max 20 requests), 512 KB response streaming limit,
failure isolation across all sub-analyzers, and zero unmasked sensitive data retained.
"""
import logging
from typing import Dict, List, Optional, Any, Tuple
from urllib.parse import urlparse

from scanner.models import Finding
from scanner.network.http_client import SafeHttpClient
from .config import DeepScanConfig
from .models import CrawledPage

# Sub-analyzers
from .pii_analyzer import analyze_pii
from .financial_analyzer import analyze_financial_data
from .sensitive_data_analyzer import analyze_sensitive_data
from .api_data_analyzer import analyze_api_data_minimization
from .url_data_analyzer import analyze_url_data
from .form_data_analyzer import analyze_form_data
from .document_analyzer import analyze_documents
from .privacy_analyzer import analyze_privacy_policy
from .tracking_consent_analyzer import analyze_tracking_and_consent

logger = logging.getLogger(__name__)


def analyze_data_security(
    crawled_pages: List[CrawledPage],
    client: Optional[SafeHttpClient] = None,
    target_domain: str = "",
    config: Optional[DeepScanConfig] = None,
    frontend_metadata: Optional[Dict[str, Any]] = None,
    appsec_metadata: Optional[Dict[str, Any]] = None,
    identity_metadata: Optional[Dict[str, Any]] = None,
    infra_metadata: Optional[Dict[str, Any]] = None,
    base_url: str = "",
    cfg: Optional[DeepScanConfig] = None,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Executes Phase F7 Data Security, Privacy & Sensitive Information Exposure Intelligence.
    Coordinates all 9 sub-analyzers with failure isolation and strict request budget enforcement.
    """
    active_cfg = cfg or config or DeepScanConfig()
    all_findings: List[Finding] = []

    # Bounded Request Budget Tracking
    max_requests = getattr(active_cfg, "max_f7_requests", 20)
    requests_executed = 0

    def can_request() -> bool:
        return requests_executed < max_requests

    # Establish base_url for probes
    if not base_url:
        if crawled_pages and crawled_pages[0].url:
            parsed_first = urlparse(crawled_pages[0].url)
            base_url = f"{parsed_first.scheme}://{parsed_first.netloc}"
        else:
            base_url = f"https://{target_domain}" if target_domain else ""

    # 1. PII Analyzer (Emails, Phones, Government IDs)
    try:
        pii_data, pii_findings = analyze_pii(
            crawled_pages=crawled_pages,
            max_samples_per_page=5,
        )
        all_findings.extend(pii_findings)
    except Exception as exc:
        logger.warning(f"[F7] PII analyzer failed gracefully: {exc}")
        pii_data = {"error": str(exc)}

    # 2. Financial & Payment Data Analyzer
    try:
        financial_data, fin_findings = analyze_financial_data(
            crawled_pages=crawled_pages,
            max_samples=5,
        )
        all_findings.extend(fin_findings)
    except Exception as exc:
        logger.warning(f"[F7] Financial analyzer failed gracefully: {exc}")
        financial_data = {"error": str(exc)}

    # 3. Sensitive Health, Location & Authentication Data Analyzer
    try:
        sensitive_data, sens_findings = analyze_sensitive_data(
            crawled_pages=crawled_pages,
            f3_metadata=frontend_metadata,
            f5_metadata=identity_metadata,
            max_samples=5,
        )
        all_findings.extend(sens_findings)
    except Exception as exc:
        logger.warning(f"[F7] Sensitive data analyzer failed gracefully: {exc}")
        sensitive_data = {"error": str(exc)}

    # 4. API Data Minimization & Public Response Analyzer
    try:
        api_data, api_findings = analyze_api_data_minimization(
            crawled_pages=crawled_pages,
            appsec_metadata=appsec_metadata,
            max_samples=5,
        )
        all_findings.extend(api_findings)
    except Exception as exc:
        logger.warning(f"[F7] API data analyzer failed gracefully: {exc}")
        api_data = {"error": str(exc)}

    # 5. URL & Query Parameter Data Analyzer
    try:
        url_data, url_findings = analyze_url_data(
            crawled_pages=crawled_pages,
            target_domain=target_domain,
            max_samples=5,
        )
        all_findings.extend(url_findings)
    except Exception as exc:
        logger.warning(f"[F7] URL data analyzer failed gracefully: {exc}")
        url_data = {"error": str(exc)}

    # 6. Form Data Sensitivity Analyzer
    try:
        form_data, form_findings = analyze_form_data(
            crawled_pages=crawled_pages,
            max_samples=5,
        )
        all_findings.extend(form_findings)
    except Exception as exc:
        logger.warning(f"[F7] Form data analyzer failed gracefully: {exc}")
        form_data = {"error": str(exc)}

    # 7. Document & Export Analyzer (Bounded HTTP probes)
    rem_doc = min(getattr(cfg, "max_file_probes_f7", 5), max(0, max_requests - requests_executed))
    try:
        doc_data, doc_findings, doc_reqs = analyze_documents(
            crawled_pages=crawled_pages,
            client=client,
            can_request_fn=can_request,
            max_probes=rem_doc,
            max_doc_bytes=getattr(cfg, "max_document_bytes_f7", 524_288),
        )
        requests_executed += doc_reqs
        all_findings.extend(doc_findings)
    except Exception as exc:
        logger.warning(f"[F7] Document analyzer failed gracefully: {exc}")
        doc_data = {"error": str(exc)}

    # 8. Privacy Policy & Governance Analyzer (Bounded HTTP probes)
    rem_priv = min(getattr(cfg, "max_privacy_documents", 3), max(0, max_requests - requests_executed))
    try:
        privacy_data, priv_findings, priv_reqs = analyze_privacy_policy(
            crawled_pages=crawled_pages,
            client=client,
            base_url=base_url,
            can_request_fn=can_request,
            max_probes=rem_priv,
            max_doc_bytes=getattr(cfg, "max_document_bytes_f7", 524_288),
        )
        requests_executed += priv_reqs
        all_findings.extend(priv_findings)
    except Exception as exc:
        logger.warning(f"[F7] Privacy analyzer failed gracefully: {exc}")
        privacy_data = {"error": str(exc)}

    # 9. Third-Party Tracking & Consent Analyzer
    try:
        tracking_data, track_findings = analyze_tracking_and_consent(
            crawled_pages=crawled_pages,
            frontend_metadata=frontend_metadata,
            max_samples=5,
        )
        all_findings.extend(track_findings)
    except Exception as exc:
        logger.warning(f"[F7] Tracking & consent analyzer failed gracefully: {exc}")
        tracking_data = {"error": str(exc)}

    # Assemble Informational Privacy Posture Matrix
    has_pii = (pii_data.get("personal_emails_count", 0) + pii_data.get("phone_numbers_count", 0) + pii_data.get("government_ids_count", 0)) > 0
    has_financial = (financial_data.get("cards_detected_count", 0) + financial_data.get("ibans_detected_count", 0) > 0) or financial_data.get("cvv_exposed", False)
    has_health = sensitive_data.get("health_data_count", 0) > 0
    has_auth = sensitive_data.get("authentication_data_count", 0) > 0 or url_data.get("secrets_in_urls_count", 0) > 0
    policy_present = privacy_data.get("policy_present", False)
    consent_present = tracking_data.get("consent_banner_detected", False)
    trackers_count = tracking_data.get("trackers_detected_count", 0)

    posture_matrix = {
        "pii_exposure": "Risk" if (pii_data.get("government_ids_count", 0) > 0) else ("Attention" if has_pii else "Not Detected"),
        "financial_exposure": "Risk" if has_financial else "Not Detected",
        "health_exposure": "Risk" if has_health else "Not Detected",
        "auth_exposure": "Risk" if has_auth else "Not Detected",
        "privacy_policy": "Observed" if policy_present else "Attention",
        "consent_mechanism": "Observed" if consent_present else ("Attention" if trackers_count > 0 else "Not Detected"),
        "tracking_activity": "Observed" if trackers_count > 0 else "Not Detected",
        "public_documents": "Observed" if doc_data.get("analyzed_documents_count", 0) > 0 else "Not Detected",
    }

    # Master Data Security Telemetry Output
    data_security_metadata: Dict[str, Any] = {
        "status": "completed",
        "requests_executed": requests_executed,
        "pii": pii_data,
        "financial": financial_data,
        "sensitive_data": sensitive_data,
        "api_minimization": api_data,
        "url_exposure": url_data,
        "forms": form_data,
        "documents": doc_data,
        "privacy": privacy_data,
        "tracking_and_consent": tracking_data,
        "posture_matrix": posture_matrix,
        "summary": {
            "has_pii": has_pii,
            "has_financial_leak": has_financial,
            "has_health_leak": has_health,
            "has_auth_leak": has_auth,
            "privacy_policy_present": policy_present,
            "consent_banner_present": consent_present,
            "active_trackers_count": trackers_count,
            "total_data_findings": len(all_findings),
        }
    }

    return data_security_metadata, all_findings
