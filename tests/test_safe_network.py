"""
Automated Test Suite - Safe Network Layer & Security Hardening (Phase A.11 - A.16)
Tests:
- SSRF target matrix (valid, invalid, loopback, private IPv4/IPv6, link-local, metadata, unsupported schemes)
- Redirect SSRF protection (blocking redirects to 127.0.0.1, 10.0.0.1, 192.168.1.1, 169.254.169.254, ::1, file://, ftp://, data://)
- Relative and protocol-relative redirect handling
- DNS rebinding prevention and multi-IP validation (mixed public/private candidates)
- Response size limits (Content-Length and chunked streaming physical bounding)
- Redirect limits and redirect loop prevention
- Network timeouts (connection, read, slow response)
"""
import pytest
import sys
import os
import httpx

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scanner.network.models import SafeNetworkConfig, SafeResponse
from scanner.network.safety import (
    is_safe_ip,
    validate_hostname,
    validate_url_target,
    SSRFValidationError,
)
from scanner.network.resolver import SafeResolver, MockResolver
from scanner.network.http_client import SafeHttpClient


# ==============================================================================
# 1. SSRF TARGET MATRIX (Phase A.12)
# ==============================================================================

@pytest.mark.parametrize("valid_ip", [
    "1.1.1.1",
    "8.8.8.8",
    "93.184.216.34",
    "104.20.23.154",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
])
def test_ssrf_valid_public_ips(valid_ip):
    is_safe, reason = is_safe_ip(valid_ip)
    assert is_safe is True
    assert reason is None


@pytest.mark.parametrize("invalid_ip,expected_substring", [
    ("localhost", "Invalid IP"),
    ("127.0.0.1", "Loopback"),
    ("127.0.0.2", "Loopback"),
    ("127.100.0.1", "Loopback"),
    ("0.0.0.0", "Unspecified"),
    ("::1", "Loopback"),
    ("10.0.0.1", "Private"),
    ("10.254.254.1", "Private"),
    ("172.16.0.1", "Private"),
    ("172.31.255.255", "Private"),
    ("192.168.1.1", "Private"),
    ("192.168.100.50", "Private"),
    ("169.254.169.254", "Link-local"),
    ("169.254.1.1", "Link-local"),
    ("fc00::1", "Private"),
    ("fd12:3456:789a::1", "Private"),
    ("fe80::1", "Link-local"),
        ("::ffff:127.0.0.1", "Loopback"),
        ("::ffff:10.0.0.1", "Private"),
        ("::ffff:169.254.169.254", "Link-local"),
        ("224.0.0.1", "Multicast"),
        ("255.255.255.255", "Reserved"),
    ])
def test_ssrf_invalid_blocked_ips(invalid_ip, expected_substring):
    is_safe, reason = is_safe_ip(invalid_ip)
    assert is_safe is False
    assert expected_substring.lower() in (reason or "").lower()


@pytest.mark.parametrize("invalid_host", [
    "localhost",
    "localhost.localdomain",
    "local",
    "sub.local",
    "service.internal",
    "app.lan",
    "metadata.google.internal",
    "instance-data",
])
def test_ssrf_blocked_hostnames(invalid_host):
    with pytest.raises(SSRFValidationError):
        validate_hostname(invalid_host)


@pytest.mark.parametrize("invalid_scheme_url", [
    "file:///etc/passwd",
    "ftp://ftp.example.com/file",
    "gopher://example.com:70",
    "javascript:alert(1)",
    "data:text/html,<b>hi</b>",
    "dict://127.0.0.1:11211",
])
def test_ssrf_unsupported_schemes_rejected(invalid_scheme_url):
    with pytest.raises(SSRFValidationError) as exc:
        validate_url_target(invalid_scheme_url)
    assert "Unsupported URL scheme" in str(exc.value) or "Missing URL scheme" in str(exc.value)


# ==============================================================================
# 2. REDIRECT SSRF PROTECTION (Phase A.4 & A.12)
# ==============================================================================

@pytest.mark.parametrize("unsafe_redirect_target", [
    "http://127.0.0.1:8000/admin",
    "http://localhost/status",
    "http://10.0.0.1/router",
    "http://192.168.1.1/setup",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]:8080/internal",
    "http://[fc00::1]/private",
    "file:///etc/shadow",
    "ftp://files.example.com",
    "data:text/plain;base64,SGVsbG8=",
])
def test_redirect_ssrf_blocked(unsafe_redirect_target):
    """
    Simulates a public site returning a 302 redirect to an unsafe destination.
    The safe client must reject the destination before making any outbound connection.
    """
    def mock_handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/":
            return httpx.Response(302, headers={"Location": unsafe_redirect_target})
        return httpx.Response(200, text="Internal Secret")

    mock_transport = httpx.MockTransport(mock_handler)
    mock_resolver = MockResolver({
        "public-example.com": ["93.184.216.34"],
        "localhost": ["127.0.0.1"],
    })

    client = SafeHttpClient(
        resolver=mock_resolver,
        transport=mock_transport,
    )

    with pytest.raises(SSRFValidationError) as exc:
        client.get("http://public-example.com/")

    assert any(term in str(exc.value).lower() for term in [
        "prohibited", "restricted", "unsupported", "redirect to unsafe target"
    ])


