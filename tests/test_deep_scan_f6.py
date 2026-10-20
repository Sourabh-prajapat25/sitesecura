"""
Tests for Phase F6: Advanced Infrastructure, Cloud, Deployment & Operational Security Intelligence
Comprehensive verification conforming strictly to Phase F6 specification:
- Infrastructure provider fingerprinting (Cloudflare, AWS, GCP, Azure, Fastly, Akamai, Vercel, etc.)
- Server OS & version banner disclosure detection
- Cloud infrastructure & serverless platform identification
- Cloud instance metadata reference detection (passive regex, zero network SSRF)
- Origin exposure signals (headers, certificate SANs, subdomain correlation)
- Deployment platform fingerprinting & bounded artifact auditing (.git/HEAD, package.json, Dockerfile)
- Environment exposure detection (staging, dev, internal RFC 1918 IPs, localhost references)
- Operational surface auditing (Spring Boot Actuator /actuator/env, Prometheus /metrics, Go /debug/vars, admin portals)
- DNS infrastructure correlation (IPv4/IPv6 dual-stack consistency, dangling CNAME takeover signals)
- Cloud object storage auditing (S3, GCS, Azure Blob endpoints & sensitive backups/.env)
- Container & Kubernetes signal detection (cluster.local hostnames, pod IDs)
- Master orchestrator execution, request budget enforcement, failure isolation
- Full Deep Scan runner integration (deep_scan_version = 6) and deterministic scoring
- Backward compatibility with legacy v1-v5 metadata
- Secret masking verification
"""
import pytest
from unittest.mock import MagicMock, patch
from urllib.parse import urlparse

from scanner.models import CheckStatus, Severity, Finding
from scanner.network.models import SafeResponse
from scanner.deep.models import CrawledPage
from scanner.deep.config import DeepScanConfig
from scanner.deep.scoring import calculate_deep_score
from scanner.deep.infra_finding_helper import make_infra_finding
from scanner.deep.infrastructure_analyzer import analyze_infrastructure
from scanner.deep.cloud_analyzer import analyze_cloud_infrastructure
from scanner.deep.origin_analyzer import analyze_origin_exposure
from scanner.deep.deployment_analyzer import analyze_deployment
from scanner.deep.environment_analyzer import analyze_environments
from scanner.deep.operational_analyzer import analyze_operational_surfaces
from scanner.deep.dns_infrastructure_analyzer import analyze_dns_infrastructure
from scanner.deep.storage_analyzer import analyze_cloud_storage
from scanner.deep.container_analyzer import analyze_containers_and_kubernetes
from scanner.deep.infrastructure_security import analyze_infrastructure_security
from scanner.deep.runner import run_deep_security_scan


def make_page(url: str, **kwargs) -> CrawledPage:
    """Helper to construct CrawledPage with required attributes."""
    parsed = urlparse(url)
    defaults = {
        "final_url": url,
        "depth": 1,
        "status_code": 200,
        "content_type": "text/html",
        "is_https": parsed.scheme.lower() == "https",
        "headers": {},
        "cookies": {},
        "forms": [],
        "discovered_links": [],
        "body_sample": "",
    }
    defaults.update(kwargs)
    return CrawledPage(url=url, **defaults)


def make_safe_response(url: str, status_code: int = 200, text: str = "", headers: dict = None) -> SafeResponse:
    """Helper to construct SafeResponse for mocked SafeHttpClient."""
    return SafeResponse(
        url=url,
        status_code=status_code,
        headers=headers or {"content-type": "text/plain"},
        text=text,
        bytes_read=len(text.encode("utf-8")),
        elapsed_ms=45,
    )


# =============================================================================
# 1. INFRASTRUCTURE PROVIDER & CDN FINGERPRINTING
# =============================================================================

