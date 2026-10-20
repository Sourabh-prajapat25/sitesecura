"""
Scanly Scanner Engine - Error & Debug Exposure Analyzer (Phase F4)
Detects server-side stack traces, framework debug pages, database disclosures,
and internal filesystem paths from naturally observed error responses.
Applies strict evidence sanitization and secret masking.
"""
import re
from typing import Dict, List, Optional, Any, Tuple
from scanner.models import Finding, CheckStatus, Severity
from .secrets import mask_secret

# High-precision stack trace regex patterns
STACK_TRACE_PATTERNS = [
    ("Python", re.compile(r"Traceback \(most recent call last\):", re.IGNORECASE)),
    ("Python", re.compile(r'File "([^"]+)", line \d+, in ', re.IGNORECASE)),
    ("Node.js", re.compile(r"at (?:async\s+)?[a-zA-Z0-9_$.<>\[\]\s]+\s*\([^)]+:\d+:\d+\)")),
    ("Node.js", re.compile(r"at processTicksAndRejections\s*\(node:internal")),
    ("Java", re.compile(r"java\.lang\.[A-Za-z]+Exception:")),
    ("Java", re.compile(r"\tat (?:com|org|net|io|java)\.[a-zA-Z0-9_$.]+\([^)]+:\d+\)")),
    (".NET", re.compile(r"System\.[A-Za-z]+Exception:")),
    (".NET", re.compile(r"\tat (?:System|Microsoft)\.[a-zA-Z0-9_$.]+\(")),
    ("PHP", re.compile(r"Fatal error:\s*Uncaught\s+[A-Za-z0-9_\\]*Exception", re.IGNORECASE)),
    ("PHP", re.compile(r"Stack trace:\s*#0\s+")),
    ("Ruby", re.compile(r"from [^:\s]+:\d+:in `[^']+'")),
]

# Database error signatures
DATABASE_ERROR_PATTERNS = [
    ("SQL/Generic", re.compile(r"SQLSTATE\[[A-Z0-9]{5}\]", re.IGNORECASE)),
    ("PostgreSQL", re.compile(r"syntax error at or near \"[^\"]+\"", re.IGNORECASE)),
    ("PostgreSQL", re.compile(r"pg_query\(\):\s*Query failed:", re.IGNORECASE)),
    ("MySQL", re.compile(r"You have an error in your SQL syntax; check the manual", re.IGNORECASE)),
    ("MySQL", re.compile(r"mysql_fetch_array\(\)\s*expects parameter", re.IGNORECASE)),
    ("Oracle", re.compile(r"ORA-\d{5}:", re.IGNORECASE)),
    ("SQL Server", re.compile(r"Unclosed quotation mark after the character string", re.IGNORECASE)),
    ("SQLite", re.compile(r"SQLite3::SQLException:", re.IGNORECASE)),
]

# Server-side framework debug pages
DEBUG_PAGE_PATTERNS = [
    ("Werkzeug", re.compile(r"Werkzeug powered traceback interpreter", re.IGNORECASE)),
    ("Werkzeug", re.compile(r"The debugger caught an exception in your WSGI application", re.IGNORECASE)),
    ("Django", re.compile(r"You're seeing this error because you have DEBUG = True in your Django settings", re.IGNORECASE)),
    ("Laravel Ignition", re.compile(r"Spatie\\LaravelIgnition", re.IGNORECASE)),
    ("Laravel Ignition", re.compile(r"ignition-theme", re.IGNORECASE)),
    ("Spring Boot", re.compile(r"Whitelabel Error Page", re.IGNORECASE)),
    ("Spring Boot", re.compile(r"This application has no explicit mapping for /error", re.IGNORECASE)),
    ("ASP.NET", re.compile(r"Server Error in '[^']+' Application\.", re.IGNORECASE)),
    ("ASP.NET", re.compile(r"Runtime Error.*?An application error occurred on the server", re.DOTALL | re.IGNORECASE)),
]

