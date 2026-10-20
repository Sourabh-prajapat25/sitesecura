"""
Tests for Standalone CSP Policy Analyzer (Phase 3).
Covers parser, effective-directive fallback resolution, security rule evaluation,
quality scoring, remote header inspection with SSRF defenses, and FastAPI endpoints.
"""
import pytest
from pydantic import ValidationError
from starlette.testclient import TestClient
import httpx

from app.schemas.tools import (
    CspPolicyAnalyzeRequest,
    CspPolicyAnalyzeResponse,
)
from app.services.csp_policy_service import (
    parse_csp_policy,
    resolve_effective_directives,
    analyze_single_csp_policy,
    calculate_csp_quality_score,
    execute_csp_policy_analysis_sync,
)
from scanner.network.resolver import BaseResolver
from apps.api.main import app

client = TestClient(app)


class MockResolver(BaseResolver):
    def __init__(self, ip_map=None):
        self.ip_map = ip_map or {"example.com": ["93.184.216.34"]}

    def resolve(self, host: str, port: int = 443):
        return self.ip_map.get(host, ["93.184.216.34"])


# ============================================================================
# 1. Request Input & Domain Validation Tests
# ============================================================================

class TestCspRequestValidation:
    def test_valid_paste_mode(self):
        req = CspPolicyAnalyzeRequest(
            mode="paste",
            policy="default-src 'self'; script-src 'self';",
            policy_type="enforce",
        )
        assert req.mode == "paste"
        assert req.policy_type == "enforce"
        assert req.policy == "default-src 'self'; script-src 'self';"

    def test_valid_report_only_type(self):
        req = CspPolicyAnalyzeRequest(
            mode="paste",
            policy="default-src 'self';",
            policy_type="report_only",
        )
        assert req.policy_type == "report_only"

    def test_invalid_policy_type_rejected(self):
        with pytest.raises(ValidationError):
            CspPolicyAnalyzeRequest(
                mode="paste",
                policy="default-src 'self';",
                policy_type="invalid_type",
            )

    def test_invalid_mode_rejected(self):
        with pytest.raises(ValidationError):
            CspPolicyAnalyzeRequest(mode="scanner_mode")

    def test_remote_valid_url(self):
        req = CspPolicyAnalyzeRequest(mode="remote", url="https://example.com")
        assert req.mode == "remote"
        assert req.url == "https://example.com"

    def test_remote_bare_domain_normalized_to_https(self):
        req = CspPolicyAnalyzeRequest(mode="remote", url="example.com")
        assert req.url == "https://example.com"

    def test_remote_credentials_rejected(self):
        with pytest.raises(ValidationError):
            CspPolicyAnalyzeRequest(mode="remote", url="https://user:pass@example.com")

    def test_remote_disallowed_port_rejected(self):
        with pytest.raises(ValidationError):
            CspPolicyAnalyzeRequest(mode="remote", url="https://example.com:8080")

    def test_remote_disallowed_scheme_rejected(self):
        with pytest.raises(ValidationError):
            CspPolicyAnalyzeRequest(mode="remote", url="ftp://example.com")

    def test_remote_ssrf_loopback_rejected(self):
        with pytest.raises(ValidationError):
            CspPolicyAnalyzeRequest(mode="remote", url="127.0.0.1")

    def test_remote_ssrf_localhost_rejected(self):
        with pytest.raises(ValidationError):
            CspPolicyAnalyzeRequest(mode="remote", url="localhost")

    def test_remote_ssrf_cloud_metadata_rejected(self):
        with pytest.raises(ValidationError):
            CspPolicyAnalyzeRequest(mode="remote", url="169.254.169.254")

    def test_remote_ssrf_private_ip_rejected(self):
        with pytest.raises(ValidationError):
            CspPolicyAnalyzeRequest(mode="remote", url="10.0.0.1")


# ============================================================================
# 2. CSP Parser Tests
# ============================================================================

