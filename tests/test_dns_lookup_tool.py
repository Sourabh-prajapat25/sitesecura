"""
Automated Test Suite - Standalone DNS Lookup Tool
Tests domain normalization, record type validation, mock DNS resolution across all 8 record types,
timeout/NXDOMAIN/NoAnswer edge cases, API endpoint responses, rate limiting, and defensive security.
"""
import sys
import os
import unittest
from unittest.mock import MagicMock, patch
import pytest
from pydantic import ValidationError

# Ensure app is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from apps.api.main import app
from fastapi.testclient import TestClient
import dns.resolver
import dns.exception

from app.schemas.tools import (
    ALLOWED_DNS_RECORD_TYPES,
    DEFAULT_DNS_RECORD_TYPES,
    DnsLookupRequest,
    DnsLookupResponse,
    DnsTypeResult,
    DnsRecordItem,
)
from app.services.dns_lookup_service import (
    resolve_record_type_sync,
    execute_dns_lookup,
)

client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. Validation Tests
# ---------------------------------------------------------------------------

class TestDnsLookupValidation(unittest.TestCase):
    def test_valid_domain_normalization(self):
        req = DnsLookupRequest(domain="  EXAMPLE.com.  ")
        self.assertEqual(req.domain, "example.com")

    def test_valid_subdomain(self):
        req = DnsLookupRequest(domain="api.staging.site-secura.co.uk")
        self.assertEqual(req.domain, "api.staging.site-secura.co.uk")

    def test_empty_domain_rejected(self):
        with self.assertRaises(ValidationError):
            DnsLookupRequest(domain="")

    def test_whitespace_only_domain_rejected(self):
        with self.assertRaises(ValidationError):
            DnsLookupRequest(domain="   ")

    def test_url_with_scheme_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            DnsLookupRequest(domain="https://example.com")
        self.assertIn("URL schemes", str(ctx.exception))

    def test_url_with_path_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            DnsLookupRequest(domain="example.com/test/path")
        self.assertIn("URL paths", str(ctx.exception))

    def test_domain_with_port_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            DnsLookupRequest(domain="example.com:8443")
        self.assertIn("port numbers", str(ctx.exception))

    def test_domain_with_query_or_fragment_rejected(self):
        with self.assertRaises(ValidationError):
            DnsLookupRequest(domain="example.com?foo=bar")
        with self.assertRaises(ValidationError):
            DnsLookupRequest(domain="example.com#section")

    def test_credentials_or_email_rejected(self):
        with self.assertRaises(ValidationError):
            DnsLookupRequest(domain="user:pass@example.com")
        with self.assertRaises(ValidationError):
            DnsLookupRequest(domain="admin@example.com")

    def test_ip_address_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            DnsLookupRequest(domain="192.168.1.1")
        self.assertIn("IP addresses are not valid", str(ctx.exception))

    def test_blocked_internal_hostnames_rejected(self):
        for blocked in ["localhost", "local", "internal", "lan", "metadata.google.internal"]:
            with self.assertRaises(ValidationError):
                DnsLookupRequest(domain=blocked)

    def test_oversized_domain_rejected(self):
        long_domain = "a" * 250 + ".com"
        with self.assertRaises(ValidationError):
            DnsLookupRequest(domain=long_domain)

    def test_default_record_types(self):
        req = DnsLookupRequest(domain="example.com")
        self.assertEqual(req.record_types, ["A", "AAAA", "MX", "NS", "TXT"])

    def test_custom_valid_record_types_normalized_to_uppercase(self):
        req = DnsLookupRequest(domain="example.com", record_types=["a", "soa", "caa"])
        self.assertEqual(req.record_types, ["A", "SOA", "CAA"])

    def test_unsupported_record_type_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            DnsLookupRequest(domain="example.com", record_types=["A", "PTR"])
        self.assertIn("Unsupported DNS record type 'PTR'", str(ctx.exception))

    def test_empty_record_types_rejected(self):
        with self.assertRaises(ValidationError):
            DnsLookupRequest(domain="example.com", record_types=[])

    def test_duplicate_record_types_deduplicated(self):
        req = DnsLookupRequest(domain="example.com", record_types=["A", "a", "MX", "mx"])
        self.assertEqual(req.record_types, ["A", "MX"])


# ---------------------------------------------------------------------------
# 2. DNS Resolution Behavior Tests (Mock Resolver)
# ---------------------------------------------------------------------------

