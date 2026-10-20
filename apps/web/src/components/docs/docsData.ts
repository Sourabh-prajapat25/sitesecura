import {
  BookOpen,
  ShieldCheck,
  Activity,
  Building2,
  Lock,
  FileCode,
  Mail,
  FileCheck,
  Globe,
  Bot,
  Zap,
  Server,
  ShieldAlert,
  Sliders,
  CheckCircle2,
} from "lucide-react";

export interface DocTopic {
  id: string;
  title: string;
  description: string;
  href: string;
  badge?: string;
  target?: string;
}

export interface DocCategory {
  id: string;
  title: string;
  slug: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  topics: DocTopic[];
}

export interface FeaturedDoc {
  id: string;
  title: string;
  summary: string;
  href: string;
  categoryLabel: string;
  readTime: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface DocTool {
  id: string;
  title: string;
  description: string;
  href: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface DocReferenceModule {
  id: string;
  name: string;
  code: string;
  description: string;
  href: string;
  signalsChecked: string[];
}

export const DOC_CATEGORIES: DocCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    slug: "getting-started",
    description: "Foundational guides on how SiteSecura evaluates website security, calculates scores, and verifies domain targets.",
    icon: BookOpen,
    topics: [
      {
        id: "gs-scores",
        title: "How SiteSecura Calculates Security Scores",
        description: "Understanding numerical scoring (0-100), risk levels (A+ to F), and severity-weighted check deductions.",
        href: "/docs/getting-started/understanding-security-scores",
        badge: "Guide",
      },
      {
        id: "gs-passive-scanner",
        title: "Passive vs Active Security Scanners",
        description: "Why SiteSecura focuses on non-destructive, safe perimeter analysis without intrusive vulnerability exploitation.",
        href: "/docs/getting-started/first-security-scan",
        badge: "Overview",
      },
      {
        id: "gs-domain-targets",
        title: "Adding and Verifying Domain Targets",
        description: "How to register domain assets in your dashboard and verify ownership for automated deep scans.",
        href: "/docs/getting-started/adding-and-verifying-domains",
        badge: "Walkthrough",
      },
      {
        id: "gs-first-scan",
        title: "Running Your First Website Security Scan",
        description: "How to trigger an instantaneous 60-second perimeter security assessment from the homepage.",
        href: "/docs/getting-started/first-security-scan",
        badge: "Quickstart",
      },
    ],
  },
  {
    id: "checks-catalog",
    title: "Security Checks Catalog",
    slug: "security-checks-catalog",
    description: "Technical specifications on how our scanning modules audit transport encryption, response headers, and DNS records.",
    icon: ShieldCheck,
    topics: [
      {
        id: "chk-ssl",
        title: "SSL/TLS Certificate Validity & Expiration",
        description: "Cryptographic protocol verification, Subject Alternative Names (SAN), chain of trust, and renewal windows.",
        href: "/docs/security-checks/ssl-tls-certificates",
        badge: "Article & Spec",
      },
      {
        id: "chk-https-redirect",
        title: "HTTPS Enforcement & Redirect Chains",
        description: "Validating permanent HTTP 301 redirects to HTTPS without downgrade risks or mixed-content loops.",
        href: "/tools/http-status-checker",
        badge: "Tool & Spec",
      },
      {
        id: "chk-email-security",
        title: "SPF & DMARC Record Analysis",
        description: "Evaluating DNS TXT records to prevent email spoofing, phishing, and protect brand domain reputation.",
        href: "/docs/security-checks/dns-and-email-security",
        badge: "Article & Spec",
      },
      {
        id: "chk-hsts",
        title: "Strict-Transport-Security (HSTS) Header",
        description: "Instructing browsers to strictly enforce HTTPS connections and protect against SSL stripping attacks.",
        href: "/docs/security-checks/http-security-headers",
        badge: "Header Spec",
      },
      {
        id: "chk-csp",
        title: "Content-Security-Policy (CSP) Directives",
        description: "Auditing CSP syntax, script-src, object-src, and unsafe-inline vulnerabilities against XSS exploits.",
        href: "/docs/security-checks/content-security-policy",
        badge: "Article & Spec",
      },
      {
        id: "chk-clickjacking",
        title: "Clickjacking Defense (X-Frame-Options)",
        description: "Preventing UI redressing attacks with DENY or SAMEORIGIN iframe embedding restrictions.",
        href: "/docs/security-checks/http-security-headers",
        badge: "Header Spec",
      },
      {
        id: "chk-cookies",
        title: "Cookie Security Flags (Secure, HttpOnly, SameSite)",
        description: "Hardening session tokens and authentication cookies against client-side script theft and CSRF.",
        href: "/docs/security-checks/cookie-security-flags",
        badge: "Best Practice",
      },
    ],
  },
  {
    id: "monitoring-alerts",
    title: "Automated Monitoring & Alerts",
    slug: "monitoring-and-alerts",
    description: "How background automated workers continuously audit your domains and notify you of security regressions.",
    icon: Activity,
    topics: [
      {
        id: "mon-frequency",
        title: "Setting Scan Frequencies (Weekly vs Daily)",
        description: "Configuring automated recurring audits based on your website's criticality and subscription plan.",
        href: "/docs/monitoring/scheduled-scans-and-alerts",
        badge: "Feature Guide",
      },
      {
        id: "mon-ssl-warnings",
        title: "SSL Expiration Early Warning Thresholds",
        description: "Proactive 30-day, 14-day, and 7-day automated warnings before certificate expiration causes browser downtime.",
        href: "/docs/security-checks/ssl-tls-certificates",
        badge: "Alerts Guide",
      },
      {
        id: "mon-score-drops",
        title: "Score Drop Notifications & Alert Preferences",
        description: "Configuring email notifications when your website's security grade changes or new critical findings emerge.",
        href: "/docs/monitoring/scheduled-scans-and-alerts",
        badge: "Notifications",
      },
    ],
  },
  {
    id: "agency-whitelabel",
    title: "Agency & White-Labeling",
    slug: "agency-and-whitelabeling",
    description: "Configuring client organizations, team member seats, and branded PDF audit exports.",
    icon: Building2,
    topics: [
      {
        id: "agn-branding",
        title: "Custom Logo & Brand Palette Configuration",
        description: "Customizing client-facing PDF reports with your agency logo, brand colors, and custom report headers.",
        href: "/docs/agency/team-roles-and-whitelabeling",
        badge: "Agency Guide",
      },
      {
        id: "agn-bulk-import",
        title: "Bulk CSV Domain Import Format",
        description: "Importing and auditing dozens of client web properties simultaneously via structured CSV uploads.",
        href: "/docs/agency/team-roles-and-whitelabeling",
        badge: "Feature Guide",
      },
      {
        id: "agn-rbac",
        title: "Role-Based Access Control (RBAC) Permissions",
        description: "Managing Owner, Admin, and Viewer permissions across team members and client workspaces.",
        href: "/docs/agency/team-roles-and-whitelabeling",
        badge: "Team Guide",
      },
    ],
  },
];

