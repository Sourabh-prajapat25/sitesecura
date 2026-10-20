"""
Automated Test Suite - Phase 4: Resources Hub Discovery, Tool Navigation & Conversion Optimization
Tests public tools endpoints, CMS resources endpoints, telemetry event ingestion, and sitemap/tool routing integrity.
"""
import pytest
import sys
import os
from starlette.testclient import TestClient

# Ensure root paths are in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from apps.api.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


class TestResourcesDiscoveryHub:
    """Tests for Phase 4 Resources Hub endpoints and tool integration."""

    def test_all_five_standalone_tool_endpoints_available(self, client: TestClient):
        """Verifies that all 5 standalone API tool endpoints are mounted and respond properly."""
        headers = {"X-Forwarded-For": "198.51.100.201"}

        # 1. DNS Lookup Tool
        res_dns = client.post(
            "/api/v1/tools/dns-lookup",
            json={"domain": "example.com", "record_types": ["A"]},
            headers=headers,
        )
        assert res_dns.status_code == 200
        assert "results" in res_dns.json()

        # 2. HTTP Status & Redirect Checker
        res_http = client.post(
            "/api/v1/tools/http-status-check",
            json={"url": "https://example.com"},
            headers=headers,
        )
        assert res_http.status_code == 200
        assert "chain" in res_http.json()

        # 3. security.txt Validator
        res_sec = client.post(
            "/api/v1/tools/security-txt-validate",
            json={"domain": "example.com"},
            headers=headers,
        )
        assert res_sec.status_code == 200
        assert "validation_status" in res_sec.json()

        # 4. Robots.txt & Sitemap Checker
        res_rob = client.post(
            "/api/v1/tools/robots-sitemap-check",
            json={"domain": "example.com"},
            headers=headers,
        )
        assert res_rob.status_code == 200
        assert "robots" in res_rob.json()

        # 5. CSP Policy Analyzer (Offline Paste Mode)
        res_csp = client.post(
            "/api/v1/tools/csp-policy-analyze",
            json={
                "mode": "paste",
                "policy": "default-src 'self'; script-src 'self'; object-src 'none';",
                "policy_type": "enforce",
            },
            headers=headers,
        )
        assert res_csp.status_code == 200
        csp_data = res_csp.json()
        assert csp_data.get("status") == "success"
        assert csp_data["metrics"]["quality_score"] > 80

    def test_public_resources_endpoint_available(self, client: TestClient):
        """Verifies GET /api/v1/resources responds with 200 and paginated structure."""
        res = client.get("/api/v1/resources?page_size=10")
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert "total" in data

    def test_public_blog_endpoint_available(self, client: TestClient):
        """Verifies GET /api/v1/blog/posts responds with 200 and paginated structure."""
        res = client.get("/api/v1/blog/posts?page_size=6")
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert "total" in data

    def test_telemetry_event_ingestion_for_resources_hub(self, client: TestClient):
        """Verifies that non-blocking telemetry events from Resources Hub are accepted with 200 OK."""
        headers = {"X-Forwarded-For": "198.51.100.202"}
        event_payload = {
            "event_name": "resource_view",
            "content_type": "tool",
            "content_id": "CSP Policy Analyzer",
            "source": "resources_hub_filters",
            "path": "/resources",
        }
        res = client.post(
            "/api/v1/analytics/events",
            json=event_payload,
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data.get("status") == "recorded"

    def test_invalid_telemetry_event_name_rejected(self, client: TestClient):
        """Verifies that unauthorized/invalid event names are safely rejected."""
        headers = {"X-Forwarded-For": "198.51.100.203"}
        invalid_payload = {
            "event_name": "unauthorized_tracking_event",
            "content_type": "exploit",
            "content_id": "malicious",
            "source": "unknown",
        }
        res = client.post(
            "/api/v1/analytics/events",
            json=invalid_payload,
            headers=headers,
        )
        assert res.status_code == 400

    def test_ssrf_protection_rejects_internal_ip_targets(self, client: TestClient):
        """Verifies that standalone endpoints reject loopback IP targets at the schema layer."""
        headers = {"X-Forwarded-For": "198.51.100.204"}
        res = client.post(
            "/api/v1/tools/http-status-check",
            json={"url": "http://127.0.0.1"},
            headers=headers,
        )
        assert res.status_code == 422
        assert "Disallowed target" in res.text


class TestToolNavigationRegistry:
    """Verifies that all 9 tools and /resources are properly cataloged with verified routes."""

    EXPECTED_TOOL_ROUTES = {
        "/resources",
        "/tools/website-security-checker",
        "/tools/ssl-checker",
        "/tools/security-headers-checker",
        "/tools/email-security-checker",
        "/tools/dns-lookup",
        "/tools/http-status-checker",
        "/tools/security-txt-validator",
        "/tools/robots-sitemap-checker",
        "/tools/csp-policy-analyzer",
    }

    def test_sitemap_contains_all_preservation_routes(self):
        """Verifies that apps/web/src/app/sitemap.ts lists all 10 required routes."""
        sitemap_path = os.path.join(
            os.path.dirname(__file__), "..", "apps", "web", "src", "app", "sitemap.ts"
        )
        with open(sitemap_path, "r", encoding="utf-8") as f:
            content = f.read()

        for route in self.EXPECTED_TOOL_ROUTES:
            assert route in content, f"Missing route {route} in sitemap.ts"

    def test_faq_data_contains_six_required_questions(self):
        """Verifies that faqData.ts contains the 6 required questions specified in Phase 4."""
        faq_path = os.path.join(
            os.path.dirname(__file__),
            "..",
            "apps",
            "web",
            "src",
            "components",
            "resources",
            "faqData.ts",
        )
        with open(faq_path, "r", encoding="utf-8") as f:
            content = f.read()

        required_keywords = [
            "Are SiteSecura’s utility tools free?",
            "Do the tools require an account?",
            "What is the difference between an individual tool and a full website scan?",
            "Can I use the tools for a website I do not own?",
            "Do the tools guarantee that a website is secure?",
            "What should I do after a tool reports a problem?",
        ]
        for q in required_keywords:
            assert q in content, f"Missing FAQ question: {q}"

    def test_quick_tool_finder_contains_nine_prompts(self):
        """Verifies that QuickToolFinder.tsx contains the 9 objective prompts."""
        qtf_path = os.path.join(
            os.path.dirname(__file__),
            "..",
            "apps",
            "web",
            "src",
            "components",
            "resources",
            "QuickToolFinder.tsx",
        )
        with open(qtf_path, "r", encoding="utf-8") as f:
            content = f.read()

        prompts = [
            "Review website security",
            "Check SSL/TLS configuration",
            "Inspect security headers",
            "Verify SPF, DKIM & DMARC",
            "Check DNS records",
            "Inspect HTTP status & redirects",
            "Validate security.txt",
            "Check robots.txt & XML sitemaps",
            "Analyze a Content Security Policy",
        ]
        for p in prompts:
            assert p in content, f"Missing prompt: {p}"