class TestDnsResolutionService(unittest.TestCase):
    def test_resolve_a_records_success(self):
        mock_resolver = MagicMock()
        mock_rrset = MagicMock()
        mock_rrset.ttl = 300

        mock_rdata1 = MagicMock()
        mock_rdata1.address = "93.184.216.34"
        mock_rdata2 = MagicMock()
        mock_rdata2.address = "93.184.216.35"

        mock_answers = [mock_rdata1, mock_rdata2]
        mock_answers_obj = MagicMock()
        mock_answers_obj.__iter__.return_value = mock_answers
        mock_answers_obj.rrset = mock_rrset

        mock_resolver.resolve.return_value = mock_answers_obj

        result = resolve_record_type_sync("example.com", "A", resolver=mock_resolver)
        self.assertEqual(result.status, "success")
        self.assertEqual(result.record_type, "A")
        self.assertEqual(len(result.records), 2)
        self.assertEqual(result.records[0].value, "93.184.216.34")
        self.assertEqual(result.records[0].ttl, 300)

    def test_resolve_aaaa_records_success(self):
        mock_resolver = MagicMock()
        mock_rrset = MagicMock()
        mock_rrset.ttl = 600

        mock_rdata = MagicMock()
        mock_rdata.address = "2606:2800:220:1:248:1863:25c8:1946"

        mock_answers_obj = MagicMock()
        mock_answers_obj.__iter__.return_value = [mock_rdata]
        mock_answers_obj.rrset = mock_rrset

        mock_resolver.resolve.return_value = mock_answers_obj

        result = resolve_record_type_sync("example.com", "AAAA", resolver=mock_resolver)
        self.assertEqual(result.status, "success")
        self.assertEqual(result.records[0].value, "2606:2800:220:1:248:1863:25c8:1946")
        self.assertEqual(result.records[0].ttl, 600)

    def test_resolve_mx_records_with_preference_sorting(self):
        mock_resolver = MagicMock()
        mock_rrset = MagicMock()
        mock_rrset.ttl = 1800

        mock_mx20 = MagicMock()
        mock_mx20.preference = 20
        mock_mx20.exchange.to_text.return_value = "alt.mail.example.com."

        mock_mx10 = MagicMock()
        mock_mx10.preference = 10
        mock_mx10.exchange.to_text.return_value = "mail.example.com."

        mock_answers_obj = MagicMock()
        mock_answers_obj.__iter__.return_value = [mock_mx20, mock_mx10]
        mock_answers_obj.rrset = mock_rrset

        mock_resolver.resolve.return_value = mock_answers_obj

        result = resolve_record_type_sync("example.com", "MX", resolver=mock_resolver)
        self.assertEqual(result.status, "success")
        self.assertEqual(len(result.records), 2)
        # Verify sorted by preference (10 before 20)
        self.assertEqual(result.records[0].preference, 10)
        self.assertEqual(result.records[0].exchange, "mail.example.com")
        self.assertEqual(result.records[0].value, "10 mail.example.com")
        self.assertEqual(result.records[1].preference, 20)

    def test_resolve_txt_records_rfc_strings(self):
        mock_resolver = MagicMock()
        mock_rrset = MagicMock()
        mock_rrset.ttl = 3600

        mock_txt1 = MagicMock()
        mock_txt1.strings = [b"v=spf1 include:_spf.google.com ~all"]

        mock_txt2 = MagicMock()
        # Test fragmented chunk concatenation
        mock_txt2.strings = [b"google-site-verification=", b"abc123xyz456"]

        mock_answers_obj = MagicMock()
        mock_answers_obj.__iter__.return_value = [mock_txt1, mock_txt2]
        mock_answers_obj.rrset = mock_rrset

        mock_resolver.resolve.return_value = mock_answers_obj

        result = resolve_record_type_sync("example.com", "TXT", resolver=mock_resolver)
        self.assertEqual(result.status, "success")
        self.assertEqual(len(result.records), 2)
        values = [r.value for r in result.records]
        self.assertIn("v=spf1 include:_spf.google.com ~all", values)
        self.assertIn("google-site-verification=abc123xyz456", values)

    def test_resolve_cname_records(self):
        mock_resolver = MagicMock()
        mock_rrset = MagicMock()
        mock_rrset.ttl = 300

        mock_cname = MagicMock()
        mock_cname.target.to_text.return_value = "app.cdn-provider.net."

        mock_answers_obj = MagicMock()
        mock_answers_obj.__iter__.return_value = [mock_cname]
        mock_answers_obj.rrset = mock_rrset

        mock_resolver.resolve.return_value = mock_answers_obj

        result = resolve_record_type_sync("sub.example.com", "CNAME", resolver=mock_resolver)
        self.assertEqual(result.status, "success")
        self.assertEqual(result.records[0].value, "app.cdn-provider.net")

    def test_resolve_ns_records(self):
        mock_resolver = MagicMock()
        mock_rrset = MagicMock()
        mock_rrset.ttl = 86400

        mock_ns1 = MagicMock()
        mock_ns1.target.to_text.return_value = "ns1.cloudflare.com."
        mock_ns2 = MagicMock()
        mock_ns2.target.to_text.return_value = "ns2.cloudflare.com."

        mock_answers_obj = MagicMock()
        mock_answers_obj.__iter__.return_value = [mock_ns1, mock_ns2]
        mock_answers_obj.rrset = mock_rrset

        mock_resolver.resolve.return_value = mock_answers_obj

        result = resolve_record_type_sync("example.com", "NS", resolver=mock_resolver)
        self.assertEqual(result.status, "success")
        self.assertEqual(len(result.records), 2)
        self.assertEqual(result.records[0].value, "ns1.cloudflare.com")

    def test_resolve_soa_records(self):
        mock_resolver = MagicMock()
        mock_rrset = MagicMock()
        mock_rrset.ttl = 1800

        mock_soa = MagicMock()
        mock_soa.mname.to_text.return_value = "ns1.example.com."
        mock_soa.rname.to_text.return_value = "hostmaster.example.com."
        mock_soa.serial = 2026101101
        mock_soa.refresh = 7200
        mock_soa.retry = 3600
        mock_soa.expire = 1209600
        mock_soa.minimum = 300

        mock_answers_obj = MagicMock()
        mock_answers_obj.__iter__.return_value = [mock_soa]
        mock_answers_obj.rrset = mock_rrset

        mock_resolver.resolve.return_value = mock_answers_obj

        result = resolve_record_type_sync("example.com", "SOA", resolver=mock_resolver)
        self.assertEqual(result.status, "success")
        self.assertEqual(result.records[0].mname, "ns1.example.com")
        self.assertEqual(result.records[0].rname, "hostmaster.example.com")
        self.assertEqual(result.records[0].serial, 2026101101)
        self.assertEqual(result.records[0].refresh, 7200)
        self.assertIn("Serial: 2026101101", result.records[0].value)

    def test_resolve_caa_records(self):
        mock_resolver = MagicMock()
        mock_rrset = MagicMock()
        mock_rrset.ttl = 3600

        mock_caa = MagicMock()
        mock_caa.flags = 0
        mock_caa.tag = b"issue"
        mock_caa.value = b"letsencrypt.org"

        mock_answers_obj = MagicMock()
        mock_answers_obj.__iter__.return_value = [mock_caa]
        mock_answers_obj.rrset = mock_rrset

        mock_resolver.resolve.return_value = mock_answers_obj

        result = resolve_record_type_sync("example.com", "CAA", resolver=mock_resolver)
        self.assertEqual(result.status, "success")
        self.assertEqual(result.records[0].flags, 0)
        self.assertEqual(result.records[0].tag, "issue")
        self.assertEqual(result.records[0].value, '0 issue "letsencrypt.org"')

    def test_handle_nxdomain(self):
        mock_resolver = MagicMock()
        mock_resolver.resolve.side_effect = dns.resolver.NXDOMAIN()

        result = resolve_record_type_sync("nonexistent-domain-xyz.com", "A", resolver=mock_resolver)
        self.assertEqual(result.status, "no_records")
        self.assertEqual(len(result.records), 0)
        self.assertIn("NXDOMAIN", result.message)

    def test_handle_no_answer(self):
        mock_resolver = MagicMock()
        mock_resolver.resolve.side_effect = dns.resolver.NoAnswer()

        result = resolve_record_type_sync("example.com", "MX", resolver=mock_resolver)
        self.assertEqual(result.status, "no_records")
        self.assertEqual(len(result.records), 0)
        self.assertIn("No MX records were returned", result.message)

    def test_handle_timeout(self):
        mock_resolver = MagicMock()
        mock_resolver.resolve.side_effect = dns.resolver.LifetimeTimeout()

        result = resolve_record_type_sync("example.com", "TXT", resolver=mock_resolver)
        self.assertEqual(result.status, "timeout")
        self.assertEqual(len(result.records), 0)
        self.assertIn("timed out", result.message)

    def test_handle_nonameservers(self):
        mock_resolver = MagicMock()
        mock_resolver.resolve.side_effect = dns.resolver.NoNameservers()

        result = resolve_record_type_sync("example.com", "NS", resolver=mock_resolver)
        self.assertEqual(result.status, "error")
        self.assertEqual(len(result.records), 0)
        self.assertIn("SERVFAIL", result.message)


