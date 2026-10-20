export interface FaqItem {
  question: string;
  answer: string;
}

export const HTTP_TOOL_FAQS: FaqItem[] = [
  {
    question: "What is an HTTP status checker and redirect chain tracer?",
    answer:
      "An HTTP status and redirect checker is a technical diagnostic tool that queries a specific URL and traces every single hop (redirection step) the server instructs the client to take. It reports the HTTP status code (such as 200 OK, 301 Moved Permanently, 302 Found, or 404 Not Found), status reason phrases, Location headers, response latency in milliseconds, and secure protocol transitions for each hop until reaching the final destination URL.",
  },
  {
    question: "What is the difference between 301 Moved Permanently and 302 Found?",
    answer:
      "A 301 Moved Permanently response indicates that the resource has been permanently moved to the URL specified in the Location header. Search engines like Google transfer link equity (PageRank) to the new destination and update their search index. A 302 Found (or 307 Temporary Redirect) indicates a temporary transition; search engines retain the original URL in their index and do not permanently pass link equity.",
  },
  {
    question: "What is a redirect chain and why does it hurt SEO and performance?",
    answer:
      "A redirect chain occurs when a request initiates a series of multiple redirects (e.g. URL A -> URL B -> URL C -> URL D) before reaching the final page. Each hop introduces additional DNS resolution, TCP handshake, TLS negotiation, and network latency—often adding hundreds of milliseconds to page load times. Search engine crawlers have bounded crawl budgets and will drop PageRank or abort crawling if a chain exceeds 4 or 5 hops.",
  },
  {
    question: "What causes a redirect loop ('ERR_TOO_MANY_REDIRECTS')?",
    answer:
      "A redirect loop happens when URL A points to URL B, which points back to URL A (or self-redirects A -> A), creating an infinite cycle. This is commonly caused by conflicting web server rewrite rules, mismatched WordPress or CMS site URL configurations, or Content Delivery Networks (CDNs) attempting to enforce HTTPS while the origin server redirects back to unencrypted HTTP.",
  },
  {
    question: "What is an SSL/HTTPS downgrade redirect and why is it a security vulnerability?",
    answer:
      "An SSL downgrade redirect happens when an initial secure HTTPS request is redirected to an unencrypted HTTP URL (e.g. https://example.com/login -> http://example.com/login). This strips TLS encryption, exposing cookies, session tokens, passwords, and sensitive communication to interception, eavesdropping, and tampering by adversaries on public Wi-Fi or transit networks (Man-in-the-Middle attacks).",
  },
  {
    question: "What is the difference between 307 Temporary Redirect and 308 Permanent Redirect?",
    answer:
      "Unlike legacy 301 and 302 responses—where web browsers historically changed POST requests to GET upon redirection—HTTP status codes 307 (Temporary) and 308 (Permanent) explicitly prohibit clients from altering the HTTP request method and body. If a client submits form data via POST, it must re-transmit that POST request to the new Location.",
  },
  {
    question: "Why do some online redirect checkers produce inaccurate results?",
    answer:
      "Many simple tools rely on automated curl or browser engines that mask intermediate steps, drop response headers, fail to handle relative redirect paths correctly, or get fooled by DNS rebinding attacks. SiteSecura follows redirects manually hop-by-hop with strict socket-level connection pinning and displays sanitized headers, individual latency measurements, and exact Location values for each hop.",
  },
  {
    question: "Does checking HTTP status replace a complete website security audit?",
    answer:
      "No. While checking HTTP status codes and redirect chains reveals crucial routing, canonicalization, and basic SSL configuration issues, it does not inspect TLS cipher suites, audit HTTP security headers (CSP, HSTS, XFO), scan for software vulnerabilities, detect sensitive data exposure, or check email security (SPF/DKIM/DMARC). To inspect your entire defensive posture, run SiteSecura's comprehensive Website Security Scanner.",
  },
];
