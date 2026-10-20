"""
Tests for Phase F8: Advanced Security Correlation, Attack-Surface Risk Graph & Executive Security Posture Intelligence
Comprehensive verification conforming strictly to Phase F8 specification:
- Finding normalization, canonical category mapping, and source phase attribution (F1-F8)
- Security relationship graph generation, node/edge models, bounded limits, and deterministic sorting
- Attack-surface exposure metrics, concentration analysis, and asset ranking
- All 15 deterministic compound security risk chains
- Zero score deduction validation (score_impact = 0 on all F8 findings)
- Systemic root-cause grouping and evidence-based descriptions (zero speculation)
- Prioritized 4-tier remediation roadmap and root-cause-first actions
- Defense-in-depth executive posture scoring across 7 dimensions and positive defensive signals
- Zero network requests enforcement during F8 intelligence analysis
- Subcomponent failure isolation (graph, chains, root cause, remediation, posture)
- Full Deep Scan runner integration (deep_scan_version = 8)
- Backward compatibility for legacy v1-v7 scans
- PDF report executive risk intelligence generation
"""
import os
import sys
import uuid
import tempfile
from unittest.mock import MagicMock, patch
from urllib.parse import urlparse

# Ensure root and apps/api are in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

import pytest
from scanner.models import CheckStatus, Severity, Finding
from scanner.network.models import SafeResponse
from scanner.deep.models import CrawledPage, RobotsAnalysis, SitemapAnalysis
from scanner.deep.config import DeepScanConfig
from scanner.deep.finding_normalizer import (
    normalize_findings,
    determine_source_phase,
    determine_canonical_category,
    extract_asset_and_url,
    SecurityEvidence,
)
from scanner.deep.risk_graph import build_security_graph
from scanner.deep.attack_surface_graph import calculate_attack_surface
from scanner.deep.risk_chain_analyzer import (
    analyze_risk_chains,
    make_chain_finding,
    RiskChain,
)
from scanner.deep.root_cause_analyzer import (
    analyze_root_causes,
    ROOT_CAUSE_DEFINITIONS,
)
from scanner.deep.remediation_analyzer import (
    analyze_remediation,
    PriorityAction,
)
from scanner.deep.posture_analyzer import analyze_executive_posture
from scanner.deep.risk_intelligence import analyze_risk_intelligence
from scanner.deep.runner import run_deep_security_scan
from app.services.pdf_service import generate_pdf_report
from app.models.scan import Scan, ScanCheck


def make_test_finding(
    check_type: str,
    title: str = "Test Finding",
    severity: Severity = Severity.MEDIUM,
    status: CheckStatus = CheckStatus.WARNING,
    score_impact: int = -5,
    evidence: str = "",
    url: str = "https://example.com/app",
    technical_details: dict = None,
) -> Finding:
    """Helper to construct Finding instances with realistic test data."""
    td = {"url": url, "category": "Testing"}
    if technical_details:
        td.update(technical_details)

    return Finding(
        check_type=check_type,
        name=title,
        status=status,
        severity=severity,
        score_impact=score_impact,
        title=title,
        summary=f"Summary for {check_type}",
        why_it_matters=f"Why it matters for {check_type}",
        how_to_fix=f"How to fix {check_type}",
        estimated_fix_minutes=30,
        documentation_url=f"https://sitesecura.com/docs/{check_type}",
        technical_details=td,
        evidence=evidence or f"Observed at {url}",
        confidence=1.0,
    )


def make_page(url: str, **kwargs) -> CrawledPage:
    """Helper to construct CrawledPage with required attributes."""
    defaults = {
        "final_url": url,
        "depth": 1,
        "status_code": 200,
        "content_type": "text/html",
        "is_https": url.startswith("https"),
        "headers": {"server": "nginx", "content-type": "text/html"},
        "forms": [],
        "resources": [],
        "technologies": [],
        "inline_scripts": [],
        "discovered_links": [],
        "elapsed_ms": 150,
        "body_sample": "<html><body>Scanly Test Page</body></html>",
    }
    defaults.update(kwargs)
    return CrawledPage(
        url=url,
        **defaults,
    )


# ==============================================================================
# 1. NORMALIZATION & SOURCE PHASE ATTRIBUTION TESTS
# ==============================================================================

