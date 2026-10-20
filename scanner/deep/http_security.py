"""
Scanly Scanner Engine - HTTP Security & Server Exposure Analyzer (Phase F4)
Evaluates HTTP methods (Allow header, TRACE advertisement), server/framework
version disclosure, soft-404 status inconsistencies, redirect parameters,
and naturally discovered directory listings and exposed files.
"""
import re
from typing import Dict, List, Optional, Any, Set, Tuple
from urllib.parse import urlparse, parse_qs

from scanner.models import Finding, CheckStatus, Severity

# Server header version detection
SERVER_VERSION_PATTERN = re.compile(
    r"(?:Apache|nginx|Microsoft-IIS|LiteSpeed|OpenSSL|cPanel|Cloudflare|Tomcat|Jetty|gunicorn|uvicorn|Kestrel)/[0-9]+(?:\.[0-9]+)*",
    re.IGNORECASE,
)

# Common redirect parameter names
REDIRECT_PARAM_NAMES = {
    "redirect",
    "redirect_url",
    "redirect_uri",
    "return",
    "returnurl",
    "next",
    "url",
    "target",
    "dest",
    "destination",
    "callback",
    "continue",
    "r",
    "u",
}

# Directory listing markers
DIRECTORY_LISTING_MARKERS = [
    "<title>index of /",
    "<title>directory listing for",
    "<h1>index of /",
    "parent directory</a>",
    "<pre><a href=\"../\">",
    "apache/2.",
    "nginx/1.",
]

# Soft-404 markers in titles or HTML headings
SOFT_404_MARKERS = [
    "404 not found",
    "page not found",
    "404 - not found",
    "page cannot be found",
    "nothing found",
    "error 404",
]

# Sensitive file extensions naturally discovered
SENSITIVE_BACKUP_EXTENSIONS = {
    ".sql",
    ".bak",
    ".backup",
    ".tar.gz",
    ".tgz",
    ".dump",
    ".swp",
}


def analyze_http_methods(
    allow_header: Optional[str],
    url: str = "",
) -> Dict[str, Any]:
    """
    Analyzes methods advertised in the 'Allow' header.
    """
    if not allow_header:
        return {"advertised_methods": [], "dangerous_methods": [], "has_trace": False}

    methods = [m.strip().upper() for m in allow_header.split(",") if m.strip()]
    dangerous = []
    has_trace = "TRACE" in methods
    has_connect = "CONNECT" in methods

    if has_trace:
        dangerous.append("TRACE")
    if has_connect:
        dangerous.append("CONNECT")

    return {
        "url": url,
        "advertised_methods": methods,
        "dangerous_methods": dangerous,
        "has_trace": has_trace,
        "has_connect": has_connect,
        "has_put": "PUT" in methods,
        "has_delete": "DELETE" in methods,
    }


def analyze_server_headers(headers: Dict[str, str]) -> Dict[str, Any]:
    """
    Inspects Server, X-Powered-By, and framework version disclosures.
    """
    lower = {k.lower(): v for k, v in headers.items()}
    server = lower.get("server", "").strip()
    x_powered_by = lower.get("x-powered-by", "").strip()
    x_aspnet = lower.get("x-aspnet-version", "").strip()
    x_generator = lower.get("x-generator", "").strip()

    server_has_version = bool(SERVER_VERSION_PATTERN.search(server))
    framework_has_version = bool(re.search(r"/[0-9]|\b[0-9]+\.[0-9]+", x_powered_by)) or bool(x_aspnet)

    return {
        "server": server or None,
        "server_has_version": server_has_version,
        "x_powered_by": x_powered_by or None,
        "framework_has_version": framework_has_version,
        "x_aspnet_version": x_aspnet or None,
        "x_generator": x_generator or None,
    }