export const FEATURED_DOCS: FeaturedDoc[] = [
  {
    id: "feat-security-checklist",
    title: "How to Check Your Website Security: A Practical Guide",
    summary:
      "A complete 5-step checklist to evaluate your web server's transport security, certificate lifespan, defensive HTTP response headers, and email authentication.",
    href: "/blog/how-to-check-your-website-security",
    categoryLabel: "Security Guides",
    readTime: "5 min read",
    icon: ShieldCheck,
  },
  {
    id: "feat-security-headers",
    title: "Understanding Defensive HTTP Security Headers",
    summary:
      "Learn how HSTS, Content-Security-Policy, and X-Frame-Options instruct browsers to restrict risky behaviors and block client-side injection attacks.",
    href: "/blog/what-are-security-headers-and-why-they-matter",
    categoryLabel: "Security Headers",
    readTime: "6 min read",
    icon: FileCode,
  },
  {
    id: "feat-dmarc-guide",
    title: "What Is DMARC? A Practical Guide to Email Security",
    summary:
      "Protect your domain from spoofing and phishing. Step-by-step guidance on implementing SPF, DKIM, and DMARC enforcement policies.",
    href: "/blog/what-is-dmarc-guide-to-email-security",
    categoryLabel: "DNS & Email",
    readTime: "6 min read",
    icon: Mail,
  },
];