def test_safe_https_redirect_allowed():
    """Validates that a legitimate HTTP -> HTTPS redirect chain succeeds."""
    def mock_handler(request: httpx.Request) -> httpx.Response:
        if request.url.scheme == "http":
            return httpx.Response(301, headers={"Location": "https://example.com/home"})
        return httpx.Response(200, text="Welcome to Secure Site")

    mock_transport = httpx.MockTransport(mock_handler)
    mock_resolver = MockResolver({"example.com": ["93.184.216.34"]})

    client = SafeHttpClient(resolver=mock_resolver, transport=mock_transport)
    resp = client.get("http://example.com/")

    assert resp.status_code == 200
    assert resp.final_url == "https://example.com/home"
    assert len(resp.redirect_chain) == 2
    assert "http://example.com/" in resp.redirect_chain[0]
    assert "https://example.com/home" in resp.redirect_chain[1]


def test_relative_redirect_resolved_safely():
    """Validates relative Location headers (e.g. '/login') are joined against current URL."""
    def mock_handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/":
            return httpx.Response(302, headers={"Location": "/login"})
        return httpx.Response(200, text="Login Page")

    mock_transport = httpx.MockTransport(mock_handler)
    mock_resolver = MockResolver({"example.com": ["93.184.216.34"]})

    client = SafeHttpClient(resolver=mock_resolver, transport=mock_transport)
    resp = client.get("https://example.com/")

    assert resp.status_code == 200
    assert resp.final_url == "https://example.com/login"


# ==============================================================================
# 3. DNS REBINDING PROTECTION (Phase A.3 & A.13)
# ==============================================================================

def test_dns_rebinding_mixed_ip_rejection():
    """
    If DNS returns both a public IP and an internal/private IP,
    the resolver must reject the target completely.
    """
    mock_resolver = MockResolver({
        "rebind-attack.com": ["93.184.216.34", "127.0.0.1"],
    })

    with pytest.raises(SSRFValidationError) as exc:
        mock_resolver.resolve("rebind-attack.com")
    assert "prohibited IP" in str(exc.value)


def test_dns_rebinding_simulated_switch():
    """
    Tests simulated DNS rebinding where a domain starts with a public IP
    then switches to a private IP on second lookup.
    """
    resolver = MockResolver()
    # First call is public
    resolver.set_host("attacker.com", ["93.184.216.34"])
    ips1 = resolver.resolve("attacker.com")
    assert ips1 == ["93.184.216.34"]

    # Second call attempts to resolve to private IP
    resolver.set_host("attacker.com", ["192.168.1.1"])
    with pytest.raises(SSRFValidationError) as exc:
        resolver.resolve("attacker.com")
    assert "prohibited IP" in str(exc.value)


# ==============================================================================
# 4. RESPONSE SIZE LIMITS (Phase A.6 & A.14)
# ==============================================================================

def test_response_size_within_limit_allowed():
    """Response smaller than max_response_bytes is read in full."""
    content = "A" * 500
    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=content, headers={"Content-Length": str(len(content))})

    mock_transport = httpx.MockTransport(mock_handler)
    mock_resolver = MockResolver({"example.com": ["93.184.216.34"]})
    config = SafeNetworkConfig(max_response_bytes=1000)

    client = SafeHttpClient(config=config, resolver=mock_resolver, transport=mock_transport)
    resp = client.get("https://example.com/")

    assert resp.status_code == 200
    assert resp.bytes_read == 500
    assert resp.is_truncated is False
    assert resp.text == content


def test_response_size_content_length_exceeded():
    """Content-Length exceeding limit is truncated to limit without unbounded memory."""
    content = "B" * 5000
    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=content, headers={"Content-Length": str(len(content))})

    mock_transport = httpx.MockTransport(mock_handler)
    mock_resolver = MockResolver({"example.com": ["93.184.216.34"]})
    config = SafeNetworkConfig(max_response_bytes=1000)

    client = SafeHttpClient(config=config, resolver=mock_resolver, transport=mock_transport)
    resp = client.get("https://example.com/")

    assert resp.status_code == 200
    assert resp.bytes_read == 1000
    assert resp.is_truncated is True
    assert len(resp.text) == 1000


