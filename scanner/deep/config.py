"""
Scanly Scanner Engine - Deep Scan Configuration
Centralized configuration limits and tuning parameters for Phase F1 passive crawling and multi-page audits.
"""
from dataclasses import dataclass, field
from typing import Set


@dataclass
class DeepScanConfig:
    """Configurable execution parameters for deep website security scans."""
    max_pages: int = 50
    max_depth: int = 2
    max_redirects: int = 5
    max_response_bytes: int = 1_048_576  # 1 MB body limit per page
    connect_timeout: float = 5.0
    read_timeout: float = 8.0
    write_timeout: float = 5.0
    pool_timeout: float = 5.0
    total_scan_timeout_seconds: float = 180.0
    max_concurrency: int = 3
    user_agent: str = "SiteSecura-DeepScan/1.0 (+https://sitesecura.com/bot)"
    respect_robots_txt: bool = True
    check_source_maps: bool = True
    max_source_map_bytes: int = 65_536  # 64 KB limit for checking sourcemap head/content
    # Phase F3 Frontend & JavaScript Intelligence
    check_frontend_security: bool = True
    max_scripts_to_analyze: int = 15
    max_script_bytes: int = 524_288  # 500 KB limit per script
    max_total_script_bytes: int = 3_145_728  # 3 MB cumulative limit
    max_source_map_deep_bytes: int = 262_144  # 256 KB limit for deep sourcemap parsing
    # Phase F4 Web Application, API & HTTP Security Intelligence
    check_application_security: bool = True
    max_f4_endpoints: int = 25
    max_f4_requests: int = 30
    max_f4_options_requests: int = 10
    max_f4_cors_tests: int = 5
    max_api_docs_checks: int = 3
    max_f4_response_bytes: int = 524_288  # 512 KB per response
    max_f4_json_depth: int = 10
    max_f4_json_keys: int = 2000
    max_f4_json_array_items: int = 500
    max_f4_error_context: int = 4096  # 4 KB sanitized evidence limit
    # Phase F5 Advanced Authentication, Session, Authorization & Business-Logic Intelligence
    check_identity_security: bool = True
    max_f5_requests: int = 20
    max_auth_endpoints: int = 8
    max_well_known_identity_endpoints: int = 5
    max_oidc_document_size: int = 262_144  # 256 KB
    max_saml_metadata_size: int = 262_144  # 256 KB
    max_f5_response_bytes: int = 524_288  # 512 KB per response
    max_f5_error_context: int = 4096  # 4 KB sanitized evidence limit
    # Phase F6 Advanced Infrastructure, Cloud, Deployment & Operational Security Intelligence
    check_infrastructure_security: bool = True
    max_f6_requests: int = 20
    max_infra_surfaces: int = 20
    max_deployment_artifact_checks: int = 5
    max_storage_checks: int = 5
    max_operational_endpoints: int = 10
    max_response_bytes_f6: int = 524_288  # 512 KB
    max_document_bytes_f6: int = 262_144  # 256 KB
    # Phase F7 Advanced Data Security, Privacy & Sensitive Information Exposure Intelligence
    check_data_security: bool = True
    max_f7_requests: int = 20
    max_document_analysis: int = 10
    max_public_data_endpoints: int = 10
    max_privacy_documents: int = 3
    max_file_probes_f7: int = 5
    max_response_bytes_f7: int = 524_288  # 512 KB
    max_document_bytes_f7: int = 524_288  # 512 KB
    # Phase F8 Advanced Security Correlation, Attack-Surface Risk Graph & Executive Posture Intelligence
    check_risk_intelligence: bool = True
    enable_f8_risk_intelligence: bool = True
    max_f8_relationships: int = 100
    max_f8_risk_chains: int = 25
    max_f8_assets: int = 100
    max_f8_root_causes: int = 25
    max_f8_evidence_per_chain: int = 10
    max_f8_findings: int = 500
    max_graph_nodes: int = 250
    max_graph_edges: int = 500
    max_priority_actions: int = 15
    allowed_content_types: Set[str] = field(
        default_factory=lambda: {
            "text/html",
            "application/xhtml+xml",
        }
    )