# ---------------------------------------------------------------------------
# 3. Async Parallel Resolution & Mixed Results
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_execute_dns_lookup_aggregates_results_and_summary():
    mock_resolver = MagicMock()

    def side_effect(domain, rtype):
        if rtype == "A":
            m_rr = MagicMock()
            m_rr.ttl = 300
            m_data = MagicMock()
            m_data.address = "1.2.3.4"
            ans = MagicMock()
            ans.__iter__.return_value = [m_data]
            ans.rrset = m_rr
            return ans
        elif rtype == "MX":
            raise dns.resolver.NoAnswer()
        elif rtype == "TXT":
            raise dns.resolver.LifetimeTimeout()
        else:
            raise dns.resolver.NoAnswer()

    mock_resolver.resolve.side_effect = side_effect

    response = await execute_dns_lookup(
        domain="example.com",
        record_types=["A", "MX", "TXT"],
        resolver=mock_resolver,
    )

    assert response.domain == "example.com"
    assert response.duration_ms >= 0
    assert len(response.results) == 3

    res_by_type = {r.record_type: r for r in response.results}
    assert res_by_type["A"].status == "success"
    assert len(res_by_type["A"].records) == 1
    assert res_by_type["A"].records[0].value == "1.2.3.4"

    assert res_by_type["MX"].status == "no_records"
    assert len(res_by_type["MX"].records) == 0

    assert res_by_type["TXT"].status == "timeout"
    assert len(res_by_type["TXT"].records) == 0

    assert response.summary.requested_types == 3
    # successful_types counts success and legitimate no_records
    assert response.summary.successful_types == 2
    assert response.summary.total_records == 1


