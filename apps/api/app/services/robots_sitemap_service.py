"""
Scanly API - Standalone Robots.txt & Sitemap Checker Service
Implements RFC 9309 Robots Exclusion Protocol & sitemaps.org XML validation:
- Safe HTTPS-only fetching with socket connection pinning (SafeSyncBackend + SafeResolver)
- Strict SSRF defenses (blocks loopback, private RFC 1918, link-local, cloud metadata)
- Parses robots.txt user-agent groups, allow/disallow rules, wildcard/end-anchor patterns
- Discovers declared sitemaps + conventional /sitemap.xml location
- Safe XML parsing (disallows DTD/entity expansion attacks)
- Validates both <urlset> and <sitemapindex> structures up to recursion depth 3
- Enforces same-host safe origin policy (does NOT fetch external cross-host sitemaps)
- Bounded response sizes: 512 KiB for robots.txt, 5 MiB for sitemaps, max 10 sitemaps
- Provides interactive RFC 9309 path testing capability
Does NOT invoke the full SiteSecura perimeter scanner.
"""
import asyncio
import logging
import re
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple, Any
from urllib.parse import urljoin, urlparse

import httpcore
import httpx
import xml.etree.ElementTree as ET

from app.schemas.tools import (
    ALLOWED_HTTP_PORTS,
    RobotsDirective,
    RobotsUserAgentGroup,
    RobotsTxtResult,
    SitemapItem,
    RobotsSitemapFinding,
    SitemapDocumentResult,
    SitemapDiscoverySummary,
    RobotsSitemapSummary,
    RobotsSitemapCheckResponse,
)
from scanner.network.safety import (
    validate_hostname,
    is_safe_ip,
    SSRFValidationError,
)
from scanner.network.resolver import BaseResolver, SafeResolver
from scanner.network.http_client import SafeSyncBackend

logger = logging.getLogger(__name__)

# Operational limits
MAX_ROBOTS_BYTES = 524288      # 512 KiB
MAX_SITEMAP_BYTES = 5242880    # 5 MiB
MAX_SITEMAP_DOCS = 10          # Maximum sitemaps processed per check
MAX_INDEX_DEPTH = 3            # Maximum sitemapindex recursion depth
MAX_SAMPLE_URLS = 100          # Maximum sample URLs retained for response
MAX_REDIRECTS = 5
DEFAULT_CONNECT_TIMEOUT = 3.0
DEFAULT_READ_TIMEOUT = 5.0

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SiteSecura-RobotsChecker/1.0"
)

# Valid change frequencies defined by sitemaps.org
VALID_CHANGEFREQS = {"always", "hourly", "daily", "weekly", "monthly", "yearly", "never"}

# W3C Datetime regex: YYYY-MM-DD or full ISO 8601
W3C_DATETIME_REGEX = re.compile(
    r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$"
)


