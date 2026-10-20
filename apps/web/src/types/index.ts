export type CheckStatus = "pass" | "info" | "warning" | "high" | "critical" | "unknown" | "not_applicable";
export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type RiskLevel = "Excellent" | "Good" | "Medium Risk" | "High Risk" | "Critical Risk";
export type UserRole = "free" | "basic" | "pro" | "agency" | "admin" | "owner" | "member";
export type SubscriptionPlan = "free" | "basic" | "pro" | "agency" | "admin";

export type OnboardingStatus = "completed" | "pending_plan_selection" | "checkout_pending" | "requires_recovery";

export interface AuthResponse {
  user: UserProfile;
  organization: Organization;
  plan: SubscriptionPlan;
  status?: string;
  onboarding_status?: OnboardingStatus;
}

export interface OnboardingStatusResponse {
  organization_id: string;
  user_id: string;
  onboarding_status: OnboardingStatus;
  plan: SubscriptionPlan;
  can_activate_free: boolean;
  has_active_paid: boolean;
  intended_plan?: string;
  session_id?: string;
}

export interface SessionStatusResponse {
  session_id: string;
  status: "complete" | "pending" | "canceled" | "failed";
  plan: SubscriptionPlan;
  is_active: boolean;
  provider?: "stripe" | "razorpay" | string;
}

export interface CheckoutSessionResponse {
  checkout_url?: string | null;
  session_id: string;
  provider: "stripe" | "razorpay" | string;
  subscription_id?: string | null;
  key_id?: string | null;
  amount?: number | null;
  currency?: string | null;
  plan?: string | null;
  interval?: string | null;
}

