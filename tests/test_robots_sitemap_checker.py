"""
Tests for Standalone Robots.txt & Sitemap Checker (Phase 2D).
Validates RFC 9309 parser, sitemaps.org XML parser, SSRF controls,
safe connection pinning, and FastAPI endpoint integration.
"""
import pytest
from unittest.mock import MagicMock, patch
import httpx
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.schemas.tools import (
    RobotsSitemapCheckRequest,
    RobotsSitemapCheckResponse,
    RobotsUserAgentGroup,
)
from app.services.robots_sitemap_service import (
    parse_robots_txt,
    simulate_robots_path,
    safe_parse_sitemap_xml,
    execute_robots_sitemap_check_sync,
)
from scanner.network.resolver import BaseResolver
from apps.api.main import app

client = TestClient(app)


class MockResolver(BaseResolver):
    def __init__(self, ip_map=None):
        self.ip_map = ip_map or {"example.com": ["93.184.216.34"]}

    def resolve(self, host: str, port: int = 443):
        return self.ip_map.get(host, ["93.184.216.34"])


# ============================================================================
# 1. Domain Input & SSRF Validation Tests
# ============================================================================

class TestRobotsDomainValidation:
    def test_valid_domain(self):
        req = RobotsSitemapCheckRequest(domain="example.com")
        assert req.domain == "example.com"

    def test_valid_subdomain(self):
        req = RobotsSitemapCheckRequest(domain="blog.example.com")
        assert req.domain == "blog.example.com"

    def test_https_url_normalized_to_domain(self):
        req = RobotsSitemapCheckRequest(domain="https://example.com/robots.txt")
        assert req.domain == "example.com"

    def test_whitespace_stripped(self):
        req = RobotsSitemapCheckRequest(domain="  example.com  ")
        assert req.domain == "example.com"

    def test_empty_domain_rejected(self):
        with pytest.raises(ValidationError):
            RobotsSitemapCheckRequest(domain="")

    def test_embedded_credentials_rejected(self):
        with pytest.raises(ValidationError):
            RobotsSitemapCheckRequest(domain="admin:secret@example.com")

    def test_disallowed_scheme_rejected(self):
        with pytest.raises(ValidationError):
            RobotsSitemapCheckRequest(domain="ftp://example.com")

    def test_disallowed_port_rejected(self):
        with pytest.raises(ValidationError):
            RobotsSitemapCheckRequest(domain="example.com:8080")

    def test_loopback_rejected(self):
        with pytest.raises(ValidationError):
            RobotsSitemapCheckRequest(domain="127.0.0.1")

    def test_localhost_rejected(self):
        with pytest.raises(ValidationError):
            RobotsSitemapCheckRequest(domain="localhost")

    def test_cloud_metadata_rejected(self):
        with pytest.raises(ValidationError):
            RobotsSitemapCheckRequest(domain="169.254.169.254")

    def test_private_ip_rejected(self):
        with pytest.raises(ValidationError):
            RobotsSitemapCheckRequest(domain="10.0.0.1")


# ============================================================================
# 2. RFC 9309 Robots.txt Parser Tests
# ============================================================================

