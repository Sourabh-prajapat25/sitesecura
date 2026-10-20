"""
Scanly Scanner Engine - API Security, Documentation & Surface Intelligence (Phase F4)
Performs bounded, passive inspection of API documentation (OpenAPI/Swagger),
GraphQL endpoints, health/metrics endpoints, endpoint classification,
sensitive JSON response fields, rate-limit header observations, and auth signals.
Strictly passive; does NOT attempt brute-force, fuzzing, auth bypass, or mutations.
"""
import json
import re
from typing import Dict, List, Optional, Any, Tuple, Set
from urllib.parse import urlparse, urljoin

from scanner.models import Finding, CheckStatus, Severity
from .secrets import mask_secret

DOCS_PATHS = [
    "/openapi.json",
    "/swagger.json",
    "/api-docs",
    "/docs",
    "/swagger-ui.html",
    "/swagger",
    "/redoc",
]

WELL_KNOWN_PATHS = [
    "/.well-known/security.txt",
]

HEALTH_METRICS_PATHS = [
    "/health",
    "/healthz",
    "/ready",
    "/metrics",
]

SENSITIVE_JSON_KEYS = {
    "password_hash": "Password Hash",
    "passwordhash": "Password Hash",
    "private_key": "Private Key",
    "privatekey": "Private Key",
    "client_secret": "OAuth Client Secret",
    "clientsecret": "OAuth Client Secret",
    "secret_key": "Secret Key",
    "access_token": "Access Token",
    "refresh_token": "Refresh Token",
    "database_url": "Database Connection String",
    "connection_string": "Database Connection String",
}

INTERNAL_HOST_PATTERNS = [
    re.compile(r"^https?://(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|127\.0\.0\.1|localhost)(?::\d+)?", re.IGNORECASE),
    re.compile(r"^https?://[a-zA-Z0-9_-]+\.(?:internal|corp|local|lan|vpc)(?::\d+)?", re.IGNORECASE),
]


def classify_api_endpoint(url_or_path: str) -> str:
    """
    Deterministically classifies an API endpoint into standard categories.
    """
    p = urlparse(url_or_path).path.lower()
    if any(k in p for k in ["/auth", "/login", "/logout", "/token", "/session", "/oauth", "/saml"]):
        return "AUTH"
    if any(k in p for k in ["/admin", "/manage", "/dashboard/admin"]):
        return "ADMIN"
    if any(k in p for k in ["/user", "/users", "/profile", "/account"]) or p == "/me" or "/me/" in p or p.endswith("/me"):
        return "USER"
    if any(k in p for k in ["/pay", "/payment", "/checkout", "/billing", "/stripe", "/invoice"]):
        return "PAYMENT"
    if any(k in p for k in ["/upload", "/file", "/attachment", "/media"]):
        return "UPLOAD"
    if any(k in p for k in ["/docs", "/swagger", "/openapi", "/redoc", "/api-docs"]):
        return "DOCUMENTATION"
    if any(k in p for k in ["/health", "/healthz", "/ready", "/status", "/ping"]):
        return "HEALTH"
    if any(k in p for k in ["/metrics", "/prometheus"]):
        return "METRICS"
    if "/graphql" in p:
        return "GRAPHQL"
    if any(k in p for k in ["/internal", "/private", "/backend"]):
        return "INTERNAL"
    if p.startswith("/api/"):
        return "PUBLIC"
    return "UNKNOWN"


