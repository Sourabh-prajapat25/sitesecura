import { calculateReadingTime } from "@/components/blog/blogUtils";

export interface DocArticle {
  slug: string;
  category: string; // "getting-started" | "security-checks" | "monitoring" | "agency"
  categoryTitle: string;
  title: string;
  description: string;
  summary: string;
  lastUpdated: string;
  readingTimeMinutes: number;
  keywords: string[];
  content: string;
  relatedArticles: Array<{ slug: string; category: string; title: string }>;
  relatedTools: Array<{ title: string; href: string; badge: string }>;
  published: boolean;
}

export interface DocCategoryMeta {
  id: string;
  slug: string;
  title: string;
  description: string;
}

export const DOC_CATEGORY_METAS: DocCategoryMeta[] = [
  {
    id: "getting-started",
    slug: "getting-started",
    title: "Getting Started",
    description: "Foundational guides on how SiteSecura evaluates website security, calculates scores, and verifies domain targets.",
  },
  {
    id: "security-checks",
    slug: "security-checks",
    title: "Security Checks Catalog",
    description: "Technical specifications on how our scanning modules audit transport encryption, response headers, and DNS records.",
  },
  {
    id: "monitoring",
    slug: "monitoring",
    title: "Automated Monitoring & Alerts",
    description: "How background automated workers continuously audit your domains and notify you of security regressions.",
  },
  {
    id: "agency",
    slug: "agency",
    title: "Agency & White-Labeling",
    description: "Configuring client organizations, team member seats, and branded PDF audit exports.",
  },
];

/**
 * Normalizes category slugs to canonical form, handling aliases from D1 navigation.
 */
export function normalizeCategorySlug(category: string): string {
  const lower = category.toLowerCase().trim();
  if (lower === "security-checks-catalog" || lower === "security-checks") return "security-checks";
  if (lower === "monitoring-and-alerts" || lower === "monitoring-alerts" || lower === "monitoring") return "monitoring";
  if (lower === "agency-and-whitelabeling" || lower === "agency-whitelabel" || lower === "agency") return "agency";
  if (lower === "getting-started") return "getting-started";
  return lower;
}

