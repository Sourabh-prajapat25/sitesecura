"""
Scanly Scanner Engine - JavaScript & Client-Side Exposure Analyzer (Phase F3)
Performs safe, bounded passive inspection of JavaScript assets, endpoint extraction,
SRI validation, client storage patterns, and dangerous DOM sinks.
"""
import hashlib
import re
from typing import List, Dict, Any, Tuple, Set, Optional
from urllib.parse import urlparse, urljoin

from scanner.network.http_client import SafeHttpClient
from scanner.models import Finding, CheckStatus, Severity
from .models import CrawledPage, ResourceItem
from .secrets import scan_text_for_secrets, scan_text_for_internal_ips_and_configs


# =============================================================================
# Third-Party Supply Chain Classification Registry
# =============================================================================

KNOWN_THIRD_PARTY_DOMAINS = {
    # Analytics & Telemetry
    "google-analytics.com": "analytics",
    "googletagmanager.com": "tag_manager",
    "hotjar.com": "analytics",
    "mixpanel.com": "analytics",
    "segment.io": "analytics",
    "clarity.ms": "analytics",
    "amplitude.com": "analytics",
    "posthog.com": "analytics",
    # Advertising & Pixels
    "doubleclick.net": "advertising",
    "adservice.google.com": "advertising",
    "connect.facebook.net": "advertising",
    "ads-twitter.com": "advertising",
    "tiktok.com": "advertising",
    # CDNs & Common Libraries
    "cdnjs.cloudflare.com": "cdn_library",
    "unpkg.com": "cdn_library",
    "cdn.jsdelivr.net": "cdn_library",
    "bootstrapcdn.com": "cdn_library",
    "ajax.googleapis.com": "cdn_library",
    "use.fontawesome.com": "cdn_library",
    # Customer Support & Communication
    "intercom.io": "support_chat",
    "zendesk.com": "support_chat",
    "drift.com": "support_chat",
    "crisp.chat": "support_chat",
    "tawk.to": "support_chat",
    # Monitoring & Error Tracking
    "browser.sentry-cdn.com": "monitoring",
    "js.sentry-cdn.com": "monitoring",
    "datadoghq-browser-agent.com": "monitoring",
    "logrocket.io": "monitoring",
    "bugsnag.com": "monitoring",
}

CDN_DOMAINS = {
    "cdnjs.cloudflare.com",
    "unpkg.com",
    "cdn.jsdelivr.net",
    "bootstrapcdn.com",
    "ajax.googleapis.com",
    "use.fontawesome.com",
}


def classify_third_party_host(host: str) -> str:
    """Classifies a third-party script hostname into a standard category."""
    host_lower = host.lower()
    for domain, cat in KNOWN_THIRD_PARTY_DOMAINS.items():
        if host_lower == domain or host_lower.endswith("." + domain):
            return cat
    return "unknown_third_party"


def is_cdn_host(host: str) -> bool:
    """Returns True if the host is a public open-source JavaScript CDN."""
    host_lower = host.lower()
    for cdn in CDN_DOMAINS:
        if host_lower == cdn or host_lower.endswith("." + cdn):
            return True
    return False


# =============================================================================
# Passive Endpoint & Route Extraction (Linear ReDoS Safe Patterns)
# =============================================================================

# Fast prechecks to avoid scanning if no endpoint patterns exist
ENDPOINT_PRECHECKS = ("/api/", "/rest/", "/v1/", "/v2/", "/graphql", "ws://", "wss://", "/admin", "/auth/", "/login")

REST_API_RE = re.compile(r"""(?:["'`])((?:/api/|/rest/|/v[1-9]/)[a-zA-Z0-9_\-\./?=&]{2,100})(?:["'`])""")
GRAPHQL_RE = re.compile(r"""(?:["'`])(/(?:api/)?graphql[a-zA-Z0-9_\-\./?=&]*)(?:["'`])|(?:\b(?:query|mutation)\s+([A-Za-z0-9_]{3,40})\s*\{)""")
WEBSOCKET_RE = re.compile(r"""(?:["'`])((?:wss?://)[a-zA-Z0-9_\-\.:/]{3,100})(?:["'`])""")
ADMIN_ROUTE_RE = re.compile(r"""(?:["'`])((?:/admin|/dashboard/admin|/internal/admin|/portal/admin)[a-zA-Z0-9_\-\./?=&]{0,80})(?:["'`])""")
AUTH_ROUTE_RE = re.compile(r"""(?:["'`])((?:/auth/|/oauth/|/login|/logout|/token|/refresh)[a-zA-Z0-9_\-\./?=&]{0,80})(?:["'`])""")
USER_ROUTE_RE = re.compile(r"""(?:["'`])((?:/users?/|/profile/|/account/)[a-zA-Z0-9_\-\./?=&]{0,80})(?:["'`])""")
PAYMENT_ROUTE_RE = re.compile(r"""(?:["'`])((?:/checkout|/billing|/stripe/|/payments?/)[a-zA-Z0-9_\-\./?=&]{0,80})(?:["'`])""")
INTERNAL_ROUTE_RE = re.compile(r"""(?:["'`])((?:/internal/|/private/|/debug/)[a-zA-Z0-9_\-\./?=&]{0,80})(?:["'`])""")


