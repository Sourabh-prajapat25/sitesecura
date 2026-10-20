import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout, LegalCallout, TocItem } from "@/components/legal/LegalPageLayout";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Fair Usage Policy | SiteSecura",
  description:
    "SiteSecura usage limits, rate limits and responsible-use requirements designed to maintain reliable access for all customers.",
  robots: {
    index: true,
    follow: true,
  },
};

const TOC: TocItem[] = [
  { id: "why-limits-exist", title: "1. Why Usage Limits Exist" },
  { id: "plan-based-usage", title: "2. Plan-Based Usage Limits" },
  { id: "anonymous-usage", title: "3. Anonymous Public Usage" },
  { id: "rate-limiting", title: "4. Technical Rate Limiting" },
  { id: "prohibited-usage", title: "5. Prohibited Usage" },
  { id: "fair-resource-use", title: "6. Fair Resource Use" },
  { id: "api-and-automation", title: "7. API and Automation" },
  { id: "excessive-usage", title: "8. Excessive Usage Reviews" },
  { id: "changes-to-limits", title: "9. Changes to Limits" },
  { id: "contact", title: "10. Inquiries and Contact" },
];

export default function FairUsagePage() {
  return (
    <LegalPageLayout
      title="Fair Usage Policy"
      description="Usage limits and responsible-use requirements designed to maintain reliable access to SiteSecura for all customers."
      effectiveDate={LEGAL_CONFIG.LAST_UPDATED}
      toc={TOC}
    >
      {/* Intro */}
      <div className="space-y-4">
        <p>
          SiteSecura provides automated defensive cybersecurity assessment tools designed to help
          website owners, developers, and organizations understand and improve their public security
          posture.
        </p>
        <p>
          Because SiteSecura operates shared scanning, reporting, monitoring, and infrastructure
          resources, reasonable usage limits and technical safeguards are necessary to maintain
          service stability, prevent abuse, and provide reliable access across all customers.
        </p>
        <p>
          This Fair Usage Policy explains how usage limits, rate limiting, and prohibited activities
          are handled across our platform. This policy should be read together with our{" "}
          <Link href="/terms" className="text-sky-600 hover:text-sky-700 underline font-semibold">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/authorized-scanning"
            className="text-sky-600 hover:text-sky-700 underline font-semibold"
          >
            Authorized Scanning Policy
          </Link>
          .
        </p>
      </div>

      <LegalCallout variant="info">
        <strong>Resource Protection:</strong> Quotas and rate limits ensure that shared scanning
        workers and network probes remain fast, responsive, and available for all authorized users.
      </LegalCallout>

      {/* SECTION 1 */}
      <section id="why-limits-exist" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          1. Why Usage Limits Exist
        </h2>
        <p>Usage limits help SiteSecura:</p>
        <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
          <li>Maintain infrastructure stability and avoid network congestion;</li>
          <li>Prevent automated abuse, scraping, and denial-of-service traffic;</li>
          <li>Protect shared scanning workers and task execution queues;</li>
          <li>Reduce excessive resource consumption on third-party target hosts;</li>
          <li>Protect other customers from noisy-neighbor resource exhaustion;</li>
          <li>Maintain reasonable and consistent service availability; and</li>
          <li>Enforce subscription-plan entitlements fairly.</li>
        </ul>
        <p>
          Limits apply to scans, registered websites, monitored domains, API requests, report
          exports, AI-assisted explanations, team member seats, and historical data storage.
        </p>
      </section>

      {/* SECTION 2 */}
      <section id="plan-based-usage" className="space-y-4 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          2. Plan-Based Usage Limits
        </h2>
        <p>
          Account resource limits are determined authoritatively by your active subscription plan.
          The current production quota matrix is outlined below:
        </p>

        {/* Responsive Table of Quotas */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3 sm:p-4">Plan Tier</th>
                <th className="p-3 sm:p-4">Max Websites</th>
                <th className="p-3 sm:p-4">Monthly Scans</th>
                <th className="p-3 sm:p-4">Monitoring Frequency</th>
                <th className="p-3 sm:p-4">History Retention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 sm:p-4 font-bold text-slate-900">Anonymous</td>
                <td className="p-3 sm:p-4">—</td>
                <td className="p-3 sm:p-4">3 scans / 24 hours (per IP)</td>
                <td className="p-3 sm:p-4">Not available</td>
                <td className="p-3 sm:p-4">Ephemeral</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 sm:p-4 font-bold text-slate-900">Free</td>
                <td className="p-3 sm:p-4">1 website</td>
                <td className="p-3 sm:p-4">10 scans / month</td>
                <td className="p-3 sm:p-4">Not available</td>
                <td className="p-3 sm:p-4">7 days</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 sm:p-4 font-bold text-sky-800">Basic</td>
                <td className="p-3 sm:p-4">Up to 2 websites</td>
                <td className="p-3 sm:p-4">100 scans / month</td>
                <td className="p-3 sm:p-4">Weekly automated checks</td>
                <td className="p-3 sm:p-4">30 days</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 sm:p-4 font-bold text-sky-800">Pro</td>
                <td className="p-3 sm:p-4">Up to 10 websites</td>
                <td className="p-3 sm:p-4">500 scans / month</td>
                <td className="p-3 sm:p-4">Daily automated checks</td>
                <td className="p-3 sm:p-4">90 days</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 sm:p-4 font-bold text-purple-800">Agency</td>
                <td className="p-3 sm:p-4">Up to 100 websites</td>
                <td className="p-3 sm:p-4">3,000 scans / month</td>
                <td className="p-3 sm:p-4">Daily automated checks</td>
                <td className="p-3 sm:p-4">365 days</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500 italic">
          Plan scan quotas reset automatically at the beginning of each calendar month (00:00 UTC).
          Unused scan allowances do not roll over to subsequent months.
        </p>
      </section>

      {/* SECTION 3 */}
      <section id="anonymous-usage" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          3. Anonymous Public Usage
        </h2>
        <p>
          Unauthenticated visitors using the homepage scanner are subject to automated safeguards to
          prevent proxy abuse:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li><strong>IP-Based Daily Limits:</strong> A maximum of 3 free scans per 24-hour window per client IP;</li>
          <li><strong>Minimum Scan Intervals:</strong> Cooldown periods between consecutive requests to the same target domain;</li>
          <li><strong>Automated Abuse Detection:</strong> Rapid sequential requests from the same network subnet will trigger temporary rate limits; and</li>
          <li><strong>Public Scan Mode:</strong> Scans run without permanent account history association.</li>
        </ul>
        <p>
          Anonymous usage thresholds may be calibrated dynamically based on real-time infrastructure
          capacity and global threat activity.
        </p>
      </section>

      {/* SECTION 4 */}
      <section id="rate-limiting" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          4. Technical Rate Limiting
        </h2>
        <p>
          SiteSecura implements layered rate limiting across public entry points, authenticated APIs,
          and task dispatcher queues. Technical controls include:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li><strong>Burst Rate Limiting:</strong> A maximum of 20 scan requests per minute for authenticated users;</li>
          <li><strong>API Concurrency Protections:</strong> Limits on simultaneous long-running Deep Scans to maintain worker queue health;</li>
          <li><strong>Report Generation Caps:</strong> Throttles on rapid bulk PDF generation to prevent worker exhaustion; and</li>
          <li><strong>AI Feature Rate Limits:</strong> Up to 20 AI Security Advisor requests per minute per user.</li>
        </ul>
        <p>
          When a rate limit is exceeded, the server returns an HTTP <code>429 Too Many Requests</code>{" "}
          status code with a <code>Retry-After</code> indicator. Users and automated clients must
          honor rate-limit headers.
        </p>
      </section>

      {/* SECTION 5 */}
      <section id="prohibited-usage" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">5. Prohibited Usage</h2>
        <p className="font-semibold text-slate-800">You must not use SiteSecura to:</p>
        <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
          <li>Conduct scans against domains you do not own or lack verifiable authorization to assess;</li>
          <li>Conduct broad, untargeted, or Internet-wide automated reconnaissance;</li>
          <li>Automate excessive scan submissions using headless bots, scrapers, or scripts;</li>
          <li>Circumvent plan scan quotas or rate-limit thresholds;</li>
          <li>Register multiple free accounts or use burner email addresses to bypass subscription limits;</li>
          <li>Rotate proxy IP addresses or spoof user agents to evade abuse controls;</li>
          <li>Use SiteSecura as an intermediary proxy for scanning private networks or cloud metadata;</li>
          <li>Deliberately trigger resource exhaustion or denial-of-service conditions; or</li>
          <li>Exploit platform implementation nuances to obtain unentitled feature access.</li>
        </ul>
        <p>
          Violations of these prohibitions may lead to immediate IP blacklisting and account termination.
          For full guidelines, review our{" "}
          <Link
            href="/authorized-scanning"
            className="text-sky-600 hover:text-sky-700 underline font-semibold"
          >
            Authorized Scanning Policy
          </Link>
          .
        </p>
      </section>

      {/* SECTION 6 */}
      <section id="fair-resource-use" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">6. Fair Resource Use</h2>
        <p>
          SiteSecura monitors aggregate resource consumption to identify anomalous or abusive activity.
          We reserve the right to apply temporary restrictions where reasonably necessary to protect
          platform integrity. Temporary restrictions may include request throttling, temporary scan
          delays, or temporary account locks pending review.
        </p>
        <p>
          Where reasonably practicable, legitimate customers will receive in-app alerts or email
          notifications if unusual patterns trigger temporary restrictions.
        </p>
      </section>

      {/* SECTION 7 */}
      <section id="api-and-automation" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">7. API and Automation</h2>
        <p>
          Where API access is provided, API usage is subject to the applicable plan limits, documentation,
          and authentication requirements. Automated scripts and CI/CD pipelines must:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>Implement exponential backoff when handling HTTP 429 or 503 responses;</li>
          <li>Include appropriate user-agent identifiers; and</li>
          <li>Never use the API to circumvent account-level or website-level plan restrictions.</li>
        </ul>
      </section>

      {/* SECTION 8 */}
      <section id="excessive-usage" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          8. Excessive Usage Reviews
        </h2>
        <p>
          SiteSecura may review accounts generating unusually high operational overhead. High resource
          consumption does not automatically imply malicious intent; we evaluate:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>Request volume and scan scheduling intervals;</li>
          <li>Concurrent scan concurrency against single target hosts;</li>
          <li>High error rates or repeated scans against unreachable targets; and</li>
          <li>Impact on shared system queues and downstream network bandwidth.</li>
        </ul>
        <p>
          Where appropriate, our technical support team will contact the customer to explore plan
          adjustments or scheduling optimizations before taking restrictive measures, unless immediate
          action is necessary to protect the platform.
        </p>
      </section>

      {/* SECTION 9 */}
      <section id="changes-to-limits" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">9. Changes to Limits</h2>
        <p>
          SiteSecura may adjust usage allowances, rate limits, and plan features as our infrastructure
          expands, security requirements adapt, and scanner capabilities evolve.
        </p>
        <p>
          Where a modification materially affects an active paid subscription, advance notice will be
          communicated in accordance with our{" "}
          <Link href="/terms" className="text-sky-600 hover:text-sky-700 underline font-semibold">
            Terms of Service
          </Link>
          .
        </p>
      </section>

      {/* SECTION 10 */}
      <section id="contact" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">10. Inquiries and Contact</h2>
        <p>If you have questions regarding plan allowances, quota increases, or fair usage policies:</p>
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs sm:text-sm space-y-2">
          <p><strong>Entity:</strong> {LEGAL_CONFIG.COMPANY_NAME}</p>
          <p><strong>Usage &amp; Billing Inquiries:</strong> <a href={`mailto:${LEGAL_CONFIG.CONTACT_EMAIL}`} className="text-sky-600 underline font-semibold">{LEGAL_CONFIG.CONTACT_EMAIL_PLACEHOLDER}</a></p>
          <p><strong>Security Reports:</strong> <a href={`mailto:${LEGAL_CONFIG.SECURITY_EMAIL}`} className="text-sky-600 underline font-semibold">{LEGAL_CONFIG.SECURITY_EMAIL_PLACEHOLDER}</a></p>
          <p><strong>Registered Address:</strong> {LEGAL_CONFIG.BUSINESS_ADDRESS}</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}