def detect_soft_404(
    url: str,
    status_code: Optional[int],
    title: Optional[str],
    body_sample: Optional[str] = None,
) -> bool:
    """
    Detects soft-404 status: HTTP 200 status code returned for semantic 404 pages.
    """
    if status_code != 200:
        return False

    title_lower = (title or "").lower()
    if any(marker in title_lower for marker in SOFT_404_MARKERS):
        return True

    if body_sample:
        body_lower = body_sample[:4096].lower()
        if "<title>" in body_lower:
            for marker in SOFT_404_MARKERS:
                if f"<title>{marker}" in body_lower or f"{marker}</title>" in body_lower:
                    return True
    return False


def detect_directory_listing(body_sample: Optional[str]) -> bool:
    """
    Detects standard web server directory listing / autoindex pages.
    """
    if not body_sample:
        return False
    body_lower = body_sample[:4096].lower()
    return any(marker in body_lower for marker in DIRECTORY_LISTING_MARKERS)


def extract_redirect_parameters(urls: List[str]) -> List[Dict[str, str]]:
    """
    Inspects discovered URLs for query parameters commonly used in redirects.
    """
    observed: List[Dict[str, str]] = []
    seen = set()

    for u in urls:
        parsed = urlparse(u)
        if not parsed.query:
            continue
        params = parse_qs(parsed.query)
        for param_name, values in params.items():
            if param_name.lower() in REDIRECT_PARAM_NAMES:
                key = (parsed.path, param_name.lower())
                if key not in seen:
                    seen.add(key)
                    observed.append({
                        "url": u,
                        "path": parsed.path,
                        "parameter": param_name,
                        "sample_value": values[0] if values else "",
                    })
    return observed


