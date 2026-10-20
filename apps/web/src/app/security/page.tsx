import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout, LegalCallout, TocItem } from "@/components/legal/LegalPageLayout";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Security & Data Protection | SiteSecura",
  description:
    "Information about SiteSecura's application, infrastructure and data-security practices.",
  robots: {
    index: true,
    follow: true,
  },
};

const TOC: TocItem[] = [
  { id: "security-approach", title: "1. Security Approach" },
  { id: "application-security", title: "2. Application Security" },
  { id: "authentication", title: "3. Authentication Architecture" },
  { id: "authorization-isolation", title: "4. Authorization & Data Isolation" },
  { id: "scanner-security", title: "5. Scanner Infrastructure & SSRF Defense" },
  { id: "transport-security", title: "6. Transport Security & Encryption" },
  { id: "secrets-credentials", title: "7. Secrets & Credential Management" },
  { id: "logging-monitoring", title: "8. Logging & Operational Monitoring" },
  { id: "backups-recovery", title: "9. Backups & Disaster Recovery" },
  { id: "third-party-providers", title: "10. Third-Party Service Providers" },
  { id: "incident-response", title: "11. Security Incidents" },
  { id: "vulnerability-reporting", title: "12. Vulnerability Reporting" },
  { id: "important-limitation", title: "13. Important Limitations" },
  { id: "contact", title: "14. Security Contact" },
];