class TestFindingNormalization:
    """Verify source phase attribution, canonical category mapping, and evidence deduplication."""

    def test_determine_source_phase_f1_to_f8(self):
        """Verify check types correctly map to F1-F8 phases."""
        assert determine_source_phase("deep_tech_stack_detected") == "F1"
        assert determine_source_phase("deep_subdomain_discovered") == "F1"
        assert determine_source_phase("deep_tls_certificate_valid") == "F2"
        assert determine_source_phase("deep_dns_dnssec_valid") == "F2"
        assert determine_source_phase("deep_js_secret_leaked") == "F3"
        assert determine_source_phase("deep_source_map_detected") == "F3"
        assert determine_source_phase("deep_http_trace_method_allowed") == "F4"
        assert determine_source_phase("deep_cors_wildcard_origin_allowed") == "F4"
        assert determine_source_phase("deep_auth_endpoint") == "F5"
        assert determine_source_phase("deep_password_policy") == "F5"
        assert determine_source_phase("deep_infra_s3_bucket_public") == "F6"
        assert determine_source_phase("deep_git_exposure") == "F6"
        assert determine_source_phase("deep_public_pii") == "F7"
        assert determine_source_phase("deep_public_financial") == "F7"
        assert determine_source_phase("deep_risk_chain_public_api_data") == "F8"

    def test_determine_canonical_category(self):
        """Verify canonical category mapping across categories."""
        assert determine_canonical_category("deep_public_pii") == "PERSONAL_DATA_EXPOSURE"
        assert determine_canonical_category("deep_s3_bucket_exposure") == "CLOUD_STORAGE_EXPOSURE"
        assert determine_canonical_category("deep_auth_login") == "AUTHENTICATION_SURFACE"
        assert determine_canonical_category("deep_api_endpoint") == "API_SURFACE"
        assert determine_canonical_category("deep_js_source_map") == "DEVELOPMENT_ARTIFACT"
        assert determine_canonical_category("deep_tls_weak_cipher") == "TRANSPORT_SECURITY"
        assert determine_canonical_category("deep_csp_missing") == "SECURITY_HEADERS"
        assert determine_canonical_category("unmapped_custom_check") == "GENERAL_OBSERVATION"

    def test_extract_asset_and_url(self):
        """Verify asset and URL extraction from findings."""
        f1 = make_test_finding("test", evidence="Leaked at https://api.example.com/v1/users", url="https://example.com/v1/users")
        asset, url = extract_asset_and_url(f1)
        assert asset == "/v1/users"
        assert url == "https://example.com/v1/users"

        f2 = make_test_finding("test", evidence="Plain text", url="https://sub.domain.com/")
        asset, url = extract_asset_and_url(f2)
        assert asset == "sub.domain.com"
        assert url == "https://sub.domain.com/"

    def test_normalize_and_deduplicate(self):
        """Verify normalization builds proper SecurityEvidence and removes duplicates."""
        f1 = make_test_finding("deep_admin_endpoint", url="https://example.com/admin")
        f2 = make_test_finding("deep_admin_endpoint", url="https://example.com/admin")
        f3 = make_test_finding("deep_s3_bucket_exposure", url="https://bucket.s3.amazonaws.com")

        evidence_list = normalize_findings([f1, f2, f3])
        assert len(evidence_list) == 2
        assert any(e.check_type == "deep_admin_endpoint" for e in evidence_list)
        assert any(e.check_type == "deep_s3_bucket_exposure" for e in evidence_list)


# ==============================================================================
# 2. SECURITY RELATIONSHIP GRAPH TESTS
# ==============================================================================

class TestSecurityRelationshipGraph:
    """Verify security graph nodes, edges, deterministic sorting, limits, and masking."""

    def test_empty_findings_graph(self):
        """Verify graph generation with no findings still produces root website node."""
        graph = build_security_graph([], {"domain": "example.com"})
        assert len(graph["nodes"]) >= 1
        assert graph["nodes"][0]["id"] == "node:website:root"
        assert graph["nodes"][0]["type"] == "website"
        assert graph["graph_truncated"] is False

    def test_graph_nodes_and_edges(self):
        """Verify correct node and edge generation connecting findings, assets, and technologies."""
        findings = [
            make_test_finding("deep_admin_endpoint", url="https://example.com/admin", severity=Severity.HIGH),
            make_test_finding("deep_public_pii", url="https://example.com/api/users", severity=Severity.HIGH),
        ]
        evidence_list = normalize_findings(findings)
        metadata = {
            "domain": "example.com",
            "technologies": [{"name": "WordPress", "category": "CMS"}],
            "third_party_scripts": [{"domain": "google-analytics.com", "name": "Google Analytics"}],
        }
        graph = build_security_graph(evidence_list, metadata)

        node_types = {n["type"] for n in graph["nodes"]}
        edge_types = {e["relationship"] for e in graph["edges"]}

        assert "website" in node_types
        assert "finding" in node_types
        assert "technology" in node_types
        assert "third_party" in node_types
        assert "USES_TECHNOLOGY" in edge_types
        assert "AFFECTS" in edge_types
        assert graph["node_count"] == len(graph["nodes"])
        assert graph["edge_count"] == len(graph["edges"])

    def test_deterministic_sorting(self):
        """Verify nodes and edges are deterministically sorted by ID and source/target."""
        findings = [
            make_test_finding("deep_public_pii", url="https://example.com/b"),
            make_test_finding("deep_admin_endpoint", url="https://example.com/a"),
        ]
        ev1 = normalize_findings(findings)
        ev2 = list(reversed(ev1))

        g1 = build_security_graph(ev1, {"domain": "example.com"})
        g2 = build_security_graph(ev2, {"domain": "example.com"})

        assert [n["id"] for n in g1["nodes"]] == [n["id"] for n in g2["nodes"]]
        assert [(e["source"], e["target"]) for e in g1["edges"]] == [(e["source"], e["target"]) for e in g2["edges"]]

    def test_graph_limits_and_truncation(self):
        """Verify graph strictly respects max node and edge limits."""
        many_findings = [
            make_test_finding(f"deep_check_{i}", url=f"https://example.com/path_{i}")
            for i in range(50)
        ]
        evidence_list = normalize_findings(many_findings)
        graph = build_security_graph(evidence_list, {"domain": "example.com"}, max_nodes=10, max_edges=15)
        assert len(graph["nodes"]) <= 10
        assert len(graph["edges"]) <= 15
        assert graph["graph_truncated"] is True

    def test_graph_preserves_f7_masking(self):
        """Verify no unmasked secrets or sensitive tokens appear in graph properties."""
        findings = [
            make_test_finding(
                "deep_public_pii",
                evidence="Exposed email: u***r@example.com, card: 4111-XXXX-XXXX-1111",
                url="https://example.com/api/orders",
            )
        ]
        evidence_list = normalize_findings(findings)
        graph = build_security_graph(evidence_list, {"domain": "example.com"})
        assert "4111-XXXX-XXXX-1111" in evidence_list[0].metadata.get("evidence_snippet", "")
        assert all("raw_content" not in n.get("metadata", {}) for n in graph["nodes"])