class TestRobotsTxtParser:
    def test_simple_user_agent_group(self):
        content = """
        User-agent: Googlebot
        Disallow: /private/
        Allow: /private/public.html
        Sitemap: https://example.com/sitemap.xml
        """
        groups, sitemaps, warnings = parse_robots_txt(content)
        assert len(groups) == 1
        assert groups[0].user_agents == ["Googlebot"]
        assert groups[0].disallows == ["/private/"]
        assert groups[0].allows == ["/private/public.html"]
        assert sitemaps == ["https://example.com/sitemap.xml"]
        assert len(warnings) == 0

    def test_multiple_user_agents_in_group(self):
        content = """
        User-agent: Googlebot
        User-agent: Bingbot
        Disallow: /admin/
        """
        groups, sitemaps, warnings = parse_robots_txt(content)
        assert len(groups) == 1
        assert groups[0].user_agents == ["Googlebot", "Bingbot"]
        assert groups[0].disallows == ["/admin/"]

    def test_multiple_consecutive_groups(self):
        content = """
        User-agent: BadBot
        Disallow: /

        User-agent: *
        Disallow: /admin/
        Allow: /
        """
        groups, sitemaps, warnings = parse_robots_txt(content)
        assert len(groups) == 2
        assert groups[0].user_agents == ["BadBot"]
        assert groups[0].disallows == ["/"]
        assert groups[1].user_agents == ["*"]
        assert groups[1].disallows == ["/admin/"]
        assert groups[1].allows == ["/"]

    def test_empty_disallow_allows_all(self):
        content = """
        User-agent: *
        Disallow:
        """
        groups, sitemaps, warnings = parse_robots_txt(content)
        assert len(groups) == 1
        assert groups[0].disallows == [""]

    def test_utf8_bom_and_inline_comments(self):
        content = "\ufeff# Main robots file\nUser-agent: * # default crawler\nDisallow: /temp/ # scratch directory\n"
        groups, sitemaps, warnings = parse_robots_txt(content)
        assert len(groups) == 1
        assert groups[0].user_agents == ["*"]
        assert groups[0].disallows == ["/temp/"]

    def test_case_insensitivity_and_crawl_delay(self):
        content = """
        USER-AGENT: Yandex
        DISALLOW: /cache/
        ALLOW: /cache/public/
        CRAWL-DELAY: 10
        HOST: example.com
        SITEMAP: https://example.com/sitemap-index.xml
        """
        groups, sitemaps, warnings = parse_robots_txt(content)
        assert len(groups) == 1
        assert groups[0].user_agents == ["Yandex"]
        assert groups[0].disallows == ["/cache/"]
        assert groups[0].allows == ["/cache/public/"]
        assert groups[0].other_directives.get("crawl_delay") == "10"
        assert groups[0].other_directives.get("host") == "example.com"
        assert sitemaps == ["https://example.com/sitemap-index.xml"]

    def test_multiple_sitemaps_deduplication(self):
        content = """
        User-agent: *
        Disallow: /
        Sitemap: https://example.com/sitemap1.xml
        Sitemap: https://example.com/sitemap2.xml
        Sitemap: https://example.com/sitemap1.xml
        """
        groups, sitemaps, warnings = parse_robots_txt(content)
        assert sitemaps == ["https://example.com/sitemap1.xml", "https://example.com/sitemap2.xml"]


# ============================================================================
# 3. RFC 9309 Path Testing Simulator Tests
# ============================================================================