class TestCspParser:
    def test_parse_simple_policy(self):
        raw = "default-src 'self'; script-src 'self' https://cdn.example.com; object-src 'none';"
        directives, warnings = parse_csp_policy(raw)
        assert len(directives) == 3
        assert directives[0].name == "default-src"
        assert directives[0].values == ["'self'"]
        assert directives[1].name == "script-src"
        assert directives[1].values == ["'self'", "https://cdn.example.com"]
        assert directives[2].name == "object-src"
        assert directives[2].values == ["'none'"]

    def test_case_normalization(self):
        raw = "DEFAULT-SRC 'self'; SCRIPT-SRC 'self';"
        directives, _ = parse_csp_policy(raw)
        assert directives[0].name == "default-src"
        assert directives[1].name == "script-src"

    def test_detect_duplicate_directives(self):
        raw = "script-src 'self'; script-src 'unsafe-inline';"
        directives, _ = parse_csp_policy(raw)
        assert len(directives) == 2
        assert directives[0].is_duplicate is False
        assert directives[1].is_duplicate is True
        assert any("Duplicate directive 'script-src'" in w for w in directives[1].warnings)

    def test_detect_unquoted_keywords(self):
        raw = "default-src self; script-src unsafe-inline;"
        directives, _ = parse_csp_policy(raw)
        assert any("Unquoted keyword 'self'" in w for w in directives[0].warnings)
        assert any("Unquoted keyword 'unsafe-inline'" in w for w in directives[1].warnings)

    def test_detect_contradictory_none(self):
        raw = "object-src 'none' 'self' https:;"
        directives, _ = parse_csp_policy(raw)
        assert any("specifies ''none'' alongside other source expressions" in w for w in directives[0].warnings)

    def test_detect_deprecated_directives(self):
        raw = "block-all-mixed-content; report-uri /csp-report;"
        directives, _ = parse_csp_policy(raw)
        assert directives[0].is_deprecated is True
        assert directives[1].is_deprecated is True

    def test_detect_unknown_directive(self):
        raw = "x-custom-src 'self';"
        directives, _ = parse_csp_policy(raw)
        assert directives[0].is_unknown is True

    def test_strip_utf8_bom(self):
        raw = "\ufeffdefault-src 'self';"
        directives, _ = parse_csp_policy(raw)
        assert len(directives) == 1
        assert directives[0].name == "default-src"


# ============================================================================
# 3. Effective Directive Fallback Resolution Tests
# ============================================================================

class TestEffectiveDirectivesFallback:
    def test_script_src_inherits_from_default_src(self):
        directives, _ = parse_csp_policy("default-src 'self' https://trusted.com;")
        effective = resolve_effective_directives(directives)
        assert "script-src" in effective
        assert effective["script-src"].is_fallback is True
        assert effective["script-src"].fallback_source == "default-src"
        assert effective["script-src"].values == ["'self'", "https://trusted.com"]

    def test_explicit_script_src_overrides_default_src(self):
        directives, _ = parse_csp_policy("default-src 'self'; script-src 'none';")
        effective = resolve_effective_directives(directives)
        assert "script-src" in effective
        assert effective["script-src"].is_fallback is False
        assert effective["script-src"].values == ["'none'"]

    def test_base_uri_does_not_inherit_from_default_src(self):
        directives, _ = parse_csp_policy("default-src 'self';")
        effective = resolve_effective_directives(directives)
        assert "base-uri" not in effective

    def test_form_action_does_not_inherit_from_default_src(self):
        directives, _ = parse_csp_policy("default-src 'self';")
        effective = resolve_effective_directives(directives)
        assert "form-action" not in effective

    def test_frame_ancestors_does_not_inherit_from_default_src(self):
        directives, _ = parse_csp_policy("default-src 'self';")
        effective = resolve_effective_directives(directives)
        assert "frame-ancestors" not in effective

    def test_frame_src_falls_back_to_child_src(self):
        directives, _ = parse_csp_policy("default-src 'self'; child-src https://player.vimeo.com;")
        effective = resolve_effective_directives(directives)
        assert "frame-src" in effective
        assert effective["frame-src"].is_fallback is True
        assert effective["frame-src"].fallback_source == "child-src"
        assert effective["frame-src"].values == ["https://player.vimeo.com"]


