import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout, LegalCallout, TocItem } from "@/components/legal/LegalPageLayout";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Responsible Disclosure | SiteSecura",
  description:
    "How to responsibly report potential security vulnerabilities affecting SiteSecura.",
  robots: {
    index: true,
    follow: true,
  },
};

const TOC: TocItem[] = [
  { id: "purpose", title: "1. Purpose and Philosophy" },
  { id: "how-to-report", title: "2. How to Report" },
  { id: "what-to-include", title: "3. What to Include in Your Report" },
  { id: "please-avoid", title: "4. Activities to Strictly Avoid" },
  { id: "safe-testing-boundaries", title: "5. Safe Testing Boundaries" },
  { id: "our-response-process", title: "6. Our Response Process" },
  { id: "coordinated-disclosure", title: "7. Coordinated Public Disclosure" },
  { id: "bug-bounty-policy", title: "8. Bug Bounty Policy" },
  { id: "security-contact", title: "9. Security Contacts" },
];

export default function ResponsibleDisclosurePage() {
  return (
    <LegalPageLayout
      title="Responsible Disclosure"
      description="How to report potential security vulnerabilities affecting SiteSecura. We appreciate the contributions of ethical researchers in helping protect our community."
      effectiveDate={LEGAL_CONFIG.LAST_UPDATED}
      toc={TOC}
    >
      {/* Prominent Info Callout */}
      <LegalCallout variant="info" title="REPORTING A VULNERABILITY">
        <p className="text-sm font-semibold">
          Found a potential security vulnerability in SiteSecura? Please report it privately so our team can investigate.
        </p>
      </LegalCallout>

      {/* SECTION 1 */}
      <section id="purpose" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          1. Purpose and Philosophy
        </h2>
        <p>
          SiteSecura welcomes responsible, coordinated reports of potential security vulnerabilities
          affecting our public website, web applications, background scanners, APIs, and cloud
          infrastructure.
        </p>
        <p>
          Security researchers, customers, and developers who identify a potential weakness are
          strongly encouraged to report it privately rather than publicly disclosing technical details
          before SiteSecura has had a reasonable opportunity to investigate, triage, and remediate the
          issue.
        </p>
      </section>

      {/* SECTION 2 */}
      <section id="how-to-report" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">2. How to Report</h2>
        <p>Please submit your security findings via email directly to our dedicated security inbox:</p>
        <div className="p-4 bg-sky-50/80 rounded-xl border border-sky-200 text-xs sm:text-sm font-mono text-sky-950">
          <strong>Security Inbox:</strong>{" "}
          <a
            href={`mailto:${LEGAL_CONFIG.SECURITY_EMAIL}`}
            className="text-sky-700 hover:text-sky-800 underline font-bold"
          >
            {LEGAL_CONFIG.SECURITY_EMAIL_PLACEHOLDER}
          </a>
        </div>
        <p className="text-xs text-slate-500">
          Please include &quot;Vulnerability Report - [Brief Summary]&quot; in the subject line to ensure
          expedited routing to our security engineering team.
        </p>
      </section>

      {/* SECTION 3 */}
      <section id="what-to-include" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          3. What to Include in Your Report
        </h2>
        <p>
          To help us understand and reproduce the issue rapidly, please provide as much actionable
          context as possible:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
          <li>A clear, concise summary of the observed vulnerability;</li>
          <li>The specific URL, API endpoint, or component affected;</li>
          <li>Step-by-step reproduction instructions or a minimal, non-destructive proof-of-concept;</li>
          <li>Expected behavior versus actual behavior observed;</li>
          <li>Screenshots, HTTP request/response transcripts, or terminal logs where helpful;</li>
          <li>Your assessment of the potential security impact and severity;</li>
          <li>Relevant timestamps and source IP addresses used during testing; and</li>
          <li>Your contact information for follow-up questions.</li>
        </ul>
        <p className="text-xs text-slate-500 italic">
          Do not include unnecessary personal data or confidential information belonging to third parties.
        </p>
      </section>

      {/* SECTION 4 */}
      <section id="please-avoid" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          4. Activities to Strictly Avoid
        </h2>
        <p className="font-semibold text-slate-800">
          When conducting security research against SiteSecura, researchers must strictly avoid:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
          <li>Accessing, copying, downloading, modifying, or deleting customer or organization data;</li>
          <li>Disrupting service availability or degrading system performance;</li>
          <li>Executing denial-of-service (DoS or DDoS) attacks;</li>
          <li>Sending unsolicited messages, spam, or high-volume automated requests;</li>
          <li>Social engineering or phishing attacks against SiteSecura employees, contractors, or users;</li>
          <li>Physical attacks against our hosting infrastructure or offices;</li>
          <li>Credential attacks, brute-force logins, or credential stuffing against user accounts;</li>
          <li>Executing destructive payloads or state-altering injections;</li>
          <li>Establishing backdoors, persistence, or rootkits on our servers;</li>
          <li>Deploying malware, trojans, ransomware, or malicious executables; and</li>
          <li>Accessing information beyond what is strictly necessary to demonstrate the issue.</li>
        </ul>
      </section>

      {/* SECTION 5 */}
      <section id="safe-testing-boundaries" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          5. Safe Testing Boundaries
        </h2>
        <p>
          Security research must be limited exclusively to activities reasonably necessary to demonstrate
          the reported vulnerability.
        </p>
        <p>
          If a vulnerability inadvertently discloses access to customer data or internal metadata, you
          must <strong>immediately stop testing</strong>, refrain from viewing or downloading additional
          records, purge any locally saved evidence, and notify SiteSecura immediately in your report.
        </p>
      </section>

      {/* SECTION 6 */}
      <section id="our-response-process" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          6. Our Response Process
        </h2>
        <p>Upon receiving a vulnerability report, our security team will make reasonable efforts to:</p>
        <ol className="list-decimal pl-6 space-y-1.5 text-slate-600">
          <li>Acknowledge receipt of your report in a timely manner;</li>
          <li>Review and assign the report to a security engineer;</li>
          <li>Attempt to reproduce and validate the finding;</li>
          <li>Assess potential technical severity and operational impact;</li>
          <li>Develop, test, and deploy an appropriate remediation; and</li>
          <li>Communicate relevant status updates with the reporter where appropriate.</li>
        </ol>
      </section>

      {/* SECTION 7 */}
      <section id="coordinated-disclosure" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          7. Coordinated Public Disclosure
        </h2>
        <p>
          We request that researchers coordinate with us prior to releasing public advisories, blog
          posts, or technical disclosures. Premature disclosure can expose legitimate users to
          unnecessary risk before mitigations are fully deployed.
        </p>
        <p>
          We are committed to resolving verified vulnerabilities collaboratively and will discuss
          mutually agreeable disclosure timelines depending on the complexity of the remediation.
        </p>
      </section>

      {/* SECTION 8 */}
      <section id="bug-bounty-policy" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          8. Bug Bounty Policy
        </h2>
        <p>
          SiteSecura does not currently operate a public bug bounty program. Submitting a vulnerability
          report does not create an entitlement to compensation, consulting engagements, or monetary
          rewards.
        </p>
        <p>
          We deeply appreciate the ethical research community for helping safeguard our platform and
          users in the spirit of defensive cybersecurity collaboration.
        </p>
      </section>

      {/* SECTION 9 */}
      <section id="security-contact" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">9. Security Contacts</h2>
        <p>For vulnerability reports and security-related communications:</p>
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs sm:text-sm space-y-2">
          <p><strong>Entity:</strong> {LEGAL_CONFIG.COMPANY_NAME}</p>
          <p><strong>Security Reports:</strong> <a href={`mailto:${LEGAL_CONFIG.SECURITY_EMAIL}`} className="text-sky-600 underline font-semibold">{LEGAL_CONFIG.SECURITY_EMAIL_PLACEHOLDER}</a></p>
          <p><strong>General Legal Inquiries:</strong> <a href={`mailto:${LEGAL_CONFIG.CONTACT_EMAIL}`} className="text-sky-600 underline font-semibold">{LEGAL_CONFIG.CONTACT_EMAIL_PLACEHOLDER}</a></p>
          <p><strong>Registered Address:</strong> {LEGAL_CONFIG.BUSINESS_ADDRESS}</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}
