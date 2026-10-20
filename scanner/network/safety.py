"""
Scanly Scanner Engine - Network Safety & SSRF Validation
Enforces strict address filtering to prevent Server-Side Request Forgery and internal probing.
"""
import ipaddress
import re
from typing import Optional, Tuple
from urllib.parse import urlparse

# Strict domain and IP regex
DOMAIN_REGEX = re.compile(
    r"^(?:[a-zA-Z0-9]"
    r"(?:[a-zA-Z0-9-_]{0,61}[a-zA-Z0-9])?\.)+"
    r"[a-zA-Z]{2,63}$"
)

IP_REGEX = re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")

# List of blocked private / reserved / cloud metadata networks
BLOCKED_IP_NETWORKS = [
    # IPv4 Private Networks (RFC 1918)
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    # IPv4 Loopback (RFC 1122)
    ipaddress.ip_network("127.0.0.0/8"),
    # IPv4 Link-Local & Cloud Metadata (RFC 3927)
    ipaddress.ip_network("169.254.0.0/16"),
    # IPv4 Carrier-Grade NAT (RFC 6598)
    ipaddress.ip_network("100.64.0.0/10"),
    # IPv4 Documentation & Test Networks (RFC 5737)
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
    # IPv4 Multicast & Reserved (RFC 5771, RFC 1112)
    ipaddress.ip_network("224.0.0.0/4"),
    ipaddress.ip_network("240.0.0.0/4"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("255.255.255.255/32"),
    # IPv6 Loopback & Link-Local & Unique Local
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("::/128"),
    ipaddress.ip_network("ff00::/8"),
    ipaddress.ip_network("2001:db8::/32"),
]

BLOCKED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "local",
    "internal",
    "lan",
    "home.arpa",
    "metadata.google.internal",
    "instance-data",
}

ALLOWED_SCHEMES = {"http", "https"}


class SSRFValidationError(ValueError):
    """Raised when an address or target fails SSRF safety validation."""
    pass


def is_safe_ip(ip_str: str) -> Tuple[bool, Optional[str]]:
    """
    Validates whether an IPv4 or IPv6 address is safe for outbound scanning.
    Rejects private, loopback, multicast, link-local, reserved, and cloud metadata ranges.
    Also handles IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1).
    """
    if not ip_str or not isinstance(ip_str, str):
        return False, "IP address cannot be empty."

    # Strip surrounding brackets for IPv6 if present
    clean_ip = ip_str.strip().strip("[]")

    try:
        ip_obj = ipaddress.ip_address(clean_ip)
    except ValueError:
        return False, f"Invalid IP address format: {ip_str}"

    # Handle IPv4-mapped IPv6 addresses (e.g. ::ffff:10.0.0.1)
    if ip_obj.version == 6 and ip_obj.ipv4_mapped:
        return is_safe_ip(str(ip_obj.ipv4_mapped))

    # Check standard attributes (most specific to least specific)
    if ip_obj.is_loopback:
        return False, "Loopback IP addresses (127.0.0.0/8, ::1) are strictly prohibited."
    if ip_obj.is_unspecified:
        return False, "Unspecified IP addresses (0.0.0.0, ::) are strictly prohibited."
    if ip_obj.is_link_local:
        return False, "Link-local IP addresses (169.254.0.0/16, fe80::/10) are strictly prohibited."
    if ip_obj.is_multicast:
        return False, "Multicast IP addresses are strictly prohibited."
    if ip_obj.is_reserved:
        return False, "Reserved IP addresses are strictly prohibited."
    if ip_obj.is_private:
        return False, "Private RFC 1918 / unique local IP addresses are strictly prohibited."

    # Explicit CIDR network match check
    for blocked_net in BLOCKED_IP_NETWORKS:
        if ip_obj in blocked_net:
            return False, f"IP belongs to restricted subnet: {blocked_net}"

    return True, None


def validate_hostname(hostname: str) -> str:
    """
    Validates and normalizes hostname string.
    Rejects restricted internal/local hostnames and checks format.
    """
    if not hostname:
        raise SSRFValidationError("Hostname cannot be empty.")

    host = hostname.strip().lower().rstrip(".")

    # Remove port if present
    if ":" in host and not host.startswith("["):
        host = host.split(":")[0]

    if not host:
        raise SSRFValidationError("Hostname cannot be empty after trimming.")

    # Check for disallowed internal hostnames
    if host in BLOCKED_HOSTNAMES or any(host.endswith(f".{b}") for b in BLOCKED_HOSTNAMES):
        raise SSRFValidationError(f"Target '{host}' is a restricted local/internal hostname.")

    # If raw IP, validate safety
    if IP_REGEX.match(host) or (host.startswith("[") and host.endswith("]")):
        is_safe, reason = is_safe_ip(host)
        if not is_safe:
            raise SSRFValidationError(f"Target IP '{host}' is not permitted: {reason}")
        return host

    # Validate against standard FQDN regex
    if not DOMAIN_REGEX.match(host):
        # Also check if it's a valid IPv6 literal
        try:
            ipaddress.ip_address(host)
            is_safe, reason = is_safe_ip(host)
            if not is_safe:
                raise SSRFValidationError(f"Target IP '{host}' is not permitted: {reason}")
            return host
        except ValueError:
            raise SSRFValidationError(f"Target '{host}' is not a valid domain name format.")

    return host


def validate_url_target(url_str: str) -> Tuple[str, str, int]:
    """
    Validates an outbound target URL:
    - Scheme must be strictly 'http' or 'https'
    - Hostname must be valid and non-internal
    - Resolves default port (80 for http, 443 for https)
    Returns: (scheme, hostname, port)
    Raises SSRFValidationError on invalid scheme or hostname.
    """
    if not url_str or not isinstance(url_str, str):
        raise SSRFValidationError("URL target cannot be empty.")

    parsed = urlparse(url_str.strip())
    scheme = (parsed.scheme or "").lower()

    if not scheme:
        raise SSRFValidationError(f"Missing URL scheme in '{url_str}'.")

    if scheme not in ALLOWED_SCHEMES:
        raise SSRFValidationError(
            f"Unsupported URL scheme '{scheme}'. Only HTTP and HTTPS are permitted."
        )

    host = parsed.hostname
    if not host:
        raise SSRFValidationError(f"Could not extract valid hostname from '{url_str}'.")

    validated_host = validate_hostname(host)

    # Determine port
    if parsed.port:
        port = parsed.port
    else:
        port = 443 if scheme == "https" else 80

    return scheme, validated_host, port
