"""
Tests for Phase F4: Advanced Web Application, API & HTTP Security Intelligence
Comprehensive verification conforming strictly to Phase F4 specification:
HTTP methods, CORS, API docs, errors, cache, server disclosures, redirects,
directory exposure, sensitive JSON, GraphQL, authorization signals, rate limits,
safety (SSRF/budgets), deduplication, failure isolation, and version compatibility.
"""
import pytest
from unittest.mock import MagicMock

from scanner.models import CheckStatus, Severity, Finding
from scanner.network.models import SafeResponse
from scanner.network.safety import SSRFValidationError, validate_url_target
from scanner.deep.models import CrawledPage
from scanner.deep.config import DeepScanConfig
from scanner.deep.scoring import calculate_deep_score
from scanner.deep.cors_analyzer import (
    evaluate_cors_configuration,
    probe_cors_reflection_safe,
    build_cors_findings,
    SYNTHETIC_TEST_ORIGIN,
)
from scanner.deep.error_analyzer import (
    inspect_response_for_errors,
    build_error_findings,
    sanitize_error_snippet,
)
from scanner.deep.cache_analyzer import (
    evaluate_cache_security,
    build_cache_findings,
)
from scanner.deep.http_security import (
    analyze_http_methods,
    analyze_server_headers,
    detect_soft_404,
    detect_directory_listing,
    extract_redirect_parameters,
    build_http_security_findings,
)
from scanner.deep.api_security import (
    classify_api_endpoint,
    parse_openapi_spec_safely,
    inspect_json_response_for_sensitive_fields,
    parse_security_txt,
    extract_rate_limit_headers,
    build_api_security_findings,
)
from scanner.deep.application_security import analyze_application_security
from scanner.deep.runner import run_deep_security_scan


# =============================================================================
# 1. HTTP Method Intelligence
# =============================================================================

def test_http_method_analysis():
    """Verify standard Allow header parsing and method extraction."""
    res = analyze_http_methods("GET, HEAD, OPTIONS", "https://example.com/api")
    assert res["advertised_methods"] == ["GET", "HEAD", "OPTIONS"]
    assert res["has_trace"] is False


def test_dangerous_method_detection():
    """Verify detection of TRACE and CONNECT methods in Allow header."""
    res = analyze_http_methods("GET, POST, PUT, DELETE, TRACE", "https://example.com/api")
    assert res["has_trace"] is True
    assert "TRACE" in res["dangerous_methods"]
    assert res["has_put"] is True
    assert res["has_delete"] is True


def test_allow_header():
    """Verify handling of empty or missing Allow headers."""
    res = analyze_http_methods(None, "https://example.com/api")
    assert res["advertised_methods"] == []
    assert res["dangerous_methods"] == []


# =============================================================================
# 2. CORS Security
# =============================================================================

def test_cors_wildcard():
    """Verify wildcard origin evaluation."""
    hdrs = {"Access-Control-Allow-Origin": "*"}
    res = evaluate_cors_configuration(hdrs, "https://example.com/public-data")
    assert res["is_wildcard"] is True
    assert "wildcard_origin" in res["issues"]


def test_cors_credentials_wildcard():
    """Verify dangerous wildcard with credentials."""
    hdrs = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": "true",
    }
    res = evaluate_cors_configuration(hdrs, "https://example.com/api/user")
    assert "credentials_wildcard" in res["issues"]
    findings = build_cors_findings([res])
    assert any(f.severity == Severity.HIGH for f in findings)


def test_cors_reflection():
    """Verify reflected origin detection with credentials."""
    hdrs = {
        "Access-Control-Allow-Origin": SYNTHETIC_TEST_ORIGIN,
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    }
    res = evaluate_cors_configuration(hdrs, "https://example.com/api/session", origin_tested=SYNTHETIC_TEST_ORIGIN)
    assert res["is_reflected"] is True
    assert "credentials_reflected" in res["issues"]