export const DOC_TOOLS: DocTool[] = [
  {
    id: "tool-dns",
    title: "DNS Lookup Tool",
    description: "Query real-time DNS records (A, AAAA, CNAME, MX, NS, TXT, SOA, CAA) with bounded timeouts.",
    href: "/tools/dns-lookup",
    badge: "DNS Records",
    icon: Globe,
  },
  {
    id: "tool-http",
    title: "HTTP Status & Redirect Checker",
    description: "Inspect HTTP response status, complete redirect hop chains, SSL transitions, and response headers.",
    href: "/tools/http-status-checker",
    badge: "HTTP / Redirects",
    icon: Zap,
  },
  {
    id: "tool-security-txt",
    title: "security.txt Validator",
    description: "Verify RFC 9116 compliance, contact directives, expiration timestamps, and digital PGP signatures.",
    href: "/tools/security-txt-validator",
    badge: "RFC 9116",
    icon: FileCheck,
  },
  {
    id: "tool-robots",
    title: "Robots.txt & Sitemap Checker",
    description: "Inspect crawler rules, User-agent directives, disallow paths, and XML sitemap declarations.",
    href: "/tools/robots-sitemap-checker",
    badge: "Crawlers & SEO",
    icon: Bot,
  },
  {
    id: "tool-csp",
    title: "CSP Policy Analyzer",
    description: "Validate Content-Security-Policy syntax, directive strength, and identify XSS bypass vectors.",
    href: "/tools/csp-policy-analyzer",
    badge: "CSP Analyzer",
    icon: FileCode,
  },
  {
    id: "tool-config-generator",
    title: "Security Config Generator",
    description: "Generate copy-ready, production-hardened security header snippets for Nginx, Apache, Caddy, and Cloudflare.",
    href: "/docs/tools/security-config-generator",
    badge: "Interactive Tool",
    icon: Sliders,
  },
  {
    id: "tool-ssl",
    title: "SSL/TLS Certificate Checker",
    description: "Inspect certificate trust chains, SAN coverage, cipher strengths, and renewal deadlines.",
    href: "/tools/ssl-checker",
    badge: "TLS / HTTPS",
    icon: Lock,
  },
];

export const DOC_REFERENCE_MODULES: DocReferenceModule[] = [
  {
    id: "mod-ssl",
    name: "SSL / TLS Handshake & Cipher Suites",
    code: "SCAN-MOD-TLS",
    description: "Audits protocol versions (TLS 1.2, 1.3), certificate expiration countdown, hostname matching, and CA trust chains.",
    href: "/tools/ssl-checker",
    signalsChecked: ["TLS Version", "Cert Expiration", "SAN Matching", "Issuer Authority"],
  },
  {
    id: "mod-https",
    name: "HTTPS Redirection & Connection Pinning",
    code: "SCAN-MOD-HTTP",
    description: "Checks whether port 80 automatically issues a permanent 301 redirect to HTTPS without cleartext interception gaps.",
    href: "/tools/http-status-checker",
    signalsChecked: ["Port 80 Redirect", "301 Permanent Status", "Redirect Hops", "Scheme Downgrade Resistance"],
  },
  {
    id: "mod-headers",
    name: "Defensive HTTP Security Headers",
    code: "SCAN-MOD-HDRS",
    description: "Inspects presence and configuration of HSTS, CSP, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy.",
    href: "/tools/security-headers-checker",
    signalsChecked: ["Strict-Transport-Security", "Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options"],
  },
  {
    id: "mod-email",
    name: "Domain Email Authentication (SPF & DMARC)",
    code: "SCAN-MOD-DNS",
    description: "Queries authoritative nameservers for SPF TXT records, DKIM public keys, DMARC policies, and DNSSEC validation.",
    href: "/tools/email-security-checker",
    signalsChecked: ["SPF TXT Record", "DMARC Policy (_dmarc)", "DKIM Guidance", "DNSSEC Existence"],
  },
];
