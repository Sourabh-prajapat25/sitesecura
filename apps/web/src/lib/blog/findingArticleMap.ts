/**
 * SiteSecura Knowledge Base — Finding to Blog Article Mapping Architecture
 *
 * Centralized registry connecting scan findings and check types to SiteSecura
 * educational security guides (/blog/[slug]), providing progressive remediation
 * reading while safely preserving external documentation URLs as fallback references.
 */

import { ScanCheck } from "@/types";

export interface FindingKnowledgeEntry {
  findingCode: string;
  title: string;
  /** The canonical future slug for the specific dedicated article */
  targetSlug: string;
  /** Currently active published article in SiteSecura Blog (if available) */
  activeSlug?: string;
  description?: string;
}

export interface FindingArticleResolution {
  hasArticle: boolean;
  href: string;
  label: string;
  isExternal: boolean;
  targetSlug?: string;
  entry?: FindingKnowledgeEntry;
}

/**
 * Registry of canonical finding codes and their educational article mapping.
 */
export const FINDING_KNOWLEDGE_CATALOG: Record<string, FindingKnowledgeEntry> = {
  // HTTPS & SSL/TLS
  MISSING_HTTPS: {
    findingCode: "MISSING_HTTPS",
    title: "HTTPS Not Available",
    targetSlug: "missing-https",
    activeSlug: "https-vs-ssl-vs-tls-difference",
    description: "Cleartext HTTP exposes visitor traffic to passive interception and tampering.",
  },
  HTTP_NOT_REDIRECTING_TO_HTTPS: {
    findingCode: "HTTP_NOT_REDIRECTING_TO_HTTPS",
    title: "HTTP Does Not Redirect to HTTPS",
    targetSlug: "http-does-not-redirect-to-https",
    activeSlug: "https-vs-ssl-vs-tls-difference",
    description: "Unencrypted initial connections can be intercepted before reaching HTTPS.",
  },
  SSL_EXPIRED: {
    findingCode: "SSL_EXPIRED",
    title: "SSL Certificate Expired",
    targetSlug: "ssl-certificate-expired",
    activeSlug: "https-vs-ssl-vs-tls-difference",
    description: "Expired certificates trigger blocking browser security alerts.",
  },
  SSL_EXPIRING_SOON: {
    findingCode: "SSL_EXPIRING_SOON",
    title: "SSL Certificate Expiring Soon",
    targetSlug: "ssl-certificate-expiring-soon",
    activeSlug: "https-vs-ssl-vs-tls-difference",
    description: "Certificates nearing expiry require prompt renewal to avoid downtime.",
  },
  SSL_HOSTNAME_MISMATCH: {
    findingCode: "SSL_HOSTNAME_MISMATCH",
    title: "SSL Certificate Hostname Mismatch",
    targetSlug: "ssl-certificate-hostname-mismatch",
    activeSlug: "https-vs-ssl-vs-tls-difference",
    description: "Certificate SANs do not match the requested domain name.",
  },
  SSL_VALID: {
    findingCode: "SSL_VALID",
    title: "Valid SSL/TLS Certificate",
    targetSlug: "valid-ssl-tls-certificate",
    activeSlug: "https-vs-ssl-vs-tls-difference",
    description: "Authenticated and encrypted TLS channel.",
  },

  // Security Headers
  MISSING_HSTS: {
    findingCode: "MISSING_HSTS",
    title: "Missing HSTS Header",
    targetSlug: "missing-hsts",
    activeSlug: "what-are-security-headers-and-why-they-matter",
    description: "Strict-Transport-Security header prevents SSL-stripping man-in-the-middle attacks.",
  },
  MISSING_CSP: {
    findingCode: "MISSING_CSP",
    title: "Missing Content Security Policy",
    targetSlug: "missing-content-security-policy",
    activeSlug: "what-are-security-headers-and-why-they-matter",
    description: "Content Security Policy restricts unauthorized script execution and stops XSS.",
  },
  MISSING_X_FRAME_OPTIONS: {
    findingCode: "MISSING_X_FRAME_OPTIONS",
    title: "Missing X-Frame-Options",
    targetSlug: "missing-x-frame-options",
    activeSlug: "what-are-security-headers-and-why-they-matter",
    description: "X-Frame-Options protects users from invisible iframe clickjacking attacks.",
  },
  MISSING_REFERRER_POLICY: {
    findingCode: "MISSING_REFERRER_POLICY",
    title: "Missing Referrer-Policy",
    targetSlug: "missing-referrer-policy",
    activeSlug: "what-are-security-headers-and-why-they-matter",
    description: "Referrer-Policy prevents sensitive URLs and tokens from leaking to external sites.",
  },
  MISSING_X_CONTENT_TYPE_OPTIONS: {
    findingCode: "MISSING_X_CONTENT_TYPE_OPTIONS",
    title: "Missing X-Content-Type-Options",
    targetSlug: "missing-x-content-type-options",
    activeSlug: "what-are-security-headers-and-why-they-matter",
    description: "nosniff directive prevents browsers from executing files with spoofed MIME types.",
  },

  // Email Security
  MISSING_DMARC: {
    findingCode: "MISSING_DMARC",
    title: "Missing DMARC Policy",
    targetSlug: "missing-dmarc",
    activeSlug: "what-is-dmarc-guide-to-email-security",
    description: "DMARC verifies email authenticity and protects against domain impersonation.",
  },
  WEAK_SPF: {
    findingCode: "WEAK_SPF",
    title: "Weak or Missing SPF Record",
    targetSlug: "weak-spf",
    activeSlug: "what-is-dmarc-guide-to-email-security",
    description: "Sender Policy Framework designates authorized mail servers for your domain.",
  },
  DKIM_STATUS: {
    findingCode: "DKIM_STATUS",
    title: "DKIM Verification",
    targetSlug: "dkim-email-security",
    activeSlug: "what-is-dmarc-guide-to-email-security",
    description: "DomainKeys Identified Mail signs outgoing messages cryptographically.",
  },

  // Cookies & Server
  INSECURE_COOKIES: {
    findingCode: "INSECURE_COOKIES",
    title: "Insecure Cookie Attributes",
    targetSlug: "insecure-cookie-attributes",
    activeSlug: "website-security-checklist-12-things-every-website-should-check",
    description: "Secure, HttpOnly, and SameSite flags protect cookies from theft and CSRF.",
  },
  EXPOSED_SERVER_INFORMATION: {
    findingCode: "EXPOSED_SERVER_INFORMATION",
    title: "Detailed Server Information Disclosed",
    targetSlug: "exposed-server-information",
    activeSlug: "website-security-checklist-12-things-every-website-should-check",
    description: "Exposing software version numbers simplifies targeted vulnerability research.",
  },
  TECHNOLOGY_DETECTED: {
    findingCode: "TECHNOLOGY_DETECTED",
    title: "Technology Detection",
    targetSlug: "technology-detection",
    activeSlug: "what-is-website-security-beginners-guide",
    description: "Public technology fingerprinting and stack visibility.",
  },
  MISSING_CAA: {
    findingCode: "MISSING_CAA",
    title: "Missing CAA DNS Record",
    targetSlug: "dns-security-caa-records",
    activeSlug: "what-is-website-security-beginners-guide",
    description: "Certification Authority Authorization restricts which CAs can issue certificates.",
  },
  DNSSEC_STATUS: {
    findingCode: "DNSSEC_STATUS",
    title: "DNSSEC Domain Protection",
    targetSlug: "what-is-dnssec-guide",
    activeSlug: "what-is-website-security-beginners-guide",
    description: "DNSSEC protects DNS queries from spoofing and cache poisoning.",
  },
  WEAK_TLS_CIPHER: {
    findingCode: "WEAK_TLS_CIPHER",
    title: "Weak Cipher Suite or Missing Forward Secrecy",
    targetSlug: "weak-tls-cipher-suites",
    activeSlug: "https-vs-ssl-vs-tls-difference",
    description: "Modern TLS cipher suites must enforce Perfect Forward Secrecy (PFS).",
  },
  CSP_UNSAFE_INLINE: {
    findingCode: "CSP_UNSAFE_INLINE",
    title: "CSP With Unsafe Inline Scripts",
    targetSlug: "csp-unsafe-inline-remediation",
    activeSlug: "what-are-security-headers-and-why-they-matter",
    description: "Unsafe inline scripts circumvent Cross-Site Scripting defenses.",
  },
  PERMISSIONS_POLICY: {
    findingCode: "PERMISSIONS_POLICY",
    title: "Permissions-Policy Restriction",
    targetSlug: "permissions-policy-guide",
    activeSlug: "what-are-security-headers-and-why-they-matter",
    description: "Permissions-Policy restricts browser access to sensitive client hardware APIs.",
  },
  CROSS_ORIGIN_ISOLATION: {
    findingCode: "CROSS_ORIGIN_ISOLATION",
    title: "Cross-Origin Isolation (COOP / CORP / COEP)",
    targetSlug: "cross-origin-isolation-guide",
    activeSlug: "what-are-security-headers-and-why-they-matter",
    description: "Cross-Origin Opener Policy isolates web applications from side-channel attacks.",
  },

  // Phase F3: Frontend, JavaScript & Client-Side Exposure Intelligence
  DEEP_JS_SECRET_EXPOSED: {
    findingCode: "DEEP_JS_SECRET_EXPOSED",
    title: "Frontend Credential / Secret Exposure",
    targetSlug: "hardcoded-secrets-in-frontend-javascript",
    description: "Sensitive credentials, private cloud keys, or payment tokens exposed in public client bundles.",
  },
  DEEP_JS_SECRETS_NONE: {
    findingCode: "DEEP_JS_SECRETS_NONE",
    title: "No Hardcoded Frontend Secrets",
    targetSlug: "hardcoded-secrets-in-frontend-javascript",
    description: "No private API keys or cloud credentials were found in client bundles.",
  },
  DEEP_JS_INSECURE_WEBSOCKET: {
    findingCode: "DEEP_JS_INSECURE_WEBSOCKET",
    title: "Insecure Cleartext WebSocket (ws://)",
    targetSlug: "secure-websockets-wss-guide",
    description: "Cleartext WebSocket connections transmit messages without TLS encryption.",
  },
  DEEP_JS_ADMIN_ENDPOINT_EXPOSED: {
    findingCode: "DEEP_JS_ADMIN_ENDPOINT_EXPOSED",
    title: "Administrative Route Disclosure in Client Code",
    targetSlug: "client-side-route-exposure-and-authorization",
    description: "Internal or administrative routes referenced in public frontend scripts.",
  },
  DEEP_JS_API_SURFACE_DETECTED: {
    findingCode: "DEEP_JS_API_SURFACE_DETECTED",
    title: "Discovered Frontend API Surface",
    targetSlug: "securing-frontend-api-endpoints",
    description: "Catalogue of client-facing REST, GraphQL, and WebSocket endpoints.",
  },
  DEEP_JS_STORAGE_AUTH_TOKEN: {
    findingCode: "DEEP_JS_STORAGE_AUTH_TOKEN",
    title: "Authentication Tokens in Web Storage",
    targetSlug: "localstorage-vs-httponly-cookies-token-security",
    description: "Storing authentication tokens in localStorage or sessionStorage exposes them to XSS attacks.",
  },
  DEEP_JS_STORAGE_CLEAN: {
    findingCode: "DEEP_JS_STORAGE_CLEAN",
    title: "Safe Client-Side Storage Usage",
    targetSlug: "localstorage-vs-httponly-cookies-token-security",
    description: "No authentication tokens or credentials detected in browser Web Storage.",
  },
  DEEP_JS_DANGEROUS_DOM_SINK: {
    findingCode: "DEEP_JS_DANGEROUS_DOM_SINK",
    title: "Dangerous DOM Execution Sinks",
    targetSlug: "preventing-dom-xss-and-dangerous-sinks",
    description: "Dynamic execution functions (eval, document.write) or unvalidated postMessage listeners.",
  },
  DEEP_JS_DOM_SECURITY_PASS: {
    findingCode: "DEEP_JS_DOM_SECURITY_PASS",
    title: "Safe DOM Manipulation Practices",
    targetSlug: "preventing-dom-xss-and-dangerous-sinks",
    description: "No dangerous dynamic code execution sinks detected.",
  },
  DEEP_JS_THIRD_PARTY_MISSING_SRI: {
    findingCode: "DEEP_JS_THIRD_PARTY_MISSING_SRI",
    title: "Missing Subresource Integrity (SRI) on CDN Scripts",
    targetSlug: "subresource-integrity-sri-supply-chain-security",
    description: "External scripts loaded from public CDNs lack cryptographic integrity verification hashes.",
  },
  DEEP_JS_THIRD_PARTY_SRI_GOOD: {
    findingCode: "DEEP_JS_THIRD_PARTY_SRI_GOOD",
    title: "Subresource Integrity (SRI) Enforced on CDN Scripts",
    targetSlug: "subresource-integrity-sri-supply-chain-security",
    description: "External CDN scripts are protected with cryptographic integrity hashes.",
  },
  DEEP_JS_SOURCEMAP_CODE_EXPOSED: {
    findingCode: "DEEP_JS_SOURCEMAP_CODE_EXPOSED",
    title: "Source Map Exposes Original Source Code",
    targetSlug: "preventing-source-map-exposure-in-production",
    description: "Production source maps disclose full unminified source code and internal build paths.",
  },
  DEEP_JS_INTERNAL_IP_EXPOSED: {
    findingCode: "DEEP_JS_INTERNAL_IP_EXPOSED",
    title: "Private IP Address or Staging Config Disclosure",
    targetSlug: "preventing-internal-ip-disclosure",
    description: "Localhost, private RFC 1918 IPs, or sensitive framework variables found in production JS.",
  },
  DEEP_JS_CONFIG_CLEAN: {
    findingCode: "DEEP_JS_CONFIG_CLEAN",
    title: "Production Frontend Configuration Clean",
    targetSlug: "preventing-internal-ip-disclosure",
    description: "No internal IP addresses or sensitive staging variables detected.",
  },

  // Phase F4: Advanced Web Application, API & HTTP Security
  DEEP_CORS_MISCONFIG: {
    findingCode: "DEEP_CORS_MISCONFIG",
    title: "Permissive or Insecure CORS Policy",
    targetSlug: "cors-security-best-practices",
    activeSlug: "what-are-security-headers-and-why-they-matter",
    description: "Overly permissive Cross-Origin Resource Sharing (CORS) rules allow unauthorized origins to read sensitive data.",
  },
  DEEP_ERROR_DISCLOSURE: {
    findingCode: "DEEP_ERROR_DISCLOSURE",
    title: "Application Error or Stack Trace Disclosed",
    targetSlug: "preventing-stack-trace-and-debug-exposure",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Verbose application stack traces, framework error pages, or database messages expose internal implementation details.",
  },
  DEEP_CACHE_SENSITIVE: {
    findingCode: "DEEP_CACHE_SENSITIVE",
    title: "Sensitive API Response Publicly Cacheable",
    targetSlug: "api-cache-control-security",
    activeSlug: "what-are-security-headers-and-why-they-matter",
    description: "Authenticated or user-specific API endpoints lack no-store or private cache-control headers.",
  },
  DEEP_HTTP_DANGEROUS_METHOD: {
    findingCode: "DEEP_HTTP_DANGEROUS_METHOD",
    title: "Dangerous HTTP Methods Enabled",
    targetSlug: "securing-http-methods-trace-track",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "HTTP TRACE or TRACK methods are permitted, potentially enabling Cross-Site Tracing (XST) attacks.",
  },
  DEEP_DIRECTORY_LISTING: {
    findingCode: "DEEP_DIRECTORY_LISTING",
    title: "Directory Listing or Sensitive Backup Exposed",
    targetSlug: "preventing-directory-listing-and-backup-exposure",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Directory indexing or unlinked backup/config files (.env.backup, .sql, .tar.gz) are publicly downloadable.",
  },
  DEEP_API_EXPOSURE: {
    findingCode: "DEEP_API_EXPOSURE",
    title: "Public API Documentation or Sensitive Field Exposure",
    targetSlug: "securing-api-endpoints-and-documentation",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Swagger/OpenAPI specifications, internal URLs, or unmasked sensitive fields are exposed on public API endpoints.",
  },
  DEEP_GRAPHQL_INTROSPECTION: {
    findingCode: "DEEP_GRAPHQL_INTROSPECTION",
    title: "GraphQL Schema Introspection Enabled",
    targetSlug: "securing-graphql-introspection-and-queries",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Production GraphQL endpoint permits schema introspection, exposing the entire data model to unauthorized users.",
  },
  DEEP_AUTH_SIGNAL: {
    findingCode: "DEEP_AUTH_SIGNAL",
    title: "Unprotected Admin Route or Auth Signal Detected",
    targetSlug: "securing-authentication-and-admin-routes",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Privileged administrative routes or sensitive authentication workflows lack robust access control.",
  },

  // Phase F5: Advanced Authentication, Session, Authorization & Business Logic
  DEEP_PASSWORD_FORM_INSECURE: {
    findingCode: "DEEP_PASSWORD_FORM_INSECURE",
    title: "Insecure Password Form Submission",
    targetSlug: "securing-password-forms-and-credentials",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Password form submits via unencrypted HTTP or GET method, exposing credentials in transit or logs.",
  },
  DEEP_PASSWORD_IN_URL: {
    findingCode: "DEEP_PASSWORD_IN_URL",
    title: "Plaintext Credential Exposed in URL",
    targetSlug: "preventing-passwords-and-tokens-in-urls",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Password or secret parameter transmitted in URL query parameters, leaking into logs and browser history.",
  },
  DEEP_PASSWORD_RESET_TOKEN: {
    findingCode: "DEEP_PASSWORD_RESET_TOKEN",
    title: "Password Reset Token Exposed in URL",
    targetSlug: "securing-password-reset-and-recovery-tokens",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Account recovery or reset tokens in URLs can be intercepted or leaked via Referer headers.",
  },
  DEEP_AUTH_ENUMERATION: {
    findingCode: "DEEP_AUTH_ENUMERATION",
    title: "Account Enumeration Signal Detected",
    targetSlug: "preventing-user-and-account-enumeration",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Differentiating responses for valid vs invalid accounts permits automated user account harvesting.",
  },
  DEEP_MFA_SIGNAL: {
    findingCode: "DEEP_MFA_SIGNAL",
    title: "Multi-Factor Authentication & Passkey Support",
    targetSlug: "multi-factor-authentication-and-passkeys",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Modern MFA indicators (TOTP, WebAuthn Passkeys, FIDO2) protect users from credential stuffing.",
  },
  DEEP_SESSION_MISSING_HTTPONLY: {
    findingCode: "DEEP_SESSION_MISSING_HTTPONLY",
    title: "Authentication Session Cookie Lacks HttpOnly",
    targetSlug: "securing-session-cookies-httponly-secure",
    activeSlug: "what-are-security-headers-and-why-they-matter",
    description: "Session authentication cookie accessible via JavaScript, leaving sessions vulnerable to XSS theft.",
  },
  DEEP_SESSION_MISSING_SECURE: {
    findingCode: "DEEP_SESSION_MISSING_SECURE",
    title: "Authentication Session Cookie Lacks Secure Flag",
    targetSlug: "securing-session-cookies-httponly-secure",
    activeSlug: "https-vs-ssl-vs-tls-difference",
    description: "Session cookie transmitted over unencrypted HTTP requests, enabling network eavesdropping.",
  },
  DEEP_SESSION_TOKEN_IN_URL: {
    findingCode: "DEEP_SESSION_TOKEN_IN_URL",
    title: "Session Identifier or JWT in URL",
    targetSlug: "preventing-session-tokens-in-urls",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Session IDs, access tokens, or JWTs transported in URL paths or query parameters.",
  },
  DEEP_CSRF_MISSING: {
    findingCode: "DEEP_CSRF_MISSING",
    title: "State-Changing Form Lacks CSRF Defense",
    targetSlug: "csrf-protection-and-samesite-cookies",
    activeSlug: "what-are-security-headers-and-why-they-matter",
    description: "Sensitive state-changing POST workflows without anti-forgery synchronizer tokens or SameSite defense.",
  },
  DEEP_OIDC_OAUTH_CONFIG: {
    findingCode: "DEEP_OIDC_OAUTH_CONFIG",
    title: "OpenID Connect & OAuth 2.0 Security",
    targetSlug: "securing-oauth-oidc-pkce-flows",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Audits for PKCE S256 support, implicit grant deprecation, secure callback URIs, and HTTPS endpoints.",
  },
  DEEP_SAML_METADATA: {
    findingCode: "DEEP_SAML_METADATA",
    title: "SAML 2.0 Single Sign-On Architecture",
    targetSlug: "securing-saml-sso-metadata",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "SAML 2.0 identity federation metadata and SSO endpoint security verification.",
  },
  DEEP_AUTHZ_RBAC: {
    findingCode: "DEEP_AUTHZ_RBAC",
    title: "Authorization Architecture & RBAC Posture",
    targetSlug: "implementing-robust-rbac-and-object-authorization",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Role hierarchies, administrative interfaces, and object-level reference surfaces (BOLA/IDOR).",
  },
  DEEP_BUSINESS_LOGIC: {
    findingCode: "DEEP_BUSINESS_LOGIC",
    title: "Business-Logic Surface & Transaction Security",
    targetSlug: "securing-business-logic-workflows",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Critical transaction surfaces (payments, refunds, role assignment, magic links, approvals).",
  },

  // Phase F6: Advanced Infrastructure, Cloud, Deployment & Operational Security
  DEEP_GIT_METADATA_EXPOSURE: {
    findingCode: "DEEP_GIT_METADATA_EXPOSURE",
    title: "Public Git Repository Metadata Exposed (.git/HEAD)",
    targetSlug: "securing-git-repositories-preventing-git-exposure",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Publicly accessible .git/HEAD directory permits unauthorized source code and credential reconstruction.",
  },
  DEEP_PUBLIC_STORAGE_SENSITIVE_OBJECT: {
    findingCode: "DEEP_PUBLIC_STORAGE_SENSITIVE_OBJECT",
    title: "Sensitive Object Publicly Accessible in Cloud Storage",
    targetSlug: "securing-cloud-storage-s3-gcs-azure-blobs",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Unprotected cloud object storage exposes backup files, database dumps, or application secrets.",
  },
  DEEP_DEV_ENV_EXPOSURE: {
    findingCode: "DEEP_DEV_ENV_EXPOSURE",
    title: "Public Development or Sandbox Environment Discovered",
    targetSlug: "securing-development-and-preview-environments",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Publicly accessible development or preview hostnames expose unhardened features and test credentials.",
  },
  DEEP_STAGING_ENV_EXPOSURE: {
    findingCode: "DEEP_STAGING_ENV_EXPOSURE",
    title: "Public Staging or QA Environment Discovered",
    targetSlug: "securing-staging-and-testing-environments",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Publicly accessible staging systems may leak pre-production data and debug configurations.",
  },
  DEEP_CLOUD_METADATA_REFERENCE: {
    findingCode: "DEEP_CLOUD_METADATA_REFERENCE",
    title: "Cloud Instance Metadata Service Reference in Public Code",
    targetSlug: "preventing-ssrf-and-cloud-metadata-leakage",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Cloud metadata endpoints (169.254.169.254 or metadata.google.internal) referenced in public client code.",
  },
  DEEP_PUBLIC_METRICS_EXPOSURE: {
    findingCode: "DEEP_PUBLIC_METRICS_EXPOSURE",
    title: "Public Prometheus Metrics Endpoint Exposed",
    targetSlug: "securing-prometheus-metrics-and-observability",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Publicly accessible /metrics endpoint discloses internal runtime counters, memory statistics, and service topology.",
  },
  DEEP_PUBLIC_MANAGEMENT_INTERFACE: {
    findingCode: "DEEP_PUBLIC_MANAGEMENT_INTERFACE",
    title: "Public Administrative or Management Interface Discovered",
    targetSlug: "securing-management-interfaces-and-admin-portals",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Administrative management portals or back-office interfaces accessible without network isolation.",
  },
  DEEP_SUBDOMAIN_TAKEOVER_SIGNAL: {
    findingCode: "DEEP_SUBDOMAIN_TAKEOVER_SIGNAL",
    title: "Potential Dangling Infrastructure Signal (Subdomain Takeover Risk)",
    targetSlug: "preventing-subdomain-takeover-and-dangling-cnames",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Dangling CNAME pointer to an abandoned third-party hosted SaaS resource or storage bucket.",
  },
  DEEP_DEPLOYMENT_ARTIFACT_EXPOSURE: {
    findingCode: "DEEP_DEPLOYMENT_ARTIFACT_EXPOSURE",
    title: "Deployment Artifact or Build Manifest Exposed",
    targetSlug: "securing-deployment-artifacts-and-manifests",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Project manifests, package.json, or dependency lockfiles publicly accessible over HTTP.",
  },
  DEEP_ORIGIN_EXPOSURE_SIGNAL: {
    findingCode: "DEEP_ORIGIN_EXPOSURE_SIGNAL",
    title: "Potential Origin Server Infrastructure Signal Detected",
    targetSlug: "protecting-origin-servers-behind-cdns",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Direct origin infrastructure signals or hostnames exposed behind edge CDN/WAF proxies.",
  },
  DEEP_ACTUATOR_SENSITIVE_EXPOSURE: {
    findingCode: "DEEP_ACTUATOR_SENSITIVE_EXPOSURE",
    title: "Sensitive Spring Boot Actuator Environment Exposed",
    targetSlug: "securing-spring-boot-actuators",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Spring Boot Actuator /actuator/env exposes active application profiles and environment variables.",
  },
  DEEP_DOCKER_ARTIFACT_EXPOSURE: {
    findingCode: "DEEP_DOCKER_ARTIFACT_EXPOSURE",
    title: "Container Specification File Exposed",
    targetSlug: "securing-dockerfiles-and-container-manifests",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Public Dockerfile or docker-compose.yml container build specifications exposed on public web server.",
  },

  // Phase F7: Advanced Data Security, Privacy & Sensitive Information Exposure
  DEEP_PUBLIC_PII: {
    findingCode: "DEEP_PUBLIC_PII",
    title: "Personally Identifiable Information (PII) Exposed",
    targetSlug: "protecting-personally-identifiable-information-pii",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Unmasked personal email addresses or phone numbers discovered in public responses.",
  },
  DEEP_PUBLIC_GOVERNMENT_ID: {
    findingCode: "DEEP_PUBLIC_GOVERNMENT_ID",
    title: "Government Identification Number Exposed",
    targetSlug: "preventing-government-id-exposure",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "High-sensitivity government identifiers (SSN, national ID) detected in public content.",
  },
  DEEP_PUBLIC_PAYMENT_DATA: {
    findingCode: "DEEP_PUBLIC_PAYMENT_DATA",
    title: "Payment Card Number Exposed",
    targetSlug: "pci-dss-payment-card-exposure-prevention",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Luhn-validated credit or debit payment card number discovered in public responses.",
  },
  DEEP_PUBLIC_FINANCIAL_DATA: {
    findingCode: "DEEP_PUBLIC_FINANCIAL_DATA",
    title: "Financial Account or Banking Identifier Exposed",
    targetSlug: "securing-financial-and-banking-data",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Valid International Bank Account Number (IBAN) or banking identifiers found in public responses.",
  },
  DEEP_PUBLIC_HEALTH_DATA: {
    findingCode: "DEEP_PUBLIC_HEALTH_DATA",
    title: "Protected Health or Medical Data Exposed",
    targetSlug: "hipaa-health-data-protection-guide",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Health or medical context data exposed in public responses without authentication.",
  },
  DEEP_PUBLIC_LOCATION_DATA: {
    findingCode: "DEEP_PUBLIC_LOCATION_DATA",
    title: "Precise Geographic Location Coordinates Exposed",
    targetSlug: "preventing-precise-location-data-leakage",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "High-precision GPS user coordinates exposed in public endpoint responses.",
  },
  DEEP_PUBLIC_AUTH_DATA: {
    findingCode: "DEEP_PUBLIC_AUTH_DATA",
    title: "Authentication Credentials Disclosed in Response",
    targetSlug: "preventing-credential-disclosure-in-responses",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Cleartext passwords or authentication tokens exposed in publicly accessible responses.",
  },
  DEEP_PII_IN_URL: {
    findingCode: "DEEP_PII_IN_URL",
    title: "PII Transmitted in URL Query Parameters",
    targetSlug: "preventing-pii-in-url-query-parameters",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Personal emails or phone numbers in URL query strings risk logging and referrer exposure.",
  },
  DEEP_SECRET_IN_URL: {
    findingCode: "DEEP_SECRET_IN_URL",
    title: "Sensitive Secret or Token Transmitted in URL",
    targetSlug: "preventing-secrets-in-urls",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Tokens or credentials transmitted via GET query parameters risk exposure in logs and browser history.",
  },
  DEEP_EXCESSIVE_DATA_COLLECTION: {
    findingCode: "DEEP_EXCESSIVE_DATA_COLLECTION",
    title: "Excessive Form Data Collection Signal",
    targetSlug: "data-minimization-and-form-design",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Web form requests extensive personal, financial, and identity fields simultaneously.",
  },
  DEEP_PUBLIC_DATA_EXPORT: {
    findingCode: "DEEP_PUBLIC_DATA_EXPORT",
    title: "Bulk Data Export File Publicly Accessible",
    targetSlug: "securing-data-exports-and-spreadsheets",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Publicly accessible CSV, Excel, or tabular export file containing user or organizational records.",
  },
  DEEP_PUBLIC_DATABASE_DATA: {
    findingCode: "DEEP_PUBLIC_DATABASE_DATA",
    title: "Database Backup or Dump Publicly Accessible",
    targetSlug: "securing-database-backups-and-dumps",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Public SQL database dump or backup file exposed on web server root or public path.",
  },
  DEEP_PUBLIC_LOG_DATA: {
    findingCode: "DEEP_PUBLIC_LOG_DATA",
    title: "Application Log File Publicly Accessible",
    targetSlug: "securing-server-and-application-logs",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Public log file (.log, access.log, error.log) exposing internal execution traces or user activity.",
  },
  DEEP_DOCUMENT_INTERNAL_METADATA: {
    findingCode: "DEEP_DOCUMENT_INTERNAL_METADATA",
    title: "Internal Infrastructure Metadata in Public Document",
    targetSlug: "sanitizing-document-metadata-before-publishing",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "PDF or document metadata reveals internal file paths, author usernames, or software versions.",
  },
  DEEP_PRIVACY_POLICY_MISSING: {
    findingCode: "DEEP_PRIVACY_POLICY_MISSING",
    title: "No Public Privacy Policy Discovered",
    targetSlug: "website-privacy-policy-best-practices",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "No linked privacy policy or privacy statement detected across crawled public pages.",
  },
  DEEP_PRIVACY_POLICY_SIGNAL: {
    findingCode: "DEEP_PRIVACY_POLICY_SIGNAL",
    title: "Privacy Governance Disclosures Evaluated",
    targetSlug: "understanding-privacy-policy-requirements",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Analysis of privacy policy disclosures regarding data retention, user rights, and contact mechanisms.",
  },
  DEEP_SESSION_RECORDING_DETECTED: {
    findingCode: "DEEP_SESSION_RECORDING_DETECTED",
    title: "Session Recording or Replay Script Detected",
    targetSlug: "session-recording-privacy-risks",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Session recording tools (e.g. Hotjar, FullStory, Clarity) capture user interactions and keystrokes.",
  },
  DEEP_ADVERTISING_TRACKING_DETECTED: {
    findingCode: "DEEP_ADVERTISING_TRACKING_DETECTED",
    title: "Third-Party Advertising Trackers Detected",
    targetSlug: "third-party-tracking-and-privacy-compliance",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Multiple third-party marketing, ad-targeting, and behavioral tracking pixels detected.",
  },
  DEEP_TRACKER_BEFORE_CONSENT: {
    findingCode: "DEEP_TRACKER_BEFORE_CONSENT",
    title: "Trackers Loaded Prior to Consent Interaction Signal",
    targetSlug: "implementing-prior-consent-cookie-banners",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Marketing or tracking scripts execute immediately without waiting for user consent interaction.",
  },
  DEEP_DATA_MINIMIZATION_NOTICE: {
    findingCode: "DEEP_DATA_MINIMIZATION_NOTICE",
    title: "API Data Minimization Review Recommended",
    targetSlug: "api-data-minimization-principles",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "API response returns broad objects containing potentially sensitive or unneeded user attributes.",
  },
  // Phase F8: Correlation & Security Risk Chains
  DEEP_RISK_CHAIN_PUBLIC_API_DATA: {
    findingCode: "DEEP_RISK_CHAIN_PUBLIC_API_DATA",
    title: "Public API & Sensitive Data Disclosure Chain",
    targetSlug: "api-data-exposure",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Publicly accessible API endpoints serving response payloads with sensitive data fields.",
  },
  DEEP_RISK_CHAIN_ADMIN_AUTH: {
    findingCode: "DEEP_RISK_CHAIN_ADMIN_AUTH",
    title: "Exposed Administrative & Authentication Surface Chain",
    targetSlug: "admin-portal-security",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Administrative endpoints discovered on the public network alongside authentication surfaces.",
  },
  DEEP_RISK_CHAIN_ADMIN_API_AUTHZ: {
    findingCode: "DEEP_RISK_CHAIN_ADMIN_API_AUTHZ",
    title: "Administrative API Surface & Role Exposure Chain",
    targetSlug: "admin-portal-security",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Administrative API routes and role metadata signals discovered on public endpoints.",
  },
  DEEP_RISK_CHAIN_FRONTEND_INTERNAL_DISCLOSURE: {
    findingCode: "DEEP_RISK_CHAIN_FRONTEND_INTERNAL_DISCLOSURE",
    title: "Frontend Source Map & Internal Network Disclosure Chain",
    targetSlug: "javascript-source-map-security",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Public source maps disclosing internal network hostnames or private server IPs.",
  },
  DEEP_RISK_CHAIN_FRONTEND_SECRET: {
    findingCode: "DEEP_RISK_CHAIN_FRONTEND_SECRET",
    title: "Source Map & Hardcoded Secret Exposure Chain",
    targetSlug: "frontend-api-key-exposure",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Source maps exposing cleartext context for client-side API keys or secrets.",
  },
  DEEP_RISK_CHAIN_ORIGIN_BYPASS: {
    findingCode: "DEEP_RISK_CHAIN_ORIGIN_BYPASS",
    title: "Potential CDN Protection Bypass via Direct Origin Chain",
    targetSlug: "origin-ip-protection",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Direct origin IP or IPv6 DNS discovery allowing potential bypass of edge CDN protections.",
  },
  DEEP_RISK_CHAIN_PUBLIC_CLOUD_DATA: {
    findingCode: "DEEP_RISK_CHAIN_PUBLIC_CLOUD_DATA",
    title: "Public Cloud Storage & Sensitive Data Chain",
    targetSlug: "cloud-storage-bucket-security",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Public cloud storage bucket resources correlated with sensitive data exposure.",
  },
  DEEP_RISK_CHAIN_PII_PROPAGATION: {
    findingCode: "DEEP_RISK_CHAIN_PII_PROPAGATION",
    title: "URL Parameter PII & Cross-Origin Referrer Leakage Chain",
    targetSlug: "referrer-policy-pii-leakage",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Sensitive query parameters propagating to external third parties through referrer headers.",
  },
  DEEP_RISK_CHAIN_TRACKING_DATA_COLLECTION: {
    findingCode: "DEEP_RISK_CHAIN_TRACKING_DATA_COLLECTION",
    title: "Third-Party Tracking Active on Sensitive Forms Chain",
    targetSlug: "session-recording-pii-masking",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Third-party trackers or session recorders active on sensitive user input forms.",
  },
  DEEP_RISK_CHAIN_PUBLIC_DOCUMENT_DATA: {
    findingCode: "DEEP_RISK_CHAIN_PUBLIC_DOCUMENT_DATA",
    title: "Public Documents with Embedded Metadata or Records Chain",
    targetSlug: "document-metadata-sanitization",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Public documents disclosing internal paths, author identities, or customer exports.",
  },
  DEEP_RISK_CHAIN_LOG_AUTH_DATA: {
    findingCode: "DEEP_RISK_CHAIN_LOG_AUTH_DATA",
    title: "Application Logs Disclosing Authentication Data Chain",
    targetSlug: "log-file-exposure-hardening",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Public log files revealing authentication tokens, sessions, or credential contexts.",
  },
  DEEP_RISK_CHAIN_DEVELOPMENT_EXPOSURE: {
    findingCode: "DEEP_RISK_CHAIN_DEVELOPMENT_EXPOSURE",
    title: "Multiple Development & Debug Artifacts Exposed Chain",
    targetSlug: "production-build-artifact-hardening",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Multiple build artifacts, git repositories, or debug endpoints accessible in production.",
  },
  DEEP_RISK_CHAIN_DOCUMENTED_DATA_SURFACE: {
    findingCode: "DEEP_RISK_CHAIN_DOCUMENTED_DATA_SURFACE",
    title: "Publicly Cataloged API with Sensitive Data Chain",
    targetSlug: "api-documentation-security",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Interactive Swagger/OpenAPI documentation describing sensitive API endpoints.",
  },
  DEEP_RISK_CHAIN_AUTH_TRANSPORT: {
    findingCode: "DEEP_RISK_CHAIN_AUTH_TRANSPORT",
    title: "Authentication Surface on Inadequate Transport Chain",
    targetSlug: "hsts-preload-transport-security",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Login interfaces served over weak transport configurations without strict HSTS.",
  },
  DEEP_RISK_CHAIN_TRACKING_GOVERNANCE: {
    findingCode: "DEEP_RISK_CHAIN_TRACKING_GOVERNANCE",
    title: "Behavioral Tracking Active Without Consent Governance Chain",
    targetSlug: "consent-management-compliance-guide",
    activeSlug: "website-vulnerability-scanning-guide",
    description: "Trackers executing prior to visitor interaction without consent controls.",
  },
};

