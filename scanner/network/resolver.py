"""
Scanly Scanner Engine - Safe DNS Resolver
Validates all resolved IP candidates against SSRF blocklists to prevent DNS rebinding.
"""
from abc import ABC, abstractmethod
import socket
from typing import Dict, List, Optional, Tuple
from .safety import is_safe_ip, SSRFValidationError, IP_REGEX


class BaseResolver(ABC):
    """Abstract interface for DNS hostname resolution."""

    @abstractmethod
    def resolve(self, hostname: str, port: int = 443) -> List[str]:
        """Resolves hostname to a list of validated IP addresses."""
        pass


class SafeResolver(BaseResolver):
    """
    Authoritative production resolver.
    Queries DNS for A and AAAA records, evaluates every address candidate against SSRF rules,
    and returns only approved public IP addresses.
    """

    def __init__(self, timeout: float = 5.0):
        self.timeout = timeout

    def resolve(self, hostname: str, port: int = 443) -> List[str]:
        """
        Resolves hostname and verifies every candidate address is safe.
        Raises SSRFValidationError if resolution fails or resolves to any unsafe IP.
        """
        clean_host = hostname.strip().lower().rstrip(".")

        # If hostname is already a literal IP address
        if IP_REGEX.match(clean_host) or (clean_host.startswith("[") and clean_host.endswith("]")):
            is_safe, reason = is_safe_ip(clean_host)
            if not is_safe:
                raise SSRFValidationError(
                    f"Target IP '{clean_host}' is prohibited: {reason}"
                )
            return [clean_host.strip("[]")]

        try:
            # Resolve IPv4 and IPv6 addresses via getaddrinfo
            addr_info = socket.getaddrinfo(
                clean_host,
                port,
                family=socket.AF_UNSPEC,
                proto=socket.IPPROTO_TCP,
            )
            if not addr_info:
                raise SSRFValidationError(f"Could not resolve DNS records for '{clean_host}'.")

            # Extract distinct IP strings
            resolved_ips = []
            seen = set()
            for item in addr_info:
                ip = item[4][0]
                if ip not in seen:
                    seen.add(ip)
                    resolved_ips.append(ip)

        except socket.gaierror as e:
            raise SSRFValidationError(f"DNS resolution failed for '{clean_host}': {str(e)}")

        if not resolved_ips:
            raise SSRFValidationError(f"No IP addresses resolved for '{clean_host}'.")

        # Validate EVERY resolved address
        for ip in resolved_ips:
            is_safe, reason = is_safe_ip(ip)
            if not is_safe:
                raise SSRFValidationError(
                    f"Domain '{clean_host}' resolved to prohibited IP address {ip}: {reason}"
                )

        return resolved_ips

    def validate_addresses(self, addresses: List[str]) -> Tuple[bool, Optional[str]]:
        """Convenience method to check a list of IP addresses."""
        for ip in addresses:
            is_safe, reason = is_safe_ip(ip)
            if not is_safe:
                return False, f"Address {ip} is unsafe: {reason}"
        return True, None


class MockResolver(BaseResolver):
    """
    Deterministic mock resolver for testing.
    Can return static IP lists or simulate dynamic/rebinding responses.
    """

    def __init__(self, ip_map: Optional[Dict[str, List[str]]] = None):
        self.ip_map: Dict[str, List[str]] = ip_map or {}
        self.resolution_counts: Dict[str, int] = {}

    def set_host(self, hostname: str, ips: List[str]) -> None:
        self.ip_map[hostname.strip().lower()] = ips

    def resolve(self, hostname: str, port: int = 443) -> List[str]:
        clean_host = hostname.strip().lower().rstrip(".")
        self.resolution_counts[clean_host] = self.resolution_counts.get(clean_host, 0) + 1

        if clean_host in self.ip_map:
            ips = self.ip_map[clean_host]
        elif IP_REGEX.match(clean_host):
            ips = [clean_host]
        else:
            raise SSRFValidationError(f"Mock DNS lookup failed for '{clean_host}'")

        # Validate mock addresses according to same safety policy
        for ip in ips:
            is_safe, reason = is_safe_ip(ip)
            if not is_safe:
                raise SSRFValidationError(
                    f"Mock domain '{clean_host}' resolved to prohibited IP {ip}: {reason}"
                )

        return ips