def categorize_endpoint(endpoint: str) -> str:
    """Categorizes an endpoint path into a high-level operational bucket."""
    ep_lower = endpoint.lower()
    if "ws://" in ep_lower or "wss://" in ep_lower:
        return "WEBSOCKET"
    if "graphql" in ep_lower:
        return "GRAPHQL"
    if any(ep_lower.startswith(p) or f"/{p}" in ep_lower for p in ("admin", "dashboard/admin", "portal/admin")):
        return "ADMIN"
    if any(kw in ep_lower for kw in ("auth", "login", "oauth", "token", "logout")):
        return "AUTH"
    if any(kw in ep_lower for kw in ("checkout", "billing", "stripe", "payment")):
        return "PAYMENT"
    if any(kw in ep_lower for kw in ("internal", "private", "debug")):
        return "INTERNAL"
    if any(kw in ep_lower for kw in ("user", "profile", "account")):
        return "USER"
    return "GENERAL_API"


def extract_endpoints_from_script(
    content: str,
    source_url: str,
    max_endpoints: int = 50,
) -> List[Dict[str, Any]]:
    """
    Passively extracts API endpoints, WebSocket URLs, and privileged routes
    from JavaScript text.
    """
    if not content or len(content) < 10:
        return []

    discovered: List[Dict[str, Any]] = []
    seen: Set[str] = set()

    # REST
    for m in REST_API_RE.finditer(content):
        ep = m.group(1).split("?")[0].rstrip("/")
        if ep not in seen and len(ep) > 3:
            seen.add(ep)
            discovered.append({
                "endpoint": ep,
                "category": categorize_endpoint(ep),
                "type": "REST",
                "source": source_url,
            })
            if len(discovered) >= max_endpoints:
                return discovered

    # WebSockets
    for m in WEBSOCKET_RE.finditer(content):
        ep = m.group(1).split("?")[0].rstrip("/")
        if ep not in seen:
            seen.add(ep)
            discovered.append({
                "endpoint": ep,
                "category": "WEBSOCKET",
                "type": "WEBSOCKET",
                "source": source_url,
            })
            if len(discovered) >= max_endpoints:
                return discovered

    # GraphQL
    for m in GRAPHQL_RE.finditer(content):
        ep = m.group(1) or m.group(2)
        if ep and ep not in seen:
            seen.add(ep)
            discovered.append({
                "endpoint": ep,
                "category": "GRAPHQL",
                "type": "GRAPHQL",
                "source": source_url,
            })
            if len(discovered) >= max_endpoints:
                return discovered

    # Admin
    for m in ADMIN_ROUTE_RE.finditer(content):
        ep = m.group(1).split("?")[0].rstrip("/")
        if ep not in seen and len(ep) >= 6:
            seen.add(ep)
            discovered.append({
                "endpoint": ep,
                "category": "ADMIN",
                "type": "ROUTE",
                "source": source_url,
            })
            if len(discovered) >= max_endpoints:
                return discovered

    # Auth
    for m in AUTH_ROUTE_RE.finditer(content):
        ep = m.group(1).split("?")[0].rstrip("/")
        if ep not in seen and len(ep) >= 5:
            seen.add(ep)
            discovered.append({
                "endpoint": ep,
                "category": "AUTH",
                "type": "ROUTE",
                "source": source_url,
            })
            if len(discovered) >= max_endpoints:
                return discovered

    return discovered


# =============================================================================
# Client-Side Storage & Token Security Inspection
# =============================================================================

STORAGE_SET_ITEM_RE = re.compile(
    r"""(?:localStorage|sessionStorage)\s*\.\s*setItem\s*\(\s*['"]([a-zA-Z0-9_\-\.:]+)['"]""",
    re.I
)

COOKIE_ASSIGN_RE = re.compile(
    r"""document\.cookie\s*=\s*['"](?:[^'";]*;)*\s*([a-zA-Z0-9_\-]+)\s*=""",
    re.I
)