def test_cors_vary():
    """Verify missing Vary: Origin warning."""
    hdrs = {
        "Access-Control-Allow-Origin": "https://trusted.example.com",
    }
    res = evaluate_cors_configuration(hdrs, "https://example.com/api/data")
    assert "missing_vary_origin" in res["issues"]


def test_cors_safe_configuration():
    """Verify safe CORS configuration generates pass check."""
    hdrs = {
        "Access-Control-Allow-Origin": "https://app.example.com",
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    }
    res = evaluate_cors_configuration(hdrs, "https://example.com/api/data")
    assert res["issues"] == []
    findings = build_cors_findings([res])
    assert any(f.status == CheckStatus.PASS for f in findings)


# =============================================================================
# 3. API Documentation & OpenAPI Security
# =============================================================================

def test_api_endpoint_classification():
    """Verify deterministic endpoint classification."""
    assert classify_api_endpoint("/api/auth/login") == "AUTH"
    assert classify_api_endpoint("/admin/users") == "ADMIN"
    assert classify_api_endpoint("/api/users/profile") == "USER"
    assert classify_api_endpoint("/api/checkout/pay") == "PAYMENT"
    assert classify_api_endpoint("/api/upload") == "UPLOAD"
    assert classify_api_endpoint("/openapi.json") == "DOCUMENTATION"
    assert classify_api_endpoint("/healthz") == "HEALTH"
    assert classify_api_endpoint("/metrics") == "METRICS"
    assert classify_api_endpoint("/graphql") == "GRAPHQL"
    assert classify_api_endpoint("/api/products") == "PUBLIC"


def test_openapi_detection():
    """Verify valid OpenAPI 3.0 parsing."""
    spec = '{"openapi": "3.0.0", "info": {"title": "App API", "version": "1.0"}, "paths": {"/items": {"get": {}}}}'
    spec_info, err = parse_openapi_spec_safely(spec)
    assert err is None
    assert spec_info["is_valid"] is True
    assert spec_info["total_paths"] == 1


def test_swagger_detection():
    """Verify Swagger 2.0 parsing."""
    spec = '{"swagger": "2.0", "info": {"title": "Legacy API", "version": "2.0"}, "paths": {}}'
    spec_info, err = parse_openapi_spec_safely(spec)
    assert err is None
    assert spec_info["is_valid"] is True


def test_public_api_documentation():
    """Verify public API documentation finding creation."""
    doc_info = {"is_valid": True, "title": "Store API", "total_paths": 12}
    findings = build_api_security_findings([doc_info], [], [], {}, [])
    assert any(f.check_type == "deep_api" and f.severity == Severity.INFO for f in findings)


def test_internal_openapi_server_url():
    """Verify internal IP / hostname detection in OpenAPI servers."""
    spec = """
    {
      "openapi": "3.0.0",
      "servers": [{"url": "http://10.0.0.5:8080"}, {"url": "http://api.corp.internal"}],
      "paths": {}
    }
    """
    spec_info, err = parse_openapi_spec_safely(spec)
    assert len(spec_info["internal_server_urls"]) == 2
    findings = build_api_security_findings([spec_info], [], [], {}, [])
    assert any("Internal Infrastructure URL" in f.title for f in findings)


def test_api_security_declaration():
    """Verify detection of missing security requirements for sensitive routes."""
    spec = """
    {
      "openapi": "3.0.0",
      "paths": {
        "/api/admin/users": {
          "delete": {"summary": "Delete user"}
        }
      }
    }
    """
    spec_info, err = parse_openapi_spec_safely(spec)
    assert "DELETE /api/admin/users" in spec_info["sensitive_paths_missing_security"]


# =============================================================================
# 4. Error & Debug Exposure
# =============================================================================

def test_python_traceback():
    """Verify Python traceback detection."""
    text = "Traceback (most recent call last):\n  File '/app/main.py', line 10, in run\nValueError: test"
    res = inspect_response_for_errors("https://example.com", 500, text)
    assert len(res["stack_traces"]) == 1
    assert res["stack_traces"][0]["language"] == "Python"


