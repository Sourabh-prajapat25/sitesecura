"""
Scanly API - Tools Schemas
Defines request and response models for standalone security and network utility tools.
"""
import re
from urllib.parse import urlparse
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict

# Standard supported DNS record types for forward lookup
ALLOWED_DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SOA", "CAA"]
DEFAULT_DNS_RECORD_TYPES = ["A", "AAAA", "MX", "NS", "TXT"]

# Strict domain regex (RFC 1035 / RFC 1123 compliant)
DOMAIN_NAME_REGEX = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-_]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$"
)

BLOCKED_LOCAL_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "local",
    "internal",
    "lan",
    "home.arpa",
    "metadata.google.internal",
    "instance-data",
}


class DnsRecordItem(BaseModel):
    """Represents a single resolved DNS record entry."""
    model_config = ConfigDict(from_attributes=True)

    value: str = Field(..., description="String representation of record value")
    ttl: Optional[int] = Field(None, description="Time-To-Live in seconds, if provided by resolver")
    
    # Structured fields for specific record types
    preference: Optional[int] = Field(None, description="MX priority/preference")
    exchange: Optional[str] = Field(None, description="MX mail server hostname")
    flags: Optional[int] = Field(None, description="CAA flags byte")
    tag: Optional[str] = Field(None, description="CAA tag (e.g. issue, issuewild, iodef)")
    
    # SOA structured fields
    mname: Optional[str] = Field(None, description="SOA primary master name server")
    rname: Optional[str] = Field(None, description="SOA responsible person email domain")
    serial: Optional[int] = Field(None, description="SOA zone serial number")
    refresh: Optional[int] = Field(None, description="SOA refresh interval in seconds")
    retry: Optional[int] = Field(None, description="SOA retry interval in seconds")
    expire: Optional[int] = Field(None, description="SOA expire limit in seconds")
    minimum: Optional[int] = Field(None, description="SOA minimum/negative cache TTL")


class DnsTypeResult(BaseModel):
    """Results for a single DNS record type query (e.g. A, MX, TXT)."""
    model_config = ConfigDict(from_attributes=True)

    record_type: str = Field(..., description="Queried DNS record type (e.g. A, MX, TXT)")
    status: str = Field(..., description="'success', 'no_records', 'timeout', or 'error'")
    records: List[DnsRecordItem] = Field(default_factory=list, description="List of resolved record items")
    message: Optional[str] = Field(None, description="Descriptive status message or resolver error explanation")


class DnsLookupSummary(BaseModel):
    """Aggregate summary counts of the DNS lookup operation."""
    requested_types: int = Field(..., description="Number of record types requested")
    successful_types: int = Field(..., description="Number of record types queried successfully")
    total_records: int = Field(..., description="Total count of records returned across all types")


