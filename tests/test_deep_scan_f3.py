"""
Tests for Phase F3: Advanced Frontend, JavaScript & Client-Side Exposure Intelligence
Verifies secret pattern matching, false positive rejection, automatic masking,
endpoint discovery, client storage analysis, DOM sinks, deep source map analysis,
SRI validation, deterministic scoring, and failure isolation.
"""
import pytest
from unittest.mock import MagicMock

from scanner.models import CheckStatus, Severity, Finding
from scanner.network.models import SafeResponse
from scanner.deep.models import CrawledPage, ResourceItem
from scanner.deep.config import DeepScanConfig
from scanner.deep.scoring import calculate_deep_score
from scanner.deep.secrets import (
    mask_secret,
    is_false_positive_secret,
    scan_text_for_secrets,
    scan_text_for_internal_ips_and_configs,
)
from scanner.deep.js_analyzer import (
    classify_third_party_host,
    is_cdn_host,
    extract_endpoints_from_script,
    analyze_client_storage,
    analyze_dom_security,
)
from scanner.deep.source_map_deep import analyze_deep_source_maps
from scanner.deep.frontend_security import analyze_frontend_security
from scanner.deep.runner import run_deep_security_scan


def test_mask_secret_guarantees_safety():
    """Verify secrets are masked and raw values are never preserved unmasked."""
    aws_key = "AKIA1234567890ABCDEF"
    masked_aws = mask_secret(aws_key)
    assert masked_aws.startswith("AKIA")
    assert masked_aws.endswith("CDEF")
    assert "*" in masked_aws
    assert aws_key not in masked_aws

    stripe_key = "sk_live_51A2B3C4D5E6F7G8H9I0J1K2L9999"
    masked_stripe = mask_secret(stripe_key)
    assert "*" in masked_stripe
    assert stripe_key not in masked_stripe

    priv_key = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA..."
    masked_priv = mask_secret(priv_key)
    assert masked_priv == "-----BEGIN PRIVATE KEY----- [MASKED]"

    # Edge cases
    assert mask_secret("") == ""
    assert mask_secret("short") == "*****"


def test_secret_patterns_and_false_positives():
    """Verify high-precision secret detection and false-positive filtering."""
    # Positive tests
    js_with_aws = 'const s3Key = "AKIA3F4E5D6C7B8A9012";'
    found_aws = scan_text_for_secrets(js_with_aws, "bundle.js")
    assert len(found_aws) == 1
    assert found_aws[0]["secret_type"] == "AWS Access Key"
    assert found_aws[0]["confidence"] == "HIGH"
    assert "AKIA" in found_aws[0]["masked_value"]
    assert "AKIA3F4E5D6C7B8A9012" not in found_aws[0]["masked_value"]

    js_with_stripe = 'const key = "sk_live_51N8q7K8j2M9pL4vX1wZ3yA0bC5dE9F";'
    found_stripe = scan_text_for_secrets(js_with_stripe, "checkout.js")
    assert len(found_stripe) == 1
    assert found_stripe[0]["secret_type"] == "Stripe Live Secret Key"
    assert found_stripe[0]["confidence"] == "HIGH"

    js_with_google = 'const gKey = "AIzaSyDxyz1234567890abcdefghijklmnopqrs";'
    found_google = scan_text_for_secrets(js_with_google, "maps.js")
    assert len(found_google) == 1
    assert found_google[0]["secret_type"] == "Google Cloud / Firebase API Key"

    js_with_slack = 'const tok = "xoxb-987654321098-876543210987-abcdefghijklmnopqrstuvwx";'
    found_slack = scan_text_for_secrets(js_with_slack, "bot.js")
    assert len(found_slack) == 1

    js_with_github = 'const gh = "ghp_1234567890abcdefghijklmnopqrstuvwxyz1234";'
    found_github = scan_text_for_secrets(js_with_github, "app.js")
    assert len(found_github) == 1

    # False positive tests (Should be rejected)
    # 1. Stripe publishable key is NOT a secret
    assert is_false_positive_secret("pk_live_51N8xyzABCDEF1234567890", "stripe_secret_key") is True
    # 2. Stripe test key is not production live secret
    assert is_false_positive_secret("sk_test_51N8xyzABCDEF1234567890", "stripe_secret_key") is True
    # 3. Dummy / Example keys
    assert is_false_positive_secret("AKIAIOSFODNN7EXAMPLE", "aws_access_key") is True
    # 4. UUID
    assert is_false_positive_secret("123e4567-e89b-12d3-a456-426614174000", "aws_access_key") is True
    # 5. Git Commit Hash (40 hex chars)
    assert is_false_positive_secret("a94a8fe5ccb19ba61c4c0873d391e987982fbbd3", "aws_access_key") is True


