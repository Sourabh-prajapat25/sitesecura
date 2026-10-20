export interface FaqItem {
  question: string;
  answer: string;
}

export const CSP_POLICY_FAQS: FaqItem[] = [
  {
    question: "What is Content Security Policy (CSP) and what standard governs it?",
    answer:
      "Content Security Policy (CSP) is an HTTP response header that allows site operators to restrict the origins and execution contexts from which browsers may load and execute resources such as JavaScript, CSS, images, frames, fonts, and media. Governed by W3C specifications (currently CSP Level 3), it serves as a foundational defense-in-depth security layer designed primarily to defeat Cross-Site Scripting (XSS) and data injection attacks.",
  },
  {
    question: "How does CSP reduce the impact of Cross-Site Scripting (XSS)?",
    answer:
      "XSS attacks rely on injecting malicious scripts into trusted web pages. A restrictive CSP prevents unauthorized scripts from executing by establishing a cryptographic or origin allowlist. Even if an attacker injects a malicious <script> tag or inline event handler (such as onload=), the browser checks the policy, observes that the script source lacks an approved nonce, hash, or origin, and blocks execution immediately.",
  },
  {
    question: "What is the difference between enforcing CSP and Report-Only mode?",
    answer:
      "Enforcing mode ('Content-Security-Policy') instructs the browser to block any resource or script execution that violates the policy and optionally send a report. Report-Only mode ('Content-Security-Policy-Report-Only') does NOT block anything; it permits the violating resource to execute normally while sending JSON violation reports to your specified reporting endpoint. Report-Only mode is essential for testing policies in staging or production before activating enforcement.",
  },
  {
    question: "How does the 'default-src' fallback mechanism work?",
    answer:
      "'default-src' serves as the fallback directive for most fetch directives (including script-src, style-src, img-src, font-src, connect-src, media-src, and object-src). If a specific directive like 'img-src' is omitted from your policy, the browser automatically applies the rules defined under 'default-src'. However, if 'img-src' is explicitly defined, it completely overrides 'default-src' for images.",
  },
  {
    question: "Which CSP directives DO NOT fall back to 'default-src'?",
    answer:
      "Crucially, several vital defensive directives DO NOT inherit from 'default-src': 'base-uri', 'form-action', and 'frame-ancestors'. If you omit 'base-uri', any base URI can be injected; if you omit 'form-action', forms can submit to any external domain; and if you omit 'frame-ancestors', any site can embed your page in an iframe. Each of these must be explicitly defined in your policy.",
  },
  {
    question: "Why is 'unsafe-inline' dangerous, and how do nonces or hashes resolve it?",
    answer:
      "'unsafe-inline' allows inline <script> tags, javascript: URLs, and inline event handlers to execute, largely negating CSP's defense against stored and reflected XSS. Cryptographic nonces ('nonce-...') resolve this by requiring a server-generated, unpredictable random token in each legitimate <script nonce=\"...\"> tag. Alternatively, cryptographic SHA-256 hashes allow specific static inline scripts to execute without opening the door to arbitrary injected code.",
  },
  {
    question: "What is 'strict-dynamic' and why is it recommended in CSP Level 3?",
    answer:
      "'strict-dynamic' simplifies CSP maintenance by allowing a trusted root script (verified by a nonce or hash) to dynamically load and execute additional scripts without having to allowlist every transitive CDN domain. In modern browsers, 'strict-dynamic' automatically ignores host allowlists and 'unsafe-inline', enabling robust protection against XSS even when third-party libraries load dynamic dependencies.",
  },
  {
    question: "Why is 'object-src none' strongly recommended?",
    answer:
      "'object-src' controls the execution of plugins such as Flash, Silverlight, Java applets, and PDF viewers via <object>, <embed>, and <applet> tags. Since modern browsers have universally deprecated legacy plugin architectures, setting 'object-src 'none'' eliminates a major legacy attack surface and prevents attackers from using plugin containers to bypass script restrictions.",
  },
  {
    question: "How does 'base-uri' protect against Base Tag Hijacking?",
    answer:
      "If an attacker injects an HTML <base href=\"https://attacker.com/\"> element into a document lacking a 'base-uri' directive, all subsequent relative URLs on the page (such as <script src=\"/app.js\"> or <form action=\"/login\">) will resolve against the attacker's server. Defining 'base-uri 'self'' ensures that the document base URL cannot be hijacked to point to an external domain.",
  },
  {
    question: "What is the relationship between 'frame-ancestors' and 'X-Frame-Options'?",
    answer:
      "'frame-ancestors' controls which parent domains can frame your webpage inside an <iframe>, defending against clickjacking and UI redressing. In modern browsers, 'frame-ancestors' supersedes the legacy 'X-Frame-Options' header. Setting 'frame-ancestors 'self'' restricts embedding to your own origin, while 'frame-ancestors 'none'' prevents framing anywhere.",
  },
  {
    question: "Why is an unquoted keyword like 'self' or 'none' a critical error?",
    answer:
      "CSP keywords ('self', 'none', 'unsafe-inline', 'unsafe-eval', 'strict-dynamic') must always be surrounded by single quotes. If written without quotes (e.g. default-src self), the browser interprets 'self' as a literal domain name (http://self or https://self) rather than your current origin. This causes the directive to malfunction and can leave the site completely unprotected.",
  },
  {
    question: "Can deploying a restrictive CSP break legitimate application resources?",
    answer:
      "Yes. If your policy omits external API domains required for authentication (e.g. Firebase, Auth0), payment gateways (e.g. Stripe, PayPal), web fonts (e.g. Google Fonts), analytics (e.g. Google Analytics), or CDNs, browsers will block those network requests. This is why testing in Report-Only mode or staging environments is essential to audit and allowlist all required application dependencies.",
  },
  {
    question: "How should a development team safely test and roll out a new CSP?",
    answer:
      "Follow a phased rollout: 1) Deploy the policy first using 'Content-Security-Policy-Report-Only' with a 'report-to' or 'report-uri' endpoint; 2) Monitor violation reports across production traffic for at least 1-2 weeks; 3) Identify and allowlist legitimate application dependencies or adopt nonces; 4) Once violation reports drop to zero legitimate traffic, switch the header to the enforcing 'Content-Security-Policy'.",
  },
  {
    question: "What does this CSP Policy Analyzer check, and what are its limits?",
    answer:
      "This tool performs comprehensive static syntactic and semantic analysis of your CSP header against W3C CSP Level 3 specifications. It identifies dangerous directives, fallback gaps, unquoted keywords, clickjacking exposure, and syntax errors. However, because it evaluates policy text statically, it cannot verify whether your server generates truly random nonces per response or test dynamic DOM execution within every legacy browser engine.",
  },
];