def _safe_fetch_resource(
    target_url: str,
    resolver: BaseResolver,
    custom_transport: Optional[httpx.BaseTransport] = None,
    max_bytes: int = MAX_ROBOTS_BYTES,
    timeout: float = DEFAULT_READ_TIMEOUT,
    accept_header: str = "text/plain, text/*;q=0.9, */*;q=0.8",
) -> Tuple[str, Optional[int], Optional[str], Optional[int], Optional[bytes], Optional[str]]:
    """
    Safely retrieves an HTTP resource over HTTPS with socket-level connection pinning,
    SSRF verification, and manual redirect validation.
    Returns: (retrieval_status, http_status_code, content_type, content_length, body_bytes, error_message)
    """
    parsed = urlparse(target_url)
    if (parsed.scheme or "").lower() != "https":
        return ("blocked_target", None, None, None, None, "Resource must be accessed over secure HTTPS.")

    host = parsed.hostname
    if not host:
        return ("connection_error", None, None, None, None, "Invalid hostname.")

    port = parsed.port or 443
    if port not in ALLOWED_HTTP_PORTS:
        return ("blocked_target", None, None, None, None, f"Disallowed port '{port}'.")

    # Pre-resolve and verify safety of destination IP
    try:
        validated_host = validate_hostname(host)
        approved_ips = resolver.resolve(validated_host, port)
        if not approved_ips:
            return ("connection_error", None, None, None, None, f"Could not resolve IP for {validated_host}.")
    except SSRFValidationError as s_err:
        return ("blocked_target", None, None, None, None, f"SSRF Protection blocked destination: {str(s_err)}")
    except Exception as exc:
        return ("connection_error", None, None, None, None, f"DNS resolution failed: {str(exc)}")

    timeout_cfg = httpx.Timeout(
        connect=DEFAULT_CONNECT_TIMEOUT,
        read=timeout,
        write=timeout,
        pool=timeout,
    )

    req_headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": accept_header,
        "Connection": "close",
    }

    if custom_transport is not None:
        transport = custom_transport
    else:
        backend = SafeSyncBackend(resolver)
        pool = httpcore.ConnectionPool(
            network_backend=backend,
            max_connections=3,
            max_keepalive_connections=0,
        )
        transport = httpx.HTTPTransport()
        transport._pool = pool

    current_url = target_url
    redirect_count = 0
    visited_urls = []

    try:
        with httpx.Client(
            transport=transport,
            timeout=timeout_cfg,
            follow_redirects=False,
            headers=req_headers,
            verify=True,
        ) as client:
            while True:
                if current_url in visited_urls:
                    return ("connection_error", None, None, None, None, "Redirect loop detected.")

                visited_urls.append(current_url)

                req = client.build_request("GET", current_url)
                resp = client._send_single_request(req)

                status_code = resp.status_code
                content_type = resp.headers.get("content-type")

                # Handle redirects hop-by-hop
                if status_code in (301, 302, 303, 307, 308):
                    location = resp.headers.get("location")
                    resp.close()

                    if not location:
                        return ("not_found", status_code, content_type, None, None, "Redirect without Location header.")

                    redirect_count += 1
                    if redirect_count > MAX_REDIRECTS:
                        return ("connection_error", status_code, content_type, None, None, f"Exceeded redirect limit ({MAX_REDIRECTS}).")

                    next_url = urljoin(current_url, location.strip())
                    next_parsed = urlparse(next_url)
                    next_scheme = (next_parsed.scheme or "").lower()

                    if next_scheme != "https":
                        return (
                            "blocked_target",
                            status_code,
                            content_type,
                            None,
                            None,
                            "Redirect to unencrypted HTTP URL is blocked by security policy.",
                        )

                    next_host = next_parsed.hostname
                    if not next_host:
                        return ("blocked_target", status_code, content_type, None, None, "Redirect destination has no valid hostname.")

                    next_port = next_parsed.port or 443
                    if next_port not in ALLOWED_HTTP_PORTS:
                        return ("blocked_target", status_code, content_type, None, None, f"Redirect to disallowed port '{next_port}'.")

                    # Verify SSRF on redirect destination before connecting
                    try:
                        valid_next_host = validate_hostname(next_host)
                        next_ips = resolver.resolve(valid_next_host, next_port)
                        if not next_ips:
                            return ("blocked_target", status_code, content_type, None, None, f"Could not resolve destination {valid_next_host}.")
                    except (SSRFValidationError, ValueError) as ssrf_err:
                        return ("blocked_target", status_code, content_type, None, None, f"Redirect to unsafe destination blocked by SSRF policy: {str(ssrf_err)}")
                    except Exception as e:
                        return ("connection_error", status_code, content_type, None, None, f"DNS resolution failed for redirect: {str(e)}")

                    current_url = next_url
                    continue

                # Terminal response reached
                content_len_hdr = resp.headers.get("content-length")
                if content_len_hdr and content_len_hdr.isdigit() and int(content_len_hdr) > max_bytes:
                    resp.close()
                    return ("oversized", status_code, content_type, int(content_len_hdr), None, f"File exceeds maximum allowed size of {max_bytes} bytes.")

                # Stream response body bounded by max_bytes
                body_bytes = b""
                try:
                    for chunk in resp.iter_bytes(chunk_size=4096):
                        body_bytes += chunk
                        if len(body_bytes) > max_bytes:
                            resp.close()
                            return ("oversized", status_code, content_type, len(body_bytes), None, f"File content exceeded {max_bytes} bytes during streaming.")
                finally:
                    resp.close()

                actual_length = len(body_bytes)

                if status_code == 200:
                    return ("success", status_code, content_type, actual_length, body_bytes, None)
                elif status_code == 404:
                    return ("not_found", status_code, content_type, actual_length, body_bytes, "Resource not found (HTTP 404).")
                elif status_code == 403:
                    return ("forbidden", status_code, content_type, actual_length, body_bytes, "Access forbidden (HTTP 403).")
                elif status_code == 429:
                    return ("rate_limited", status_code, content_type, actual_length, body_bytes, "Target server returned HTTP 429 Too Many Requests.")
                elif status_code >= 500:
                    return ("server_error", status_code, content_type, actual_length, body_bytes, f"Target server returned HTTP {status_code}.")
                else:
                    return ("invalid_response", status_code, content_type, actual_length, body_bytes, f"Unexpected response HTTP {status_code}.")

    except (httpx.ConnectTimeout, httpx.ReadTimeout, httpcore.TimeoutException):
        return ("timeout", None, None, None, None, "Connection timed out.")
    except (httpx.ConnectError, httpcore.ConnectError) as conn_err:
        err_msg = str(conn_err)
        if "certificate" in err_msg.lower() or "ssl" in err_msg.lower():
            return ("tls_error", None, None, None, None, f"TLS certificate validation failed: {err_msg}")
        return ("connection_error", None, None, None, None, f"Failed to establish connection: {err_msg}")
    except Exception as exc:
        logger.error(f"Error fetching {target_url}: {exc}", exc_info=True)
        return ("connection_error", None, None, None, None, f"Retrieval error: {str(exc)}")