class TestRobotsPathSimulator:
    def setup_method(self):
        self.groups = [
            RobotsUserAgentGroup(
                user_agents=["Googlebot"],
                allows=["/fish/public.html", "/fish/*.php"],
                disallows=["/fish/", "/*.gif$"],
            ),
            RobotsUserAgentGroup(
                user_agents=["*"],
                allows=["/public/"],
                disallows=["/admin/", "/private/"],
            ),
        ]

    def test_specific_user_agent_exact_match(self):
        allowed, rule, explanation = simulate_robots_path(self.groups, "Googlebot", "/fish/secret.html")
        assert allowed is False
        assert rule == "Disallow: /fish/"

    def test_wildcard_pattern_match(self):
        allowed, rule, explanation = simulate_robots_path(self.groups, "Googlebot", "/fish/test.php")
        assert allowed is True
        assert rule == "Allow: /fish/*.php"

    def test_end_anchor_pattern_match(self):
        allowed, rule, explanation = simulate_robots_path(self.groups, "Googlebot", "/images/logo.gif")
        assert allowed is False
        assert rule == "Disallow: /*.gif$"

    def test_longest_match_precedence(self):
        # /p is length 2, /page is length 5
        groups = [
            RobotsUserAgentGroup(
                user_agents=["*"],
                allows=["/page"],
                disallows=["/p"],
            )
        ]
        allowed, rule, explanation = simulate_robots_path(groups, "Googlebot", "/page123")
        assert allowed is True
        assert rule == "Allow: /page"

    def test_equal_specificity_allow_wins(self):
        # Equal length: RFC 9309 Section 2.2.2 dictates Allow takes precedence
        groups = [
            RobotsUserAgentGroup(
                user_agents=["*"],
                allows=["/test"],
                disallows=["/test"],
            )
        ]
        allowed, rule, explanation = simulate_robots_path(groups, "AnyBot", "/test")
        assert allowed is True
        assert rule == "Allow: /test"

    def test_fallback_to_wildcard_group(self):
        allowed, rule, explanation = simulate_robots_path(self.groups, "Bingbot", "/admin/settings")
        assert allowed is False
        assert rule == "Disallow: /admin/"

    def test_allowed_by_default_if_no_match(self):
        allowed, rule, explanation = simulate_robots_path(self.groups, "Bingbot", "/blog/post-1")
        assert allowed is True
        assert rule is None


# ============================================================================
# 4. Sitemap XML Parser Tests
# ============================================================================

class TestSitemapXmlParser:
    def test_valid_urlset(self):
        xml = b"""<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
                <loc>https://example.com/</loc>
                <lastmod>2026-10-01</lastmod>
                <changefreq>daily</changefreq>
                <priority>1.0</priority>
            </url>
            <url>
                <loc>https://example.com/about</loc>
                <changefreq>monthly</changefreq>
                <priority>0.8</priority>
            </url>
        </urlset>"""
        doc_type, sample_urls, child_sitemaps, findings = safe_parse_sitemap_xml(xml, "https://example.com/sitemap.xml", "example.com")
        assert doc_type == "urlset"
        assert len(sample_urls) == 2
        assert sample_urls[0].loc == "https://example.com/"
        assert sample_urls[0].lastmod == "2026-10-01"
        assert sample_urls[0].priority == 1.0
        assert len(child_sitemaps) == 0

    def test_valid_sitemapindex(self):
        xml = b"""<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <sitemap>
                <loc>https://example.com/sitemap-posts.xml</loc>
                <lastmod>2026-10-10T12:00:00Z</lastmod>
            </sitemap>
            <sitemap>
                <loc>https://example.com/sitemap-pages.xml</loc>
            </sitemap>
        </sitemapindex>"""
        doc_type, sample_urls, child_sitemaps, findings = safe_parse_sitemap_xml(xml, "https://example.com/sitemap.xml", "example.com")
        assert doc_type == "sitemapindex"
        assert len(child_sitemaps) == 2
        assert "https://example.com/sitemap-posts.xml" in child_sitemaps

    def test_dtd_entity_attack_rejected(self):
        xml = b"""<?xml version="1.0"?>
        <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
        <urlset><url><loc>&xxe;</loc></url></urlset>"""
        doc_type, sample_urls, child_sitemaps, findings = safe_parse_sitemap_xml(xml, "https://example.com/sitemap.xml", "example.com")
        assert doc_type == "unknown"
        assert any(f.code == "DTD_ENTITY_PROHIBITED" for f in findings)

    def test_malformed_xml_detected(self):
        xml = b"<urlset><url><loc>https://example.com"
        doc_type, sample_urls, child_sitemaps, findings = safe_parse_sitemap_xml(xml, "https://example.com/sitemap.xml", "example.com")
        assert doc_type == "unknown"
        assert any(f.code == "MALFORMED_XML" for f in findings)

    def test_insecure_http_location_warning(self):
        xml = b"""<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>http://example.com/insecure-page</loc></url>
        </urlset>"""
        doc_type, sample_urls, child_sitemaps, findings = safe_parse_sitemap_xml(xml, "https://example.com/sitemap.xml", "example.com")
        assert any(f.code == "INSECURE_HTTP_LOCATION" for f in findings)

    def test_cross_host_location_warning(self):
        xml = b"""<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://other-domain.com/page</loc></url>
        </urlset>"""
        doc_type, sample_urls, child_sitemaps, findings = safe_parse_sitemap_xml(xml, "https://example.com/sitemap.xml", "example.com")
        assert any(f.code == "CROSS_HOST_LOCATION" for f in findings)

    def test_invalid_lastmod_and_priority_range(self):
        xml = b"""<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
                <loc>https://example.com/page</loc>
                <lastmod>invalid-date-format</lastmod>
                <changefreq>every-second</changefreq>
                <priority>2.5</priority>
            </url>
        </urlset>"""
        doc_type, sample_urls, child_sitemaps, findings = safe_parse_sitemap_xml(xml, "https://example.com/sitemap.xml", "example.com")
        assert any(f.code == "INVALID_LASTMOD_FORMAT" for f in findings)
        assert any(f.code == "INVALID_CHANGEFREQ_VALUE" for f in findings)
        assert any(f.code == "INVALID_PRIORITY_RANGE" for f in findings)

    def test_duplicate_urls_warning(self):
        xml = b"""<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>https://example.com/home</loc></url>
            <url><loc>https://example.com/home</loc></url>
        </urlset>"""
        doc_type, sample_urls, child_sitemaps, findings = safe_parse_sitemap_xml(xml, "https://example.com/sitemap.xml", "example.com")
        assert any(f.code == "DUPLICATE_URLS_IN_SITEMAP" for f in findings)


