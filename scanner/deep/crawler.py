"""
Scanly Scanner Engine - Deep Scan Passive HTML Crawler
Executes bounded breadth-first same-origin crawling with SSRF protection, strict timeouts,
and non-destructive metadata extraction.
"""
from collections import deque
from html.parser import HTMLParser
import re
import time
from typing import Dict, List, Optional, Set, Tuple, Any
from urllib.parse import urljoin, urlparse

from scanner.network.http_client import SafeHttpClient
from scanner.network.safety import SSRFValidationError
from .config import DeepScanConfig
from .models import CrawledPage, FormMetadata, ResourceItem
from .links import normalize_crawl_url, is_same_origin, is_crawlable_page_url
from .robots import is_path_disallowed_by_robots


class PageHtmlParser(HTMLParser):
    """
    Fast, resilient HTMLParser that extracts links, forms, scripts, styles, images, and title.
    Safely ignores malformed HTML tags without raising exceptions.
    """

    def __init__(self, base_url: str):
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.title: Optional[str] = None
        self.canonical_url: Optional[str] = None
        self.links: List[str] = []
        self.forms: List[Dict[str, Any]] = []
        self.resources: List[Dict[str, str]] = []
        self.source_map_hints: List[str] = []
        self.inline_scripts: List[str] = []

        self._in_title = False
        self._title_chunks: List[str] = []
        self._in_script = False
        self._script_chunks: List[str] = []
        self._current_form: Optional[Dict[str, Any]] = None

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]):
        tag_lower = tag.lower()
        attr_dict = {k.lower(): (v or "") for k, v in attrs}

        # 1. Title
        if tag_lower == "title":
            self._in_title = True

        # 2. Canonical
        elif tag_lower == "link":
            rel = attr_dict.get("rel", "").lower()
            href = attr_dict.get("href", "")
            if "canonical" in rel and href:
                self.canonical_url = urljoin(self.base_url, href)
            elif "stylesheet" in rel and href:
                self.resources.append({"type": "stylesheet", "url": urljoin(self.base_url, href)})

        # 3. Hyperlinks
        elif tag_lower == "a":
            href = attr_dict.get("href", "")
            if href:
                self.links.append(href)

        # 4. Scripts
        elif tag_lower == "script":
            src = attr_dict.get("src", "")
            if src:
                self.resources.append({
                    "type": "script",
                    "url": urljoin(self.base_url, src),
                    "integrity": attr_dict.get("integrity") or None,
                    "crossorigin": attr_dict.get("crossorigin") or None,
                })
            else:
                self._in_script = True
                self._script_chunks = []

        # 5. Images
        elif tag_lower == "img":
            src = attr_dict.get("src", "")
            if src:
                self.resources.append({"type": "image", "url": urljoin(self.base_url, src)})

        # 6. Iframes
        elif tag_lower == "iframe":
            src = attr_dict.get("src", "")
            if src:
                self.resources.append({"type": "iframe", "url": urljoin(self.base_url, src)})

        # 7. Forms
        elif tag_lower == "form":
            action = attr_dict.get("action", "") or ""
            method = (attr_dict.get("method", "") or "GET").upper()
            resolved_action = urljoin(self.base_url, action) if action else self.base_url
            self._current_form = {
                "action": action,
                "resolved_action": resolved_action,
                "method": method,
                "inputs": [],
            }

        # 8. Form Inputs
        elif tag_lower in ("input", "textarea", "select", "button"):
            if self._current_form is not None:
                itype = attr_dict.get("type", "text" if tag_lower == "input" else tag_lower).lower()
                iname = attr_dict.get("name", "")
                self._current_form["inputs"].append({"type": itype, "name": iname})

    def handle_endtag(self, tag: str):
        tag_lower = tag.lower()
        if tag_lower == "title":
            self._in_title = False
            self.title = "".join(self._title_chunks).strip()
        elif tag_lower == "script":
            if self._in_script:
                self._in_script = False
                script_text = "".join(self._script_chunks).strip()
                if script_text:
                    self.inline_scripts.append(script_text[:65_536])
                self._script_chunks = []
        elif tag_lower == "form":
            if self._current_form is not None:
                self.forms.append(self._current_form)
                self._current_form = None

    def handle_data(self, data: str):
        if self._in_title:
            self._title_chunks.append(data)
        elif self._in_script:
            self._script_chunks.append(data)

    def handle_comment(self, data: str):
        # Look for sourceMappingURL hints in inline scripts or comments
        if "sourceMappingURL=" in data:
            match = re.search(r"sourceMappingURL=([^\s]+)", data)
            if match:
                self.source_map_hints.append(urljoin(self.base_url, match.group(1).strip()))