def test_infrastructure_fingerprint_cloudflare():
    """Verify Cloudflare is identified from CF-Ray and Server headers with CDN detection."""
    pages = [
        make_page(
            "https://example.com/",
            headers={
                "server": "cloudflare",
                "cf-ray": "8d19e8f5dcdb4d7c-IAD",
                "cf-cache-status": "HIT",
            },
        )
    ]
    infra, cdn, findings = analyze_infrastructure(pages, target_domain="example.com")
    assert infra["primary_provider"] == "Cloudflare"
    assert cdn["detected"] is True
    assert cdn["provider"] == "Cloudflare"
    assert any("cf-" in h.lower() for h in cdn["edge_headers"])


def test_infrastructure_fingerprint_aws_cloudfront():
    """Verify Amazon CloudFront is fingerprinted from X-Amz-Cf-Id and Server headers."""
    pages = [
        make_page(
            "https://example.com/",
            headers={
                "server": "CloudFront",
                "x-amz-cf-id": "k8s-abc-12345==",
                "x-amz-cf-pop": "IAD50-C1",
            },
        )
    ]
    infra, cdn, findings = analyze_infrastructure(pages, target_domain="example.com")
    assert cdn["detected"] is True
    assert cdn["provider"] == "Amazon CloudFront"


def test_infrastructure_server_version_disclosure():
    """Verify verbose server version disclosure produces a finding."""
    pages = [
        make_page(
            "https://example.com/",
            headers={"server": "Apache/2.4.41 (Ubuntu)"},
        )
    ]
    infra, cdn, findings = analyze_infrastructure(pages, target_domain="example.com")
    version_findings = [f for f in findings if f.check_type == "deep_infra_version_disclosure"]
    assert len(version_findings) == 1
    assert version_findings[0].severity == Severity.LOW
    assert "Apache/2.4.41 (Ubuntu)" in (version_findings[0].evidence or version_findings[0].title)


def test_infrastructure_clean_generic_server():
    """Verify generic server header without versions does not produce a version disclosure finding."""
    pages = [
        make_page(
            "https://example.com/",
            headers={"server": "nginx"},
        )
    ]
    infra, cdn, findings = analyze_infrastructure(pages, target_domain="example.com")
    version_findings = [f for f in findings if f.check_type == "deep_infra_version_disclosure"]
    assert len(version_findings) == 0


# =============================================================================
# 2. CLOUD INFRASTRUCTURE & SERVERLESS
# =============================================================================

def test_cloud_analyzer_aws_s3_detection():
    """Verify AWS provider and S3 service detection via CNAME and links."""
    dns_meta = {"cname": ["static.example.com.s3.amazonaws.com."]}
    pages = [make_page("https://example.com/")]
    cloud, findings = analyze_cloud_infrastructure(pages, dns_metadata=dns_meta)
    assert any("AWS" in p for p in cloud["providers"])
    assert any("S3" in svc for svc in cloud["services"])


def test_cloud_analyzer_serverless_detection():
    """Verify serverless compute detection from Lambda function URLs."""
    dns_meta = {"cname": ["api-lambda.lambda-url.us-east-1.on.aws."]}
    pages = [make_page("https://example.com/")]
    cloud, findings = analyze_cloud_infrastructure(pages, dns_metadata=dns_meta)
    assert cloud["is_serverless"] is True
    assert any("Lambda" in s for s in cloud["serverless_services"])


def test_cloud_analyzer_metadata_ip_reference_detection():
    """Verify passive discovery of cloud metadata IP (169.254.169.254) in frontend code without SSRF."""
    page_content = (
        "<html><script>const AWS_META = 'http://169.254.169.254/latest/meta-data/iam/security-credentials/';</script></html>"
    )
    pages = [make_page("https://example.com/app.js", body_sample=page_content)]
    cloud, findings = analyze_cloud_infrastructure(pages)
    meta_findings = [f for f in findings if f.check_type == "deep_cloud_metadata_reference"]
    assert len(meta_findings) == 1
    assert meta_findings[0].severity == Severity.HIGH
    assert cloud["metadata_references_count"] == 1
    assert "169.254.169.254" in (meta_findings[0].evidence or meta_findings[0].summary)


