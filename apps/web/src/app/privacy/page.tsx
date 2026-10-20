import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout, LegalCallout, TocItem } from "@/components/legal/LegalPageLayout";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Privacy Policy | SiteSecura",
  description:
    "Learn how SiteSecura collects, uses, stores and protects information when you use our website security platform.",
  robots: {
    index: true,
    follow: true,
  },
};

const TOC: TocItem[] = [
  { id: "information-we-collect", title: "1. Information We Collect" },
  { id: "how-we-use-information", title: "2. How We Use Information" },
  { id: "domain-and-scan-data", title: "3. Domain and Scan Data" },
  { id: "cookies-and-tracking", title: "4. Cookies and Similar Technologies" },
  { id: "third-party-providers", title: "5. Third-Party Service Providers" },
  { id: "data-sharing", title: "6. Data Sharing" },
  { id: "data-retention", title: "7. Data Retention" },
  { id: "data-security", title: "8. Data Security" },
  { id: "international-transfers", title: "9. International Data Transfers" },
  { id: "your-rights", title: "10. Your Rights" },
  { id: "childrens-privacy", title: "11. Children's Privacy" },
  { id: "changes-to-policy", title: "12. Changes to This Privacy Policy" },
  { id: "contact", title: "13. Contact Information" },
];

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      description="How SiteSecura collects, uses, stores, protects and shares information when you use our website security assessment platform."
      effectiveDate={LEGAL_CONFIG.LAST_UPDATED}
      toc={TOC}
    >
      {/* Intro */}
      <div className="space-y-4">
        <p>
          {LEGAL_CONFIG.ENTITY_DBA} (&quot;SiteSecura&quot;, &quot;we&quot;, &quot;us&quot;, or
          &quot;our&quot;), respects your privacy and is committed to protecting the information you
          provide to us.
        </p>
        <p>
          This Privacy Policy explains how we collect, use, store, protect, and disclose information
          when you access or use SiteSecura, including our website security assessment tools,
          monitoring infrastructure, and reporting services.
        </p>
      </div>

      <LegalCallout variant="info">
        <strong>Overview:</strong> We process website domain names and configuration metadata strictly
        to deliver defensive security audits and monitoring alerts. We do not sell your personal data.
      </LegalCallout>

      {/* SECTION 1 */}
      <section id="information-we-collect" className="space-y-4 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">1. Information We Collect</h2>
        <p>Depending on how you interact with SiteSecura, we may collect the following categories of information:</p>

        <div className="space-y-4 pl-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">Account Information</h3>
            <p className="text-slate-600 text-sm">
              When you register an account, we collect your name, email address, authentication
              identifiers, account preferences, and organization details where applicable.
              Authentication is securely managed through Firebase Authentication or our configured
              identity provider. We do not store plain-text passwords in our database.
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">Website and Domain Information</h3>
            <p className="text-slate-600 text-sm">
              When you submit a website or domain for assessment, we collect the domain name,
              normalized domain, scan configuration, monitoring preferences, scan timestamps, and
              target metadata. We process this information solely to perform the requested security
              assessment.
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">Security Assessment Data</h3>
            <p className="text-slate-600 text-sm">
              We process automated scan observations, including security scores, itemized findings,
              evidence snippets (such as public HTTP response headers, SSL/TLS handshake ciphers, and
              DNS records), recommendations, historical trends, monitoring logs, and generated PDF reports.
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">Billing Information</h3>
            <p className="text-slate-600 text-sm">
              Subscription payments are processed securely through Stripe. We store the Stripe customer
              identifier, subscription identifier, plan tier, billing cycle dates, and payment status.
              SiteSecura never collects or stores raw credit or debit card numbers in its application database.
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">Technical and Log Information</h3>
            <p className="text-slate-600 text-sm">
              When you browse or interact with the platform, our servers automatically log technical
              details including IP address, user agent, browser type, device information, access
              timestamps, HTTP request paths, error logs, and session identifiers.
            </p>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">Communication Information</h3>
            <p className="text-slate-600 text-sm">
              If you contact us for customer support or inquiries, we collect your email address, name,
              support ticket content, correspondence history, and any voluntary attachments.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2 */}
      <section id="how-we-use-information" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">2. How We Use Information</h2>
        <p>We process collected information to:</p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>Deliver automated website security assessments and calculate deterministic scores;</li>
          <li>Generate interactive audit dashboards and exportable PDF reports;</li>
          <li>Provide recurring website monitoring and dispatch SSL expiration or score drop alerts;</li>
          <li>Manage user accounts, team member seats, and agency permissions;</li>
          <li>Process paid subscription billing through our payment partner;</li>
          <li>Provide customer support and respond to technical inquiries;</li>
          <li>Detect and prevent platform abuse, unauthorized scanning, rate-limit evasion, and fraud;</li>
          <li>Troubleshoot technical issues and maintain system availability and security; and</li>
          <li>Comply with applicable legal, statutory, and contractual requirements.</li>
        </ul>
      </section>

      {/* SECTION 3 */}
      <section id="domain-and-scan-data" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">3. Domain and Scan Data</h2>
        <p>
          When you submit a domain to SiteSecura, we query publicly available web server endpoints and
          public DNS servers to perform the requested defensive assessment. SiteSecura does not
          independently verify whether you own or are authorized to assess the submitted target.
        </p>
        <p>
          You are solely responsible for ensuring that you have appropriate authorization before
          submitting any web property to SiteSecura. For detailed guidelines, please review our{" "}
          <Link href="/authorized-scanning" className="text-sky-600 hover:text-sky-700 underline font-medium">
            Authorized Scanning Policy
          </Link>
          .
        </p>
      </section>

      {/* SECTION 4 */}
      <section id="cookies-and-tracking" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          4. Cookies and Similar Technologies
        </h2>
        <p>
          SiteSecura uses cookies and similar storage technologies to maintain secure authenticated
          sessions, remember user preferences, safeguard platform integrity, and evaluate service
          performance.
        </p>
        <p>
          For comprehensive details on the categories of cookies we employ and instructions on
          managing cookie settings in your browser, refer to our{" "}
          <Link href="/cookies" className="text-sky-600 hover:text-sky-700 underline font-medium">
            Cookie Policy
          </Link>
          .
        </p>
      </section>

      {/* SECTION 5 */}
      <section id="third-party-providers" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          5. Third-Party Service Providers
        </h2>
        <p>
          We partner with reputable infrastructure and software providers to operate SiteSecura. These
          providers process data solely on our behalf under contractual confidentiality and data
          protection standards:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li><strong>Firebase Authentication (Google):</strong> Identity verification and session tokens;</li>
          <li><strong>Stripe:</strong> Payment processing and PCI-compliant transaction management;</li>
          <li><strong>Cloudflare:</strong> DNS resolution, CDN acceleration, and DDoS mitigation;</li>
          <li><strong>Transactional Email Services:</strong> Automated notification dispatch; and</li>
          <li><strong>Cloud Infrastructure Providers:</strong> Secure database storage and task queue execution.</li>
        </ul>
      </section>

      {/* SECTION 6 */}
      <section id="data-sharing" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">6. Data Sharing</h2>
        <p>We do not sell personal data. We may share information only in the following circumstances:</p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>With vetted third-party service providers necessary to operate the platform;</li>
          <li>With professional advisers (legal counsel, accountants) bound by confidentiality;</li>
          <li>With law enforcement or regulatory authorities when compelled by lawful process or court order; and</li>
          <li>In connection with an organizational merger, acquisition, restructuring, or asset transfer, subject to standard confidentiality protections.</li>
        </ul>
      </section>

      {/* SECTION 7 */}
      <section id="data-retention" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">7. Data Retention</h2>
        <p>
          We retain personal data and security assessment records only for as long as necessary to
          fulfill the purposes described in this policy, satisfy legal obligations, and enforce our
          agreements.
        </p>
        <p>
          Scan history and generated report retention is governed by your active subscription plan:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li><strong>Free Plan:</strong> 7 days retention;</li>
          <li><strong>Basic Plan:</strong> 30 days retention;</li>
          <li><strong>Pro Plan:</strong> 90 days retention;</li>
          <li><strong>Agency Plan:</strong> 365 days retention.</li>
        </ul>
        <p>
          You may delete registered websites and historical scans from your dashboard at any time.
          Server logs and billing records may be retained longer where required by accounting, tax, or
          security compliance standards.
        </p>
      </section>

      {/* SECTION 8 */}
      <section id="data-security" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">8. Data Security</h2>
        <p>
          We maintain rigorous technical and organizational safeguards designed to protect personal and
          scan data against unauthorized access, loss, alteration, or disclosure:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>Mandatory TLS/HTTPS encryption for all data in transit;</li>
          <li>Role-based access controls (RBAC) and least-privilege administrative policies;</li>
          <li>SSRF and network isolation protections preventing unauthorized internal scanning;</li>
          <li>Regular dependency vulnerability patching and environment monitoring; and</li>
          <li>Automated database backups and encrypted storage volumes.</li>
        </ul>
        <p>
          While we implement industry-standard defensive controls, no Internet-connected service can
          guarantee absolute security.
        </p>
      </section>

      {/* SECTION 9 */}
      <section id="international-transfers" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          9. International Data Transfers
        </h2>
        <p>
          Because our infrastructure and service providers operate globally, information collected by
          SiteSecura may be transferred, stored, and processed in jurisdictions outside your home country.
          Where required by applicable data protection laws, appropriate transfer mechanisms and
          contractual safeguards are implemented.
        </p>
      </section>

      {/* SECTION 10 */}
      <section id="your-rights" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">10. Your Rights</h2>
        <p>
          Depending on your location and applicable privacy legislation, you may hold specific rights
          regarding your personal information, including:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>The right to request access to the personal data we hold about you;</li>
          <li>The right to request correction of inaccurate or incomplete personal records;</li>
          <li>The right to request deletion of your account and personal information;</li>
          <li>The right to restrict or object to certain processing activities; and</li>
          <li>The right to data portability.</li>
        </ul>
        <p>
          To exercise your privacy rights, submit a written request to{" "}
          <a href={`mailto:${LEGAL_CONFIG.CONTACT_EMAIL}`} className="text-sky-600 underline font-semibold">
            {LEGAL_CONFIG.CONTACT_EMAIL_PLACEHOLDER}
          </a>
          . We may verify your identity prior to completing your request.
        </p>
      </section>

      {/* SECTION 11 */}
      <section id="childrens-privacy" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">11. Children&apos;s Privacy</h2>
        <p>
          SiteSecura is an enterprise SaaS platform intended exclusively for adult professionals and
          organizations. We do not knowingly collect personal data from children under the age of 16.
          If we become aware that personal information of a child has been collected, we will take
          prompt steps to remove that data.
        </p>
      </section>

      {/* SECTION 12 */}
      <section id="changes-to-policy" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          12. Changes to This Privacy Policy
        </h2>
        <p>
          We may revise this Privacy Policy periodically to reflect technological, operational, or
          regulatory updates. When changes are posted, the &quot;Last Updated&quot; date at the top of
          this page will be revised. Material updates will be communicated through appropriate in-app
          notices or email where feasible.
        </p>
      </section>

      {/* SECTION 13 */}
      <section id="contact" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">13. Contact Information</h2>
        <p>If you have questions, feedback, or requests regarding this Privacy Policy, please contact us:</p>
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs sm:text-sm space-y-2">
          <p><strong>Entity:</strong> {LEGAL_CONFIG.COMPANY_NAME}</p>
          <p><strong>Privacy Inquiries:</strong> <a href={`mailto:${LEGAL_CONFIG.CONTACT_EMAIL}`} className="text-sky-600 underline">{LEGAL_CONFIG.CONTACT_EMAIL_PLACEHOLDER}</a></p>
          <p><strong>Registered Address:</strong> {LEGAL_CONFIG.BUSINESS_ADDRESS}</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}