# ============================================================================
# 5. Mock Transport & End-to-End Execution Tests
# ============================================================================

class TestRobotsSitemapExecution:
    def test_successful_robots_and_sitemap(self):
        def handler(request: httpx.Request) -> httpx.Response:
            url_str = str(request.url)
            if url_str.endswith("/robots.txt"):
                body = (
                    "User-agent: *\n"
                    "Disallow: /admin/\n"
                    "Sitemap: https://example.com/sitemap.xml\n"
                ).encode("utf-8")
                return httpx.Response(200, content=body, headers={"content-type": "text/plain"})
            elif url_str.endswith("/sitemap.xml"):
                body = (
                    b'<?xml version="1.0" encoding="UTF-8"?>\n'
                    b'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                    b'  <url><loc>https://example.com/</loc><priority>1.0</priority></url>\n'
                    b'  <url><loc>https://example.com/docs</loc><priority>0.8</priority></url>\n'
                    b'</urlset>'
                )
                return httpx.Response(200, content=body, headers={"content-type": "application/xml"})
            return httpx.Response(404)

        transport = httpx.MockTransport(handler)
        resolver = MockResolver()

        resp = execute_robots_sitemap_check_sync(
            domain="example.com",
            resolver=resolver,
            custom_transport=transport,
        )

        assert resp.domain == "example.com"
        assert resp.robots.retrieval_status == "success"
        assert resp.robots.is_valid is True
        assert len(resp.robots.groups) == 1
        assert resp.robots.sitemap_declarations == ["https://example.com/sitemap.xml"]
        assert len(resp.sitemaps) >= 1
        assert resp.sitemaps[0].validity_status == "valid"
        assert resp.summary.total_urls_discovered == 2
        assert resp.analysis_complete is True

    def test_robots_not_found_with_conventional_sitemap(self):
        def handler(request: httpx.Request) -> httpx.Response:
            url_str = str(request.url)
            if url_str.endswith("/robots.txt"):
                return httpx.Response(404, content=b"Not found")
            elif url_str.endswith("/sitemap.xml"):
                body = (
                    b'<?xml version="1.0" encoding="UTF-8"?>\n'
                    b'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                    b'  <url><loc>https://example.com/page1</loc></url>\n'
                    b'</urlset>'
                )
                return httpx.Response(200, content=body, headers={"content-type": "application/xml"})
            return httpx.Response(404)

        transport = httpx.MockTransport(handler)
        resp = execute_robots_sitemap_check_sync(
            domain="example.com",
            resolver=MockResolver(),
            custom_transport=transport,
        )

        assert resp.robots.retrieval_status == "not_found"
        assert resp.summary.has_robots_txt is False
        assert resp.sitemap_discovery.conventional_found is True
        assert any(f.code == "ROBOTS_NOT_FOUND" for f in resp.findings)

    def test_html_response_on_robots_txt(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, content=b"<!DOCTYPE html><html><body>Error 404</body></html>", headers={"content-type": "text/html"})

        transport = httpx.MockTransport(handler)
        resp = execute_robots_sitemap_check_sync(
            domain="example.com",
            resolver=MockResolver(),
            custom_transport=transport,
        )

        assert resp.robots.retrieval_status == "html_response"
        assert resp.robots.is_valid is False
        assert any(f.code == "ROBOTS_HTML_RESPONSE" for f in resp.findings)

    def test_external_sitemap_skipped_under_safe_origin_policy(self):
        def handler(request: httpx.Request) -> httpx.Response:
            url_str = str(request.url)
            if url_str.endswith("/robots.txt"):
                body = b"User-agent: *\nDisallow:\nSitemap: https://other-host.com/sitemap.xml\n"
                return httpx.Response(200, content=body)
            return httpx.Response(404)

        transport = httpx.MockTransport(handler)
        resp = execute_robots_sitemap_check_sync(
            domain="example.com",
            resolver=MockResolver(),
            custom_transport=transport,
        )

        assert "https://other-host.com/sitemap.xml" in resp.sitemap_discovery.external_urls_skipped
        ext_doc = next(d for d in resp.sitemaps if d.url == "https://other-host.com/sitemap.xml")
        assert ext_doc.retrieval_status == "not_fetched_external"