class DnsLookupRequest(BaseModel):
    """Request payload for standalone DNS resolution."""
    domain: str = Field(..., min_length=1, max_length=253, description="Domain name to look up (e.g. example.com)")
    record_types: List[str] = Field(
        default=DEFAULT_DNS_RECORD_TYPES,
        min_length=1,
        max_length=8,
        description=f"List of record types to query. Supported: {', '.join(ALLOWED_DNS_RECORD_TYPES)}",
    )

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Domain name cannot be empty.")

        cleaned = v.strip().lower()

        # Reject URL schemes, credentials, paths, ports, fragments
        if "://" in cleaned:
            raise ValueError("Invalid domain: URL schemes (e.g. 'https://') are not allowed. Please enter only the domain name.")
        if "/" in cleaned or "\\" in cleaned:
            raise ValueError("Invalid domain: URL paths are not allowed. Please enter only the domain name.")
        if "?" in cleaned or "#" in cleaned:
            raise ValueError("Invalid domain: query strings and fragments are not allowed.")
        if "@" in cleaned:
            raise ValueError("Invalid domain: email addresses or credentials are not allowed.")
        if ":" in cleaned:
            raise ValueError("Invalid domain: port numbers are not allowed.")

        # Strip trailing dot if present (standard FQDN notation e.g. "example.com.")
        cleaned = cleaned.rstrip(".")

        if not cleaned:
            raise ValueError("Invalid domain name.")

        if len(cleaned) > 253:
            raise ValueError("Domain name exceeds maximum length of 253 characters.")

        # Disallow restricted local/internal hostnames
        if cleaned in BLOCKED_LOCAL_HOSTNAMES or any(cleaned.endswith(f".{b}") for b in BLOCKED_LOCAL_HOSTNAMES):
            raise ValueError(f"Domain '{cleaned}' is a restricted local or internal hostname.")

        # Reject literal IP addresses (this is a forward domain lookup utility)
        parts = cleaned.split(".")
        if len(parts) == 4 and all(p.isdigit() for p in parts):
            raise ValueError("IP addresses are not valid for domain DNS lookup. Please enter a domain name (e.g. 'example.com').")

        # Validate against RFC domain regex
        if not DOMAIN_NAME_REGEX.match(cleaned):
            raise ValueError(f"'{cleaned}' is not a valid domain name format.")

        return cleaned

    @field_validator("record_types")
    @classmethod
    def validate_record_types(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("At least one DNS record type must be selected.")

        normalized = []
        seen = set()
        for rt in v:
            if not isinstance(rt, str) or not rt.strip():
                continue
            upper_rt = rt.strip().upper()
            if upper_rt not in ALLOWED_DNS_RECORD_TYPES:
                raise ValueError(
                    f"Unsupported DNS record type '{rt}'. Supported types are: {', '.join(ALLOWED_DNS_RECORD_TYPES)}."
                )
            if upper_rt not in seen:
                seen.add(upper_rt)
                normalized.append(upper_rt)

        if not normalized:
            raise ValueError("At least one valid DNS record type must be specified.")

        if len(normalized) > len(ALLOWED_DNS_RECORD_TYPES):
            raise ValueError(f"Too many record types specified (maximum {len(ALLOWED_DNS_RECORD_TYPES)}).")

        return normalized


class DnsLookupResponse(BaseModel):
    """Complete response payload returned by the DNS lookup endpoint."""
    model_config = ConfigDict(from_attributes=True)

    domain: str = Field(..., description="Normalized domain that was queried")
    queried_at: str = Field(..., description="ISO 8601 UTC timestamp of the lookup")
    duration_ms: float = Field(..., description="Query duration in milliseconds")
    results: List[DnsTypeResult] = Field(..., description="Query results for each requested record type")
    summary: DnsLookupSummary = Field(..., description="Summary statistics of the DNS lookup")


# Standard supported HTTP ports for standalone check
ALLOWED_HTTP_PORTS = {80, 443, 8080, 8443}


class HttpRedirectHop(BaseModel):
    """Represents an individual hop in the HTTP request / redirect chain."""
    model_config = ConfigDict(from_attributes=True)

    step: int = Field(..., description="1-indexed step number in the chain")
    url: str = Field(..., description="Target URL requested at this step")
    status_code: int = Field(..., description="HTTP status code received (e.g. 200, 301, 404)")
    status_text: str = Field(..., description="Standard HTTP status reason phrase (e.g. 'OK', 'Moved Permanently')")
    location: Optional[str] = Field(None, description="Raw Location header if 3xx redirect")
    next_url: Optional[str] = Field(None, description="Resolved absolute next URL for subsequent hop")
    response_time_ms: float = Field(..., description="Response latency in milliseconds for this hop")
    is_https: bool = Field(..., description="Whether this request hop utilized HTTPS")
    ip_address: Optional[str] = Field(None, description="Server IP address connected to at this hop")
    headers: Dict[str, str] = Field(default_factory=dict, description="Safe sanitized response headers")


class HttpStatusCheckSummary(BaseModel):
    """Summary metrics of the HTTP status and redirect chain."""
    model_config = ConfigDict(from_attributes=True)

    total_redirects: int = Field(..., description="Total number of redirect hops followed")
    is_https_initial: bool = Field(..., description="Whether initial requested URL used HTTPS")
    is_https_final: bool = Field(..., description="Whether final destination URL uses HTTPS")
    has_ssl_downgrade: bool = Field(..., description="True if any redirect transition went from HTTPS to unencrypted HTTP")
    duration_ms: float = Field(..., description="Total duration of all requests in milliseconds")


class HttpStatusCheckRequest(BaseModel):
    """Request payload for standalone HTTP Status & Redirect Check."""
    url: str = Field(..., min_length=1, max_length=2048, description="Target URL to inspect (e.g. https://example.com/login)")

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Target URL cannot be empty.")

        cleaned = v.strip()

        # Reject control characters (ASCII < 32 or 127)
        if any(ord(c) < 32 or ord(c) == 127 for c in cleaned):
            raise ValueError("URL contains invalid control characters.")

        # Test netloc for credentials (@)
        parsed_test = urlparse(cleaned if "://" in cleaned else f"https://{cleaned}")
        if "@" in parsed_test.netloc or parsed_test.username or parsed_test.password:
            raise ValueError("URLs containing embedded username or password credentials ('@') are not permitted.")

        # Check for exotic colon-schemes (e.g. javascript:, mailto:, data:, ftp:)
        colon_idx = cleaned.find(":")
        slash_idx = cleaned.find("/")
        if colon_idx != -1 and (slash_idx == -1 or colon_idx < slash_idx):
            potential_scheme = cleaned[:colon_idx].lower()
            if "." not in potential_scheme and potential_scheme.isalpha() and potential_scheme not in ("http", "https"):
                raise ValueError(f"Unsupported URL scheme '{potential_scheme}'. Only HTTP and HTTPS URLs are permitted.")

        # Auto-prefix https:// if scheme is missing
        if "://" not in cleaned:
            cleaned = f"https://{cleaned}"

        parsed = urlparse(cleaned)
        scheme = (parsed.scheme or "").lower()
        if scheme not in ("http", "https"):
            raise ValueError(f"Unsupported URL scheme '{scheme}'. Only HTTP and HTTPS URLs are permitted.")

        host = parsed.hostname
        if not host:
            raise ValueError("Invalid URL: unable to extract a valid hostname.")

        # Disallow non-standard ports
        port = parsed.port
        if port is not None and port not in ALLOWED_HTTP_PORTS:
            raise ValueError(
                f"Disallowed port '{port}'. Standalone checks only support standard web ports ({', '.join(str(p) for p in sorted(ALLOWED_HTTP_PORTS))})."
            )

        # Validate hostname against SSRF blocklist (blocked hosts, private IPs, loopback)
        try:
            from scanner.network.safety import validate_hostname, SSRFValidationError
            validate_hostname(host)
        except SSRFValidationError as e:
            raise ValueError(f"Disallowed target: {str(e)}")
        except ImportError:
            # Fallback if imported in isolation
            host_clean = host.strip().lower().rstrip(".")
            if host_clean in BLOCKED_LOCAL_HOSTNAMES or any(host_clean.endswith(f".{b}") for b in BLOCKED_LOCAL_HOSTNAMES):
                raise ValueError(f"Domain '{host_clean}' is a restricted local or internal hostname.")
            if not DOMAIN_NAME_REGEX.match(host_clean):
                raise ValueError(f"'{host_clean}' is not a valid domain name format.")

        return cleaned


class HttpStatusCheckResponse(BaseModel):
    """Complete response payload for standalone HTTP Status & Redirect Check."""
    model_config = ConfigDict(from_attributes=True)

    requested_url: str = Field(..., description="Original URL submitted by the client")
    normalized_url: str = Field(..., description="Normalized URL starting with http:// or https://")
    checked_at: str = Field(..., description="ISO 8601 UTC timestamp of execution")
    duration_ms: float = Field(..., description="Total execution duration in milliseconds")
    final_url: str = Field(..., description="Final URL reached after all redirects")
    final_status_code: Optional[int] = Field(None, description="HTTP status code of final response (e.g. 200, 404, 500)")
    final_status_text: Optional[str] = Field(None, description="HTTP status phrase of final response")
    redirect_count: int = Field(..., description="Number of redirect hops followed")
    chain: List[HttpRedirectHop] = Field(default_factory=list, description="Ordered list of each hop")
    result_status: str = Field(
        ...,
        description="'success', 'client_error', 'server_error', 'redirect_loop', 'redirect_limit', 'blocked_redirect', 'connection_error', 'timeout'"
    )
    message: Optional[str] = Field(None, description="Explanatory message or error details")
    summary: HttpStatusCheckSummary = Field(..., description="Aggregate summary metrics")


class SecurityTxtField(BaseModel):
    """Represents a single parsed field directive in a security.txt file."""
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., description="Field directive name (e.g. Contact, Expires, Policy)")
    value: str = Field(..., description="Parsed field value")
    line_number: int = Field(..., description="1-indexed line number in source file")
    is_valid: bool = Field(..., description="Whether this individual field value conforms to syntax rules")
    description: Optional[str] = Field(None, description="Standard description or validation note")