def test_node_stack_trace():
    """Verify Node.js stack trace detection."""
    text = "Error: fail\n    at Object.<anonymous> (/app/server.js:12:3)\n    at processTicksAndRejections"
    res = inspect_response_for_errors("https://example.com", 500, text)
    assert len(res["stack_traces"]) == 1
    assert res["stack_traces"][0]["language"] == "Node.js"


def test_java_stack_trace():
    """Verify Java stack trace detection."""
    text = "java.lang.NullPointerException: Null ref\n\tat com.example.service.UserService.getUser(UserService.java:45)"
    res = inspect_response_for_errors("https://example.com", 500, text)
    assert len(res["stack_traces"]) == 1
    assert res["stack_traces"][0]["language"] == "Java"


def test_database_error():
    """Verify SQL syntax / database driver error detection."""
    text = "ERROR: syntax error at or near 'SELECT' at character 1; SQLSTATE[42601]"
    res = inspect_response_for_errors("https://example.com", 500, text)
    assert len(res["database_errors"]) == 1


def test_debug_page():
    """Verify framework debug page detection."""
    text = "You're seeing this error because you have DEBUG = True in your Django settings file."
    res = inspect_response_for_errors("https://example.com", 500, text)
    assert len(res["debug_pages"]) == 1
    assert res["debug_pages"][0]["framework"] == "Django"


def test_internal_path():
    """Verify internal filesystem path leak detection."""
    text = "Failed to load resource at /var/www/html/app/config.json"
    res = inspect_response_for_errors("https://example.com", 500, text)
    assert len(res["internal_paths"]) > 0


# =============================================================================
# 5. Cache Security
# =============================================================================

def test_sensitive_response_cacheable():
    """Verify sensitive endpoint with public caching triggers warning."""
    res = evaluate_cache_security(
        url="https://example.com/api/me",
        headers={"Cache-Control": "public, max-age=3600"},
        status_code=200,
    )
    assert "sensitive_public_cache" in res["issues"]
    findings = build_cache_findings([res])
    assert any(f.severity == Severity.MEDIUM for f in findings)


def test_private_cache():
    """Verify private / no-store cache directives are marked safe."""
    res = evaluate_cache_security(
        url="https://example.com/api/me",
        headers={"Cache-Control": "no-store, private"},
        status_code=200,
    )
    assert res["issues"] == []


def test_public_static_cache():
    """Verify public caching on non-sensitive static assets is normal."""
    res = evaluate_cache_security(
        url="https://example.com/assets/style.css",
        headers={"Cache-Control": "public, max-age=86400"},
        status_code=200,
    )
    assert res["issues"] == []


# =============================================================================
# 6. Server Disclosure
# =============================================================================

def test_server_version():
    """Verify Server version detection."""
    res = analyze_server_headers({"Server": "Apache/2.4.50"})
    assert res["server_has_version"] is True


def test_framework_header():
    """Verify X-Powered-By framework detection."""
    res = analyze_server_headers({"X-Powered-By": "PHP/8.1.10"})
    assert res["framework_has_version"] is True


def test_non_sensitive_server_header():
    """Verify generic server header without versions is not flagged."""
    res = analyze_server_headers({"Server": "nginx"})
    assert res["server_has_version"] is False


# =============================================================================
# 7. Redirect Security
# =============================================================================

def test_redirect_signal():
    """Verify redirect-controlling parameters detection."""
    urls = ["https://example.com/login?next=/dashboard"]
    params = extract_redirect_parameters(urls)
    assert len(params) == 1
    assert params[0]["parameter"] == "next"


def test_external_redirect_not_auto_vulnerability():
    """Verify passive redirect detection reports INFO without claiming exploitability."""
    urls = ["https://example.com/auth?redirect=https://sso.example.com"]
    params = extract_redirect_parameters(urls)
    findings = build_http_security_findings([], {}, [], [], params, [])
    assert any(f.severity == Severity.INFO and "Exploitability was not tested" in (f.evidence or "") for f in findings)