# ============================================================================
# 6. FastAPI Endpoint Tests
# ============================================================================

class TestRobotsSitemapEndpoint:
    @patch("app.api.v1.tools.execute_robots_sitemap_check")
    def test_successful_endpoint_call(self, mock_exec):
        mock_resp = RobotsSitemapCheckResponse(
            domain="example.com",
            target_url="https://example.com",
            checked_at="2026-10-11T12:00:00Z",
            duration_ms=45.2,
            robots={
                "requested_url": "https://example.com/robots.txt",
                "retrieval_status": "success",
                "is_valid": True,
                "groups": [],
                "sitemap_declarations": [],
                "warnings": [],
            },
            sitemap_discovery={
                "declared_urls": [],
                "conventional_checked": True,
                "conventional_found": False,
                "external_urls_skipped": [],
            },
            sitemaps=[],
            summary={
                "has_robots_txt": True,
                "robots_status": "success",
                "total_user_agent_groups": 0,
                "total_disallow_rules": 0,
                "total_allow_rules": 0,
                "sitemaps_declared_count": 0,
                "sitemaps_discovered_count": 0,
                "sitemaps_validated_count": 0,
                "total_urls_discovered": 0,
                "errors_count": 0,
                "warnings_count": 0,
                "info_count": 0,
                "analysis_complete": True,
            },
            findings=[],
            analysis_complete=True,
        )
        mock_exec.return_value = mock_resp

        res = client.post("/api/v1/tools/robots-sitemap-check", json={"domain": "example.com"})
        assert res.status_code == 200
        data = res.json()
        assert data["domain"] == "example.com"
        assert data["robots"]["retrieval_status"] == "success"

    def test_endpoint_rejects_invalid_domain(self):
        res = client.post("/api/v1/tools/robots-sitemap-check", json={"domain": "127.0.0.1"})
        assert res.status_code == 422