export interface VerifyPaymentPayload {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResult {
  status: string;
  plan: string;
  is_active: boolean;
  subscription_id: string;
}


export interface ScanCheck {
  id: string;
  check_type: string;
  name: string;
  status: CheckStatus;
  severity: Severity;
  score_impact: number;
  title: string;
  summary: string;
  why_it_matters?: string;
  how_to_fix?: string;
  estimated_fix_minutes: number;
  documentation_url?: string;
  evidence?: string;
  confidence: number;
  is_locked?: boolean;
}

export interface ScoreCategoryBreakdown {
  score: number;
  max_score: number;
  deductions: number;
  passed_checks: number;
  total_checks: number;
}

export interface Scan {
  id: string;
  website_id?: string;
  domain: string;
  normalized_domain: string;
  target_ip?: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  scan_type: "public" | "manual" | "monitoring" | "deep";
  score?: number;
  risk_level?: RiskLevel;
  score_breakdown?: Record<string, ScoreCategoryBreakdown>;
  passed_checks_count: number;
  total_checks_count: number;
  scan_duration_ms?: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  created_at: string;
  checks?: ScanCheck[];
  unlocked_findings?: ScanCheck[];
  locked_findings_count?: number;
  is_premium_locked?: boolean;
  scan_metadata?: DeepScanMetadata | Record<string, any>;
}

export interface CrawledPageSummary {
  url: string;
  final_url: string;
  depth: number;
  status_code?: number;
  content_type: string;
  elapsed_ms: number;
  is_https: boolean;
  title?: string;
  headers_count: number;
  cookies_count: number;
  forms_count: number;
  resources_count: number;
  error?: string;
}

export interface DeepScanMetadata {
  pages_discovered: number;
  pages_crawled: number;
  pages_skipped: number;
  crawl_depth: number;
  severity_counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  skipped_urls: Array<{ url: string; reason: string }>;
  pages: CrawledPageSummary[];
  robots_txt?: {
    is_present: boolean;
    status_code?: number;
    disallow_rules_count: number;
    sitemaps_declared: string[];
  };
  sitemap_xml?: {
    is_present: boolean;
    status_code?: number;
    discovered_urls_count: number;
    is_index: boolean;
  };
  resources?: {
    total_resources: number;
    scripts_count: number;
    stylesheets_count: number;
    images_count: number;
    iframes_count: number;
    external_domains_count: number;
    external_domains: string[];
  };
  source_maps_detected?: Array<{ script_url: string; map_url: string; status_code?: number }>;
  technologies?: Array<{ name: string; category: string; confidence: string; page_count: number; sample_pages: string[] }>;
  // Phase F2 Additions
  deep_scan_version?: number;
  tls?: AdvancedTlsAnalysis;
  dns?: AdvancedDnsAnalysis;
  email_security?: AdvancedEmailSecurityAnalysis;
  hsts?: AdvancedHstsAnalysis;
  csp?: AdvancedCspAnalysis;
  security_headers_quality?: AdvancedSecurityHeadersQuality;
  http_protocol?: AdvancedHttpProtocolAnalysis;
  // Phase F3 Additions
  frontend_security?: FrontendSecurityAnalysis;
  // Phase F4 Additions
  application_security?: ApplicationSecurityAnalysis;
  // Phase F5 Additions
  identity_security?: IdentitySecurityAnalysis;
  // Phase F6 Additions
  infrastructure_security?: InfrastructureSecurityAnalysis;
  // Phase F7 Additions
  data_security?: DataSecurityAnalysis;
  // Phase F8 Additions
  risk_intelligence?: RiskIntelligenceData;
}

export interface AdvancedTlsAnalysis {
  valid: boolean;
  issuer?: string | null;
  issuer_organization?: string | null;
  issuer_common_name?: string | null;
  subject?: string | null;
  subject_common_name?: string | null;
  not_before?: string | null;
  not_after?: string | null;
  days_remaining?: number | null;
  san_list: string[];
  is_wildcard: boolean;
  hostname_matched: boolean;
  tls_version?: string | null;
  cipher_name?: string | null;
  cipher_bits?: number | null;
  has_forward_secrecy: boolean;
  alpn_selected?: string | null;
  supports_http2: boolean;
  key_algorithm?: string | null;
  key_size?: number | null;
  signature_algorithm?: string | null;
  serial_number?: string | null;
  error?: string | null;
  resolved_ip?: string | null;
}

export interface AdvancedDnsAnalysis {
  domain: string;
  a_records: string[];
  aaaa_records: string[];
  has_ipv6: boolean;
  mx_records: Array<{ host: string; priority: number }>;
  has_mx: boolean;
  ns_records: string[];
  ns_count: number;
  has_redundant_ns: boolean;
  caa_records: Array<{ tag: string; value: string; flags: number; queried_target?: string }>;
  caa_present: boolean;
  allowed_cas: string[];
  dnssec_enabled: boolean;
  error?: string | null;
}

export interface AdvancedEmailSecurityAnalysis {
  domain: string;
  spf: {
    is_present: boolean;
    raw?: string | null;
    all_qualifier?: string | null;
    mechanisms: string[];
    lookup_count: number;
    lookup_count_exceeded: boolean;
    has_multiple_records: boolean;
  };
  dmarc: {
    is_present: boolean;
    raw?: string | null;
    policy?: string | null;
    subdomain_policy?: string | null;
    percentage: number;
    rua: string[];
    ruf: string[];
    adkim?: string;
    aspf?: string;
  };
  error?: string | null;
}

export interface AdvancedHstsAnalysis {
  is_present: boolean;
  raw_header?: string | null;
  max_age_seconds?: number | null;
  includes_subdomains: boolean;
  preload: boolean;
  status: "strong" | "acceptable" | "weak" | "missing";
}

export interface AdvancedCspAnalysis {
  is_present: boolean;
  raw_header?: string | null;
  directives: Record<string, string[]>;
  has_unsafe_inline: boolean;
  has_unsafe_eval: boolean;
  has_wildcards: boolean;
  has_nonces_or_hashes: boolean;
  status: "robust" | "moderate" | "missing";
}

export interface AdvancedSecurityHeadersQuality {
  referrer_policy?: string | null;
  referrer_policy_status: "safe" | "insecure" | "missing";
  permissions_policy?: string | null;
  permissions_policy_apis_restricted: string[];
  coop?: string | null;
  corp?: string | null;
  coep?: string | null;
  x_content_type_options?: string | null;
}

export interface AdvancedHttpProtocolAnalysis {
  alpn_selected?: string | null;
  supports_http2: boolean;
  tls_version?: string | null;
  cipher_name?: string | null;
}

export interface JavaScriptAsset {
  url: string;
  host: string;
  is_external: boolean;
  third_party_category: string;
  is_cdn: boolean;
  has_sri: boolean;
  sri_valid: boolean;
  integrity?: string | null;
  crossorigin?: string | null;
  bytes?: number;
}

export interface DiscoveredEndpoint {
  endpoint: string;
  category: "AUTH" | "ADMIN" | "USER" | "GRAPHQL" | "WEBSOCKET" | "PAYMENT" | "INTERNAL" | "GENERAL_API" | string;
  type: "REST" | "GRAPHQL" | "WEBSOCKET" | "ROUTE" | string;
  source: string;
}

export interface SecretExposureItem {
  secret_type: string;
  category: string;
  masked_value: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;
  sources: string[];
}

export interface ThirdPartyProvider {
  host: string;
  category: string;
  is_cdn: boolean;
  has_sri: boolean;
  script_count: number;
}

export interface FrontendSecurityAnalysis {
  javascript?: {
    total_scripts: number;
    first_party_scripts: number;
    third_party_scripts: number;
    scripts_analyzed: number;
    inline_scripts_analyzed: number;
    total_bytes_analyzed: number;
    sri_enforced_count: number;
    cdn_scripts_count: number;
    cdn_scripts_missing_sri: number;
    scripts: JavaScriptAsset[];
  };
  endpoints?: {
    total_discovered: number;
    categories: Record<string, number>;
    insecure_websocket_count: number;
    admin_routes_count: number;
    items: DiscoveredEndpoint[];
  };
  secrets?: {
    secrets_detected_count: number;
    high_confidence_count: number;
    items: SecretExposureItem[];
  };
  third_party?: {
    total_external_hosts: number;
    providers: ThirdPartyProvider[];
  };
  storage?: {
    has_auth_tokens: boolean;
    service_workers_count: number;
    service_workers: string[];
    storage_items_count: number;
    sample_items: Array<{ storage_type: string; key: string; is_auth_related: boolean; source: string }>;
  };
  dom_security?: {
    sinks_count: number;
    postmessage_missing_origin: boolean;
    sinks: Array<{ sink: string; count: number; severity: string; description: string; source: string }>;
  };
  source_maps?: {
    maps_checked: number;
    exposed_maps_count: number;
    has_embedded_source_code: boolean;
    embedded_files_count: number;
    internal_paths: string[];
    sample_sources: string[];
    details: Array<{
      script_url: string;
      map_url: string;
      status_code: number;
      sources_count: number;
      has_embedded_code: boolean;
      embedded_files_count: number;
      internal_paths: string[];
      sample_sources: string[];
      secrets_detected_count: number;
    }>;
  };
  configuration?: {
    internal_ips_count: number;
    internal_ips: string[];
    framework_envs_count: number;
    sensitive_envs: string[];
  };
}

export interface ApplicationSecurityEndpoint {
  url: string;
  method: string;
  status_code?: number | null;
  content_type?: string | null;
  category: "AUTH" | "ADMIN" | "USER" | "GRAPHQL" | "WEBSOCKET" | "PAYMENT" | "INTERNAL" | "GENERAL_API" | string;
  source: string;
}

export interface CorsEvaluationItem {
  url: string;
  cors_enabled: boolean;
  allow_origin?: string | null;
  allow_credentials?: boolean;
  allow_methods: string[];
  allow_headers: string[];
  max_age?: number | null;
  expose_headers: string[];
  is_wildcard: boolean;
  is_null_origin: boolean;
  wildcard_with_credentials: boolean;
  reflects_origin: boolean;
  issues: string[];
}

export interface HttpMethodAnalysisItem {
  url: string;
  allowed_methods: string[];
  dangerous_methods: string[];
  has_trace: boolean;
  has_track: boolean;
  has_delete: boolean;
  has_put: boolean;
  allow_header?: string | null;
}

export interface ErrorInspectionItem {
  url: string;
  status_code: number;
  stack_traces: Array<{ pattern: string; snippet: string }>;
  database_errors: Array<{ pattern: string; snippet: string }>;
  debug_pages: Array<{ pattern: string; snippet: string }>;
  internal_paths: Array<{ pattern: string; snippet: string }>;
}

export interface CacheEvaluationItem {
  url: string;
  cache_control?: string | null;
  is_cacheable: boolean;
  is_public: boolean;
  has_no_store: boolean;
  has_private: boolean;
  max_age?: number | null;
  issues: string[];
}

export interface ApiDocSpecItem {
  url: string;
  type: "openapi_v3" | "swagger_v2" | "raw_docs" | string;
  title?: string | null;
  version?: string | null;
  endpoints_declared: number;
  internal_server_urls: string[];
  exposed_parameters_count: number;
  has_auth_declarations: boolean;
  auth_types: string[];
}

export interface RedirectParameterItem {
  url: string;
  param_name: string;
  param_value: string;
}

export interface DirectoryListingItem {
  url: string;
  server?: string | null;
  files_detected_count: number;
  sample_files: string[];
}

export interface BackupFileItem {
  url: string;
  filename: string;
  status_code: number;
  size_bytes?: number;
}

export interface ApplicationSecurityAnalysis {
  status: string;
  requests_executed: number;
  endpoints: ApplicationSecurityEndpoint[];
  endpoints_count: number;
  cors: {
    configurations_count: number;
    evaluations: CorsEvaluationItem[];
  };
  http_methods: {
    analyses: HttpMethodAnalysisItem[];
    dangerous_methods_observed: boolean;
  };
  authentication?: {
    login_endpoints: string[];
    register_endpoints: string[];
    password_reset_endpoints: string[];
    csrf_tokens_observed: boolean;
    jwt_in_query_observed: boolean;
    auth_endpoints_count: number;
  };
  authorization_signals?: Array<{
    url: string;
    signal_type: string;
    details: string;
  }>;
  api_docs: {
    discovered_count: number;
    specs: ApiDocSpecItem[];
  };
  errors: {
    inspected_responses_count: number;
    stack_traces_count: number;
    database_errors_count: number;
    debug_pages_count: number;
    internal_paths_count: number;
  };
  cache: {
    observations_count: number;
    sensitive_cached_count: number;
  };
  server_disclosure?: {
    raw_server?: string | null;
    server_software?: string | null;
    server_version?: string | null;
    has_detailed_version: boolean;
    framework_headers: Record<string, string>;
  };
  redirects?: {
    parameters_detected_count: number;
    parameters: RedirectParameterItem[];
  };
  directory_exposure?: {
    listings_count: number;
    listings: DirectoryListingItem[];
    backup_files_count: number;
    backup_files: BackupFileItem[];
  };
  health_metrics?: {
    endpoints: string[];
    disclosed_info: Array<{
      url: string;
      disclosed_technologies: string[];
    }>;
  };
  graphql?: {
    endpoints: string[];
    introspection_status: string;
    query_errors_observed: boolean;
    types_count: number;
  };
  rate_limiting?: {
    has_standard_headers: boolean;
    has_legacy_headers: boolean;
    observed_headers: Record<string, string>;
  };
  security_txt?: {
    is_present: boolean;
    contacts: string[];
    encryption?: string | null;
    canonical?: string | null;
    policy?: string | null;
    hiring?: string | null;
    acknowledgments?: string | null;
    expires?: string | null;
  };
}

// ============================================================================
// Phase F5: Identity, Session, Authorization & Business Logic Interfaces
// ============================================================================

export interface AuthEndpointItem {
  url: string;
  category: "LOGIN" | "REGISTER" | "LOGOUT" | "SESSION" | "PASSWORD_RESET" | "PASSWORD_CHANGE" | "MFA" | "OAUTH" | "OIDC" | "SAML" | "TOKEN" | "ADMIN_AUTH" | "ACCOUNT" | string;
}

export interface PasswordFormAnalysisItem {
  page_url: string;
  action: string;
  resolved_action_url: string;
  method: string;
  action_protocol: string;
  is_external: boolean;
  has_password: boolean;
  is_insecure_cleartext: boolean;
  is_get_method: boolean;
  issues: string[];
}

export interface AccountRecoveryAnalysis {
  reset_endpoints: string[];
  reset_endpoints_count: number;
  reset_tokens_found: Array<{ url: string; parameter: string; masked_token: string }>;
  exposed_tokens_count: number;
  enumeration_signals: Array<{ url: string; signal: string }>;
  enumeration_signals_count: number;
  password_policy: {
    observed: boolean;
    rules: string[];
    sample_url?: string;
  };
}

export interface MfaSignals {
  detected: boolean;
  mfa_detected: boolean;
  methods: string[];
  methods_observed: string[];
  methods_count: number;
  sample_pages: string[];
}

export interface SessionCookieItem {
  name: string;
  secure: boolean;
  is_secure: boolean;
  http_only: boolean;
  is_http_only: boolean;
  same_site?: "Strict" | "Lax" | "None" | null;
  domain?: string | null;
  path?: string | null;
  is_persistent: boolean;
  sample_page?: string;
  issues?: string[];
}

export interface SessionSecurityAnalysis {
  auth_cookies_count: number;
  session_cookies: SessionCookieItem[];
  cookies: SessionCookieItem[];
  insecure_session_cookies_count: number;
  missing_httponly_count: number;
  missing_secure_count: number;
}

export interface CsrfFormEvaluationItem {
  page_url: string;
  action: string;
  method: string;
  has_csrf_token: boolean;
  token_field?: string | null;
  is_sensitive: boolean;
  is_protected: boolean;
  samesite_cookie_defense: boolean;
  confidence: "HIGH" | "MEDIUM" | "LOW" | string;
}

export interface CsrfProtectionAnalysis {
  forms_evaluated_count: number;
  evaluated_forms_count: number;
  protected_forms_count: number;
  unprotected_sensitive_forms_count: number;
  samesite_cookie_defense: boolean;
  forms: CsrfFormEvaluationItem[];
}

export interface OidcConfiguration {
  url: string;
  issuer?: string | null;
  authorization_endpoint?: string | null;
  token_endpoint?: string | null;
  jwks_uri?: string | null;
  userinfo_endpoint?: string | null;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  has_pkce_s256: boolean;
  has_implicit_flow: boolean;
  has_password_grant: boolean;
}

export interface OAuthRedirectUriItem {
  source_url: string;
  parameter: string;
  redirect_uri: string;
  is_insecure_http: boolean;
  is_wildcard: boolean;
}

export interface SamlMetadataAnalysis {
  url: string;
  entity_id?: string | null;
  sso_services_count: number;
  sso_services: Array<{ binding: string; location: string }>;
}

export interface OAuthOidcAnalysis {
  oidc_discovered: boolean;
  oidc_configuration?: OidcConfiguration | null;
  oauth_redirects: OAuthRedirectUriItem[];
  saml_discovered: boolean;
  saml_metadata?: SamlMetadataAnalysis | null;
}

export interface AuthorizationAnalysis {
  roles_identified: string[];
  roles_observed: string[];
  roles_count: number;
  admin_routes_count: number;
  admin_endpoints_count: number;
  admin_endpoints: string[];
  object_routes_count: number;
  object_routes: string[];
  tenant_signals_count: number;
  tenant_signals: string[];
}

export interface BusinessLogicAnalysis {
  categorized_workflows: Record<string, string[]>;
  magic_links_found: Array<{ url: string; parameter: string; masked_token: string }>;
  payment_endpoints_count: number;
  payment_endpoints: string[];
  role_change_endpoints_count: number;
  role_change_endpoints: string[];
  refund_endpoints_count: number;
  refund_endpoints: string[];
  invitation_endpoints_count: number;
  invitation_endpoints: string[];
  approval_endpoints_count: number;
  approval_endpoints: string[];
  credit_endpoints_count: number;
  credit_endpoints: string[];
  magic_links_detected_count: number;
  magic_links: Array<{ url: string; parameter: string; masked_token: string }>;
}

export interface IdentitySecurityAnalysis {
  status: "completed" | "failed" | string;
  error?: string | null;
  requests_executed: number;
  auth_endpoints: AuthEndpointItem[];
  auth_endpoints_count: number;
  password_forms: PasswordFormAnalysisItem[];
  password_forms_count: number;
  passwords_in_urls: Array<{ url: string; parameter: string; masked_value: string }>;
  passwords_in_urls_count: number;
  account_recovery: AccountRecoveryAnalysis;
  mfa_signals: MfaSignals;
  session_security: SessionSecurityAnalysis;
  session_tokens_in_urls: Array<{ url: string; type: string; masked_token: string; param?: string }>;
  session_tokens_in_urls_count: number;
  csrf: CsrfProtectionAnalysis;
  oauth_oidc: OAuthOidcAnalysis;
  authorization: AuthorizationAnalysis;
  business_logic: BusinessLogicAnalysis;
}

// ============================================================================
// Phase F6: Infrastructure, Cloud, Deployment & Operational Security Interfaces
// ============================================================================

export interface InfrastructureProviderItem {
  provider: string;
  category: string;
  confidence: "high" | "medium" | "low" | string;
  evidence: string[];
}

export interface CdnSecurityData {
  detected: boolean;
  provider?: string | null;
  confidence: "high" | "medium" | "low" | string;
  cache_behavior?: string | null;
  edge_headers: string[];
  evidence: string[];
}

export interface CloudInfrastructureData {
  providers: string[];
  services: string[];
  is_serverless: boolean;
  serverless_services: string[];
  metadata_references_count: number;
  metadata_references: Array<{ service: string; source: string; context: string }>;
  evidence: string[];
}

export interface OriginExposureData {
  signal_detected: boolean;
  origin_hostnames: string[];
  origin_ips: string[];
  confidence: "high" | "medium" | "low" | string;
  signals_count: number;
  signals: Array<{ type: string; header?: string; value?: string; hostname?: string; description?: string; page_url?: string }>;
  evidence: string[];
}

export interface DeploymentArtifactItem {
  url: string;
  type: string;
  description: string;
  sample?: string;
}

export interface DeploymentPlatformData {
  platform?: string | null;
  confidence: "high" | "medium" | "low" | string;
  evidence: string[];
  git_exposed: boolean;
  artifacts_count: number;
  artifacts: DeploymentArtifactItem[];
}

export interface EnvironmentExposureItem {
  type: "staging" | "development" | "preview" | "qa" | string;
  confidence: string;
  evidence: string[];
}

export interface EnvironmentExposureSummary {
  detected_count: number;
  environments: EnvironmentExposureItem[];
  internal_references_count: number;
  localhost_references_count: number;
}

export interface CloudStorageEndpointItem {
  url: string;
  provider: string;
  bucket: string;
  is_sensitive: boolean;
  page_url?: string;
}

export interface OperationalSurfaceItem {
  url: string;
  type: string;
  description: string;
  is_sensitive: boolean;
}

export interface OperationalExposureData {
  surfaces_count: number;
  surfaces: OperationalSurfaceItem[];
  management_routes_count: number;
  management_routes: string[];
  monitoring_tools: string[];
  metrics_exposed: boolean;
  debug_exposed: boolean;
  sensitive_actuators_count: number;
}

export interface DnsRelationshipData {
  ipv4_addresses: string[];
  ipv6_addresses: string[];
  ipv6_enabled: boolean;
  inconsistencies: string[];
  cname_targets: string[];
  subdomain_relationships: Array<{ cname_target: string; provider: string }>;
  takeover_signals_count: number;
  takeover_signals: Array<{ provider: string; cname_target: string; target_domain: string; reason: string }>;
}

export interface ContainerSecurityData {
  kubernetes_detected: boolean;
  kubernetes_signals_count: number;
  kubernetes_signals: Array<{ type: string; match: string; source: string }>;
  docker_signals_count: number;
  docker_signals: Array<{ type: string; match: string; source: string }>;
}

export interface InfrastructureSecurityAnalysis {
  status: "completed" | "failed" | string;
  error?: string | null;
  requests_executed: number;
  infrastructure: {
    primary_provider?: string | null;
    category?: string;
    confidence?: string;
    all_detected_providers?: InfrastructureProviderItem[];
    evidence?: string[];
  };
  cdn: CdnSecurityData;
  cloud: CloudInfrastructureData;
  origin: OriginExposureData;
  deployment: DeploymentPlatformData;
  environments: EnvironmentExposureItem[];
  environment_summary: EnvironmentExposureSummary;
  storage: CloudStorageEndpointItem[];
  containers: ContainerSecurityData;
  operational_exposure: OperationalExposureData;
  dns_relationships: DnsRelationshipData;
  subdomain_relationships: Array<{ cname_target: string; provider: string }>;
  takeover_signals: Array<{ provider: string; cname_target: string; target_domain: string; reason: string }>;
  summary: {
    total_findings: number;
    primary_provider?: string | null;
    cdn_detected: boolean;
    cdn_provider?: string | null;
    deployment_platform?: string | null;
    git_exposed: boolean;
    environments_detected_count: number;
    storage_endpoints_count: number;
    operational_surfaces_count: number;
  };
}

// ============================================================================
// Phase F7: Data Security, Privacy & Sensitive Information Exposure Interfaces
// ============================================================================

export interface PiiPersonalEmailItem {
  masked_email: string;
  page_url: string;
  context?: string;
}

export interface PiiGenericEmailItem {
  masked_email: string;
  page_url: string;
}

export interface PiiPhoneNumberItem {
  masked_phone: string;
  country_hint?: string;
  page_url: string;
}

export interface PiiGovernmentIdItem {
  type: string;
  masked_id: string;
  country: string;
  page_url: string;
}

export interface PiiTelemetryData {
  personal_emails_count: number;
  generic_emails_count: number;
  phone_numbers_count: number;
  government_ids_count: number;
  personal_emails: PiiPersonalEmailItem[];
  generic_emails: PiiGenericEmailItem[];
  phone_numbers: PiiPhoneNumberItem[];
  government_ids: PiiGovernmentIdItem[];
  error?: string;
}

export interface FinancialCardItem {
  card_brand: string;
  masked_number: string;
  page_url: string;
}

export interface FinancialIbanItem {
  masked_iban: string;
  country_code: string;
  page_url: string;
}

export interface FinancialCvvSignalItem {
  label: string;
  page_url: string;
}

export interface FinancialTelemetryData {
  cards_detected_count: number;
  ibans_detected_count: number;
  cvv_exposed: boolean;
  cards: FinancialCardItem[];
  ibans: FinancialIbanItem[];
  cvv_signals: FinancialCvvSignalItem[];
  error?: string;
}

export interface SensitiveHealthItem {
  condition_term: string;
  context_type: string;
  page_url: string;
}

export interface SensitiveLocationItem {
  latitude: number;
  longitude: number;
  page_url: string;
}

export interface SensitiveAuthItem {
  type: string;
  masked_value: string;
  page_url: string;
}

export interface SensitiveTelemetryData {
  health_data_count: number;
  location_data_count: number;
  authentication_data_count: number;
  health_records: SensitiveHealthItem[];
  locations: SensitiveLocationItem[];
  auth_records: SensitiveAuthItem[];
  error?: string;
}

export interface ApiSensitiveFieldItem {
  url: string;
  field_name: string;
  category: string;
  masked_sample: string;
}

export interface ApiMinimizationSignalItem {
  url: string;
  message: string;
}

export interface ApiCacheExposureItem {
  url: string;
  cache_control: string;
}

export interface ApiMinimizationData {
  endpoints_analyzed_count: number;
  sensitive_fields_observed_count: number;
  sensitive_fields: ApiSensitiveFieldItem[];
  minimization_signals_count: number;
  minimization_signals: ApiMinimizationSignalItem[];
  cache_exposure_count: number;
  cache_exposures: ApiCacheExposureItem[];
  error?: string;
}

export interface UrlSensitiveParamItem {
  url: string;
  param_name: string;
  masked_value: string;
  category: string;
}

export interface UrlReferrerRiskItem {
  url: string;
  sensitive_param: string;
  referrer_policy?: string;
}

export interface UrlDataTelemetry {
  pii_in_urls_count: number;
  secrets_in_urls_count: number;
  referrer_leakage_risks_count: number;
  pii_parameters: UrlSensitiveParamItem[];
  secret_parameters: UrlSensitiveParamItem[];
  referrer_risks: UrlReferrerRiskItem[];
  error?: string;
}

export interface FormEvaluationItem {
  action: string;
  method: string;
  is_sensitive: boolean;
  fields_count: number;
  sensitive_fields: string[];
  excessive_warning?: string;
  page_url: string;
}

export interface FormDataTelemetry {
  forms_analyzed_count: number;
  forms_with_sensitive_fields_count: number;
  excessive_collection_forms_count: number;
  form_evaluations: FormEvaluationItem[];
  error?: string;
}

export interface DocumentMetadataItem {
  url: string;
  type: string;
  author?: string;
  producer?: string;
  internal_paths: string[];
}

export interface DocumentExposedFileItem {
  url: string;
  type: string;
  size_bytes?: number;
  content_sample?: string;
}

export interface DocumentTelemetryData {
  analyzed_documents_count: number;
  documents_with_internal_metadata_count: number;
  exposed_data_files_count: number;
  documents: DocumentMetadataItem[];
  exposed_files: DocumentExposedFileItem[];
  error?: string;
}

export interface PrivacyTelemetryData {
  policy_present: boolean;
  policy_url?: string;
  gdpr_rights_mentioned: boolean;
  ccpa_mentioned: boolean;
  retention_period_disclosed: boolean;
  data_deletion_disclosed: boolean;
  access_request_disclosed: boolean;
  dpo_or_contact_email_present: boolean;
  dpo_contact?: string;
  disclosures_found: string[];
  error?: string;
}

export interface TrackerItem {
  name: string;
  category: string;
  domain: string;
  purpose: string;
}

export interface TrackingTelemetryData {
  consent_banner_detected: boolean;
  cmp_provider?: string;
  trackers_detected_count: number;
  tracker_categories: Record<string, number>;
  trackers: TrackerItem[];
  session_recording_detected: boolean;
  session_recording_tools: string[];
  advertising_trackers_detected: boolean;
  advertising_tools: string[];
  cookies_classified_count: number;
  cookies_by_purpose: Record<string, number>;
  tracker_before_consent_observed: boolean;
  error?: string;
}

export interface PrivacyPostureMatrix {
  pii_exposure: string;
  financial_exposure: string;
  health_exposure: string;
  auth_exposure: string;
  privacy_policy: string;
  consent_mechanism: string;
  tracking_activity: string;
  public_documents: string;
}

export interface DataSecuritySummary {
  has_pii: boolean;
  has_financial_leak: boolean;
  has_health_leak: boolean;
  has_auth_leak: boolean;
  privacy_policy_present: boolean;
  consent_banner_present: boolean;
  active_trackers_count: number;
  total_data_findings: number;
}

export interface DataSecurityAnalysis {
  status: "completed" | "failed" | string;
  error?: string | null;
  requests_executed: number;
  pii: PiiTelemetryData;
  financial: FinancialTelemetryData;
  sensitive_data: SensitiveTelemetryData;
  api_minimization: ApiMinimizationData;
  url_exposure: UrlDataTelemetry;
  forms: FormDataTelemetry;
  documents: DocumentTelemetryData;
  privacy: PrivacyTelemetryData;
  tracking_and_consent: TrackingTelemetryData;
  posture_matrix: PrivacyPostureMatrix;
  summary: DataSecuritySummary;
}

// ============================================================================
// Phase F8: Advanced Security Correlation, Attack-Surface Risk Graph & Executive Posture
// ============================================================================

export interface SecurityGraphNode {
  id: string;
  type: string;
  label: string;
  phase?: string | null;
  finding_ids: string[];
  metadata: Record<string, any>;
}

export interface SecurityGraphEdge {
  source: string;
  target: string;
  relationship: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | string;
  label: string;
}

export interface SecurityGraphData {
  nodes: SecurityGraphNode[];
  edges: SecurityGraphEdge[];
  node_count: number;
  edge_count: number;
  graph_truncated: boolean;
  max_nodes_configured?: number;
  max_edges_configured?: number;
}

export interface AttackSurfaceMetrics {
  public_endpoints: number;
  api_endpoints: number;
  admin_surfaces: number;
  auth_surfaces: number;
  sensitive_data_surfaces: number;
  documents: number;
  third_party_integrations: number;
  cloud_components: number;
  exposed_infrastructure: number;
}

export interface ExposureConcentration {
  concentration_detected: boolean;
  concentrated_domain?: string | null;
  concentration_percentage: number;
  message: string;
  domain_distribution: Record<string, number>;
}

export interface HighAttentionAsset {
  asset: string;
  display_label: string;
  findings_count: number;
  highest_severity: "critical" | "high" | "medium" | "low" | "info" | string;
  categories: string[];
  source_phases: string[];
  risk_score_weight: number;
  sample_finding: string;
}

export interface AttackSurfaceSummary {
  metrics: AttackSurfaceMetrics;
  exposure_concentration: ExposureConcentration;
  high_attention_assets_count: number;
  high_attention_assets: HighAttentionAsset[];
}

export interface RiskChainItem {
  chain_id: string;
  check_type: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "info" | string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | string;
  source_phases: string[];
  affected_assets: string[];
  evidence_findings: string[];
  evidence_count: number;
  recommendation: string;
  metadata?: Record<string, any>;
}

export interface RootCauseItem {
  id: string;
  title: string;
  description: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | string;
  severity: "critical" | "high" | "medium" | "low" | "info" | string;
  findings_count: number;
  affected_findings: string[];
  affected_assets: string[];
  recommended_action: string;
  metadata?: Record<string, any>;
}

export interface PriorityActionItem {
  action_id: string;
  title: string;
  reason: string;
  priority: "IMMEDIATE" | "HIGH_PRIORITY" | "NORMAL" | "IMPROVEMENT" | string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | string;
  affected_findings: string[];
  affected_assets: string[];
  article_slug?: string | null;
  estimated_minutes: number;
  priority_score: number;
}

export interface RemediationRoadmap {
  immediate: PriorityActionItem[];
  short_term: PriorityActionItem[];
  medium_term: PriorityActionItem[];
  long_term: PriorityActionItem[];
}

export interface PostureDimensionItem {
  rating: string;
  status: string;
  summary: string;
}

export interface PositiveSignalItem {
  dimension: string;
  title: string;
  detail: string;
}

export interface ExecutivePostureData {
  overall_score: number;
  risk_level: string;
  score_explanation: string;
  posture_dimensions: Record<string, PostureDimensionItem>;
  positive_signals: PositiveSignalItem[];
  positive_signals_count: number;
  limitations: string[];
}

export interface RiskIntelligenceData {
  status: "completed" | "failed" | "partial" | string;
  deep_scan_version: number;
  executive_posture: ExecutivePostureData;
  attack_surface: AttackSurfaceSummary;
  risk_chains: RiskChainItem[];
  risk_chains_count: number;
  root_causes: RootCauseItem[];
  root_causes_count: number;
  priority_actions: PriorityActionItem[];
  priority_actions_count: number;
  remediation_roadmap: RemediationRoadmap;
  remediation_groups: Record<string, Array<{ finding_id?: string; title?: string; severity?: string; canonical_category?: string }>>;
  graph: SecurityGraphData;
  positive_signals: PositiveSignalItem[];
  score_context: {
    score: number;
    risk_level: string;
    explanation: string;
  };
  errors?: string[] | null;
}

export interface MonitoringConfig {
  id: string;
  website_id: string;
  organization_id: string;
  is_active: boolean;
  frequency: "weekly" | "daily";
  last_run_at?: string;
  next_run_at?: string;
  status: "active" | "failing" | "paused";
  last_scan_id?: string;
  last_success_at?: string;
  last_failure_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface Website {
  id: string;
  organization_id: string;
  name: string;
  domain: string;
  normalized_domain: string;
  status: string;
  last_scan_id?: string;
  last_scan_score?: number;
  last_scan_risk?: RiskLevel;
  monitoring_enabled: boolean;
  monitoring_frequency?: "weekly" | "daily";
  monitoring?: MonitoringConfig;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  firebase_uid: string;
  email: string;
  name?: string;
  role: UserRole;
  organization_id?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  type: "personal" | "agency";
  owner_id?: string;
  logo_url?: string;
  brand_name?: string;
  primary_color?: string;
  footer_text?: string;
  created_at: string;
}

export interface AlertItem {
  id: string;
  organization_id: string;
  website_id?: string;
  scan_id?: string;
  fingerprint?: string;
  type: string;
  severity: Severity;
  title: string;
  message: string;
  status: "unread" | "read" | "dismissed";
  sent_at?: string;
  created_at: string;
}

export interface SubscriptionInfo {
  plan: UserRole;
  status: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  max_websites: number;
  max_scans_per_month: number;
  used_scans: number;
  used_websites: number;
  provider?: "stripe" | "razorpay" | string;
  currency?: "usd" | "inr" | string;
  amount_cents?: number | null;
  billing_interval?: "month" | "year" | string;
  razorpay_subscription_id?: string | null;
  stripe_subscription_id?: string | null;
}

export interface MediaAsset {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  width?: number | null;
  height?: number | null;
  storage_key: string;
  public_url: string;
  alt_text?: string | null;
  caption?: string | null;
  checksum_sha256?: string | null;
  uploaded_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BlogPostFAQ {
  id: string;
  blog_post_id: string;
  question: string;
  answer: string;
  display_order: number;
  created_at: string;
  updated_at?: string | null;
}

export interface BlogRedirect {
  id: string;
  blog_post_id: string;
  old_slug: string;
  target_slug: string;
  status_code: number;
  created_at: string;
}

export interface BlogAuthor {
  id: string;
  name: string;
  slug: string;
  bio?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  post_count?: number;
  created_at?: string;
}

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  published_at?: string | null;
  category?: BlogCategory | null;
  featured_image?: string | null;
  featured_media?: MediaAsset | null;
  author?: BlogAuthor | null;
  tags?: BlogTag[];
  is_featured?: boolean;
}

export interface BlogPostListResponse {
  items: BlogPost[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  featured_image?: string | null;
  featured_media_id?: string | null;
  featured_media?: MediaAsset | null;
  seo_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
  og_image?: string | null;
  status: string;
  is_published?: boolean;
  is_featured?: boolean;
  published_at?: string | null;
  category_id?: string | null;
  category?: BlogCategory | null;
  author_id?: string | null;
  author?: BlogAuthor | null;
  tags?: BlogTag[];
  created_at: string;
  updated_at: string;
  faqs?: BlogPostFAQ[] | null;
  related_posts?: BlogPostSummary[] | null;
}

export interface Resource {
  id: string;
  title: string;
  slug: string;
  description: string;
  resource_type: string;
  category?: string | null;
  featured_image?: string | null;
  featured_media_id?: string | null;
  featured_media?: MediaAsset | null;
  file_url?: string | null;
  external_url?: string | null;
  content?: string | null;
  status: string;
  published_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ResourceListResponse {
  items: Resource[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface ResourceSitemapItem {
  slug: string;
  title: string;
  published_at?: string | null;
  updated_at?: string | null;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  status: string;
  source: string;
  subscribed_at: string;
  unsubscribed_at?: string | null;
  created_at: string;
}

export interface ContentAnalyticsEventCreate {
  event_name: string;
  content_type?: string | null;
  content_id?: string | null;
  path?: string | null;
  referrer?: string | null;
  source?: string | null;
  campaign?: string | null;
}

export interface TopContentMetric {
  content_id: string;
  content_type: string;
  views: number;
}

export interface ContentAnalyticsSummary {
  time_window_days: number;
  total_article_views: number;
  total_resource_views: number;
  total_cta_clicks: number;
  total_newsletter_signups: number;
  top_articles: TopContentMetric[];
  top_resources: TopContentMetric[];
}

export type BadgeVerificationStatus =
  | "verified"
  | "expired"
  | "revoked"
  | "eligible"
  | "ineligible"
  | "not_configured"
  | "not_found";

export interface BadgeEmbedSnippets {
  html: string;
  markdown: string;
}

export interface WebsiteBadgeStatus {
  website_id: string;
  domain: string;
  status: BadgeVerificationStatus;
  public_token?: string | null;
  verified_at?: string | null;
  expires_at?: string | null;
  verification_url?: string | null;
  badge_url?: string | null;
  embed_snippets?: BadgeEmbedSnippets | null;
  last_scan_id?: string | null;
  score?: number | null;
  risk_level?: RiskLevel | null;
}

export interface PublicVerificationResponse {
  domain: string;
  status: "verified" | "expired" | "revoked" | "not_found";
  verified_at?: string | null;
  expires_at?: string | null;
  verification_tier: string;
  badge_url: string;
  verification_url: string;
  disclaimer: string;
}

export interface EligibilityChecks {
  website_exists: boolean;
  authorized_website: boolean;
  scan_exists: boolean;
  scan_completed: boolean;
  scan_recent: boolean;
  score_available: boolean;
  minimum_score: boolean;
  critical_findings: boolean;
  high_findings: boolean;
  website_scan_match: boolean;
  domain_match: boolean;
  monitoring_match: boolean;
}

export interface PolicySummary {
  minimum_score: number;
  maximum_scan_age_days: number;
  verification_validity_days: number;
  disallow_critical_findings: boolean;
  disallow_high_findings: boolean;
  require_successful_scan: boolean;
  require_authorized_website: boolean;
  require_monitoring: boolean;
}

export interface BadgePolicy {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  minimum_score: number;
  maximum_scan_age_days: number;
  verification_validity_days: number;
  disallow_critical_findings: boolean;
  disallow_high_findings: boolean;
  require_successful_scan: boolean;
  require_authorized_website: boolean;
  require_monitoring: boolean;
  created_at: string;
  updated_at: string;
}

export interface BadgePolicyUpdateInput {
  name?: string;
  description?: string;
  minimum_score?: number;
  maximum_scan_age_days?: number;
  verification_validity_days?: number;
  disallow_critical_findings?: boolean;
  disallow_high_findings?: boolean;
  require_successful_scan?: boolean;
  require_authorized_website?: boolean;
  require_monitoring?: boolean;
  is_active?: boolean;
}

export interface BadgeEligibilityResult {
  eligible: boolean;
  website_id?: string | null;
  scan_id?: string | null;
  score?: number | null;
  risk_level?: string | null;
  reasons: string[];
  checks: EligibilityChecks;
  policy: PolicySummary;
  evaluated_at: string;
}

export interface SecurityVerificationResponse {
  id: string;
  website_id: string;
  scan_id: string;
  policy_id?: string | null;
  status: string;
  public_token: string;
  score: number;
  risk_level?: string | null;
  verified_at?: string | null;
  expires_at?: string | null;
  eligibility_reason?: Record<string, any> | null;
  monitoring_enabled: boolean;
  badge_settings?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  verification_url?: string | null;
  badge_url?: string | null;
  embed_snippets?: BadgeEmbedSnippets | null;
}

export interface BadgeRevocationResponse {
  message: string;
  website_id: string;
  status: string;
  revoked_at: string;
}

export interface DnsRecordItem {
  value: string;
  ttl?: number | null;
  preference?: number | null;
  exchange?: string | null;
  flags?: number | null;
  tag?: string | null;
  mname?: string | null;
  rname?: string | null;
  serial?: number | null;
  refresh?: number | null;
  retry?: number | null;
  expire?: number | null;
  minimum?: number | null;
}

export interface DnsTypeResult {
  record_type: string;
  status: "success" | "no_records" | "timeout" | "error";
  records: DnsRecordItem[];
  message?: string | null;
}

export interface DnsLookupSummary {
  requested_types: number;
  successful_types: number;
  total_records: number;
}

export interface DnsLookupRequest {
  domain: string;
  record_types?: string[];
}

export interface DnsLookupResponse {
  domain: string;
  queried_at: string;
  duration_ms: number;
  results: DnsTypeResult[];
  summary: DnsLookupSummary;
}

export interface HttpRedirectHop {
  step: number;
  url: string;
  status_code: number;
  status_text: string;
  location?: string | null;
  next_url?: string | null;
  response_time_ms: number;
  is_https: boolean;
  ip_address?: string | null;
  headers: Record<string, string>;
}

export interface HttpStatusCheckSummary {
  total_redirects: number;
  is_https_initial: boolean;
  is_https_final: boolean;
  has_ssl_downgrade: boolean;
  duration_ms: number;
}

export interface HttpStatusCheckRequest {
  url: string;
}

export interface HttpStatusCheckResponse {
  requested_url: string;
  normalized_url: string;
  checked_at: string;
  duration_ms: number;
  final_url: string;
  final_status_code?: number | null;
  final_status_text?: string | null;
  redirect_count: number;
  chain: HttpRedirectHop[];
  result_status:
    | "success"
    | "client_error"
    | "server_error"
    | "redirect_loop"
    | "redirect_limit"
    | "blocked_redirect"
    | "connection_error"
    | "timeout";
  message?: string | null;
  summary: HttpStatusCheckSummary;
}

export interface SecurityTxtField {
  name: string;
  value: string;
  line_number: number;
  is_valid: boolean;
  description?: string | null;
}

export interface SecurityTxtFinding {
  code: string;
  severity: "error" | "warning" | "info" | "success";
  title: string;
  message: string;
  line_number?: number | null;
  field_name?: string | null;
  recommendation?: string | null;
  reference?: string | null;
}

export interface SecurityTxtSummary {
  total_fields: number;
  errors_count: number;
  warnings_count: number;
  info_count: number;
  has_contact: boolean;
  has_expires: boolean;
  has_encryption: boolean;
  has_policy: boolean;
  has_canonical: boolean;
  has_hiring: boolean;
  is_https: boolean;
  used_fallback: boolean;
}

export interface SecurityTxtValidateRequest {
  domain: string;
}

export interface SecurityTxtValidateResponse {
  domain: string;
  target_url: string;
  checked_at: string;
  duration_ms: number;
  retrieval_status:
    | "retrieved"
    | "not_found"
    | "forbidden"
    | "rate_limited"
    | "server_error"
    | "tls_error"
    | "connection_error"
    | "timeout"
    | "blocked_target"
    | "oversized"
    | "html_response";
  source_location?: string | null;
  http_status_code?: number | null;
  content_type?: string | null;
  content_length?: number | null;
  validation_status: "valid" | "valid_with_warnings" | "invalid" | "not_found" | "retrieval_error";
  summary: SecurityTxtSummary;
  fields: SecurityTxtField[];
  findings: SecurityTxtFinding[];
  expires_at?: string | null;
  is_expired?: boolean | null;
  days_until_expiration?: number | null;
  raw_content?: string | null;
}

export interface RobotsDirective {
  directive: string;
  value: string;
  line_number: number;
}

export interface RobotsUserAgentGroup {
  user_agents: string[];
  allows: string[];
  disallows: string[];
  other_directives: Record<string, string>;
}

export interface RobotsTxtResult {
  requested_url: string;
  effective_url?: string | null;
  retrieval_status:
    | "success"
    | "not_found"
    | "forbidden"
    | "rate_limited"
    | "server_error"
    | "tls_error"
    | "connection_error"
    | "timeout"
    | "blocked_target"
    | "oversized"
    | "html_response";
  http_status_code?: number | null;
  content_type?: string | null;
  content_length?: number | null;
  is_valid: boolean;
  groups: RobotsUserAgentGroup[];
  sitemap_declarations: string[];
  raw_content?: string | null;
  warnings: string[];
}

export interface SitemapItem {
  loc: string;
  lastmod?: string | null;
  changefreq?: string | null;
  priority?: number | null;
}

export interface RobotsSitemapFinding {
  code: string;
  severity: "error" | "warning" | "info" | "success";
  title: string;
  message: string;
  affected_item?: string | null;
  recommendation?: string | null;
  reference?: string | null;
}

export interface SitemapDocumentResult {
  url: string;
  source: "robots_txt" | "conventional" | "index_child" | string;
  document_type: "urlset" | "sitemapindex" | "unknown" | string;
  retrieval_status:
    | "retrieved"
    | "not_found"
    | "forbidden"
    | "rate_limited"
    | "server_error"
    | "tls_error"
    | "connection_error"
    | "timeout"
    | "blocked_target"
    | "oversized"
    | "html_response"
    | "not_fetched_external"
    | "parse_error"
    | string;
  http_status_code?: number | null;
  content_type?: string | null;
  validity_status: "valid" | "valid_with_warnings" | "invalid" | "retrieval_error" | "not_fetched_external" | string;
  url_count: number;
  child_sitemap_count: number;
  child_sitemaps: string[];
  sample_urls: SitemapItem[];
  findings: RobotsSitemapFinding[];
  analysis_complete: boolean;
}

export interface SitemapDiscoverySummary {
  declared_urls: string[];
  conventional_checked: boolean;
  conventional_found: boolean;
  external_urls_skipped: string[];
}

export interface RobotsSitemapSummary {
  has_robots_txt: boolean;
  robots_status: string;
  total_user_agent_groups: number;
  total_disallow_rules: number;
  total_allow_rules: number;
  sitemaps_declared_count: number;
  sitemaps_discovered_count: number;
  sitemaps_validated_count: number;
  total_urls_discovered: number;
  errors_count: number;
  warnings_count: number;
  info_count: number;
  analysis_complete: boolean;
}

export interface RobotsSitemapCheckRequest {
  domain: string;
}

export interface RobotsSitemapCheckResponse {
  domain: string;
  target_url: string;
  checked_at: string;
  duration_ms: number;
  robots: RobotsTxtResult;
  sitemap_discovery: SitemapDiscoverySummary;
  sitemaps: SitemapDocumentResult[];
  summary: RobotsSitemapSummary;
  findings: RobotsSitemapFinding[];
  analysis_complete: boolean;
}

// ============================================================================
// CSP Policy Analyzer Types (Phase 3)
// ============================================================================

export interface CspDirectiveItem {
  name: string;
  values: string[];
  raw_text: string;
  is_duplicate: boolean;
  is_unknown: boolean;
  is_deprecated: boolean;
  is_fallback: boolean;
  fallback_source?: string | null;
  warnings: string[];
}

export interface CspFinding {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: "definite" | "conditional" | "informational";
  directive?: string | null;
  evidence?: string | null;
  explanation: string;
  security_impact: string;
  recommendation: string;
  safe_example?: string | null;
  reference?: string | null;
  is_conditional: boolean;
}

export interface CspPolicyDetail {
  policy_type: "enforce" | "report_only";
  raw_policy: string;
  directives: CspDirectiveItem[];
  effective_directives: Record<string, CspDirectiveItem>;
  findings: CspFinding[];
  has_unsafe_inline: boolean;
  has_unsafe_eval: boolean;
  has_strict_dynamic: boolean;
  has_nonces_or_hashes: boolean;
  has_wildcard: boolean;
  directive_count: number;
  duplicate_count: number;
  findings_count: number;
}

export interface CspPolicyMetrics {
  total_policies: number;
  enforcing_policies_count: number;
  report_only_policies_count: number;
  total_directives: number;
  total_findings: number;
  critical_findings_count: number;
  high_findings_count: number;
  medium_findings_count: number;
  low_findings_count: number;
  info_findings_count: number;
  quality_score: number;
  quality_rating: string;
}

export interface CspPolicyAnalyzeRequest {
  mode: "paste" | "remote";
  policy?: string | null;
  policy_type?: "enforce" | "report_only" | null;
  url?: string | null;
}

export interface CspPolicyAnalyzeResponse {
  mode: "paste" | "remote";
  status: "success" | "no_policy_found" | "invalid_policy" | "blocked_target" | "fetch_error" | "partial";
  url?: string | null;
  http_status_code?: number | null;
  retrieval_duration_ms?: number | null;
  checked_at: string;
  duration_ms: number;
  policies: CspPolicyDetail[];
  findings: CspFinding[];
  metrics: CspPolicyMetrics;
  summary_markdown?: string | null;
  error_message?: string | null;
  warnings: string[];
}