# ============================================================================
# 4. Security Analysis Rules Tests
# ============================================================================

class TestCspSecurityRules:
    def test_missing_script_src_and_default_src(self):
        policy = analyze_single_csp_policy("style-src 'self';")
        finding_ids = [f.id for f in policy.findings]
        assert "CSP_SCRIPT_SRC_MISSING" in finding_ids
        crit = next(f for f in policy.findings if f.id == "CSP_SCRIPT_SRC_MISSING")
        assert crit.severity == "critical"

    def test_unsafe_inline_without_nonces(self):
        policy = analyze_single_csp_policy("script-src 'self' 'unsafe-inline';")
        finding_ids = [f.id for f in policy.findings]
        assert "CSP_UNSAFE_INLINE_SCRIPT" in finding_ids
        f = next(f for f in policy.findings if f.id == "CSP_UNSAFE_INLINE_SCRIPT")
        assert f.severity == "high"

    def test_unsafe_inline_with_strict_dynamic_and_nonce_recognized_as_polyfill(self):
        policy = analyze_single_csp_policy(
            "script-src 'strict-dynamic' 'nonce-rAnd0m1234567890' 'unsafe-inline' https:;"
        )
        finding_ids = [f.id for f in policy.findings]
        assert "CSP_UNSAFE_INLINE_POLYFILL_NOTICE" in finding_ids
        assert "CSP_UNSAFE_INLINE_SCRIPT" not in finding_ids

    def test_unsafe_eval_detected(self):
        policy = analyze_single_csp_policy("script-src 'self' 'unsafe-eval';")
        finding_ids = [f.id for f in policy.findings]
        assert "CSP_UNSAFE_EVAL_SCRIPT" in finding_ids
        f = next(f for f in policy.findings if f.id == "CSP_UNSAFE_EVAL_SCRIPT")
        assert f.severity == "medium"

    def test_script_wildcard_detected(self):
        policy = analyze_single_csp_policy("script-src *;")
        finding_ids = [f.id for f in policy.findings]
        assert "CSP_SCRIPT_WILDCARD_SOURCE" in finding_ids

    def test_script_data_uri_detected(self):
        policy = analyze_single_csp_policy("script-src 'self' data:;")
        finding_ids = [f.id for f in policy.findings]
        assert "CSP_SCRIPT_DATA_SCHEME" in finding_ids

    def test_object_src_missing(self):
        policy = analyze_single_csp_policy("script-src 'self';")
        finding_ids = [f.id for f in policy.findings]
        assert "CSP_OBJECT_SRC_MISSING" in finding_ids

    def test_object_src_not_none(self):
        policy = analyze_single_csp_policy("default-src 'self'; object-src 'self';")
        finding_ids = [f.id for f in policy.findings]
        assert "CSP_OBJECT_SRC_NOT_NONE" in finding_ids

    def test_missing_base_uri_flagged(self):
        policy = analyze_single_csp_policy("default-src 'self';")
        finding_ids = [f.id for f in policy.findings]
        assert "CSP_MISSING_BASE_URI" in finding_ids

    def test_missing_frame_ancestors_flagged(self):
        policy = analyze_single_csp_policy("default-src 'self';")
        finding_ids = [f.id for f in policy.findings]
        assert "CSP_MISSING_FRAME_ANCESTORS" in finding_ids

    def test_missing_form_action_flagged(self):
        policy = analyze_single_csp_policy("default-src 'self';")
        finding_ids = [f.id for f in policy.findings]
        assert "CSP_MISSING_FORM_ACTION" in finding_ids

    def test_connect_src_wildcard_flagged(self):
        policy = analyze_single_csp_policy("connect-src *;")
        finding_ids = [f.id for f in policy.findings]
        assert "CSP_CONNECT_SRC_WILDCARD" in finding_ids

    def test_insecure_http_scheme_flagged(self):
        policy = analyze_single_csp_policy("script-src 'self' http://insecure-cdn.com;")
        finding_ids = [f.id for f in policy.findings]
        assert "CSP_INSECURE_HTTP_SCHEME" in finding_ids

    def test_unquoted_keyword_finding_generated(self):
        policy = analyze_single_csp_policy("default-src self;")
        finding_ids = [f.id for f in policy.findings]
        assert "CSP_UNQUOTED_KEYWORD_ERROR" in finding_ids

    def test_report_only_mode_notice_generated(self):
        policy = analyze_single_csp_policy("default-src 'self';", policy_type="report_only")
        finding_ids = [f.id for f in policy.findings]
        assert "CSP_REPORT_ONLY_MODE" in finding_ids