def crawl_website(
    target_domain: str,
    start_url: str,
    client: SafeHttpClient,
    config: DeepScanConfig,
    disallowed_paths: Optional[List[str]] = None,
    allowed_paths: Optional[List[str]] = None,
    seed_urls: Optional[List[str]] = None,
) -> Tuple[List[CrawledPage], List[Dict[str, str]], int]:
    """
    Executes a bounded passive crawl starting from start_url.
    Returns:
    - crawled_pages: List[CrawledPage]
    - skipped_urls: List[{"url": str, "reason": str}]
    - total_discovered_count: int
    """
    disallowed_paths = disallowed_paths or []
    allowed_paths = allowed_paths or []

    # Queue contains: (normalized_url, depth)
    queue: deque[Tuple[str, int]] = deque()
    visited_urls: Set[str] = set()
    discovered_urls: Set[str] = set()
    skipped_urls: List[Dict[str, str]] = []
    crawled_pages: List[CrawledPage] = []

    # Path parameter deduplication tracker: path -> count of query variations crawled
    path_query_counts: Dict[str, int] = {}

    # Initialize with canonical start_url
    norm_start = normalize_crawl_url(start_url)
    if norm_start:
        queue.append((norm_start, 0))
        discovered_urls.add(norm_start)

    # Seed URLs from sitemap if available
    if seed_urls:
        for s_url in seed_urls:
            norm_s = normalize_crawl_url(s_url, base_url=start_url)
            if norm_s and norm_s not in discovered_urls:
                if is_same_origin(norm_s, target_domain):
                    discovered_urls.add(norm_s)
                    # Sitemaps URLs are queued at depth 1
                    queue.append((norm_s, 1))

    crawl_start_time = time.time()

    while queue and len(crawled_pages) < config.max_pages:
        # Check global crawl timeout
        if time.time() - crawl_start_time > config.total_scan_timeout_seconds:
            # Reached global timeout; record remaining queue as skipped
            while queue:
                u, d = queue.popleft()
                skipped_urls.append({"url": u, "reason": "scan_timeout"})
            break

        current_url, depth = queue.popleft()

        if current_url in visited_urls:
            continue

        visited_urls.add(current_url)

        # 1. Depth check
        if depth > config.max_depth:
            skipped_urls.append({"url": current_url, "reason": "exceeds_max_depth"})
            continue

        # 2. Same-origin check
        if not is_same_origin(current_url, target_domain):
            skipped_urls.append({"url": current_url, "reason": "external_origin"})
            continue

        # 3. Non-HTML asset check
        if not is_crawlable_page_url(current_url):
            skipped_urls.append({"url": current_url, "reason": "static_asset"})
            continue

        # 4. Robots.txt check
        parsed_current = urlparse(current_url)
        path = parsed_current.path or "/"
        if config.respect_robots_txt and is_path_disallowed_by_robots(path, disallowed_paths, allowed_paths):
            skipped_urls.append({"url": current_url, "reason": "blocked_by_robots_txt"})
            continue

        # 5. Query parameter flood control (max 2 query variants per unique path)
        if parsed_current.query:
            q_count = path_query_counts.get(path, 0)
            if q_count >= 2:
                skipped_urls.append({"url": current_url, "reason": "query_variant_limit"})
                continue
            path_query_counts[path] = q_count + 1

        # 6. Fetch page with SafeHttpClient
        try:
            resp = client.get(
                current_url,
                max_redirects=config.max_redirects,
                max_response_bytes=config.max_response_bytes,
            )
        except SSRFValidationError as ssrf_err:
            skipped_urls.append({"url": current_url, "reason": f"ssrf_rejected: {str(ssrf_err)}"})
            continue
        except Exception as exc:
            # Network or connection error: record as failed page without crashing crawl
            crawled_pages.append(
                CrawledPage(
                    url=current_url,
                    final_url=current_url,
                    depth=depth,
                    status_code=None,
                    content_type="unknown",
                    is_https=current_url.startswith("https://"),
                    error=f"Connection failure: {str(exc)}",
                )
            )
            continue

        content_type = resp.headers.get("content-type", "").lower()
        is_html = any(ct in content_type for ct in config.allowed_content_types) or ("text/html" in content_type)
        is_https = (resp.final_url or current_url).startswith("https://")

        # Parse HTML if applicable
        title = None
        canonical = None
        extracted_links: List[str] = []
        forms_list: List[FormMetadata] = []
        resources_list: List[ResourceItem] = []
        inline_scripts: List[str] = []

        if is_html and resp.text:
            parser = PageHtmlParser(resp.final_url or current_url)
            try:
                parser.feed(resp.text)
            except Exception:
                pass  # HTML parsing best-effort

            title = parser.title
            canonical = parser.canonical_url
            extracted_links = parser.links
            inline_scripts = parser.inline_scripts

            # Format form metadata
            for f in parser.forms:
                res_action = f["resolved_action"]
                parsed_act = urlparse(res_action)
                act_proto = parsed_act.scheme.lower()
                act_host = parsed_act.hostname or ""
                is_ext = not is_same_origin(res_action, target_domain)
                has_pwd = any(inp["type"] == "password" for inp in f["inputs"])
                has_sens = has_pwd or any(
                    any(s in inp["name"].lower() for s in ("token", "secret", "cvv", "card", "ssn", "auth"))
                    for inp in f["inputs"]
                )

                forms_list.append(
                    FormMetadata(
                        page_url=resp.final_url or current_url,
                        action=f["action"],
                        resolved_action_url=res_action,
                        method=f["method"],
                        action_protocol=act_proto,
                        action_host=act_host,
                        is_external=is_ext,
                        has_password=has_pwd,
                        has_sensitive_fields=has_sens,
                        inputs=f["inputs"],
                    )
                )

            # Format resource inventory
            for r in parser.resources:
                r_url = r["url"]
                parsed_r = urlparse(r_url)
                r_proto = parsed_r.scheme.lower()
                r_host = parsed_r.hostname or ""
                resources_list.append(
                    ResourceItem(
                        page_url=resp.final_url or current_url,
                        resource_url=r_url,
                        resource_type=r["type"],
                        is_https=(r_proto == "https"),
                        is_external=not is_same_origin(r_url, target_domain),
                        host=r_host,
                        integrity=r.get("integrity"),
                        crossorigin=r.get("crossorigin"),
                    )
                )

            # Enqueue discovered links if within depth limit
            if depth < config.max_depth:
                for raw_l in extracted_links:
                    norm_l = normalize_crawl_url(raw_l, base_url=resp.final_url or current_url)
                    if norm_l and norm_l not in discovered_urls:
                        discovered_urls.add(norm_l)
                        if is_same_origin(norm_l, target_domain):
                            queue.append((norm_l, depth + 1))
                        else:
                            skipped_urls.append({"url": norm_l, "reason": "external_origin"})

        page_record = CrawledPage(
            url=current_url,
            final_url=resp.final_url or current_url,
            depth=depth,
            status_code=resp.status_code,
            content_type=content_type,
            is_https=is_https,
            redirect_chain=resp.redirect_chain or [current_url],
            elapsed_ms=resp.elapsed_ms,
            headers=resp.headers,
            raw_headers=resp.raw_headers,
            cookies=resp.cookies,
            set_cookie_headers=resp.set_cookie_headers,
            title=title,
            canonical_url=canonical,
            discovered_links=extracted_links,
            forms=forms_list,
            resources=resources_list,
            inline_scripts=inline_scripts,
            error=resp.error,
            body_sample=resp.text[:65536] if resp.text else None,
        )
        crawled_pages.append(page_record)

    # Any remaining unvisited in queue due to page limit
    while queue:
        rem_url, _ = queue.popleft()
        if rem_url not in visited_urls:
            skipped_urls.append({"url": rem_url, "reason": "page_limit_reached"})

    return crawled_pages, skipped_urls, len(discovered_urls)