def build_http_security_findings(
    method_analyses: List[Dict[str, Any]],
    server_disclosure: Dict[str, Any],
    soft_404s: List[str],
    directory_listings: List[str],
    redirect_params: List[Dict[str, str]],
    sensitive_files: List[str],
) -> List[Finding]:
    """
    Compiles canonical findings for HTTP methods, disclosures, soft-404, and directory listings.
    """
    findings: List[Finding] = []

    # 1. Dangerous HTTP Method Exposure (TRACE/CONNECT) (LOW)
    trace_exposures = [ma for ma in method_analyses if ma.get("has_trace")]
    if trace_exposures:
        sample = trace_exposures[0]
        evidence_text = f"Endpoint '{sample.get('url', '')}' advertised TRACE method in Allow header: {', '.join(sample.get('advertised_methods', []))}"
        findings.append(
            Finding(
                check_type="deep_http",
                name="Dangerous HTTP TRACE Method Advertised",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-5,
                title="Dangerous HTTP TRACE Method Advertised by Server",
                summary="The web server advertises support for the HTTP TRACE method, which echoes client request headers back in the response.",
                why_it_matters="If TRACE is active alongside XSS vulnerabilities, it can facilitate Cross-Site Tracing (XST) to steal HttpOnly cookies.",
                how_to_fix="Disable the TRACE method in web server configuration (e.g., 'TraceEnable off' in Apache).",
                estimated_fix_minutes=10,
                documentation_url="https://scanly.io/docs/http-method-security",
                evidence=evidence_text,
            )
        )

    # 2. Server Version Disclosure (LOW)
    if server_disclosure.get("server_has_version"):
        server_val = server_disclosure.get("server", "")
        findings.append(
            Finding(
                check_type="deep_server",
                name="Web Server Version Information Disclosure",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-3,
                title="Detailed Web Server Version Disclosed",
                summary=f"The server disclosed detailed version information in the 'Server' header: '{server_val}'.",
                why_it_matters="Broadcasting specific web server version numbers assists attackers in identifying unpatched CVEs applicable to that release.",
                how_to_fix="Configure your web server to suppress version tokens (e.g. 'ServerTokens Prod' in Apache or 'server_tokens off;' in nginx).",
                estimated_fix_minutes=10,
                documentation_url="https://scanly.io/docs/server-information-disclosure",
                evidence=f"Server: {server_val}",
            )
        )

    # 3. Framework Version Disclosure (LOW)
    if server_disclosure.get("framework_has_version"):
        fw_val = server_disclosure.get("x_powered_by") or server_disclosure.get("x_aspnet_version") or ""
        findings.append(
            Finding(
                check_type="deep_server",
                name="Application Framework Version Disclosure",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-3,
                title="Application Framework Header Disclosed",
                summary=f"The application revealed its underlying backend technology: '{fw_val}'.",
                why_it_matters="Revealing framework technology and version simplifies targeted reconnaissance for framework-specific vulnerabilities.",
                how_to_fix="Remove or disable the 'X-Powered-By' and framework-specific headers in application middleware.",
                estimated_fix_minutes=10,
                documentation_url="https://scanly.io/docs/server-information-disclosure",
                evidence=f"X-Powered-By / Framework: {fw_val}",
            )
        )

    # 4. Soft-404 Status Inconsistency (INFO / LOW)
    if soft_404s:
        sample_url = soft_404s[0]
        findings.append(
            Finding(
                check_type="deep_http",
                name="Soft-404 Status Code Inconsistency",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="Soft-404 Status Inconsistency Detected",
                summary=f"Endpoint '{sample_url}' returned HTTP 200 OK while displaying missing-page error content.",
                why_it_matters="Soft-404 responses degrade search indexing, confuse API clients, and prevent automated error reporting from detecting broken links.",
                how_to_fix="Configure application error handlers to return genuine HTTP 404 Not Found or 410 Gone status codes.",
                estimated_fix_minutes=15,
                documentation_url="https://scanly.io/docs/http-status-codes",
                evidence=f"Soft-404 observed on: {', '.join(soft_404s[:3])}",
            )
        )

    # 5. Directory Listing Exposure (LOW / MEDIUM)
    if directory_listings:
        sample_dir = directory_listings[0]
        findings.append(
            Finding(
                check_type="deep_directory",
                name="Web Server Directory Listing Exposed",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-5,
                title="Server Directory Autoindex Listing Exposed",
                summary=f"Publicly accessible directory listing detected on: {sample_dir}.",
                why_it_matters="Directory listings reveal folder structures and file names, facilitating unauthorized asset indexing.",
                how_to_fix="Disable directory indexing in web server configuration ('Options -Indexes' in Apache, 'autoindex off;' in nginx).",
                estimated_fix_minutes=10,
                documentation_url="https://scanly.io/docs/directory-listing-prevention",
                evidence=f"Directory index on: {', '.join(directory_listings[:3])}",
            )
        )

    # 6. Sensitive Backup / Export Files (HIGH)
    if sensitive_files:
        sample_file = sensitive_files[0]
        findings.append(
            Finding(
                check_type="deep_directory",
                name="Exposed Backup or Database Export File",
                status=CheckStatus.HIGH,
                severity=Severity.HIGH,
                score_impact=-15,
                title="Potentially Sensitive Backup or Export File Discovered",
                summary=f"Naturally discovered public resource appears to be a database dump or backup file: {sample_file}.",
                why_it_matters="Publicly accessible database exports or archive files can lead to catastrophic data disclosure.",
                how_to_fix="Immediately remove backup files from web-accessible directories. Restrict storage to secure private buckets.",
                estimated_fix_minutes=15,
                documentation_url="https://scanly.io/docs/secure-file-storage",
                evidence=f"Exposed backup file: {sample_file}",
            )
        )

    # 7. Redirect Parameters Observed (INFO)
    if redirect_params:
        params_summary = ", ".join(f"{p['parameter']} ({p['path']})" for p in redirect_params[:3])
        findings.append(
            Finding(
                check_type="deep_http",
                name="Potential Redirect Parameters Identified",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="Redirect-Controlled Query Parameters Observed",
                summary=f"Observed URL query parameters designed for destination redirection: {params_summary}.",
                why_it_matters="If redirection parameters do not strictly validate destination hosts, they can be abused in phishing and open redirect attacks.",
                how_to_fix="Validate redirection targets against an allowlist of internal relative paths or trusted domains.",
                estimated_fix_minutes=15,
                documentation_url="https://scanly.io/docs/secure-redirect-handling",
                evidence=f"Parameters: {params_summary}. Exploitability was not tested.",
            )
        )

    return findings