def parse_robots_txt(content: str) -> Tuple[List[RobotsUserAgentGroup], List[str], List[str]]:
    """
    Parses robots.txt text according to RFC 9309 specification.
    Returns: (groups, sitemap_declarations, warnings)
    """
    # Strip UTF-8 BOM if present
    text = content.removeprefix("\ufeff")

    groups: List[RobotsUserAgentGroup] = []
    sitemaps: List[str] = []
    warnings: List[str] = []

    current_uas: List[str] = []
    current_allows: List[str] = []
    current_disallows: List[str] = []
    current_other: Dict[str, str] = {}
    in_rules = False

    def flush_group():
        nonlocal current_uas, current_allows, current_disallows, current_other, in_rules
        if current_uas:
            groups.append(
                RobotsUserAgentGroup(
                    user_agents=list(current_uas),
                    allows=list(current_allows),
                    disallows=list(current_disallows),
                    other_directives=dict(current_other),
                )
            )
        current_uas = []
        current_allows = []
        current_disallows = []
        current_other = {}
        in_rules = False

    lines = text.splitlines()
    for line_num, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()

        # Skip empty lines
        if not line:
            continue

        # Handle comments
        if line.startswith("#"):
            continue

        # Strip inline comments (RFC 9309 Section 2.1)
        comment_idx = line.find("#")
        if comment_idx != -1:
            line = line[:comment_idx].strip()
            if not line:
                continue

        if ":" not in line:
            warnings.append(f"Line {line_num}: Missing directive separator ':' in '{raw_line.strip()}'")
            continue

        field, val = line.split(":", 1)
        directive_name = field.strip().lower()
        directive_val = val.strip()

        if directive_name == "user-agent":
            # If we were already parsing rules for a previous group, flush it now
            if in_rules:
                flush_group()
            if directive_val and directive_val not in current_uas:
                current_uas.append(directive_val)
        elif directive_name == "sitemap":
            # Sitemap directives are independent of user-agent groups
            if directive_val and directive_val not in sitemaps:
                sitemaps.append(directive_val)
        elif directive_name == "allow":
            if not current_uas:
                warnings.append(f"Line {line_num}: Allow directive appears before any User-agent declaration.")
            in_rules = True
            if directive_val:
                current_allows.append(directive_val)
        elif directive_name == "disallow":
            if not current_uas:
                warnings.append(f"Line {line_num}: Disallow directive appears before any User-agent declaration.")
            in_rules = True
            # Empty Disallow means "allow all" per RFC 9309 Section 2.2.1
            if directive_val:
                current_disallows.append(directive_val)
            else:
                current_disallows.append("")
        elif directive_name == "crawl-delay":
            in_rules = True
            current_other["crawl_delay"] = directive_val
        elif directive_name == "host":
            current_other["host"] = directive_val
        else:
            # Non-standard or extension directive
            current_other[directive_name] = directive_val

    flush_group()

    return groups, sitemaps, warnings


def _pattern_to_regex(pattern: str) -> re.Pattern:
    """
    Translates an RFC 9309 robots pattern with '*' wildcards and '$' end-anchors to regex.
    """
    # Unescape percent-encoding if needed, but RFC 9309 specifies octet-by-octet matching
    has_end_anchor = pattern.endswith("$")
    clean_pat = pattern[:-1] if has_end_anchor else pattern

    # Escape all regex metachars except *
    escaped = re.escape(clean_pat).replace(r"\*", ".*")

    # Prefix match by default, or exact match if end anchor
    if has_end_anchor:
        regex_str = f"^{escaped}$"
    else:
        regex_str = f"^{escaped}"

    return re.compile(regex_str)


def simulate_robots_path(
    groups: List[RobotsUserAgentGroup],
    user_agent: str,
    path: str,
) -> Tuple[bool, Optional[str], str]:
    """
    Tests a path against parsed robots.txt rules for a specific user-agent using RFC 9309 semantics.
    Returns: (is_allowed: bool, matching_rule: Optional[str], explanation: str)
    """
    target_ua = user_agent.strip().lower()
    clean_path = path.strip()
    if not clean_path.startswith("/"):
        clean_path = "/" + clean_path

    # Step 1: Find matching group (exact match first, wildcard '*' fallback)
    selected_group: Optional[RobotsUserAgentGroup] = None

    # Exact token match
    for g in groups:
        for ua in g.user_agents:
            if ua.strip().lower() == target_ua:
                selected_group = g
                break
        if selected_group:
            break

    # Wildcard fallback
    if not selected_group:
        for g in groups:
            for ua in g.user_agents:
                if ua.strip().lower() == "*":
                    selected_group = g
                    break
            if selected_group:
                break

    # If no matching group, path is allowed by default
    if not selected_group:
        return (True, None, f"No matching rule group found for user-agent '{user_agent}'. Access is allowed by default.")

    # Step 2: Evaluate matching rules
    # An empty Disallow means allow all
    best_match_rule: Optional[str] = None
    best_match_length: int = -1
    best_is_allow: bool = True

    # Check Allow rules
    for allow_pat in selected_group.allows:
        if not allow_pat:
            continue
        try:
            rx = _pattern_to_regex(allow_pat)
            if rx.search(clean_path):
                rule_len = len(allow_pat)
                if rule_len > best_match_length:
                    best_match_length = rule_len
                    best_match_rule = f"Allow: {allow_pat}"
                    best_is_allow = True
                elif rule_len == best_match_length:
                    # RFC 9309 Section 2.2.2: If equal specificity, Allow takes precedence
                    best_match_rule = f"Allow: {allow_pat}"
                    best_is_allow = True
        except Exception:
            pass

    # Check Disallow rules
    for disallow_pat in selected_group.disallows:
        if not disallow_pat:
            # Empty disallow has length 0, allows all
            continue
        try:
            rx = _pattern_to_regex(disallow_pat)
            if rx.search(clean_path):
                rule_len = len(disallow_pat)
                if rule_len > best_match_length:
                    best_match_length = rule_len
                    best_match_rule = f"Disallow: {disallow_pat}"
                    best_is_allow = False
                elif rule_len == best_match_length:
                    # In case of equal length with an earlier disallow
                    pass
        except Exception:
            pass

    if best_match_rule is not None:
        if best_is_allow:
            return (True, best_match_rule, f"Path '{clean_path}' is explicitly allowed by rule '{best_match_rule}'.")
        else:
            return (False, best_match_rule, f"Path '{clean_path}' is blocked by rule '{best_match_rule}'.")

    return (True, None, f"No Disallow rule matched '{clean_path}'. Access is allowed by default.")


