"""
Scanly Scanner Engine - Safe Network Package
Centralized, security-aware network layer providing SSRF protection,
DNS rebinding prevention, streaming size enforcement, and bounded timeouts.
"""
from .models import SafeNetworkConfig, SafeResponse, ParsedCookie
from .safety import (
    is_safe_ip,
    validate_hostname,
    validate_url_target,
    SSRFValidationError,
    BLOCKED_IP_NETWORKS,
    BLOCKED_HOSTNAMES,
    ALLOWED_SCHEMES,
)
from .resolver import BaseResolver, SafeResolver, MockResolver
from .http_client import SafeHttpClient, SafeSyncBackend

__all__ = [
    "SafeNetworkConfig",
    "SafeResponse",
    "ParsedCookie",
    "is_safe_ip",
    "validate_hostname",
    "validate_url_target",
    "SSRFValidationError",
    "BLOCKED_IP_NETWORKS",
    "BLOCKED_HOSTNAMES",
    "ALLOWED_SCHEMES",
    "BaseResolver",
    "SafeResolver",
    "MockResolver",
    "SafeHttpClient",
    "SafeSyncBackend",
]