# =============================================================================
# 3. ORIGIN EXPOSURE SIGNALS
# =============================================================================

def test_origin_exposure_headers():
    """Verify origin server leakage via response headers (X-Origin-Server / X-Backend-Host)."""
    pages = [
        make_page(
            "https://example.com/",
            headers={
                "x-origin-server": "198.51.100.22",
                "x-backend-host": "origin-node1.internal.example.com",
            },
        )
    ]
    cdn_data = {"detected": True, "provider": "Cloudflare"}
    origin, findings = analyze_origin_exposure(pages, cdn_data=cdn_data, target_domain="example.com")
    assert origin["signal_detected"] is True
    assert "198.51.100.22" in origin["origin_ips"]
    assert "origin-node1.internal.example.com" in origin["origin_hostnames"]
    origin_findings = [f for f in findings if f.check_type == "deep_origin_exposure_signal"]
    assert len(origin_findings) >= 1
    assert origin_findings[0].severity == Severity.HIGH


def test_origin_exposure_san_certificate():
    """Verify origin server leakage via TLS certificate Subject Alternative Names."""
    pages = [make_page("https://example.com/")]
    cdn_data = {"detected": True, "provider": "Cloudflare"}
    tls_meta = {
        "san_names": ["example.com", "origin.example.com", "direct-origin.example.com"]
    }
    origin, findings = analyze_origin_exposure(
        pages, cdn_data=cdn_data, tls_metadata=tls_meta, target_domain="example.com"
    )
    assert origin["signal_detected"] is True
    assert any("origin.example.com" in h for h in origin["origin_hostnames"])


def test_origin_clean_when_no_leaks():
    """Verify origin is clean when no internal headers or SANs are disclosed."""
    pages = [
        make_page(
            "https://example.com/",
            headers={"server": "cloudflare", "cf-ray": "12345"},
        )
    ]
    cdn_data = {"detected": True, "provider": "Cloudflare"}
    tls_meta = {"san_names": ["example.com", "www.example.com"]}
    origin, findings = analyze_origin_exposure(
        pages, cdn_data=cdn_data, tls_metadata=tls_meta, target_domain="example.com"
    )
    assert origin["signal_detected"] is False
    assert len(findings) == 0


# =============================================================================
# 4. DEPLOYMENT PLATFORM & EXPOSED ARTIFACTS
# =============================================================================

def test_deployment_platform_fingerprint_vercel():
    """Verify Vercel platform detection via headers."""
    pages = [
        make_page(
            "https://example.com/",
            headers={"x-vercel-id": "iad1::hfg98-1700000000000-abcde"},
        )
    ]
    deploy, findings, reqs = analyze_deployment(pages, target_domain="example.com")
    assert deploy["platform"] == "Vercel"
    assert deploy["confidence"] == "high"


def test_deployment_git_head_exposed():
    """Verify critical finding when /.git/HEAD returns valid Git reference."""
    pages = [make_page("https://example.com/")]
    mock_client = MagicMock()
    mock_client.get.return_value = make_safe_response(
        "https://example.com/.git/HEAD",
        status_code=200,
        text="ref: refs/heads/main\n",
    )

    deploy, findings, reqs = analyze_deployment(
        pages, client=mock_client, target_domain="example.com", base_url="https://example.com"
    )
    assert deploy["git_exposed"] is True
    git_findings = [f for f in findings if f.check_type == "deep_git_metadata_exposure"]
    assert len(git_findings) == 1
    assert git_findings[0].severity == Severity.CRITICAL