def safe_parse_sitemap_xml(
    xml_bytes: bytes,
    sitemap_url: str,
    base_host: str,
    max_sample_urls: int = MAX_SAMPLE_URLS,
) -> Tuple[str, List[SitemapItem], List[str], List[RobotsSitemapFinding]]:
    """
    Safely parses an XML sitemap document with security protections against entity expansion.
    Returns: (document_type, sample_urls, child_sitemaps, findings)
    """
    findings: List[RobotsSitemapFinding] = []
    sample_urls: List[SitemapItem] = []
    child_sitemaps: List[str] = []

    # XML Security Check: Reject DTD entity declarations
    xml_header = xml_bytes[:2048].lower()
    if b"<!doctype" in xml_header or b"<!entity" in xml_header:
        findings.append(
            RobotsSitemapFinding(
                code="DTD_ENTITY_PROHIBITED",
                severity="error",
                title="Prohibited XML DTD or Entity Declaration",
                message="The sitemap XML contains DTD or ENTITY declarations which are prohibited for security.",
                affected_item=sitemap_url,
                recommendation="Remove DTD and custom entity declarations from the XML sitemap.",
                reference="XML Security / RFC 3023",
            )
        )
        return ("unknown", [], [], findings)

    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as pe:
        findings.append(
            RobotsSitemapFinding(
                code="MALFORMED_XML",
                severity="error",
                title="Malformed Sitemap XML Syntax",
                message=f"XML parsing failed: {str(pe)}",
                affected_item=sitemap_url,
                recommendation="Ensure the sitemap is well-formed XML with properly closed tags.",
                reference="sitemaps.org protocol",
            )
        )
        return ("unknown", [], [], findings)

    # Strip XML namespace (e.g. {http://www.sitemaps.org/schemas/sitemap/0.9}urlset -> urlset)
    root_tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag

    seen_locs: Set[str] = set()
    duplicate_count = 0

    if root_tag == "urlset":
        doc_type = "urlset"
        for url_elem in root.findall(".//{*}url") or root.findall("url"):
            loc_elem = url_elem.find("{*}loc") if url_elem.find("{*}loc") is not None else url_elem.find("loc")
            if loc_elem is None or not loc_elem.text or not loc_elem.text.strip():
                findings.append(
                    RobotsSitemapFinding(
                        code="MISSING_LOC_ELEMENT",
                        severity="error",
                        title="Missing Mandatory <loc> Element",
                        message="A <url> entry does not contain a non-empty <loc> location tag.",
                        affected_item=sitemap_url,
                        recommendation="Every <url> entry in a sitemap must specify an absolute location URL in <loc>.",
                        reference="sitemaps.org protocol",
                    )
                )
                continue

            loc_val = loc_elem.text.strip()
            parsed_loc = urlparse(loc_val)

            # Check for duplicate URLs
            if loc_val in seen_locs:
                duplicate_count += 1
            seen_locs.add(loc_val)

            # Check URI scheme
            loc_scheme = (parsed_loc.scheme or "").lower()
            if loc_scheme not in ("http", "https"):
                findings.append(
                    RobotsSitemapFinding(
                        code="INVALID_URL_SCHEME",
                        severity="error",
                        title="Invalid URL Scheme in Sitemap",
                        message=f"Location '{loc_val}' uses unsupported scheme '{loc_scheme}'. Only HTTP and HTTPS are permitted.",
                        affected_item=loc_val,
                        recommendation="Use absolute https:// URLs in the sitemap.",
                        reference="sitemaps.org protocol",
                    )
                )

            # Flag insecure HTTP URLs
            if loc_scheme == "http":
                findings.append(
                    RobotsSitemapFinding(
                        code="INSECURE_HTTP_LOCATION",
                        severity="warning",
                        title="Insecure HTTP Location in Sitemap",
                        message=f"URL '{loc_val}' uses unencrypted HTTP instead of HTTPS.",
                        affected_item=loc_val,
                        recommendation="Update sitemap links to use canonical secure https:// URLs.",
                        reference="W3C / HTTPS Migration Best Practices",
                    )
                )

            # Check cross-host entries
            if parsed_loc.hostname and parsed_loc.hostname.lower() != base_host.lower():
                findings.append(
                    RobotsSitemapFinding(
                        code="CROSS_HOST_LOCATION",
                        severity="warning",
                        title="Cross-Origin Location in Sitemap",
                        message=f"URL '{loc_val}' points to host '{parsed_loc.hostname}' which differs from site domain '{base_host}'.",
                        affected_item=loc_val,
                        recommendation="Sitemaps should only list URLs belonging to the same host domain.",
                        reference="sitemaps.org site scope",
                    )
                )

            # Parse optional elements
            lastmod_elem = url_elem.find("{*}lastmod") if url_elem.find("{*}lastmod") is not None else url_elem.find("lastmod")
            lastmod_val = lastmod_elem.text.strip() if lastmod_elem is not None and lastmod_elem.text else None
            if lastmod_val and not W3C_DATETIME_REGEX.match(lastmod_val):
                findings.append(
                    RobotsSitemapFinding(
                        code="INVALID_LASTMOD_FORMAT",
                        severity="warning",
                        title="Invalid <lastmod> Date Format",
                        message=f"Value '{lastmod_val}' does not conform to W3C Datetime format (YYYY-MM-DD or ISO 8601).",
                        affected_item=loc_val,
                        recommendation="Use ISO 8601 format (e.g. 2026-10-11 or 2026-10-11T12:00:00Z).",
                        reference="sitemaps.org protocol",
                    )
                )

            changefreq_elem = url_elem.find("{*}changefreq") if url_elem.find("{*}changefreq") is not None else url_elem.find("changefreq")
            changefreq_val = changefreq_elem.text.strip().lower() if changefreq_elem is not None and changefreq_elem.text else None
            if changefreq_val and changefreq_val not in VALID_CHANGEFREQS:
                findings.append(
                    RobotsSitemapFinding(
                        code="INVALID_CHANGEFREQ_VALUE",
                        severity="warning",
                        title="Invalid <changefreq> Value",
                        message=f"Value '{changefreq_val}' is not one of: {', '.join(sorted(VALID_CHANGEFREQS))}.",
                        affected_item=loc_val,
                        recommendation=f"Use standard changefreq values ({', '.join(sorted(VALID_CHANGEFREQS))}).",
                        reference="sitemaps.org protocol",
                    )
                )

            priority_elem = url_elem.find("{*}priority") if url_elem.find("{*}priority") is not None else url_elem.find("priority")
            priority_val: Optional[float] = None
            if priority_elem is not None and priority_elem.text:
                try:
                    p_num = float(priority_elem.text.strip())
                    if 0.0 <= p_num <= 1.0:
                        priority_val = p_num
                    else:
                        findings.append(
                            RobotsSitemapFinding(
                                code="INVALID_PRIORITY_RANGE",
                                severity="warning",
                                title="Invalid <priority> Range",
                                message=f"Priority value '{priority_elem.text.strip()}' must be between 0.0 and 1.0.",
                                affected_item=loc_val,
                                recommendation="Specify priority as a float between 0.0 and 1.0.",
                                reference="sitemaps.org protocol",
                            )
                        )
                except ValueError:
                    findings.append(
                        RobotsSitemapFinding(
                            code="INVALID_PRIORITY_NUMBER",
                            severity="warning",
                            title="Non-Numeric <priority> Value",
                            message=f"Priority value '{priority_elem.text.strip()}' is not a valid number.",
                            affected_item=loc_val,
                            recommendation="Provide a decimal float between 0.0 and 1.0.",
                            reference="sitemaps.org protocol",
                        )
                    )

            if len(sample_urls) < max_sample_urls:
                sample_urls.append(
                    SitemapItem(
                        loc=loc_val,
                        lastmod=lastmod_val,
                        changefreq=changefreq_val,
                        priority=priority_val,
                    )
                )

        if duplicate_count > 0:
            findings.append(
                RobotsSitemapFinding(
                    code="DUPLICATE_URLS_IN_SITEMAP",
                    severity="warning",
                    title="Duplicate URL Entries in Sitemap",
                    message=f"Discovered {duplicate_count} duplicate URL entries in sitemap.",
                    affected_item=sitemap_url,
                    recommendation="Ensure each canonical URL is listed only once in the sitemap.",
                    reference="sitemaps.org protocol",
                )
            )

    elif root_tag == "sitemapindex":
        doc_type = "sitemapindex"
        for sitemap_elem in root.findall(".//{*}sitemap") or root.findall("sitemap"):
            loc_elem = sitemap_elem.find("{*}loc") if sitemap_elem.find("{*}loc") is not None else sitemap_elem.find("loc")
            if loc_elem is not None and loc_elem.text and loc_elem.text.strip():
                child_loc = loc_elem.text.strip()
                if child_loc not in child_sitemaps:
                    child_sitemaps.append(child_loc)
            else:
                findings.append(
                    RobotsSitemapFinding(
                        code="MISSING_INDEX_LOC_ELEMENT",
                        severity="error",
                        title="Missing <loc> in Sitemap Index Entry",
                        message="A <sitemap> entry in sitemapindex is missing a valid <loc> child tag.",
                        affected_item=sitemap_url,
                        recommendation="Ensure every <sitemap> index entry specifies the URL of the child sitemap.",
                        reference="sitemaps.org protocol",
                    )
                )
    else:
        doc_type = "unknown"
        findings.append(
            RobotsSitemapFinding(
                code="UNEXPECTED_ROOT_ELEMENT",
                severity="error",
                title=f"Unexpected XML Root Element <{root_tag}>",
                message=f"Sitemap root element is <{root_tag}>. Expected <urlset> or <sitemapindex>.",
                affected_item=sitemap_url,
                recommendation="XML sitemaps must have root element <urlset> or <sitemapindex>.",
                reference="sitemaps.org protocol",
            )
        )

    return (doc_type, sample_urls, child_sitemaps, findings)