# ==============================================================================
# 3. ATTACK SURFACE METRICS TESTS
# ==============================================================================

class TestAttackSurfaceMetrics:
    """Verify attack surface exposure metrics, concentration detection, and asset attention."""

    def test_attack_surface_metrics_calculation(self):
        """Verify attack surface metrics are computed from crawl and evidence."""
        findings = [
            make_test_finding("deep_admin_endpoint", url="https://admin.example.com/login"),
            make_test_finding("deep_api_endpoint", url="https://api.example.com/data"),
            make_test_finding("deep_s3_bucket_exposure", url="https://assets.example.com/bucket"),
        ]
        metadata = {
            "application_security": {"endpoints_analyzed": 12},
            "technologies": [{"name": "React"}],
            "third_party_scripts": [{"domain": "cdn.example.net"}],
        }
        pages = [make_page("https://example.com/"), make_page("https://api.example.com/data")]
        evidence_list = normalize_findings(findings)
        surface = calculate_attack_surface(pages, metadata, evidence_list)

        metrics = surface["metrics"]
        assert metrics["public_endpoints"] == 2
        assert metrics["api_endpoints"] >= 1
        assert "cloud_components" in metrics
        assert "exposure_concentration" in surface

    def test_exposure_concentration_detection(self):
        """Verify concentration on a single domain is identified."""
        findings = [
            make_test_finding("deep_api_endpoint", url="https://api.example.com/login", severity=Severity.HIGH),
            make_test_finding("deep_api_endpoint", url="https://api.example.com/users", severity=Severity.HIGH),
            make_test_finding("deep_api_endpoint", url="https://api.example.com/cors", severity=Severity.MEDIUM),
        ]
        evidence_list = normalize_findings(findings)
        surface = calculate_attack_surface([], {}, evidence_list)

        concentration = surface["exposure_concentration"]
        assert concentration["concentration_detected"] is True
        assert len(surface["high_attention_assets"]) >= 1
        top_asset = surface["high_attention_assets"][0]
        assert top_asset["findings_count"] >= 1


# ==============================================================================
# 4. ALL 15 RISK CHAIN ANALYZER TESTS
# ==============================================================================