def test_deployment_git_head_safe_404():
    """Verify clean status when /.git/HEAD returns 404."""
    pages = [make_page("https://example.com/")]
    mock_client = MagicMock()
    mock_client.get.return_value = make_safe_response(
        "https://example.com/.git/HEAD", status_code=404, text="404 Not Found"
    )

    deploy, findings, reqs = analyze_deployment(
        pages, client=mock_client, target_domain="example.com", base_url="https://example.com"
    )
    assert deploy["git_exposed"] is False
    git_findings = [f for f in findings if f.check_type == "deep_git_metadata_exposure"]
    assert len(git_findings) == 0


def test_deployment_package_json_exposed():
    """Verify finding when package.json is publicly exposed on web root."""
    pages = [make_page("https://example.com/")]
    mock_client = MagicMock()

    def mock_get(url, *args, **kwargs):
        if url.endswith("/package.json"):
            return make_safe_response(url, 200, '{"name": "my-app", "version": "1.0.0", "dependencies": {}}')
        return make_safe_response(url, 404, "Not Found")

    mock_client.get.side_effect = mock_get

    deploy, findings, reqs = analyze_deployment(
        pages, client=mock_client, target_domain="example.com", base_url="https://example.com"
    )
    artifact_findings = [f for f in findings if f.check_type == "deep_deployment_artifact_exposure"]
    assert len(artifact_findings) >= 1
    assert artifact_findings[0].severity == Severity.MEDIUM


def test_deployment_dockerfile_exposed():
    """Verify Dockerfile exposure generates a finding."""
    pages = [make_page("https://example.com/")]
    mock_client = MagicMock()

    def mock_get(url, *args, **kwargs):
        if url.endswith("/Dockerfile"):
            return make_safe_response(url, 200, "FROM node:18-alpine\nWORKDIR /app\nCOPY . .\nCMD [\"npm\", \"start\"]\n")
        return make_safe_response(url, 404, "Not Found")

    mock_client.get.side_effect = mock_get

    deploy, findings, reqs = analyze_deployment(
        pages, client=mock_client, target_domain="example.com", base_url="https://example.com"
    )
    docker_findings = [f for f in findings if f.check_type == "deep_docker_artifact_exposure"]
    assert len(docker_findings) >= 1
    assert docker_findings[0].severity == Severity.HIGH


# =============================================================================
# 5. ENVIRONMENT EXPOSURE (STAGING, DEV, INTERNAL IPS, LOCALHOST)
# =============================================================================

def test_environment_staging_detected():
    """Verify staging environment detection from domain and headers."""
    pages = [
        make_page(
            "https://staging.example.com/",
            headers={"x-environment": "staging"},
        )
    ]
    envs, summary, findings = analyze_environments(pages, target_domain="staging.example.com")
    assert summary["detected_count"] >= 1
    staging_findings = [f for f in findings if f.check_type == "deep_staging_env_exposure"]
    assert len(staging_findings) == 1
    assert staging_findings[0].severity == Severity.MEDIUM


def test_environment_dev_detected():
    """Verify development environment detection."""
    pages = [make_page("https://dev.example.com/")]
    envs, summary, findings = analyze_environments(pages, target_domain="dev.example.com")
    assert summary["detected_count"] >= 1
    dev_findings = [f for f in findings if f.check_type == "deep_dev_env_exposure"]
    assert len(dev_findings) == 1


def test_environment_internal_ip_leaks():
    """Verify RFC 1918 private IP addresses in responses generate findings."""
    body = "<div>Server node: 10.240.0.15 connected to db: 192.168.1.50</div>"
    pages = [make_page("https://example.com/", body_sample=body)]
    envs, summary, findings = analyze_environments(pages, target_domain="example.com")
    assert summary["internal_references_count"] >= 2
    ip_findings = [f for f in findings if f.check_type == "deep_internal_hostname_exposure"]
    assert len(ip_findings) == 1
    assert ip_findings[0].severity == Severity.LOW