def test_internal_ip_and_config_exposure():
    """Verify detection of localhost, private RFC 1918 IPs, and framework env vars."""
    js_text = """
    const devApi = "http://localhost:8080/api";
    const internalDb = "http://10.200.4.15:5432";
    const privateVpc = "https://192.168.1.100/status";
    const publicVar = process.env.NEXT_PUBLIC_API_URL;
    const sensitiveVar = process.env.NEXT_PUBLIC_ADMIN_KEY;
    """
    ips, envs = scan_text_for_internal_ips_and_configs(js_text, "app.js")
    ip_values = [item["value"] for item in ips]
    assert any("localhost" in v for v in ip_values)
    assert any("10.200.4.15" in v for v in ip_values)
    assert any("192.168.1.100" in v for v in ip_values)

    env_vars = [item["variable"] for item in envs]
    assert "NEXT_PUBLIC_API_URL" in env_vars
    assert "NEXT_PUBLIC_ADMIN_KEY" in env_vars

    sensitive_vars = [item["variable"] for item in envs if item["is_sensitive"]]
    assert "NEXT_PUBLIC_ADMIN_KEY" in sensitive_vars


def test_passive_endpoint_discovery():
    """Verify passive discovery of REST, GraphQL, WebSockets, and Admin routes."""
    js_content = """
    function fetchData() {
        fetch("/api/v1/users/profile");
        fetch("/rest/billing/subscription");
        const ws = new WebSocket("wss://stream.example.com/feed");
        const badWs = new WebSocket("ws://insecure.example.com/chat");
        const gql = "/api/graphql";
        router.push("/admin/settings/security");
        router.push("/auth/oauth/callback");
    }
    """
    endpoints = extract_endpoints_from_script(js_content, "main.js")
    ep_map = {e["endpoint"]: e for e in endpoints}

    assert "/api/v1/users/profile" in ep_map
    assert ep_map["/api/v1/users/profile"]["category"] == "USER"

    assert "/rest/billing/subscription" in ep_map
    assert ep_map["/rest/billing/subscription"]["category"] == "PAYMENT"

    assert "wss://stream.example.com/feed" in ep_map
    assert ep_map["wss://stream.example.com/feed"]["category"] == "WEBSOCKET"

    assert "ws://insecure.example.com/chat" in ep_map
    assert ep_map["ws://insecure.example.com/chat"]["category"] == "WEBSOCKET"

    assert "/admin/settings/security" in ep_map
    assert ep_map["/admin/settings/security"]["category"] == "ADMIN"

    assert "/auth/oauth/callback" in ep_map
    assert ep_map["/auth/oauth/callback"]["category"] == "AUTH"


def test_client_storage_analysis():
    """Verify detection of tokens in localStorage and sessionStorage."""
    insecure_js = """
    localStorage.setItem("accessToken", token);
    sessionStorage.setItem("jwt_token", jwt);
    localStorage.setItem("site_theme", "dark");
    navigator.serviceWorker.register("/sw.js");
    """
    res = analyze_client_storage(insecure_js, "auth.js")
    assert res["has_auth_tokens"] is True
    keys = [i["key"] for i in res["items"]]
    assert "accessToken" in keys
    assert "jwt_token" in keys
    assert "site_theme" in keys
    assert "/sw.js" in res["service_workers"]

    # Benign JS
    clean_js = """
    localStorage.setItem("theme", "light");
    localStorage.setItem("sidebar_collapsed", "true");
    """
    res_clean = analyze_client_storage(clean_js, "ui.js")
    assert res_clean["has_auth_tokens"] is False