class SecurityTxtFinding(BaseModel):
    """Represents a discrete validation finding, error, warning, or informational note."""
    model_config = ConfigDict(from_attributes=True)

    code: str = Field(..., description="Unique stable machine code (e.g. CONTACT_MISSING, EXPIRES_PASSED)")
    severity: str = Field(..., description="'error', 'warning', 'info', or 'success'")
    title: str = Field(..., description="Short human-readable finding title")
    message: str = Field(..., description="Detailed explanation of the standard requirement or finding")
    line_number: Optional[int] = Field(None, description="1-indexed line number in source file if applicable")
    field_name: Optional[str] = Field(None, description="Relevant directive name (e.g. Contact, Expires)")
    recommendation: Optional[str] = Field(None, description="Practical remediation guidance")
    reference: Optional[str] = Field(None, description="Specification reference (e.g. RFC 9116 Section 2.5.3)")


class SecurityTxtSummary(BaseModel):
    """Summary metrics of the security.txt validation result."""
    model_config = ConfigDict(from_attributes=True)

    total_fields: int = Field(..., description="Total directives parsed from the file")
    errors_count: int = Field(..., description="Number of error findings")
    warnings_count: int = Field(..., description="Number of warning findings")
    info_count: int = Field(..., description="Number of informational findings")
    has_contact: bool = Field(..., description="Whether at least one valid Contact directive was found")
    has_expires: bool = Field(..., description="Whether a valid Expires directive was found")
    has_encryption: bool = Field(..., description="Whether Encryption directive is present")
    has_policy: bool = Field(..., description="Whether Policy directive is present")
    has_canonical: bool = Field(..., description="Whether Canonical directive is present")
    has_hiring: bool = Field(..., description="Whether Hiring directive is present")
    is_https: bool = Field(..., description="Whether the file was retrieved over HTTPS")
    used_fallback: bool = Field(..., description="Whether fallback location /security.txt was used instead of /.well-known/")


