"""
Scanly Scanner Engine - Safe Network Layer Models
Defines configuration, response, and cookie data structures.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any


@dataclass
class SafeNetworkConfig:
    """Centralized configuration for safe scanner network operations."""
    max_redirects: int = 5
    max_response_bytes: int = 1048576  # 1 MB
    connect_timeout: float = 5.0
    read_timeout: float = 5.0
    write_timeout: float = 5.0
    pool_timeout: float = 5.0
    total_timeout: float = 10.0
    user_agent: str = "ScanlySecurityBot/1.0 (+https://scanly.io)"


@dataclass
class SafeResponse:
    """Encapsulates bounded HTTP response data and redirect metadata."""
    status_code: Optional[int] = None
    url: str = ""
    final_url: Optional[str] = None
    headers: Dict[str, str] = field(default_factory=dict)
    raw_headers: List[Tuple[str, str]] = field(default_factory=list)
    cookies: Dict[str, str] = field(default_factory=dict)
    set_cookie_headers: List[str] = field(default_factory=list)
    text: str = ""
    bytes_read: int = 0
    is_truncated: bool = False
    redirect_chain: List[str] = field(default_factory=list)
    elapsed_ms: int = 0
    resolved_ip: Optional[str] = None
    error: Optional[str] = None

    @property
    def is_success(self) -> bool:
        return self.status_code is not None and 200 <= self.status_code < 400


@dataclass
class ParsedCookie:
    """Individual parsed cookie attributes."""
    name: str
    value: str
    secure: bool = False
    httponly: bool = False
    samesite: Optional[str] = None  # "Lax", "Strict", "None", or None
    domain: Optional[str] = None
    path: Optional[str] = None
    max_age: Optional[int] = None
    expires: Optional[str] = None
    raw: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "value": self.value,
            "secure": self.secure,
            "httponly": self.httponly,
            "samesite": self.samesite,
            "domain": self.domain,
            "path": self.path,
            "max_age": self.max_age,
            "expires": self.expires,
        }
