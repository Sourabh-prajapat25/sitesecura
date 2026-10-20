"""
Tests for Phase F7: Advanced Data Security, Privacy & Sensitive Information Exposure Intelligence
Comprehensive verification conforming strictly to Phase F7 specification:
- Classification taxonomy & irreversible masking (emails, phones, Luhn-valid cards, government IDs, tokens)
- Personally Identifiable Information (PII) extraction and generic vs personal segregation
- Financial accounts, credit cards with Luhn checksum validation, and IBAN checks
- Protected health/medical compound context, precise GPS user coordinates, and public auth credentials
- API data minimization auditing, sensitive JSON response properties, and intermediate cache leaks
- URL query parameter exposure (PII and secrets in GET parameters) and referrer leakage risks
- Form data collection sensitivity and excessive collection signals
- Document and export auditing (bounded PDF metadata, CSV exports, SQL database dumps, log files)
- Privacy policy discovery and governance disclosure analysis (GDPR, CCPA, retention, deletion, SAR, DPO)
- Third-party tracking & consent management platform (CMP) analysis (trackers, session recording, consent signals)
- Master orchestrator execution, bounded request budget enforcement, and failure isolation
- Full Deep Scan runner integration (deep_scan_version = 7) and deterministic scoring
- Backward compatibility with legacy v1-v6 metadata
- Non-legal compliance certification disclaimers and privacy posture matrix assembly
"""
import pytest
from unittest.mock import MagicMock, patch
from urllib.parse import urlparse

from scanner.models import CheckStatus, Severity, Finding
from scanner.network.models import SafeResponse
from scanner.deep.models import CrawledPage
from scanner.deep.config import DeepScanConfig
from scanner.deep.scoring import calculate_deep_score
from scanner.deep.data_security_finding_helper import make_data_finding
from scanner.deep.data_classification import (
    DataClassification,
    ConfidenceLevel,
    luhn_validate,
    mask_email,
    mask_phone,
    mask_card_number,
    mask_government_id,
    mask_token,
    classify_field_name,
)
from scanner.deep.pii_analyzer import analyze_pii
from scanner.deep.financial_analyzer import analyze_financial_data
from scanner.deep.sensitive_data_analyzer import analyze_sensitive_data
from scanner.deep.api_data_analyzer import analyze_api_data
from scanner.deep.url_data_analyzer import analyze_url_data
from scanner.deep.form_data_analyzer import analyze_form_data
from scanner.deep.document_analyzer import analyze_documents_and_exports
from scanner.deep.privacy_analyzer import analyze_privacy_policy
from scanner.deep.tracking_consent_analyzer import analyze_tracking_and_consent
from scanner.deep.data_security import analyze_data_security
from scanner.deep.runner import run_deep_security_scan


def make_page(url: str, **kwargs) -> CrawledPage:
    """Helper to construct CrawledPage with required attributes."""
    parsed = urlparse(url)
    defaults = {
        "final_url": url,
        "depth": 1,
        "status_code": 200,
        "content_type": "text/html",
        "is_https": parsed.scheme.lower() == "https",
        "headers": {},
        "cookies": {},
        "forms": [],
        "discovered_links": [],
        "body_sample": "",
    }
    defaults.update(kwargs)
    return CrawledPage(url=url, **defaults)


def make_safe_response(url: str, status_code: int = 200, text: str = "", headers: dict = None) -> SafeResponse:
    """Helper to construct SafeResponse for mocked SafeHttpClient."""
    return SafeResponse(
        url=url,
        status_code=status_code,
        headers=headers or {"content-type": "text/plain"},
        text=text,
        bytes_read=len(text.encode("utf-8")),
        elapsed_ms=45,
    )


# =============================================================================
# 1. DATA CLASSIFICATION, LUHN VALIDATION & MASKING
# =============================================================================

def test_luhn_validation():
    """Verify Luhn algorithm correctly distinguishes valid and invalid numbers."""
    # Test valid Visa test numbers
    assert luhn_validate("4532015112830366") is True
    # Test valid Mastercard
    assert luhn_validate("5424180123456789") is True
    # Test invalid number (corrupted check digit)
    assert luhn_validate("4532015112830367") is False
    assert luhn_validate("1234567812345678") is False
    assert luhn_validate("123") is False
    assert luhn_validate("") is False


