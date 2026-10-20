"""
Scanly Scanner Engine - Phase F7 Privacy Policy & Regulatory Signals Analyzer
Discovers privacy policy pages and analyzes text for GDPR, CCPA, retention, and deletion disclosures.
Guarantees: Strict observational signals; zero legal compliance certification or legal conclusions.
"""
import re
from typing import List, Dict, Any, Tuple, Optional, Set
from urllib.parse import urljoin, urlparse

from scanner.models import Finding, Severity, CheckStatus
from .models import CrawledPage
from .data_classification import DataCategory
from .data_security_finding_helper import make_data_finding
from scanner.network.http_client import SafeHttpClient

# Candidate Privacy Policy URLs
PRIVACY_PATH_CANDIDATES = [
    "/privacy",
    "/privacy-policy",
    "/legal/privacy",
]

# Privacy Framework Keywords
GDPR_KEYWORDS = [
    "gdpr", "general data protection regulation", "data protection officer",
    "data controller", "data processor", "right to access", "right to erasure",
    "right to rectification", "data portability", "lawful basis",
]

CCPA_KEYWORDS = [
    "ccpa", "cpra", "california consumer privacy", "do not sell", "do not share",
    "california privacy rights", "opt-out of the sale",
]

RETENTION_KEYWORDS = [
    "retention period", "we retain", "data retention", "storage duration",
    "how long we keep", "kept for as long as", "retained for",
]

DELETION_KEYWORDS = [
    "delete your account", "request deletion", "right to delete", "erasure of your",
    "remove your personal information", "account deletion", "data erasure",
]

ACCESS_REQUEST_KEYWORDS = [
    "subject access request", "request a copy", "access your data",
    "data access request", "exercise your rights", "contact our privacy team",
]


def _analyze_privacy_text(text: str) -> Dict[str, Any]:
    """Analyzes text content for privacy governance keywords."""
    lower_text = text.lower()

    gdpr_signals = [k for k in GDPR_KEYWORDS if k in lower_text]
    ccpa_signals = [k for k in CCPA_KEYWORDS if k in lower_text]
    retention_signals = [k for k in RETENTION_KEYWORDS if k in lower_text]
    deletion_signals = [k for k in DELETION_KEYWORDS if k in lower_text]
    access_signals = [k for k in ACCESS_REQUEST_KEYWORDS if k in lower_text]
    dpo_signals = [k for k in ("dpo", "data protection officer", "privacy officer", "dpo@", "privacy@") if k in lower_text]
    dpo_contact_match = re.search(r"\b[A-Za-z0-9._%+-]*(?:dpo|privacy)[A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", text, re.IGNORECASE)
    dpo_contact = dpo_contact_match.group(0) if dpo_contact_match else (dpo_signals[0] if dpo_signals else None)

    return {
        "has_gdpr_signals": len(gdpr_signals) > 0,
        "gdpr_signals": gdpr_signals,
        "has_ccpa_signals": len(ccpa_signals) > 0,
        "ccpa_signals": ccpa_signals,
        "has_retention_signals": len(retention_signals) > 0,
        "retention_signals": retention_signals,
        "has_deletion_signals": len(deletion_signals) > 0,
        "deletion_signals": deletion_signals,
        "has_access_signals": len(access_signals) > 0,
        "access_signals": access_signals,
        "has_dpo_signals": len(dpo_signals) > 0,
        "dpo_signals": dpo_signals,
        "dpo_contact": dpo_contact,
    }