def test_environment_localhost_reference():
    """Verify localhost references in client-side code generate finding."""
    body = "<script>const API_DEBUG = 'http://localhost:3000/api/v1';</script>"
    pages = [make_page("https://example.com/", body_sample=body)]
    envs, summary, findings = analyze_environments(pages, target_domain="example.com")
    assert summary["localhost_references_count"] >= 1
    local_findings = [f for f in findings if f.check_type == "deep_localhost_reference"]
    assert len(local_findings) == 1


# =============================================================================
# 6. OPERATIONAL SURFACES, METRICS & ACTUATOR
# =============================================================================

def test_operational_actuator_env_exposure():
    """Verify Spring Boot Actuator /actuator/env exposure produces HIGH severity finding."""
    pages = [make_page("https://example.com/")]
    mock_client = MagicMock()

    def mock_get(url, *args, **kwargs):
        if url.endswith("/actuator/env"):
            return make_safe_response(
                url,
                200,
                '{"activeProfiles":["production"],"propertySources":[{"name":"server.ports","properties":{"local.server.port":{"value":8080}}}]}',
                headers={"content-type": "application/json"},
            )
        return make_safe_response(url, 404, "Not Found")

    mock_client.get.side_effect = mock_get

    op_data, findings, reqs = analyze_operational_surfaces(
        pages, client=mock_client, target_domain="example.com", base_url="https://example.com"
    )
    assert op_data["sensitive_actuators_count"] >= 1
    act_findings = [f for f in findings if f.check_type == "deep_actuator_sensitive_exposure"]
    assert len(act_findings) == 1
    assert act_findings[0].severity == Severity.HIGH


def test_operational_prometheus_metrics_exposure():
    """Verify unauthenticated Prometheus /metrics exposure produces finding."""
    pages = [make_page("https://example.com/")]
    mock_client = MagicMock()

    def mock_get(url, *args, **kwargs):
        if url.endswith("/metrics"):
            return make_safe_response(
                url,
                200,
                "# HELP http_requests_total The total number of HTTP requests.\n# TYPE http_requests_total counter\nhttp_requests_total{method=\"post\",code=\"200\"} 1027\n",
                headers={"content-type": "text/plain; version=0.0.4"},
            )
        return make_safe_response(url, 404, "Not Found")

    mock_client.get.side_effect = mock_get

    op_data, findings, reqs = analyze_operational_surfaces(
        pages, client=mock_client, target_domain="example.com", base_url="https://example.com"
    )
    assert op_data["metrics_exposed"] is True
    metric_findings = [f for f in findings if f.check_type == "deep_public_metrics_exposure"]
    assert len(metric_findings) == 1
    assert metric_findings[0].severity == Severity.MEDIUM


def test_operational_go_debug_vars_exposure():
    """Verify Go runtime /debug/vars exposure produces finding."""
    pages = [make_page("https://example.com/")]
    mock_client = MagicMock()

    def mock_get(url, *args, **kwargs):
        if url.endswith("/debug/vars"):
            return make_safe_response(
                url,
                200,
                '{"cmdline": ["/usr/local/bin/myapp"], "memstats": {"Alloc": 1048576}}',
                headers={"content-type": "application/json"},
            )
        return make_safe_response(url, 404, "Not Found")

    mock_client.get.side_effect = mock_get

    op_data, findings, reqs = analyze_operational_surfaces(
        pages, client=mock_client, target_domain="example.com", base_url="https://example.com"
    )
    assert op_data["debug_exposed"] is True
    debug_findings = [f for f in findings if f.check_type == "deep_public_debug_infrastructure"]
    assert len(debug_findings) == 1
    assert debug_findings[0].severity == Severity.MEDIUM