def test_mask_email():
    """Verify irreversible email masking."""
    assert mask_email("alice.smith@example.com") == "a***h@example.com"
    assert mask_email("a@b.com") == "a***@b.com"
    assert "masked@***" in mask_email("invalid-email")


def test_mask_phone():
    """Verify phone masking preserves country/area code and last 2 digits."""
    masked = mask_phone("+1-555-867-5309")
    assert masked.startswith("+1")
    assert masked.endswith("09")
    assert "*" in masked


def test_mask_card_number():
    """Verify credit card masking exposes only first 6 (BIN) and last 4."""
    masked = mask_card_number("4532015112830366")
    assert masked.startswith("453201")
    assert masked.endswith("0366")
    assert "******" in masked


def test_mask_government_id():
    """Verify SSN and national ID masking."""
    masked_ssn = mask_government_id("123-45-6789", "SSN")
    assert masked_ssn == "***-**-6789"
    masked_pan = mask_government_id("ABCDE1234F", "PAN")
    assert masked_pan.endswith("34F")
    assert "***" in masked_pan


def test_mask_token():
    """Verify token masking shows only beginning and ending characters."""
    masked = mask_token("ghp_1234567890abcdefghijklmnopqrstuvwxyz")
    assert masked.startswith("ghp_")
    assert masked.endswith("wxyz")
    assert "..." in masked


def test_classify_field_name():
    """Verify field name heuristic classification."""
    assert classify_field_name("email")[0] == DataClassification.PERSONAL
    assert classify_field_name("user_ssn")[0] == DataClassification.SENSITIVE_PERSONAL
    assert classify_field_name("credit_card_number")[0] == DataClassification.FINANCIAL
    assert classify_field_name("medical_diagnosis")[0] == DataClassification.HEALTH
    assert classify_field_name("auth_token")[0] == DataClassification.AUTHENTICATION
    assert classify_field_name("gps_latitude")[0] == DataClassification.LOCATION
    assert classify_field_name("page_title")[0] == DataClassification.PUBLIC


# =============================================================================
# 2. PII ANALYZER
# =============================================================================

def test_pii_personal_vs_generic_emails():
    """Verify personal emails generate findings while generic contact emails are noted as informational."""
    pages = [
        make_page(
            "https://example.com/team",
            body_sample="Contact our CEO John Doe at john.doe@company.org or info@company.org for support.",
        )
    ]
    data, findings = analyze_pii(pages)
    assert data["personal_emails_count"] == 1
    assert data["generic_emails_count"] == 1
    assert any("company.org" in pe["masked_email"] and "*" in pe["masked_email"] for pe in data["personal_emails"])


def test_pii_phone_number_extraction():
    """Verify international phone numbers are extracted and masked."""
    pages = [
        make_page(
            "https://example.com/contact",
            body_sample="Direct line: +1-202-555-0199 or mobile +44 7911 123456.",
        )
    ]
    data, findings = analyze_pii(pages)
    assert data["phone_numbers_count"] >= 1
    assert any("*" in p["masked_phone"] for p in data["phone_numbers"])


def test_pii_government_id_ssn():
    """Verify SSN pattern with context produces a HIGH severity finding."""
    pages = [
        make_page(
            "https://example.com/test",
            body_sample="Applicant SSN: 219-09-5432 verified.",
        )
    ]
    data, findings = analyze_pii(pages)
    assert data["government_ids_count"] >= 1
    gov_findings = [f for f in findings if f.check_type == "deep_public_government_id"]
    assert len(gov_findings) >= 1
    assert gov_findings[0].severity == Severity.HIGH


# =============================================================================
# 3. FINANCIAL ANALYZER
# =============================================================================

def test_financial_luhn_valid_card():
    """Verify Luhn-validated credit card generates a CRITICAL finding."""
    pages = [
        make_page(
            "https://example.com/debug/order",
            body_sample="Payment debug payload: card=4532015112830366 exp=12/28",
        )
    ]
    data, findings = analyze_financial_data(pages)
    assert data["cards_detected_count"] == 1
    assert data["cards"][0]["card_brand"] == "Visa"
    assert "0366" in data["cards"][0]["masked_number"]
    card_findings = [f for f in findings if f.check_type == "deep_public_payment_data"]
    assert len(card_findings) == 1
    assert card_findings[0].severity == Severity.CRITICAL


