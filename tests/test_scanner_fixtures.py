"""
Automated Test Suite - Scanner Fixture & Integration-Style Tests (Phase A.11 & A.17)
Tests end-to-end scanner execution with deterministic mock fixtures:
- HTTP 200 clean site
- HTTP -> HTTPS redirection
- Oversized response body handling
- Multiple cookies with mixed security attributes
- Failure isolation (HTTP timeout does not crash SSL or DNS checks)
- SSRF target rejection produces immediate structured ScanResult
"""
import pytest
import sys
import os
import httpx

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scanner.runner import run_security_scan
from scanner.network.models import SafeNetworkConfig
from scanner.network.resolver import MockResolver
from scanner.network.http_client import SafeHttpClient
from scanner.http_check import check_http_https
from scanner.models import CheckStatus, RiskLevel, ScanResult


def test_fixture_clean_https_website():
    """Deterministic fixture test: clean HTTPS website with all security headers."""
    headers = {
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        "Content-Security-Policy": "default-src 'self'",
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Server": "cloudflare",
    }
    html = "<div id='__next'>Clean Site</div>"

    def mock_handler(request: httpx.Request) -> httpx.Response:
        if request.url.scheme == "http":
            return httpx.Response(301, headers={"Location": f"https://clean-site.example.com{request.url.path}"})
        return httpx.Response(200, headers=headers, text=html)

    mock_transport = httpx.MockTransport(mock_handler)
    mock_resolver = MockResolver({"clean-site.example.com": ["93.184.216.34"]})
    config = SafeNetworkConfig()
    client = SafeHttpClient(config=config, resolver=mock_resolver, transport=mock_transport)

    http_res = check_http_https(
        "clean-site.example.com",
        client=client,
        config=config,
        resolver=mock_resolver,
    )

    data = http_res["http_data"]
    assert data["http_available"] is True
    assert data["https_available"] is True
    assert data["redirects_to_https"] is True
    assert data["headers"]["server"] == "cloudflare"
    assert "__next" in data["html_sample"]

    findings = http_res["findings"]
    assert any(f.check_type == "http_redirect" and f.status == CheckStatus.PASS for f in findings)
    assert any(f.check_type == "https_availability" and f.status == CheckStatus.PASS for f in findings)


def test_fixture_oversized_response_bounded():
    """Deterministic fixture test: response body of 500KB is bounded without unbounded memory."""
    huge_html = "<html><body>" + ("<div>content</div>" * 20000) + "</body></html>"  # ~400KB

    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=huge_html)

    mock_transport = httpx.MockTransport(mock_handler)
    mock_resolver = MockResolver({"huge-site.example.com": ["93.184.216.34"]})
    config = SafeNetworkConfig(max_response_bytes=10000)
    client = SafeHttpClient(config=config, resolver=mock_resolver, transport=mock_transport)

    http_res = check_http_https(
        "huge-site.example.com",
        client=client,
        config=config,
        resolver=mock_resolver,
    )

    data = http_res["http_data"]
    assert data["https_available"] is True
    # html_sample should be physically bounded
    assert len(data["html_sample"]) <= 10000


def test_fixture_multiple_cookies_captured():
    """Deterministic fixture test: multi-cookie headers are accurately captured and parsed."""
    def mock_handler(request: httpx.Request) -> httpx.Response:
        # Multiple Set-Cookie headers
        resp = httpx.Response(
            200,
            text="<html>Cookie Site</html>",
            headers=[
                ("Set-Cookie", "auth=secret1; Secure; HttpOnly; SameSite=Strict"),
                ("Set-Cookie", "theme=dark; Path=/"),
            ],
        )
        return resp

    mock_transport = httpx.MockTransport(mock_handler)
    mock_resolver = MockResolver({"cookie-site.example.com": ["93.184.216.34"]})
    client = SafeHttpClient(resolver=mock_resolver, transport=mock_transport)

    http_res = check_http_https(
        "cookie-site.example.com",
        client=client,
        resolver=mock_resolver,
    )

    set_cookie_headers = http_res["http_data"]["set_cookie_headers"]
    assert len(set_cookie_headers) == 2
    assert "auth=secret1" in set_cookie_headers[0]
    assert "theme=dark" in set_cookie_headers[1]


def test_failure_isolation_http_timeout_does_not_crash_runner():
    """
    Phase A.17 failure isolation:
    If HTTP connection times out, runner still returns partial ScanResult and does not raise exception.
    """
    mock_resolver = MockResolver({"timeout-site.example.com": ["93.184.216.34"]})
    config = SafeNetworkConfig(
        connect_timeout=0.01,
        read_timeout=0.01,
        total_timeout=0.05,
    )

    # Calling run_security_scan with very short timeout against non-routable port or mock
    res: ScanResult = run_security_scan(
        "timeout-site.example.com",
        timeout_seconds=0.05,
        config=config,
        resolver=mock_resolver,
    )

    assert isinstance(res, ScanResult)
    assert res.domain == "timeout-site.example.com"
    assert res.normalized_domain == "timeout-site.example.com"
    # Even if HTTP failed, score calculation completed deterministically
    assert 0 <= res.score <= 100
    assert res.risk_level in (RiskLevel.EXCELLENT, RiskLevel.GOOD, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL)


def test_ssrf_immediate_rejection_in_runner():
    """Verify that scanning an internal or loopback IP directly terminates immediately."""
    res: ScanResult = run_security_scan("127.0.0.1")
    assert res.score == 0
    assert res.risk_level == RiskLevel.CRITICAL
    assert res.target_ip is None
    assert len(res.findings) == 1
    assert res.findings[0].check_type == "domain_validation"
    assert "prohibited" in res.findings[0].summary.lower()
