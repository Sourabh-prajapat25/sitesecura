import React from "react";
import { Metadata } from "next";
import { ShieldCheck, Lock, Mail, FileCode } from "lucide-react";
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
    absolute: "HTTP Security Headers Checker | SiteSecura",
  },
  description:
    "Inspect supported HTTP security headers such as HSTS, Content-Security-Policy, and Referrer-Policy with SiteSecura.",
  alternates: {
    canonical: `${getSiteUrl()}/tools/security-headers-checker`,
  },
  openGraph: {
    title: "HTTP Security Headers Checker | SiteSecura",
    description:
      "Inspect supported HTTP security headers such as HSTS, Content-Security-Policy, and Referrer-Policy with SiteSecura.",
    url: `${getSiteUrl()}/tools/security-headers-checker`,
    siteName: "SiteSecura",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HTTP Security Headers Checker | SiteSecura",
    description:
      "Analyze HSTS, Content-Security-Policy, X-Frame-Options, and defensive browser headers with SiteSecura.",
  },
};

export default function SecurityHeadersCheckerPage() {
  const siteUrl = getSiteUrl();

  const checks: ToolCheckItem[] = [
    {
      name: "Strict-Transport-Security (HSTS)",
      description:
        "Instructs modern browsers to communicate strictly over encrypted HTTPS connections, preventing SSL stripping and downgrade attacks.",
      impact: "HTTPS Enforcement",
    },
    {
      name: "Content-Security-Policy (CSP)",
      description:
        "Restricts the origin domains from which scripts, styles, images, and fonts can load, mitigating Cross-Site Scripting (XSS) and data injection.",
      impact: "XSS Defense",
    },
    {
      name: "X-Frame-Options",
      description:
        "Controls whether the website can be rendered inside an <iframe> or <frame>, blocking UI redress and clickjacking attacks.",
      impact: "Clickjacking Protection",
    },
    {
      name: "X-Content-Type-Options",
      description:
        "Prevents browsers from MIME-type sniffing executable scripts disguised as user-uploaded images or text files (nosniff).",
      impact: "MIME-Sniffing Defense",
    },
    {
      name: "Referrer-Policy",
      description:
        "Governs how much sensitive referrer path data (including query parameters and session tokens) is leaked to external sites when navigating.",
      impact: "Data Privacy",
    },
    {
      name: "Permissions-Policy",
      description:
        "Explicitly disables browser hardware access (e.g. camera, microphone, geolocation) that your web application does not need.",
      impact: "Feature Governance",
    },
  ];

  const limitations = [
    "Security headers instruct client browsers; they cannot protect against backend server compromise or database vulnerabilities.",
    "A missing header is not automatically a critical flaw; impact depends on application features (e.g. whether user content is hosted).",
    "Does not dynamically execute all JavaScript or evaluate complex CSP nonces on deep authenticated dynamic paths.",
    "Web applications with existing legacy inline scripts may require gradual refactoring before enabling strict CSP.",
    "Header presence alone does not guarantee safety if policies use overly permissive wildcards (e.g. `script-src *`).",
  ];

  const steps = [
    {
      step: 1,
      title: "Enter Web Address",
      description:
        "Input your website domain (e.g. example.com). No code modifications or server installations are necessary.",
    },
    {
      step: 2,
      title: "Inspect HTTP Response",
      description:
        "SiteSecura sends standard HTTP GET and HEAD requests, parsing every response header returned by your web server or CDN.",
    },
    {
      step: 3,
      title: "Copy Remediation Snippets",
      description:
        "Review missing headers with exact syntax recommendations ready to paste into Nginx, Apache, or Cloudflare.",
    },
  ];

  const resultInterpretation = [
    {
      status: "pass",
      label: "Active (Green)",
      description:
        "The header is configured with secure recommended directives (such as max-age >= 1 year for HSTS).",
      badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    },
    {
      status: "warning",
      label: "Needs Tuning (Amber)",
      description:
        "The header is present but contains weak directives (such as short max-age, missing includeSubDomains, or permissive CSP).",
      badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
    },
    {
      status: "fail",
      label: "Missing (Red)",
      description:
        "An essential defensive browser header is entirely absent from production HTTPS responses.",
      badgeClass: "bg-red-50 text-red-700 border border-red-200",
    },
    {
      status: "info",
      label: "Information (Blue)",
      description:
        "Observed server banners (such as Apache, Nginx, or Cloudflare) and optional privacy directives.",
      badgeClass: "bg-sky-50 text-sky-700 border border-sky-200",
    },
  ];

  const faqs = [
    {
      question: "Why are HTTP security headers important?",
      answer:
        "HTTP security headers provide a standardized way for your server to instruct visitors' web browsers on how to treat site content. They restrict malicious script execution (CSP), enforce transport encryption (HSTS), and block clickjacking (X-Frame-Options) without requiring complex client-side programming.",
    },
    {
      question: "Can enabling Content-Security-Policy (CSP) break my website?",
      answer:
        "Yes, if configured improperly. Strict CSP policies block inline scripts or third-party tracking tags that are not explicitly allowlisted. We recommend starting with `Content-Security-Policy-Report-Only` during development to observe violations before enforcing the policy in production.",
    },
    {
      question: "What is HSTS preload readiness?",
      answer:
        "HSTS preload requires `max-age=31536000`, `includeSubDomains`, and the `preload` directive. Once submitted to Google's HSTS preload list, major browsers hardcode HTTPS for your domain before making the first request, completely eliminating cleartext downgrade risks.",
    },
    {
      question: "What is the difference between X-Frame-Options and CSP frame-ancestors?",
      answer:
        "`X-Frame-Options` is a legacy header supported by older browsers. Modern browsers prioritize the `frame-ancestors` directive within `Content-Security-Policy`. For maximum compatibility, most websites provide both.",
    },
    {
      question: "Does having all security headers mean my site is safe from XSS?",
      answer:
        "Security headers provide strong defense-in-depth, but they do not eliminate the root causes of vulnerabilities. Proper input sanitization, context-aware output encoding, and secure coding practices remain essential.",
    },
  ];

  const siblingTools: SiblingToolItem[] = [
    {
      name: "Website Security Scanner",
      slug: "website-security-checker",
      badge: "Full Scan",
      description:
        "Run an integrated evaluation covering HTTPS, certificates, security headers, and domain email authentication.",
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
      name: "SPF, DKIM & DMARC Checker",
      slug: "email-security-checker",
      badge: "Email Security",
      description:
        "Audit DNS email-authentication records to stop domain spoofing and phishing.",
      iconName: "email",
    },
  ];

  const relatedGuides: RelatedGuideItem[] = [
    {
      title: "What Are Security Headers and Why Do They Matter?",
      slug: "what-are-security-headers-and-why-they-matter",
      category: "Security Headers",
      readingTimeMinutes: 7,
    },
    {
      title: "HTTPS vs SSL vs TLS: What's the Difference?",
      slug: "https-vs-ssl-vs-tls-difference",
      category: "SSL/TLS",
      readingTimeMinutes: 6,
    },
    {
      title: "What Is Website Security? A Complete Beginner's Guide",
      slug: "what-is-website-security-beginners-guide",
      category: "Website Security",
      readingTimeMinutes: 5,
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
        name: "HTTP Security Headers Checker",
        item: `${siteUrl}/tools/security-headers-checker`,
      },
    ],
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "SiteSecura HTTP Security Headers Checker",
    url: `${siteUrl}/tools/security-headers-checker`,
    applicationCategory: "SecurityApplication",
    operatingSystem: "All",
    description:
      "Inspect supported HTTP security headers including HSTS, CSP, X-Frame-Options, and Referrer-Policy with SiteSecura.",
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
        Configuring defensive HTTP response headers is one of the quickest and highest-ROI security enhancements you can make. Here are production-ready baseline snippets:
      </p>

      <div className="space-y-4 not-prose pt-2">
        <div className="bg-slate-900 rounded-2xl p-5 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800">
          <div className="text-slate-400 font-sans text-xs font-semibold mb-2 flex items-center justify-between">
            <span>Nginx Configuration (nginx.conf)</span>
            <span className="text-[10px] text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">Recommended</span>
          </div>
          <pre className="text-slate-200 leading-relaxed">
{`# 1. Enforce HTTPS strictly for 1 year including subdomains
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# 2. Prevent clickjacking
add_header X-Frame-Options "SAMEORIGIN" always;

# 3. Disable MIME-sniffing
add_header X-Content-Type-Options "nosniff" always;

# 4. Restrict Referrer leakage
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# 5. Disable unused hardware features
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;`}
          </pre>
        </div>

        <div className="bg-slate-900 rounded-2xl p-5 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800">
          <div className="text-slate-400 font-sans text-xs font-semibold mb-2">
            <span>Apache (.htaccess or httpd.conf)</span>
          </div>
          <pre className="text-slate-200 leading-relaxed">
{`<IfModule mod_headers.c>
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>`}
          </pre>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={softwareSchema} />
      <ToolLandingPageLayout
        toolName="HTTP Security Headers Checker"
        eyebrow="BROWSER DEFENSE POLICY INSPECTOR"
        heading="HTTP Security Headers Checker"
        description="Inspect supported HTTP security headers including HSTS, Content-Security-Policy, and X-Frame-Options to harden your website against browser-side vulnerabilities."
        launcherSlot={
          <ToolScannerLauncher
            toolName="HTTP Security Headers Checker"
            buttonLabel="Analyze Security Headers"
            placeholder="example.com"
            helperText="Inspects HTTP response headers returned by your web server."
            autoFocus
          />
        }
        checksHeading="Inspected HTTP Response Headers"
        checksDescription="SiteSecura checks whether your server returns defensive response headers and evaluates their directive configurations."
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