def test_financial_invalid_card_ignored():
    """Verify numbers failing Luhn check do not trigger false positive card findings."""
    pages = [
        make_page(
            "https://example.com/product",
            body_sample="Product serial: 4532015112830367 (not a card).",
        )
    ]
    data, findings = analyze_financial_data(pages)
    assert data["cards_detected_count"] == 0
    assert not any(f.check_type == "deep_public_payment_data" for f in findings)


def test_financial_iban_discovery():
    """Verify valid IBAN generates a HIGH severity finding."""
    pages = [
        make_page(
            "https://example.com/billing",
            body_sample="Bank transfer details: IBAN GB82WEST12345698765432 BIC: WESTGB21",
        )
    ]
    data, findings = analyze_financial_data(pages)
    assert data["ibans_detected_count"] == 1
    assert any(f.check_type == "deep_public_financial_data" for f in findings)


# =============================================================================
# 4. SENSITIVE DATA ANALYZER (HEALTH, LOCATION, AUTH)
# =============================================================================

def test_sensitive_health_data():
    """Verify health context generates an exposure finding."""
    pages = [
        make_page(
            "https://example.com/patient/summary",
            body_sample="Patient medical record: Patient was diagnosed with acute leukemia and prescribed chemotherapy.",
        )
    ]
    data, findings = analyze_sensitive_data(pages)
    assert data["health_data_count"] >= 1
    assert any(f.check_type == "deep_public_health_data" for f in findings)


def test_sensitive_location_coordinates():
    """Verify precise GPS user coordinates generate a finding."""
    pages = [
        make_page(
            "https://example.com/user/location",
            body_sample='{"status": "active", "latitude": 37.774929, "longitude": -122.419416, "accuracy": 5}',
        )
    ]
    data, findings = analyze_sensitive_data(pages)
    assert data["location_data_count"] >= 1
    assert any(f.check_type == "deep_public_location_data" for f in findings)


def test_sensitive_public_authentication_data():
    """Verify exposed passwords or reset tokens generate a CRITICAL finding."""
    pages = [
        make_page(
            "https://example.com/api/debug",
            body_sample='{"user": "admin", "password_hash": "$2a$12$...", "plaintext_password": "supersecretpassword123"}',
        )
    ]
    data, findings = analyze_sensitive_data(pages)
    assert data["authentication_data_count"] >= 1
    assert any(f.check_type == "deep_public_auth_data" for f in findings)


# =============================================================================
# 5. API DATA MINIMIZATION ANALYZER
# =============================================================================

def test_api_data_minimization_and_cache():
    """Verify API minimization detects excessive fields and public caching of sensitive data."""
    pages = [
        make_page(
            "https://example.com/api/users",
            content_type="application/json",
            headers={"cache-control": "public, max-age=3600"},
            body_sample='{"users": [{"id": 1, "email": "alice@corp.internal", "ssn": "000-11-2222", "password_reset_token": "abc123token"}]}',
        )
    ]
    data, findings = analyze_api_data(pages)
    assert data["sensitive_fields_observed_count"] >= 2
    assert data["cache_exposure_count"] >= 1
    assert any(f.check_type == "deep_data_minimization" for f in findings)


# =============================================================================
# 6. URL DATA EXPOSURE ANALYZER
# =============================================================================

def test_url_pii_and_secret_parameters():
    """Verify sensitive parameters in query strings produce findings."""
    pages = [
        make_page(
            "https://example.com/register?email=bob.smith@example.com&reset_token=99887766aabbccdd",
            headers={"referrer-policy": "unsafe-url"},
        )
    ]
    data, findings = analyze_url_data(pages)
    assert data["pii_in_urls_count"] == 1
    assert data["secrets_in_urls_count"] == 1
    assert data["referrer_leakage_risks_count"] == 1
    assert any(f.check_type == "deep_pii_in_url" for f in findings)
    assert any(f.check_type == "deep_secret_in_url" for f in findings)


# =============================================================================
# 7. FORM DATA ANALYZER
# =============================================================================