def test_dom_security_analysis():
    """Verify detection of dangerous DOM execution sinks and postMessage handlers."""
    risky_js = """
    eval(untrustedInput);
    document.write("<h1>Loading...</h1>");
    element.innerHTML = userInput;
    window.addEventListener("message", function(e) {
        processMessage(e.data);
    });
    """
    res = analyze_dom_security(risky_js, "legacy.js")
    sinks = [s["sink"] for s in res["sinks"]]
    assert "eval" in sinks
    assert "document.write" in sinks
    assert "innerHTML" in sinks
    assert res["postmessage_origin_missing"] is True

    # Safe JS with origin check
    safe_js = """
    window.addEventListener("message", function(event) {
        if (event.origin !== "https://trusted.com") return;
        handle(event.data);
    });
    """
    res_safe = analyze_dom_security(safe_js, "safe.js")
    assert res_safe["postmessage_origin_missing"] is False


def test_deep_source_map_analysis():
    """Verify deep source map analysis detects embedded sourcesContent and build paths."""
    map_json_content = """{
        "version": 3,
        "file": "bundle.js",
        "sources": [
            "/home/runner/work/sitesecura/src/index.tsx",
            "/home/runner/work/sitesecura/src/api/auth.ts"
        ],
        "sourcesContent": [
            "console.log('index');",
            "const apiKey = 'AKIA9Z8Y7X6W5V4U3T2S';"
        ]
    }"""
    mock_client = MagicMock()
    mock_client.get.return_value = SafeResponse(
        status_code=200,
        headers={"content-type": "application/json"},
        text=map_json_content,
        bytes_read=len(map_json_content.encode("utf-8")),
    )

    dummy_page = CrawledPage(
        url="https://example.com",
        final_url="https://example.com",
        depth=0,
        status_code=200,
        content_type="text/html",
        is_https=True,
        resources=[
            ResourceItem(
                page_url="https://example.com",
                resource_url="https://example.com/bundle.js",
                resource_type="script",
                is_https=True,
                is_external=False,
                host="example.com",
            )
        ],
    )

    summary, map_secrets, findings = analyze_deep_source_maps(
        crawled_pages=[dummy_page],
        client=mock_client,
        target_domain="example.com",
    )

    assert summary["exposed_maps_count"] == 1
    assert summary["has_embedded_source_code"] is True
    assert summary["embedded_files_count"] == 2
    assert len(summary["internal_paths"]) > 0
    assert any("/home/runner/work" in p for p in summary["internal_paths"])
    # Secret found in sourcesContent
    assert len(map_secrets) == 1
    assert map_secrets[0]["secret_type"] == "AWS Access Key"
    # Finding generated for source map unminified code exposure
    assert any(f.check_type == "deep_js_sourcemap_code_exposed" for f in findings)


def test_third_party_supply_chain_sri():
    """Verify classification of third parties and SRI integrity verification."""
    assert classify_third_party_host("cdnjs.cloudflare.com") == "cdn_library"
    assert classify_third_party_host("www.googletagmanager.com") == "tag_manager"
    assert is_cdn_host("cdnjs.cloudflare.com") is True
    assert is_cdn_host("unpkg.com") is True
    assert is_cdn_host("my-internal-server.com") is False


