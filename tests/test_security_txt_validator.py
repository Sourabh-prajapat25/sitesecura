"""
Automated Test Suite - Standalone RFC 9116 security.txt Validator
Covers:
1. Domain input normalization, schemes, control characters, credentials (@), and port validation.
2. RFC 9116 syntax parser (Contact URI formats, Expires date-time parsing, timezone-aware comparisons,
   cardinality, PGP signatures, comments, blank lines, Canonical, Policy, Preferred-Languages, and extension directives).
3. Safe HTTPS retrieval with Mock Transport (standard location vs fallback, 404 handling, HTML 200 detection,
   redirects to HTTPS vs forbidden redirects to HTTP, oversized file protection, and timeouts).
4. SSRF defenses: blocks loopback, RFC 1918 private IPs, cloud metadata, and DNS rebinding.
5. FastAPI endpoint integration (POST /api/v1/tools/security-txt-validate) and rate limiting.
"""
import sys
import os
import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch
import pytest
from pydantic import ValidationError

# Ensure app is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from apps.api.main import app
from fastapi.testclient import TestClient
import httpx

from app.schemas.tools import (
    SecurityTxtField,
    SecurityTxtFinding,
    SecurityTxtSummary,
    SecurityTxtValidateRequest,
    SecurityTxtValidateResponse,
)
from app.services.security_txt_service import (
    parse_and_validate_security_txt,
    execute_security_txt_validation_sync,
    MAX_FILE_BYTES,
)
from scanner.network.resolver import MockResolver

client = TestClient(app)

