import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout, LegalCallout, TocItem } from "@/components/legal/LegalPageLayout";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Subprocessors & Third-Party Services | SiteSecura",
  description:
    "Third-party services used to support SiteSecura authentication, payments, infrastructure and platform functionality.",
  robots: {
    index: true,
    follow: true,
  },
};

const TOC: TocItem[] = [
  { id: "what-is-a-subprocessor", title: "1. What is a Subprocessor?" },
  { id: "provider-table", title: "2. Authorized Provider Inventory" },
  { id: "authentication-provider", title: "3. Authentication Services" },
  { id: "payment-processor", title: "4. Payment Processing Services" },
  { id: "data-sharing-principles", title: "5. Data Minimization & Sharing" },
  { id: "provider-changes", title: "6. Provider Updates" },
  { id: "contact", title: "7. Inquiries & Contact" },
];

export default function SubprocessorsPage() {
  return (
    <LegalPageLayout
      title="Subprocessors & Third-Party Services"
      description="Transparent disclosure of third-party service providers and subprocessors that support SiteSecura's application, infrastructure, and delivery operations."
      effectiveDate={LEGAL_CONFIG.LAST_UPDATED}
      toc={TOC}
    >
      {/* Intro */}
      <div className="space-y-4">
        <p>
          {LEGAL_CONFIG.ENTITY_DBA} (&quot;SiteSecura&quot;, &quot;we&quot;, &quot;us&quot;, or
          &quot;our&quot;) engages selected third-party service providers to deliver essential
          platform functions, including user authentication, payment processing, network security,
          and cloud hosting.
        </p>
        <p>
          This page identifies key external service providers and explains the specific operational
          purposes for which they process data on our behalf.
        </p>
      </div>

      <LegalCallout variant="info">
        <strong>Data Protection Standard:</strong> We carefully evaluate third-party providers for
        robust security controls and engage them under standard data protection and confidentiality
        terms.
      </LegalCallout>

      {/* SECTION 1 */}
      <section id="what-is-a-subprocessor" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          1. What is a Subprocessor?
        </h2>
        <p>
          A subprocessor is a third-party service provider engaged by SiteSecura to assist in
          delivering aspects of the Service to our customers. Depending on the service provided, an
          external provider may process limited customer data on our behalf or operate as an
          independent infrastructure provider.
        </p>
        <p>
          We do not sell personal data, and we restrict third-party access strictly to information
          necessary to fulfill their specific service functions.
        </p>
      </section>

      {/* SECTION 2 */}
      <section id="provider-table" className="space-y-4 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          2. Authorized Provider Inventory
        </h2>
        <p>
          The table below lists the active third-party services utilized in the SiteSecura production
          environment:
        </p>

        {/* Responsive Provider Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3 sm:p-4">Provider / Entity</th>
                <th className="p-3 sm:p-4">Operational Purpose</th>
                <th className="p-3 sm:p-4">Potential Data Processed</th>
                <th className="p-3 sm:p-4">Service Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 sm:p-4 font-bold text-slate-900">
                  Firebase Authentication<br />
                  <span className="text-xs font-normal text-slate-500">Google LLC</span>
                </td>
                <td className="p-3 sm:p-4">User authentication, session tokens, and identity verification</td>
                <td className="p-3 sm:p-4">Name, email address, authentication identifiers, sign-in timestamps</td>
                <td className="p-3 sm:p-4">Authentication Provider</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 sm:p-4 font-bold text-slate-900">
                  Stripe<br />
                  <span className="text-xs font-normal text-slate-500">Stripe, Inc.</span>
                </td>
                <td className="p-3 sm:p-4">Subscription billing, invoicing, and PCI-compliant payment gateway</td>
                <td className="p-3 sm:p-4">Customer ID, subscription ID, billing plan, payment status (card details handled directly by Stripe)</td>
                <td className="p-3 sm:p-4">Payment Processor</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 sm:p-4 font-bold text-slate-900">
                  Cloudflare<br />
                  <span className="text-xs font-normal text-slate-500">Cloudflare, Inc.</span>
                </td>
                <td className="p-3 sm:p-4">Reverse proxy, CDN edge caching, DNS routing, and DDoS mitigation</td>
                <td className="p-3 sm:p-4">Network request headers, client IP addresses, edge traffic telemetry</td>
                <td className="p-3 sm:p-4">Infrastructure &amp; Security Provider</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 sm:p-4 font-bold text-slate-900">
                  Transactional Email Service<br />
                  <span className="text-xs font-normal text-slate-500">SMTP / Delivery Gateway</span>
                </td>
                <td className="p-3 sm:p-4">Dispatch of automated security alerts, SSL expiry notices, and system communications</td>
                <td className="p-3 sm:p-4">Recipient email address, notification content, message delivery metadata</td>
                <td className="p-3 sm:p-4">Communication Provider</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 sm:p-4 font-bold text-slate-900">
                  AI Inference Services<br />
                  <span className="text-xs font-normal text-slate-500">Groq Inc. &amp; Google Gemini</span>
                </td>
                <td className="p-3 sm:p-4">AI Security Advisor explanations and technical remediation guidance (Pro &amp; Agency plans)</td>
                <td className="p-3 sm:p-4">Anonymized security finding titles and technical observation metadata</td>
                <td className="p-3 sm:p-4">AI Service Provider</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 sm:p-4 font-bold text-slate-900">
                  Cloud Infrastructure<br />
                  <span className="text-xs font-normal text-slate-500">Hosting &amp; Compute Providers</span>
                </td>
                <td className="p-3 sm:p-4">Application hosting, PostgreSQL databases, Redis queues, and task workers</td>
                <td className="p-3 sm:p-4">Platform application data, scan history records, and encrypted system databases</td>
                <td className="p-3 sm:p-4">Core Hosting Provider</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 3 */}
      <section id="authentication-provider" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          3. Authentication Services
        </h2>
        <p>
          SiteSecura utilizes Firebase Authentication to securely manage user registration, identity
          verification, password resets, and session credential validation.
        </p>
        <p>
          Authentication data is processed in accordance with Google&apos;s data privacy standards.
          Passwords are never exposed to or stored by SiteSecura in raw form.
        </p>
      </section>

      {/* SECTION 4 */}
      <section id="payment-processor" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          4. Payment Processing Services
        </h2>
        <p>
          Subscription billing and checkout sessions are operated via Stripe. Stripe acts as an
          independent data controller for payment card handling under PCI-DSS Level 1 certification.
        </p>
        <p>
          SiteSecura maintains only Stripe customer tokens and subscription status references to
          manage plan entitlements; raw payment card numbers never traverse or reside on SiteSecura
          servers.
        </p>
      </section>

      {/* SECTION 5 */}
      <section id="data-sharing-principles" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          5. Data Minimization &amp; Sharing
        </h2>
        <p>
          We adhere to strict data minimization principles. Subprocessors receive only the technical
          information reasonably necessary to deliver their respective services.
        </p>
        <p>
          The precise data exchanged depends on the features and subscription tier utilized. For
          example, customers on plans without AI features enabled do not transmit finding data to AI
          inference providers.
        </p>
      </section>

      {/* SECTION 6 */}
      <section id="provider-changes" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">6. Provider Updates</h2>
        <p>
          As SiteSecura expands and optimizes platform performance, we may add, retire, or replace
          third-party providers. When material changes occur, this inventory will be updated
          accordingly with a revised &quot;Last Updated&quot; date.
        </p>
      </section>

      {/* SECTION 7 */}
      <section id="contact" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">7. Inquiries &amp; Contact</h2>
        <p>If you have questions regarding third-party subprocessors or data handling practices:</p>
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs sm:text-sm space-y-2">
          <p><strong>Entity:</strong> {LEGAL_CONFIG.COMPANY_NAME}</p>
          <p><strong>Privacy &amp; Compliance Inquiries:</strong> <a href={`mailto:${LEGAL_CONFIG.CONTACT_EMAIL}`} className="text-sky-600 underline font-semibold">{LEGAL_CONFIG.CONTACT_EMAIL_PLACEHOLDER}</a></p>
          <p><strong>Registered Address:</strong> {LEGAL_CONFIG.BUSINESS_ADDRESS}</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}
