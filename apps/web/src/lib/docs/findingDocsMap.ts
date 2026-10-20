/**
 * SiteSecura Technical Documentation — Finding to Documentation Guide Mapping
 *
 * Connects scanner checks and normalized finding codes directly to official
 * technical documentation guides (/docs/[category]/[slug]#anchor) and interactive
 * configuration tools, giving developers instant remediation instructions.
 */

import { ScanCheck } from "@/types";
import { normalizeFindingCode } from "@/lib/blog/findingArticleMap";

export interface FindingDocEntry {
  findingCode: string;
  category: string;
  slug: string;
  anchor?: string;
  title: string;
  label: string;
  toolHref?: string;
  toolLabel?: string;
}

export interface FindingDocResolution {
  hasDoc: boolean;
  href: string;
  category?: string;
  slug?: string;
  anchor?: string;
  title?: string;
  label: string;
  toolHref?: string;
  toolLabel?: string;
}

export const FINDING_DOCS_CATALOG: Record<string, FindingDocEntry> = {
  // ---------------------------------------------------------------------------
  // SECURITY HEADERS
  // ---------------------------------------------------------------------------
  MISSING_HSTS: {
    findingCode: "MISSING_HSTS",
    category: "security-checks",
    slug: "http-security-headers",
    anchor: "1-strict-transport-security-hsts",
    title: "Strict-Transport-Security (HSTS) Guide",
    label: "HSTS Guide",
    toolHref: "/docs/tools/security-config-generator",
    toolLabel: "Generate HSTS Config",
  },
  MISSING_X_FRAME_OPTIONS: {
    findingCode: "MISSING_X_FRAME_OPTIONS",
    category: "security-checks",
    slug: "http-security-headers",
    anchor: "2-x-frame-options-clickjacking-protection",
    title: "X-Frame-Options Clickjacking Defense",
    label: "Clickjacking Guide",
    toolHref: "/docs/tools/security-config-generator",
    toolLabel: "Generate Header Config",
  },
  MISSING_X_CONTENT_TYPE_OPTIONS: {
    findingCode: "MISSING_X_CONTENT_TYPE_OPTIONS",
    category: "security-checks",
    slug: "http-security-headers",
    anchor: "3-x-content-type-options-mime-sniffing-prevention",
    title: "X-Content-Type-Options nosniff Directives",
    label: "MIME Sniffing Guide",
    toolHref: "/docs/tools/security-config-generator",
    toolLabel: "Generate Header Config",
  },
  MISSING_REFERRER_POLICY: {
    findingCode: "MISSING_REFERRER_POLICY",
    category: "security-checks",
    slug: "http-security-headers",
    anchor: "4-referrer-policy",
    title: "Referrer-Policy Privacy Hardening",
    label: "Referrer Guide",
    toolHref: "/docs/tools/security-config-generator",
    toolLabel: "Generate Header Config",
  },
  PERMISSIONS_POLICY: {
    findingCode: "PERMISSIONS_POLICY",
    category: "security-checks",
    slug: "http-security-headers",
    anchor: "5-permissions-policy",
    title: "Permissions-Policy Hardware Restriction",
    label: "Permissions Guide",
    toolHref: "/docs/tools/security-config-generator",
    toolLabel: "Generate Header Config",
  },
  CROSS_ORIGIN_ISOLATION: {
    findingCode: "CROSS_ORIGIN_ISOLATION",
    category: "security-checks",
    slug: "http-security-headers",
    anchor: "5-permissions-policy",
    title: "Cross-Origin Isolation & Defensive Headers",
    label: "Headers Guide",
  },

  // ---------------------------------------------------------------------------
  // CONTENT SECURITY POLICY (CSP)
  // ---------------------------------------------------------------------------
  MISSING_CSP: {
    findingCode: "MISSING_CSP",
    category: "security-checks",
    slug: "content-security-policy",
    anchor: "1-missing-csp-header",
    title: "Content Security Policy (CSP) Directives",
    label: "CSP Guide",
    toolHref: "/tools/csp-policy-analyzer",
    toolLabel: "Analyze CSP Policy",
  },
  CSP_UNSAFE_INLINE: {
    findingCode: "CSP_UNSAFE_INLINE",
    category: "security-checks",
    slug: "content-security-policy",
    anchor: "2-presence-of-unsafe-inline-in-script-src",
    title: "Remediating 'unsafe-inline' in CSP",
    label: "CSP Fix Guide",
    toolHref: "/tools/csp-policy-analyzer",
    toolLabel: "Analyze CSP Policy",
  },

  // ---------------------------------------------------------------------------
  // SSL / TLS & TRANSPORT
  // ---------------------------------------------------------------------------
  SSL_EXPIRED: {
    findingCode: "SSL_EXPIRED",
    category: "security-checks",
    slug: "ssl-tls-certificates",
    anchor: "2-certificate-validity-expiration-countdown",
    title: "SSL/TLS Certificate Validity & Expiration",
    label: "TLS Guide",
    toolHref: "/tools/ssl-checker",
    toolLabel: "Check SSL Certificate",
  },
  SSL_EXPIRING_SOON: {
    findingCode: "SSL_EXPIRING_SOON",
    category: "security-checks",
    slug: "ssl-tls-certificates",
    anchor: "2-certificate-validity-expiration-countdown",
    title: "SSL Certificate Renewal & Expiry Thresholds",
    label: "TLS Guide",
    toolHref: "/tools/ssl-checker",
    toolLabel: "Check SSL Certificate",
  },
  SSL_HOSTNAME_MISMATCH: {
    findingCode: "SSL_HOSTNAME_MISMATCH",
    category: "security-checks",
    slug: "ssl-tls-certificates",
    anchor: "3-subject-alternative-name-san-host-matching",
    title: "SAN Host Matching & Certificate Domains",
    label: "TLS SAN Guide",
    toolHref: "/tools/ssl-checker",
    toolLabel: "Check SSL Certificate",
  },
  SSL_VALID: {
    findingCode: "SSL_VALID",
    category: "security-checks",
    slug: "ssl-tls-certificates",
    anchor: "what-sitesecura-checks",
    title: "SSL/TLS Protocol Verification & Trust Chains",
    label: "TLS Guide",
    toolHref: "/tools/ssl-checker",
    toolLabel: "Check SSL Certificate",
  },
  WEAK_TLS_CIPHER: {
    findingCode: "WEAK_TLS_CIPHER",
    category: "security-checks",
    slug: "ssl-tls-certificates",
    anchor: "1-protocol-negotiation-tls-versions",
    title: "Modern TLS Protocols & Forward Secrecy Ciphers",
    label: "TLS Ciphers Guide",
    toolHref: "/tools/ssl-checker",
    toolLabel: "Check SSL Certificate",
  },
  MISSING_HTTPS: {
    findingCode: "MISSING_HTTPS",
    category: "security-checks",
    slug: "ssl-tls-certificates",
    anchor: "overview-of-the-ssltls-handshake-check",
    title: "Enforcing HTTPS & Transport Hardening",
    label: "HTTPS Guide",
    toolHref: "/tools/http-status-checker",
    toolLabel: "Check HTTP Redirect",
  },
  HTTP_NOT_REDIRECTING_TO_HTTPS: {
    findingCode: "HTTP_NOT_REDIRECTING_TO_HTTPS",
    category: "security-checks",
    slug: "ssl-tls-certificates",
    anchor: "overview-of-the-ssltls-handshake-check",
    title: "HTTP to HTTPS 301 Permanent Redirection",
    label: "HTTPS Redirect Guide",
    toolHref: "/tools/http-status-checker",
    toolLabel: "Check HTTP Redirect",
  },

  // ---------------------------------------------------------------------------
  // EMAIL SECURITY & DNS
  // ---------------------------------------------------------------------------
  MISSING_DMARC: {
    findingCode: "MISSING_DMARC",
    category: "security-checks",
    slug: "dns-and-email-security",
    anchor: "2-dmarc-domain-based-message-authentication",
    title: "DMARC Policy Enforcement Guide",
    label: "DMARC Guide",
    toolHref: "/tools/email-security-checker",
    toolLabel: "Test DMARC Policy",
  },
  WEAK_SPF: {
    findingCode: "WEAK_SPF",
    category: "security-checks",
    slug: "dns-and-email-security",
    anchor: "1-sender-policy-framework-spf",
    title: "Authoritative SPF TXT Record Configuration",
    label: "SPF Guide",
    toolHref: "/tools/email-security-checker",
    toolLabel: "Test SPF Record",
  },
  DKIM_STATUS: {
    findingCode: "DKIM_STATUS",
    category: "security-checks",
    slug: "dns-and-email-security",
    anchor: "why-domain-email-security-matters",
    title: "DKIM Cryptographic Email Signing",
    label: "Email Security Guide",
    toolHref: "/tools/email-security-checker",
    toolLabel: "Test Email Security",
  },
  DNSSEC_STATUS: {
    findingCode: "DNSSEC_STATUS",
    category: "security-checks",
    slug: "dns-and-email-security",
    anchor: "3-dnssec-dns-security-extensions",
    title: "DNSSEC Domain Protection & Validation",
    label: "DNSSEC Guide",
    toolHref: "/tools/dns-lookup",
    toolLabel: "Lookup DNS Records",
  },
  MISSING_CAA: {
    findingCode: "MISSING_CAA",
    category: "security-checks",
    slug: "dns-and-email-security",
    anchor: "3-dnssec-dns-security-extensions",
    title: "Certification Authority Authorization (CAA)",
    label: "CAA DNS Guide",
    toolHref: "/tools/dns-lookup",
    toolLabel: "Lookup DNS Records",
  },

  // ---------------------------------------------------------------------------
  // COOKIE & SESSION HARDENING
  // ---------------------------------------------------------------------------
  INSECURE_COOKIES: {
    findingCode: "INSECURE_COOKIES",
    category: "security-checks",
    slug: "cookie-security-flags",
    anchor: "the-three-core-cookie-security-flags",
    title: "Cookie Security Attributes (Secure, HttpOnly, SameSite)",
    label: "Cookie Security Guide",
  },
  DEEP_SESSION_MISSING_HTTPONLY: {
    findingCode: "DEEP_SESSION_MISSING_HTTPONLY",
    category: "security-checks",
    slug: "cookie-security-flags",
    anchor: "2-the-httponly-attribute",
    title: "Preventing Cookie Theft with HttpOnly",
    label: "HttpOnly Guide",
  },
  DEEP_SESSION_MISSING_SECURE: {
    findingCode: "DEEP_SESSION_MISSING_SECURE",
    category: "security-checks",
    slug: "cookie-security-flags",
    anchor: "1-the-secure-attribute",
    title: "Enforcing Secure Flag on Cookies",
    label: "Secure Cookie Guide",
  },
  DEEP_CSRF_MISSING: {
    findingCode: "DEEP_CSRF_MISSING",
    category: "security-checks",
    slug: "cookie-security-flags",
    anchor: "3-the-samesite-attribute",
    title: "SameSite Cookie Defense Against CSRF",
    label: "SameSite Guide",
  },
  DEEP_JS_STORAGE_AUTH_TOKEN: {
    findingCode: "DEEP_JS_STORAGE_AUTH_TOKEN",
    category: "security-checks",
    slug: "cookie-security-flags",
    anchor: "2-the-httponly-attribute",
    title: "Storing Tokens in HttpOnly Cookies vs Web Storage",
    label: "Token Security Guide",
  },

  // ---------------------------------------------------------------------------
  // MONITORING & GENERAL SCORING
  // ---------------------------------------------------------------------------
  EXPOSED_SERVER_INFORMATION: {
    findingCode: "EXPOSED_SERVER_INFORMATION",
    category: "getting-started",
    slug: "understanding-security-scores",
    anchor: "severity-weights-and-deduction-penalty-matrix",
    title: "Server Information Disclosure & Scoring Deductions",
    label: "Scoring Guide",
  },
  TECHNOLOGY_DETECTED: {
    findingCode: "TECHNOLOGY_DETECTED",
    category: "getting-started",
    slug: "first-security-scan",
    anchor: "overview-of-the-sitesecura-assessment-engine",
    title: "Passive Perimeter Technology Detection",
    label: "Scan Overview",
  },
};

/**
 * Resolves the official technical documentation guide for a given scan check.
 * Returns a fully qualified path to /docs/[category]/[slug]#anchor if a direct
 * mapping exists.
 */
export function resolveFindingDoc(
  check?: Partial<ScanCheck> | null
): FindingDocResolution {
  if (!check) {
    return { hasDoc: false, href: "", label: "" };
  }

  const code = normalizeFindingCode(check);
  const entry = code ? FINDING_DOCS_CATALOG[code] : undefined;

  if (entry) {
    const anchorPart = entry.anchor ? `#${entry.anchor}` : "";
    const href = `/docs/${entry.category}/${entry.slug}${anchorPart}`;
    return {
      hasDoc: true,
      href,
      category: entry.category,
      slug: entry.slug,
      anchor: entry.anchor,
      title: entry.title,
      label: entry.label || "Documentation Guide",
      toolHref: entry.toolHref,
      toolLabel: entry.toolLabel,
    };
  }

  return { hasDoc: false, href: "", label: "" };
}
