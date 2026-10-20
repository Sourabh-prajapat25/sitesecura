export interface FaqItem {
  question: string;
  answer: string;
}

export const DNS_TOOL_FAQS: FaqItem[] = [
  {
    question: "What is a DNS lookup?",
    answer:
      "A DNS (Domain Name System) lookup is the process of translating human-friendly hostnames (such as example.com) into numerical IP addresses (such as 93.184.216.34 or 2606:2800:220:1:248:1863:25c8:1946) and querying other associated service records, such as mail servers (MX), canonical aliases (CNAME), and verification data (TXT).",
  },
  {
    question: "How do I check DNS records for a domain?",
    answer:
      "Enter your domain name (without 'https://' or sub-paths) in the domain input field above, select the record types you wish to inspect (such as A, AAAA, MX, NS, or TXT), and click 'Look Up DNS Records'. SiteSecura will query authoritative DNS records and display the returned values and TTLs in real time.",
  },
  {
    question: "What is the difference between A and AAAA records?",
    answer:
      "An 'A' record (Address record) maps a hostname to a 32-bit IPv4 address (e.g. 93.184.216.34). An 'AAAA' record (Quad-A record) maps a hostname to a 128-bit IPv6 address (e.g. 2606:2800:220:1:248:1863:25c8:1946). Having both records published ensures your website is accessible to modern IPv6-only networks as well as legacy IPv4 clients.",
  },
  {
    question: "How do I check MX records?",
    answer:
      "Select the 'MX' checkbox in our DNS Lookup Tool and submit your domain. The tool returns all published Mail Exchanger hostnames along with their priority (preference) values. Lower preference numbers indicate higher priority mail servers that sending MTAs attempt to contact first.",
  },
  {
    question: "Why does a DNS lookup return no records?",
    answer:
      "There are several legitimate reasons: (1) The requested record type is simply not configured (e.g., a domain that does not host email will not have MX records); (2) DNS changes were recently published and are still propagating through upstream resolver caches; (3) The domain is newly registered and lacks zone file propagation; or (4) The domain has expired or is in NXDOMAIN status.",
  },
  {
    question: "Does a DNS lookup check whether a website is secure?",
    answer:
      "No. A DNS lookup only reports the network pointers published in domain zone files. It does not inspect TLS certificate chains, audit HTTP security headers, scan for OWASP vulnerabilities, or verify server encryption. To assess comprehensive website security, run our free Website Security Scanner.",
  },
  {
    question: "Why can DNS results differ between resolvers?",
    answer:
      "DNS records are cached by recursive resolvers worldwide based on their Time-To-Live (TTL) values. When you update a DNS record at your registrar or DNS provider, some recursive resolvers (e.g., Google 8.8.8.8, Cloudflare 1.1.1.1, or local ISP resolvers) will serve cached entries until their TTL expires, while others may fetch the updated record immediately.",
  },
];