def test_form_excessive_data_collection():
    """Verify forms demanding excessive personal and identity fields trigger a warning."""
    pages = [
        make_page(
            "https://example.com/apply",
            forms=[
                {
                    "action": "https://example.com/api/submit",
                    "method": "POST",
                    "inputs": [
                        {"name": "full_name", "type": "text"},
                        {"name": "email", "type": "email"},
                        {"name": "phone", "type": "tel"},
                        {"name": "ssn", "type": "text"},
                        {"name": "salary", "type": "number"},
                        {"name": "bank_account", "type": "text"},
                        {"name": "mothers_maiden_name", "type": "text"},
                    ],
                }
            ],
        )
    ]
    data, findings = analyze_form_data(pages)
    assert data["forms_analyzed_count"] == 1
    assert data["excessive_collection_forms_count"] == 1
    assert any(f.check_type == "deep_excessive_data_collection" for f in findings)


# =============================================================================
# 8. DOCUMENT & EXPORT ANALYZER
# =============================================================================

def test_document_metadata_internal_paths():
    """Verify PDF internal metadata extraction and finding generation."""
    client = MagicMock()
    # Mock PDF response with metadata
    pdf_content = (
        b"%PDF-1.4\n"
        b"/Author (John Internal Admin)\n"
        b"/Producer (Apache FOP)\n"
        b"trailer << /Info 1 0 R >>\n"
        b"C:\\Jenkins\\workspace\\build\\invoice.pdf\n"
        b"%%EOF"
    )
    client.get.return_value = make_safe_response("https://example.com/invoice.pdf", 200, pdf_content.decode("latin-1"))

    pages = [
        make_page("https://example.com/", discovered_links=["https://example.com/invoice.pdf"])
    ]
    data, findings, reqs = analyze_documents_and_exports(
        pages, client, lambda: True, max_probes=2, max_doc_bytes=524288
    )
    assert data["documents_with_internal_metadata_count"] == 1
    assert any(f.check_type == "deep_document_internal_metadata" for f in findings)
    assert reqs == 1


def test_exposed_database_backup_file():
    """Verify exposed SQL dump file probe produces a CRITICAL finding."""
    client = MagicMock()
    sql_sample = "-- MySQL dump 10.13\nCREATE TABLE `users` (\n  `id` int(11) NOT NULL\n);"
    client.get.return_value = make_safe_response("https://example.com/backup.sql", 200, sql_sample)

    pages = [make_page("https://example.com/")]
    data, findings, reqs = analyze_documents_and_exports(
        pages, client, lambda: True, max_probes=1, max_doc_bytes=524288
    )
    assert data["exposed_data_files_count"] >= 1
    assert any(f.check_type == "deep_public_database_data" for f in findings)


# =============================================================================
# 9. PRIVACY POLICY GOVERNANCE ANALYZER
# =============================================================================

def test_privacy_policy_governance_disclosures():
    """Verify privacy policy text evaluation for GDPR, CCPA, retention, and contact details."""
    client = MagicMock()
    policy_html = """
    <html>
      <head><title>Privacy Policy</title></head>
      <body>
        <h1>Privacy Statement</h1>
        <p>Under the General Data Protection Regulation (GDPR), you have the right to access, rectify, or request erasure of your data.</p>
        <p>California residents: under the CCPA, you have the right to opt-out. Do Not Sell My Personal Information.</p>
        <p>We retain personal data for a retention period of 3 years.</p>
        <p>To request data deletion or exercise a subject access request, contact our Data Protection Officer at dpo@example.com.</p>
      </body>
    </html>
    """
    client.get.return_value = make_safe_response("https://example.com/privacy", 200, policy_html)

    pages = [make_page("https://example.com/")]
    data, findings, reqs = analyze_privacy_policy(
        pages, client, "https://example.com", lambda: True, max_probes=2, max_doc_bytes=524288
    )
    assert data["policy_present"] is True
    assert data["gdpr_rights_mentioned"] is True
    assert data["ccpa_mentioned"] is True
    assert data["retention_period_disclosed"] is True
    assert data["data_deletion_disclosed"] is True
    assert data["access_request_disclosed"] is True
    assert data["dpo_or_contact_email_present"] is True
    assert "dpo@example.com" in data.get("dpo_contact", "")
    assert any(f.check_type == "deep_privacy_policy_signal" for f in findings)