def execute_robots_sitemap_check_sync(
    domain: str,
    resolver: Optional[BaseResolver] = None,
    custom_transport: Optional[httpx.BaseTransport] = None,
    timeout: float = DEFAULT_READ_TIMEOUT,
) -> RobotsSitemapCheckResponse:
    """
    Synchronous execution of standalone Robots.txt & Sitemap Checker.
    Enforces socket-level TCP connection pinning, SSRF checks, and bounded sitemap processing.
    """
    start_time = time.time()
    clean_domain = domain.strip().lower().rstrip(".")

    active_resolver = resolver if resolver is not None else SafeResolver()
    target_origin = f"https://{clean_domain}"
    robots_url = f"https://{clean_domain}/robots.txt"

    findings: List[RobotsSitemapFinding] = []
    sitemap_documents: List[SitemapDocumentResult] = []
    declared_sitemaps: List[str] = []
    external_skipped: List[str] = []
    conventional_checked = False
    conventional_found = False

    # 1. Fetch robots.txt
    retrieval_status, status_code, content_type, content_len, body_bytes, err_msg = _safe_fetch_resource(
        target_url=robots_url,
        resolver=active_resolver,
        custom_transport=custom_transport,
        max_bytes=MAX_ROBOTS_BYTES,
        timeout=timeout,
        accept_header="text/plain, text/*;q=0.9, */*;q=0.8",
    )

    parsed_groups: List[RobotsUserAgentGroup] = []
    robots_warnings: List[str] = []
    raw_robots_txt: Optional[str] = None
    is_robots_valid = False

    if retrieval_status == "success" and body_bytes is not None:
        try:
            raw_robots_txt = body_bytes.decode("utf-8", errors="replace")
        except Exception:
            raw_robots_txt = body_bytes.decode("latin-1", errors="replace")

        # HTML response check (e.g. 200 OK SPA error page)
        lowered_body = raw_robots_txt.strip().lower()
        if lowered_body.startswith("<!doctype html") or lowered_body.startswith("<html"):
            retrieval_status = "html_response"
            findings.append(
                RobotsSitemapFinding(
                    code="ROBOTS_HTML_RESPONSE",
                    severity="error",
                    title="Robots.txt Returned HTML Document",
                    message="The server returned an HTML webpage instead of a plaintext robots.txt file.",
                    affected_item=robots_url,
                    recommendation="Ensure /robots.txt serves plain text with Content-Type: text/plain.",
                    reference="RFC 9309 Section 2.1",
                )
            )
        else:
            is_robots_valid = True
            parsed_groups, declared_sitemaps, robots_warnings = parse_robots_txt(raw_robots_txt)

            if len(parsed_groups) == 0:
                findings.append(
                    RobotsSitemapFinding(
                        code="ROBOTS_NO_USER_AGENTS",
                        severity="warning",
                        title="No User-agent Declarations Found",
                        message="robots.txt was retrieved but contains no valid User-agent directive groups.",
                        affected_item=robots_url,
                        recommendation="Define at least one 'User-agent: *' group with appropriate crawl rules.",
                        reference="RFC 9309 Section 2.2.1",
                    )
                )
            else:
                findings.append(
                    RobotsSitemapFinding(
                        code="ROBOTS_VALID_GROUPS",
                        severity="success",
                        title="Valid RFC 9309 User-Agent Groups",
                        message=f"Successfully parsed {len(parsed_groups)} user-agent crawler rule group(s).",
                        affected_item=robots_url,
                        recommendation=None,
                        reference="RFC 9309 Section 2.2",
                    )
                )

            for w in robots_warnings:
                findings.append(
                    RobotsSitemapFinding(
                        code="ROBOTS_PARSER_WARNING",
                        severity="warning",
                        title="Robots.txt Syntax Warning",
                        message=w,
                        affected_item=robots_url,
                        recommendation="Review robots.txt directives for typos or missing colons.",
                        reference="RFC 9309",
                    )
                )
    elif retrieval_status == "not_found":
        findings.append(
            RobotsSitemapFinding(
                code="ROBOTS_NOT_FOUND",
                severity="info",
                title="No robots.txt File Found (HTTP 404)",
                message="The server returned HTTP 404. In the absence of robots.txt, compliant crawlers consider all URLs allowed.",
                affected_item=robots_url,
                recommendation="Publish a robots.txt file at /robots.txt to manage crawler access and declare your sitemaps.",
                reference="RFC 9309 Section 2.3.1",
            )
        )
    else:
        findings.append(
            RobotsSitemapFinding(
                code="ROBOTS_RETRIEVAL_ERROR",
                severity="error",
                title="Robots.txt Retrieval Failed",
                message=err_msg or f"Could not retrieve /robots.txt ({retrieval_status}).",
                affected_item=robots_url,
                recommendation="Ensure /robots.txt is accessible over HTTPS with proper permissions.",
                reference="RFC 9309",
            )
        )

    robots_result = RobotsTxtResult(
        requested_url=robots_url,
        effective_url=robots_url if retrieval_status == "success" else None,
        retrieval_status=retrieval_status,
        http_status_code=status_code,
        content_type=content_type,
        content_length=content_len,
        is_valid=is_robots_valid,
        groups=parsed_groups,
        sitemap_declarations=list(declared_sitemaps),
        raw_content=raw_robots_txt[:MAX_ROBOTS_BYTES] if raw_robots_txt else None,
        warnings=robots_warnings,
    )

    # 2. Sitemap Discovery
    # Collect discovery candidates
    sitemaps_to_fetch: List[Tuple[str, str, int]] = []  # (url, source, depth)
    seen_sitemap_urls: Set[str] = set()

    for s_url in declared_sitemaps:
        s_clean = s_url.strip()
        if s_clean not in seen_sitemap_urls:
            seen_sitemap_urls.add(s_clean)
            sitemaps_to_fetch.append((s_clean, "robots_txt", 0))

    # Also check conventional /sitemap.xml if not already in declared sitemaps
    conventional_url = f"https://{clean_domain}/sitemap.xml"
    if conventional_url not in seen_sitemap_urls:
        sitemaps_to_fetch.append((conventional_url, "conventional", 0))
        conventional_checked = True

    # 3. Process sitemaps iteratively within strict budget
    total_urls_counted = 0
    analysis_complete = True
    processed_count = 0

    while sitemaps_to_fetch and processed_count < MAX_SITEMAP_DOCS:
        s_url, s_source, s_depth = sitemaps_to_fetch.pop(0)
        processed_count += 1

        parsed_s_url = urlparse(s_url)
        s_host = parsed_s_url.hostname or ""

        # Same-host HTTPS policy: do NOT fetch external cross-host sitemaps
        if s_host.lower() != clean_domain.lower():
            external_skipped.append(s_url)
            sitemap_documents.append(
                SitemapDocumentResult(
                    url=s_url,
                    source=s_source,
                    document_type="unknown",
                    retrieval_status="not_fetched_external",
                    http_status_code=None,
                    content_type=None,
                    validity_status="not_fetched_external",
                    url_count=0,
                    child_sitemap_count=0,
                    child_sitemaps=[],
                    sample_urls=[],
                    findings=[
                        RobotsSitemapFinding(
                            code="CROSS_HOST_SITEMAP_NOT_FETCHED",
                            severity="info",
                            title="Cross-Origin Sitemap Not Fetched",
                            message=f"Sitemap points to external host '{s_host}'. For safety, external sitemaps are not fetched.",
                            affected_item=s_url,
                            recommendation="Host sitemaps on the same canonical domain as your website.",
                            reference="SiteSecura Safe-Origin Policy",
                        )
                    ],
                    analysis_complete=True,
                )
            )
            continue

        # Fetch sitemap over HTTPS
        s_retrieval, s_status, s_ct, s_len, s_bytes, s_err = _safe_fetch_resource(
            target_url=s_url,
            resolver=active_resolver,
            custom_transport=custom_transport,
            max_bytes=MAX_SITEMAP_BYTES,
            timeout=timeout,
            accept_header="application/xml, text/xml, */*;q=0.8",
        )

        if s_source == "conventional" and s_retrieval == "success":
            conventional_found = True

        if s_retrieval == "success" and s_bytes:
            doc_type, sample_items, child_urls, doc_findings = safe_parse_sitemap_xml(
                xml_bytes=s_bytes,
                sitemap_url=s_url,
                base_host=clean_domain,
                max_sample_urls=max(0, MAX_SAMPLE_URLS - total_urls_counted),
            )

            # Determine document validity status
            has_errors = any(f.severity == "error" for f in doc_findings)
            has_warnings = any(f.severity == "warning" for f in doc_findings)
            if has_errors:
                val_status = "invalid"
            elif has_warnings:
                val_status = "valid_with_warnings"
            else:
                val_status = "valid"

            total_urls_counted += len(sample_items)

            # If sitemapindex and within depth limit, enqueue child sitemaps
            if doc_type == "sitemapindex" and s_depth < MAX_INDEX_DEPTH:
                for child_u in child_urls:
                    if child_u not in seen_sitemap_urls and len(sitemaps_to_fetch) + processed_count < MAX_SITEMAP_DOCS:
                        seen_sitemap_urls.add(child_u)
                        sitemaps_to_fetch.append((child_u, "index_child", s_depth + 1))

            sitemap_documents.append(
                SitemapDocumentResult(
                    url=s_url,
                    source=s_source,
                    document_type=doc_type,
                    retrieval_status=s_retrieval,
                    http_status_code=s_status,
                    content_type=s_ct,
                    validity_status=val_status,
                    url_count=len(sample_items),
                    child_sitemap_count=len(child_urls),
                    child_sitemaps=child_urls,
                    sample_urls=sample_items,
                    findings=doc_findings,
                    analysis_complete=True,
                )
            )
            findings.extend(doc_findings)
        else:
            # Handle retrieval failure for sitemap
            # For conventional sitemap, 404 is normal/info; for declared sitemap, it's an error
            is_declared = s_source in ("robots_txt", "index_child")
            finding_severity = "error" if is_declared else "info"

            fail_finding = RobotsSitemapFinding(
                code="SITEMAP_RETRIEVAL_FAILED" if is_declared else "CONVENTIONAL_SITEMAP_NOT_FOUND",
                severity=finding_severity,
                title=f"Declared Sitemap Inaccessible ({s_retrieval})" if is_declared else "Conventional /sitemap.xml Not Found",
                message=s_err or f"Failed to retrieve sitemap {s_url} (HTTP {s_status or 'N/A'}).",
                affected_item=s_url,
                recommendation="Ensure the sitemap URL published in robots.txt returns HTTP 200 with valid XML.",
                reference="sitemaps.org protocol",
            )
            findings.append(fail_finding)

            sitemap_documents.append(
                SitemapDocumentResult(
                    url=s_url,
                    source=s_source,
                    document_type="unknown",
                    retrieval_status=s_retrieval,
                    http_status_code=s_status,
                    content_type=s_ct,
                    validity_status="retrieval_error",
                    url_count=0,
                    child_sitemap_count=0,
                    child_sitemaps=[],
                    sample_urls=[],
                    findings=[fail_finding],
                    analysis_complete=True,
                )
            )

    if sitemaps_to_fetch and processed_count >= MAX_SITEMAP_DOCS:
        analysis_complete = False
        findings.append(
            RobotsSitemapFinding(
                code="SITEMAP_LIMIT_REACHED",
                severity="info",
                title="Sitemap Processing Limit Reached",
                message=f"Encountered more than {MAX_SITEMAP_DOCS} sitemap documents. Remaining sitemaps were skipped to respect budget limits.",
                affected_item=clean_domain,
                recommendation="Ensure sitemaps are consolidated efficiently.",
                reference="SiteSecura Resource Limits",
            )
        )

    # Calculate overall summary metrics
    errors_count = sum(1 for f in findings if f.severity == "error")
    warnings_count = sum(1 for f in findings if f.severity == "warning")
    info_count = sum(1 for f in findings if f.severity == "info")

    total_disallows = sum(len(g.disallows) for g in parsed_groups)
    total_allows = sum(len(g.allows) for g in parsed_groups)
    validated_sitemaps = sum(1 for d in sitemap_documents if d.validity_status in ("valid", "valid_with_warnings"))

    duration_ms = (time.time() - start_time) * 1000.0

    discovery_summary = SitemapDiscoverySummary(
        declared_urls=declared_sitemaps,
        conventional_checked=conventional_checked,
        conventional_found=conventional_found,
        external_urls_skipped=external_skipped,
    )

    summary = RobotsSitemapSummary(
        has_robots_txt=is_robots_valid,
        robots_status=retrieval_status,
        total_user_agent_groups=len(parsed_groups),
        total_disallow_rules=total_disallows,
        total_allow_rules=total_allows,
        sitemaps_declared_count=len(declared_sitemaps),
        sitemaps_discovered_count=len(sitemap_documents),
        sitemaps_validated_count=validated_sitemaps,
        total_urls_discovered=total_urls_counted,
        errors_count=errors_count,
        warnings_count=warnings_count,
        info_count=info_count,
        analysis_complete=analysis_complete,
    )

    return RobotsSitemapCheckResponse(
        domain=clean_domain,
        target_url=target_origin,
        checked_at=datetime.now(timezone.utc).isoformat(),
        duration_ms=round(duration_ms, 2),
        robots=robots_result,
        sitemap_discovery=discovery_summary,
        sitemaps=sitemap_documents,
        summary=summary,
        findings=findings,
        analysis_complete=analysis_complete,
    )


async def execute_robots_sitemap_check(
    domain: str,
    resolver: Optional[BaseResolver] = None,
    custom_transport: Optional[httpx.BaseTransport] = None,
    timeout: float = DEFAULT_READ_TIMEOUT,
) -> RobotsSitemapCheckResponse:
    """Async wrapper executing the synchronous robots & sitemap validator in an executor."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None,
        execute_robots_sitemap_check_sync,
        domain,
        resolver,
        custom_transport,
        timeout,
    )
