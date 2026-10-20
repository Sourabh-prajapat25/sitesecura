"""
Scanly Scanner Engine - Deep Website Security Scan Package
Provides passive discovery, same-origin crawling, multi-page security header audits,
cookie security, mixed content, form discovery, source maps, technology profiling,
and advanced TLS, DNS, email security, HSTS, and CSP architecture analysis.
"""
from .config import DeepScanConfig
from .models import DeepScanResult, CrawledPage, FormMetadata, ResourceItem, SourceMapItem
from .runner import run_deep_security_scan
from .tls import analyze_deep_tls
from .dns import analyze_deep_dns
from .email_security import analyze_deep_email_security
from .hsts import analyze_deep_hsts
from .csp import analyze_deep_csp
from .security_headers import analyze_deep_security_headers_quality
from .frontend_security import analyze_frontend_security
from .secrets import scan_text_for_secrets, mask_secret
from .source_map_deep import analyze_deep_source_maps
from .application_security import analyze_application_security
from .cors_analyzer import evaluate_cors_configuration, test_cors_reflection_safe
from .error_analyzer import inspect_response_for_errors
from .cache_analyzer import evaluate_cache_security
from .http_security import analyze_http_methods
from .api_security import classify_api_endpoint, parse_openapi_spec_safely
from .identity_security import analyze_identity_security
from .auth_analyzer import (
    classify_auth_endpoint,
    analyze_password_forms,
    detect_password_in_urls,
    analyze_account_recovery,
    detect_mfa_signals,
)
from .session_analyzer import (
    analyze_session_security,
    detect_session_tokens_in_urls,
)
from .csrf_analyzer import analyze_csrf_protection
from .oauth_analyzer import (
    parse_oidc_configuration,
    analyze_oauth_redirect_uris,
    analyze_saml_metadata,
)
from .authorization_analyzer import analyze_authorization_architecture
from .business_logic_analyzer import analyze_business_logic_surface
from .infrastructure_security import analyze_infrastructure_security
from .infrastructure_analyzer import analyze_infrastructure
from .cloud_analyzer import analyze_cloud_infrastructure
from .origin_analyzer import analyze_origin_exposure
from .deployment_analyzer import analyze_deployment
from .environment_analyzer import analyze_environments
from .operational_analyzer import analyze_operational_surfaces
from .dns_infrastructure_analyzer import analyze_dns_infrastructure
from .storage_analyzer import analyze_cloud_storage
from .container_analyzer import analyze_containers_and_kubernetes
from .data_security import analyze_data_security
from .data_classification import (
    DataCategory,
    Confidence,
    mask_email,
    mask_phone,
    mask_card_number,
    mask_government_id,
    luhn_validate,
    classify_field_name,
)
from .data_security_finding_helper import make_data_finding
from .pii_analyzer import analyze_pii
from .financial_analyzer import analyze_financial_data
from .sensitive_data_analyzer import analyze_sensitive_data
from .api_data_analyzer import analyze_api_data_minimization
from .url_data_analyzer import analyze_url_data
from .form_data_analyzer import analyze_form_data
from .document_analyzer import analyze_documents
from .privacy_analyzer import analyze_privacy_policy
from .tracking_consent_analyzer import analyze_tracking_and_consent

__all__ = [
    "DeepScanConfig",
    "DeepScanResult",
    "CrawledPage",
    "FormMetadata",
    "ResourceItem",
    "SourceMapItem",
    "run_deep_security_scan",
    "analyze_deep_tls",
    "analyze_deep_dns",
    "analyze_deep_email_security",
    "analyze_deep_hsts",
    "analyze_deep_csp",
    "analyze_deep_security_headers_quality",
    "analyze_frontend_security",
    "scan_text_for_secrets",
    "mask_secret",
    "analyze_deep_source_maps",
    "analyze_application_security",
    "evaluate_cors_configuration",
    "test_cors_reflection_safe",
    "inspect_response_for_errors",
    "evaluate_cache_security",
    "analyze_http_methods",
    "classify_api_endpoint",
    "parse_openapi_spec_safely",
    "analyze_identity_security",
    "classify_auth_endpoint",
    "analyze_password_forms",
    "detect_password_in_urls",
    "analyze_account_recovery",
    "detect_mfa_signals",
    "analyze_session_security",
    "detect_session_tokens_in_urls",
    "analyze_csrf_protection",
    "parse_oidc_configuration",
    "analyze_oauth_redirect_uris",
    "analyze_saml_metadata",
    "analyze_authorization_architecture",
    "analyze_business_logic_surface",
    "analyze_infrastructure_security",
    "analyze_infrastructure",
    "analyze_cloud_infrastructure",
    "analyze_origin_exposure",
    "analyze_deployment",
    "analyze_environments",
    "analyze_operational_surfaces",
    "analyze_dns_infrastructure",
    "analyze_cloud_storage",
    "analyze_containers_and_kubernetes",
    # Phase F7
    "analyze_data_security",
    "DataCategory",
    "Confidence",
    "mask_email",
    "mask_phone",
    "mask_card_number",
    "mask_government_id",
    "luhn_validate",
    "classify_field_name",
    "make_data_finding",
    "analyze_pii",
    "analyze_financial_data",
    "analyze_sensitive_data",
    "analyze_api_data_minimization",
    "analyze_url_data",
    "analyze_form_data",
    "analyze_documents",
    "analyze_privacy_policy",
    "analyze_tracking_and_consent",
]