# ============================================================================
# 5. Quality Score Calculation Tests
# ============================================================================

class TestCspQualityScore:
    def test_empty_policies_returns_zero(self):
        score, rating = calculate_csp_quality_score([], has_enforcing_policy=False)
        assert score == 0
        assert rating == "None"

    def test_report_only_capped_at_forty(self):
        policy = analyze_single_csp_policy("default-src 'self';", policy_type="report_only")
        score, rating = calculate_csp_quality_score([policy], has_enforcing_policy=False)
        assert score <= 50
        assert "Report-Only" in rating

    def test_strict_modern_policy_high_score(self):
        raw = (
            "default-src 'none'; "
            "script-src 'strict-dynamic' 'nonce-rAnd0m1234567890' 'unsafe-inline'; "
            "style-src 'self' 'nonce-rAnd0m1234567890'; "
            "img-src 'self' data:; "
            "connect-src 'self' https://api.example.com; "
            "font-src 'self'; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self'; "
            "frame-ancestors 'self'; "
            "upgrade-insecure-requests;"
        )
        policy = analyze_single_csp_policy(raw, policy_type="enforce")
        score, rating = calculate_csp_quality_score([policy], has_enforcing_policy=True)
        assert score >= 90
        assert rating == "Excellent"

    def test_permissive_wildcard_policy_low_score(self):
        raw = "default-src *; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src *;"
        policy = analyze_single_csp_policy(raw, policy_type="enforce")
        score, rating = calculate_csp_quality_score([policy], has_enforcing_policy=True)
        assert score < 50


# ============================================================================
# 6. Remote Inspection Mock Transport Tests
# ============================================================================

