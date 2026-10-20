import React from "react";
import { Metadata } from "next";
import { Lock, FileCode, Mail, ShieldCheck } from "lucide-react";
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
    absolute: "Free Website Security Checker | SiteSecura",
  },
  description:
    "Check your website security posture with SiteSecura. Review supported HTTPS, SSL/TLS, security header, DNS and email-security checks.",
  alternates: {
    canonical: `${getSiteUrl()}/tools/website-security-checker`,
  },
  openGraph: {
    title: "Free Website Security Checker | SiteSecura",
    description:
      "Check your website security posture with SiteSecura. Review supported HTTPS, SSL/TLS, security header, DNS and email-security checks.",
    url: `${getSiteUrl()}/tools/website-security-checker`,
    siteName: "SiteSecura",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Website Security Checker | SiteSecura",
    description:
      "Inspect website HTTPS, certificates, security headers, and email authentication with SiteSecura.",
  },
};

export default function WebsiteSecurityCheckerPage() {
  const siteUrl = getSiteUrl();

  const checks: ToolCheckItem[] = [
    {
      name: "HTTPS Availability & Redirects",
      description:
        "Verifies that your website responds over HTTPS and automatically redirects plain HTTP traffic to an encrypted channel.",
      impact: "Baseline Protection",
    },
    {
      name: "SSL/TLS Certificate Validity & Expiry",
      description:
        "Inspects certificate chain validity, days remaining until expiration, issuer authority, and Subject Alternative Names (SAN).",
      impact: "Transport Encryption",
    },
    {
      name: "Defensive HTTP Security Headers",
      description:
        "Audits HSTS (Strict-Transport-Security), Content-Security-Policy (CSP), X-Frame-Options, X-Content-Type-Options, and Referrer-Policy.",
      impact: "Browser Hardening",
    },
    {
      name: "Domain Email Authentication (SPF & DMARC)",
      description:
        "Evaluates SPF records and DMARC policies in domain DNS to detect spoofing vulnerability and email hygiene gaps.",
      impact: "Brand & Email Security",
    },
    {
      name: "Cookie Security Flags",
      description:
        "Inspects cookies for essential defensive attributes including Secure, HttpOnly, and SameSite configuration.",
      impact: "Session Protection",
    },
    {
      name: "Server Technology Disclosure",
      description:
        "Checks whether web server software versions and sensitive backend framework headers (X-Powered-By) are exposed to public clients.",
      impact: "Information Minimization",
    },
  ];

  const limitations = [
    "Passive perimeter inspection cannot detect SQL injection, broken authorization, or internal application bugs.",
    "Does not simulate denial-of-service (DoS) or perform high-volume stress testing.",
    "Cannot evaluate internal private subnets, localhost environments, or password-protected member portals.",
    "A 100% score indicates strong perimeter hygiene, not an absolute guarantee against zero-day exploits or compromise.",
    "Third-party external dependencies (e.g., embedded widgets) are evaluated only within observed response headers.",
  ];

  const steps = [
    {
      step: 1,
      title: "Enter Your Domain",
      description:
        "Type your public website address (e.g. example.com). No code snippet, DNS verification, or account sign-in required.",
    },
    {
      step: 2,
      title: "Automated Inspection Runs",
      description:
        "SiteSecura queries DNS records, initiates TLS handshakes, and analyzes HTTP responses in under 60 seconds.",
    },
    {
      step: 3,
      title: "Review Plain-English Findings",
      description:
        "Examine your numerical score, categorized findings (Pass, Warning, Fail), and actionable code snippets for your web server.",
    },
  ];

  const resultInterpretation = [
    {
      status: "pass",
      label: "Pass (Green)",
      description:
        "The evaluated security control is active and adheres to recommended defensive configurations.",
      badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    },
    {
      status: "warning",
      label: "Warning (Amber)",
      description:
        "A defensive configuration is partially implemented or using suboptimal parameters (e.g. short HSTS max-age).",
      badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
    },
    {
      status: "fail",
      label: "Missing / Fail (Red)",
      description:
        "An important security setting is absent (such as no HTTPS redirect, missing CSP, or no SPF record).",
      badgeClass: "bg-red-50 text-red-700 border border-red-200",
    },
    {
      status: "info",
      label: "Informational (Blue)",
      description:
        "Contextual details such as IP resolution, server software name, or selector-dependent checks (like DKIM).",
      badgeClass: "bg-sky-50 text-sky-700 border border-sky-200",
    },
  ];

  const faqs = [
    {
      question: "What does the SiteSecura Website Security Checker evaluate?",
      answer:
        "The checker analyzes publicly observable perimeter configurations: HTTPS enforcement, SSL/TLS certificate validity and expiration date, HTTP security headers (HSTS, CSP, X-Frame-Options, etc.), domain DNS email records (SPF and DMARC), and server banner disclosures.",
    },
    {
      question: "Will running this security check slow down or disrupt my website?",
      answer:
        "No. SiteSecura performs safe, non-invasive passive requests identical to normal browser visits and standard DNS queries. It generates negligible traffic and does not disrupt production uptime.",
    },
    {
      question: "How is the 0–100 security score calculated?",
      answer:
        "Scores start at a baseline of 100 points. Points are deducted based on observed vulnerabilities according to their severity: Critical issues (e.g. no HTTPS) incur higher deductions, Medium issues (e.g. missing HSTS or SPF) incur moderate deductions, and Low issues (e.g. missing Referrer-Policy) incur small deductions.",
    },
    {
      question: "Can this tool scan internal IP addresses or staging environments behind firewalls?",
      answer:
        "No. To protect private infrastructure, SiteSecura strictly rejects private IP ranges (RFC 1918), loopback addresses, and internal metadata endpoints via SSRF prevention. The target must be a publicly resolvable domain on the internet.",
    },
    {
      question: "Does a high security score guarantee my website cannot be hacked?",
      answer:
        "No security tool can guarantee 100% immunity. A high score means your transport encryption, browser security policies, and domain email authentication follow current industry hygiene standards. It does not replace secure application development, regular dependency patching, and strong credential management.",
    },
  ];

  const siblingTools: SiblingToolItem[] = [
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
        "Verify HSTS preload readiness, Content-Security-Policy (CSP) rules, and clickjacking protection headers.",
      iconName: "headers",
    },
    {
      name: "SPF, DKIM & DMARC Checker",
      slug: "email-security-checker",
      badge: "Email Security",
      description:
        "Audit DNS email-authentication records to protect your brand from email spoofing, phishing, and delivery drops.",
      iconName: "email",
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
    {
      title: "What Are Security Headers and Why Do They Matter?",
      slug: "what-are-security-headers-and-why-they-matter",
      category: "Security Headers",
      readingTimeMinutes: 7,
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
        name: "Website Security Checker",
        item: `${siteUrl}/tools/website-security-checker`,
      },
    ],
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "SiteSecura Website Security Checker",
    url: `${siteUrl}/tools/website-security-checker`,
    applicationCategory: "SecurityApplication",
    operatingSystem: "All",
    description:
      "Free passive website security scanner evaluating HTTPS, SSL certificates, HTTP headers, and domain email security.",
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
        Website security remediation begins with closing the most exploitable perimeter gaps. SiteSecura categorizes findings into concrete fix recommendations:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose pt-2">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-bold text-slate-900 text-sm mb-1">1. Enforce HTTPS Everywhere</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Configure web server redirects (HTTP 301) from port 80 to port 443. Enable automated certificate renewals via Let's Encrypt or your cloud CDN provider.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-bold text-slate-900 text-sm mb-1">2. Add Strict-Transport-Security</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Instruct browsers never to connect via unencrypted HTTP. Add the header with a 1-year duration: <code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded font-mono text-[11px]">max-age=31536000; includeSubDomains</code>.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-bold text-slate-900 text-sm mb-1">3. Harden Defensive Headers</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Prevent clickjacking with <code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded font-mono text-[11px]">X-Frame-Options: SAMEORIGIN</code> and stop MIME-sniffing with <code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded font-mono text-[11px]">X-Content-Type-Options: nosniff</code>.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-bold text-slate-900 text-sm mb-1">4. Protect Your Domain Email</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Publish SPF TXT records in DNS designating legitimate outbound email servers, and establish a DMARC policy (<code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded font-mono text-[11px]">v=DMARC1; p=none</code> initially) to monitor domain abuse.
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
        toolName="Website Security Checker"
        eyebrow="FREE PERIMETER ASSESSMENT TOOL"
        heading="Free Website Security Checker"
        description="Assess your website's security posture in under 60 seconds. Review HTTPS encryption, SSL/TLS certificates, defensive HTTP headers, and DNS email authentication."
        launcherSlot={
          <ToolScannerLauncher
            toolName="Website Security Checker"
            buttonLabel="Run Free Security Scan"
            placeholder="example.com"
            helperText="Deterministic, non-intrusive scan. Instant report."
            autoFocus
          />
        }
        checksHeading="Supported Website Security Checks"
        checksDescription="SiteSecura checks external perimeter configurations without sending intrusive attack payloads or altering your server."
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