export const DOC_ARTICLES: DocArticle[] = [
  // ==========================================
  // GETTING STARTED (3 Articles)
  // ==========================================
  {
    slug: "first-security-scan",
    category: "getting-started",
    categoryTitle: "Getting Started",
    title: "Running Your First Website Security Scan",
    description: "Learn how SiteSecura performs safe, non-intrusive perimeter security audits in 60 seconds without disrupting production traffic.",
    summary: "Step-by-step walkthrough of initiating a passive security assessment, understanding the scan lifecycle, and reviewing executive findings.",
    lastUpdated: "2026-03-20",
    readingTimeMinutes: 5,
    keywords: ["security scan", "passive scanner", "perimeter audit", "website test", "quickstart", "scan lifecycle"],
    published: true,
    relatedArticles: [
      { slug: "understanding-security-scores", category: "getting-started", title: "Understanding Security Scores & Grades" },
      { slug: "adding-and-verifying-domains", category: "getting-started", title: "Adding and Verifying Domain Targets" },
      { slug: "ssl-tls-certificates", category: "security-checks", title: "SSL/TLS Certificate Validity & Expiration" },
    ],
    relatedTools: [
      { title: "Website Security Checker", href: "/tools/website-security-checker", badge: "Scanner" },
      { title: "HTTP Status & Redirect Checker", href: "/tools/http-status-checker", badge: "HTTP Tool" },
    ],
    content: `## Overview of the SiteSecura Assessment Engine

SiteSecura is an external perimeter security scanner engineered to evaluate public web assets against modern defensive standards. Unlike active vulnerability exploitation tools or invasive penetration testing scripts, SiteSecura operates **purely out-of-band as a passive client**.

When you submit a domain or hostname for evaluation, our scanning nodes simulate a modern browser client and query your public network interfaces to determine whether your cryptographic certificates, defensive HTTP response headers, email authentication records, and domain routing conform to current industry benchmarks.

### Passive Scanning vs Invasive Testing

Understanding the difference between passive auditing and active penetration testing is critical:

- **Non-Destructive Execution**: SiteSecura sends standard HTTP \`GET\` and \`HEAD\` requests alongside authoritative DNS queries. We never inject SQL payloads, submit arbitrary form data, attempt credential brute-forcing, or stress-test application endpoints.
- **Safe for Production Systems**: Because requests follow normal user traffic patterns, running a scan will not trigger rate-limiting exhaustion, corrupt database state, or impact end-user performance.
- **No Agent Installation Required**: Scans evaluate what public adversaries and search engine crawlers can see from the public internet. You do not need to install local software agents or daemon processes on your web servers.

---

## The 60-Second Scan Lifecycle

When you trigger a scan from the SiteSecura homepage or your verified domain dashboard, the request moves through four coordinated phases orchestrated by Celery background worker tasks:

\`\`\`
[1. Target Normalization] -> [2. Network & Safety Validation] -> [3. Parallel Audit Execution] -> [4. Scoring & Report Generation]
\`\`\`

### Phase 1: Target Normalization and URL Sanitization
The engine accepts raw hostnames (e.g. \`example.com\`) or fully qualified URLs (e.g. \`https://example.com/app\`). The system strips redundant path parameters, resolves the base domain target, and checks against RFC 6761 reserved names.

### Phase 2: SSRF and Safe-Network Validation
To protect internal infrastructure and prevent Server-Side Request Forgery (SSRF), SiteSecura validates the target IP addresses prior to initiating any transport handshake. The engine rejects:
- Loopback addresses (\`127.0.0.0/8\`, \`::1\`)
- Private RFC 1918 subnets (\`10.0.0.0/8\`, \`172.16.0.0/12\`, \`192.168.0.0/16\`)
- Link-local and cloud metadata endpoints (\`169.254.169.254\`, \`fe80::/10\`)

### Phase 3: Parallel Defensive Auditing
Once approved, the target is dispatched across four isolated scanning modules executed in parallel:
1. **SSL/TLS Handshake Module**: Negotiates cryptographic parameters, validates certificate trust chains, checks hostname matching (SAN), and reads expiration timestamps.
2. **HTTP Redirect & Transport Module**: Evaluates port 80 cleartext behavior, verifies permanent 301 redirection to HTTPS, and detects downgrade vulnerabilities.
3. **Defensive Response Headers Module**: Inspects mandatory response headers including HSTS, Content-Security-Policy, X-Frame-Options, and X-Content-Type-Options.
4. **Authoritative DNS & Email Module**: Queries public nameservers for SPF TXT records, DMARC policies, and DNSSEC signatures.

### Phase 4: Scoring and Plain-English Report Generation
Deduction penalties are applied to the baseline score (100 points), a final letter grade (A+ through F) is computed, and prioritized remediation recommendations are generated.

---

## Step-by-Step: Running Your First Scan

Follow this procedure to initiate your first audit:

1. **Navigate to the Scan Launcher**: Open the SiteSecura homepage or navigate to the [Website Security Checker](/tools/website-security-checker).
2. **Enter Your Public Target**: Type your domain (e.g., \`yourcompany.com\`) into the target input field. You do not need to include \`https://\` or URL query strings.
3. **Initiate the Audit**: Click **Run Security Scan**.
4. **Monitor Real-Time Progress**: The progress indicator displays the execution status across all four audit modules.
5. **Review the Security Grade and Report**: Upon completion, you will receive an overall numeric score (0–100), an executive risk tier, and an itemized breakdown of pass/fail findings.

---

## What a Scan Proves (and What It Does Not)

It is essential to understand the technical boundary of a passive perimeter audit:

> **Important Distinction**: A high SiteSecura score (e.g. 95/100, Grade A) proves that your public perimeter, encryption configurations, defensive response headers, and email authentication records are hardened against common opportunistic attacks. It does **not** prove that internal application logic, authenticated API endpoints, or database queries are free from zero-day vulnerabilities. Both perimeter hardening and secure software development lifecycle (SDLC) practices are essential.
`,
  },
  {
    slug: "understanding-security-scores",
    category: "getting-started",
    categoryTitle: "Getting Started",
    title: "Understanding SiteSecura Security Scores & Severity Grades",
    description: "Learn how SiteSecura calculates 0–100 security scores, assigns risk tiers, and calculates severity deductions.",
    summary: "Comprehensive mathematical breakdown of the SiteSecura scoring algorithm, penalty weights for Critical, High, Medium, and Low findings, and risk levels.",
    lastUpdated: "2026-03-22",
    readingTimeMinutes: 5,
    keywords: ["security score", "grading algorithm", "risk tiers", "severity weights", "deductions", "remediation priority"],
    published: true,
    relatedArticles: [
      { slug: "first-security-scan", category: "getting-started", title: "Running Your First Website Security Scan" },
      { slug: "http-security-headers", category: "security-checks", title: "Defensive HTTP Security Headers" },
      { slug: "ssl-tls-certificates", category: "security-checks", title: "SSL/TLS Certificate Validity & Expiration" },
    ],
    relatedTools: [
      { title: "Website Security Checker", href: "/tools/website-security-checker", badge: "Full Audit" },
      { title: "Security Headers Checker", href: "/tools/security-headers-checker", badge: "Header Test" },
    ],
    content: `## The SiteSecura Scoring Philosophy

Security metrics should be transparent, actionable, and mathematically deterministic. Many vulnerability scanners generate arbitrary "risk percentages" that leave systems administrators confused about how a specific score was derived.

SiteSecura uses a **deterministic deduction-based scoring formula**. Every scanned website begins with a perfect baseline score of **100 points**. As our scanning modules inspect your target, specific penalty deductions are subtracted based on verified security findings and their assigned severity levels.

---

## Severity Weights and Deduction Penalty Matrix

SiteSecura categorizes findings into five standardized severity levels:

| Severity Level | Point Deduction | Typical Findings | Remediation Urgency |
| :--- | :---: | :--- | :--- |
| **Critical** | **-30 points** | Expired SSL certificate, cleartext HTTP on port 80 without HTTPS redirection, self-signed certificate on public domain | Immediate (within 24 hours) |
| **High** | **-15 points** | Missing HSTS header, missing Content-Security-Policy (CSP), missing DMARC record, TLS 1.0 or 1.1 enabled | High priority (within 7 days) |
| **Medium** | **-5 points** | Missing X-Frame-Options (clickjacking), missing X-Content-Type-Options (\`nosniff\`), DMARC policy set to \`p=none\` | Standard sprint task |
| **Low** | **-2 points** | Suboptimal Referrer-Policy, missing Permissions-Policy, missing CAA DNS record, certificate expiring within 30 days | Best-practice hardening |
| **Informational** | **0 points** | Server banner disclosure, TLS 1.3 supported, valid SPF record found | Informational / No deduction |

### Scoring Floor and Multi-Finding Cap
- **Score Floor**: The minimum possible score is **0**. A score cannot be negative.
- **Independent Accumulation**: Each distinct security vulnerability applies its full deduction penalty. For example, a website with an expired SSL certificate (-30) and missing HSTS (-15) receives an initial deduction of 45 points, yielding a score of 55.

---

## Risk Tiers and Letter Grades

Based on the final computed numeric score, SiteSecura assigns a corresponding letter grade and executive risk classification:

### 1. Grade A+ / A (Score: 85–100) — Low Risk
- **Posture**: Excellent defensive posture. Transport encryption is modern (TLS 1.2+), HTTPS is strictly enforced with HSTS, comprehensive HTTP security headers are deployed, and email domain records (SPF, DMARC) prevent spoofing.
- **Action**: Maintain automated continuous monitoring to prevent configuration drift.

### 2. Grade B / C (Score: 70–84) — Medium Risk
- **Posture**: Adequate foundational encryption, but missing secondary defensive controls. Commonly caused by missing clickjacking headers, permissive DMARC policies (\`p=none\`), or absent MIME-sniffing protections.
- **Action**: Implement missing security headers in reverse proxy configurations.

### 3. Grade D (Score: 50–69) — High Risk
- **Posture**: Significant perimeter deficiencies. Multiple high-severity checks failed, such as absent HSTS, cleartext transmission windows, or legacy TLS protocol negotiation.
- **Action**: Prioritize transport layer enforcement and web server header directives.

### 4. Grade F (Score: < 50) — Critical Risk
- **Posture**: Immediate exploitation or browser warning hazard. The target has one or more Critical failures (e.g. invalid certificate, broken redirect chain, or complete absence of transport protection).
- **Action**: Immediate remediation required to prevent browser security warnings and data interception.

---

## Why Missing Headers Trigger Meaningful Deductions

A frequent question from site owners is: *"My website uses HTTPS; why did my score drop from 100 to 70?"*

Transport encryption (HTTPS) only encrypts data in transit between the client and server. It does **not** protect against:
1. **SSL Stripping**: Man-in-the-middle attackers downgrading the initial connection without HSTS.
2. **Clickjacking**: Malicious websites embedding your application in hidden iframes without \`X-Frame-Options\` or \`frame-ancestors\`.
3. **Cross-Site Scripting (XSS)**: Untrusted scripts executing in the context of the user's browser without a Content-Security-Policy.

By applying calibrated deductions for these defensive omissions, SiteSecura encourages comprehensive, defense-in-depth engineering.
`,
  },
  {
    slug: "adding-and-verifying-domains",
    category: "getting-started",
    categoryTitle: "Getting Started",
    title: "Adding and Verifying Domain Targets in SiteSecura",
    description: "How to register domain assets in your dashboard, configure DNS TXT or meta-tag verification, and unlock recurring audits.",
    summary: "Guide to registering web assets, verifying domain ownership for automated monitoring, and managing multi-tenant workspaces.",
    lastUpdated: "2026-03-18",
    readingTimeMinutes: 4,
    keywords: ["domain verification", "DNS TXT verification", "asset management", "scheduled monitoring", "multi-tenant"],
    published: true,
    relatedArticles: [
      { slug: "first-security-scan", category: "getting-started", title: "Running Your First Website Security Scan" },
      { slug: "scheduled-scans-and-alerts", category: "monitoring", title: "Automated Scheduled Scans & Alerts" },
      { slug: "team-roles-and-whitelabeling", category: "agency", title: "Agency White-Labeling & Team Roles" },
    ],
    relatedTools: [
      { title: "DNS Lookup Tool", href: "/tools/dns-lookup", badge: "DNS Check" },
      { title: "Website Security Checker", href: "/tools/website-security-checker", badge: "Scanner" },
    ],
    content: `## Why Domain Verification Matters

While anyone can run an ad-hoc public perimeter scan from the SiteSecura homepage, registering a domain within an authenticated workspace unlocks persistent capabilities:
- **Automated Scheduled Audits**: Weekly or daily background scans to catch regressions.
- **Historical Drift Tracking**: Comparative charts showing score changes over time.
- **SSL Certificate Expiration Alerts**: Automated early warning notifications 30, 14, and 7 days prior to certificate expiry.
- **Executive PDF Reports**: Downloadable white-label audit exports for executive leadership and compliance auditors.

To ensure that scheduled background monitoring and domain alert routing are authorized by legitimate asset owners, SiteSecura requires **Domain Ownership Verification**.

---

## Supported Verification Methods

SiteSecura supports three standard ownership verification workflows:

### Method 1: DNS TXT Record (Recommended)
This is the most reliable method for enterprise infrastructure, CDNs, and multi-region deployments.

1. In your SiteSecura dashboard, navigate to **Domains** > **Add Domain**.
2. Enter your domain name (e.g. \`example.com\`).
3. The dashboard generates a unique cryptographic verification token:
   \`\`\`
   sitesecura-site-verification=sec_vfy_9a8b7c6d5e4f3a2b1c
   \`\`\`
4. Open your DNS provider (e.g., Cloudflare, Route 53, Namecheap, GoDaddy).
5. Add a new **TXT** record at the root apex (\`@\`) or subdomain:
   - **Type**: \`TXT\`
   - **Name / Host**: \`@\` (or your specific subdomain)
   - **Value**: \`sitesecura-site-verification=sec_vfy_9a8b7c6d5e4f3a2b1c\`
   - **TTL**: \`Auto\` or \`300\`
6. Return to SiteSecura and click **Verify DNS Record**.

### Method 2: HTML Meta Tag
For content management systems (WordPress, Shopify, Webflow) where editing DNS records is restricted:

1. Copy the generated HTML verification meta tag:
   \`\`\`html
   <meta name="sitesecura-verification" content="sec_vfy_9a8b7c6d5e4f3a2b1c" />
   \`\`\`
2. Paste the tag into the \`<head>\` section of your homepage.
3. Save and publish your website changes.
4. Click **Verify Meta Tag** in the SiteSecura dashboard.

### Method 3: Well-Known File Upload
For static sites or custom application servers:

1. Create a plain-text file named \`sitesecura-verification.txt\` containing your verification token.
2. Upload the file to your root web server under:
   \`\`\`
   https://example.com/.well-known/sitesecura-verification.txt
   \`\`\`
3. Verify that the file returns an HTTP \`200 OK\` status code over HTTPS.
4. Click **Verify File** in the SiteSecura dashboard.

---

## Managing Multi-Tenant Workspaces

In SiteSecura, domains belong to specific **Workspaces**:
- **Personal Workspaces**: Best for single founders or small teams managing up to 5 properties.
- **Agency Workspaces**: Provide client grouping, custom branded PDF reports, and role-based access control (RBAC) across multiple team members.
`,
  },

  // ==========================================
  // SECURITY CHECKS CATALOG (5 Articles)
  // ==========================================
  {
    slug: "ssl-tls-certificates",
    category: "security-checks",
    categoryTitle: "Security Checks Catalog",
    title: "SSL/TLS Certificate Validity, Handshakes & Renewal Thresholds",
    description: "How SiteSecura audits cryptographic protocol negotiation (TLS 1.2/1.3), trust chains, SAN coverage, and certificate renewal windows.",
    summary: "Technical documentation on TLS handshake auditing, expiration warning thresholds (30, 14, 7 days), and web server configuration examples.",
    lastUpdated: "2026-03-24",
    readingTimeMinutes: 6,
    keywords: ["SSL", "TLS 1.3", "TLS 1.2", "certificate expiration", "SAN", "handshake", "cipher suites", "HTTPS"],
    published: true,
    relatedArticles: [
      { slug: "http-security-headers", category: "security-checks", title: "Defensive HTTP Security Headers" },
      { slug: "content-security-policy", category: "security-checks", title: "Content Security Policy (CSP)" },
      { slug: "scheduled-scans-and-alerts", category: "monitoring", title: "Automated Scheduled Scans & Alerts" },
    ],
    relatedTools: [
      { title: "SSL/TLS Certificate Checker", href: "/tools/ssl-checker", badge: "Standalone Tool" },
      { title: "HTTP Status & Redirect Checker", href: "/tools/http-status-checker", badge: "Redirect Test" },
    ],
    content: `## Overview of the SSL/TLS Handshake Check

Transport Layer Security (TLS) is the fundamental protocol securing all modern internet communication. Without valid, properly configured TLS certificates, browser sessions are vulnerable to man-in-the-middle (MITM) eavesdropping, cleartext packet sniffing, and credential theft.

SiteSecura's TLS scanning module performs real-time cryptographic handshakes against port 443 of your target domain to evaluate protocol support, certificate authenticity, host matching, and remaining validity lifespan.

---

## What SiteSecura Checks

Our scanning engine evaluates the following cryptographic parameters during every audit:

### 1. Protocol Negotiation (TLS Versions)
- **TLS 1.3 & TLS 1.2**: **PASS**. Both protocols provide robust modern cipher suites and forward secrecy.
- **TLS 1.0 & TLS 1.1**: **FAIL (High Severity, -15 pts)**. Both versions are formally deprecated by RFC 8996 due to fundamental cryptographic vulnerabilities (e.g., POODLE, BEAST, weak CBC ciphers).
- **SSL 2.0 & SSL 3.0**: **FAIL (Critical Severity, -30 pts)**. Insecure legacy protocols.

### 2. Certificate Validity & Expiration Countdown
The engine parses the certificate's \`notBefore\` and \`notAfter\` timestamps:
- **Expired Certificate**: **FAIL (Critical Severity, -30 pts)**. Immediately triggers major browser warnings (e.g., \`NET::ERR_CERT_DATE_INVALID\`).
- **Expiring in $\\le$ 7 Days**: **WARNING (Medium Severity, -5 pts)**. Critical renewal window.
- **Expiring in $\\le$ 14 Days**: **WARNING (Low Severity, -2 pts)**. Escalated renewal warning.
- **Expiring in $\\le$ 30 Days**: **INFO (0 pts)**. Proactive renewal notice.

### 3. Subject Alternative Name (SAN) Host Matching
The certificate must explicitly cover the requested hostname:
- **Exact Match or Wildcard**: **PASS** (e.g. \`example.com\` matches \`example.com\` or \`*.example.com\`).
- **Mismatch**: **FAIL (Critical Severity, -30 pts)**. Triggers browser warning \`SSL_ERROR_BAD_CERT_DOMAIN\`.

### 4. Certificate Authority (CA) Chain of Trust
The certificate must be signed by a recognized root certificate authority in the standard Mozilla/NSS trust store. Self-signed certificates on public endpoints fail validation.

---

## Web Server Configuration Hardening

To ensure your web server only negotiates modern TLS protocols and strong cipher suites, apply the following configurations:

### Nginx Configuration
Edit your server block (typically in \`/etc/nginx/sites-available/default\`):

\`\`\`nginx
server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # Enforce TLS 1.2 and 1.3 only
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    # Modern forward-secret cipher suites
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;

    # Session caching
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;
}
\`\`\`

### Apache Configuration
Edit your VirtualHost configuration (typically in \`/etc/apache2/sites-available/default-ssl.conf\`):

\`\`\`apache
<VirtualHost *:443>
    ServerName example.com
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/example.com/cert.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/example.com/privkey.pem
    SSLCertificateChainFile /etc/letsencrypt/live/example.com/chain.pem

    # Disable legacy SSL and TLS 1.0/1.1
    SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1

    # Enforce strong ciphers
    SSLCipherSuite HIGH:!aNULL:!MD5:!3DES:!CAMELLIA:!SRP:!PSK
    SSLHonorCipherOrder on
</VirtualHost>
\`\`\`

### Caddy (Automatic HTTPS)
Caddy automatically manages certificates and enforces TLS 1.2/1.3 by default:

\`\`\`caddy
example.com {
    tls {
        protocols tls1.2 tls1.3
    }
    reverse_proxy localhost:8080
}
\`\`\`

---

## Verifying Your TLS Configuration

After reloading your web server configuration, test your endpoint immediately using SiteSecura's free standalone [SSL/TLS Certificate Checker](/tools/ssl-checker). The tool performs an immediate handshake and returns the active protocol versions, cipher suite, issuer authority, and days until expiration.
`,
  },
  {
    slug: "http-security-headers",
    category: "security-checks",
    categoryTitle: "Security Checks Catalog",
    title: "Defensive HTTP Security Headers Configuration Guide",
    description: "Configure Strict-Transport-Security (HSTS), X-Content-Type-Options, X-Frame-Options, and Referrer-Policy to harden web servers.",
    summary: "Complete technical specification on defensive response headers evaluated by SiteSecura, risk severity ratings, and server directives.",
    lastUpdated: "2026-03-25",
    readingTimeMinutes: 6,
    keywords: ["security headers", "HSTS", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "clickjacking", "nosniff"],
    published: true,
    relatedArticles: [
      { slug: "content-security-policy", category: "security-checks", title: "Content Security Policy (CSP)" },
      { slug: "cookie-security-flags", category: "security-checks", title: "Cookie Security Flags" },
      { slug: "understanding-security-scores", category: "getting-started", title: "Understanding Security Scores" },
    ],
    relatedTools: [
      { title: "Security Headers Checker", href: "/tools/security-headers-checker", badge: "Header Tool" },
      { title: "HTTP Status & Redirect Checker", href: "/tools/http-status-checker", badge: "Status Check" },
    ],
    content: `## Overview of Defensive HTTP Response Headers

When a browser loads a web page, the web server returns HTTP response headers alongside the HTML content. These headers act as security instructions for the client's browser, dictating what resources can be executed, how connections must be encrypted, and whether the site can be embedded in third-party frames.

Without defensive response headers, browsers default to permissive legacy behaviors, leaving visitors vulnerable to **SSL stripping**, **clickjacking**, **MIME-sniffing exploits**, and **referrer data leakage**.

---

## Key Headers Evaluated by SiteSecura

SiteSecura's scanner inspects the presence, syntax, and directive strength of the following defensive headers:

### 1. Strict-Transport-Security (HSTS)
- **Purpose**: Instructs browsers that the domain must **only** be accessed via HTTPS, automatically upgrading all \`http://\` links and blocking users from clicking through SSL warning bypasses.
- **Evaluation**:
  - **Pass**: Header present with \`max-age\` of at least 15,552,000 seconds (180 days).
  - **Fail (High Severity, -15 pts)**: Missing header.
  - **Warning (Low Severity, -2 pts)**: \`max-age\` is less than 6 months.
- **Recommended Directive**:
  \`\`\`http
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  \`\`\`

### 2. X-Frame-Options (Clickjacking Protection)
- **Purpose**: Prevents malicious third-party websites from loading your page inside a hidden \`<iframe>\`, an attack known as Clickjacking (UI redressing).
- **Evaluation**:
  - **Pass**: Set to \`DENY\` (blocks all iframe embedding) or \`SAMEORIGIN\` (permits embedding only by the same origin).
  - **Fail (High Severity, -15 pts)**: Missing header (or frame-ancestors directive in CSP).
- **Recommended Directive**:
  \`\`\`http
  X-Frame-Options: SAMEORIGIN
  \`\`\`

### 3. X-Content-Type-Options (MIME Sniffing Prevention)
- **Purpose**: Prevents browsers from guessing (sniffing) the MIME type of a response when the declared \`Content-Type\` header differs from the content, stopping malicious user uploads (e.g. an image containing executable JavaScript) from running as scripts.
- **Evaluation**:
  - **Pass**: Set to \`nosniff\`.
  - **Fail (Medium Severity, -5 pts)**: Missing header.
- **Recommended Directive**:
  \`\`\`http
  X-Content-Type-Options: nosniff
  \`\`\`

### 4. Referrer-Policy
- **Purpose**: Governs how much referrer information (the URL of the current page) is transmitted in the \`Referer\` header when navigating to other domains.
- **Evaluation**:
  - **Pass**: Set to \`strict-origin-when-cross-origin\` or \`no-referrer\`.
  - **Warning (Low Severity, -2 pts)**: Unrestricted referrer (\`unsafe-url\`).
- **Recommended Directive**:
  \`\`\`http
  Referrer-Policy: strict-origin-when-cross-origin
  \`\`\`

### 5. Permissions-Policy
- **Purpose**: Restricts browser features and hardware APIs (e.g., camera, microphone, geolocation) from being accessed by scripts or embedded iframes.
- **Recommended Directive**:
  \`\`\`http
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  \`\`\`

---

## Server Configuration Examples

### Nginx Configuration
Add these directives inside your \`server { ... }\` block in Nginx:

\`\`\`nginx
# Defensive Security Headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
\`\`\`

### Apache Configuration
Ensure \`mod_headers\` is enabled (\`sudo a2enmod headers\`) and add to your \`.htaccess\` or VirtualHost:

\`\`\`apache
<IfModule mod_headers.c>
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
</IfModule>
\`\`\`

### Cloudflare Transform Rules
If your website is proxied through Cloudflare, you can inject these headers at the edge without modifying origin server files:
1. Navigate to **Rules** > **Transform Rules** in the Cloudflare dashboard.
2. Under **Modify Response Header**, add rules for \`Strict-Transport-Security\`, \`X-Frame-Options\`, and \`X-Content-Type-Options\`.

---

## Verifying Your Changes

After deploying these headers, run a targeted scan with the [Security Headers Checker](/tools/security-headers-checker). The tool provides instant verification of each header's presence, syntax, and security value.
`,
  },
  {
    slug: "content-security-policy",
    category: "security-checks",
    categoryTitle: "Security Checks Catalog",
    title: "Content Security Policy (CSP) Directives & XSS Mitigation",
    description: "How SiteSecura inspects Content-Security-Policy headers, evaluates directive strengths, and detects dangerous bypass tokens.",
    summary: "Technical guide to auditing CSP directives, eliminating 'unsafe-inline' and 'unsafe-eval', deploying report-only mode, and establishing defense-in-depth.",
    lastUpdated: "2026-03-26",
    readingTimeMinutes: 7,
    keywords: ["CSP", "Content Security Policy", "XSS", "unsafe-inline", "unsafe-eval", "script-src", "frame-ancestors"],
    published: true,
    relatedArticles: [
      { slug: "http-security-headers", category: "security-checks", title: "Defensive HTTP Security Headers" },
      { slug: "cookie-security-flags", category: "security-checks", title: "Cookie Security Flags" },
      { slug: "first-security-scan", category: "getting-started", title: "Running Your First Website Security Scan" },
    ],
    relatedTools: [
      { title: "CSP Policy Analyzer", href: "/tools/csp-policy-analyzer", badge: "Policy Tool" },
      { title: "Security Headers Checker", href: "/tools/security-headers-checker", badge: "Header Test" },
    ],
    content: `## What is a Content Security Policy?

Content Security Policy (CSP) is an HTTP response header that restricts the sources from which browsers can load and execute scripts, stylesheets, images, fonts, media, and object plugins. It is recognized by modern web security standards as the single most effective defense-in-depth mechanism against **Cross-Site Scripting (XSS)** and **data injection attacks**.

Even if an attacker finds a flaw in your input sanitization, a well-formed CSP prevents unauthorized inline scripts from executing and blocks outgoing data exfiltration to attacker-controlled origins.

---

## What SiteSecura's CSP Analyzer Audits

SiteSecura parses the \`Content-Security-Policy\` header and checks for the following vulnerabilities:

### 1. Missing CSP Header
- **Impact**: **FAIL (High Severity, -15 pts)**. Without a CSP, the browser will execute any inline script or load assets from any external domain.

### 2. Presence of \`'unsafe-inline'\` in \`script-src\`
- **Impact**: **WARNING (High Severity)**. The \`'unsafe-inline'\` token disables the primary protection of CSP by allowing inline \`<script>\` blocks and inline event handlers (e.g. \`onclick\`) to execute without validation.
- **Remediation**: Transition to cryptographic nonces (e.g., \`'nonce-rAnd0m'\`) or SHA-256 hashes for legitimate inline scripts.

### 3. Presence of \`'unsafe-eval'\` in \`script-src\`
- **Impact**: **WARNING (Medium Severity)**. Allows strings to be executed as code via JavaScript's \`eval()\`, \`setTimeout("code")\`, and \`Function()\`, a frequent exploitation path for complex client-side injections.

### 4. Overly Permissive Wildcards (\`*\`)
- **Impact**: **WARNING (Medium Severity)**. Setting \`script-src *\` or \`default-src *\` permits assets to load from any domain on the internet, effectively nullifying the whitelist.

### 5. Missing \`object-src 'none'\`
- **Impact**: **WARNING (Low Severity)**. Flash, Java applets, and ActiveX controls are legacy attack vectors. If \`object-src\` is omitted, it falls back to \`default-src\`. It should be explicitly restricted to \`'none'\`.

### 6. Modern Clickjacking Defense (\`frame-ancestors\`)
- **Impact**: Replaces the older \`X-Frame-Options\` header with granular origin whitelisting:
  \`\`\`http
  frame-ancestors 'self' https://trusted-partner.com;
  \`\`\`

---

## Phased CSP Rollout Strategy

Deploying a strict CSP on an existing website can break analytics scripts, marketing tags, or custom UI elements if configured hastily. SiteSecura recommends a **three-phase rollout**:

### Phase 1: Audit with Report-Only Mode
Deploy the policy using the \`Content-Security-Policy-Report-Only\` header. The browser will **not** block any resources, but will send violation reports to your specified endpoint:

\`\`\`http
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' https://trusted-cdn.com; report-uri /api/csp-report;
\`\`\`

### Phase 2: Refactor Inline Scripts
Audit violation reports and remove hardcoded inline event handlers. For required inline scripts, generate server-side nonces:

\`\`\`html
<!-- Server generates unique cryptographically random nonce per request -->
<script nonce="EDNnf03nceIOfn39fn3e9h3sdfa">
  console.log("Authorized inline script");
</script>
\`\`\`

### Phase 3: Enforce the Policy
Once report-only violations drop to zero, switch the header from \`Content-Security-Policy-Report-Only\` to the enforcing \`Content-Security-Policy\` header.

---

## Production Configuration Example

A hardened, modern baseline CSP suitable for modern web applications:

\`\`\`http
Content-Security-Policy: default-src 'self'; script-src 'self' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self';
\`\`\`

### Nginx Implementation:
\`\`\`nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';" always;
\`\`\`

---

## Testing Your CSP

Paste your active or proposed policy into the SiteSecura [CSP Policy Analyzer](/tools/csp-policy-analyzer). The analyzer provides instant directive-by-directive evaluation, highlighting high-risk bypasses, missing directives, and deprecation notices.
`,
  },
  {
    slug: "dns-and-email-security",
    category: "security-checks",
    categoryTitle: "Security Checks Catalog",
    title: "DNS Email Authentication: SPF Records & DMARC Enforcement",
    description: "Protect your domain against spoofing and phishing with authoritative SPF TXT records, DKIM key alignment, and DMARC policies.",
    summary: "Technical documentation on how SiteSecura queries DNS records to evaluate email authentication, policy strengths (none, quarantine, reject), and DNSSEC.",
    lastUpdated: "2026-03-27",
    readingTimeMinutes: 6,
    keywords: ["SPF", "DMARC", "DKIM", "email security", "DNS", "spoofing", "phishing", "DNSSEC"],
    published: true,
    relatedArticles: [
      { slug: "first-security-scan", category: "getting-started", title: "Running Your First Website Security Scan" },
      { slug: "http-security-headers", category: "security-checks", title: "Defensive HTTP Security Headers" },
      { slug: "scheduled-scans-and-alerts", category: "monitoring", title: "Automated Scheduled Scans & Alerts" },
    ],
    relatedTools: [
      { title: "Email Security Checker (SPF/DMARC)", href: "/tools/email-security-checker", badge: "Email Tool" },
      { title: "DNS Lookup Tool", href: "/tools/dns-lookup", badge: "DNS Records" },
    ],
    content: `## Why Domain Email Security Matters

The Simple Mail Transfer Protocol (SMTP) was designed in 1982 without built-in identity verification. By default, any mail server on the internet can send messages claiming to originate from \`ceo@yourcompany.com\` or \`billing@yourdomain.com\`.

Attackers routinely exploit this architectural flaw to launch **business email compromise (BEC)** attacks, executive impersonation, and credential phishing against your customers and employees.

To protect your brand reputation, modern mail receivers (including Google, Microsoft 365, and Yahoo) require domains to publish authoritative **SPF**, **DKIM**, and **DMARC** DNS records.

---

## What SiteSecura Checks

SiteSecura's DNS scanning module queries authoritative nameservers for three critical email security controls:

### 1. Sender Policy Framework (SPF)
- **What it does**: A DNS \`TXT\` record that explicitly enumerates which IP addresses and third-party mail providers (e.g. Google Workspace, SendGrid) are authorized to send mail on behalf of your domain.
- **Evaluation**:
  - **Pass**: Valid record starting with \`v=spf1\` ending with a hard fail (\`-all\`) or soft fail (\`~all\`).
  - **Warning**: Overly permissive record ending with neutral (\`?all\`) or pass (\`+all\`).
  - **Fail (High Severity, -15 pts)**: Missing SPF record or multiple conflicting SPF records (RFC 7208 violation).

### 2. DMARC (Domain-based Message Authentication)
- **What it does**: Published as a \`TXT\` record at \`_dmarc.yourdomain.com\`. Tells receiving mail servers what to do if an incoming email fails SPF or DKIM checks, and specifies where to send forensic failure reports.
- **Evaluation**:
  - **Pass (Enforced)**: \`p=reject\` (unauthorized mail is discarded) or \`p=quarantine\` (unauthorized mail is sent to spam).
  - **Warning (Medium Severity, -5 pts)**: \`p=none\` (monitoring mode only; does not protect against spoofing).
  - **Fail (High Severity, -15 pts)**: Missing DMARC record.

### 3. DNSSEC (DNS Security Extensions)
- **What it does**: Cryptographically signs DNS zone records to prevent DNS cache poisoning and man-in-the-middle DNS spoofing.
- **Evaluation**: SiteSecura verifies whether \`DS\` records exist at the parent registry.

---

## Step-by-Step Configuration Guide

### 1. Creating Your SPF Record
Add a \`TXT\` record at your root domain:
- **Host**: \`@\` (or blank)
- **Type**: \`TXT\`
- **Value**:
  \`\`\`
  v=spf1 include:_spf.google.com include:sendgrid.net -all
  \`\`\`
> **Warning**: Never publish more than one SPF record on a single domain. Combine all authorized mail senders into a single \`TXT\` entry.

### 2. Creating Your DMARC Record
Add a \`TXT\` record at the \`_dmarc\` subdomain:
- **Host**: \`_dmarc\` (or \`_dmarc.yourdomain.com\`)
- **Type**: \`TXT\`
- **Initial Monitoring Mode** (Phase 1):
  \`\`\`
  v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com; sp=none;
  \`\`\`
- **Enforcing Policy** (Phase 2 — Recommended):
  \`\`\`
  v=DMARC1; p=reject; rua=mailto:dmarc-reports@yourdomain.com; aspf=r;
  \`\`\`

---

## Verifying Your DNS Records

Test your DNS and email authentication setup using SiteSecura's free tools:
- Use the [Email Security Checker](/tools/email-security-checker) to validate SPF syntax, DMARC policy strength, and alignment.
- Use the [DNS Lookup Tool](/tools/dns-lookup) to inspect real-time authoritative \`TXT\`, \`MX\`, and \`SOA\` records directly from upstream nameservers.
`,
  },
  {
    slug: "cookie-security-flags",
    category: "security-checks",
    categoryTitle: "Security Checks Catalog",
    title: "Cookie Security Attributes: Secure, HttpOnly & SameSite Flags",
    description: "Audit and enforce Secure, HttpOnly, and SameSite attributes on HTTP cookies to prevent session hijacking and cross-site request forgery.",
    summary: "Guidance on cookie security flags inspected by SiteSecura, attack vectors (XSS theft, packet sniffing, CSRF), and server configurations.",
    lastUpdated: "2026-03-28",
    readingTimeMinutes: 5,
    keywords: ["cookies", "HttpOnly", "Secure flag", "SameSite", "CSRF", "session hijacking", "Set-Cookie"],
    published: true,
    relatedArticles: [
      { slug: "http-security-headers", category: "security-checks", title: "Defensive HTTP Security Headers" },
      { slug: "content-security-policy", category: "security-checks", title: "Content Security Policy (CSP)" },
      { slug: "understanding-security-scores", category: "getting-started", title: "Understanding Security Scores" },
    ],
    relatedTools: [
      { title: "Security Headers Checker", href: "/tools/security-headers-checker", badge: "Header Test" },
      { title: "Website Security Checker", href: "/tools/website-security-checker", badge: "Full Audit" },
    ],
    content: `## Overview of Cookie Security Attributes

HTTP cookies are the primary mechanism used by web applications to maintain session state, authenticate users, and store user preferences. Because authentication cookies represent the user's active session, capturing or tampering with them allows attackers to **hijack accounts without knowing the user's password**.

SiteSecura's scanner inspects all \`Set-Cookie\` response headers returned by your web application and verifies whether three essential defensive attributes are present: **Secure**, **HttpOnly**, and **SameSite**.

---

## The Three Core Cookie Security Flags

### 1. The \`Secure\` Attribute
- **Risk Without It**: Cleartext transmission over unencrypted HTTP connections. If a user connects to a public Wi-Fi network and types \`http://yourdomain.com\`, the browser transmits the cookie in plaintext before any HTTPS redirect occurs.
- **Defense**: Tells the browser that the cookie must **only** be transmitted over encrypted HTTPS connections.
- **Evaluation**: Any session cookie missing the \`Secure\` flag triggers a **Medium Severity (-5 pts)** deduction.

### 2. The \`HttpOnly\` Attribute
- **Risk Without It**: Client-side JavaScript theft via Cross-Site Scripting (XSS). If an attacker finds a script injection flaw on your website, they can execute \`document.cookie\` and exfiltrate the session token to a remote server.
- **Defense**: Blocks client-side scripts from reading or writing to the cookie via the DOM. The cookie remains available for HTTP requests but is inaccessible to JavaScript.
- **Evaluation**: Any session cookie missing \`HttpOnly\` triggers a **Medium Severity (-5 pts)** deduction.

### 3. The \`SameSite\` Attribute
- **Risk Without It**: Cross-Site Request Forgery (CSRF). Malicious websites can force the victim's browser to submit authenticated requests (such as transferring funds or changing an email address) to your domain.
- **Defense**: Controls whether cookies are sent along with cross-site requests.
- **Supported Values**:
  - \`SameSite=Strict\`: Highest protection. The cookie is never sent with cross-site requests (even when clicking a regular external link).
  - \`SameSite=Lax\`: Recommended default. The cookie is withheld on cross-site subrequests (images, iframes), but sent when the user navigates top-level links.
  - \`SameSite=None\`: Requires the \`Secure\` flag. Allows third-party cross-origin transmission.

---

## Implementation Examples

### Standard HTTP \`Set-Cookie\` Header:
\`\`\`http
Set-Cookie: session_id=abc123xyz789; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=86400
\`\`\`

### Node.js / Express Example:
\`\`\`javascript
app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: {
    secure: true,      // Requires HTTPS
    httpOnly: true,    // Inaccessible to JS document.cookie
    sameSite: 'lax',   // CSRF defense
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
\`\`\`

### Python / FastAPI Example:
\`\`\`python
from fastapi import Response

@app.post("/login")
def login(response: Response):
    response.set_cookie(
        key="session_token",
        value="secure_token_abc123",
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=86400
    )
    return {"status": "authenticated"}
\`\`\`

### Nginx Proxy Cookie Flags:
If your backend application is proxied behind Nginx, you can instruct Nginx to automatically enforce these flags on all upstream \`Set-Cookie\` headers:

\`\`\`nginx
# Automatically append Secure, HttpOnly, and SameSite
proxy_cookie_flags ~* secure httponly samesite=lax;
\`\`\`
`,
  },

  // ==========================================
  // MONITORING & ALERTS (1 Article)
  // ==========================================
  {
    slug: "scheduled-scans-and-alerts",
    category: "monitoring",
    categoryTitle: "Automated Monitoring & Alerts",
    title: "Automated Scheduled Scans & Security Regression Alerts",
    description: "Configure automated recurring audits, monitor SSL certificate expiration, and receive alerts when security scores drop.",
    summary: "Operational guide to setting up automated weekly or daily audits, change detection between scan runs, and notification preferences.",
    lastUpdated: "2026-03-22",
    readingTimeMinutes: 5,
    keywords: ["scheduled scans", "monitoring", "score alerts", "SSL expiration alerts", "regression detection", "celery scheduler"],
    published: true,
    relatedArticles: [
      { slug: "first-security-scan", category: "getting-started", title: "Running Your First Website Security Scan" },
      { slug: "ssl-tls-certificates", category: "security-checks", title: "SSL/TLS Certificate Validity & Expiration" },
      { slug: "team-roles-and-whitelabeling", category: "agency", title: "Agency White-Labeling & Team Roles" },
    ],
    relatedTools: [
      { title: "Website Security Checker", href: "/tools/website-security-checker", badge: "Run Scan" },
      { title: "SSL/TLS Certificate Checker", href: "/tools/ssl-checker", badge: "Cert Test" },
    ],
    content: `## The Problem of Configuration Drift

A website may achieve a perfect 100/100 security score today, but configuration drift can degrade that posture overnight:
- An engineer modifies an Nginx reverse-proxy configuration and accidentally removes the \`Strict-Transport-Security\` header.
- A TLS certificate renewal cron job fails silently, leaving a certificate with only 48 hours of validity.
- A marketing team alters DNS records to integrate a new mailing service and overwrites your DMARC or SPF policy.

SiteSecura solves this through **Automated Continuous Monitoring**.

---

## Scan Frequencies and Tier Allocation

Scheduled scans run as background jobs managed by our Celery task worker pipeline:

| Plan Tier | Scan Frequency | Notification Channels | Scope |
| :--- | :--- | :--- | :--- |
| **Free / Starter** | Ad-hoc manual scans | Email on manual completion | 1 domain |
| **Pro** | **Weekly automated scans** | Immediate email on score drop | Up to 5 verified domains |
| **Agency** | **Daily automated scans** | Real-time webhook & team email alerts | Unlimited client domains |

---

## Automated Alert Triggers

SiteSecura monitors two primary threat conditions across all registered domains:

### 1. SSL/TLS Certificate Expiration Alerts
Certificate outages cause severe browser warning screens and immediately destroy user trust. SiteSecura sends automated warning notifications at three critical thresholds:
- **30-Day Warning**: First proactive notification advising your team to verify automated renewal hooks (e.g. Certbot, AWS ACM).
- **14-Day Warning**: Escalated notification indicating renewal has not completed.
- **7-Day Urgent Alert**: High-priority alert sent to all workspace administrators.

### 2. Security Score Drop & Regression Notifications
Whenever a scheduled audit runs, the engine compares the newly computed score against your domain's historical baseline:
- If a new Critical or High finding is discovered (e.g., an HSTS header disappeared, or TLS 1.0 was enabled), SiteSecura triggers an immediate **Security Regression Notification**.
- The email notification itemizes the exact delta, explaining which header or setting changed and providing actionable remediation steps.

---

## Configuring Notification Preferences

To configure notification settings for your workspace:
1. Log in to your SiteSecura dashboard and select **Settings** > **Notifications**.
2. Set your primary security alert email address (or distribution list).
3. Toggle alert thresholds:
   - *Notify on any score decrease* (recommended for staging and mission-critical production).
   - *Notify only on Critical/High severity changes*.
4. Click **Save Alert Preferences**.
`,
  },

  // ==========================================
  // AGENCY & WHITE-LABELING (1 Article)
  // ==========================================
  {
    slug: "team-roles-and-whitelabeling",
    category: "agency",
    categoryTitle: "Agency & White-Labeling",
    title: "Agency White-Labeling, Team Permissions & PDF Reports",
    description: "Configure agency brand identity, customize PDF security reports with your logo and palette, manage RBAC seats, and import bulk domains.",
    summary: "Technical walkthrough of SiteSecura's agency capabilities: custom logo and hex color styling, RBAC permissions (Owner, Admin, Member, Viewer), and CSV bulk import.",
    lastUpdated: "2026-03-20",
    readingTimeMinutes: 5,
    keywords: ["white-label", "agency", "PDF reports", "RBAC", "team permissions", "bulk domain import", "client management"],
    published: true,
    relatedArticles: [
      { slug: "adding-and-verifying-domains", category: "getting-started", title: "Adding and Verifying Domain Targets" },
      { slug: "scheduled-scans-and-alerts", category: "monitoring", title: "Automated Scheduled Scans & Alerts" },
      { slug: "understanding-security-scores", category: "getting-started", title: "Understanding Security Scores" },
    ],
    relatedTools: [
      { title: "Website Security Checker", href: "/tools/website-security-checker", badge: "Scanner" },
      { title: "DNS Lookup Tool", href: "/tools/dns-lookup", badge: "DNS Tool" },
    ],
    content: `## Purpose of the Agency Tier

Web development agencies, managed service providers (MSPs), and IT consultants manage dozens of client websites simultaneously. For these organizations, providing regular security assurance audits is both a compliance requirement and an ongoing value-add service.

SiteSecura's Agency tier equips teams to deliver professional, branded security reports without exposing the underlying SaaS tooling.

---

## Role-Based Access Control (RBAC) Permissions

To maintain organizational security and enforce the principle of least privilege, SiteSecura workspaces implement a four-tier permission model grounded in our core authorization architecture:

| Workspace Role | Permissions and Capabilities | Recommended Assignment |
| :--- | :--- | :--- |
| **Owner** | Full workspace authority: manage Stripe billing, invite/remove team members, delete workspace, configure white-label branding, full domain access. | Agency Founder / Lead Partner |
| **Admin** | Add/verify client domains, initiate and schedule scans, edit white-label settings, manage client groups. | Senior Technical Director / DevOps Lead |
| **Member** | Trigger ad-hoc scans on existing domains, view reports, download PDF audits, re-run verifications. | Web Developers / QA Engineers |
| **Viewer** | Read-only access to scan reports, historical score charts, and findings. Cannot trigger scans or alter configuration. | Account Managers / Client Representatives |

---

## White-Label Branding Configuration

Agency workspaces can replace all SiteSecura branding in exported audit materials:

### 1. Custom Agency Logo
- Upload a high-resolution PNG or SVG logo (recommended dimensions: \`400x100px\`).
- Your agency logo appears in the primary header of all exported PDF audit reports and shared client dashboards.

### 2. Custom Brand Color Palette
- Configure your primary brand hex color (e.g. \`#087fe8\` or \`#10b981\`).
- The PDF generator styles headings, score gauges, risk badges, and divider lines using your brand palette.

### 3. Custom Report Header & Disclaimers
- Customize the audit report cover page, including:
  - Custom subtitle (e.g. *"Prepared for Acme Corporation by Apex Digital Agency"*).
  - Custom advisory disclaimer and support contact URL.

---

## Bulk Domain Import via CSV

When onboarding an agency client with multiple digital properties, manually adding domains is inefficient. The agency dashboard provides structured CSV bulk import:

### CSV File Format:
Prepare a standard comma-separated file named \`domains.csv\`:

\`\`\`csv
domain,client_name,tags
example.com,Acme Corp,production;ecommerce
app.example.com,Acme Corp,production;portal
blog.example.com,Acme Corp,marketing;wordpress
\`\`\`

### Upload Procedure:
1. Navigate to **Domains** in your agency workspace.
2. Click **Import CSV**.
3. Select your \`domains.csv\` file.
4. SiteSecura validates each domain name against RFC syntax standards and queues verification tokens for all imported targets.
`,
  },
];