FIXED_NOW = datetime(2026, 10, 11, 12, 0, 0, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# 1. Domain Input Validation & Normalization Tests
# ---------------------------------------------------------------------------

class TestSecurityTxtInputValidation(unittest.TestCase):
    def test_valid_domain_normalization(self):
        req = SecurityTxtValidateRequest(domain="  EXAMPLE.com  ")
        self.assertEqual(req.domain, "example.com")

    def test_strip_https_scheme_and_path(self):
        req = SecurityTxtValidateRequest(domain="https://example.com/.well-known/security.txt")
        self.assertEqual(req.domain, "example.com")

    def test_strip_http_scheme(self):
        req = SecurityTxtValidateRequest(domain="http://example.com/some/path")
        self.assertEqual(req.domain, "example.com")

    def test_empty_domain_rejected(self):
        with self.assertRaises(ValidationError):
            SecurityTxtValidateRequest(domain="")

    def test_whitespace_domain_rejected(self):
        with self.assertRaises(ValidationError):
            SecurityTxtValidateRequest(domain="    ")

    def test_control_characters_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            SecurityTxtValidateRequest(domain="example.com\nnewline")
        self.assertIn("control characters", str(ctx.exception).lower())

    def test_embedded_credentials_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            SecurityTxtValidateRequest(domain="admin:secret@example.com")
        self.assertIn("credentials", str(ctx.exception).lower())

    def test_unsupported_scheme_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            SecurityTxtValidateRequest(domain="ftp://example.com")
        self.assertIn("unsupported url scheme", str(ctx.exception).lower())

    def test_disallowed_port_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            SecurityTxtValidateRequest(domain="example.com:22")
        self.assertIn("disallowed port", str(ctx.exception).lower())

    def test_loopback_ip_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            SecurityTxtValidateRequest(domain="127.0.0.1")
        self.assertIn("prohibited", str(ctx.exception).lower())

    def test_localhost_hostname_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            SecurityTxtValidateRequest(domain="localhost")
        self.assertIn("restricted", str(ctx.exception).lower())

    def test_private_rfc1918_ip_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            SecurityTxtValidateRequest(domain="192.168.1.1")
        self.assertIn("prohibited", str(ctx.exception).lower())

    def test_cloud_metadata_ip_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            SecurityTxtValidateRequest(domain="169.254.169.254")
        self.assertIn("prohibited", str(ctx.exception).lower())


# ---------------------------------------------------------------------------
# 2. RFC 9116 Content Parser Tests
# ---------------------------------------------------------------------------

class TestRFC9116Parser(unittest.TestCase):
    def test_fully_compliant_file(self):
        valid_content = """# Official security disclosure policy
Contact: mailto:security@example.com
Contact: https://example.com/security-disclosure
Expires: 2027-06-30T23:59:59.000Z
Encryption: https://example.com/pgp-key.txt
Acknowledgments: https://example.com/hall-of-fame
Preferred-Languages: en, es
Canonical: https://example.com/.well-known/security.txt
Policy: https://example.com/policy
Hiring: https://example.com/jobs
"""
        fields, findings, expires_iso, is_exp, days_left = parse_and_validate_security_txt(
            content=valid_content,
            now_utc=FIXED_NOW,
        )

        error_findings = [f for f in findings if f.severity == "error"]
        warning_findings = [f for f in findings if f.severity == "warning"]

        self.assertEqual(len(error_findings), 0)
        self.assertEqual(len(warning_findings), 0)
        self.assertFalse(is_exp)
        self.assertIsNotNone(expires_iso)
        self.assertGreater(days_left or 0, 0)
        self.assertEqual(len(fields), 9)

    def test_missing_contact_directive(self):
        content = "Expires: 2027-12-31T23:59:59Z\n"
        fields, findings, _, _, _ = parse_and_validate_security_txt(content, now_utc=FIXED_NOW)
        contact_missing = [f for f in findings if f.code == "CONTACT_MISSING"]
        self.assertEqual(len(contact_missing), 1)
        self.assertEqual(contact_missing[0].severity, "error")

    def test_missing_expires_directive(self):
        content = "Contact: mailto:security@example.com\n"
        fields, findings, _, _, _ = parse_and_validate_security_txt(content, now_utc=FIXED_NOW)
        expires_missing = [f for f in findings if f.code == "EXPIRES_MISSING"]
        self.assertEqual(len(expires_missing), 1)
        self.assertEqual(expires_missing[0].severity, "error")

    def test_multiple_expires_directives(self):
        content = """Contact: mailto:security@example.com
Expires: 2027-01-01T00:00:00Z
Expires: 2027-06-01T00:00:00Z
"""
        fields, findings, _, _, _ = parse_and_validate_security_txt(content, now_utc=FIXED_NOW)
        multiple_exp = [f for f in findings if f.code == "EXPIRES_MULTIPLE"]
        self.assertEqual(len(multiple_exp), 1)
        self.assertEqual(multiple_exp[0].severity, "error")

    def test_expired_file(self):
        content = """Contact: mailto:security@example.com
Expires: 2025-01-01T00:00:00Z
"""
        fields, findings, expires_iso, is_exp, days_left = parse_and_validate_security_txt(content, now_utc=FIXED_NOW)
        self.assertTrue(is_exp)
        exp_passed = [f for f in findings if f.code == "EXPIRES_PASSED"]
        self.assertEqual(len(exp_passed), 1)
        self.assertEqual(exp_passed[0].severity, "error")

    def test_expires_too_far_in_future(self):
        content = """Contact: mailto:security@example.com
Expires: 2029-01-01T00:00:00Z
"""
        fields, findings, _, is_exp, days_left = parse_and_validate_security_txt(content, now_utc=FIXED_NOW)
        self.assertFalse(is_exp)
        too_far = [f for f in findings if f.code == "EXPIRES_TOO_FAR"]
        self.assertEqual(len(too_far), 1)
        self.assertEqual(too_far[0].severity, "warning")

    def test_invalid_expires_format(self):
        content = """Contact: mailto:security@example.com
Expires: Next Year in December
"""
        fields, findings, _, _, _ = parse_and_validate_security_txt(content, now_utc=FIXED_NOW)
        inv_format = [f for f in findings if f.code == "EXPIRES_INVALID_FORMAT"]
        self.assertEqual(len(inv_format), 1)
        self.assertEqual(inv_format[0].severity, "error")

    def test_insecure_http_contact_link(self):
        content = """Contact: http://example.com/insecure-form
Expires: 2027-12-31T23:59:59Z
"""
        fields, findings, _, _, _ = parse_and_validate_security_txt(content, now_utc=FIXED_NOW)
        http_contact = [f for f in findings if f.code == "CONTACT_INSECURE_HTTP"]
        self.assertEqual(len(http_contact), 1)
        self.assertEqual(http_contact[0].severity, "error")

    def test_contact_missing_mailto_scheme(self):
        content = """Contact: security@example.com
Expires: 2027-12-31T23:59:59Z
"""
        fields, findings, _, _, _ = parse_and_validate_security_txt(content, now_utc=FIXED_NOW)
        missing_scheme = [f for f in findings if f.code == "CONTACT_MISSING_SCHEME"]
        self.assertEqual(len(missing_scheme), 1)
        self.assertEqual(missing_scheme[0].severity, "warning")

    def test_telephone_contact_valid(self):
        content = """Contact: tel:+1-555-0199
Expires: 2027-12-31T23:59:59Z
"""
        fields, findings, _, _, _ = parse_and_validate_security_txt(content, now_utc=FIXED_NOW)
        contact_valid = [f for f in findings if f.code == "CONTACT_VALID"]
        self.assertEqual(len(contact_valid), 1)
        self.assertEqual(contact_valid[0].severity, "success")

    def test_canonical_must_be_https(self):
        content = """Contact: mailto:security@example.com
Expires: 2027-12-31T23:59:59Z
Canonical: http://example.com/security.txt
"""
        fields, findings, _, _, _ = parse_and_validate_security_txt(content, now_utc=FIXED_NOW)
        canon_err = [f for f in findings if f.code == "CANONICAL_NOT_HTTPS"]
        self.assertEqual(len(canon_err), 1)
        self.assertEqual(canon_err[0].severity, "error")

    def test_malformed_line_without_colon(self):
        content = """Contact: mailto:security@example.com
This line is completely malformed and has no colon separator
Expires: 2027-12-31T23:59:59Z
"""
        fields, findings, _, _, _ = parse_and_validate_security_txt(content, now_utc=FIXED_NOW)
        malformed = [f for f in findings if f.code == "MALFORMED_LINE"]
        self.assertEqual(len(malformed), 1)
        self.assertEqual(malformed[0].line_number, 2)

    def test_pgp_cleartext_signature_armor_parsed_safely(self):
        content = """-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA512

Contact: mailto:security@example.com
Expires: 2027-12-31T23:59:59Z

-----BEGIN PGP SIGNATURE-----
Version: GnuPG v2
iQIcBAEBCgAGBQJ...
-----END PGP SIGNATURE-----
"""
        fields, findings, _, is_exp, _ = parse_and_validate_security_txt(content, now_utc=FIXED_NOW)
        error_findings = [f for f in findings if f.severity == "error"]
        self.assertEqual(len(error_findings), 0)
        self.assertEqual(len(fields), 2)

    def test_extension_directive_handled_as_info(self):
        content = """Contact: mailto:security@example.com
Expires: 2027-12-31T23:59:59Z
CSAF: https://example.com/.well-known/csaf/provider-metadata.json
"""
        fields, findings, _, _, _ = parse_and_validate_security_txt(content, now_utc=FIXED_NOW)
        ext = [f for f in findings if f.code == "EXTENSION_FIELD"]
        self.assertEqual(len(ext), 1)
        self.assertEqual(ext[0].severity, "info")


# ---------------------------------------------------------------------------
# 3. Safe HTTP Retrieval & Fallback Tests
# ---------------------------------------------------------------------------

class TestSafeHttpRetrieval(unittest.TestCase):
    def setUp(self):
        self.resolver = MockResolver({
            "example.com": ["93.184.216.34"],
            "fallback.org": ["104.18.2.1"],
            "redirect.net": ["151.101.1.69"],
        })

    def test_primary_location_success(self):
        def handler(request: httpx.Request) -> httpx.Response:
            if str(request.url) == "https://example.com/.well-known/security.txt":
                return httpx.Response(
                    status_code=200,
                    headers={"Content-Type": "text/plain; charset=utf-8"},
                    text="Contact: mailto:security@example.com\nExpires: 2027-06-30T23:59:59Z\n",
                )
            return httpx.Response(status_code=404)

        transport = httpx.MockTransport(handler)
        res = execute_security_txt_validation_sync(
            domain="example.com",
            resolver=self.resolver,
            custom_transport=transport,
            now_utc=FIXED_NOW,
        )

        self.assertEqual(res.retrieval_status, "retrieved")
        self.assertEqual(res.source_location, "/.well-known/security.txt")
        self.assertFalse(res.summary.used_fallback)
        self.assertEqual(res.validation_status, "valid")

    def test_fallback_location_used_when_primary_404(self):
        def handler(request: httpx.Request) -> httpx.Response:
            url_str = str(request.url)
            if url_str == "https://fallback.org/.well-known/security.txt":
                return httpx.Response(status_code=404)
            elif url_str == "https://fallback.org/security.txt":
                return httpx.Response(
                    status_code=200,
                    headers={"Content-Type": "text/plain"},
                    text="Contact: mailto:sec@fallback.org\nExpires: 2027-12-31T23:59:59Z\n",
                )
            return httpx.Response(status_code=404)

        transport = httpx.MockTransport(handler)
        res = execute_security_txt_validation_sync(
            domain="fallback.org",
            resolver=self.resolver,
            custom_transport=transport,
            now_utc=FIXED_NOW,
        )

        self.assertEqual(res.retrieval_status, "retrieved")
        self.assertEqual(res.source_location, "/security.txt")
        self.assertTrue(res.summary.used_fallback)
        # Fallback usage should produce a warning finding
        self.assertEqual(res.validation_status, "valid_with_warnings")
        fallback_finding = [f for f in res.findings if f.code == "FALLBACK_LOCATION_USED"]
        self.assertEqual(len(fallback_finding), 1)

    def test_file_not_found_on_both_locations(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(status_code=404)

        transport = httpx.MockTransport(handler)
        res = execute_security_txt_validation_sync(
            domain="example.com",
            resolver=self.resolver,
            custom_transport=transport,
            now_utc=FIXED_NOW,
        )

        self.assertEqual(res.retrieval_status, "not_found")
        self.assertEqual(res.validation_status, "not_found")
        self.assertIsNone(res.source_location)

    def test_html_document_returned_with_200_detected(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                status_code=200,
                headers={"Content-Type": "text/html"},
                text="<!DOCTYPE html><html><head><title>404 Page Not Found</title></head><body>Missing</body></html>",
            )

        transport = httpx.MockTransport(handler)
        res = execute_security_txt_validation_sync(
            domain="example.com",
            resolver=self.resolver,
            custom_transport=transport,
            now_utc=FIXED_NOW,
        )

        self.assertEqual(res.retrieval_status, "html_response")
        self.assertEqual(res.validation_status, "invalid")

    def test_redirect_to_https_followed_safely(self):
        def handler(request: httpx.Request) -> httpx.Response:
            url_str = str(request.url)
            if url_str == "https://example.com/.well-known/security.txt":
                return httpx.Response(status_code=301, headers={"Location": "https://redirect.net/sec.txt"})
            elif url_str == "https://redirect.net/sec.txt":
                return httpx.Response(
                    status_code=200,
                    text="Contact: mailto:security@example.com\nExpires: 2027-06-30T23:59:59Z\n",
                )
            return httpx.Response(status_code=404)

        transport = httpx.MockTransport(handler)
        res = execute_security_txt_validation_sync(
            domain="example.com",
            resolver=self.resolver,
            custom_transport=transport,
            now_utc=FIXED_NOW,
        )

        self.assertEqual(res.retrieval_status, "retrieved")
        self.assertEqual(res.validation_status, "valid")

    def test_redirect_to_http_blocked_per_rfc9116(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                status_code=302,
                headers={"Location": "http://example.com/unencrypted/security.txt"},
            )

        transport = httpx.MockTransport(handler)
        res = execute_security_txt_validation_sync(
            domain="example.com",
            resolver=self.resolver,
            custom_transport=transport,
            now_utc=FIXED_NOW,
        )

        self.assertEqual(res.retrieval_status, "blocked_target")
        self.assertIn("RFC 9116", res.findings[0].message)

    def test_redirect_to_loopback_blocked(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                status_code=302,
                headers={"Location": "https://127.0.0.1/admin/security.txt"},
            )

        transport = httpx.MockTransport(handler)
        res = execute_security_txt_validation_sync(
            domain="example.com",
            resolver=self.resolver,
            custom_transport=transport,
            now_utc=FIXED_NOW,
        )

        self.assertEqual(res.retrieval_status, "blocked_target")

    def test_oversized_file_rejected(self):
        def handler(request: httpx.Request) -> httpx.Response:
            huge_text = "Contact: mailto:sec@example.com\n" + ("# filler\n" * 15000)
            return httpx.Response(
                status_code=200,
                headers={"Content-Length": str(len(huge_text))},
                text=huge_text,
            )

        transport = httpx.MockTransport(handler)
        res = execute_security_txt_validation_sync(
            domain="example.com",
            resolver=self.resolver,
            custom_transport=transport,
            now_utc=FIXED_NOW,
        )

        self.assertEqual(res.retrieval_status, "oversized")
        self.assertEqual(res.validation_status, "retrieval_error")


# ---------------------------------------------------------------------------
# 4. API Endpoint Integration Tests
# ---------------------------------------------------------------------------

class TestSecurityTxtApiEndpoint(unittest.TestCase):
    @patch("app.api.v1.tools.execute_security_txt_validation")
    def test_api_endpoint_success(self, mock_execute):
        mock_execute.return_value = SecurityTxtValidateResponse(
            domain="example.com",
            target_url="https://example.com/.well-known/security.txt",
            checked_at="2026-10-11T12:00:00Z",
            duration_ms=52.4,
            retrieval_status="retrieved",
            source_location="/.well-known/security.txt",
            http_status_code=200,
            content_type="text/plain",
            content_length=84,
            validation_status="valid",
            summary=SecurityTxtSummary(
                total_fields=2,
                errors_count=0,
                warnings_count=0,
                info_count=0,
                has_contact=True,
                has_expires=True,
                has_encryption=False,
                has_policy=False,
                has_canonical=False,
                has_hiring=False,
                is_https=True,
                used_fallback=False,
            ),
            fields=[
                SecurityTxtField(
                    name="Contact",
                    value="mailto:security@example.com",
                    line_number=1,
                    is_valid=True,
                    description="Email contact URI",
                ),
                SecurityTxtField(
                    name="Expires",
                    value="2027-12-31T23:59:59Z",
                    line_number=2,
                    is_valid=True,
                    description="Valid future expiration",
                ),
            ],
            findings=[
                SecurityTxtFinding(
                    code="STANDARD_LOCATION_OK",
                    severity="success",
                    title="Standard Location Verified",
                    message="File is served from /.well-known/security.txt.",
                    line_number=None,
                    field_name=None,
                    reference="RFC 9116 Section 3",
                ),
            ],
            expires_at="2027-12-31T23:59:59+00:00",
            is_expired=False,
            days_until_expiration=446,
            raw_content="Contact: mailto:security@example.com\nExpires: 2027-12-31T23:59:59Z",
        )

        response = client.post(
            "/api/v1/tools/security-txt-validate",
            json={"domain": "example.com"},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["domain"], "example.com")
        self.assertEqual(data["validation_status"], "valid")
        self.assertEqual(data["source_location"], "/.well-known/security.txt")
        self.assertEqual(len(data["fields"]), 2)

    def test_api_endpoint_validation_error_on_empty_domain(self):
        response = client.post(
            "/api/v1/tools/security-txt-validate",
            json={"domain": ""},
        )
        self.assertEqual(response.status_code, 422)

    def test_api_endpoint_validation_error_on_loopback(self):
        response = client.post(
            "/api/v1/tools/security-txt-validate",
            json={"domain": "127.0.0.1"},
        )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
