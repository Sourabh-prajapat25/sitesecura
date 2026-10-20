"""
Scanly Scanner Engine - Domain Validation & Strict SSRF Protection
Provides domain normalization and strict IP address filtering to prevent Server-Side Request Forgery.
"""
from typing import Optional, Tuple
from urllib.parse import urlparse

from .network.safety import (
    DOMAIN_REGEX,
    IP_REGEX,
    BLOCKED_IP_NETWORKS,
    BLOCKED_HOSTNAMES,
    SSRFValidationError,
    is_safe_ip,
)
from .network.resolver import BaseResolver, SafeResolver

__all__ = [
    "DOMAIN_REGEX",
    "IP_REGEX",
    "BLOCKED_IP_NETWORKS",
    "BLOCKED_HOSTNAMES",
    "SSRFValidationError",
    "normalize_domain",
    "is_safe_ip",
    "resolve_and_validate_target",
]


def normalize_domain(input_target: str) -> str:
    """
    Cleans and normalizes user domain input:
    - Trims whitespace
    - Strips http://, https://, trailing slashes, paths, and ports
    - Converts to lowercase
    - Returns standardized domain string
    """
    if not input_target:
        raise SSRFValidationError("Domain cannot be empty.")

    target = input_target.strip().lower()

    # If scheme is present, parse URL
    if target.startswith("http://") or target.startswith("https://"):
        parsed = urlparse(target)
        target = parsed.netloc or parsed.path
    elif "://" in target:
        raise SSRFValidationError(f"Unsupported URL scheme in target: {input_target}")

    # Remove trailing paths or query params if any
    if "/" in target:
        target = target.split("/")[0]

    # Remove port if specified
    if ":" in target and not target.startswith("["):  # not raw ipv6
        target = target.split(":")[0]

    target = target.strip().rstrip(".")

    if not target:
        raise SSRFValidationError("Invalid empty domain after normalization.")

    # Check for disallowed internal hostnames
    if target in BLOCKED_HOSTNAMES or any(target.endswith(f".{b}") for b in BLOCKED_HOSTNAMES):
        raise SSRFValidationError(f"Target '{target}' is a restricted local/internal hostname.")

    # Check if target is a raw IP address
    if IP_REGEX.match(target):
        is_safe, reason = is_safe_ip(target)
        if not is_safe:
            raise SSRFValidationError(f"Invalid target IP '{target}': {reason}")
        return target

    # Validate against standard FQDN regex
    if not DOMAIN_REGEX.match(target):
        raise SSRFValidationError(f"Target '{target}' is not a valid domain name format.")

    return target


def resolve_and_validate_target(domain: str, resolver: Optional[BaseResolver] = None) -> Tuple[str, str]:
    """
    Normalizes domain and performs authoritative DNS resolution to verify target IP is public.
    Returns (normalized_domain, resolved_ip).
    Raises SSRFValidationError if resolution fails or resolves to a private/forbidden IP.
    """
    normalized = normalize_domain(domain)

    # If target is already a verified public IP
    if IP_REGEX.match(normalized):
        return normalized, normalized

    safe_res = resolver or SafeResolver()
    approved_ips = safe_res.resolve(normalized, 443)
    if not approved_ips:
        raise SSRFValidationError(f"Could not resolve DNS records for {normalized}.")

    return normalized, approved_ips[0]
