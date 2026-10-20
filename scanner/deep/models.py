"""
Scanly Scanner Engine - Deep Scan Data Structures
Defines strongly-typed models for multi-page crawling, resource inventory, and aggregated findings.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any, Set
from scanner.models import Finding, RiskLevel, CheckStatus, Severity


@dataclass
class FormMetadata:
    page_url: str
    action: str
    resolved_action_url: str
    method: str  # GET, POST, etc.
    action_protocol: str  # http, https
    action_host: str
    is_external: bool
    has_password: bool
    has_sensitive_fields: bool
    inputs: List[Dict[str, str]] = field(default_factory=list)


@dataclass
class ResourceItem:
    page_url: str
    resource_url: str
    resource_type: str  # script, stylesheet, image, iframe, font, other
    is_https: bool
    is_external: bool
    host: str
    integrity: Optional[str] = None
    crossorigin: Optional[str] = None


@dataclass
class SourceMapItem:
    script_url: str
    map_url: str
    is_accessible: bool
    status_code: Optional[int] = None
    content_length: Optional[int] = None


@dataclass
class CrawledPage:
    url: str
    final_url: str
    depth: int
    status_code: Optional[int]
    content_type: str
    is_https: bool
    redirect_chain: List[str] = field(default_factory=list)
    elapsed_ms: int = 0
    headers: Dict[str, str] = field(default_factory=dict)
    raw_headers: List[Any] = field(default_factory=list)
    cookies: Dict[str, str] = field(default_factory=dict)
    set_cookie_headers: List[str] = field(default_factory=list)
    title: Optional[str] = None
    canonical_url: Optional[str] = None
    discovered_links: List[str] = field(default_factory=list)
    forms: List[FormMetadata] = field(default_factory=list)
    resources: List[ResourceItem] = field(default_factory=list)
    technologies: List[Dict[str, str]] = field(default_factory=list)
    inline_scripts: List[str] = field(default_factory=list)
    issues_count: int = 0
    error: Optional[str] = None
    body_sample: Optional[str] = None


@dataclass
class RobotsAnalysis:
    url: str
    is_present: bool
    status_code: Optional[int] = None
    sitemap_urls: List[str] = field(default_factory=list)
    disallowed_paths: List[str] = field(default_factory=list)
    allowed_paths: List[str] = field(default_factory=list)
    crawl_delay: Optional[int] = None
    raw_content: Optional[str] = None


@dataclass
class SitemapAnalysis:
    url: str
    is_present: bool
    status_code: Optional[int] = None
    discovered_urls_count: int = 0
    sample_urls: List[str] = field(default_factory=list)
    is_sitemap_index: bool = False


@dataclass
class DeepScanResult:
    domain: str
    normalized_domain: str
    target_ip: Optional[str]
    score: int
    risk_level: RiskLevel
    score_breakdown: Dict[str, Any]
    findings: List[Finding]
    passed_checks_count: int
    total_checks_count: int
    scan_duration_ms: int
    started_at: datetime
    completed_at: datetime
    # Deep crawl specifics
    pages_discovered: int = 0
    pages_crawled: int = 0
    pages_skipped: int = 0
    crawl_depth: int = 2
    skipped_urls: List[Dict[str, str]] = field(default_factory=list)
    pages: List[Dict[str, Any]] = field(default_factory=list)
    categories_summary: Dict[str, Any] = field(default_factory=dict)
    scan_metadata: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None
    is_partial: bool = False
