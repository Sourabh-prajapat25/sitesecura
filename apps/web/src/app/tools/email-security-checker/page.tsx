import React from "react";
import { Metadata } from "next";
import { ShieldCheck, Lock, FileCode, Mail } from "lucide-react";
import { getSiteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import {
  ToolLandingPageLayout,
  ToolCheckItem,
  SiblingToolItem,
  RelatedGuideItem,
} from "@/components/tools/ToolLandingPageLayout";
import { ToolScannerLauncher } from "@/components/tools/ToolScannerLauncher";

export const metadata: Metadata = {
  title: {
    absolute: "SPF, DKIM & DMARC Checker | SiteSecura",
  },
  description:
    "Review supported domain email-authentication DNS records and learn how SPF, DKIM and DMARC help reduce email spoofing risks.",
  alternates: {
    canonical: `${getSiteUrl()}/tools/email-security-checker`,
  },
  openGraph: {
    title: "SPF, DKIM & DMARC Checker | SiteSecura",
    description:
      "Review supported domain email-authentication DNS records and learn how SPF, DKIM and DMARC help reduce email spoofing risks.",
    url: `${getSiteUrl()}/tools/email-security-checker`,
    siteName: "SiteSecura",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SPF, DKIM & DMARC Checker | SiteSecura",
    description:
      "Audit SPF, DMARC, and email authentication DNS records with SiteSecura to protect your domain identity.",
  },
};

export default function EmailSecurityCheckerPage() {
  const siteUrl = getSiteUrl();

  const checks: ToolCheckItem[] = [
    {
      name: "SPF (Sender Policy Framework) Record",
      description:
        "Queries domain DNS for TXT records starting with `v=spf1`, evaluating authorized IP/include mechanisms, syntax validity, and lookup limits.",
      impact: "Outbound Sender Verification",
    },
    {
      name: "DMARC (Domain-based Message Authentication) Policy",
      description:
        "Inspects DNS TXT records at `_dmarc.<domain>` to verify policy enforcement (`p=none`, `p=quarantine`, or `p=reject`) and reporting addresses (`rua`).",
      impact: "Domain Spoofing Defense",
    },
    {
      name: "MX (Mail Exchanger) Records",
      description:
        "Verifies that mail routing records exist, identifying primary inbound email infrastructure (e.g. Google Workspace, Microsoft 365, Proton).",
      impact: "Email Delivery Routing",
    },
    {
      name: "DNSSEC Zone Authentication",
      description:
        "Checks for cryptographic DNSKEY records verifying that DNS responses have not been tampered with or forged in transit.",
      impact: "DNS Tampering Protection",
    },
  ];

  const limitations = [
    "DKIM selectors: Passive scans cannot evaluate DKIM without knowing your provider's private selector (e.g. `google._domainkey`). We do not claim DKIM is missing solely because unknown selectors cannot be guessed.",
    "Does not send test emails or verify SMTP inbox delivery across receiving providers.",
    "Cannot detect mailbox compromise, weak user passwords, or session cookie hijacking.",
    "Does not inspect BIMI (Brand Indicators for Message Identification) VMC certificate chains.",
    "DNS propagation delays: Recent DNS edits can take up to several hours to become visible across authoritative name servers.",
  ];

  const steps = [
    {
      step: 1,
      title: "Input Domain Name",
      description:
        "Type your root domain name (e.g. yourcompany.com). No email credentials or DNS API tokens are required.",
    },
    {
      step: 2,
      title: "Public DNS Query",
      description:
        "SiteSecura queries authoritative DNS servers for TXT, MX, and DNSSEC records matching your domain.",
    },
    {
      step: 3,
      title: "Review Authentication Gaps",
      description:
        "Check whether SPF and DMARC policies are configured, identify syntax warnings, and view step-by-step DNS record recommendations.",
    },
  ];

  const resultInterpretation = [
    {
      status: "pass",
      label: "Configured (Green)",
      description:
        "Valid SPF record and active DMARC policy (`p=quarantine` or `p=reject`) detected in domain DNS.",
      badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    },
    {
      status: "warning",
      label: "Monitoring Only (Amber)",
      description:
        "DMARC policy is set to `p=none` (monitoring only, not rejecting spoofed emails), or SPF syntax has minor warnings.",
      badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
    },
    {
      status: "fail",
      label: "Missing Policy (Red)",
      description:
        "No SPF or DMARC record found in DNS, leaving your domain completely unprotected from email impersonation.",
      badgeClass: "bg-red-50 text-red-700 border border-red-200",
    },
    {
      status: "info",
      label: "DKIM Guidance (Blue)",
      description:
        "DKIM requires provider-specific selectors; informational guidance is provided on how to verify DKIM in your email provider console.",
      badgeClass: "bg-sky-50 text-sky-700 border border-sky-200",
    },
  ];

  const faqs = [
    {
      question: "What is SPF and how does it protect my domain?",
      answer:
        "SPF (Sender Policy Framework) is a DNS TXT record that lists which mail servers and IP addresses are authorized to send email on behalf of your domain. Mail servers that receive messages claiming to be from your domain check this list to reject unauthorized senders.",
    },
    {
      question: "What does DMARC do and what are the policy levels?",
      answer:
        "DMARC builds on SPF and DKIM. It tells receiving mail servers what to do when an email fails authentication: `p=none` (collect reports only, deliver email), `p=quarantine` (send failed emails to spam/junk), or `p=reject` (block failed emails completely from being delivered).",
    },
    {
      question: "Why can't an automated passive scanner test my DKIM record?",
      answer:
        "DKIM records are stored under unique selector subdomains (for example, `selector1._domainkey.example.com`). Because selectors are chosen by individual email providers and domain administrators, a passive scanner cannot determine your selector without prior knowledge. SiteSecura avoids false positives by never claiming DKIM is missing simply because an unknown selector was not guessed.",
    },
    {
      question: "What is the 10-DNS-lookup limit for SPF records?",
      answer:
        "RFC 7208 strictly limits SPF evaluations to a maximum of 10 DNS lookups per incoming message (triggered by `include:`, `a:`, `mx:`, `redirect:`, etc.). Exceeding this limit causes a PermError and can lead legitimate emails to be marked as spam or rejected.",
    },
    {
      question: "How long does it take for DNS email security changes to take effect?",
      answer:
        "DNS records are cached according to their TTL (Time-To-Live) value, which typically ranges from 300 seconds (5 minutes) to 86,400 seconds (24 hours). Changes are usually recognized by modern mail providers within 1 to 2 hours.",
    },
  ];

  const siblingTools: SiblingToolItem[] = [
    {
      name: "Website Security Scanner",
      slug: "website-security-checker",
      badge: "Full Scan",
      description:
        "Assess HTTPS, certificates, security headers, and domain email authentication in one unified security scan.",
      iconName: "scanner",
    },
    {
      name: "SSL/TLS Certificate Checker",
      slug: "ssl-checker",
      badge: "SSL / TLS",
      description:
        "Inspect certificate expiration dates, CA issuer chain, SAN domain matching, and supported TLS protocol versions.",
      iconName: "ssl",
    },
    {
      name: "HTTP Security Headers Checker",
      slug: "security-headers-checker",
      badge: "HTTP Headers",
      description:
        "Inspect HSTS, Content-Security-Policy (CSP), and browser defensive response headers to protect users from XSS.",
      iconName: "headers",
    },
    {
      name: "DNS Lookup Tool",
      slug: "dns-lookup",
      badge: "DNS Utility",
      description:
        "Inspect supported A, AAAA, CNAME, MX, NS, TXT, SOA, and CAA records with real-time resolution and explanations.",
      iconName: "dns",
    },
  ];

  const relatedGuides: RelatedGuideItem[] = [
    {
      title: "What Is DMARC? A Practical Guide to Email Security",
      slug: "what-is-dmarc-guide-to-email-security",
      category: "DNS & Email Security",
      readingTimeMinutes: 6,
    },
    {
      title: "What Is Website Security? A Complete Beginner's Guide",
      slug: "what-is-website-security-beginners-guide",
      category: "Website Security",
      readingTimeMinutes: 5,
    },
    {
      title: "How to Check Your Website Security",
      slug: "how-to-check-your-website-security",
      category: "Website Security",
      readingTimeMinutes: 6,
    },
  ];

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Resources",
        item: `${siteUrl}/resources`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "SPF, DKIM & DMARC Checker",
        item: `${siteUrl}/tools/email-security-checker`,
      },
    ],
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "SiteSecura Email Security Checker (SPF, DKIM & DMARC)",
    url: `${siteUrl}/tools/email-security-checker`,
    applicationCategory: "SecurityApplication",
    operatingSystem: "All",
    description:
      "Review supported DNS email-authentication records (SPF, DMARC, MX) to mitigate domain spoofing risks.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    publisher: {
      "@type": "Organization",
      name: "SiteSecura",
      url: siteUrl,
    },
  };

  const remediationOverview = (
    <div className="space-y-4">
      <p>
        Securing your domain against unauthorized email spoofing requires a phased rollout across SPF, DKIM, and DMARC:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose pt-2">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-bold text-slate-900 text-sm mb-1">Step 1: Publish an SPF Record</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Add a TXT record on your apex domain (<code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded font-mono text-[11px]">@</code>) explicitly listing your email service:
          </p>
          <div className="mt-2 bg-slate-900 text-slate-100 p-2 rounded-lg font-mono text-[11px] overflow-x-auto">
            v=spf1 include:_spf.google.com ~all
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-bold text-slate-900 text-sm mb-1">Step 2: Configure DKIM in Your Mail Host</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Generate 2048-bit DKIM keys in your email provider console (e.g. Google Workspace, Microsoft 365, Mailgun) and publish the CNAME or TXT record at your provider's specific selector.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-bold text-slate-900 text-sm mb-1">Step 3: Deploy DMARC in Monitoring Mode</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Create a TXT record for <code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded font-mono text-[11px]">_dmarc.yourdomain.com</code> set to <code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded font-mono text-[11px]">p=none</code> with your reporting mailbox:
          </p>
          <div className="mt-2 bg-slate-900 text-slate-100 p-2 rounded-lg font-mono text-[11px] overflow-x-auto">
            v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-bold text-slate-900 text-sm mb-1">Step 4: Advance to Enforcement (Quarantine/Reject)</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Once aggregate XML reports show all legitimate senders passing authentication, upgrade your policy to <code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded font-mono text-[11px]">p=quarantine</code> or <code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded font-mono text-[11px]">p=reject</code> to eliminate spoofed messages.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={softwareSchema} />
      <ToolLandingPageLayout
        toolName="SPF, DKIM & DMARC Checker"
        eyebrow="DOMAIN EMAIL AUTHENTICATION AUDIT"
        heading="SPF, DKIM & DMARC Checker"
        description="Review supported domain email-authentication DNS records to identify configuration gaps, prevent domain spoofing, and ensure deliverability."
        launcherSlot={
          <ToolScannerLauncher
            toolName="SPF, DKIM & DMARC Checker"
            buttonLabel="Check Email Security"
            placeholder="example.com"
            helperText="Queries public DNS records for SPF, DMARC, and MX configuration."
            autoFocus
          />
        }
        checksHeading="Domain Email DNS Signals"
        checksDescription="SiteSecura queries publicly published DNS records to evaluate email security and sender authentication."
        checks={checks}
        limitations={limitations}
        steps={steps}
        resultInterpretation={resultInterpretation}
        remediationOverview={remediationOverview}
        faqs={faqs}
        siblingTools={siblingTools}
        relatedGuides={relatedGuides}
      />
    </>
  );
}
