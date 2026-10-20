export interface ResourceFaqItem {
  question: string;
  answer: string;
}

export const RESOURCE_FAQS: ResourceFaqItem[] = [
  {
    question: "Are SiteSecura’s utility tools free?",
    answer:
      "Yes. All standalone utility tools on the Resources page (including the DNS Lookup Tool, HTTP Status & Redirect Checker, security.txt Validator, Robots.txt & Sitemap Checker, and CSP Policy Analyzer) are free to use without subscriptions or hidden paywalls. A fair-usage rate limit (typically 15 requests per minute per IP address) is enforced to ensure reliable availability for all visitors.",
  },
  {
    question: "Do the tools require an account?",
    answer:
      "No account or sign-in is required to use any of our standalone utilities or to run an initial website security scan. You can immediately inspect DNS records, validate security.txt, trace redirect chains, or analyze a Content Security Policy anonymously. Free and paid accounts are optional if you wish to track scan history over time, download branded PDF reports, or configure automated continuous monitoring.",
  },
  {
    question: "What is the difference between an individual tool and a full website scan?",
    answer:
      "Individual utilities are focused, single-purpose tools designed to investigate a specific technical configuration—such as debugging a DNS propagation issue, testing crawler paths in robots.txt, tracing a 301 redirect chain, or validating CSP Level 3 directives. SiteSecura's full website security scan evaluates your entire external perimeter across TLS/SSL cipher suites, DNSSEC, email security (SPF, DKIM, DMARC), defensive HTTP security headers, and server disclosure signals in a single comprehensive assessment.",
  },
  {
    question: "Can I use the tools for a website I do not own?",
    answer:
      "SiteSecura's utilities only query publicly observable information—such as public DNS records, standard HTTP response headers, robots.txt, and RFC 9116 security.txt files that are already served to every internet browser. Because our inspection is strictly passive and non-intrusive, you can evaluate any public website. Invasive testing, denial-of-service attempts, and unauthorized exploitation are strictly prohibited by our Fair Usage Policy.",
  },
  {
    question: "Do the tools guarantee that a website is secure?",
    answer:
      "No automated or passive tool can guarantee 100% security or complete immunity from cyber threats. SiteSecura identifies externally observable configuration gaps, expired certificates, and missing browser defense policies. It does not replace internal source code audits, authenticated penetration testing, or application business logic verification.",
  },
  {
    question: "What should I do after a tool reports a problem?",
    answer:
      "Every tool provides clear technical context: an explanation of the finding, evidence extracted from the target, the security impact, and copyable remediation examples for common servers (Nginx, Apache, Cloudflare, Caddy). We recommend reviewing the actionable recommendation, implementing the necessary server or DNS adjustment, and re-running the tool to verify that the remediation is effective.",
  },
];