def test_chunked_response_streaming_bounded():
    """Chunked streaming response without Content-Length is truncated at maximum bytes."""
    def mock_handler(request: httpx.Request) -> httpx.Response:
        # Simulate streaming chunks without content-length header
        def stream_generator():
            for _ in range(50):
                yield b"CHUNK_DATA_1234567890_"  # 22 bytes each, 1100 total
        return httpx.Response(200, content=stream_generator())

    mock_transport = httpx.MockTransport(mock_handler)
    mock_resolver = MockResolver({"example.com": ["93.184.216.34"]})
    config = SafeNetworkConfig(max_response_bytes=220)

    client = SafeHttpClient(config=config, resolver=mock_resolver, transport=mock_transport)
    resp = client.get("https://example.com/")

    assert resp.status_code == 200
    assert resp.bytes_read == 220
    assert resp.is_truncated is True


# ==============================================================================
# 5. REDIRECT LIMITS & LOOPS (Phase A.5 & A.15)
# ==============================================================================

def test_redirect_limit_enforced():
    """
    With max_redirects=3, 3 redirects succeed, but 4th redirect terminates
    with controlled 'Maximum redirect limit reached.' result.
    """
    def mock_handler(request: httpx.Request) -> httpx.Response:
        hop = int(request.url.path.strip("/") or "0")
        if hop < 4:
            return httpx.Response(302, headers={"Location": f"https://example.com/{hop + 1}"})
        return httpx.Response(200, text=f"Final hop {hop}")

    mock_transport = httpx.MockTransport(mock_handler)
    mock_resolver = MockResolver({"example.com": ["93.184.216.34"]})
    config = SafeNetworkConfig(max_redirects=3)

    client = SafeHttpClient(config=config, resolver=mock_resolver, transport=mock_transport)
    resp = client.get("https://example.com/0")

    assert resp.status_code is None
    assert "Maximum redirect limit reached." in (resp.error or "")


def test_redirect_within_configured_limit():
    """With max_redirects=3, a chain of 2 redirects completes successfully."""
    def mock_handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/0":
            return httpx.Response(302, headers={"Location": "https://example.com/1"})
        elif path == "/1":
            return httpx.Response(302, headers={"Location": "https://example.com/2"})
        return httpx.Response(200, text="Success")

    mock_transport = httpx.MockTransport(mock_handler)
    mock_resolver = MockResolver({"example.com": ["93.184.216.34"]})
    config = SafeNetworkConfig(max_redirects=3)

    client = SafeHttpClient(config=config, resolver=mock_resolver, transport=mock_transport)
    resp = client.get("https://example.com/0")

    assert resp.status_code == 200
    assert resp.final_url == "https://example.com/2"
    assert resp.error is None


def test_redirect_loop_detected():
    """A circular redirect chain (/a -> /b -> /a) is terminated safely."""
    def mock_handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/a":
            return httpx.Response(302, headers={"Location": "https://example.com/b"})
        elif request.url.path == "/b":
            return httpx.Response(302, headers={"Location": "https://example.com/a"})
        return httpx.Response(200, text="Never reached")

    mock_transport = httpx.MockTransport(mock_handler)
    mock_resolver = MockResolver({"example.com": ["93.184.216.34"]})

    client = SafeHttpClient(resolver=mock_resolver, transport=mock_transport)
    resp = client.get("https://example.com/a")

    assert resp.status_code is None
    assert "Redirect loop detected." in (resp.error or "")


# ==============================================================================
# 6. TIMEOUT HANDLING (Phase A.7 & A.16)
# ==============================================================================

def test_connection_timeout_handled_gracefully():
    """Verify connect timeout returns a clean controlled error without crashing."""
    def mock_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("Connection timed out after 5.0s")

    mock_transport = httpx.MockTransport(mock_handler)
    mock_resolver = MockResolver({"example.com": ["93.184.216.34"]})

    client = SafeHttpClient(resolver=mock_resolver, transport=mock_transport)
    resp = client.get("https://example.com/")

    assert resp.status_code is None
    assert "Target did not respond within the scanner timeout" in (resp.error or "")


def test_read_timeout_handled_gracefully():
    """Verify read timeout returns a clean controlled error without hanging."""
    def mock_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("Server took too long to send response headers")

    mock_transport = httpx.MockTransport(mock_handler)
    mock_resolver = MockResolver({"example.com": ["93.184.216.34"]})

    client = SafeHttpClient(resolver=mock_resolver, transport=mock_transport)
    resp = client.get("https://example.com/")

    assert resp.status_code is None
    assert "Target did not respond within the scanner timeout" in (resp.error or "")