/**
 * Normalizes any scanner check_type, name, or key to a canonical finding code.
 */
export function normalizeFindingCode(check?: Partial<ScanCheck> | null): string | null {
  if (!check) return null;

  const rawKey = `${check.check_type || ""} ${check.name || ""} ${check.title || ""}`.toLowerCase();

  // DMARC
  if (rawKey.includes("dmarc")) {
    return "MISSING_DMARC";
  }

  // SPF
  if (rawKey.includes("spf")) {
    return "WEAK_SPF";
  }

  // DKIM
  if (rawKey.includes("dkim")) {
    return "DKIM_STATUS";
  }

  // HSTS
  if (rawKey.includes("hsts") || rawKey.includes("strict-transport-security")) {
    return "MISSING_HSTS";
  }

  // CSP
  if (rawKey.includes("csp") || rawKey.includes("content-security-policy")) {
    return "MISSING_CSP";
  }

  // X-Frame-Options
  if (rawKey.includes("frame") || rawKey.includes("clickjack")) {
    return "MISSING_X_FRAME_OPTIONS";
  }

  // Referrer-Policy
  if (rawKey.includes("referrer")) {
    return "MISSING_REFERRER_POLICY";
  }

  // X-Content-Type-Options
  if (rawKey.includes("content_type") || rawKey.includes("nosniff") || rawKey.includes("content-type-options")) {
    return "MISSING_X_CONTENT_TYPE_OPTIONS";
  }

  // HTTP to HTTPS Redirect
  if (rawKey.includes("redirect") || rawKey.includes("http_not_redirect")) {
    return "HTTP_NOT_REDIRECTING_TO_HTTPS";
  }

  // HTTPS Availability
  if (rawKey.includes("https_availability") || rawKey.includes("https not available") || rawKey.includes("https_missing")) {
    return "MISSING_HTTPS";
  }

  // SSL Validity / Expiry
  if (rawKey.includes("expired")) {
    return "SSL_EXPIRED";
  }
  if (rawKey.includes("expiring")) {
    return "SSL_EXPIRING_SOON";
  }
  if (rawKey.includes("hostname") || rawKey.includes("mismatch")) {
    return "SSL_HOSTNAME_MISMATCH";
  }
  if (rawKey.includes("ssl") || rawKey.includes("tls")) {
    return "SSL_VALID";
  }

  // CAA Record
  if (rawKey.includes("caa")) {
    return "MISSING_CAA";
  }

  // DNSSEC
  if (rawKey.includes("dnssec")) {
    return "DNSSEC_STATUS";
  }

  // Permissions-Policy
  if (rawKey.includes("permissions")) {
    return "PERMISSIONS_POLICY";
  }

  // Cross-Origin Isolation (COOP / CORP / COEP)
  if (rawKey.includes("coop") || rawKey.includes("corp") || rawKey.includes("coep") || rawKey.includes("cross-origin")) {
    return "CROSS_ORIGIN_ISOLATION";
  }

  // Cipher and Forward Secrecy
  if (rawKey.includes("cipher") || rawKey.includes("forward_secrecy") || rawKey.includes("secrecy")) {
    return "WEAK_TLS_CIPHER";
  }

  // CSP Unsafe-inline / unsafe-eval
  if (rawKey.includes("unsafe_inline") || rawKey.includes("unsafe-inline") || rawKey.includes("unsafe_eval")) {
    return "CSP_UNSAFE_INLINE";
  }

  // Cookies
  if (rawKey.includes("cookie")) {
    return "INSECURE_COOKIES";
  }

  // Server version disclosure
  if (rawKey.includes("server_version") || rawKey.includes("disclosed") || rawKey.includes("fingerprint")) {
    return "EXPOSED_SERVER_INFORMATION";
  }

  // Technology detection
  if (rawKey.includes("technology")) {
    return "TECHNOLOGY_DETECTED";
  }

  // Phase F3: Frontend & JavaScript checks
  if (rawKey.includes("deep_js_secret_exposed") || (rawKey.includes("secret") && rawKey.includes("frontend"))) {
    return "DEEP_JS_SECRET_EXPOSED";
  }
  if (rawKey.includes("deep_js_secrets_none")) {
    return "DEEP_JS_SECRETS_NONE";
  }
  if (rawKey.includes("insecure_websocket") || rawKey.includes("ws://")) {
    return "DEEP_JS_INSECURE_WEBSOCKET";
  }
  if (rawKey.includes("admin_endpoint") || rawKey.includes("privileged admin")) {
    return "DEEP_JS_ADMIN_ENDPOINT_EXPOSED";
  }
  if (rawKey.includes("api_surface") || rawKey.includes("api surface")) {
    return "DEEP_JS_API_SURFACE_DETECTED";
  }
  if (rawKey.includes("storage_auth") || (rawKey.includes("localstorage") && rawKey.includes("token"))) {
    return "DEEP_JS_STORAGE_AUTH_TOKEN";
  }
  if (rawKey.includes("storage_clean")) {
    return "DEEP_JS_STORAGE_CLEAN";
  }
  if (rawKey.includes("dangerous_dom_sink") || rawKey.includes("dom_sink")) {
    return "DEEP_JS_DANGEROUS_DOM_SINK";
  }
  if (rawKey.includes("dom_security_pass")) {
    return "DEEP_JS_DOM_SECURITY_PASS";
  }
  if (rawKey.includes("third_party_missing_sri") || (rawKey.includes("missing") && rawKey.includes("sri"))) {
    return "DEEP_JS_THIRD_PARTY_MISSING_SRI";
  }
  if (rawKey.includes("third_party_sri_good")) {
    return "DEEP_JS_THIRD_PARTY_SRI_GOOD";
  }
  if (rawKey.includes("sourcemap_code_exposed") || (rawKey.includes("source map") && rawKey.includes("code"))) {
    return "DEEP_JS_SOURCEMAP_CODE_EXPOSED";
  }
  if (rawKey.includes("internal_ip_exposed") || rawKey.includes("internal ip")) {
    return "DEEP_JS_INTERNAL_IP_EXPOSED";
  }
  if (rawKey.includes("config_clean")) {
    return "DEEP_JS_CONFIG_CLEAN";
  }

  // Phase F5: Advanced Authentication, Session, Authorization & Business Logic
  if (rawKey.includes("deep_password_form_insecure") || rawKey.includes("password form insecure") || rawKey.includes("insecure password form")) {
    return "DEEP_PASSWORD_FORM_INSECURE";
  }
  if (rawKey.includes("deep_password_in_url") || (rawKey.includes("password") && rawKey.includes("in url"))) {
    return "DEEP_PASSWORD_IN_URL";
  }
  if (rawKey.includes("deep_password_reset_token") || (rawKey.includes("reset") && rawKey.includes("token"))) {
    return "DEEP_PASSWORD_RESET_TOKEN";
  }
  if (rawKey.includes("deep_auth_enumeration") || rawKey.includes("enumeration")) {
    return "DEEP_AUTH_ENUMERATION";
  }
  if (rawKey.includes("deep_mfa_signal") || rawKey.includes("mfa") || rawKey.includes("passkey") || rawKey.includes("webauthn")) {
    return "DEEP_MFA_SIGNAL";
  }
  if (rawKey.includes("deep_session_missing_httponly") || (rawKey.includes("session") && rawKey.includes("httponly"))) {
    return "DEEP_SESSION_MISSING_HTTPONLY";
  }
  if (rawKey.includes("deep_session_missing_secure") || (rawKey.includes("session") && rawKey.includes("secure flag"))) {
    return "DEEP_SESSION_MISSING_SECURE";
  }
  if (rawKey.includes("deep_session_token_in_url") || rawKey.includes("jsessionid") || (rawKey.includes("jwt") && rawKey.includes("url"))) {
    return "DEEP_SESSION_TOKEN_IN_URL";
  }
  if (rawKey.includes("deep_csrf_missing") || (rawKey.includes("csrf") && (rawKey.includes("missing") || rawKey.includes("unprotected")))) {
    return "DEEP_CSRF_MISSING";
  }
  if (rawKey.includes("deep_oidc_oauth_config") || rawKey.includes("oidc") || rawKey.includes("oauth")) {
    return "DEEP_OIDC_OAUTH_CONFIG";
  }
  if (rawKey.includes("deep_saml_metadata") || rawKey.includes("saml")) {
    return "DEEP_SAML_METADATA";
  }
  if (rawKey.includes("deep_authz_rbac") || rawKey.includes("rbac") || rawKey.includes("authorization architecture")) {
    return "DEEP_AUTHZ_RBAC";
  }
  if (rawKey.includes("deep_business_logic") || rawKey.includes("business_logic") || rawKey.includes("transaction surface")) {
    return "DEEP_BUSINESS_LOGIC";
  }

  // Phase F6: Advanced Infrastructure, Cloud, Deployment & Operational Security
  if (rawKey.includes("deep_git_metadata_exposure") || (rawKey.includes("git") && rawKey.includes("head"))) {
    return "DEEP_GIT_METADATA_EXPOSURE";
  }
  if (rawKey.includes("deep_public_storage_sensitive_object") || (rawKey.includes("storage") && rawKey.includes("sensitive object"))) {
    return "DEEP_PUBLIC_STORAGE_SENSITIVE_OBJECT";
  }
  if (rawKey.includes("deep_dev_env_exposure") || (rawKey.includes("development") && rawKey.includes("environment"))) {
    return "DEEP_DEV_ENV_EXPOSURE";
  }
  if (rawKey.includes("deep_staging_env_exposure") || (rawKey.includes("staging") && rawKey.includes("environment"))) {
    return "DEEP_STAGING_ENV_EXPOSURE";
  }
  if (rawKey.includes("deep_cloud_metadata_reference") || rawKey.includes("169.254.169.254") || rawKey.includes("metadata.google.internal")) {
    return "DEEP_CLOUD_METADATA_REFERENCE";
  }
  if (rawKey.includes("deep_public_metrics_exposure") || (rawKey.includes("prometheus") && rawKey.includes("metrics"))) {
    return "DEEP_PUBLIC_METRICS_EXPOSURE";
  }
  if (rawKey.includes("deep_public_management_interface") || (rawKey.includes("management") && rawKey.includes("interface"))) {
    return "DEEP_PUBLIC_MANAGEMENT_INTERFACE";
  }
  if (rawKey.includes("deep_subdomain_takeover_signal") || rawKey.includes("dangling infrastructure") || rawKey.includes("subdomain takeover")) {
    return "DEEP_SUBDOMAIN_TAKEOVER_SIGNAL";
  }
  if (rawKey.includes("deep_deployment_artifact_exposure") || rawKey.includes("package.json") || rawKey.includes("composer.lock")) {
    return "DEEP_DEPLOYMENT_ARTIFACT_EXPOSURE";
  }
  if (rawKey.includes("deep_origin_exposure_signal") || rawKey.includes("deep_origin_hostname_exposure") || (rawKey.includes("origin") && rawKey.includes("signal"))) {
    return "DEEP_ORIGIN_EXPOSURE_SIGNAL";
  }
  if (rawKey.includes("deep_actuator_sensitive_exposure") || (rawKey.includes("actuator") && rawKey.includes("env"))) {
    return "DEEP_ACTUATOR_SENSITIVE_EXPOSURE";
  }
  if (rawKey.includes("deep_docker_artifact_exposure") || rawKey.includes("docker-compose") || rawKey.includes("dockerfile")) {
    return "DEEP_DOCKER_ARTIFACT_EXPOSURE";
  }

  // Phase F7: Advanced Data Security, Privacy & Sensitive Information Exposure
  if (rawKey.includes("deep_public_government_id") || rawKey.includes("government_id") || rawKey.includes("ssn") || rawKey.includes("aadhaar") || rawKey.includes("pan card")) {
    return "DEEP_PUBLIC_GOVERNMENT_ID";
  }
  if (rawKey.includes("deep_public_payment_data") || rawKey.includes("payment_card") || rawKey.includes("credit_card")) {
    return "DEEP_PUBLIC_PAYMENT_DATA";
  }
  if (rawKey.includes("deep_public_financial_data") || rawKey.includes("iban") || rawKey.includes("financial_data")) {
    return "DEEP_PUBLIC_FINANCIAL_DATA";
  }
  if (rawKey.includes("deep_public_health_data") || rawKey.includes("health_data") || rawKey.includes("medical")) {
    return "DEEP_PUBLIC_HEALTH_DATA";
  }
  if (rawKey.includes("deep_public_location_data") || rawKey.includes("location_data") || rawKey.includes("gps coordinates")) {
    return "DEEP_PUBLIC_LOCATION_DATA";
  }
  if (rawKey.includes("deep_public_auth_data") || rawKey.includes("auth_data")) {
    return "DEEP_PUBLIC_AUTH_DATA";
  }
  if (rawKey.includes("deep_public_pii") || rawKey.includes("personal_email")) {
    return "DEEP_PUBLIC_PII";
  }
  if (rawKey.includes("deep_secret_in_url")) {
    return "DEEP_SECRET_IN_URL";
  }
  if (rawKey.includes("deep_pii_in_url")) {
    return "DEEP_PII_IN_URL";
  }
  if (rawKey.includes("deep_excessive_data_collection") || rawKey.includes("excessive_data")) {
    return "DEEP_EXCESSIVE_DATA_COLLECTION";
  }
  if (rawKey.includes("deep_public_database_data") || rawKey.includes("database_dump") || rawKey.includes("sql_dump")) {
    return "DEEP_PUBLIC_DATABASE_DATA";
  }
  if (rawKey.includes("deep_public_log_data") || rawKey.includes("log_data")) {
    return "DEEP_PUBLIC_LOG_DATA";
  }
  if (rawKey.includes("deep_public_data_export") || rawKey.includes("data_export") || rawKey.includes("spreadsheet")) {
    return "DEEP_PUBLIC_DATA_EXPORT";
  }
  if (rawKey.includes("deep_document_internal_metadata") || rawKey.includes("document_metadata")) {
    return "DEEP_DOCUMENT_INTERNAL_METADATA";
  }
  if (rawKey.includes("deep_privacy_policy_missing")) {
    return "DEEP_PRIVACY_POLICY_MISSING";
  }
  if (rawKey.includes("deep_privacy_policy_signal") || rawKey.includes("privacy_policy")) {
    return "DEEP_PRIVACY_POLICY_SIGNAL";
  }
  if (rawKey.includes("deep_session_recording_detected") || rawKey.includes("session_recording") || rawKey.includes("hotjar") || rawKey.includes("fullstory")) {
    return "DEEP_SESSION_RECORDING_DETECTED";
  }
  if (rawKey.includes("deep_advertising_tracking_detected") || rawKey.includes("advertising_tracking")) {
    return "DEEP_ADVERTISING_TRACKING_DETECTED";
  }
  if (rawKey.includes("deep_tracker_before_consent")) {
    return "DEEP_TRACKER_BEFORE_CONSENT";
  }
  if (rawKey.includes("deep_data_minimization")) {
    return "DEEP_DATA_MINIMIZATION_NOTICE";
  }

  // Phase F4: Advanced Web Application, API & HTTP Security
  if (rawKey.includes("cors") || rawKey.includes("deep_cors")) {
    return "DEEP_CORS_MISCONFIG";
  }
  if (rawKey.includes("deep_error") || rawKey.includes("stack_trace") || rawKey.includes("debug_page") || rawKey.includes("database_error")) {
    return "DEEP_ERROR_DISCLOSURE";
  }
  if (rawKey.includes("deep_cache") || rawKey.includes("cache_sensitive")) {
    return "DEEP_CACHE_SENSITIVE";
  }
  if (rawKey.includes("dangerous_method") || rawKey.includes("deep_http_dangerous")) {
    return "DEEP_HTTP_DANGEROUS_METHOD";
  }
  if (rawKey.includes("directory_listing") || rawKey.includes("sensitive_file") || rawKey.includes("backup_file")) {
    return "DEEP_DIRECTORY_LISTING";
  }
  if (rawKey.includes("graphql") || rawKey.includes("deep_graphql")) {
    return "DEEP_GRAPHQL_INTROSPECTION";
  }
  if (rawKey.includes("deep_auth") || rawKey.includes("unprotected_admin")) {
    return "DEEP_AUTH_SIGNAL";
  }
  if (rawKey.includes("deep_api") || rawKey.includes("openapi") || rawKey.includes("swagger") || rawKey.includes("sensitive_json")) {
    return "DEEP_API_EXPOSURE";
  }

  // Phase F8: Correlation & Security Risk Chains
  if (rawKey.includes("deep_risk_chain_public_api_data")) {
    return "DEEP_RISK_CHAIN_PUBLIC_API_DATA";
  }
  if (rawKey.includes("deep_risk_chain_admin_auth")) {
    return "DEEP_RISK_CHAIN_ADMIN_AUTH";
  }
  if (rawKey.includes("deep_risk_chain_admin_api_authz")) {
    return "DEEP_RISK_CHAIN_ADMIN_API_AUTHZ";
  }
  if (rawKey.includes("deep_risk_chain_frontend_internal_disclosure")) {
    return "DEEP_RISK_CHAIN_FRONTEND_INTERNAL_DISCLOSURE";
  }
  if (rawKey.includes("deep_risk_chain_frontend_secret")) {
    return "DEEP_RISK_CHAIN_FRONTEND_SECRET";
  }
  if (rawKey.includes("deep_risk_chain_origin_bypass")) {
    return "DEEP_RISK_CHAIN_ORIGIN_BYPASS";
  }
  if (rawKey.includes("deep_risk_chain_public_cloud_data")) {
    return "DEEP_RISK_CHAIN_PUBLIC_CLOUD_DATA";
  }
  if (rawKey.includes("deep_risk_chain_pii_propagation")) {
    return "DEEP_RISK_CHAIN_PII_PROPAGATION";
  }
  if (rawKey.includes("deep_risk_chain_tracking_data_collection")) {
    return "DEEP_RISK_CHAIN_TRACKING_DATA_COLLECTION";
  }
  if (rawKey.includes("deep_risk_chain_public_document_data")) {
    return "DEEP_RISK_CHAIN_PUBLIC_DOCUMENT_DATA";
  }
  if (rawKey.includes("deep_risk_chain_log_auth_data")) {
    return "DEEP_RISK_CHAIN_LOG_AUTH_DATA";
  }
  if (rawKey.includes("deep_risk_chain_development_exposure")) {
    return "DEEP_RISK_CHAIN_DEVELOPMENT_EXPOSURE";
  }
  if (rawKey.includes("deep_risk_chain_documented_data_surface")) {
    return "DEEP_RISK_CHAIN_DOCUMENTED_DATA_SURFACE";
  }
  if (rawKey.includes("deep_risk_chain_auth_transport")) {
    return "DEEP_RISK_CHAIN_AUTH_TRANSPORT";
  }
  if (rawKey.includes("deep_risk_chain_tracking_governance")) {
    return "DEEP_RISK_CHAIN_TRACKING_GOVERNANCE";
  }

  return null;
}

/**
 * Resolves the educational article reference for a given check.
 * If a SiteSecura blog article exists (activeSlug or targetSlug), returns
 * a local link to /blog/[slug].
 * If no article exists yet, safely falls back to check.documentation_url
 * to prevent dead links.
 */
export function resolveFindingArticle(check?: Partial<ScanCheck> | null): FindingArticleResolution {
  if (!check) {
    return { hasArticle: false, href: "", label: "", isExternal: false };
  }

  const code = normalizeFindingCode(check);
  const entry = code ? FINDING_KNOWLEDGE_CATALOG[code] : undefined;

  // If a mapped article exists
  if (entry && (entry.activeSlug || entry.targetSlug)) {
    const slug = entry.activeSlug || entry.targetSlug;
    return {
      hasArticle: true,
      href: `/blog/${slug}`,
      label: "Learn More",
      isExternal: false,
      targetSlug: entry.targetSlug,
      entry,
    };
  }

  // Fallback to existing external technical documentation if available
  if (check.documentation_url) {
    return {
      hasArticle: false,
      href: check.documentation_url,
      label: "Technical Documentation",
      isExternal: true,
    };
  }

  return { hasArticle: false, href: "", label: "", isExternal: false };
}