def parse_openapi_spec_safely(
    raw_content: str,
    max_depth: int = 10,
    max_keys: int = 2000,
) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    Safely parses an OpenAPI / Swagger document in JSON format.
    Extracts paths, servers, security schemes, and detects missing security declarations.
    """
    try:
        data = json.loads(raw_content)
    except Exception as exc:
        return {}, f"JSON parse error: {str(exc)}"

    if not isinstance(data, dict):
        return {}, "Root of schema is not a dictionary"

    openapi_version = data.get("openapi") or data.get("swagger", "")
    title = data.get("info", {}).get("title", "API Schema")
    servers = [s.get("url", "") for s in data.get("servers", []) if isinstance(s, dict)]
    if not servers and "host" in data:
        servers.append(data.get("host"))

    # Security schemes defined in schema
    components = data.get("components", {})
    sec_schemes = components.get("securitySchemes", {}) or data.get("securityDefinitions", {})
    declared_schemes = list(sec_schemes.keys()) if isinstance(sec_schemes, dict) else []

    # Paths and endpoints
    paths_data = data.get("paths", {})
    discovered_routes: List[Dict[str, Any]] = []
    missing_sec_paths: List[str] = []
    internal_server_urls: List[str] = []

    # Check for internal server URLs in declared servers
    for s_url in servers:
        for pat in INTERNAL_HOST_PATTERNS:
            if pat.search(s_url):
                internal_server_urls.append(s_url)

    if isinstance(paths_data, dict):
        key_count = 0
        for path_str, path_obj in paths_data.items():
            key_count += 1
            if key_count > max_keys:
                break
            if not isinstance(path_obj, dict):
                continue
            for method, op_obj in path_obj.items():
                if method.lower() in ("get", "post", "put", "delete", "patch", "options", "head"):
                    is_sensitive = classify_api_endpoint(path_str) in ("ADMIN", "USER", "PAYMENT", "AUTH")
                    has_op_sec = isinstance(op_obj, dict) and bool(op_obj.get("security"))
                    has_global_sec = bool(data.get("security"))
                    is_secured = has_op_sec or has_global_sec

                    discovered_routes.append({
                        "path": path_str,
                        "method": method.upper(),
                        "category": classify_api_endpoint(path_str),
                        "has_security": is_secured,
                    })

                    if is_sensitive and not is_secured:
                        missing_sec_paths.append(f"{method.upper()} {path_str}")

    return {
        "is_valid": True,
        "openapi_version": str(openapi_version),
        "title": title,
        "servers": servers,
        "internal_server_urls": list(set(internal_server_urls)),
        "declared_security_schemes": declared_schemes,
        "total_paths": len(discovered_routes),
        "discovered_routes": discovered_routes[:30],
        "sensitive_paths_missing_security": list(set(missing_sec_paths))[:10],
    }, None


def inspect_json_response_for_sensitive_fields(
    raw_content: str,
    url: str,
    max_depth: int = 10,
    max_items: int = 500,
) -> List[Dict[str, Any]]:
    """
    Recursively inspects a JSON response body for sensitive field disclosures.
    Differentiates safe { "password": null } from actual credential exposures.
    """
    try:
        data = json.loads(raw_content)
    except Exception:
        return []

    sensitive_exposures: List[Dict[str, Any]] = []

    def _traverse(obj: Any, depth: int):
        if depth > max_depth or len(sensitive_exposures) >= 15:
            return
        if isinstance(obj, dict):
            for k, v in list(obj.items())[:max_items]:
                clean_k = k.lower().replace("-", "_")
                if clean_k in SENSITIVE_JSON_KEYS:
                    # Ignore null, boolean, or empty string values
                    if v is not None and v != "" and not isinstance(v, bool):
                        str_val = str(v)
                        # Ignore placeholder or short values
                        if len(str_val) >= 4 and not str_val.lower().startswith("redact"):
                            sensitive_exposures.append({
                                "field_name": k,
                                "field_type": SENSITIVE_JSON_KEYS[clean_k],
                                "masked_value": mask_secret(str_val),
                                "url": url,
                            })
                _traverse(v, depth + 1)
        elif isinstance(obj, list):
            for item in obj[:max_items]:
                _traverse(item, depth + 1)

    _traverse(data, depth=0)
    return sensitive_exposures


def parse_security_txt(content: str, url: str) -> Dict[str, Any]:
    """
    Extracts security.txt directives according to RFC 9116.
    """
    directives: Dict[str, List[str]] = {}
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            field_name, field_val = line.split(":", 1)
            directives.setdefault(field_name.strip().title(), []).append(field_val.strip())
    
    return {
        "is_present": True,
        "url": url,
        "contact": directives.get("Contact", []),
        "expires": directives.get("Expires", [None])[0],
        "encryption": directives.get("Encryption", []),
        "policy": directives.get("Policy", [None])[0],
        "canonical": directives.get("Canonical", [None])[0],
    }


def extract_rate_limit_headers(headers: Dict[str, str]) -> Dict[str, Any]:
    """
    Passively observes standard rate-limit headers in HTTP responses.
    """
    lower = {k.lower(): v for k, v in headers.items()}
    limit = lower.get("ratelimit-limit") or lower.get("x-ratelimit-limit")
    remaining = lower.get("ratelimit-remaining") or lower.get("x-ratelimit-remaining")
    reset = lower.get("ratelimit-reset") or lower.get("x-ratelimit-reset")
    retry_after = lower.get("retry-after")

    observed = bool(limit or remaining or reset or retry_after)
    return {
        "observed": observed,
        "limit": limit,
        "remaining": remaining,
        "reset": reset,
        "retry_after": retry_after,
    }


def build_api_security_findings(
    docs_analyses: List[Dict[str, Any]],
    sensitive_json_fields: List[Dict[str, Any]],
    health_disclosures: List[Dict[str, Any]],
    graphql_info: Dict[str, Any],
    admin_endpoints: List[str],
) -> List[Finding]:
    """
    Compiles canonical findings for API documentation, schemas, GraphQL, and sensitive field leaks.
    """
    findings: List[Finding] = []

    # 1. Sensitive JSON Response Leak (HIGH / CRITICAL)
    if sensitive_json_fields:
        sample = sensitive_json_fields[0]
        fields_str = ", ".join(f"{f['field_name']} ({f['field_type']})" for f in sensitive_json_fields[:3])
        evidence_text = f"Endpoint '{sample['url']}' exposed sensitive field: {fields_str} [Value: {sample['masked_value']}]"
        findings.append(
            Finding(
                check_type="deep_api",
                name="Sensitive Field Exposure in API Response",
                status=CheckStatus.HIGH,
                severity=Severity.HIGH,
                score_impact=-15,
                title="Sensitive Data Field Exposed in Public API Response",
                summary=f"Public API endpoint on {sample['url']} returned responses containing sensitive fields: {fields_str}.",
                why_it_matters="Publicly leaking credential hashes, secrets, or database connection strings allows attackers to impersonate users or compromise backends.",
                how_to_fix="Ensure API serializers exclude sensitive entity attributes (passwords, tokens, connection strings) before returning responses.",
                estimated_fix_minutes=20,
                documentation_url="https://scanly.io/docs/secure-api-serialization",
                evidence=evidence_text,
            )
        )

    # 2. Internal Server URL in OpenAPI Spec (LOW)
    internal_urls: List[str] = []
    for doc in docs_analyses:
        internal_urls.extend(doc.get("internal_server_urls", []))
    if internal_urls:
        sample_url = internal_urls[0]
        findings.append(
            Finding(
                check_type="deep_api",
                name="Internal Server URL Disclosed in API Schema",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-4,
                title="Internal Infrastructure URL Declared in API Schema",
                summary=f"Published OpenAPI schema revealed internal hostnames or private network IP addresses: {sample_url}.",
                why_it_matters="Disclosing internal server addresses exposes internal network topology and helps adversaries craft SSRF attack vectors.",
                how_to_fix="Configure API documentation generators to declare only public, customer-facing gateway URLs in OpenAPI 'servers'.",
                estimated_fix_minutes=15,
                documentation_url="https://scanly.io/docs/openapi-security-best-practices",
                evidence=f"Internal URL in schema: {', '.join(internal_urls[:3])}",
            )
        )

    # 3. Missing Security Declaration in OpenAPI Spec (LOW / INFO)
    missing_sec_routes: List[str] = []
    for doc in docs_analyses:
        missing_sec_routes.extend(doc.get("sensitive_paths_missing_security", []))
    if missing_sec_routes:
        sample_routes = ", ".join(missing_sec_routes[:3])
        findings.append(
            Finding(
                check_type="deep_api",
                name="API Schema Missing Security Requirement",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="Sensitive Endpoints Lack Security Declaration in API Schema",
                summary=f"The published API schema does not declare an authentication requirement for sensitive paths: {sample_routes}.",
                why_it_matters="Undocumented security requirements confuse API consumers and may indicate a missing authentication middleware in implementation.",
                how_to_fix="Verify whether these endpoints enforce authentication. If secured, declare appropriate securitySchemes in the OpenAPI definition.",
                estimated_fix_minutes=15,
                documentation_url="https://scanly.io/docs/openapi-security-best-practices",
                evidence=f"Sensitive routes with no declared security: {sample_routes}. Exploitability was not tested.",
            )
        )

    # 4. Public API Documentation Discovered (INFO)
    valid_docs = [d for d in docs_analyses if d.get("is_valid")]
    if valid_docs:
        sample_doc = valid_docs[0]
        findings.append(
            Finding(
                check_type="deep_api",
                name="Public API Documentation Discovered",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="Public Interactive API Documentation Discovered",
                summary=f"Discovered accessible API documentation ({sample_doc.get('title', 'API Spec')}) with {sample_doc.get('total_paths', 0)} declared routes.",
                why_it_matters="Public API documentation allows automated discovery of API endpoints and models.",
                how_to_fix="If this API is intended for public consumption, maintain up-to-date schema definitions. If internal, restrict access with authentication.",
                estimated_fix_minutes=10,
                documentation_url="https://scanly.io/docs/public-api-documentation",
                evidence=f"Documented routes: {sample_doc.get('total_paths', 0)}",
            )
        )

    # 5. Public GraphQL Endpoint Discovered (INFO)
    if graphql_info.get("is_public"):
        findings.append(
            Finding(
                check_type="deep_graphql",
                name="Public GraphQL API Endpoint Discovered",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="Public GraphQL Endpoint Discovered",
                summary=f"Discovered accessible GraphQL endpoint on {graphql_info.get('url', '/graphql')}.",
                why_it_matters="GraphQL APIs should enforce query depth limiting, cost analysis, and disable public introspection in production.",
                how_to_fix="Ensure query complexity limits are enforced and disable schema introspection in production environments.",
                estimated_fix_minutes=15,
                documentation_url="https://scanly.io/docs/graphql-security",
                evidence=f"Endpoint: {graphql_info.get('url')}. SiteSecura did not perform introspection or mutations.",
            )
        )

    # 6. Administrative API Surface Discovered (INFO)
    if admin_endpoints:
        sample_admin = admin_endpoints[0]
        findings.append(
            Finding(
                check_type="deep_auth",
                name="Administrative API Surface Discovered",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="Administrative API Surface Identified",
                summary=f"Administrative endpoint(s) discovered: {', '.join(admin_endpoints[:3])}.",
                why_it_matters="Administrative routes require strict access controls, session validation, and multi-factor authentication.",
                how_to_fix="Ensure robust authentication and authorization checks are enforced on all administrative handlers.",
                estimated_fix_minutes=15,
                documentation_url="https://scanly.io/docs/api-authorization-best-practices",
                evidence=f"Discovered: {', '.join(admin_endpoints[:3])}. SiteSecura did not attempt authorization bypass testing.",
            )
        )

    return findings