class TestRiskChainAnalyzer:
    """Verify all 15 deterministic compound risk chains trigger on exact conditions and produce 0-score findings."""

    def test_chain_1_public_api_data(self):
        """Chain 1: Public API + Sensitive Data Exposure."""
        findings = [
            make_test_finding("deep_api_endpoint", url="https://example.com/api/users"),
            make_test_finding("deep_public_pii", url="https://example.com/api/users"),
        ]
        evidence_list = normalize_findings(findings)
        chains, chain_findings = analyze_risk_chains(evidence_list, {})
        chain_ids = [c["chain_id"] for c in chains]
        assert "chain_api_data" in chain_ids
        assert any(cf.check_type == "deep_risk_chain_public_api_data" for cf in chain_findings)

    def test_chain_2_admin_auth(self):
        """Chain 2: Admin Exposure + Weak Authentication / Session."""
        findings = [
            make_test_finding("deep_admin_endpoint", url="https://example.com/admin"),
            make_test_finding("deep_auth_login", url="https://example.com/admin"),
        ]
        evidence_list = normalize_findings(findings)
        chains, _ = analyze_risk_chains(evidence_list, {})
        chain_ids = [c["chain_id"] for c in chains]
        assert "chain_admin_auth" in chain_ids

    def test_chain_3_admin_api_authz(self):
        """Chain 3: Exposed Admin Route + Public Sensitive API + Authorization."""
        findings = [
            make_test_finding("deep_admin_endpoint", url="https://example.com/admin/dashboard"),
            make_test_finding("deep_api_endpoint", url="https://example.com/api/debug"),
            make_test_finding("deep_auth_role", url="https://example.com/api/role"),
        ]
        evidence_list = normalize_findings(findings)
        chains, _ = analyze_risk_chains(evidence_list, {})
        chain_ids = [c["chain_id"] for c in chains]
        assert "chain_admin_api_authz" in chain_ids

    def test_chain_4_frontend_internal_disclosure(self):
        """Chain 4: Frontend Source Map / JS Leak + Internal Subdomain / IP."""
        findings = [
            make_test_finding("deep_source_map_detected", url="https://example.com/main.js.map"),
            make_test_finding("deep_js_internal_url", url="https://example.com/bundle.js"),
        ]
        evidence_list = normalize_findings(findings)
        chains, _ = analyze_risk_chains(evidence_list, {})
        chain_ids = [c["chain_id"] for c in chains]
        assert "chain_frontend_internal" in chain_ids

    def test_chain_5_frontend_secret(self):
        """Chain 5: Source Map + Hardcoded Secret."""
        findings = [
            make_test_finding("deep_source_map_detected", url="https://example.com/main.js.map"),
            make_test_finding("deep_js_secret_leaked", url="https://example.com/bundle.js"),
        ]
        evidence_list = normalize_findings(findings)
        chains, _ = analyze_risk_chains(evidence_list, {})
        chain_ids = [c["chain_id"] for c in chains]
        assert "chain_frontend_secret" in chain_ids

    def test_chain_6_origin_bypass(self):
        """Chain 6: Origin Exposure + CDN Detection."""
        findings = [
            make_test_finding("deep_origin_exposure", url="https://example.com"),
        ]
        meta = {"infrastructure_security": {"cdn": {"detected": True, "provider": "Cloudflare"}}}
        evidence_list = normalize_findings(findings)
        chains, _ = analyze_risk_chains(evidence_list, meta)
        chain_ids = [c["chain_id"] for c in chains]
        assert "chain_origin_bypass" in chain_ids

    def test_chain_7_public_cloud_data(self):
        """Chain 7: Public Cloud Storage Bucket + Sensitive Data Exposure."""
        findings = [
            make_test_finding("deep_s3_bucket_exposure", url="https://mybucket.s3.amazonaws.com"),
            make_test_finding("deep_public_payment_data", url="https://example.com/exports/customers.csv"),
        ]
        evidence_list = normalize_findings(findings)
        chains, _ = analyze_risk_chains(evidence_list, {})
        chain_ids = [c["chain_id"] for c in chains]
        assert "chain_cloud_data" in chain_ids

    def test_chain_8_pii_propagation(self):
        """Chain 8: PII in GET Query Parameter + Referrer Exposure."""
        findings = [
            make_test_finding("deep_pii_in_url", url="https://example.com/search?email=test@example.com"),
            make_test_finding("deep_sensitive_referrer", url="https://example.com"),
        ]
        evidence_list = normalize_findings(findings)
        chains, _ = analyze_risk_chains(evidence_list, {})
        chain_ids = [c["chain_id"] for c in chains]
        assert "chain_pii_propagation" in chain_ids

    def test_chain_9_tracking_data_collection(self):
        """Chain 9: Session Replay / Aggressive Tracker + Sensitive Form."""
        findings = [
            make_test_finding("deep_session_recording_detected", url="https://example.com"),
            make_test_finding("deep_sensitive_form_detected", url="https://example.com/checkout"),
        ]
        evidence_list = normalize_findings(findings)
        chains, _ = analyze_risk_chains(evidence_list, {})
        chain_ids = [c["chain_id"] for c in chains]
        assert "chain_tracking_form" in chain_ids

    def test_chain_10_public_document_data(self):
        """Chain 10: Exposed Backup / Dump File + Sensitive Data Inside."""
        findings = [
            make_test_finding("deep_public_data_export", url="https://example.com/dump.csv"),
            make_test_finding("deep_document_internal_metadata", url="https://example.com/doc.pdf"),
        ]
        evidence_list = normalize_findings(findings)
        chains, _ = analyze_risk_chains(evidence_list, {})
        chain_ids = [c["chain_id"] for c in chains]
        assert "chain_public_document_data" in chain_ids

    def test_chain_11_log_auth_data(self):
        """Chain 11: Exposed Server Log + Authentication Surface."""
        findings = [
            make_test_finding("deep_public_log_data", url="https://example.com/error.log"),
            make_test_finding("deep_auth_endpoint", url="https://example.com/login"),
        ]
        evidence_list = normalize_findings(findings)
        chains, _ = analyze_risk_chains(evidence_list, {})
        chain_ids = [c["chain_id"] for c in chains]
        assert "chain_log_auth" in chain_ids

    def test_chain_12_development_exposure(self):
        """Chain 12: Multiple Development / Debug Artifacts."""
        findings = [
            make_test_finding("deep_source_map_detected", url="https://example.com/app.js.map"),
            make_test_finding("deep_git_exposure", url="https://example.com/.git/config"),
        ]
        evidence_list = normalize_findings(findings)
        chains, _ = analyze_risk_chains(evidence_list, {})
        chain_ids = [c["chain_id"] for c in chains]
        assert "chain_development_exposure" in chain_ids

    def test_chain_13_documented_data_surface(self):
        """Chain 13: Swagger / OpenAPI UI + Sensitive Data Exposure."""
        findings = [
            make_test_finding("deep_swagger_ui", url="https://example.com/docs"),
            make_test_finding("deep_public_pii", url="https://example.com/api/data"),
        ]
        evidence_list = normalize_findings(findings)
        chains, _ = analyze_risk_chains(evidence_list, {})
        chain_ids = [c["chain_id"] for c in chains]
        assert "chain_documented_data_surface" in chain_ids

    def test_chain_14_auth_transport(self):
        """Chain 14: Authentication Surface + Weak Transport."""
        findings = [
            make_test_finding("deep_auth_login", url="https://example.com/login"),
            make_test_finding("deep_tls_weak_cipher", url="https://example.com"),
        ]
        evidence_list = normalize_findings(findings)
        chains, _ = analyze_risk_chains(evidence_list, {})
        chain_ids = [c["chain_id"] for c in chains]
        assert "chain_auth_transport" in chain_ids

    def test_chain_15_tracking_governance(self):
        """Chain 15: Tracker Before Consent + Missing Privacy Policy."""
        findings = [
            make_test_finding("deep_session_recording_detected", url="https://example.com"),
            make_test_finding("deep_tracker_before_consent", url="https://example.com"),
        ]
        evidence_list = normalize_findings(findings)
        chains, _ = analyze_risk_chains(evidence_list, {})
        chain_ids = [c["chain_id"] for c in chains]
        assert "chain_tracking_governance" in chain_ids

    def test_chain_findings_zero_score_impact(self):
        """Verify make_chain_finding generates findings with score_impact = 0 to avoid double penalization."""
        findings = [
            make_test_finding("deep_api_endpoint", url="https://example.com/api"),
            make_test_finding("deep_public_pii", url="https://example.com/api"),
        ]
        evidence_list = normalize_findings(findings)
        chains, chain_findings = analyze_risk_chains(evidence_list, {})
        assert len(chain_findings) > 0
        cf = chain_findings[0]

        assert cf.score_impact == 0
        assert cf.check_type.startswith("deep_risk_chain_")
        assert cf.status in (CheckStatus.WARNING, CheckStatus.INFO)
        assert len(cf.evidence) > 0

    def test_risk_chain_max_limit_enforcement(self):
        """Verify chain analyzer respects max_chains limit."""
        findings = [
            make_test_finding("deep_api_endpoint", url="https://example.com/api"),
            make_test_finding("deep_public_pii", url="https://example.com/api"),
            make_test_finding("deep_admin_endpoint", url="https://example.com/admin"),
            make_test_finding("deep_auth_login", url="https://example.com/admin"),
            make_test_finding("deep_source_map_detected", url="https://example.com/main.js.map"),
            make_test_finding("deep_git_exposure", url="https://example.com/.git"),
        ]
        evidence_list = normalize_findings(findings)
        chains, _ = analyze_risk_chains(evidence_list, {}, max_chains=2)
        assert len(chains) <= 2