class TestCspRemoteInspection:
    def test_remote_success_with_csp_header(self):
        def handler(request):
            headers = [
                (b"content-type", b"text/html"),
                (b"content-security-policy", b"default-src 'self'; script-src 'self'; object-src 'none';"),
            ]
            return httpx.Response(200, headers=headers)

        transport = httpx.MockTransport(handler)
        resolver = MockResolver()

        req = CspPolicyAnalyzeRequest(mode="remote", url="https://example.com")
        res = execute_csp_policy_analysis_sync(
            request=req,
            resolver=resolver,
            custom_transport=transport,
        )

        assert res.status == "success"
        assert res.http_status_code == 200
        assert len(res.policies) == 1
        assert res.policies[0].policy_type == "enforce"
        assert res.metrics.enforcing_policies_count == 1

    def test_remote_both_enforce_and_report_only_headers(self):
        def handler(request):
            headers = [
                (b"content-type", b"text/html"),
                (b"content-security-policy", b"default-src 'self';"),
                (b"content-security-policy-report-only", b"default-src 'none'; report-to /reports;"),
            ]
            return httpx.Response(200, headers=headers)

        transport = httpx.MockTransport(handler)
        resolver = MockResolver()

        req = CspPolicyAnalyzeRequest(mode="remote", url="https://example.com")
        res = execute_csp_policy_analysis_sync(
            request=req,
            resolver=resolver,
            custom_transport=transport,
        )

        assert res.status == "success"
        assert len(res.policies) == 2
        assert res.metrics.enforcing_policies_count == 1
        assert res.metrics.report_only_policies_count == 1

    def test_remote_no_csp_headers_found(self):
        def handler(request):
            return httpx.Response(200, headers=[(b"content-type", b"text/html")])

        transport = httpx.MockTransport(handler)
        resolver = MockResolver()

        req = CspPolicyAnalyzeRequest(mode="remote", url="https://example.com")
        res = execute_csp_policy_analysis_sync(
            request=req,
            resolver=resolver,
            custom_transport=transport,
        )

        assert res.status == "no_policy_found"
        assert res.http_status_code == 200
        assert any(f.id == "CSP_NO_HEADER_PRESENT" for f in res.findings)
        assert res.metrics.quality_score == 0

    def test_remote_redirect_to_insecure_http_rejected(self):
        def handler(request):
            return httpx.Response(
                302,
                headers=[(b"location", b"http://example.com/insecure")],
            )

        transport = httpx.MockTransport(handler)
        resolver = MockResolver()

        req = CspPolicyAnalyzeRequest(mode="remote", url="https://example.com")
        res = execute_csp_policy_analysis_sync(
            request=req,
            resolver=resolver,
            custom_transport=transport,
        )

        assert res.status == "blocked_target"
        assert "unencrypted" in res.error_message.lower()

    def test_remote_redirect_loop_bounded(self):
        def handler(request):
            # Loops back on itself
            return httpx.Response(
                302,
                headers=[(b"location", b"https://example.com/loop")],
            )

        transport = httpx.MockTransport(handler)
        resolver = MockResolver()

        req = CspPolicyAnalyzeRequest(mode="remote", url="https://example.com")
        res = execute_csp_policy_analysis_sync(
            request=req,
            resolver=resolver,
            custom_transport=transport,
        )

        assert res.status == "fetch_error"
        assert "redirect" in res.error_message.lower()


# ============================================================================
# 7. FastAPI Endpoint Integration Tests
# ============================================================================

class TestCspPolicyApiEndpoint:
    def test_api_pasted_policy_analysis(self):
        payload = {
            "mode": "paste",
            "policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none';",
            "policy_type": "enforce",
        }
        resp = client.post(
            "/api/v1/tools/csp-policy-analyze",
            json=payload,
            headers={"X-Forwarded-For": "198.51.100.11"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["mode"] == "paste"
        assert data["status"] == "success"
        assert len(data["policies"]) == 1
        assert data["metrics"]["total_directives"] == 3
        assert len(data["findings"]) > 0
        assert data["summary_markdown"] is not None

    def test_api_empty_policy_rejected(self):
        payload = {
            "mode": "paste",
            "policy": "   ",
        }
        resp = client.post(
            "/api/v1/tools/csp-policy-analyze",
            json=payload,
            headers={"X-Forwarded-For": "198.51.100.12"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "invalid_policy"
        assert "empty" in data["error_message"].lower()

    def test_api_ssrf_destination_rejected_at_validation(self):
        payload = {
            "mode": "remote",
            "url": "http://127.0.0.1/admin",
        }
        resp = client.post(
            "/api/v1/tools/csp-policy-analyze",
            json=payload,
            headers={"X-Forwarded-For": "198.51.100.13"},
        )
        assert resp.status_code == 422  # Pydantic validation error

    def test_api_rate_limiting(self):
        payload = {
            "mode": "paste",
            "policy": "default-src 'self';",
        }
        # Exhaust 15 req/min on dedicated test IP
        hit_429 = False
        for _ in range(20):
            res = client.post(
                "/api/v1/tools/csp-policy-analyze",
                json=payload,
                headers={"X-Forwarded-For": "198.51.100.99"},
            )
            if res.status_code == 429:
                hit_429 = True
                break
        assert hit_429 is True