SERVICE_WORKER_RE = re.compile(
    r"""navigator\.serviceWorker\s*\.\s*register\s*\(\s*['"]([^'"]+)['"]""",
    re.I
)

AUTH_KEY_WORDS = ("token", "jwt", "access_token", "auth", "id_token", "apikey", "api_key", "secret", "sessionid", "session_id")


def analyze_client_storage(
    content: str,
    source_url: str,
) -> Dict[str, Any]:
    """
    Detects insecure client-side authentication token storage in localStorage/sessionStorage,
    insecure document.cookie auth writes, and service worker registrations.
    """
    if not content:
        return {"items": [], "has_auth_tokens": False, "service_workers": []}

    detected_items: List[Dict[str, Any]] = []
    has_auth_tokens = False

    # localStorage / sessionStorage inspection
    for m in STORAGE_SET_ITEM_RE.finditer(content):
        storage_key = m.group(1)
        is_auth = any(kw in storage_key.lower() for kw in AUTH_KEY_WORDS)
        if is_auth:
            has_auth_tokens = True
        detected_items.append({
            "storage_type": "web_storage",
            "key": storage_key,
            "is_auth_related": is_auth,
            "source": source_url,
        })

    # document.cookie inspection
    for m in COOKIE_ASSIGN_RE.finditer(content):
        cookie_name = m.group(1)
        is_auth = any(kw in cookie_name.lower() for kw in AUTH_KEY_WORDS)
        if is_auth:
            has_auth_tokens = True
        detected_items.append({
            "storage_type": "document_cookie",
            "key": cookie_name,
            "is_auth_related": is_auth,
            "source": source_url,
        })

    # Service worker registration
    service_workers: List[str] = []
    for m in SERVICE_WORKER_RE.finditer(content):
        sw_path = m.group(1)
        service_workers.append(sw_path)

    return {
        "items": detected_items[:20],
        "has_auth_tokens": has_auth_tokens,
        "service_workers": service_workers[:5],
    }


# =============================================================================
# DOM Dangerous Sinks & Client-Side Security
# =============================================================================

DOM_SINKS = [
    {
        "name": "innerHTML",
        "pattern": re.compile(r"""\b(?:element|\$|this|[a-zA-Z0-9_]+)\s*\.\s*innerHTML\s*="""),
        "severity": "LOW",
        "description": "Direct assignment to innerHTML can lead to Cross-Site Scripting (XSS) if input is unescaped.",
    },
    {
        "name": "document.write",
        "pattern": re.compile(r"""\bdocument\s*\.\s*write(?:ln)?\s*\("""),
        "severity": "MEDIUM",
        "description": "document.write() bypasses HTML sanitization and impairs page rendering performance.",
    },
    {
        "name": "eval",
        "pattern": re.compile(r"""\beval\s*\("""),
        "severity": "HIGH",
        "description": "eval() executes arbitrary strings as code, presenting severe XSS and code injection risks.",
    },
    {
        "name": "Function constructor",
        "pattern": re.compile(r"""\bnew\s+Function\s*\("""),
        "severity": "MEDIUM",
        "description": "Dynamic Function constructor executes code strings similarly to eval().",
    },
]

POSTMESSAGE_LISTENER_RE = re.compile(r"""window\s*\.\s*addEventListener\s*\(\s*['"]message['"]""", re.I)
ORIGIN_CHECK_RE = re.compile(r"""\b(?:event|e)\s*\.\s*origin\b""")


def analyze_dom_security(
    content: str,
    source_url: str,
) -> Dict[str, Any]:
    """
    Passively scans JavaScript for dangerous DOM sinks (eval, document.write, innerHTML)
    and postMessage message handlers lacking origin verification.
    """
    if not content:
        return {"sinks": [], "postmessage_origin_missing": False}

    detected_sinks: List[Dict[str, Any]] = []

    for sink in DOM_SINKS:
        matches = list(sink["pattern"].finditer(content))
        if matches:
            detected_sinks.append({
                "sink": sink["name"],
                "count": len(matches),
                "severity": sink["severity"],
                "description": sink["description"],
                "source": source_url,
            })

    # Check for postMessage listener without origin check
    has_postmessage = bool(POSTMESSAGE_LISTENER_RE.search(content))
    has_origin_check = bool(ORIGIN_CHECK_RE.search(content)) if has_postmessage else True
    postmessage_missing_origin = has_postmessage and not has_origin_check

    return {
        "sinks": detected_sinks,
        "postmessage_detected": has_postmessage,
        "postmessage_origin_missing": postmessage_missing_origin,
    }