# ---------------------------------------------------------------------------
# 4. API Endpoint Integration Tests (POST /api/v1/tools/dns-lookup)
# ---------------------------------------------------------------------------

class TestDnsLookupApiEndpoint(unittest.TestCase):
    def test_api_valid_dns_lookup(self):
        mock_resolver = MagicMock()
        mock_rrset = MagicMock()
        mock_rrset.ttl = 300
        mock_rdata = MagicMock()
        mock_rdata.address = "93.184.216.34"

        mock_ans = MagicMock()
        mock_ans.__iter__.return_value = [mock_rdata]
        mock_ans.rrset = mock_rrset
        mock_resolver.resolve.return_value = mock_ans

        with patch("app.services.dns_lookup_service.create_resolver", return_value=mock_resolver):
            resp = client.post(
                "/api/v1/tools/dns-lookup",
                json={"domain": "example.com", "record_types": ["A", "MX"]},
            )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["domain"], "example.com")
        self.assertIn("duration_ms", data)
        self.assertIn("queried_at", data)
        self.assertEqual(len(data["results"]), 2)
        self.assertEqual(data["summary"]["requested_types"], 2)

    def test_api_rejects_url_with_scheme(self):
        resp = client.post(
            "/api/v1/tools/dns-lookup",
            json={"domain": "https://example.com/test"},
        )
        self.assertEqual(resp.status_code, 422)

    def test_api_rejects_empty_domain(self):
        resp = client.post(
            "/api/v1/tools/dns-lookup",
            json={"domain": ""},
        )
        self.assertEqual(resp.status_code, 422)

    def test_api_rejects_unsupported_record_type(self):
        resp = client.post(
            "/api/v1/tools/dns-lookup",
            json={"domain": "example.com", "record_types": ["A", "INVALID_TYPE"]},
        )
        self.assertEqual(resp.status_code, 422)

    def test_api_rate_limiting(self):
        # Trigger requests up to limit + 1
        with patch("app.api.v1.tools.DNS_LOOKUP_RATE_LIMIT", 3):
            # Send 3 successful requests
            for _ in range(3):
                with patch("app.services.dns_lookup_service.create_resolver") as mock_res:
                    mock_res.return_value.resolve.side_effect = dns.resolver.NoAnswer()
                    r = client.post(
                        "/api/v1/tools/dns-lookup",
                        json={"domain": "example.com", "record_types": ["A"]},
                        headers={"X-Forwarded-For": "203.0.113.199"},
                    )
                    self.assertIn(r.status_code, (200, 429))

            # 4th request must be rate limited
            r_rate_limited = client.post(
                "/api/v1/tools/dns-lookup",
                json={"domain": "example.com", "record_types": ["A"]},
                headers={"X-Forwarded-For": "203.0.113.199"},
            )
            self.assertEqual(r_rate_limited.status_code, 429)
            self.assertIn("RATE_LIMITED", str(r_rate_limited.json()))


if __name__ == "__main__":
    unittest.main()
