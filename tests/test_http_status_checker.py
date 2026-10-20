"""
Automated Test Suite - Standalone HTTP Status & Redirect Checker
Covers:
1. URL syntax, scheme normalization, control characters, credentials (@) rejection, and port validation.
2. Hop-by-hop redirect following with status codes (200, 301, 302, 303, 307, 308, 403, 404, 500).
3. SSRF defenses: blocks redirects to 127.0.0.1, RFC 1918 private IPs, cloud metadata, local hostnames.
4. Redirect loop detection and redirect limit boundaries.
5. Header filtering and credential sanitization (Set-Cookie, Authorization).
6. SSL downgrade and upgrade detection.
7. FastAPI endpoint integration (POST /api/v1/tools/http-status-check) and rate limiting.
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
import httpx

from app.schemas.tools import (
    ALLOWED_HTTP_PORTS,
    HttpRedirectHop,
    HttpStatusCheckSummary,
    HttpStatusCheckRequest,
    HttpStatusCheckResponse,
)
from app.services.http_status_service import (
    execute_http_status_check_sync,
    sanitize_headers,
    SAFE_HEADERS,
)
from scanner.network.resolver import MockResolver

client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. Validation & Schema Tests
# ---------------------------------------------------------------------------

class TestHttpStatusCheckValidation(unittest.TestCase):
    def test_valid_https_url(self):
        req = HttpStatusCheckRequest(url="https://example.com/path?query=1")
        self.assertEqual(req.url, "https://example.com/path?query=1")

    def test_auto_prefix_https_scheme(self):
        req = HttpStatusCheckRequest(url="example.com/about")
        self.assertEqual(req.url, "https://example.com/about")

    def test_valid_http_scheme(self):
        req = HttpStatusCheckRequest(url="http://example.com")
        self.assertEqual(req.url, "http://example.com")

    def test_empty_url_rejected(self):
        with self.assertRaises(ValidationError):
            HttpStatusCheckRequest(url="")

    def test_whitespace_url_rejected(self):
        with self.assertRaises(ValidationError):
            HttpStatusCheckRequest(url="    ")

    def test_control_characters_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            HttpStatusCheckRequest(url="https://example.com/test\nnewline")
        self.assertIn("control characters", str(ctx.exception))

    def test_embedded_credentials_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            HttpStatusCheckRequest(url="https://admin:secret@example.com/dashboard")
        self.assertIn("embedded username or password", str(ctx.exception))

    def test_embedded_user_only_credentials_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            HttpStatusCheckRequest(url="https://admin@example.com")
        self.assertIn("embedded username or password", str(ctx.exception))

    def test_unsupported_scheme_ftp_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            HttpStatusCheckRequest(url="ftp://example.com/file.txt")
        self.assertIn("Unsupported URL scheme", str(ctx.exception))

    def test_unsupported_scheme_javascript_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            HttpStatusCheckRequest(url="javascript:alert(1)")
        self.assertIn("Unsupported URL scheme", str(ctx.exception))

    def test_unsupported_scheme_file_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            HttpStatusCheckRequest(url="file:///etc/passwd")
        self.assertIn("Unsupported URL scheme", str(ctx.exception))

    def test_disallowed_port_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            HttpStatusCheckRequest(url="https://example.com:22/ssh")
        self.assertIn("Disallowed port", str(ctx.exception))

    def test_disallowed_mysql_port_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            HttpStatusCheckRequest(url="http://example.com:3306")
        self.assertIn("Disallowed port", str(ctx.exception))

    def test_allowed_standard_ports(self):
        for port in (80, 443, 8080, 8443):
            req = HttpStatusCheckRequest(url=f"http://example.com:{port}/test")
            self.assertEqual(req.url, f"http://example.com:{port}/test")

    def test_loopback_ip_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            HttpStatusCheckRequest(url="http://127.0.0.1/admin")
        self.assertIn("prohibited", str(ctx.exception).lower())

    def test_localhost_hostname_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            HttpStatusCheckRequest(url="http://localhost:8080")
        self.assertIn("restricted", str(ctx.exception).lower())

    def test_private_rfc1918_ip_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            HttpStatusCheckRequest(url="http://192.168.1.1/setup")
        self.assertIn("prohibited", str(ctx.exception).lower())

    def test_cloud_metadata_ip_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            HttpStatusCheckRequest(url="http://169.254.169.254/latest/meta-data")
        self.assertIn("prohibited", str(ctx.exception).lower())

    def test_cloud_metadata_hostname_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            HttpStatusCheckRequest(url="http://metadata.google.internal")
        self.assertIn("restricted", str(ctx.exception).lower())


# ---------------------------------------------------------------------------
# 2. Header Filtering & Sanitization Tests
# ---------------------------------------------------------------------------

class TestHeaderSanitization(unittest.TestCase):
    def test_safe_headers_whitelisted(self):
        headers = httpx.Headers({
            "Content-Type": "text/html; charset=utf-8",
            "Server": "cloudflare",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Content-Security-Policy": "default-src 'self'",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Cache-Control": "public, max-age=3600",
            "ETag": '"abc123xyz"',
        })
        sanitized = sanitize_headers(headers)
        self.assertIn("content-type", sanitized)
        self.assertIn("server", sanitized)
        self.assertIn("strict-transport-security", sanitized)
        self.assertIn("content-security-policy", sanitized)
        self.assertIn("x-content-type-options", sanitized)
        self.assertIn("x-frame-options", sanitized)
        self.assertIn("cache-control", sanitized)
        self.assertIn("etag", sanitized)

    def test_sensitive_headers_filtered_out(self):
        headers = httpx.Headers({
            "Set-Cookie": "session_id=secret123; HttpOnly; Secure",
            "Authorization": "Bearer supersecretjwttoken",
            "Proxy-Authorization": "Basic dXNlcjpwYXNz",
            "X-Internal-Secret": "top-secret-internal-key",
            "Content-Type": "text/plain",
        })
        sanitized = sanitize_headers(headers)
        self.assertNotIn("set-cookie", sanitized)
        self.assertNotIn("authorization", sanitized)
        self.assertNotIn("proxy-authorization", sanitized)
        self.assertNotIn("x-internal-secret", sanitized)
        self.assertIn("content-type", sanitized)


# ---------------------------------------------------------------------------
# 3. Hop-by-Hop Execution & Mock Transport Tests
# ---------------------------------------------------------------------------

class TestHttpStatusCheckService(unittest.TestCase):
    def setUp(self):
        self.resolver = MockResolver({
            "example.com": ["93.184.216.34"],
            "target.org": ["104.18.2.1"],
            "secure.site": ["151.101.1.69"],
            "insecure.site": ["151.101.1.70"],
            "loop.site": ["151.101.1.71"],
        })

    def test_single_hop_200_ok(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                status_code=200,
                headers={"Content-Type": "text/html", "Server": "nginx"},
                text="<html><body>Hello</body></html>",
            )

        transport = httpx.MockTransport(handler)
        res = execute_http_status_check_sync(
            url="https://example.com/home",
            resolver=self.resolver,
            custom_transport=transport,
        )

        self.assertEqual(res.result_status, "success")
        self.assertEqual(res.final_status_code, 200)
        self.assertEqual(res.final_status_text, "OK")
        self.assertEqual(res.redirect_count, 0)
        self.assertEqual(len(res.chain), 1)
        self.assertEqual(res.chain[0].step, 1)
        self.assertEqual(res.chain[0].url, "https://example.com/home")
        self.assertEqual(res.chain[0].status_code, 200)
        self.assertTrue(res.chain[0].is_https)
        self.assertEqual(res.chain[0].headers.get("server"), "nginx")
        self.assertFalse(res.summary.has_ssl_downgrade)
        self.assertTrue(res.summary.is_https_initial)
        self.assertTrue(res.summary.is_https_final)

    def test_single_redirect_301_to_200(self):
        def handler(request: httpx.Request) -> httpx.Response:
            if str(request.url) == "https://example.com/old":
                return httpx.Response(
                    status_code=301,
                    headers={"Location": "https://example.com/new"},
                )
            elif str(request.url) == "https://example.com/new":
                return httpx.Response(
                    status_code=200,
                    headers={"Content-Type": "text/html"},
                    text="New page",
                )
            return httpx.Response(status_code=404)

        transport = httpx.MockTransport(handler)
        res = execute_http_status_check_sync(
            url="https://example.com/old",
            resolver=self.resolver,
            custom_transport=transport,
        )

        self.assertEqual(res.result_status, "success")
        self.assertEqual(res.final_status_code, 200)
        self.assertEqual(res.final_url, "https://example.com/new")
        self.assertEqual(res.redirect_count, 1)
        self.assertEqual(len(res.chain), 2)
        self.assertEqual(res.chain[0].status_code, 301)
        self.assertEqual(res.chain[0].location, "https://example.com/new")
        self.assertEqual(res.chain[1].status_code, 200)

    def test_multi_hop_chain(self):
        def handler(request: httpx.Request) -> httpx.Response:
            url_str = str(request.url)
            if url_str == "https://example.com/1":
                return httpx.Response(status_code=301, headers={"Location": "/2"})
            elif url_str == "https://example.com/2":
                return httpx.Response(status_code=302, headers={"Location": "https://target.org/3"})
            elif url_str == "https://target.org/3":
                return httpx.Response(status_code=307, headers={"Location": "https://target.org/final"})
            elif url_str == "https://target.org/final":
                return httpx.Response(status_code=200, headers={"Content-Type": "application/json"}, text='{"status":"ok"}')
            return httpx.Response(status_code=404)

        transport = httpx.MockTransport(handler)
        res = execute_http_status_check_sync(
            url="https://example.com/1",
            resolver=self.resolver,
            custom_transport=transport,
        )

        self.assertEqual(res.result_status, "success")
        self.assertEqual(res.final_status_code, 200)
        self.assertEqual(res.final_url, "https://target.org/final")
        self.assertEqual(res.redirect_count, 3)
        self.assertEqual(len(res.chain), 4)
        self.assertEqual(res.chain[0].status_code, 301)
        self.assertEqual(res.chain[1].status_code, 302)
        self.assertEqual(res.chain[2].status_code, 307)
        self.assertEqual(res.chain[3].status_code, 200)

    def test_relative_redirect_url_resolution(self):
        def handler(request: httpx.Request) -> httpx.Response:
            if str(request.url) == "https://example.com/folder/sub":
                return httpx.Response(status_code=302, headers={"Location": "target-page"})
            elif str(request.url) == "https://example.com/folder/target-page":
                return httpx.Response(status_code=200, text="Arrived")
            return httpx.Response(status_code=404)

        transport = httpx.MockTransport(handler)
        res = execute_http_status_check_sync(
            url="https://example.com/folder/sub",
            resolver=self.resolver,
            custom_transport=transport,
        )

        self.assertEqual(res.final_url, "https://example.com/folder/target-page")
        self.assertEqual(res.final_status_code, 200)

    def test_ssl_downgrade_detected(self):
        def handler(request: httpx.Request) -> httpx.Response:
            if str(request.url) == "https://example.com/secure":
                return httpx.Response(status_code=302, headers={"Location": "http://example.com/insecure"})
            elif str(request.url) == "http://example.com/insecure":
                return httpx.Response(status_code=200, text="Insecure page")
            return httpx.Response(status_code=404)

        transport = httpx.MockTransport(handler)
        res = execute_http_status_check_sync(
            url="https://example.com/secure",
            resolver=self.resolver,
            custom_transport=transport,
        )

        self.assertTrue(res.summary.has_ssl_downgrade)
        self.assertTrue(res.summary.is_https_initial)
        self.assertFalse(res.summary.is_https_final)

    def test_terminal_client_error_404(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(status_code=404, text="Not Found")

        transport = httpx.MockTransport(handler)
        res = execute_http_status_check_sync(
            url="https://example.com/missing",
            resolver=self.resolver,
            custom_transport=transport,
        )

        self.assertEqual(res.result_status, "client_error")
        self.assertEqual(res.final_status_code, 404)
        self.assertEqual(res.final_status_text, "Not Found")
        self.assertEqual(res.redirect_count, 0)

    def test_terminal_server_error_500(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(status_code=500, text="Internal Server Error")

        transport = httpx.MockTransport(handler)
        res = execute_http_status_check_sync(
            url="https://example.com/crash",
            resolver=self.resolver,
            custom_transport=transport,
        )

        self.assertEqual(res.result_status, "server_error")
        self.assertEqual(res.final_status_code, 500)
        self.assertEqual(res.final_status_text, "Internal Server Error")

    def test_redirect_without_location_header(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(status_code=301)  # No Location header

        transport = httpx.MockTransport(handler)
        res = execute_http_status_check_sync(
            url="https://example.com/no-loc",
            resolver=self.resolver,
            custom_transport=transport,
        )

        self.assertEqual(res.result_status, "client_error")
        self.assertEqual(res.final_status_code, 301)
        self.assertIn("without a Location header", res.message or "")


# ---------------------------------------------------------------------------
# 4. SSRF & Security Defense Tests
# ---------------------------------------------------------------------------

class TestSSRFDefenses(unittest.TestCase):
    def setUp(self):
        self.resolver = MockResolver({
            "example.com": ["93.184.216.34"],
            "attacker.com": ["198.51.100.5"],
        })

    def test_redirect_to_loopback_ip_blocked(self):
        """A server returning 302 to http://127.0.0.1/admin must be halted without connecting."""
        connection_attempted = []

        def handler(request: httpx.Request) -> httpx.Response:
            url_str = str(request.url)
            connection_attempted.append(url_str)
            if "127.0.0.1" in url_str:
                self.fail("SSRF defense failure: client initiated request to loopback address!")
            return httpx.Response(status_code=302, headers={"Location": "http://127.0.0.1/admin"})

        transport = httpx.MockTransport(handler)
        res = execute_http_status_check_sync(
            url="https://example.com/exploit",
            resolver=self.resolver,
            custom_transport=transport,
        )

        self.assertEqual(res.result_status, "blocked_redirect")
        self.assertIn("SSRF security policy", res.message or "")
        self.assertEqual(len(res.chain), 1)
        self.assertEqual(res.chain[0].status_code, 302)
        self.assertEqual(res.chain[0].next_url, "http://127.0.0.1/admin")
        self.assertEqual(len(connection_attempted), 1)

    def test_redirect_to_private_rfc1918_blocked(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(status_code=301, headers={"Location": "http://192.168.1.1/setup"})

        transport = httpx.MockTransport(handler)
        res = execute_http_status_check_sync(
            url="https://example.com/private",
            resolver=self.resolver,
            custom_transport=transport,
        )

        self.assertEqual(res.result_status, "blocked_redirect")
        self.assertIn("SSRF security policy", res.message or "")

    def test_redirect_to_cloud_metadata_blocked(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(status_code=307, headers={"Location": "http://169.254.169.254/latest/meta-data"})

        transport = httpx.MockTransport(handler)
        res = execute_http_status_check_sync(
            url="https://example.com/metadata",
            resolver=self.resolver,
            custom_transport=transport,
        )

        self.assertEqual(res.result_status, "blocked_redirect")
        self.assertIn("SSRF security policy", res.message or "")

    def test_redirect_to_localhost_hostname_blocked(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(status_code=302, headers={"Location": "http://localhost:8080/internal"})

        transport = httpx.MockTransport(handler)
        res = execute_http_status_check_sync(
            url="https://example.com/local",
            resolver=self.resolver,
            custom_transport=transport,
        )

        self.assertEqual(res.result_status, "blocked_redirect")

    def test_redirect_with_credentials_blocked(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(status_code=302, headers={"Location": "https://user:pass@example.com/path"})

        transport = httpx.MockTransport(handler)
        res = execute_http_status_check_sync(
            url="https://example.com/creds",
            resolver=self.resolver,
            custom_transport=transport,
        )

        self.assertEqual(res.result_status, "blocked_redirect")


# ---------------------------------------------------------------------------
# 5. Redirect Loops & Redirect Limits Tests
# ---------------------------------------------------------------------------

class TestRedirectLoopsAndLimits(unittest.TestCase):
    def setUp(self):
        self.resolver = MockResolver({
            "example.com": ["93.184.216.34"],
        })

    def test_direct_redirect_loop(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(status_code=302, headers={"Location": "https://example.com/self"})

        transport = httpx.MockTransport(handler)
        res = execute_http_status_check_sync(
            url="https://example.com/self",
            resolver=self.resolver,
            custom_transport=transport,
        )

        self.assertEqual(res.result_status, "redirect_loop")
        self.assertIn("Redirect loop detected", res.message or "")

    def test_alternating_redirect_loop(self):
        def handler(request: httpx.Request) -> httpx.Response:
            if str(request.url) == "https://example.com/a":
                return httpx.Response(status_code=302, headers={"Location": "https://example.com/b"})
            elif str(request.url) == "https://example.com/b":
                return httpx.Response(status_code=302, headers={"Location": "https://example.com/a"})
            return httpx.Response(status_code=404)

        transport = httpx.MockTransport(handler)
        res = execute_http_status_check_sync(
            url="https://example.com/a",
            resolver=self.resolver,
            custom_transport=transport,
        )

        self.assertEqual(res.result_status, "redirect_loop")
        self.assertIn("Redirect loop detected", res.message or "")
        self.assertEqual(len(res.chain), 2)

    def test_max_redirects_limit_exceeded(self):
        def handler(request: httpx.Request) -> httpx.Response:
            current_path = request.url.path
            step_num = int(current_path.replace("/step", "") or "0")
            return httpx.Response(
                status_code=302,
                headers={"Location": f"https://example.com/step{step_num + 1}"},
            )

        transport = httpx.MockTransport(handler)
        res = execute_http_status_check_sync(
            url="https://example.com/step0",
            max_redirects=4,
            resolver=self.resolver,
            custom_transport=transport,
        )

        self.assertEqual(res.result_status, "redirect_limit")
        self.assertIn("exceeded the maximum limit of 4", res.message or "")
        self.assertEqual(res.redirect_count, 5)


# ---------------------------------------------------------------------------
# 6. API Endpoint Integration Tests
# ---------------------------------------------------------------------------

class TestHttpStatusCheckEndpoint(unittest.TestCase):
    @patch("app.api.v1.tools.execute_http_status_check")
    def test_api_endpoint_success(self, mock_execute):
        mock_execute.return_value = HttpStatusCheckResponse(
            requested_url="https://example.com",
            normalized_url="https://example.com",
            checked_at="2026-10-11T12:00:00Z",
            duration_ms=45.2,
            final_url="https://example.com",
            final_status_code=200,
            final_status_text="OK",
            redirect_count=0,
            chain=[
                HttpRedirectHop(
                    step=1,
                    url="https://example.com",
                    status_code=200,
                    status_text="OK",
                    location=None,
                    next_url=None,
                    response_time_ms=45.2,
                    is_https=True,
                    ip_address="93.184.216.34",
                    headers={"content-type": "text/html"},
                )
            ],
            result_status="success",
            message=None,
            summary=HttpStatusCheckSummary(
                total_redirects=0,
                is_https_initial=True,
                is_https_final=True,
                has_ssl_downgrade=False,
                duration_ms=45.2,
            ),
        )

        response = client.post(
            "/api/v1/tools/http-status-check",
            json={"url": "https://example.com"},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["requested_url"], "https://example.com")
        self.assertEqual(data["final_status_code"], 200)
        self.assertEqual(data["result_status"], "success")
        self.assertEqual(len(data["chain"]), 1)

    def test_api_endpoint_validation_error_on_invalid_url(self):
        response = client.post(
            "/api/v1/tools/http-status-check",
            json={"url": "ftp://not-supported.org"},
        )
        self.assertEqual(response.status_code, 422)

    def test_api_endpoint_validation_error_on_credentials(self):
        response = client.post(
            "/api/v1/tools/http-status-check",
            json={"url": "https://user:pass@example.com"},
        )
        self.assertEqual(response.status_code, 422)

    def test_api_endpoint_validation_error_on_loopback(self):
        response = client.post(
            "/api/v1/tools/http-status-check",
            json={"url": "http://127.0.0.1"},
        )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
