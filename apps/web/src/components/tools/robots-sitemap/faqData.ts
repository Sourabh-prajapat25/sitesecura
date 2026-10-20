export interface FaqItem {
  question: string;
  answer: string;
}

export const ROBOTS_SITEMAP_FAQS: FaqItem[] = [
  {
    question: "What is robots.txt and what standard defines it?",
    answer:
      "robots.txt is a plain-text file placed in the root directory of a web origin to instruct web crawlers and search engine spiders which parts of the site they may or may not access. In September 2022, the Internet Engineering Task Force (IETF) published RFC 9309 ('Robots Exclusion Protocol'), formally standardizing crawler directives, user-agent grouping, pattern matching, precedence rules, and parsing semantics after 28 years of informal conventions.",
  },
  {
    question: "What is the difference between robots.txt and an XML sitemap?",
    answer:
      "robots.txt acts as an access boundary: it informs crawlers which URL paths they are disallowed from fetching. An XML sitemap, in contrast, acts as a discovery inventory: it lists public canonical URLs that you want search engines to crawl and index, along with optional metadata such as last modification dates and change frequency. Both files complement each other: robots.txt controls crawl permissions, while sitemaps guide discovery efficiency.",
  },
  {
    question: "Where must robots.txt and XML sitemaps be hosted?",
    answer:
      "According to RFC 9309, robots.txt MUST be hosted at the root path of the target origin over HTTP or HTTPS: 'https://<domain>/robots.txt'. Placing it in a subfolder (e.g., '/sub/robots.txt') is invalid and will be ignored by compliant crawlers. XML sitemaps can reside anywhere within the same host origin, but conventionally exist at '/sitemap.xml'. Their locations should also be explicitly declared inside robots.txt via 'Sitemap: https://<domain>/sitemap.xml' directives.",
  },
  {
    question: "Does robots.txt prevent search engines from indexing URLs?",
    answer:
      "No. This is one of the most common SEO misconceptions. A 'Disallow' directive prevents a crawler from requesting and reading the content of a page. However, if external websites link to that URL with descriptive anchor text, search engines may still index the URL in search results without the page snippet. To reliably prevent a page from appearing in search results, allow crawlers to access the page and include a '<meta name=\"robots\" content=\"noindex\">' tag or 'X-Robots-Tag: noindex' HTTP response header.",
  },
  {
    question: "Does robots.txt keep sensitive files secure or confidential?",
    answer:
      "Never. robots.txt is a publicly accessible file that anyone on the Internet can read. Disallowing paths like '/admin/', '/internal-reports/', or '/staging/' actually exposes the existence and folder layout of sensitive endpoints to attackers. robots.txt provides zero authentication, access control, or secrecy. Sensitive endpoints must be protected with proper HTTP authentication, access control lists (ACLs), network firewalls, and VPNs.",
  },
  {
    question: "How does RFC 9309 resolve conflicts between Allow and Disallow rules?",
    answer:
      "RFC 9309 Section 2.2.2 establishes two deterministic resolution rules: 1) Longest Match Precedence: The crawler must select the most specific rule based on the octet length of the matching pattern. For example, 'Allow: /page' (length 5) takes precedence over 'Disallow: /p' (length 2) for the path '/page123'. 2) Equal Specificity: If an 'Allow' and 'Disallow' rule have equal pattern length and both match the path, the 'Allow' rule takes precedence.",
  },
  {
    question: "What happens if a Disallow directive has an empty value ('Disallow:')?",
    answer:
      "An empty 'Disallow:' line (with no path value) explicitly removes all crawler restrictions for the associated user-agent group, meaning all paths on the website are allowed. It is standard practice to write 'User-agent: *\\nDisallow:' when an administrator wants to explicitly indicate that the entire website is crawlable.",
  },
  {
    question: "Are wildcards (*) and end-anchors ($) supported in robots.txt?",
    answer:
      "Yes. RFC 9309 officially codifies wildcards ('*') and end-anchors ('$') in path patterns. An asterisk matches zero or more occurrences of any valid character (e.g., 'Disallow: /*.pdf' matches any URL ending with or containing .pdf). A dollar sign anchor at the end of a pattern matches the exact end of the URL path (e.g., 'Disallow: /*.gif$' disallows files ending with .gif, but allows '/images/logo.gif.png').",
  },
  {
    question: "Are 'Crawl-delay' and 'Host' part of official RFC 9309 standards?",
    answer:
      "No. 'Crawl-delay' and 'Host' are proprietary, non-standard directives introduced by legacy search engines like Yandex, Bing, and Yahoo. Major crawlers like Googlebot completely ignore 'Crawl-delay' (Google manages crawl rate automatically via Search Console). While compliant RFC 9309 parsers preserve these directives for informational inspection, they are not part of the standard Robots Exclusion Protocol.",
  },
  {
    question: "What is the difference between a standard XML sitemap and a Sitemap Index?",
    answer:
      "A standard XML sitemap uses the root XML element '<urlset>' and contains up to 50,000 '<url>' entries. A Sitemap Index uses the root element '<sitemapindex>' and contains up to 50,000 '<sitemap>' elements pointing to child sitemap files. Sitemap indexes allow large websites with more than 50,000 pages or large sitemap files to organize content into separate topic- or date-specific sitemaps (e.g. sitemap-posts.xml, sitemap-products.xml).",
  },
  {
    question: "What are the strict size and URL limits for an XML sitemap?",
    answer:
      "According to the official Sitemaps.org protocol (co-supported by Google, Microsoft, and Yahoo), an individual uncompressed XML sitemap file MUST NOT exceed 50 MB in uncompressed size and MUST NOT contain more than 50,000 URLs. If your website has more than 50,000 URLs or the uncompressed file exceeds 50 MB, you must split the URLs across multiple sitemaps and reference them inside a Sitemap Index document.",
  },
  {
    question: "Why do cross-origin or external sitemap URLs get flagged or skipped?",
    answer:
      "Under the sitemaps.org specification and web security best practices, sitemaps may only describe and validate URLs located on the same host and protocol as the sitemap itself. Furthermore, fetching arbitrary third-party sitemaps introduces Server-Side Request Forgery (SSRF) and cross-origin hijacking risks. SiteSecura strictly enforces a safe-origin policy: external sitemaps located on different domains are identified and flagged as 'not_fetched_external'.",
  },
  {
    question: "Does submitting a valid XML sitemap guarantee that all pages will be indexed?",
    answer:
      "No. Sitemaps assist search engine bots in discovering new, updated, and deep pages on your domain, but search engines use separate ranking and indexing algorithms. Pages with low-quality content, thin text, duplicate canonical URLs, 'noindex' tags, or slow response times may still be excluded from the search index despite being cleanly declared in a valid XML sitemap.",
  },
  {
    question: "How should sitemaps be declared inside robots.txt?",
    answer:
      "Declare your sitemaps using standalone 'Sitemap:' directives anywhere in your robots.txt file, outside of user-agent groups or at the end of the file. Each directive must specify the complete absolute URL including protocol: 'Sitemap: https://example.com/sitemap.xml' or 'Sitemap: https://example.com/sitemap-index.xml'. Multiple sitemap lines can be declared if your site publishes multiple sitemaps.",
  },
];
