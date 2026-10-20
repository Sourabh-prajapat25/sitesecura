import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout, LegalCallout, TocItem } from "@/components/legal/LegalPageLayout";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Authorized Scanning Policy | SiteSecura",
  description:
    "Understand SiteSecura's authorization requirements and permitted use for website security assessments.",
  robots: {
    index: true,
    follow: true,
  },
};

const TOC: TocItem[] = [
  { id: "purpose", title: "1. Purpose of the Service" },
  { id: "authorized-targets", title: "2. Authorized Targets" },
  { id: "unauthorized-targets", title: "3. Unauthorized Targets" },
  { id: "user-responsibility", title: "4. User Responsibility" },
  { id: "defensive-scope", title: "5. Defensive Assessment Scope" },
  { id: "prohibited-activities", title: "6. Activities Not Authorized" },
  { id: "abuse-enforcement", title: "7. Abuse Prevention & Enforcement" },
  { id: "contact", title: "8. Inquiries & Security Contact" },
];

export default function AuthorizedScanningPage() {
  return (
    <LegalPageLayout
      title="Authorized Scanning Policy"
      description="Use SiteSecura only on websites and systems you own or are authorized to assess. Understand our strict scanning boundaries and acceptable use standards."
      effectiveDate={LEGAL_CONFIG.LAST_UPDATED}
      toc={TOC}
    >
      {/* Prominent Warning Callout */}
      <LegalCallout variant="warning" title="MANDATORY AUTHORIZATION REQUIREMENT">
        <p className="text-sm font-semibold">
          Authorization is your responsibility. Using SiteSecura does not grant permission to scan a
          third-party system. You must own the target or have explicit, verifiable authorization from
          its owner before initiating an assessment.
        </p>
      </LegalCallout>

      {/* SECTION 1 */}
      <section id="purpose" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">1. Purpose of the Service</h2>
        <p>
          SiteSecura provides automated defensive website security, encryption validation, and
          configuration hygiene assessments. The Service is intended exclusively to help authorized
          website owners, engineering teams, and organizations identify security configuration defects
          and maintain defensive standards across their public web perimeter.
        </p>
      </section>

      {/* SECTION 2 */}
      <section id="authorized-targets" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">2. Authorized Targets</h2>
        <p>You may submit, scan, or monitor only the following targets:</p>
        <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
          <li>Your own personal website, domain, or digital property;</li>
          <li>Websites and web applications owned by your employer or organization where you have explicit operational authorization to evaluate security posture;</li>
          <li>Client websites and digital properties where you have received explicit, written authorization from the domain owner or client representative (e.g., agency client agreements); or</li>
          <li>Websites or domains where the owner has expressly invited and documented authorization for public defensive assessments.</li>
        </ul>
      </section>

      {/* SECTION 3 */}
      <section id="unauthorized-targets" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">3. Unauthorized Targets</h2>
        <p className="font-semibold text-slate-800">You must strictly NOT submit or scan:</p>
        <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
          <li>Websites, servers, or domains belonging to unrelated third parties, competitors, or private individuals without authorization;</li>
          <li>Government, educational, or critical infrastructure systems without formal written authorization;</li>
          <li>Private, internal, or non-routable corporate networks;</li>
          <li>Localhost addresses (including <code>127.0.0.1</code>, <code>::1</code>, or <code>localhost</code>);</li>
          <li>Internal IP addresses (including RFC 1918 subnets such as <code>10.0.0.0/8</code>, <code>172.16.0.0/12</code>, <code>192.168.0.0/16</code>);</li>
          <li>Cloud instance metadata services (such as <code>169.254.169.254</code>); or</li>
          <li>Any target or domain for which you do not hold valid legal authorization.</li>
        </ul>
      </section>

      {/* SECTION 4 */}
      <section id="user-responsibility" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">4. User Responsibility</h2>
        <p>
          Before submitting any domain or target to SiteSecura, you must independently determine whether
          you possess the necessary authorization under applicable laws, organizational policies, and
          hosting agreements.
        </p>
        <p>
          SiteSecura operates an automated evaluation pipeline and does not verify ownership or
          authorization credentials for every public scan target. By submitting a domain to the
          Service, you represent and warrant that you hold legitimate authority to request the
          assessment.
        </p>
      </section>

      {/* SECTION 5 */}
      <section id="defensive-scope" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          5. Defensive Assessment Scope
        </h2>
        <p>
          SiteSecura is engineered strictly as a non-destructive, passive scanner. Our automated checks
          are restricted to:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>Standard HTTP/HTTPS requests to public ports (80 and 443);</li>
          <li>Inspection of TLS handshakes, certificate expiration, and supported cipher suites;</li>
          <li>Verification of public DNS records (including A, AAAA, MX, TXT, SPF, DMARC, and DNSSEC);</li>
          <li>Inspection of HTTP response headers (such as HSTS, Content-Security-Policy, X-Frame-Options);</li>
          <li>Evaluation of cookie security flags (Secure, HttpOnly, SameSite); and</li>
          <li>Detection of observable server software indicators and configuration disclosures.</li>
        </ul>
        <p>
          Our probes do not inject intrusive application payloads, flood targets, or attempt to modify
          server state.
        </p>
      </section>

      {/* SECTION 6 */}
      <section id="prohibited-activities" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">6. Activities Not Authorized</h2>
        <p>
          Using SiteSecura does not authorize you or any third party to conduct aggressive or unlawful
          cyber operations, including:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
          <li>Vulnerability exploitation or exploit payload delivery;</li>
          <li>Authentication bypass attempts or credential stuffing;</li>
          <li>Brute-force password or directory attacks;</li>
          <li>Denial-of-service (DoS or DDoS) testing or volume stress tests;</li>
          <li>Destructive or invasive penetration testing;</li>
          <li>Uploading unauthorized files, shells, or malicious scripts;</li>
          <li>Malware or spyware deployment;</li>
          <li>Unauthorized reconnaissance or vulnerability scanning against third-party assets; or</li>
          <li>Internet-wide scanning or bulk target harvesting.</li>
        </ul>
      </section>

      {/* SECTION 7 */}
      <section id="abuse-enforcement" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          7. Abuse Prevention &amp; Enforcement
        </h2>
        <p>
          We employ automated SSRF safeguards, rate limiting, and anomalous scanning detection to
          protect the Internet and our infrastructure from misuse.
        </p>
        <p>
          If we determine or reasonably suspect that an account is being used to conduct unauthorized
          scanning, circumvent scan boundaries, or violate this policy, we may immediately restrict,
          suspend, or permanently terminate that account without prior notice.
        </p>
      </section>

      {/* SECTION 8 */}
      <section id="contact" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          8. Inquiries &amp; Security Contact
        </h2>
        <p>
          If you have questions regarding this Authorized Scanning Policy or need to report suspected
          scanning abuse:
        </p>
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs sm:text-sm space-y-2">
          <p><strong>Entity:</strong> {LEGAL_CONFIG.COMPANY_NAME}</p>
          <p><strong>Policy Questions:</strong> <a href={`mailto:${LEGAL_CONFIG.CONTACT_EMAIL}`} className="text-sky-600 underline">{LEGAL_CONFIG.CONTACT_EMAIL_PLACEHOLDER}</a></p>
          <p><strong>Security Reports &amp; Abuse:</strong> <a href={`mailto:${LEGAL_CONFIG.SECURITY_EMAIL}`} className="text-sky-600 underline">{LEGAL_CONFIG.SECURITY_EMAIL_PLACEHOLDER}</a></p>
          <p><strong>Address:</strong> {LEGAL_CONFIG.BUSINESS_ADDRESS}</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}
