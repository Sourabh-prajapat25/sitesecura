"""
Automated Test Suite - Domain Validation & SSRF Countermeasures
Verifies strict blocking of loopback, private IPv4/IPv6, cloud metadata, and malicious hostnames.
"""
import pytest
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scanner.domain import (
    normalize_domain,
    is_safe_ip,
    resolve_and_validate_target,
    SSRFValidationError,
)


def test_normalize_domain_valid():
    assert normalize_domain("example.com") == "example.com"
    assert normalize_domain("https://example.com/") == "example.com"
    assert normalize_domain("http://www.sub.example.com/path?param=1") == "www.sub.example.com"
    assert normalize_domain("EXAMPLE.COM") == "example.com"
    assert normalize_domain("example.co.uk") == "example.co.uk"


def test_normalize_domain_invalid():
    with pytest.raises(SSRFValidationError):
        normalize_domain("")

    with pytest.raises(SSRFValidationError):
        normalize_domain("ftp://example.com")

    with pytest.raises(SSRFValidationError):
        normalize_domain("localhost")

    with pytest.raises(SSRFValidationError):
        normalize_domain("internal.lan")


def test_ssrf_ip_filtering():
    # Loopback
    is_safe, _ = is_safe_ip("127.0.0.1")
    assert not is_safe
    is_safe, _ = is_safe_ip("127.0.1.5")
    assert not is_safe
    is_safe, _ = is_safe_ip("::1")
    assert not is_safe

    # Private IPv4 (RFC 1918)
    is_safe, _ = is_safe_ip("10.0.0.1")
    assert not is_safe
    is_safe, _ = is_safe_ip("172.16.5.10")
    assert not is_safe
    is_safe, _ = is_safe_ip("192.168.1.1")
    assert not is_safe

    # Cloud Metadata & Link-Local (RFC 3927)
    is_safe, _ = is_safe_ip("169.254.169.254")
    assert not is_safe
    is_safe, _ = is_safe_ip("169.254.1.1")
    assert not is_safe

    # Multicast & Broadcast
    is_safe, _ = is_safe_ip("224.0.0.1")
    assert not is_safe
    is_safe, _ = is_safe_ip("255.255.255.255")
    assert not is_safe
    is_safe, _ = is_safe_ip("0.0.0.0")
    assert not is_safe

    # Valid Public IPs (e.g. Cloudflare / Google DNS)
    is_safe, _ = is_safe_ip("1.1.1.1")
    assert is_safe
    is_safe, _ = is_safe_ip("8.8.8.8")
    assert is_safe
    is_safe, _ = is_safe_ip("93.184.216.34")
    assert is_safe