# ==============================================================================
# 5. ROOT-CAUSE GROUPING TESTS
# ==============================================================================

class TestRootCauseAnalyzer:
    """Verify systemic root cause groupings, evidence linking, and zero speculation."""

    def test_empty_findings_root_causes(self):
        """Verify no root causes are synthesized when findings list is empty."""
        root_causes = analyze_root_causes([])
        assert len(root_causes) == 0

    def test_root_cause_systemic_groupings(self):
        """Verify findings are mapped to their correct root cause categories."""
        findings = [
            make_test_finding("deep_admin_endpoint", url="https://example.com/admin"),
            make_test_finding("deep_source_map_detected", url="https://example.com/bundle.js.map"),
            make_test_finding("deep_public_pii", url="https://example.com/api/users"),
            make_test_finding("deep_tls_weak_cipher", url="https://example.com"),
        ]
        evidence_list = normalize_findings(findings)
        root_causes = analyze_root_causes(evidence_list)
        rc_ids = [rc["id"] for rc in root_causes]

        assert "PUBLIC_ADMIN_SURFACE" in rc_ids
        assert "EXPOSED_DEVELOPMENT_ARTIFACT" in rc_ids
        assert "SENSITIVE_DATA_DISCLOSURE" in rc_ids
        assert "OUTDATED_SECURITY_CONFIGURATION" in rc_ids

    def test_root_cause_evidence_based_descriptions_no_speculation(self):
        """Verify descriptions strictly reference technical definitions without sensational speculation."""
        findings = [
            make_test_finding("deep_source_map_detected", url="https://example.com/app.js.map"),
        ]
        evidence_list = normalize_findings(findings)
        root_causes = analyze_root_causes(evidence_list)
        assert len(root_causes) >= 1
        rc = root_causes[0]
        assert "hacked" not in rc["description"].lower()
        assert "compromised" not in rc["description"].lower()
        assert len(rc["affected_findings"]) >= 1

    def test_root_cause_max_limit(self):
        """Verify root causes respect max_root_causes limit."""
        findings = [
            make_test_finding("deep_admin_endpoint"),
            make_test_finding("deep_source_map_detected"),
            make_test_finding("deep_public_pii"),
            make_test_finding("deep_tls_weak_cipher"),
        ]
        evidence_list = normalize_findings(findings)
        root_causes = analyze_root_causes(evidence_list, max_root_causes=2)
        assert len(root_causes) <= 2