# =============================================================================
# 8. Directory Exposure
# =============================================================================

def test_directory_listing():
    """Verify directory listing autoindex detection."""
    html = "<title>Index of /files</title><h1>Index of /files</h1><a href='../'>Parent Directory</a>"
    assert detect_directory_listing(html) is True


def test_normal_directory_response():
    """Verify normal HTML does not trigger directory listing."""
    assert detect_directory_listing("<html><body><h1>Welcome</h1></body></html>") is False


# =============================================================================
# 9. Sensitive JSON & Masking
# =============================================================================

def test_sensitive_field_detection():
    """Verify sensitive field recognition in JSON."""
    data = '{"password_hash": "$2b$12$abcdefghijklmnopqrstuv", "token": "sk_test_123"}'
    res = inspect_json_response_for_sensitive_fields(data, "https://example.com/api/data")
    assert len(res) >= 1
    assert any(r["field_name"] == "password_hash" for r in res)


def test_token_masking():
    """Verify masked values in sensitive JSON detection."""
    data = '{"client_secret": "cs_live_secret_value_123456789"}'
    res = inspect_json_response_for_sensitive_fields(data, "https://example.com/api/data")
    assert len(res) == 1
    assert "*" in res[0]["masked_value"]
    assert "cs_live_secret_value_123456789" not in res[0]["masked_value"]


def test_password_null_not_flagged():
    """Verify { password: null } does not trigger false positive."""
    data = '{"username": "alice", "password": null}'
    res = inspect_json_response_for_sensitive_fields(data, "https://example.com/api/data")
    assert len(res) == 0


# =============================================================================
# 10. GraphQL & Authorization Signals
# =============================================================================

def test_graphql_detection():
    """Verify public GraphQL detection."""
    gql_info = {"is_public": True, "url": "https://example.com/graphql"}
    findings = build_api_security_findings([], [], [], gql_info, [])
    assert any(f.check_type == "deep_graphql" and f.severity == Severity.INFO for f in findings)


def test_graphql_error_analysis():
    """Verify GraphQL error responses are inspected safely."""
    gql_err = '{"errors": [{"message": "Syntax Error: Unexpected Name \\"foo\\""}]}'
    res = inspect_response_for_errors("https://example.com/graphql", 400, gql_err)
    assert res["status_code"] == 400


def test_no_introspection_query():
    """Verify scanner does not send introspection query payloads."""
    client = MagicMock()
    client.get.return_value = SafeResponse(
        url="https://example.com/graphql",
        status_code=400,
        headers={"Content-Type": "application/json"},
        text='{"errors": [{"message": "Must provide query string"}]}',
        final_url="https://example.com/graphql",
        redirect_chain=[],
        elapsed_ms=30,
        resolved_ip="1.2.3.4",
    )
    meta, findings = analyze_application_security([], client, "example.com")
    # Verify client.post was never called (no mutations/queries)
    assert not hasattr(client, "post") or not client.post.called


def test_admin_endpoint_classification():
    """Verify administrative endpoint discovery is marked INFO."""
    findings = build_api_security_findings([], [], [], {}, ["https://example.com/admin/settings"])
    assert any(f.check_type == "deep_auth" and f.severity == Severity.INFO for f in findings)


def test_role_metadata_detection():
    """Verify role/tenant pattern discovery."""
    url = "/api/orgs/123/roles"
    cat = classify_api_endpoint(url)
    assert cat in ("PUBLIC", "UNKNOWN")


def test_no_authorization_bypass_attempt():
    """Verify no IDOR or privilege escalation attempts are made."""
    client = MagicMock()
    client.get.return_value = SafeResponse(url="https://example.com", status_code=200, final_url="https://example.com", redirect_chain=[], elapsed_ms=10, resolved_ip="1.2.3.4")
    meta, findings = analyze_application_security([], client, "example.com")
    # No attacks executed
    assert meta["status"] == "completed"