export default function SecurityPage() {
  return (
    <LegalPageLayout
      title="Security & Data Protection"
      description="How SiteSecura approaches application security, defensive scanning safeguards, infrastructure isolation, and data protection."
      effectiveDate={LEGAL_CONFIG.LAST_UPDATED}
      toc={TOC}
    >
      {/* SECTION 1 */}
      <section id="security-approach" className="space-y-3">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">1. Security Approach</h2>
        <p>
          Security is a foundational consideration in the architecture, deployment, and day-to-day
          operations of SiteSecura.
        </p>
        <p>
          As a cybersecurity platform, we implement technical and organizational controls designed to
          protect customer accounts, target configurations, scan histories, generated reports, and our
          underlying infrastructure. Our security controls evolve continuously as modern attack
          surfaces adapt and our platform expands.
        </p>
      </section>

      {/* SECTION 2 */}
      <section id="application-security" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          2. Application Security
        </h2>
        <p>
          SiteSecura incorporates defensive software engineering practices throughout the codebase:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
          <li><strong>Server-Side Authorization:</strong> Every administrative action, scan trigger, and report query is verified on the backend independently of client-side UI states;</li>
          <li><strong>Input Sanitization &amp; Validation:</strong> Target domains and user inputs are strictly validated against restrictive regular expressions to prevent injection attacks;</li>
          <li><strong>Rate Limiting &amp; Burst Controls:</strong> Multi-tiered rate limiters protect public endpoints and authenticated APIs against brute-force and resource-exhaustion traffic;</li>
          <li><strong>Protected API Endpoints:</strong> Bearer token verification and organization membership checks guard private endpoints; and</li>
          <li><strong>Security Auditing:</strong> Sensitive operational events (such as membership changes, quota adjustments, and scan triggers) record structured audit log entries.</li>
        </ul>
      </section>

      {/* SECTION 3 */}
      <section id="authentication" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          3. Authentication Architecture
        </h2>
        <p>
          SiteSecura utilizes Firebase Authentication (Google LLC) for account identity management,
          session tokens, and OAuth integrations (Google Sign-In).
        </p>
        <p>
          Plain-text passwords are never received or stored within SiteSecura&apos;s application
          databases. Authentication tokens are cryptographically verified by our backend services on
          every authenticated request. Application authorization is handled separately by SiteSecura&apos;s
          internal role-based access controls.
        </p>
      </section>

      {/* SECTION 4 */}
      <section id="authorization-isolation" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          4. Authorization &amp; Data Isolation
        </h2>
        <p>
          SiteSecura enforces strict multi-tenant data isolation at the application layer. Data is
          partitioned logically by organization:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>Users can only access digital assets, registered websites, and scans belonging to their authorized organization;</li>
          <li>Role-based access control (Owner, Admin, Member, Viewer) restricts team permissions;</li>
          <li>Agency accounts operate with isolated client workspaces; and</li>
          <li>Report generation and PDF download streams strictly verify tenant ownership before rendering findings.</li>
        </ul>
      </section>

      {/* SECTION 5 */}
      <section id="scanner-security" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          5. Scanner Infrastructure &amp; SSRF Defense
        </h2>
        <p>
          Because SiteSecura performs outbound network requests to assess target websites, our scanner
          engine incorporates rigorous Server-Side Request Forgery (SSRF) defenses to prevent internal
          network probing:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
          <li><strong>Domain Normalization:</strong> Strips extraneous URI components, ports, and credentials before resolving;</li>
          <li><strong>Forbidden Hostname Blacklisting:</strong> Blocks requests to <code>localhost</code>, <code>.local</code>, <code>.internal</code>, and reserved local hostnames;</li>
          <li><strong>IP Address Validation:</strong> Authoritative pre-scan DNS resolution validates that target IPs are publicly routable;</li>
          <li><strong>Private Network Blocking:</strong> Rejects loopback addresses (<code>127.0.0.0/8</code>, <code>::1</code>), private subnets (RFC 1918 <code>10.0.0.0/8</code>, <code>172.16.0.0/12</code>, <code>192.168.0.0/16</code>), and link-local ranges;</li>
          <li><strong>Cloud Metadata Isolation:</strong> Explicitly blocks cloud instance metadata endpoints (including <code>169.254.169.254</code>); and</li>
          <li><strong>Redirect Chain Verification:</strong> Inspects and re-validates each hop throughout HTTP redirect chains (capped at 5 hops) rather than solely checking the initial URL.</li>
        </ul>
      </section>

      {/* SECTION 6 */}
      <section id="transport-security" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          6. Transport Security &amp; Encryption
        </h2>
        <p>
          All communications between user browsers and SiteSecura services are encrypted in transit
          using HTTPS and TLS. We deploy modern cryptographic cipher suites and enforce HTTP Strict
          Transport Security (HSTS) across our public domains.
        </p>
      </section>

      {/* SECTION 7 */}
      <section id="secrets-credentials" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          7. Secrets &amp; Credential Management
        </h2>
        <p>
          Application secrets, database credentials, third-party API keys, and signing secrets are
          managed through secure server-side environment configurations.
        </p>
        <p>
          Private keys and API credentials are never checked into public version control or exposed
          to client-side web application bundles.
        </p>
      </section>

      {/* SECTION 8 */}
      <section id="logging-monitoring" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          8. Logging &amp; Operational Monitoring
        </h2>
        <p>
          SiteSecura maintains centralized application, security, and operational audit logs to:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>Troubleshoot technical anomalies and scan errors;</li>
          <li>Detect scanning abuse, brute-force attempts, and unauthorized activities;</li>
          <li>Investigate security events and support incident response; and</li>
          <li>Maintain platform availability and task queue performance.</li>
        </ul>
        <p>
          Access to operational logs is restricted strictly to authorized engineering personnel with a
          demonstrated operational need.
        </p>
      </section>

      {/* SECTION 9 */}
      <section id="backups-recovery" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          9. Backups &amp; Disaster Recovery
        </h2>
        <p>
          To safeguard against data loss, SiteSecura uses automated database backups to support
          operational recovery. Backup and recovery practices depend on the production infrastructure
          and may change as the platform evolves.
        </p>
      </section>

      {/* SECTION 10 */}
      <section id="third-party-providers" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          10. Third-Party Service Providers
        </h2>
        <p>
          SiteSecura relies on vetted third-party infrastructure and service providers to support
          authentication, payments, email notifications, and network acceleration.
        </p>
        <p>
          For a comprehensive and transparent inventory of external service providers, please review our{" "}
          <Link
            href="/subprocessors"
            className="text-sky-600 hover:text-sky-700 underline font-semibold"
          >
            Subprocessors &amp; Third-Party Services
          </Link>{" "}
          page.
        </p>
      </section>

      {/* SECTION 11 */}
      <section id="incident-response" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">11. Security Incidents</h2>
        <p>
          If SiteSecura identifies a security incident affecting customer data or system availability,
          our engineering team will investigate promptly and implement containment and remediation
          measures appropriate to the circumstances.
        </p>
        <p>
          Where notification is required by applicable law, regulation, or contractual commitments,
          SiteSecura will notify affected customers without undue delay.
        </p>
      </section>

      {/* SECTION 12 */}
      <section id="vulnerability-reporting" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          12. Vulnerability Reporting
        </h2>
        <p>
          We encourage security researchers and users to responsibly disclose any potential security
          concerns. For guidelines on submitting findings, please visit our{" "}
          <Link
            href="/responsible-disclosure"
            className="text-sky-600 hover:text-sky-700 underline font-semibold"
          >
            Responsible Disclosure Policy
          </Link>
          .
        </p>
        <div className="pt-2">
          <Link
            href="/responsible-disclosure"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors"
          >
            Report a Security Issue →
          </Link>
        </div>
      </section>

      {/* SECTION 13 */}
      <section id="important-limitation" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          13. Important Limitations
        </h2>
        <LegalCallout variant="warning" title="REALISTIC SECURITY BOUNDARIES">
          <p className="text-xs sm:text-sm font-medium">
            No internet-connected service can guarantee absolute security. SiteSecura&apos;s security
            controls are designed to reduce risk, but they do not eliminate all possible threats.
            Security scores and findings are informational indicators and do not guarantee immunity from
            exploits or zero-day vulnerabilities.
          </p>
        </LegalCallout>
      </section>

      {/* SECTION 14 */}
      <section id="contact" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">14. Security Contact</h2>
        <p>For security inquiries or verification questions, reach our security team:</p>
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs sm:text-sm space-y-2">
          <p><strong>Entity:</strong> {LEGAL_CONFIG.COMPANY_NAME}</p>
          <p><strong>Security Inquiries:</strong> <a href={`mailto:${LEGAL_CONFIG.SECURITY_EMAIL}`} className="text-sky-600 underline font-semibold">{LEGAL_CONFIG.SECURITY_EMAIL_PLACEHOLDER}</a></p>
          <p><strong>Legal &amp; Privacy Contact:</strong> <a href={`mailto:${LEGAL_CONFIG.CONTACT_EMAIL}`} className="text-sky-600 underline font-semibold">{LEGAL_CONFIG.CONTACT_EMAIL_PLACEHOLDER}</a></p>
          <p><strong>Registered Address:</strong> {LEGAL_CONFIG.BUSINESS_ADDRESS}</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}