# ==============================================================================
# 6. PRIORITIZED REMEDIATION ROADMAP TESTS
# ==============================================================================

class TestRemediationRoadmap:
    """Verify 4-tier remediation roadmap, priority scoring, and root-cause-first actions."""

    def test_priority_tier_assignment(self):
        """Verify findings are assigned into appropriate priority tiers."""
        critical_finding = make_test_finding("deep_git_exposure", severity=Severity.CRITICAL)
        high_finding = make_test_finding("deep_admin_endpoint", severity=Severity.HIGH)
        low_finding = make_test_finding("deep_tech_stack_detected", severity=Severity.LOW)

        evidence_list = normalize_findings([critical_finding, high_finding, low_finding])
        roadmap_data = analyze_remediation(evidence_list, [], [])

        immediate_actions = roadmap_data["roadmap"]["immediate"]
        short_term_actions = roadmap_data["roadmap"]["short_term"]

        assert len(immediate_actions) >= 1
        assert any("git" in a["action_id"] or "git" in a["title"].lower() for a in immediate_actions)

    def test_root_cause_first_actions(self):
        """Verify root causes generate overarching prioritized action items."""
        findings = [
            make_test_finding("deep_s3_bucket_exposure", severity=Severity.HIGH),
        ]
        evidence_list = normalize_findings(findings)
        root_causes = analyze_root_causes(evidence_list)
        roadmap_data = analyze_remediation(evidence_list, [], root_causes)

        assert len(roadmap_data["priority_actions"]) >= 1
        assert any(a.get("article_slug") is not None for a in roadmap_data["priority_actions"])

    def test_thematic_grouping(self):
        """Verify actions are grouped by themes."""
        findings = [
            make_test_finding("deep_tls_weak_cipher", severity=Severity.HIGH),
            make_test_finding("deep_admin_endpoint", severity=Severity.HIGH),
            make_test_finding("deep_public_pii", severity=Severity.HIGH),
        ]
        evidence_list = normalize_findings(findings)
        roadmap_data = analyze_remediation(evidence_list, [], [])

        groups = roadmap_data["remediation_groups"]
        assert any("Security Headers" in groups or "Administrative Surfaces" in groups or "Data & Privacy" in groups for k in groups)

    def test_four_tier_roadmap_structure(self):
        """Verify the 4-tier roadmap structure contains immediate, short_term, medium_term, long_term."""
        findings = [make_test_finding("deep_admin_endpoint", severity=Severity.HIGH)]
        evidence_list = normalize_findings(findings)
        roadmap_data = analyze_remediation(evidence_list, [], [])

        tiers = roadmap_data["roadmap"]
        assert "immediate" in tiers
        assert "short_term" in tiers
        assert "medium_term" in tiers
        assert "long_term" in tiers


# ==============================================================================
# 7. EXECUTIVE POSTURE ANALYSIS TESTS
# ==============================================================================