/**
 * Returns all published documentation articles.
 */
export function getAllArticles(): DocArticle[] {
  return DOC_ARTICLES.filter((a) => a.published);
}

/**
 * Finds an article by category and slug, handling canonical and aliased categories.
 */
export function getArticle(category: string, slug: string): DocArticle | null {
  const normCat = normalizeCategorySlug(category);
  const found = DOC_ARTICLES.find(
    (a) => a.published && a.category === normCat && a.slug.toLowerCase() === slug.toLowerCase()
  );
  return found || null;
}

/**
 * Returns all published articles for a given category.
 */
export function getArticlesByCategory(category: string): DocArticle[] {
  const normCat = normalizeCategorySlug(category);
  return DOC_ARTICLES.filter((a) => a.published && a.category === normCat);
}

/**
 * Returns previous and next article navigation links within the published catalog.
 */
export function getPrevNextArticles(
  category: string,
  slug: string
): { prev: DocArticle | null; next: DocArticle | null } {
  const all = getAllArticles();
  const currentIndex = all.findIndex(
    (a) => a.category === normalizeCategorySlug(category) && a.slug.toLowerCase() === slug.toLowerCase()
  );

  if (currentIndex === -1) {
    return { prev: null, next: null };
  }

  const prev = currentIndex > 0 ? all[currentIndex - 1] : null;
  const next = currentIndex < all.length - 1 ? all[currentIndex + 1] : null;

  return { prev, next };
}