def test_frontend_security_orchestration():
    """Verify analyze_frontend_security coordinates all F3 modules and generates findings."""
    mock_client = MagicMock()
    # Mock script bundle response
    script_code = """
    console.log("App loaded");
    localStorage.setItem("accessToken", "xyz");
    fetch("/api/v1/user/account");
    const ws = new WebSocket("ws://insecure.example.com");
    """
    mock_client.get.return_value = SafeResponse(
        status_code=200,
        headers={"content-type": "application/javascript"},
        text=script_code,
        bytes_read=len(script_code.encode("utf-8")),
    )

    crawled_page = CrawledPage(
        url="https://example.com",
        final_url="https://example.com",
        depth=0,
        status_code=200,
        content_type="text/html",
        is_https=True,
        resources=[
            ResourceItem(
                page_url="https://example.com",
                resource_url="https://example.com/app.js",
                resource_type="script",
                is_https=True,
                is_external=False,
                host="example.com",
            ),
            ResourceItem(
                page_url="https://example.com",
                resource_url="https://cdnjs.cloudflare.com/ajax/libs/react/18.0.0/react.js",
                resource_type="script",
                is_https=True,
                is_external=True,
                host="cdnjs.cloudflare.com",
                integrity=None,  # Missing SRI
            ),
        ],
        inline_scripts=["const inlineVal = 1;"],
    )

    metadata, findings = analyze_frontend_security(
        crawled_pages=[crawled_page],
        client=mock_client,
        target_domain="example.com",
    )

    check_types = [f.check_type for f in findings]
    # Check that key findings are produced
    assert "deep_js_insecure_websocket" in check_types
    assert "deep_js_storage_auth_token" in check_types
    assert "deep_js_third_party_missing_sri" in check_types
    assert "deep_js_api_surface_detected" in check_types
    assert "deep_js_secrets_none" in check_types

    # Metadata structure verification
    assert "javascript" in metadata
    assert metadata["javascript"]["total_scripts"] == 2
    assert "endpoints" in metadata
    assert "WEBSOCKET" in metadata["endpoints"]["categories"]
    assert "secrets" in metadata
    assert "third_party" in metadata
    assert "storage" in metadata
    assert "dom_security" in metadata


def test_scoring_with_f3_findings():
    """Verify deterministic scoring accurately maps deep_js_* findings and bounds scores."""
    f3_findings = [
        Finding(
            check_type="deep_js_insecure_websocket",
            name="Insecure WebSocket",
            status=CheckStatus.WARNING,
            severity=Severity.MEDIUM,
            score_impact=-5,
            title="Insecure WebSocket",
            summary="ws:// in use",
            why_it_matters="Cleartext",
            how_to_fix="Use wss://",
            estimated_fix_minutes=10,
            documentation_url="https://owasp.org/websocket",
        ),
        Finding(
            check_type="deep_js_secret_exposed",
            name="Secret Exposed",
            status=CheckStatus.CRITICAL,
            severity=Severity.CRITICAL,
            score_impact=-15,
            title="Secret Key",
            summary="Exposed Key",
            why_it_matters="Access leak",
            how_to_fix="Rotate",
            estimated_fix_minutes=30,
            documentation_url="https://owasp.org/secrets",
        ),
        Finding(
            check_type="deep_js_storage_auth_token",
            name="Storage Auth",
            status=CheckStatus.WARNING,
            severity=Severity.MEDIUM,
            score_impact=-4,
            title="Storage Auth",
            summary="Token in storage",
            why_it_matters="XSS",
            how_to_fix="Use cookies",
            estimated_fix_minutes=20,
            documentation_url="https://owasp.org/storage",
        ),
    ]

    score, risk_level, breakdown, passed_count, total_count = calculate_deep_score(f3_findings)

    # Insecure websocket routes to Transport Security (-5 from 25 = 20)
    assert breakdown["Transport Security"]["score"] == 20
    # Secret and Storage route to Website & Technology (-15 and -4 from 10 max = 0, bounded)
    assert breakdown["Website & Technology"]["score"] == 0
    # Total score cannot be negative and is strictly clamped [0, 100]
    assert 0 <= score <= 100


def test_failure_isolation():
    """Verify network or parsing exceptions in F3 do not crash deep scan runner."""
    broken_client = MagicMock()
    broken_client.get.side_effect = RuntimeError("Simulated network timeout")

    # Should run and return partial/safe results without throwing
    res = run_deep_security_scan(
        target_domain="example.com",
        client=broken_client,
    )
    assert res.score >= 0
    assert res.scan_metadata["deep_scan_version"] >= 3
    assert "frontend_security" in res.scan_metadata