class TestExecutivePostureAnalysis:
    """Verify defense-in-depth posture scoring across 7 dimensions and positive signals."""

    def test_posture_seven_defense_dimensions(self):
        """Verify all 7 posture dimensions are evaluated."""
        posture = analyze_executive_posture(90, "Good", [], {})
        dims = posture["posture_dimensions"]

        expected_dims = {
            "transport_and_cryptography",
            "browser_security_headers",
            "application_and_api",
            "identity_and_session",
            "infrastructure_and_cloud",
            "data_and_privacy",
            "build_and_operational_hygiene",
        }
        assert set(dims.keys()) == expected_dims
        for dim_data in dims.values():
            assert "rating" in dim_data
            assert "status" in dim_data
            assert "summary" in dim_data

    def test_posture_ratings_solid_vs_gaps(self):
        """Verify dimension score degrades when severe findings are present."""
        clean_posture = analyze_executive_posture(98, "Excellent", [], {})
        assert clean_posture["posture_dimensions"]["infrastructure_and_cloud"]["rating"] == "SOLID"

        severe_infra_finding = make_test_finding("deep_s3_bucket_exposure", severity=Severity.CRITICAL)
        evidence_list = normalize_findings([severe_infra_finding])
        degraded_posture = analyze_executive_posture(60, "Medium Risk", evidence_list, {})

        assert degraded_posture["posture_dimensions"]["infrastructure_and_cloud"]["rating"] == "CRITICAL_GAPS"

    def test_posture_positive_defensive_signals(self):
        """Verify positive defensive signals (strengths) are surfaced."""
        meta = {
            "tls": {"valid": True, "tls_version": "TLS 1.3", "issuer_organization": "Let's Encrypt"},
            "hsts": {"is_valid": True},
            "infrastructure_security": {"cdn": {"detected": True, "provider": "Cloudflare"}},
        }
        posture = analyze_executive_posture(95, "Excellent", [], meta)
        strengths = posture["positive_signals"]

        assert len(strengths) >= 3
        titles = [s["title"] for s in strengths]
        assert any("TLS" in t for t in titles)
        assert any("HSTS" in t for t in titles)
        assert any("Edge Perimeter" in t for t in titles)

    def test_posture_narrative_and_disclaimers(self):
        """Verify narrative synthesis and legal / non-exploitation disclaimers."""
        posture = analyze_executive_posture(88, "Good", [], {})
        assert len(posture["score_explanation"]) > 0
        assert len(posture["limitations"]) >= 3
        assert any("non-intrusive" in lim.lower() for lim in posture["limitations"])


# ==============================================================================
# 8. RISK INTELLIGENCE MASTER ORCHESTRATOR TESTS
# ==============================================================================

class TestRiskIntelligenceOrchestrator:
    """Verify master orchestrator execution, zero network calls, failure isolation, and config toggles."""

    def test_risk_intelligence_orchestrator_full_flow(self):
        """Verify end-to-end execution returning dictionary and chain findings."""
        findings = [
            make_test_finding("deep_api_endpoint", url="https://example.com/api/users"),
            make_test_finding("deep_public_pii", url="https://example.com/api/users"),
        ]
        intel_data, chain_findings = analyze_risk_intelligence(
            findings=findings,
            crawled_pages=[],
            scan_metadata={"domain": "example.com"},
            score=85,
            risk_level="Good",
        )

        assert "graph" in intel_data
        assert "attack_surface" in intel_data
        assert "risk_chains" in intel_data
        assert "root_causes" in intel_data
        assert "remediation_roadmap" in intel_data
        assert "executive_posture" in intel_data

        assert len(chain_findings) >= 1
        assert chain_findings[0].score_impact == 0

    def test_risk_intelligence_zero_network_requests(self):
        """Verify zero network requests (sockets / HTTP calls) are made during F8 analysis."""
        findings = [
            make_test_finding("deep_admin_endpoint", url="https://example.com/admin"),
            make_test_finding("deep_s3_bucket_exposure", url="https://bucket.s3.amazonaws.com"),
        ]

        with patch("socket.socket") as mock_socket, patch("urllib.request.urlopen") as mock_http:
            intel_data, chain_findings = analyze_risk_intelligence(
                findings=findings,
                crawled_pages=[],
                scan_metadata={"domain": "example.com"},
            )
            mock_socket.assert_not_called()
            mock_http.assert_not_called()

        assert intel_data["attack_surface"]["metrics"]["public_endpoints"] >= 0
        assert len(intel_data["graph"]["nodes"]) >= 2

    def test_risk_intelligence_failure_isolation_subcomponents(self):
        """Verify an exception in one subcomponent does not fail the rest of F8 intelligence."""
        findings = [make_test_finding("deep_admin_endpoint", url="https://example.com/admin")]

        with patch("scanner.deep.risk_intelligence.build_security_graph", side_effect=RuntimeError("Graph crashed")):
            intel_data, chain_findings = analyze_risk_intelligence(
                findings=findings,
                crawled_pages=[],
                scan_metadata={"domain": "example.com"},
            )
            # Graph should fall back gracefully
            assert intel_data["graph"]["nodes"] == []
            assert intel_data["status"] == "partial"
            # Other components should continue executing normally
            assert "attack_surface" in intel_data
            assert "executive_posture" in intel_data

    def test_risk_intelligence_disabled_config(self):
        """Verify F8 intelligence exits cleanly when disabled via configuration."""
        cfg = DeepScanConfig(enable_f8_risk_intelligence=False)
        intel_data, chain_findings = analyze_risk_intelligence(
            findings=[make_test_finding("deep_admin_endpoint")],
            crawled_pages=[],
            scan_metadata={"domain": "example.com"},
            config=cfg,
        )
        assert intel_data["status"] == "disabled"
        assert intel_data["graph"]["nodes"] == []
        assert len(chain_findings) == 0


# ==============================================================================
# 9. RUNNER INTEGRATION & BACKWARD COMPATIBILITY TESTS
# ==============================================================================

