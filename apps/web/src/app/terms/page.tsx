import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout, LegalCallout, TocItem } from "@/components/legal/LegalPageLayout";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Terms of Service | SiteSecura",
  description:
    "Terms governing the use of SiteSecura's website security assessment, monitoring, reporting and related services.",
  robots: {
    index: true,
    follow: true,
  },
};

const TOC: TocItem[] = [
  { id: "description-of-service", title: "1. Description of the Service" },
  { id: "authorization-to-scan", title: "2. Authorization to Scan" },
  { id: "nature-of-assessments", title: "3. Nature of Security Assessments" },
  { id: "no-guarantee-of-security", title: "4. No Guarantee of Security" },
  { id: "scores-and-findings", title: "5. Security Scores and Findings" },
  { id: "ai-generated-content", title: "6. AI-Generated Content" },
  { id: "prohibited-activities", title: "7. Prohibited Activities" },
  { id: "account-registration", title: "8. Account Registration" },
  { id: "organization-accounts", title: "9. Organization and Agency Accounts" },
  { id: "reports", title: "10. Reports" },
  { id: "monitoring-and-alerts", title: "11. Monitoring and Alerts" },
  { id: "third-party-services", title: "12. Third-Party Services" },
  { id: "subscriptions-and-billing", title: "13. Subscriptions and Billing" },
  { id: "cancellation", title: "14. Cancellation" },
  { id: "refunds", title: "15. Refunds" },
  { id: "promotional-offers", title: "16. Free Trials & Promotional Offers" },
  { id: "usage-limits", title: "17. Usage Limits" },
  { id: "suspension-and-termination", title: "18. Suspension and Termination" },
  { id: "intellectual-property", title: "19. Intellectual Property" },
  { id: "your-data", title: "20. Your Data and Content" },
  { id: "confidentiality", title: "21. Confidentiality" },
  { id: "service-availability", title: "22. Service Availability" },
  { id: "disclaimer-of-warranties", title: "23. Disclaimer of Warranties" },
  { id: "limitation-of-liability", title: "24. Limitation of Liability" },
  { id: "indemnification", title: "25. Indemnification" },
  { id: "changes-to-service", title: "26. Changes to the Service" },
  { id: "changes-to-terms", title: "27. Changes to These Terms" },
  { id: "governing-law", title: "28. Governing Law and Disputes" },
  { id: "contact", title: "29. Contact Information" },
];

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      description="These Terms of Service govern your access to and use of SiteSecura's website security assessment tools, monitoring services, and reports."
      effectiveDate={LEGAL_CONFIG.LAST_UPDATED}
      toc={TOC}
    >
      {/* Intro */}
      <div className="space-y-4">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the SiteSecura
          website, applications, security assessment tools, reports, monitoring services, APIs,
          documentation, and related services (collectively, the &quot;Service&quot;).
        </p>
        <p>
          The Service is operated by {LEGAL_CONFIG.ENTITY_DBA} (&quot;SiteSecura&quot;, &quot;we&quot;,
          &quot;us&quot;, or &quot;our&quot;).
        </p>
        <p>
          By creating an account, accessing the Service, submitting a website for scanning, purchasing
          a subscription, or otherwise using the Service, you agree to these Terms. If you do not
          agree with these Terms, do not use the Service.
        </p>
      </div>

      <LegalCallout variant="info">
        <strong>Legal Note:</strong> These Terms govern your use of SiteSecura. They should be read
        together with our{" "}
        <Link href="/privacy" className="text-sky-700 underline font-semibold">
          Privacy Policy
        </Link>
        ,{" "}
        <Link href="/cookies" className="text-sky-700 underline font-semibold">
          Cookie Policy
        </Link>
        ,{" "}
        <Link href="/authorized-scanning" className="text-sky-700 underline font-semibold">
          Authorized Scanning Policy
        </Link>
        , and applicable usage and billing policies.
      </LegalCallout>

      {/* SECTION 1 */}
      <section id="description-of-service" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          1. Description of the Service
        </h2>
        <p>
          SiteSecura provides automated website security and security-posture assessment tools.
          Depending on your plan, the Service may provide:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
          <li>Website security scans;</li>
          <li>HTTPS and SSL/TLS configuration checks;</li>
          <li>DNS and email-security checks (including SPF and DMARC);</li>
          <li>HTTP security-header analysis;</li>
          <li>Cookie-security observations;</li>
          <li>Technology stack and server disclosure detection;</li>
          <li>Deterministic security scores;</li>
          <li>Security findings and prioritized recommendations;</li>
          <li>Scan history and trend metrics;</li>
          <li>Interactive security reports and PDF exports;</li>
          <li>Automated website monitoring and SSL expiration alerts;</li>
          <li>AI-assisted explanations or remediation guidance;</li>
          <li>Agency and team-management features;</li>
          <li>Custom white-label reporting for eligible plans; and</li>
          <li>Other features that SiteSecura may introduce from time to time.</li>
        </ul>
        <p>
          SiteSecura is designed primarily to evaluate publicly reachable website and domain
          configuration information. The Service is not intended to replace a professional
          penetration test, vulnerability assessment, secure code review, security architecture
          review, incident-response service, or professional cybersecurity consultancy.
        </p>
      </section>

      {/* SECTION 2 */}
      <section id="authorization-to-scan" className="space-y-4 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">2. Authorization to Scan</h2>
        <p className="font-semibold text-slate-800">
          You may only submit, scan, monitor, or otherwise assess a domain, website, server, or other
          target when:
        </p>
        <ol className="list-decimal pl-6 space-y-1.5 text-slate-700">
          <li>You own the target; or</li>
          <li>You have explicit authorization from the owner or an authorized representative to perform the assessment.</li>
        </ol>
        <p>
          By submitting a target to SiteSecura, you represent and warrant that you have the necessary
          authority to request the assessment. You are solely responsible for ensuring that your use of
          SiteSecura complies with:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>Applicable laws and cybersecurity regulations;</li>
          <li>Contractual obligations;</li>
          <li>Hosting-provider policies and Acceptable Use Policies;</li>
          <li>Target website terms;</li>
          <li>Third-party service agreements;</li>
          <li>Organizational security policies; and</li>
          <li>Any authorization requirements applicable to the target.</li>
        </ul>
        <p>
          SiteSecura does not determine whether you have authorization to scan a target. SiteSecura
          does not grant you permission to scan a third-party system. Submitting a domain to
          SiteSecura does not establish authorization from the domain owner.
        </p>

        <LegalCallout variant="warning" title="CRITICAL AUTHORIZATION WARNING">
          <strong>IMPORTANT:</strong> Using SiteSecura does not itself authorize you to scan a
          website or system. You must have ownership or appropriate authorization before submitting a
          target. For full details, review our{" "}
          <Link href="/authorized-scanning" className="text-amber-900 underline font-semibold">
            Authorized Scanning Policy
          </Link>
          .
        </LegalCallout>
      </section>

      {/* SECTION 3 */}
      <section id="nature-of-assessments" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          3. Nature of Security Assessments
        </h2>
        <p>
          SiteSecura performs automated defensive security checks based on information that can be
          obtained through the Service&apos;s supported scanning methods. Depending on the feature and
          plan, assessments may inspect information such as:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>DNS records and DNSSEC parameters;</li>
          <li>HTTP and HTTPS response headers and redirect behaviors;</li>
          <li>TLS certificates, ciphers, and expiration dates;</li>
          <li>Security headers (e.g., HSTS, CSP, X-Frame-Options);</li>
          <li>Cookie security flags (e.g., Secure, HttpOnly, SameSite);</li>
          <li>Publicly observable technology indicators;</li>
          <li>Supported email-security DNS records (SPF, DMARC); and</li>
          <li>Publicly reachable server configuration information.</li>
        </ul>
        <p>
          The scanner is designed to avoid destructive or intrusive testing. SiteSecura does not
          represent that every possible vulnerability, misconfiguration, weakness, exposure, or
          security issue will be detected. A scan result indicating that a check passed does not mean
          that the target is secure, invulnerable, compliant, or free from vulnerabilities.
        </p>
      </section>

      {/* SECTION 4 */}
      <section id="no-guarantee-of-security" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">4. No Guarantee of Security</h2>
        <p>SiteSecura does not guarantee that:</p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>A website is secure;</li>
          <li>A website is free of vulnerabilities or exploitable defects;</li>
          <li>A website cannot be compromised or subjected to attacks;</li>
          <li>A website will not experience downtime or performance degradation;</li>
          <li>A website will not experience a security incident or data breach;</li>
          <li>A security incident will be prevented;</li>
          <li>All vulnerabilities will be identified by the Service;</li>
          <li>All findings will be accurate, comprehensive, or complete;</li>
          <li>Security scores represent an absolute or exhaustive measurement of security;</li>
          <li>Recommendations will completely remediate any underlying vulnerability; or</li>
          <li>The Service will satisfy a particular compliance, insurance, regulatory, contractual, or security requirement.</li>
        </ul>
        <p>
          Security scores are assessment indicators generated from the checks performed by SiteSecura.
          They should not be interpreted as a certification, seal of approval, or warranty of
          absolute protection.
        </p>
      </section>

      {/* SECTION 5 */}
      <section id="scores-and-findings" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          5. Security Scores and Findings
        </h2>
        <p>
          SiteSecura may calculate security scores using predefined scoring rules and observations
          collected during an assessment. Scores may change when:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>Scanner rules or detection signatures change;</li>
          <li>Scoring methodology is calibrated or upgraded;</li>
          <li>Target website server configuration changes;</li>
          <li>DNS records or hosting providers change;</li>
          <li>TLS certificates change or expire;</li>
          <li>Security headers are modified or removed;</li>
          <li>Additional checks become available on the platform; or</li>
          <li>SiteSecura identifies improvements in its defensive assessment methodology.</li>
        </ul>
        <p>
          A score is an informational security posture indicator, not a universally accepted security
          rating. Findings may contain severity, evidence, technical details, explanations,
          recommendations, estimated remediation time, documentation links, and confidence
          information. You remain responsible for independently validating findings before making
          security, operational, financial, or technical decisions.
        </p>
      </section>

      {/* SECTION 6 */}
      <section id="ai-generated-content" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">6. AI-Generated Content</h2>
        <p>
          Certain SiteSecura plans may include AI-assisted explanations, summaries, recommendations,
          remediation guidance, or other generated content. AI-generated content:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>May contain technical inaccuracies, hallucinations, or incomplete guidance;</li>
          <li>May not be applicable to your specific server architecture or hosting environment;</li>
          <li>Should not be treated as professional cybersecurity or legal advice; and</li>
          <li>Should not be treated as a guarantee that a recommended directive will remediate an issue.</li>
        </ul>
        <p>
          AI-generated content is generated from available scan metadata and may not identify every
          relevant engineering consideration. You are solely responsible for reviewing and testing all
          code snippets or configuration changes in a non-production environment before implementing them.
        </p>
      </section>

      {/* SECTION 7 */}
      <section id="prohibited-activities" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">7. Prohibited Activities</h2>
        <p>You may not use SiteSecura to:</p>
        <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
          <li>Scan websites, hosts, or systems you do not own or lack explicit authorization to assess;</li>
          <li>Conduct unauthorized reconnaissance or vulnerability discovery against third parties;</li>
          <li>Scan private networks, local intranet hosts, or RFC 1918 addresses;</li>
          <li>Scan localhost (127.0.0.1 or ::1);</li>
          <li>Scan cloud metadata endpoints (such as 169.254.169.254);</li>
          <li>Conduct denial-of-service testing or volume flood attacks;</li>
          <li>Perform destructive, invasive, or state-altering security testing;</li>
          <li>Attempt authentication bypass or brute-force user credentials;</li>
          <li>Exploit identified vulnerabilities or deliver exploit payloads;</li>
          <li>Deploy malware, trojans, ransomware, or malicious scripts;</li>
          <li>Intentionally disrupt the availability or operations of a target;</li>
          <li>Perform broad, untargeted, or Internet-wide automated scanning;</li>
          <li>Circumvent SiteSecura&apos;s quota limits, rate limits, or concurrency restrictions;</li>
          <li>Abuse or overload the Service&apos;s infrastructure;</li>
          <li>Use SiteSecura as an anonymous proxy for unauthorized reconnaissance;</li>
          <li>Attempt to access another customer&apos;s organization, websites, or reports;</li>
          <li>Reverse engineer or decompile protected portions of the Service, except where legally non-waivable;</li>
          <li>Circumvent subscription restrictions or feature entitlements;</li>
          <li>Share user credentials in a manner that violates your purchased plan limits; or</li>
          <li>Use the Service in violation of any applicable local, national, or international law.</li>
        </ul>
      </section>

      {/* SECTION 8 */}
      <section id="account-registration" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">8. Account Registration</h2>
        <p>
          You must provide accurate, current, and complete information when creating an account. You
          are responsible for:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>Maintaining the confidentiality and security of your login credentials;</li>
          <li>Maintaining the security of your account and linked API tokens;</li>
          <li>Promptly notifying us of any unauthorized access or security compromise; and</li>
          <li>Ensuring that information associated with your account remains accurate and updated.</li>
        </ul>
        <p>
          You must not create accounts for fraudulent purposes, use automated account-creation
          mechanisms, or impersonate another person or organization.
        </p>
      </section>

      {/* SECTION 9 */}
      <section id="organization-accounts" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          9. Organization and Agency Accounts
        </h2>
        <p>
          If you use SiteSecura on behalf of an organization or agency, you represent and warrant that
          you have full authority to bind that entity to these Terms. Organization administrators may
          have authority to invite team members, manage websites, assign permissions, view and
          delete audit reports, and configure white-label branding.
        </p>
        <p>
          You are responsible for ensuring that all invited team members comply with these Terms. Agency
          customers are strictly responsible for obtaining proper written authorization from their
          clients prior to submitting client web properties to SiteSecura.
        </p>
      </section>

      {/* SECTION 10 */}
      <section id="reports" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">10. Reports</h2>
        <p>
          Reports generated by SiteSecura are provided solely for informational and defensive
          security-assessment purposes. Reports may include security scores, technical findings,
          evidence, recommendations, and historical comparisons. Reports should not be represented as:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>Official security certifications or accreditations;</li>
          <li>Penetration-testing certificates;</li>
          <li>Regulatory compliance certificates (e.g., SOC 2, ISO 27001, PCI-DSS);</li>
          <li>Guarantees of security or safety; or</li>
          <li>Warranties that a system is free from security vulnerabilities.</li>
        </ul>
        <p>
          White-label reports may be generated by eligible subscription plans. If you distribute a
          SiteSecura-generated report to a third party, you are responsible for ensuring that you have
          the lawful right to disclose its contents.
        </p>
      </section>

      {/* SECTION 11 */}
      <section id="monitoring-and-alerts" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">11. Monitoring and Alerts</h2>
        <p>
          Where monitoring is enabled, SiteSecura periodically assesses configured targets and
          compares current observations against historical baselines. Alerts may be triggered by events
          such as SSL certificate expiration warnings, score reductions, DNS alterations, or missing
          security headers.
        </p>
        <p>
          Monitoring and alerts are provided on a best-effort basis. We do not guarantee uninterrupted
          monitoring, immediate delivery of email alerts, detection of every configuration change, or
          detection of security incidents. You remain responsible for maintaining your own operational
          security monitoring and incident-response capabilities.
        </p>
      </section>

      {/* SECTION 12 */}
      <section id="third-party-services" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">12. Third-Party Services</h2>
        <p>
          SiteSecura relies on vetted third-party service providers to deliver aspects of the
          infrastructure, including:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li><strong>Firebase Authentication:</strong> User authentication and identity verification;</li>
          <li><strong>Stripe &amp; Razorpay:</strong> Payment processing and subscription management;</li>
          <li><strong>Cloudflare:</strong> Reverse proxy, CDN, and DDoS mitigation;</li>
          <li><strong>Transactional Email Providers:</strong> Dispatch of security alerts and system emails; and</li>
          <li><strong>Infrastructure & Hosting Providers:</strong> Secure application hosting and database services.</li>
        </ul>
        <p>
          Your use of third-party features may also be subject to the respective provider&apos;s terms and
          privacy policies. SiteSecura is not responsible for service interruptions caused solely by
          third-party providers outside our reasonable control.
        </p>
      </section>

      {/* SECTION 13 */}
      <section id="subscriptions-and-billing" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">13. Subscriptions and Billing</h2>
        <p>
          Paid subscriptions are billed in advance on a recurring monthly or annual basis, as
          displayed at checkout. Subscription prices, quotas, and feature benefits may change over
          time; price changes for recurring subscriptions will be communicated in advance in accordance
          with applicable law.
        </p>
        <p>
          Payments are securely processed by authorized payment providers (Stripe and Razorpay). SiteSecura does not store raw credit card or
          debit card numbers in its application databases.
        </p>
      </section>

      {/* SECTION 14 */}
      <section id="cancellation" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">14. Cancellation</h2>
        <p>
          You may cancel your subscription at any time through the billing dashboard or payment gateway
          customer portal. Unless otherwise stated:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>Cancellation stops future automatic renewals;</li>
          <li>Paid features remain accessible until the end of your current prepaid billing cycle; and</li>
          <li>Cancellation does not automatically generate a refund for past periods.</li>
        </ul>
        <p>
          Specific refund terms are detailed in our{" "}
          <Link href="/refunds" className="text-sky-600 hover:text-sky-700 underline font-medium">
            Refund &amp; Cancellation Policy
          </Link>
          .
        </p>
      </section>

      {/* SECTION 15 */}
      <section id="refunds" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">15. Refunds</h2>
        <p>
          Refund eligibility depends on your active plan, the transaction type, applicable law, and the
          criteria set forth in our{" "}
          <Link href="/refunds" className="text-sky-600 hover:text-sky-700 underline font-medium">
            Refund &amp; Cancellation Policy
          </Link>
          . Where required by applicable consumer protection laws, non-waivable statutory rights are
          preserved.
        </p>
      </section>

      {/* SECTION 16 */}
      <section id="promotional-offers" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          16. Free Trials &amp; Promotional Offers
        </h2>
        <p>
          If SiteSecura offers free trials, promotional discounts, temporary credits, or coupons, the
          specific terms presented at the time of the offer will govern. Promotional offers may have
          eligibility criteria, expiration dates, or usage limits and may be revoked if abuse is detected.
        </p>
      </section>

      {/* SECTION 17 */}
      <section id="usage-limits" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">17. Usage Limits</h2>
        <p>
          Each subscription plan includes defined resource limits regarding monthly scans, monitored
          domains, report exports, team seats, and API concurrency. SiteSecura enforces these limits
          automatically.
        </p>
        <p>
          You may not circumvent usage limits through multiple account registrations, bot automation,
          IP rotation, or credential sharing. For full details on quotas, consult our{" "}
          <Link href="/fair-usage" className="text-sky-600 hover:text-sky-700 underline font-medium">
            Fair Usage Policy
          </Link>
          .
        </p>
      </section>

      {/* SECTION 18 */}
      <section id="suspension-and-termination" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          18. Suspension and Termination
        </h2>
        <p>
          We reserve the right to suspend or terminate your access to the Service where reasonably
          necessary to:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>Protect the Service, our infrastructure, or other users;</li>
          <li>Investigate suspected unauthorized or abusive scanning activity;</li>
          <li>Prevent or mitigate security incidents;</li>
          <li>Enforce subscription limits and terms;</li>
          <li>Address recurring payment failures; or</li>
          <li>Comply with applicable legal orders or statutory requirements.</li>
        </ul>
        <p>
          Where reasonably practicable, we will provide advance notice before suspension or
          termination, except where immediate action is required to remediate harm.
        </p>
      </section>

      {/* SECTION 19 */}
      <section id="intellectual-property" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">19. Intellectual Property</h2>
        <p>
          SiteSecura and its licensors retain all right, title, and interest in and to the Service,
          including software, algorithms, scanner rules, scoring methodologies, user interfaces,
          branding, trademarks, documentation, and recommendation libraries. No rights are granted to
          you except as expressly set forth in these Terms.
        </p>
      </section>

      {/* SECTION 20 */}
      <section id="your-data" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">20. Your Data and Content</h2>
        <p>
          You retain ownership of all lawfully submitted content and domain targets. You grant
          SiteSecura a non-exclusive, worldwide, royalty-free license to access, process, and analyze
          submitted targets solely to the extent necessary to deliver scans, compile reports, maintain
          monitoring, provide customer support, and safeguard platform integrity.
        </p>
        <p>
          Personal information is handled strictly in accordance with our{" "}
          <Link href="/privacy" className="text-sky-600 hover:text-sky-700 underline font-medium">
            Privacy Policy
          </Link>
          .
        </p>
      </section>

      {/* SECTION 21 */}
      <section id="confidentiality" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">21. Confidentiality</h2>
        <p>
          You should avoid submitting confidential trade secrets or unneeded sensitive data into scan
          configurations. Where a separate Data Processing Agreement (DPA) or non-disclosure agreement
          applies, its specific provisions will govern confidentiality between the parties.
        </p>
      </section>

      {/* SECTION 22 */}
      <section id="service-availability" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">22. Service Availability</h2>
        <p>
          We strive to provide dependable, high-availability services, but we do not guarantee
          uninterrupted or error-free operations. The Service may be temporarily unavailable due to
          scheduled maintenance, security updates, third-party network outages, or events beyond our
          reasonable control.
        </p>
      </section>

      {/* SECTION 23 */}
      <section id="disclaimer-of-warranties" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">23. Disclaimer of Warranties</h2>
        <p className="uppercase text-xs sm:text-sm font-semibold tracking-wide text-slate-800 leading-relaxed">
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot;
          AND &quot;AS AVAILABLE&quot; BASIS. SITESECURA EXPRESSLY DISCLAIMS ALL WARRANTIES OF ANY KIND,
          WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY,
          FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, AND SECURITY.
        </p>
      </section>

      {/* SECTION 24 */}
      <section id="limitation-of-liability" className="space-y-4 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">24. Limitation of Liability</h2>
        {/* Placeholder marker for legal review */}
        <p className="uppercase text-xs sm:text-sm font-semibold tracking-wide text-slate-800 leading-relaxed">
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SITESECURA AND ITS AFFILIATES, OFFICERS,
          DIRECTORS, EMPLOYEES, CONTRACTORS, AND SERVICE PROVIDERS WILL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF
          PROFITS, REVENUE, DATA, GOODWILL, OR ANTICIPATED SAVINGS ARISING FROM OR RELATED TO YOUR USE
          OF THE SERVICE.
        </p>
        <p className="uppercase text-xs sm:text-sm font-semibold tracking-wide text-slate-800 leading-relaxed">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, SITESECURA&apos;S AGGREGATE LIABILITY ARISING OUT OF OR
          RELATING TO THE SERVICE WILL BE LIMITED TO THE GREATER OF:
        </p>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono space-y-2 text-slate-800">
          <p>(A) THE AMOUNT YOU PAID TO SITESECURA FOR THE SERVICE DURING THE {LEGAL_CONFIG.LIABILITY_PERIOD} IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM; OR</p>
          <p>(B) {LEGAL_CONFIG.LIABILITY_MINIMUM_AMOUNT}.</p>
        </div>
        <p className="text-xs text-slate-500 italic">
          Nothing in these Terms limits liability that cannot legally be limited or excluded under applicable law.
        </p>
      </section>

      {/* SECTION 25 */}
      <section id="indemnification" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">25. Indemnification</h2>
        <p>
          To the maximum extent permitted by applicable law, you agree to defend, indemnify, and hold
          harmless SiteSecura and its officers, directors, employees, and agents from and against any
          claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising
          from or related to:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-slate-600">
          <li>Your unauthorized scanning of any website or domain target;</li>
          <li>Your breach or violation of these Terms;</li>
          <li>Your violation of any applicable law or third-party rights;</li>
          <li>Your distribution or representation of generated reports; or</li>
          <li>Actions or configuration changes you implement based on Service results.</li>
        </ul>
      </section>

      {/* SECTION 26 */}
      <section id="changes-to-service" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">26. Changes to the Service</h2>
        <p>
          We continually enhance our security assessment engine. We may add, modify, or discontinue
          features, scanner modules, scoring models, and plan allowances. Where required by applicable
          law, material changes will be announced in advance.
        </p>
      </section>

      {/* SECTION 27 */}
      <section id="changes-to-terms" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">27. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. When updates are published, the &quot;Last
          Updated&quot; date at the top of this page will be revised. Your continued use of the Service
          following the publication of revised Terms signifies your acceptance.
        </p>
      </section>

      {/* SECTION 28 */}
      <section id="governing-law" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          28. Governing Law and Disputes
        </h2>
        {/* Placeholder marker for legal review */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-700 italic">
          {LEGAL_CONFIG.DISPUTE_RESOLUTION_CLAUSE}
        </div>
        <p>
          These Terms and any disputes arising out of or related to the Service will be governed by the
          laws of {LEGAL_CONFIG.JURISDICTION}, without regard to conflict-of-law principles, subject to
          mandatory consumer rights available under applicable law.
        </p>
      </section>

      {/* SECTION 29 */}
      <section id="contact" className="space-y-3 pt-6 border-t border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">29. Contact Information</h2>
        <p>
          If you have questions regarding these Terms, please contact our legal and security teams:
        </p>
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs sm:text-sm space-y-2">
          <p><strong>Entity:</strong> {LEGAL_CONFIG.COMPANY_NAME}</p>
          <p><strong>Legal Inquiries:</strong> <a href={`mailto:${LEGAL_CONFIG.CONTACT_EMAIL}`} className="text-sky-600 underline">{LEGAL_CONFIG.CONTACT_EMAIL_PLACEHOLDER}</a></p>
          <p><strong>Security Reports:</strong> <a href={`mailto:${LEGAL_CONFIG.SECURITY_EMAIL}`} className="text-sky-600 underline">{LEGAL_CONFIG.SECURITY_EMAIL_PLACEHOLDER}</a></p>
          <p><strong>Address:</strong> {LEGAL_CONFIG.BUSINESS_ADDRESS}</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}
