"""
Scanly Scanner Engine - Deep Scan URL Normalization & Link Filtering
Enforces same-origin crawling boundaries, fragment stripping, canonicalization, and deduplication.
"""
import re
from typing import Optional, Set
from urllib.parse import urljoin, urlparse, urlunparse

# File extensions that are static non-HTML assets to avoid crawling as pages
NON_PAGE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp", ".tiff",
    ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z",
    ".mp3", ".mp4", ".wav", ".avi", ".mov", ".webm", ".mkv",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".css", ".js", ".map", ".json", ".xml", ".txt",
    ".exe", ".dmg", ".iso", ".bin",
}

IGNORED_SCHEMES = {"mailto", "tel", "javascript", "data", "whatsapp", "sms"}


def normalize_crawl_url(raw_url: str, base_url: str = "") -> Optional[str]:
    """
    Normalizes a link candidate:
    - Resolves relative URLs against base_url
    - Strips URL fragments (#section)
    - Converts scheme and host to lowercase
    - Normalizes default ports (:80, :443)
    - Strips trailing slash on non-root paths for consistent deduplication
    - Rejects invalid schemes (mailto, javascript, etc.)
    """
    if not raw_url or not isinstance(raw_url, str):
        return None

    clean = raw_url.strip()
    if not clean or clean.startswith("#"):
        return None

    # Resolve relative URL
    if base_url:
        try:
            clean = urljoin(base_url, clean)
        except Exception:
            return None

    try:
        parsed = urlparse(clean)
    except Exception:
        return None

    scheme = (parsed.scheme or "").lower()
    if scheme in IGNORED_SCHEMES or not scheme:
        return None

    if scheme not in ("http", "https"):
        return None

    hostname = (parsed.hostname or "").lower().rstrip(".")
    if not hostname:
        return None

    port = parsed.port
    # Omit default ports
    netloc = hostname
    if port and not ((scheme == "http" and port == 80) or (scheme == "https" and port == 443)):
        netloc = f"{hostname}:{port}"

    # Path normalization
    path = parsed.path or "/"
    # Clean multiple consecutive slashes
    path = re.sub(r"/+", "/", path)
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")

    # Sort query parameters for consistent deduplication
    query = parsed.query or ""

    normalized = urlunparse((scheme, netloc, path, "", query, ""))
    return normalized


def is_same_origin(url: str, target_domain: str, canonical_host: Optional[str] = None) -> bool:
    """
    Strict same-origin check for passive deep crawling:
    Allows target_domain and optional www-variant.
    Rejects third-party external origins.
    """
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower().rstrip(".")
    except Exception:
        return False

    norm_target = target_domain.lower().rstrip(".")
    if "://" in norm_target:
        try:
            norm_target = (urlparse(norm_target).hostname or norm_target).lower().rstrip(".")
        except Exception:
            pass
    allowed_hosts = {norm_target}

    if norm_target.startswith("www."):
        allowed_hosts.add(norm_target[4:])
    else:
        allowed_hosts.add(f"www.{norm_target}")

    if canonical_host:
        norm_canonical = canonical_host.lower().rstrip(".")
        allowed_hosts.add(norm_canonical)
        if norm_canonical.startswith("www."):
            allowed_hosts.add(norm_canonical[4:])
        else:
            allowed_hosts.add(f"www.{norm_canonical}")

    return host in allowed_hosts


def is_crawlable_page_url(url: str) -> bool:
    """
    Determines if URL is likely an HTML page and not a media, archive, or font asset.
    """
    try:
        parsed = urlparse(url)
        path = (parsed.path or "").lower()
    except Exception:
        return False

    # Check file extension
    for ext in NON_PAGE_EXTENSIONS:
        if path.endswith(ext):
            return False

    return True
 
 
# Aliases
normalize_url = normalize_crawl_url
is_crawlable_html_url = is_crawlable_page_url