class TestRunnerIntegrationAndBackwardCompatibility:
    """Verify Deep Scan runner integration, version bumping to 8, and legacy compatibility."""

    @patch("scanner.deep.runner.resolve_and_validate_target", return_value=("example.com", "93.184.216.34"))
    @patch("scanner.deep.runner.fetch_and_analyze_robots", return_value=(RobotsAnalysis(url="https://example.com/robots.txt", is_present=False), []))
    @patch("scanner.deep.runner.fetch_and_analyze_sitemap", return_value=(SitemapAnalysis(url="https://example.com/sitemap.xml", is_present=False), [], []))
    @patch("scanner.deep.runner.crawl_website")
    @patch("scanner.deep.runner.analyze_deep_tls")
    @patch("scanner.deep.runner.analyze_deep_dns", return_value=({}, []))
    @patch("scanner.deep.runner.analyze_deep_email_security", return_value=({}, []))
    @patch("scanner.deep.runner.analyze_deep_hsts", return_value=({}, []))
    @patch("scanner.deep.runner.analyze_deep_csp", return_value=({}, []))
    @patch("scanner.deep.runner.analyze_deep_security_headers_quality", return_value=({}, []))
    @patch("scanner.deep.runner.analyze_frontend_security")
    @patch("scanner.deep.runner.analyze_application_security")
    @patch("scanner.deep.runner.analyze_identity_security")
    @patch("scanner.deep.runner.analyze_infrastructure_security")
    @patch("scanner.deep.runner.analyze_data_security")
    def test_runner_produces_version_8_and_risk_intelligence(
        self,
        mock_data_sec,
        mock_infra_sec,
        mock_identity_sec,
        mock_app_sec,
        mock_frontend_sec,
        mock_sec_headers,
        mock_csp,
        mock_hsts,
        mock_email,
        mock_dns,
        mock_tls,
        mock_crawl,
        mock_sitemap,
        mock_robots,
        mock_resolve,
    ):
        """Verify full runner increments deep_scan_version to 8 and stores risk_intelligence in metadata."""
        mock_crawl.return_value = ([make_page("https://example.com/")], [], 1)
        mock_tls.return_value = ({"valid": True, "tls_version": "TLS 1.3"}, [make_test_finding("deep_tls_certificate_valid", status=CheckStatus.PASS)])
        mock_frontend_sec.return_value = ({}, [])
        mock_app_sec.return_value = ({}, [])
        mock_identity_sec.return_value = ({}, [])
        mock_infra_sec.return_value = ({}, [])
        mock_data_sec.return_value = ({}, [])

        result = run_deep_security_scan("https://example.com", config=DeepScanConfig())

        assert result.scan_metadata["deep_scan_version"] == 8
        assert "risk_intelligence" in result.scan_metadata
        intel = result.scan_metadata["risk_intelligence"]
        assert "graph" in intel
        assert "attack_surface" in intel
        assert "executive_posture" in intel

    def test_backward_compatibility_v1_to_v7_scans(self):
        """Verify backward compatibility when processing historical scan metadata lacking F8 data."""
        legacy_metadata_v6 = {
            "deep_scan_version": 6,
            "cloud_infrastructure": {"score": 85},
        }
        intel = legacy_metadata_v6.get("risk_intelligence")
        assert intel is None

        # Passing legacy metadata to F8 analyzers handles legacy data gracefully
        intel_data, chains = analyze_risk_intelligence([], [], legacy_metadata_v6, score=90, risk_level="Good")
        assert intel_data["executive_posture"]["overall_score"] == 90
        assert len(chains) == 0

    def test_pdf_service_executive_risk_intelligence_integration(self):
        """Verify PDF report generator handles F8 Risk Intelligence section without error."""
        from datetime import datetime, timezone

        scan = MagicMock()
        scan.id = uuid.uuid4()
        scan.domain = "example.com"
        scan.normalized_domain = "example.com"
        scan.score = 92
        scan.created_at = datetime.now(timezone.utc)
        scan.total_checks_count = 5
        scan.scan_metadata = {
            "deep_scan_version": 8,
            "risk_intelligence": {
                "status": "completed",
                "risk_chains": [
                    {
                        "chain_id": "chain_api_data",
                        "title": "Public API & Sensitive Data Disclosure",
                        "severity": "high",
                        "confidence": "HIGH",
                        "affected_assets": ["/api/users"],
                    }
                ],
            },
        }

        check = MagicMock()
        check.title = "Public API & Sensitive Data"
        check.status = "warning"
        check.severity = "high"
        check.score_impact = 0
        check.category = "Correlation & Risk Chains"
        check.why_it_matters = "Compounding risk."
        check.how_to_fix = "Restrict API."
        check.evidence = "Observed at /api/users"

        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = generate_pdf_report(scan, [check], plan="pro", output_directory=temp_dir)
            assert os.path.exists(pdf_path)
            with open(pdf_path, "rb") as f:
                header = f.read(8)
                assert header.startswith(b"%PDF")