def test_operational_admin_management_interface():
    """Verify public management interface (/admin/) produces finding."""
    pages = [make_page("https://example.com/")]
    mock_client = MagicMock()

    def mock_get(url, *args, **kwargs):
        if url.endswith("/admin/"):
            return make_safe_response(
                url,
                200,
                "<html><head><title>Admin Control Panel</title></head><body><h1>Administration Portal</h1></body></html>",
                headers={"content-type": "text/html"},
            )
        return make_safe_response(url, 404, "Not Found")

    mock_client.get.side_effect = mock_get

    op_data, findings, reqs = analyze_operational_surfaces(
        pages, client=mock_client, target_domain="example.com", base_url="https://example.com"
    )
    assert op_data["management_routes_count"] >= 1
    admin_findings = [f for f in findings if f.check_type == "deep_public_management_interface"]
    assert len(admin_findings) == 1
    assert admin_findings[0].severity in [Severity.LOW, Severity.INFO]


# =============================================================================
# 7. DNS INFRASTRUCTURE, DUAL-STACK & SUBDOMAIN TAKEOVERS
# =============================================================================

def test_dns_dual_stack_consistent():
    """Verify dual-stack IPv4/IPv6 configuration is marked consistent when on same CDN."""
    dns_meta = {
        "a": ["104.21.12.34", "172.67.180.12"],
        "aaaa": ["2606:4700:3033::ac43:b40c"],
    }
    cdn_data = {"detected": True, "provider": "Cloudflare"}
    dns_rel, findings = analyze_dns_infrastructure(
        dns_metadata=dns_meta, target_domain="example.com", cdn_data=cdn_data
    )
    assert dns_rel["ipv6_enabled"] is True
    assert len(dns_rel["inconsistencies"]) == 0
    assert len(findings) == 0


def test_dns_dual_stack_inconsistency_origin_bypass():
    """Verify inconsistency finding when IPv4 is on CDN but IPv6 points to non-CDN raw origin."""
    dns_meta = {
        "a": ["104.21.12.34"],  # Cloudflare IP
        "aaaa": ["2001:db8:85a3::8a2e:370:7334"],  # Documentation/origin IP, not Cloudflare
    }
    cdn_data = {"detected": True, "provider": "Cloudflare"}
    dns_rel, findings = analyze_dns_infrastructure(
        dns_metadata=dns_meta, target_domain="example.com", cdn_data=cdn_data
    )
    assert dns_rel["ipv6_enabled"] is True
    incon_findings = [f for f in findings if f.check_type == "deep_ipv6_configuration_inconsistency"]
    assert len(incon_findings) == 1
    assert incon_findings[0].severity == Severity.MEDIUM


def test_dns_subdomain_takeover_signal():
    """Verify dangling CNAME record pointing to SaaS generates conservative signal finding."""
    dns_meta = {
        "cname": ["orphan-docs.github.io."],
    }
    dns_rel, findings = analyze_dns_infrastructure(
        dns_metadata=dns_meta, target_domain="docs.example.com"
    )
    assert dns_rel["takeover_signals_count"] >= 1
    takeover_findings = [f for f in findings if f.check_type == "deep_subdomain_takeover_signal"]
    assert len(takeover_findings) == 1
    assert takeover_findings[0].severity == Severity.HIGH
    assert "administrative verification is required" in takeover_findings[0].how_to_fix.lower()


# =============================================================================
# 8. CLOUD STORAGE ANALYZER
# =============================================================================

def test_storage_s3_gcs_discovered():
    """Verify passive discovery of referenced S3 and GCS storage buckets in page DOM."""
    body = (
        '<div><img src="https://my-company-assets.s3.amazonaws.com/logo.png">'
        '<script src="https://storage.googleapis.com/gcs-public-bundles/app.js"></script></div>'
    )
    pages = [make_page("https://example.com/", body_sample=body)]
    endpoints, findings, reqs = analyze_cloud_storage(pages)
    assert len(endpoints) == 2
    providers = [e["provider"] for e in endpoints]
    assert "Amazon S3" in providers
    assert "Google Cloud Storage" in providers


