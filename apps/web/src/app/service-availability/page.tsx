import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout, LegalCallout, TocItem } from "@/components/legal/LegalPageLayout";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Service Availability | SiteSecura",
  description:
    "Information about SiteSecura availability, maintenance, monitoring and service interruptions.",
  robots: {
    index: true,
    follow: true,
  },
};

const TOC: TocItem[] = [
  { id: "service-availability", title: "1. Service Availability Standard" },
  { id: "possible-interruptions", title: "2. Possible Service Interruptions" },
  { id: "scanning-availability", title: "3. Scanning Operations & Delays" },
  { id: "monitoring-availability", title: "4. Automated Monitoring Operations" },
  { id: "alert-delivery", title: "5. Alert Delivery Factors" },
  { id: "maintenance-windows", title: "6. Scheduled & Emergency Maintenance" },
  { id: "third-party-dependencies", title: "7. Third-Party Dependencies" },
  { id: "no-sla-disclaimer", title: "8. No SLA Disclaimer" },
  { id: "status-information", title: "9. System Status & Telemetry" },
  { id: "contact", title: "10. Support Contact" },
];

export default function ServiceAvailabilityPage() {
  return (
    <LegalPageLayout
      title="Service Availability"
      description="Information regarding SiteSecura's service uptime objectives, scheduled maintenance, scanning throughput, and operational continuity."
      effectiveDate={LEGAL_CONFIG.LAST_UPDATED}
      toc={TOC}
    >
      {/* Prominent No-SLA Callout */}
      <LegalCallout variant="warning" title="INFORMATIONAL NOTICE — NO SLA">
        <p className="text-sm font-semibold">
          Unless a separate written agreement states otherwise, this page does not create a
          service-level agreement, uptime guarantee, service credit obligation or guaranteed response time.
        </p>
      </LegalCallout>

      {/* SECTION 1 */}
      <section id="service-availability" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          1. Service Availability Standard
        </h2>
        <p>
          SiteSecura is engineered to deliver dependable, high-performance access to automated
          website security assessments, interactive audit dashboards, historical trend tracking, and
          continuous monitoring.
        </p>
        <p>
          However, unless a separate written enterprise agreement executed by an authorized officer of
          SiteSecura expressly provides otherwise, SiteSecura does not guarantee uninterrupted,
          error-free, or zero-downtime platform availability.
        </p>
      </section>

      {/* SECTION 2 */}
      <section id="possible-interruptions" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          2. Possible Service Interruptions
        </h2>
        <p>Service accessibility and scan performance may be impacted from time to time by:</p>
        <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
          <li>Planned system maintenance, security upgrades, and routine software deployments;</li>
          <li>Emergency hotfixes required to mitigate unexpected operational or security vulnerabilities;</li>
          <li>Cloud hosting provider infrastructure disruptions, hardware faults, or power outages;</li>
          <li>Upstream Internet transit congestion, routing anomalies, or Tier 1 fiber cuts;</li>
          <li>Global DNS resolution propagation delays or regional DNS service failures;</li>
          <li>Distributed denial-of-service (DDoS) attacks directed against our network or upstream providers;</li>
          <li>Third-party dependency outages (e.g., payment gateways or authentication providers); or</li>
          <li>Circumstances beyond SiteSecura&apos;s reasonable foresight and control.</li>
        </ul>
      </section>

      {/* SECTION 3 */}
      <section id="scanning-availability" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          3. Scanning Operations &amp; Delays
        </h2>
        <p>
          Individual scans are queued and executed asynchronously across background task workers.
          A scan may experience delays or fail to complete due to:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>Global scan queue depth during peak traffic surges;</li>
          <li>Target web server unresponsiveness, slow TLS handshakes, or TCP connection timeouts;</li>
          <li>Rate limiting or web application firewall (WAF) blocking initiated by the target server;</li>
          <li>Temporary DNS resolution failure for the target domain; or</li>
          <li>SSRF safety triggers disallowing private or non-routable destination IPs.</li>
        </ul>
        <p className="text-xs text-slate-500 italic">
          Important: An incomplete or failed scan does not necessarily indicate that your website is
          insecure or offline. It may reflect network packet loss or target-side edge blocking.
        </p>
      </section>

      {/* SECTION 4 */}
      <section id="monitoring-availability" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          4. Automated Monitoring Operations
        </h2>
        <p>
          Subscribed accounts with monitoring enabled receive automated periodic checks (weekly on
          Basic, daily on Pro and Agency plans).
        </p>
        <p>
          Monitoring functionality is delivered on a best-effort operational basis. SiteSecura does
          not guarantee the detection of every configuration modification, instant alert transmission,
          or uninterrupted monitoring continuity. Users must not rely solely on SiteSecura as their
          exclusive monitoring mechanism for mission-critical infrastructure.
        </p>
      </section>

      {/* SECTION 5 */}
      <section id="alert-delivery" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          5. Alert Delivery Factors
        </h2>
        <p>
          Security notifications and SSL expiration warnings depend partially on external transit
          networks and receiving email servers.
        </p>
        <p>
          An email alert may be delayed, rate-limited, filtered to spam folders, or rejected by the
          recipient&apos;s mail server. We recommend adding our sending domains to your organization&apos;s
          email allowlist.
        </p>
      </section>

      {/* SECTION 6 */}
      <section id="maintenance-windows" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          6. Scheduled &amp; Emergency Maintenance
        </h2>
        <p>
          To maintain high security and performance, SiteSecura performs regular infrastructure
          maintenance and database optimizations:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li><strong>Scheduled Maintenance:</strong> Where reasonably practicable, advance notice of major maintenance windows expected to cause service degradation will be posted in advance; and</li>
          <li><strong>Emergency Maintenance:</strong> Urgent patches, critical bug fixes, or infrastructure isolation required to protect customer data may occur without prior notification.</li>
        </ul>
      </section>

      {/* SECTION 7 */}
      <section id="third-party-dependencies" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          7. Third-Party Dependencies
        </h2>
        <p>
          SiteSecura relies on specialized external providers for authentication, payment processing,
          and network caching. An upstream incident affecting these partners may temporarily impact
          corresponding features on SiteSecura.
        </p>
        <p>
          A full inventory of third-party services is maintained on our{" "}
          <Link
            href="/subprocessors"
            className="text-sky-600 hover:text-sky-700 underline font-semibold"
          >
            Subprocessors &amp; Third-Party Services
          </Link>{" "}
          page.
        </p>
      </section>

      {/* SECTION 8 */}
      <section id="no-sla-disclaimer" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          8. No SLA Disclaimer
        </h2>
        <p>
          This document is published solely for informational transparency regarding operational
          practices. Nothing herein shall be construed as a binding service-level agreement (SLA),
          an uptime warranty, a service credit schedule, or a legally enforceable performance guarantee.
        </p>
      </section>

      {/* SECTION 9 */}
      <section id="status-information" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          9. System Status &amp; Telemetry
        </h2>
        <p>
          For real-time operational indicators and component health, visit our official system status
          dashboard:
        </p>
        <div className="pt-2">
          <Link
            href="/status"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition-colors"
          >
            View Live System Status →
          </Link>
        </div>
      </section>

      {/* SECTION 10 */}
      <section id="contact" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">10. Support Contact</h2>
        <p>If you experience service interruptions or need operational assistance:</p>
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs sm:text-sm space-y-2">
          <p><strong>Entity:</strong> {LEGAL_CONFIG.COMPANY_NAME}</p>
          <p><strong>Technical Support:</strong> <a href={`mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}`} className="text-sky-600 underline font-semibold">{LEGAL_CONFIG.SUPPORT_EMAIL}</a></p>
          <p><strong>Legal &amp; Compliance Inquiries:</strong> <a href={`mailto:${LEGAL_CONFIG.CONTACT_EMAIL}`} className="text-sky-600 underline font-semibold">{LEGAL_CONFIG.CONTACT_EMAIL_PLACEHOLDER}</a></p>
          <p><strong>Registered Address:</strong> {LEGAL_CONFIG.BUSINESS_ADDRESS}</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}