class SecurityTxtValidateRequest(BaseModel):
    """Request payload for standalone security.txt validation."""
    domain: str = Field(..., min_length=1, max_length=253, description="Target domain or hostname (e.g. example.com)")

    @field_validator("domain")
    @classmethod
    def validate_domain_input(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Target domain cannot be empty.")

        cleaned = v.strip()

        # Reject control characters
        if any(ord(c) < 32 or ord(c) == 127 for c in cleaned):
            raise ValueError("Domain contains invalid control characters.")

        # Test for credentials (@)
        if "@" in cleaned:
            raise ValueError("Targets containing embedded credentials ('@') are not permitted.")

        # Check for exotic colon-schemes (e.g. javascript:, data:, ftp:, file:)
        colon_idx = cleaned.find(":")
        slash_idx = cleaned.find("/")
        if colon_idx != -1 and (slash_idx == -1 or colon_idx < slash_idx):
            potential_scheme = cleaned[:colon_idx].lower()
            if "." not in potential_scheme and potential_scheme.isalpha() and potential_scheme not in ("http", "https"):
                raise ValueError(f"Unsupported URL scheme '{potential_scheme}'. Only HTTP and HTTPS are supported.")

        parsed_test = urlparse(cleaned if "://" in cleaned else f"https://{cleaned}")

        host = parsed_test.hostname
        if not host:
            raise ValueError("Invalid target: unable to extract a valid domain name or hostname.")

        # Disallow non-standard ports
        port = parsed_test.port
        if port is not None and port not in ALLOWED_HTTP_PORTS:
            raise ValueError(
                f"Disallowed port '{port}'. Standalone checks only support standard web ports ({', '.join(str(p) for p in sorted(ALLOWED_HTTP_PORTS))})."
            )

        # Validate hostname against SSRF blocklist (blocked hosts, private IPs, loopback)
        try:
            from scanner.network.safety import validate_hostname, SSRFValidationError
            validate_hostname(host)
        except SSRFValidationError as e:
            raise ValueError(f"Disallowed target: {str(e)}")
        except ImportError:
            host_clean = host.strip().lower().rstrip(".")
            if host_clean in BLOCKED_LOCAL_HOSTNAMES or any(host_clean.endswith(f".{b}") for b in BLOCKED_LOCAL_HOSTNAMES):
                raise ValueError(f"Domain '{host_clean}' is a restricted local or internal hostname.")
            if not DOMAIN_NAME_REGEX.match(host_clean):
                raise ValueError(f"'{host_clean}' is not a valid domain name format.")

        return host.lower()


class SecurityTxtValidateResponse(BaseModel):
    """Complete response payload for standalone security.txt validation."""
    model_config = ConfigDict(from_attributes=True)

    domain: str = Field(..., description="Normalized domain that was queried")
    target_url: str = Field(..., description="Standardized HTTPS file URL queried")
    checked_at: str = Field(..., description="ISO 8601 UTC timestamp of execution")
    duration_ms: float = Field(..., description="Total execution duration in milliseconds")
    retrieval_status: str = Field(
        ...,
        description="'retrieved', 'not_found', 'forbidden', 'rate_limited', 'server_error', 'tls_error', 'connection_error', 'timeout', 'blocked_target', 'oversized', 'html_response'"
    )
    source_location: Optional[str] = Field(None, description="'/.well-known/security.txt', '/security.txt', or null")
    http_status_code: Optional[int] = Field(None, description="HTTP status code received during retrieval")
    content_type: Optional[str] = Field(None, description="Reported Content-Type header")
    content_length: Optional[int] = Field(None, description="Reported or measured content length in bytes")
    validation_status: str = Field(..., description="'valid', 'valid_with_warnings', 'invalid', 'not_found', 'retrieval_error'")
    summary: SecurityTxtSummary = Field(..., description="Summary statistics of parsed fields and findings")
    fields: List[SecurityTxtField] = Field(default_factory=list, description="Structured parsed directive items")
    findings: List[SecurityTxtFinding] = Field(default_factory=list, description="Ordered validation findings")
    expires_at: Optional[str] = Field(None, description="Parsed ISO 8601 UTC expiration timestamp if valid")
    is_expired: Optional[bool] = Field(None, description="Whether the file has expired")
    days_until_expiration: Optional[int] = Field(None, description="Estimated days remaining until expiration if future")
    raw_content: Optional[str] = Field(None, description="Sanitized, bounded raw file content text for optional viewer")


class RobotsDirective(BaseModel):
    """A single directive inside robots.txt."""
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., description="Directive name (e.g. User-agent, Allow, Disallow, Sitemap)")
    value: str = Field(..., description="Directive value")
    line_number: int = Field(..., description="1-indexed line number in source robots.txt file")