def analyze_privacy_policy(
    crawled_pages: List[CrawledPage],
    client: Optional[SafeHttpClient] = None,
    base_url: str = "",
    can_request_fn: Optional[Any] = None,
    max_probes: int = 3,
    max_doc_bytes: int = 524_288,
) -> Tuple[Dict[str, Any], List[Finding], int]:
    """
    Passively discovers privacy policy pages and audits disclosures for
    data subject rights, retention language, deletion procedures, and regulatory signals.
    """
    findings: List[Finding] = []
    requests_executed = 0

    policy_page_url: Optional[str] = None
    policy_content: str = ""

    # 1. Search existing crawled pages for privacy URL
    for page in crawled_pages:
        path = urlparse(page.url).path.lower()
        if any(p in path for p in ("/privacy", "/privacy-policy", "/privacy_policy", "/legal/privacy")):
            policy_page_url = page.url
            policy_content = page.body_sample or ""
            break

    # 2. Check candidate privacy paths if not in crawl (bounded)
    if not policy_page_url and client and base_url:
        probes_done = 0
        for cand_path in PRIVACY_PATH_CANDIDATES:
            if probes_done >= max_probes:
                break
            if can_request_fn and not can_request_fn():
                break

            probes_done += 1
            requests_executed += 1
            cand_url = urljoin(base_url, cand_path)

            try:
                resp = client.get(cand_url, max_redirects=2, max_response_bytes=max_doc_bytes)
                if resp and resp.status_code == 200 and resp.text:
                    if any(k in resp.text.lower() for k in ("privacy", "personal data", "information we collect")):
                        policy_page_url = cand_url
                        policy_content = resp.text
                        break
            except Exception:
                pass

    policy_present = bool(policy_page_url)
    signals = _analyze_privacy_text(policy_content) if policy_present else {
        "has_gdpr_signals": False,
        "gdpr_signals": [],
        "has_ccpa_signals": False,
        "ccpa_signals": [],
        "has_retention_signals": False,
        "retention_signals": [],
        "has_deletion_signals": False,
        "deletion_signals": [],
        "has_access_signals": False,
        "access_signals": [],
        "has_dpo_signals": False,
        "dpo_signals": [],
        "dpo_contact": None,
    }

    disclosures_found: List[str] = []
    if signals.get("has_gdpr_signals"):
        disclosures_found.append("GDPR Rights")
    if signals.get("has_ccpa_signals"):
        disclosures_found.append("CCPA/CPRA Disclosures")
    if signals.get("has_retention_signals"):
        disclosures_found.append("Data Retention Terms")
    if signals.get("has_deletion_signals"):
        disclosures_found.append("Data Deletion Procedures")
    if signals.get("has_access_signals"):
        disclosures_found.append("Subject Access Request Channels")
    if signals.get("has_dpo_signals"):
        disclosures_found.append("DPO Contact Disclosed")

    privacy_data = {
        "policy_present": policy_present,
        "policy_url": policy_page_url,
        "gdpr_rights_mentioned": signals.get("has_gdpr_signals", False),
        "ccpa_mentioned": signals.get("has_ccpa_signals", False),
        "retention_period_disclosed": signals.get("has_retention_signals", False),
        "data_deletion_disclosed": signals.get("has_deletion_signals", False),
        "access_request_disclosed": signals.get("has_access_signals", False),
        "dpo_or_contact_email_present": signals.get("has_dpo_signals", False),
        "dpo_contact": signals.get("dpo_contact"),
        "disclosures_found": disclosures_found,
        **signals,
    }

    # Findings Generation
    if not policy_present:
        findings.append(make_data_finding(
            check_type="deep_privacy_policy_missing",
            title="No Discoverable Privacy Policy Page Identified",
            description=(
                "No publicly discoverable privacy policy was identified within the analyzed website surface. "
                "Websites that process user interactions, forms, or telemetry generally require a clear, public privacy notice."
            ),
            severity=Severity.LOW,
            status=CheckStatus.WARNING,
            evidence="Checked crawl navigation links and common privacy endpoints (/privacy, /privacy-policy, /legal/privacy).",
            how_to_fix="Publish a clear, easily accessible Privacy Policy outlining data collection categories, purposes, and user rights.",
            data_category=DataCategory.PUBLIC,
        ))
    else:
        detected_aspects: List[str] = []
        if signals["has_gdpr_signals"]:
            detected_aspects.append("GDPR Rights")
        if signals["has_ccpa_signals"]:
            detected_aspects.append("CCPA/CPRA Disclosures")
        if signals["has_retention_signals"]:
            detected_aspects.append("Data Retention Terms")
        if signals["has_deletion_signals"]:
            detected_aspects.append("Data Deletion Procedures")
        if signals["has_access_signals"]:
            detected_aspects.append("Subject Access Request Channels")

        findings.append(make_data_finding(
            check_type="deep_privacy_policy_signal",
            title="Public Privacy Policy Identified with Governance Disclosures",
            description=(
                f"A public privacy policy was discovered at {policy_page_url}. "
                f"Content analysis identified references to: {', '.join(detected_aspects) if detected_aspects else 'General data privacy practices'}."
            ),
            severity=Severity.INFO,
            status=CheckStatus.PASS,
            evidence=f"Policy URL: {policy_page_url}; Disclosures: {', '.join(detected_aspects) if detected_aspects else 'Standard policy text'}",
            how_to_fix="Maintain regular legal audits of your privacy policy to ensure all active third-party trackers and data sub-processors are accurately reflected.",
            data_category=DataCategory.PUBLIC,
        ))

    return privacy_data, findings, requests_executed