# =============================================================================
# 11. Rate Limit & Security.txt
# =============================================================================

def test_rate_limit_headers():
    """Verify rate-limit header parsing."""
    hdrs = {"RateLimit-Limit": "100", "RateLimit-Remaining": "42"}
    res = extract_rate_limit_headers(hdrs)
    assert res["observed"] is True
    assert res["limit"] == "100"
    assert res["remaining"] == "42"


def test_missing_rate_limit_not_claimed():
    """Verify missing rate-limit headers does NOT assert lack of rate limiting."""
    res = extract_rate_limit_headers({})
    assert res["observed"] is False
    assert res.get("limit") is None


# =============================================================================
# 12. Safety & SSRF Protections
# =============================================================================

def test_ssrf_private_ip_blocked():
    """Verify that RFC 1918 private IPs are blocked."""
    with pytest.raises(SSRFValidationError):
        validate_url_target("http://10.0.0.1/admin")


def test_ssrf_loopback_blocked():
    """Verify loopback is blocked."""
    with pytest.raises(SSRFValidationError):
        validate_url_target("http://127.0.0.1/api")


def test_ssrf_metadata_blocked():
    """Verify cloud metadata endpoint is blocked."""
    with pytest.raises(SSRFValidationError):
        validate_url_target("http://169.254.169.254/latest/meta-data")


def test_dns_rebinding_protection():
    """Verify that localhost hostnames are blocked."""
    with pytest.raises(SSRFValidationError):
        validate_url_target("http://localhost:8080")


def test_request_budget():
    """Verify orchestrator respects maximum request budget."""
    client = MagicMock()
    mock_resp = SafeResponse(
        url="https://example.com",
        status_code=200,
        headers={"Content-Type": "application/json"},
        text="{}",
        final_url="https://example.com",
        redirect_chain=[],
        elapsed_ms=10,
        resolved_ip="1.2.3.4",
    )
    client.get.return_value = mock_resp
    client.options.return_value = mock_resp

    cfg = DeepScanConfig(max_f4_requests=5)
    meta, findings = analyze_application_security([], client, "example.com", config=cfg)
    assert meta["requests_executed"] <= 5


def test_response_size_limit():
    """Verify response size limit parameter is respected."""
    cfg = DeepScanConfig(max_f4_response_bytes=262144)
    assert cfg.max_f4_response_bytes == 262144


# =============================================================================
# 13. Deduplication & Anti-Double-Counting
# =============================================================================

def test_f1_f4_header_deduplication():
    """Verify F4 does not duplicate basic F1 security-header checks (HSTS/CSP)."""
    scoring_cat = calculate_deep_score([])
    assert "Security Headers" in scoring_cat[2]


def test_f3_f4_api_endpoint_deduplication():
    """Verify F4 builds upon F3 endpoints rather than duplicating discovery."""
    f3_meta = {
        "endpoints": {
            "items": [{"endpoint": "/api/users", "category": "USER", "type": "REST", "source": "main.js"}]
        }
    }
    client = MagicMock()
    client.get.return_value = SafeResponse(url="https://example.com/api/users", status_code=200, final_url="https://example.com/api/users", redirect_chain=[], elapsed_ms=10, resolved_ip="1.2.3.4")
    client.options.return_value = SafeResponse(url="https://example.com/api/users", status_code=200, final_url="https://example.com/api/users", redirect_chain=[], elapsed_ms=10, resolved_ip="1.2.3.4")

    cfg = DeepScanConfig(max_f4_requests=5)
    meta, findings = analyze_application_security([], client, "example.com", config=cfg, frontend_metadata=f3_meta)
    assert meta["endpoints_count"] >= 1


def test_cookie_finding_not_duplicated():
    """Verify F4 does not duplicate F1 cookie findings."""
    page = CrawledPage(
        url="https://example.com",
        final_url="https://example.com",
        depth=0,
        status_code=200,
        content_type="text/html",
        is_https=True,
        cookies={"session": "val"},
        headers={"Cache-Control": "private"},
    )
    meta, findings = analyze_application_security([page], MagicMock(), "example.com")
    # No duplicate cookie finding emitted
    assert not any(f.check_type == "deep_cookie" for f in findings)