class RobotsUserAgentGroup(BaseModel):
    """A user-agent rule group defined in robots.txt according to RFC 9309."""
    model_config = ConfigDict(from_attributes=True)

    user_agents: List[str] = Field(default_factory=list, description="Target crawler user-agents (e.g. ['*'] or ['Googlebot'])")
    allows: List[str] = Field(default_factory=list, description="List of allowed path patterns")
    disallows: List[str] = Field(default_factory=list, description="List of disallowed path patterns")
    other_directives: Dict[str, str] = Field(default_factory=dict, description="Non-standard directives (e.g. Crawl-delay, Host)")


class RobotsTxtResult(BaseModel):
    """Comprehensive analysis of the target's robots.txt file."""
    model_config = ConfigDict(from_attributes=True)

    requested_url: str = Field(..., description="Requested robots.txt URL (e.g. https://example.com/robots.txt)")
    effective_url: Optional[str] = Field(None, description="Final effective URL reached after redirects")
    retrieval_status: str = Field(
        ...,
        description="'success', 'not_found', 'forbidden', 'rate_limited', 'server_error', 'tls_error', 'connection_error', 'timeout', 'blocked_target', 'oversized', 'html_response'"
    )
    http_status_code: Optional[int] = Field(None, description="HTTP response status code")
    content_type: Optional[str] = Field(None, description="Content-Type header received")
    content_length: Optional[int] = Field(None, description="Content length in bytes")
    is_valid: bool = Field(..., description="Whether robots.txt exists and parsed without fatal errors")
    groups: List[RobotsUserAgentGroup] = Field(default_factory=list, description="Parsed RFC 9309 user-agent groups")
    sitemap_declarations: List[str] = Field(default_factory=list, description="Discovered Sitemap directives")
    raw_content: Optional[str] = Field(None, description="Bounded raw text content of robots.txt")
    warnings: List[str] = Field(default_factory=list, description="Non-fatal warnings encountered during parsing")


class SitemapItem(BaseModel):
    """An individual URL entry discovered in a sitemap."""
    model_config = ConfigDict(from_attributes=True)

    loc: str = Field(..., description="URL location")
    lastmod: Optional[str] = Field(None, description="Last modification datetime string if specified")
    changefreq: Optional[str] = Field(None, description="Change frequency (e.g. daily, weekly)")
    priority: Optional[float] = Field(None, description="Priority rating (0.0 to 1.0)")


class RobotsSitemapFinding(BaseModel):
    """A diagnostic finding, error, warning, or informational notice for robots/sitemap inspection."""
    model_config = ConfigDict(from_attributes=True)

    code: str = Field(..., description="Unique machine-readable finding code")
    severity: str = Field(..., description="'error', 'warning', 'info', or 'success'")
    title: str = Field(..., description="Short finding title")
    message: str = Field(..., description="Detailed description of the issue or verification")
    affected_item: Optional[str] = Field(None, description="URL or directive affected")
    recommendation: Optional[str] = Field(None, description="Actionable remediation guidance")
    reference: Optional[str] = Field(None, description="Standards reference (e.g. RFC 9309, sitemaps.org)")


class SitemapDocumentResult(BaseModel):
    """Result of validating an individual sitemap document."""
    model_config = ConfigDict(from_attributes=True)

    url: str = Field(..., description="Sitemap document URL")
    source: str = Field(..., description="'robots_txt', 'conventional', or 'index_child'")
    document_type: str = Field(..., description="'urlset', 'sitemapindex', or 'unknown'")
    retrieval_status: str = Field(
        ...,
        description="'retrieved', 'not_found', 'forbidden', 'rate_limited', 'server_error', 'tls_error', 'connection_error', 'timeout', 'blocked_target', 'oversized', 'html_response', 'not_fetched_external', 'parse_error'"
    )
    http_status_code: Optional[int] = Field(None, description="HTTP status code received")
    content_type: Optional[str] = Field(None, description="Reported Content-Type")
    validity_status: str = Field(..., description="'valid', 'valid_with_warnings', 'invalid', 'retrieval_error', 'not_fetched_external'")
    url_count: int = Field(0, description="Total URL entries counted in this sitemap")
    child_sitemap_count: int = Field(0, description="Total child sitemaps listed if sitemapindex")
    child_sitemaps: List[str] = Field(default_factory=list, description="Child sitemap URLs if sitemapindex")
    sample_urls: List[SitemapItem] = Field(default_factory=list, description="Sample of extracted URLs (up to 100)")
    findings: List[RobotsSitemapFinding] = Field(default_factory=list, description="Findings specific to this sitemap")
    analysis_complete: bool = Field(True, description="Whether sitemap analysis ran to completion within limits")