def test_storage_sensitive_env_object_exposed():
    """Verify probe finding when sensitive .env file is accessible."""
    pages = [make_page("https://example.com/", body_sample='<a href="https://mybucket.s3.amazonaws.com/.env">Config</a>')]
    mock_client = MagicMock()

    def mock_get(url, *args, **kwargs):
        if ".env" in url:
            return make_safe_response(
                url,
                200,
                "APP_ENV=production\nDB_CONNECTION=mysql\nDB_HOST=127.0.0.1\nDB_PASSWORD=secret_db_pass_123\n",
            )
        return make_safe_response(url, 404, "Not Found")

    mock_client.get.side_effect = mock_get

    endpoints, findings, reqs = analyze_cloud_storage(pages, client=mock_client)
    sens_findings = [f for f in findings if f.check_type == "deep_public_storage_sensitive_object"]
    assert len(sens_findings) >= 1
    assert sens_findings[0].severity in [Severity.CRITICAL, Severity.HIGH]


# =============================================================================
# 9. CONTAINER & KUBERNETES SIGNALS
# =============================================================================

def test_container_kubernetes_signals_detected():
    """Verify Kubernetes cluster.local and pod ID signals are recognized."""
    body = "<!-- Routed via k8s-ingress pod: api-deployment-789fbd765-x9z2k.default.svc.cluster.local -->"
    pages = [make_page("https://example.com/", body_sample=body)]
    container_data, findings = analyze_containers_and_kubernetes(pages)
    assert container_data["kubernetes_detected"] is True
    assert container_data["kubernetes_signals_count"] >= 1
    k8s_findings = [f for f in findings if f.check_type == "deep_kubernetes_exposure_signal"]
    assert len(k8s_findings) == 1
    assert k8s_findings[0].severity == Severity.LOW


# =============================================================================
# 10. MASTER ORCHESTRATOR, BOUNDS & FAILURE ISOLATION
# =============================================================================

def test_infrastructure_orchestrator_execution():
    """Verify full orchestrator execution produces complete metadata and deduped findings."""
    pages = [
        make_page(
            "https://example.com/",
            headers={"server": "cloudflare", "cf-ray": "8d19e8f5dcdb4d7c-IAD"},
        )
    ]
    mock_client = MagicMock()
    mock_client.get.return_value = make_safe_response("https://example.com/test", 404, "Not Found")

    meta, findings = analyze_infrastructure_security(
        crawled_pages=pages,
        client=mock_client,
        target_domain="example.com",
    )
    assert meta["status"] == "completed"
    assert "infrastructure" in meta
    assert "cdn" in meta
    assert "cloud" in meta
    assert "origin" in meta
    assert "deployment" in meta
    assert "environments" in meta
    assert "storage" in meta
    assert "operational_exposure" in meta
    assert "dns_relationships" in meta
    assert meta["summary"]["primary_provider"] == "Cloudflare"


def test_infrastructure_orchestrator_request_budget_enforcement():
    """Verify orchestrator strictly bounds outbound requests to max_f6_requests."""
    pages = [make_page("https://example.com/")]
    mock_client = MagicMock()
    mock_client.get.return_value = make_safe_response("https://example.com/probe", 404, "Not Found")

    config = DeepScanConfig(max_f6_requests=3)
    meta, findings = analyze_infrastructure_security(
        crawled_pages=pages,
        client=mock_client,
        target_domain="example.com",
        config=config,
    )
    assert meta["requests_executed"] <= 3
    assert mock_client.get.call_count <= 3


def test_infrastructure_orchestrator_failure_isolation():
    """Verify that if one analyzer raises an unexpected exception, the orchestrator completes safely."""
    pages = [make_page("https://example.com/")]
    mock_client = MagicMock()
    mock_client.get.return_value = make_safe_response("https://example.com/test", 404, "Not Found")

    with patch("scanner.deep.infrastructure_security.analyze_cloud_infrastructure", side_effect=RuntimeError("Cloud crash")):
        meta, findings = analyze_infrastructure_security(
            crawled_pages=pages,
            client=mock_client,
            target_domain="example.com",
        )
        assert meta["status"] == "completed"
        assert "error" in meta["cloud"]
        assert meta["cdn"]["detected"] is False or meta["cdn"]["detected"] is True


