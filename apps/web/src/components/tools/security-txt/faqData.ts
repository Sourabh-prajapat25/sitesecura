export interface FaqItem {
  question: string;
  answer: string;
}

export const SECURITY_TXT_FAQS: FaqItem[] = [
  {
    question: "What is security.txt and what problem does it solve?",
    answer:
      "security.txt is an established Internet standard (RFC 9116) that defines a standard text file format and location for organizations to publish their security contact details, vulnerability disclosure policy, and encryption keys. It solves the critical problem where ethical security researchers find a vulnerability on a website or API but cannot determine how or to whom to safely report it.",
  },
  {
    question: "Where should the security.txt file be hosted on a web server?",
    answer:
      "Under RFC 9116 Section 2.5.2, the primary mandatory location is https://<domain>/.well-known/security.txt. For backwards compatibility with older drafts, a fallback location at https://<domain>/security.txt is permitted only if the /.well-known/ path is not available. The file must always be served over HTTPS and with a Content-Type of text/plain.",
  },
  {
    question: "Which directives are mandatory according to RFC 9116?",
    answer:
      "RFC 9116 defines two mandatory directives: Contact and Expires. Every valid security.txt file MUST include at least one Contact directive (specifying a valid email address via mailto:, a web contact form via https://, or a telephone via tel:) and exactly one Expires directive (specifying an RFC 3339 timestamp with timezone indicating when the file expires).",
  },
  {
    question: "What URI schemes are permitted for the Contact directive?",
    answer:
      "The Contact directive must be an absolute URI. Supported and compliant schemes include 'mailto:' (e.g. mailto:security@example.com), 'https://' (e.g. https://example.com/security/report), or 'tel:' (e.g. tel:+1-555-0199). Insecure schemes such as 'http://' are strictly prohibited.",
  },
  {
    question: "How does the Expires directive work and what timestamp format is required?",
    answer:
      "The Expires directive communicates the date and time after which the contact data should no longer be trusted. It must strictly conform to RFC 3339 / ISO 8601 formatting, including full calendar date, time, and timezone offset (e.g., '2026-12-31T23:59:59Z' or '2027-01-01T00:00:00+00:00'). Files with expired dates are considered invalid under RFC 9116.",
  },
  {
    question: "Why does RFC 9116 discourage setting an expiration date more than one year away?",
    answer:
      "RFC 9116 Section 2.5.5 explicitly recommends setting an expiration date less than one year in the future. Long-lived expiration dates risk leaving stale contact emails and dead disclosure links active indefinitely. Setting a duration of less than one year forces organizations to review their security posture and contact details annually.",
  },
  {
    question: "Can I sign my security.txt file with an OpenPGP digital signature?",
    answer:
      "Yes. RFC 9116 Section 2.3 specifically accommodates OpenPGP cleartext signed messages (RFC 4880). The file can be wrapped in standard PGP cleartext signature headers ('-----BEGIN PGP SIGNED MESSAGE-----' and '-----BEGIN PGP SIGNATURE-----'). The SiteSecura validator recognizes OpenPGP armor and parses directives without flagging false syntax errors.",
  },
  {
    question: "What optional directives can I include in my security.txt file?",
    answer:
      "Supported optional directives include Encryption (URI pointing to your PGP public key or key server), Acknowledgments (URL recognizing researchers who reported bugs), Policy (link to your Vulnerability Disclosure Policy or bug bounty guidelines), Preferred-Languages (comma-separated list of IETF language tags, at most one directive), Canonical (the authoritative HTTPS URL where the file is published), and Hiring (link to cybersecurity career opportunities).",
  },
  {
    question: "Why does SiteSecura require HTTPS when retrieving security.txt?",
    answer:
      "RFC 9116 Section 2.2 explicitly mandates that security.txt files MUST be accessed using HTTPS. Cleartext HTTP exposes disclosure information to interception and man-in-the-middle tampering, which could allow attackers to redirect vulnerability reports to unauthorized third parties. SiteSecura strictly enforces HTTPS and rejects unencrypted connections.",
  },
  {
    question: "What is the difference between an error and a warning in the validator?",
    answer:
      "An Error indicates a violation of mandatory RFC 9116 requirements (e.g. missing Contact, missing or expired Expires directive, multiple Expires directives, or invalid URI schemes) that render the file non-compliant. A Warning indicates a best-practice deviation (e.g. an expiration date set farther than 366 days in the future, missing Canonical directive, or serving the file from the legacy /security.txt fallback instead of /.well-known/).",
  },
];