class SitemapDiscoverySummary(BaseModel):
    """Summary of discovered sitemaps across robots.txt and conventional locations."""
    model_config = ConfigDict(from_attributes=True)

    declared_urls: List[str] = Field(default_factory=list, description="Sitemap URLs declared in robots.txt")
    conventional_checked: bool = Field(False, description="Whether /sitemap.xml fallback was inspected")
    conventional_found: bool = Field(False, description="Whether /sitemap.xml responded with a valid sitemap")
    external_urls_skipped: List[str] = Field(default_factory=list, description="Cross-origin sitemaps not fetched under safe-origin policy")


class RobotsSitemapSummary(BaseModel):
    """Aggregate metrics for the robots.txt & sitemap validation."""
    model_config = ConfigDict(from_attributes=True)

    has_robots_txt: bool = Field(..., description="Whether robots.txt exists and was retrieved")
    robots_status: str = Field(..., description="Retrieval status of robots.txt")
    total_user_agent_groups: int = Field(..., description="Number of user-agent groups parsed")
    total_disallow_rules: int = Field(..., description="Total Disallow rules across all groups")
    total_allow_rules: int = Field(..., description="Total Allow rules across all groups")
    sitemaps_declared_count: int = Field(..., description="Count of sitemaps declared in robots.txt")
    sitemaps_discovered_count: int = Field(..., description="Total sitemap documents discovered")
    sitemaps_validated_count: int = Field(..., description="Count of sitemaps retrieved and parsed")
    total_urls_discovered: int = Field(..., description="Total URLs counted across parsed sitemaps")
    errors_count: int = Field(..., description="Count of error findings")
    warnings_count: int = Field(..., description="Count of warning findings")
    info_count: int = Field(..., description="Count of informational findings")
    analysis_complete: bool = Field(..., description="Whether analysis completed within limits")


class RobotsSitemapCheckRequest(BaseModel):
    """Request payload for standalone Robots.txt & Sitemap Checker."""
    domain: str = Field(..., min_length=1, max_length=253, description="Target domain or hostname (e.g. example.com)")

    @field_validator("domain")
    @classmethod
    def validate_domain_input(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Target domain cannot be empty.")

        cleaned = v.strip()

        # Reject control characters
        if any(ord(c) < 32 or ord(c) == 127 for c in cleaned):
            raise ValueError("Domain contains invalid control characters.")

        # Test for credentials (@)
        if "@" in cleaned:
            raise ValueError("Targets containing embedded credentials ('@') are not permitted.")

        # Check for exotic colon-schemes (e.g. javascript:, data:, ftp:, file:)
        colon_idx = cleaned.find(":")
        slash_idx = cleaned.find("/")
        if colon_idx != -1 and (slash_idx == -1 or colon_idx < slash_idx):
            potential_scheme = cleaned[:colon_idx].lower()
            if "." not in potential_scheme and potential_scheme.isalpha() and potential_scheme not in ("http", "https"):
                raise ValueError(f"Unsupported URL scheme '{potential_scheme}'. Only HTTP and HTTPS are supported.")

        parsed_test = urlparse(cleaned if "://" in cleaned else f"https://{cleaned}")

        host = parsed_test.hostname
        if not host:
            raise ValueError("Invalid target: unable to extract a valid domain name or hostname.")

        port = parsed_test.port
        if port is not None and port not in (80, 443):
            raise ValueError(
                f"Disallowed port '{port}'. Standalone checks only support standard web ports (80, 443)."
            )

        # Validate hostname against SSRF blocklist
        try:
            from scanner.network.safety import validate_hostname, SSRFValidationError
            validate_hostname(host)
        except SSRFValidationError as e:
            raise ValueError(f"Disallowed target: {str(e)}")
        except ImportError:
            host_clean = host.strip().lower().rstrip(".")
            if host_clean in BLOCKED_LOCAL_HOSTNAMES or any(host_clean.endswith(f".{b}") for b in BLOCKED_LOCAL_HOSTNAMES):
                raise ValueError(f"Domain '{host_clean}' is a restricted local or internal hostname.")
            if not DOMAIN_NAME_REGEX.match(host_clean):
                raise ValueError(f"'{host_clean}' is not a valid domain name format.")

        return host.lower()


class RobotsSitemapCheckResponse(BaseModel):
    """Response payload for standalone Robots.txt & Sitemap Checker."""
    model_config = ConfigDict(from_attributes=True)

    domain: str = Field(..., description="Normalized domain queried")
    target_url: str = Field(..., description="Target HTTPS origin (e.g. https://example.com)")
    checked_at: str = Field(..., description="ISO 8601 UTC timestamp of execution")
    duration_ms: float = Field(..., description="Total execution duration in milliseconds")
    robots: RobotsTxtResult = Field(..., description="Robots.txt retrieval and parsing result")
    sitemap_discovery: SitemapDiscoverySummary = Field(..., description="Summary of discovered sitemaps")
    sitemaps: List[SitemapDocumentResult] = Field(default_factory=list, description="Validated sitemap documents")
    summary: RobotsSitemapSummary = Field(..., description="High-level metrics summary")
    findings: List[RobotsSitemapFinding] = Field(default_factory=list, description="Ordered diagnostic findings")
    analysis_complete: bool = Field(True, description="Whether entire operation completed within resource limits")


# ============================================================================
# CSP Policy Analyzer Models (Phase 3)
# ============================================================================

class CspDirectiveItem(BaseModel):
    """An individual parsed CSP directive name and its source expressions."""
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., description="Directive name (e.g. 'script-src', 'default-src')")
    values: List[str] = Field(default_factory=list, description="Source expression tokens")
    raw_text: str = Field(..., description="Raw text of directive and its values")
    is_duplicate: bool = Field(False, description="True if this directive appeared more than once in the policy")
    is_unknown: bool = Field(False, description="True if directive is unrecognized in modern CSP specifications")
    is_deprecated: bool = Field(False, description="True if directive is obsolete or deprecated (e.g. report-uri, block-all-mixed-content)")
    is_fallback: bool = Field(False, description="True if this directive is effective via fallback (e.g. from default-src)")
    fallback_source: Optional[str] = Field(None, description="The fallback directive providing these rules if is_fallback is True")
    warnings: List[str] = Field(default_factory=list, description="Syntax or compatibility warnings specific to this directive")