# Leaked internal filesystem paths
INTERNAL_PATH_PATTERN = re.compile(
    r"(?:/home/[a-zA-Z0-9_-]+/[^\s\"'<>]+|/var/www/[^\s\"'<>]+|[A-Za-z]:\\[Uu]sers\\[a-zA-Z0-9_-]+\\[^\s\"'<>]+|[A-Za-z]:\\inetpub\\[^\s\"'<>]+|/app/src/[^\s\"'<>]+)",
    re.IGNORECASE,
)


def sanitize_error_snippet(snippet: str, max_length: int = 500) -> str:
    """Sanitizes error text to eliminate sensitive credentials before storage."""
    # Redact common token patterns
    sanitized = re.sub(r'(?i)(bearer\s+)[A-Za-z0-9._~+/-]{15,}', r'\1[REDACTED]', snippet)
    sanitized = re.sub(r'(?i)(password|secret|apikey|api_key|token)[=:]\s*["\']?[^\s"\'&,;]+["\']?', r'\1=[REDACTED]', sanitized)
    sanitized = re.sub(r'(?i)(set-cookie:\s*)[^\r\n]+', r'\1[REDACTED]', sanitized)
    return sanitized[:max_length].strip()


def inspect_response_for_errors(
    url: str,
    status_code: Optional[int],
    body_text: Optional[str],
    headers: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Passively scans a response body for stack traces, database errors,
    debug pages, and internal filesystem paths.
    """
    result: Dict[str, Any] = {
        "url": url,
        "status_code": status_code,
        "stack_traces": [],
        "database_errors": [],
        "debug_pages": [],
        "internal_paths": [],
    }

    if not body_text or len(body_text.strip()) == 0:
        return result

    # Check for Stack Traces
    for language, pattern in STACK_TRACE_PATTERNS:
        match = pattern.search(body_text)
        if match:
            start_pos = max(0, match.start() - 50)
            end_pos = min(len(body_text), match.end() + 150)
            context = sanitize_error_snippet(body_text[start_pos:end_pos])
            result["stack_traces"].append({
                "language": language,
                "matched_text": match.group(0),
                "context": context,
            })
            break

    # Check for Database Disclosures
    for db_engine, pattern in DATABASE_ERROR_PATTERNS:
        match = pattern.search(body_text)
        if match:
            start_pos = max(0, match.start() - 30)
            end_pos = min(len(body_text), match.end() + 100)
            context = sanitize_error_snippet(body_text[start_pos:end_pos])
            result["database_errors"].append({
                "engine": db_engine,
                "matched_text": match.group(0),
                "context": context,
            })
            break

    # Check for Debug Mode / Framework Debug Pages
    for framework, pattern in DEBUG_PAGE_PATTERNS:
        match = pattern.search(body_text)
        if match:
            result["debug_pages"].append({
                "framework": framework,
                "matched_text": match.group(0),
                "context": sanitize_error_snippet(match.group(0), 200),
            })
            break

    # Check for Internal Filesystem Paths
    path_matches = INTERNAL_PATH_PATTERN.findall(body_text)
    if path_matches:
        unique_paths = list(dict.fromkeys(path_matches))[:5]
        result["internal_paths"] = unique_paths

    return result


def build_error_findings(inspections: List[Dict[str, Any]]) -> List[Finding]:
    """
    Compiles canonical error disclosure findings from multiple page inspections.
    """
    findings: List[Finding] = []
    
    traces = [i for i in inspections if i.get("stack_traces")]
    db_errors = [i for i in inspections if i.get("database_errors")]
    debug_pages = [i for i in inspections if i.get("debug_pages")]
    path_leaks = [i for i in inspections if i.get("internal_paths")]

    # 1. Stack Trace Disclosure (HIGH)
    if traces:
        sample = traces[0]
        st = sample["stack_traces"][0]
        evidence_text = f"Stack trace ({st['language']}) detected on {sample['url']}:\n{st['context']}"
        findings.append(
            Finding(
                check_type="deep_error",
                name="Server Stack Trace Disclosure",
                status=CheckStatus.HIGH,
                severity=Severity.HIGH,
                score_impact=-15,
                title="Uncaught Server Stack Trace Disclosed to Public",
                summary=f"Public HTTP response on {sample['url']} exposed an unhandled {st['language']} execution traceback.",
                why_it_matters="Stack traces reveal internal code structure, library versions, filenames, and execution flow, aiding attackers in constructing targeted exploits.",
                how_to_fix="Implement global exception handling middleware. Return generic JSON error messages or custom error templates in production.",
                estimated_fix_minutes=30,
                documentation_url="https://scanly.io/docs/preventing-stack-trace-disclosure",
                evidence=evidence_text,
            )
        )

    # 2. Database Error Disclosure (HIGH)
    if db_errors:
        sample = db_errors[0]
        dbe = sample["database_errors"][0]
        evidence_text = f"Database error ({dbe['engine']}) on {sample['url']}:\n{dbe['context']}"
        findings.append(
            Finding(
                check_type="deep_error",
                name="Database Error Message Disclosure",
                status=CheckStatus.HIGH,
                severity=Severity.HIGH,
                score_impact=-15,
                title="Raw Database Error Message Exposed",
                summary=f"Public response on {sample['url']} revealed raw {dbe['engine']} database error details.",
                why_it_matters="Exposed SQL error messages confirm database dialect and schema names, and may indicate vulnerability to SQL injection.",
                how_to_fix="Catch database exceptions at the data access layer. Never surface raw driver error strings directly to client responses.",
                estimated_fix_minutes=30,
                documentation_url="https://scanly.io/docs/secure-api-error-handling",
                evidence=evidence_text,
            )
        )

    # 3. Framework Debug Mode Exposed (MEDIUM)
    if debug_pages:
        sample = debug_pages[0]
        dbg = sample["debug_pages"][0]
        evidence_text = f"Debug page ({dbg['framework']}) detected on {sample['url']}: {dbg['matched_text']}"
        findings.append(
            Finding(
                check_type="deep_error",
                name="Application Debug Mode Active in Production",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-10,
                title=f"{dbg['framework']} Debug Mode Active in Production",
                summary=f"Public response on {sample['url']} rendered an active {dbg['framework']} interactive debug/diagnostic screen.",
                why_it_matters="Framework debug modes expose environment configurations, request metadata, and sometimes interactive diagnostic consoles.",
                how_to_fix="Ensure debug mode is disabled in production environment configuration (e.g. DEBUG=False, NODE_ENV=production).",
                estimated_fix_minutes=15,
                documentation_url="https://scanly.io/docs/disable-production-debug-mode",
                evidence=evidence_text,
            )
        )

    # 4. Internal Filesystem Path Disclosure (LOW)
    if path_leaks and not traces:
        sample = path_leaks[0]
        paths_str = ", ".join(sample["internal_paths"][:3])
        evidence_text = f"Internal server paths exposed on {sample['url']}: {paths_str}"
        findings.append(
            Finding(
                check_type="deep_error",
                name="Internal Server Filesystem Path Disclosure",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-4,
                title="Internal Server Filesystem Paths Disclosed",
                summary=f"HTTP response on {sample['url']} exposed server filesystem path references: {paths_str}",
                why_it_matters="Disclosing server directory layouts assists adversaries in mapping target environments and identifying deployment user accounts.",
                how_to_fix="Sanitize error output and server responses to remove local filesystem path references.",
                estimated_fix_minutes=15,
                documentation_url="https://scanly.io/docs/prevent-path-disclosure",
                evidence=evidence_text,
            )
        )

    # Pass check if inspected pages contain no errors
    if not findings and inspections:
        findings.append(
            Finding(
                check_type="deep_error",
                name="Error Handling Security Baseline Verified",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="No Stack Traces or Debug Pages Exposed",
                summary="Observed HTTP responses do not leak server stack traces, database errors, or framework debug consoles.",
                why_it_matters="Sanitized error handling prevents unauthorized intelligence gathering.",
                how_to_fix="Continue enforcing production exception handling standards.",
                estimated_fix_minutes=0,
                documentation_url="https://scanly.io/docs/secure-api-error-handling",
                evidence="Inspected responses showed clean error handling.",
            )
        )

    return findings