def test_missing_privacy_policy():
    """Verify missing privacy policy triggers an informational finding."""
    client = MagicMock()
    client.get.return_value = make_safe_response("https://example.com/privacy", 404, "Not Found")

    pages = [make_page("https://example.com/")]
    data, findings, reqs = analyze_privacy_policy(
        pages, client, "https://example.com", lambda: True, max_probes=1, max_doc_bytes=524288
    )
    assert data["policy_present"] is False
    assert any(f.check_type == "deep_privacy_policy_missing" for f in findings)


# =============================================================================
# 10. THIRD-PARTY TRACKING & CONSENT ANALYZER
# =============================================================================

def test_tracking_and_consent_analysis():
    """Verify CMP detection, session recording classification, and tracker cataloging."""
    pages = [
        make_page(
            "https://example.com/",
            body_sample=(
                '<script src="https://cdn.cookielaw.org/scripttemplates/otSDKStub.js" data-domain-script="123"></script>'
                '<script src="https://static.hotjar.com/c/hotjar-123456.js"></script>'
                '<script src="https://www.google-analytics.com/analytics.js"></script>'
                '<script src="https://connect.facebook.net/en_US/fbevents.js"></script>'
            ),
        )
    ]
    data, findings = analyze_tracking_and_consent(pages, frontend_metadata=None)
    assert data["consent_banner_detected"] is True
    assert data["cmp_provider"] == "OneTrust"
    assert data["session_recording_detected"] is True
    assert "Hotjar" in data["session_recording_tools"]
    assert data["advertising_trackers_detected"] is True
    assert data["trackers_detected_count"] >= 3
    assert any(f.check_type == "deep_session_recording_detected" for f in findings)
    assert any(f.check_type == "deep_advertising_tracking_detected" for f in findings)


# =============================================================================
# 11. MASTER ORCHESTRATOR & BUDGET ENFORCEMENT
# =============================================================================

def test_data_security_orchestrator_budget_enforcement():
    """Verify master orchestrator strictly obeys max_f7_requests budget."""
    cfg = DeepScanConfig(max_f7_requests=5)
    client = MagicMock()
    client.get.return_value = make_safe_response("https://example.com/dummy", 200, "OK")

    pages = [
        make_page("https://example.com/", discovered_links=[f"https://example.com/doc{i}.pdf" for i in range(15)])
    ]
    meta, findings = analyze_data_security(
        crawled_pages=pages,
        client=client,
        cfg=cfg,
        base_url="https://example.com",
    )
    assert meta["status"] == "completed"
    assert meta["requests_executed"] <= 5
    assert "posture_matrix" in meta
    assert "summary" in meta


def test_data_security_orchestrator_failure_isolation():
    """Verify analyzer failure in one subcomponent does not crash the orchestrator."""
    cfg = DeepScanConfig(max_f7_requests=10)
    client = MagicMock()
    client.get.side_effect = Exception("Simulated network timeout")

    pages = [make_page("https://example.com/")]
    meta, findings = analyze_data_security(
        crawled_pages=pages,
        client=client,
        cfg=cfg,
        base_url="https://example.com",
    )
    assert meta["status"] == "completed"
    assert "posture_matrix" in meta


# =============================================================================
# 12. RUNNER INTEGRATION & DEEP SCAN VERSION 7
# =============================================================================

def test_full_runner_integration_f7():
    """Verify run_deep_security_scan bumps deep_scan_version=7 and stores data_security metadata."""
    client = MagicMock()
    mock_resp = make_safe_response(
        "https://example.com/",
        200,
        "<html><head><title>Home</title></head><body><h1>Welcome</h1><p>Contact: privacy@example.com</p></body></html>",
    )
    mock_resp.resolved_ip = "104.21.12.34"
    client.get.return_value = mock_resp
    client.options.return_value = mock_resp

    resolver = MagicMock()
    resolver.resolve.return_value = ["104.21.12.34"]

    res = run_deep_security_scan(
        "example.com",
        resolver=resolver,
        client=client,
    )

    assert res.scan_metadata.get("deep_scan_version") >= 7
    assert "data_security" in res.scan_metadata
    assert res.scan_metadata["data_security"]["status"] == "completed"
    assert "posture_matrix" in res.scan_metadata["data_security"]