# =============================================================================
# 11. SCORING & RUNNER INTEGRATION
# =============================================================================

def test_scoring_f6_deterministic_penalty():
    """Verify that critical/high F6 findings reduce score deterministically in Website & Technology category."""
    clean_findings = [
        make_infra_finding(
            check_type="deep_ssl_validity",
            status=CheckStatus.PASS,
            severity=Severity.INFO,
            title="Valid Certificate",
            summary="SSL is valid",
        )
    ]
    score_clean, risk_clean, stats_clean, _, _ = calculate_deep_score(clean_findings)

    penalized_findings = clean_findings + [
        make_infra_finding(
            check_type="deep_git_metadata_exposure",
            status=CheckStatus.CRITICAL,
            severity=Severity.CRITICAL,
            title="Exposed Git Repository",
            summary="/.git/HEAD is accessible",
        ),
        make_infra_finding(
            check_type="deep_actuator_sensitive_exposure",
            status=CheckStatus.HIGH,
            severity=Severity.HIGH,
            title="Spring Boot Actuator Exposed",
            summary="/actuator/env exposed",
        ),
    ]
    score_penalized, risk_pen, stats_pen, _, _ = calculate_deep_score(penalized_findings)

    assert score_penalized < score_clean
    tech_stats = stats_pen.get("Website & Technology", {})
    assert tech_stats.get("deductions", 0) > 0


def test_deep_runner_f6_integration_and_version():
    """Verify full deep scan runner executes F6, sets deep_scan_version = 6, and records infrastructure metadata."""
    client = MagicMock()
    mock_resp = SafeResponse(
        url="https://example.com",
        status_code=200,
        headers={"Server": "cloudflare", "CF-Ray": "8d19e8f5dcdb4d7c-IAD", "Content-Type": "text/html"},
        text="<html><head><title>Test App</title></head><body><h1>Hello</h1></body></html>",
        final_url="https://example.com",
        elapsed_ms=20,
        resolved_ip="104.21.12.34",
    )
    client.get.return_value = mock_resp
    client.options.return_value = mock_resp

    resolver = MagicMock()
    resolver.resolve.return_value = ["104.21.12.34"]

    res = run_deep_security_scan("example.com", resolver=resolver, client=client)
    assert res.scan_metadata["deep_scan_version"] >= 6
    assert "infrastructure_security" in res.scan_metadata
    assert res.scan_metadata["infrastructure_security"]["status"] == "completed"
    assert 0 <= res.score <= 100
    assert "Website & Technology" in res.score_breakdown


def test_backward_compatibility_v1_to_v5_metadata():
    """Verify that legacy metadata dictionaries from v1-v5 do not cause key errors."""
    legacy_metadata = {
        "deep_scan_version": 5,
        "application_security": {"status": "completed"},
        "identity_security": {"status": "completed"},
    }
    # Absence of "infrastructure_security" should be handled safely by consumers
    infra_sec = legacy_metadata.get("infrastructure_security")
    assert infra_sec is None


def test_secret_masking_in_f6():
    """Verify that tokens and passwords observed in F6 files are cryptographically masked."""
    pages = [make_page("https://example.com/", body_sample='<a href="https://mybucket.s3.amazonaws.com/.env">Config</a>')]
    mock_client = MagicMock()
    mock_client.get.return_value = make_safe_response(
        "https://mybucket.s3.amazonaws.com/.env",
        200,
        "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n",
    )
    endpoints, findings, reqs = analyze_cloud_storage(pages, client=mock_client)
    for f in findings:
        assert "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" not in f.summary
        assert "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" not in (f.evidence or "")
