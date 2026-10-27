import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout, LegalCallout, TocItem } from "@/components/legal/LegalPageLayout";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Cookie Policy | SiteSecura",
  description: "Learn how SiteSecura uses cookies and similar technologies.",
  robots: {
    index: true,
    follow: true,
  },
};

const TOC: TocItem[] = [
  { id: "what-are-cookies", title: "1. What Are Cookies?" },
  { id: "essential-cookies", title: "2. Essential Cookies" },
  { id: "preference-cookies", title: "3. Preference Cookies" },
  { id: "analytics-cookies", title: "4. Analytics Technologies" },
  { id: "third-party-technologies", title: "5. Third-Party Technologies" },
  { id: "managing-cookies", title: "6. Managing Cookies" },
  { id: "updates", title: "7. Updates to This Policy" },
  { id: "contact", title: "8. Contact Us" },
];

export default function CookiePolicyPage() {
  return (
    <LegalPageLayout
      title="Cookie Policy"
      description="How SiteSecura uses cookies, local storage, and similar technologies to operate, secure, and improve our website security assessment platform."
      effectiveDate={LEGAL_CONFIG.LAST_UPDATED}
      toc={TOC}
    >
      {/* Intro */}
      <div className="space-y-4">
        <p>
          This Cookie Policy explains how {LEGAL_CONFIG.ENTITY_DBA} (&quot;SiteSecura&quot;,
          &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) uses cookies and similar technologies
          to recognize you when you visit our website, dashboard, and related online services.
        </p>
        <p>
          It explains what these technologies are, why we use them, and your rights to control our use of them.
        </p>
      </div>

      <LegalCallout variant="info">
        <strong>Privacy First:</strong> SiteSecura prioritizes defensive security hygiene. We do not
        deploy invasive third-party advertising trackers or sell your browsing history.
      </LegalCallout>

      {/* SECTION 1 */}
      <section id="what-are-cookies" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">1. What Are Cookies?</h2>
        <p>
          Cookies are small text files that are stored on your computer, smartphone, or tablet when you
          access a website. They are widely used by web applications to ensure seamless navigation,
          maintain user authentication states, remember user preferences, and safeguard platform security.
        </p>
        <p>
          In addition to cookies, we may also use browser local storage and session storage to manage
          temporary interface states, such as active tab selections or dismissible banners.
        </p>
      </section>

      {/* SECTION 2 */}
      <section id="essential-cookies" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">2. Essential Cookies</h2>
        <p>
          Essential cookies are strictly necessary to provide you with services available through our
          platform and to use its features securely. Without these cookies, basic platform operations
          cannot be delivered.
        </p>
        <p>Essential cookies are used for:</p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li><strong>Authentication &amp; Identity:</strong> Maintaining secure login sessions via Firebase Authentication tokens;</li>
          <li><strong>CSRF &amp; State Protection:</strong> Verifying requests and preventing cross-site request forgery attacks;</li>
          <li><strong>Consent State:</strong> Recording your acknowledgment of legal notices and policies; and</li>
          <li><strong>Security Gateways:</strong> Protecting against automated denial-of-service and brute-force traffic.</li>
        </ul>
      </section>

      {/* SECTION 3 */}
      <section id="preference-cookies" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">3. Preference Cookies</h2>
        <p>
          Preference technologies allow our application to remember choices you make during your
          session to enhance and personalize your user experience. These include:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>Dashboard display settings and active tab selections;</li>
          <li>Sort preferences on security check catalogs and scan history lists; and</li>
          <li>Notification preferences and dismissed guidance banners.</li>
        </ul>
      </section>

      {/* SECTION 4 */}
      <section id="analytics-cookies" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">4. Analytics Technologies</h2>
        <p>
          If analytics technologies are enabled, SiteSecura uses aggregated, privacy-conscious metrics
          to understand how our service is utilized, diagnose server errors, evaluate feature adoption,
          and optimize scan performance.
        </p>
        <p>
          Analytics data is gathered in aggregate and is not used to build invasive cross-site advertising profiles.
        </p>
      </section>

      {/* SECTION 5 */}
      <section id="third-party-technologies" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">5. Third-Party Technologies</h2>
        <p>
          Certain third-party service providers integrated into SiteSecura may place technical cookies
          on your browser, including:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li><strong>Firebase Authentication (Google):</strong> Verifies secure session tokens and multi-factor authentication;</li>
          <li><strong>Stripe &amp; Razorpay:</strong> Process checkout interactions and perform fraud-detection checks during subscription checkout; and</li>
          <li><strong>Cloudflare:</strong> Manages web application firewall protection and rate-limiting enforcement.</li>
        </ul>
        <p>
          These providers operate under their respective terms and data protection policies.
        </p>
      </section>

      {/* SECTION 6 */}
      <section id="managing-cookies" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">6. Managing Cookies</h2>
        <p>
          You have the right to decide whether to accept or reject cookies. Most web browsers allow you
          to view, manage, delete, and block cookies through their preference settings:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li><strong>Google Chrome:</strong> Settings → Privacy and Security → Cookies and other site data</li>
          <li><strong>Mozilla Firefox:</strong> Settings → Privacy &amp; Security → Cookies and Site Data</li>
          <li><strong>Apple Safari:</strong> Preferences → Privacy → Manage Website Data</li>
          <li><strong>Microsoft Edge:</strong> Settings → Cookies and site permissions</li>
        </ul>
        <p>
          <em>Please note:</em> If you choose to block all cookies, you may not be able to log in, access
          your dashboard, or perform authenticated website security scans.
        </p>
      </section>

      {/* SECTION 7 */}
      <section id="updates" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">7. Updates to This Policy</h2>
        <p>
          We may update this Cookie Policy from time to time to reflect modifications to our technical
          architecture or evolving legal requirements. When updates are published, the &quot;Last
          Updated&quot; date will be adjusted accordingly.
        </p>
      </section>

      {/* SECTION 8 */}
      <section id="contact" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">8. Contact Us</h2>
        <p>If you have questions about our use of cookies or related tracking technologies, contact:</p>
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs sm:text-sm space-y-2">
          <p><strong>Entity:</strong> {LEGAL_CONFIG.COMPANY_NAME}</p>
          <p><strong>Legal &amp; Privacy Contact:</strong> <a href={`mailto:${LEGAL_CONFIG.CONTACT_EMAIL}`} className="text-sky-600 underline">{LEGAL_CONFIG.CONTACT_EMAIL_PLACEHOLDER}</a></p>
          <p><strong>Registered Address:</strong> {LEGAL_CONFIG.BUSINESS_ADDRESS}</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}