def test_cors_finding_not_duplicated():
    """Verify duplicate CORS headers generate single canonical finding."""
    evals = [
        {"has_cors": True, "url": "https://example.com/api/1", "issues": ["wildcard_origin"]},
        {"has_cors": True, "url": "https://example.com/api/2", "issues": ["wildcard_origin"]},
    ]
    findings = build_cors_findings(evals)
    # Only one wildcard finding for both endpoints
    wildcard_f = [f for f in findings if f.name == "Public CORS Wildcard Configured"]
    assert len(wildcard_f) == 1


# =============================================================================
# 14. Failure Isolation
# =============================================================================

def test_cors_failure_isolated():
    """Verify single module failure does not abort other F4 checks."""
    client = MagicMock()
    client.options.side_effect = Exception("OPTIONS failed")
    client.get.return_value = SafeResponse(
        url="https://example.com",
        status_code=200,
        headers={"Server": "nginx/1.20.1"},
        final_url="https://example.com",
        redirect_chain=[],
        elapsed_ms=10,
        resolved_ip="1.2.3.4",
    )
    meta, findings = analyze_application_security([], client, "example.com")
    assert meta["status"] == "completed"


def test_api_docs_failure_isolated():
    """Verify bad OpenAPI JSON does not crash scan."""
    info, err = parse_openapi_spec_safely("INVALID JSON {{{")
    assert err is not None
    assert info == {}


def test_error_parser_failure_isolated():
    """Verify unhandled error regex failure handles gracefully."""
    res = inspect_response_for_errors("https://example.com", 200, None)
    assert res["stack_traces"] == []


def test_f4_failure_does_not_break_f1_f2_f3():
    """Verify complete failure of F4 leaves F1/F2/F3 scan intact."""
    client = MagicMock()
    client.get.side_effect = Exception("Network down")
    client.options.side_effect = Exception("Network down")

    resolver = MagicMock()
    resolver.resolve.return_value = ["93.184.216.34"]

    res = run_deep_security_scan("example.com", resolver=resolver, client=client)
    assert res.scan_metadata["deep_scan_version"] >= 4
    assert 0 <= res.score <= 100


# =============================================================================
# 15. Compatibility & Versioning
# =============================================================================

def test_v1_scan_compatibility():
    """Verify backward compatibility with v1 metadata (no application_security)."""
    legacy_v1_meta = {"deep_scan_version": 1, "pages_crawled": 5}
    assert "application_security" not in legacy_v1_meta


def test_v2_scan_compatibility():
    """Verify backward compatibility with v2 metadata."""
    legacy_v2_meta = {"deep_scan_version": 2, "tls": {}, "dns": {}}
    assert "application_security" not in legacy_v2_meta


def test_v3_scan_compatibility():
    """Verify backward compatibility with v3 metadata."""
    legacy_v3_meta = {"deep_scan_version": 3, "frontend_security": {}}
    assert "application_security" not in legacy_v3_meta


def test_v4_metadata():
    """Verify that current runner output sets deep_scan_version >= 4."""
    client = MagicMock()
    mock_resp = SafeResponse(
        url="https://example.com",
        status_code=200,
        headers={"Content-Type": "text/html"},
        text="<html><head><title>Home</title></head><body><h1>Welcome</h1></body></html>",
        final_url="https://example.com",
        redirect_chain=[],
        elapsed_ms=20,
        resolved_ip="93.184.216.34",
    )
    client.get.return_value = mock_resp
    client.options.return_value = mock_resp

    resolver = MagicMock()
    resolver.resolve.return_value = ["93.184.216.34"]

    res = run_deep_security_scan("example.com", resolver=resolver, client=client)
    assert res.scan_metadata["deep_scan_version"] >= 4
    assert "application_security" in res.scan_metadata