class CspFinding(BaseModel):
    """A deterministic security finding, flaw, or recommendation from CSP policy analysis."""
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Stable machine-readable finding identifier (e.g. 'CSP_UNSAFE_INLINE_SCRIPT')")
    title: str = Field(..., description="Concise human-readable finding title")
    severity: str = Field(..., description="'critical', 'high', 'medium', 'low', or 'info'")
    confidence: str = Field("definite", description="'definite', 'conditional', or 'informational'")
    directive: Optional[str] = Field(None, description="Directive associated with this finding")
    evidence: Optional[str] = Field(None, description="Policy snippet or token triggering this finding")
    explanation: str = Field(..., description="Detailed explanation of the condition detected")
    security_impact: str = Field(..., description="Real-world security impact and exploitability context")
    recommendation: str = Field(..., description="Actionable step-by-step remediation guidance")
    safe_example: Optional[str] = Field(None, description="Illustrative safe configuration snippet")
    reference: Optional[str] = Field(None, description="Specification reference (e.g. W3C CSP Level 3, MDN)")
    is_conditional: bool = Field(False, description="True if severity depends on application architecture or polyfill context")


class CspPolicyDetail(BaseModel):
    """Analysis details of a single CSP policy (either enforcing or report-only)."""
    model_config = ConfigDict(from_attributes=True)

    policy_type: str = Field(..., description="'enforce' or 'report_only'")
    raw_policy: str = Field(..., description="Original raw policy text")
    directives: List[CspDirectiveItem] = Field(default_factory=list, description="Parsed explicit directives")
    effective_directives: Dict[str, CspDirectiveItem] = Field(default_factory=dict, description="Mapped effective directives including fallbacks")
    findings: List[CspFinding] = Field(default_factory=list, description="Findings identified within this policy")
    has_unsafe_inline: bool = Field(False, description="Whether 'unsafe-inline' is present in script-src or default-src")
    has_unsafe_eval: bool = Field(False, description="Whether 'unsafe-eval' is present in script-src or default-src")
    has_strict_dynamic: bool = Field(False, description="Whether 'strict-dynamic' is present")
    has_nonces_or_hashes: bool = Field(False, description="Whether cryptographic nonces or hashes are utilized")
    has_wildcard: bool = Field(False, description="Whether broad wildcards (*) are present in sensitive directives")
    directive_count: int = Field(0, description="Total explicit directives in this policy")
    duplicate_count: int = Field(0, description="Number of duplicate directives encountered")
    findings_count: int = Field(0, description="Total findings generated for this policy")


class CspPolicyMetrics(BaseModel):
    """Summary metrics and quality score of the CSP analysis."""
    model_config = ConfigDict(from_attributes=True)

    total_policies: int = Field(..., description="Number of policies analyzed (enforced + report-only)")
    enforcing_policies_count: int = Field(0, description="Number of enforcing policies found")
    report_only_policies_count: int = Field(0, description="Number of Report-Only policies found")
    total_directives: int = Field(0, description="Total explicit directives counted across all policies")
    total_findings: int = Field(0, description="Total findings generated")
    critical_findings_count: int = Field(0, description="Count of critical severity findings")
    high_findings_count: int = Field(0, description="Count of high severity findings")
    medium_findings_count: int = Field(0, description="Count of medium severity findings")
    low_findings_count: int = Field(0, description="Count of low severity findings")
    info_findings_count: int = Field(0, description="Count of info severity findings")
    quality_score: int = Field(..., description="Explainable CSP Configuration Quality Score from 0 to 100")
    quality_rating: str = Field(..., description="Rating label ('Excellent', 'Good', 'Moderate', 'Weak', 'Inadequate', or 'None')")


