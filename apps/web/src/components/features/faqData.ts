export interface FeatureFaqItem {
  question: string;
  answer: string;
}

export const FEATURES_PAGE_FAQS: FeatureFaqItem[] = [
  {
    question: "What does SiteSecura check during a website scan?",
    answer:
      "SiteSecura evaluates core defensive web postures: SSL/TLS certificate validity & expiration, HTTPS enforcement & redirection, email authentication (SPF, DMARC, DNSSEC), HTTP security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), cookie security flags (Secure, HttpOnly, SameSite), and server software disclosures.",
  },
  {
    question: "How does SiteSecura calculate the deterministic security score?",
    answer:
      "SiteSecura uses a deterministic scoring engine starting at a base of 100 points. Verified issues apply exact deductions across 5 weighted categories: HTTPS & SSL (30 pts), Security Headers (25 pts), DNS & Email Authentication (20 pts), Server Hygiene (15 pts), and Cookie Security (10 pts). Final scores map strictly to risk levels: Excellent (90–100), Good (75–89), Medium Risk (60–74), High Risk (40–59), and Critical Risk (0–39).",
  },
  {
    question: "Does SiteSecura modify or send exploit payloads to my website?",
    answer:
      "Never. SiteSecura performs strictly non-intrusive, read-only passive inspections. We query public DNS records, inspect SSL certificates, and analyze standard HTTP response headers. We do not inject malicious payloads, perform denial-of-service tests, or alter your server configuration in any way.",
  },
  {
    question: "Does SiteSecura scan email inboxes or protect against spam emails?",
    answer:
      "No. SiteSecura checks public DNS-level authentication records (SPF TXT records, DMARC policy records at _dmarc.<domain>, and DNSSEC cryptographic signing) to ensure your domain is configured to prevent unauthorized spoofing of your sender identity. SiteSecura does not read inboxes, monitor email traffic, filter spam, or scan email attachments.",
  },
  {
    question: "How long does a website security scan take?",
    answer:
      "A standard perimeter scan typically completes in 5 to 15 seconds, depending on upstream DNS resolution and your web server's response latency. Deep Scans (multi-page crawlers available on Pro and Agency plans) crawl multiple internal pages and take longer depending on total page count and configured crawl depth.",
  },
  {
    question: "What is the difference between a Normal Scan and a Deep Scan?",
    answer:
      "A Normal Scan performs an immediate perimeter audit of public DNS, SSL/TLS certificates, security headers, and cookie flags for your primary domain URL in ~15 seconds. A Deep Scan (available on Pro and Agency plans) crawls multiple internal pages (up to 50 pages on Pro, 100 on Agency) to uncover multi-page asset disclosures, subdomains, frontend dependency disclosures, and correlated risk intelligence.",
  },
  {
    question: "How does automated website monitoring work?",
    answer:
      "When you add a domain to your dashboard, SiteSecura executes scheduled background scans (weekly on Basic, daily on Pro and Agency). If your certificate is within 14 days of expiration, a critical header drops after a software deployment, or your score falls below a set threshold, an instant email alert is dispatched.",
  },
  {
    question: "Can digital agencies use SiteSecura for client reporting?",
    answer:
      "Yes. The Agency plan is purpose-built for web design, development, and digital marketing agencies. It supports monitoring up to 100 client websites, includes 15 team seats, bulk CSV website importing, and lets you generate white-label PDF audit reports customized with your agency logo, primary brand color, and custom company footer.",
  },
];
