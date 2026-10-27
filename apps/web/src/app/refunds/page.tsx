import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout, LegalCallout, TocItem } from "@/components/legal/LegalPageLayout";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy | SiteSecura",
  description:
    "Information about SiteSecura subscription cancellation, billing periods and refunds.",
  robots: {
    index: true,
    follow: true,
  },
};

const TOC: TocItem[] = [
  { id: "subscription-cancellation", title: "1. Subscription Cancellation" },
  { id: "access-after-cancellation", title: "2. Access After Cancellation" },
  { id: "refund-eligibility", title: "3. Refund Terms & Eligibility" },
  { id: "billing-errors", title: "4. Billing Errors & Inquiries" },
  { id: "failed-payments", title: "5. Failed Payments & Grace Periods" },
  { id: "promotional-offers", title: "6. Promotional Offers & Trials" },
  { id: "chargebacks", title: "7. Chargebacks & Billing Disputes" },
  { id: "contact", title: "8. Billing Support Contact" },
];

export default function RefundsPage() {
  return (
    <LegalPageLayout
      title="Refund & Cancellation Policy"
      description="Clear information on managing your SiteSecura subscription, cancellation procedures, billing cycles, and refund eligibility."
      effectiveDate={LEGAL_CONFIG.LAST_UPDATED}
      toc={TOC}
    >
      {/* Intro */}
      <div className="space-y-4">
        <p>
          This Refund &amp; Cancellation Policy governs subscription cancellations and billing inquiries
          for services provided by {LEGAL_CONFIG.ENTITY_DBA} (&quot;SiteSecura&quot;, &quot;we&quot;,
          &quot;us&quot;, or &quot;our&quot;).
        </p>
        <p>
          We are committed to transparent pricing, straightforward subscription management, and fair
          resolution of billing questions.
        </p>
      </div>

      <LegalCallout variant="info">
        <strong>Self-Serve Cancellation:</strong> You can cancel your paid subscription at any time
        directly from your SiteSecura dashboard billing settings or through the secure payment customer portal.
      </LegalCallout>

      {/* SECTION 1 */}
      <section id="subscription-cancellation" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          1. Subscription Cancellation
        </h2>
        <p>
          You may cancel your SiteSecura paid subscription (Basic, Pro, or Agency) at any time. To
          cancel:
        </p>
        <ol className="list-decimal pl-6 space-y-1.5 text-slate-600">
          <li>Log into your account and navigate to <strong>Dashboard → Settings → Billing</strong>;</li>
          <li>Click <strong>Manage Subscription</strong> or <strong>Cancel Subscription</strong> within your billing settings; and</li>
          <li>Select <strong>Cancel Subscription</strong> and confirm your request.</li>
        </ol>
        <p>
          Unless otherwise stated, cancellation immediately halts future recurring renewal charges for
          subsequent billing cycles.
        </p>
      </section>

      {/* SECTION 2 */}
      <section id="access-after-cancellation" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          2. Access After Cancellation
        </h2>
        <p>
          When you cancel a subscription, paid features (including increased scan allowances, automated
          monitoring frequencies, white-label exports, and team member seats) remain active through
          the conclusion of your current paid billing period.
        </p>
        <p>
          At the end of your billing cycle, your account will automatically transition to our Free
          plan tier. Your historical scan records will transition to the Free plan retention schedule
          (7 days), and monitored websites exceeding the Free tier quota will be paused.
        </p>
      </section>

      {/* SECTION 3 */}
      <section id="refund-eligibility" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          3. Refund Terms &amp; Eligibility
        </h2>
        <p>
          Because SiteSecura provides immediate, on-demand automated cybersecurity scanning and
          infrastructure resources upon subscription activation:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
          <li>Subscription payments are generally non-refundable for periods that have already been billed;</li>
          <li>We do not offer prorated refunds for mid-cycle cancellations; and</li>
          <li>Prepaid annual or multi-month commitments are non-refundable once the billing period has commenced, except where mandated by statutory law.</li>
        </ul>
        <p>
          Where required by applicable consumer protection laws in your jurisdiction, statutory cooling-off
          rights or non-waivable refund remedies are preserved.
        </p>
      </section>

      {/* SECTION 4 */}
      <section id="billing-errors" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          4. Billing Errors &amp; Inquiries
        </h2>
        <p>
          If you believe you have experienced an incorrect charge, duplicate billing, or technical
          payment error, please contact us promptly at{" "}
          <a href={`mailto:${LEGAL_CONFIG.CONTACT_EMAIL}`} className="text-sky-600 underline font-semibold">
            {LEGAL_CONFIG.CONTACT_EMAIL_PLACEHOLDER}
          </a>
          .
        </p>
        <p>
          We will review transaction logs, verify system records, and if a legitimate billing error
          occurred on our platform or payment gateway, we will issue a full refund to your original
          payment method.
        </p>
      </section>

      {/* SECTION 5 */}
      <section id="failed-payments" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          5. Failed Payments &amp; Grace Periods
        </h2>
        <p>
          If a recurring subscription payment fails (e.g., due to an expired credit card or insufficient
          funds), our payment processor will automatically retry the transaction across several days.
        </p>
        <p>
          You will receive an automated email notice to update your billing details. If payment cannot
          be collected after the standard recovery period, paid features and automated monitoring may be
          temporarily suspended until payment is resolved.
        </p>
      </section>

      {/* SECTION 6 */}
      <section id="promotional-offers" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          6. Promotional Offers &amp; Trials
        </h2>
        <p>
          Promotional discounts, coupon codes, and introductory trial periods may be subject to specific
          terms and limits disclosed at checkout. At the conclusion of a promotional duration, the
          subscription will renew at the standard published rate unless cancelled prior to the renewal date.
        </p>
      </section>

      {/* SECTION 7 */}
      <section id="chargebacks" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          7. Chargebacks &amp; Billing Disputes
        </h2>
        <p>
          We strongly encourage customers to contact our support team first regarding any billing concern.
          Initiating an unwarranted payment dispute or chargeback without prior communication may result
          in immediate account suspension pending resolution.
        </p>
        <p>
          Nothing in this policy limits rights that cannot legally be waived under applicable consumer protection legislation.
        </p>
      </section>

      {/* SECTION 8 */}
      <section id="contact" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          8. Billing Support Contact
        </h2>
        <p>For assistance with billing inquiries, invoices, or cancellation support:</p>
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs sm:text-sm space-y-2">
          <p><strong>Entity:</strong> {LEGAL_CONFIG.COMPANY_NAME}</p>
          <p><strong>Billing Support:</strong> <a href={`mailto:${LEGAL_CONFIG.CONTACT_EMAIL}`} className="text-sky-600 underline">{LEGAL_CONFIG.CONTACT_EMAIL_PLACEHOLDER}</a></p>
          <p><strong>Registered Address:</strong> {LEGAL_CONFIG.BUSINESS_ADDRESS}</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}