class CspPolicyAnalyzeRequest(BaseModel):
    """Request payload for standalone CSP Policy Analyzer."""
    mode: str = Field("paste", description="Analysis mode: 'paste' for submitted policy text, or 'remote' for public website inspection")
    policy: Optional[str] = Field(None, max_length=100000, description="Pasted CSP policy string (for 'paste' mode)")
    policy_type: Optional[str] = Field("enforce", description="'enforce' or 'report_only'")
    url: Optional[str] = Field(None, max_length=2048, description="Target website URL to inspect headers for (for 'remote' mode)")

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        clean = (v or "").strip().lower()
        if clean not in ("paste", "remote"):
            raise ValueError("Mode must be either 'paste' or 'remote'.")
        return clean

    @field_validator("policy_type")
    @classmethod
    def validate_policy_type(cls, v: Optional[str]) -> str:
        if not v:
            return "enforce"
        clean = v.strip().lower()
        if clean not in ("enforce", "report_only"):
            raise ValueError("policy_type must be either 'enforce' or 'report_only'.")
        return clean

    @field_validator("policy")
    @classmethod
    def validate_policy(cls, v: Optional[str], values: Any) -> Optional[str]:
        if v is not None:
            cleaned = v.strip()
            if any(ord(c) < 32 and c not in "\t\r\n" for c in cleaned):
                raise ValueError("Policy contains invalid control characters.")
            return cleaned
        return None

    @field_validator("url")
    @classmethod
    def validate_url_input(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None

        cleaned = v.strip()

        # Reject control characters
        if any(ord(c) < 32 or ord(c) == 127 for c in cleaned):
            raise ValueError("Target URL contains invalid control characters.")

        # Test for credentials (@)
        if "@" in cleaned:
            raise ValueError("URLs containing embedded credentials ('@') are not permitted.")

        # Check for exotic colon-schemes
        colon_idx = cleaned.find(":")
        slash_idx = cleaned.find("/")
        if colon_idx != -1 and (slash_idx == -1 or colon_idx < slash_idx):
            potential_scheme = cleaned[:colon_idx].lower()
            if "." not in potential_scheme and potential_scheme.isalpha() and potential_scheme not in ("http", "https"):
                raise ValueError(f"Unsupported URL scheme '{potential_scheme}'. Only HTTP and HTTPS are supported.")

        parsed_test = urlparse(cleaned if "://" in cleaned else f"https://{cleaned}")

        host = parsed_test.hostname
        if not host:
            raise ValueError("Invalid target: unable to extract a valid domain name or hostname.")

        port = parsed_test.port
        if port is not None and port not in (80, 443):
            raise ValueError(
                f"Disallowed port '{port}'. Standalone checks only support standard web ports (80, 443)."
            )

        # Validate hostname against SSRF blocklist
        try:
            from scanner.network.safety import validate_hostname, SSRFValidationError
            validate_hostname(host)
        except SSRFValidationError as e:
            raise ValueError(f"Disallowed target: {str(e)}")
        except ImportError:
            host_clean = host.strip().lower().rstrip(".")
            if host_clean in BLOCKED_LOCAL_HOSTNAMES or any(host_clean.endswith(f".{b}") for b in BLOCKED_LOCAL_HOSTNAMES):
                raise ValueError(f"Domain '{host_clean}' is a restricted local or internal hostname.")
            if not DOMAIN_NAME_REGEX.match(host_clean):
                raise ValueError(f"'{host_clean}' is not a valid domain name format.")

        return f"https://{host.lower()}" if not cleaned.startswith("http") else cleaned


class CspPolicyAnalyzeResponse(BaseModel):
    """Response payload returned by the CSP Policy Analyzer."""
    model_config = ConfigDict(from_attributes=True)

    mode: str = Field(..., description="Analysis mode executed ('paste' or 'remote')")
    status: str = Field(..., description="'success', 'no_policy_found', 'invalid_policy', 'blocked_target', 'fetch_error', or 'partial'")
    url: Optional[str] = Field(None, description="Target website URL inspected (if mode is 'remote')")
    http_status_code: Optional[int] = Field(None, description="HTTP response status code from remote target")
    retrieval_duration_ms: Optional[float] = Field(None, description="Network round-trip latency in milliseconds")
    checked_at: str = Field(..., description="ISO 8601 UTC timestamp of the analysis")
    duration_ms: float = Field(..., description="Total execution duration in milliseconds")
    policies: List[CspPolicyDetail] = Field(default_factory=list, description="Detailed analysis for each discovered or pasted policy")
    findings: List[CspFinding] = Field(default_factory=list, description="Aggregated diagnostic security findings ordered by severity")
    metrics: CspPolicyMetrics = Field(..., description="Aggregate policy metrics and configuration quality score")
    summary_markdown: Optional[str] = Field(None, description="Human-readable markdown summary report")
    error_message: Optional[str] = Field(None, description="Descriptive error explanation if status is not 'success'")
    warnings: List[str] = Field(default_factory=list, description="Top-level execution warnings")



