import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  FileCheck,
  ChevronRight,
  Lock,
  Mail,
  Calendar,
  Key,
  Award,
  Globe,
  Briefcase,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Network,
  RefreshCw,
  FileCode,
  Zap,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getSiteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { SecurityTxtApp } from "@/components/tools/security-txt/SecurityTxtApp";
import { SecurityTxtFaqAccordion } from "@/components/tools/security-txt/SecurityTxtFaqAccordion";
import { SECURITY_TXT_FAQS } from "@/components/tools/security-txt/faqData";

export const metadata: Metadata = {
  title: {
    absolute: "security.txt Validator & RFC 9116 Compliance Checker | SiteSecura",
  },
  description:
    "Validate your website security.txt file against RFC 9116 standards. Check mandatory Contact and Expires directives, verify PGP keys, test safe disclosure paths, and detect syntax errors for free.",
  alternates: {
    canonical: `${getSiteUrl()}/tools/security-txt-validator`,
  },
  openGraph: {
    title: "security.txt Validator & RFC 9116 Compliance Checker | SiteSecura",
    description:
      "Inspect and validate your website security.txt disclosure file against RFC 9116 standards. Test mandatory Contact and Expires directives, URL formatting, and OpenPGP signatures for free.",
    url: `${getSiteUrl()}/tools/security-txt-validator`,
    siteName: "SiteSecura",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "security.txt Validator & RFC 9116 Compliance Checker | SiteSecura",
    description:
      "Validate security disclosure files against RFC 9116. Inspect Contact, Expires, Encryption, and Canonical directives, detect expiration issues, and verify PGP armor over secure HTTPS.",
  },
};

export default function SecurityTxtValidatorPage() {
  const siteUrl = getSiteUrl();

  const breadcrumbsSchema = {
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
        name: "security.txt Validator",
        item: `${siteUrl}/tools/security-txt-validator`,
      },
    ],
  };

  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "SiteSecura security.txt Validator",
    description:
      "Free standalone RFC 9116 security disclosure file validator. Evaluates mandatory Contact and Expires fields, validates directive syntax, audits HTTPS transport, and checks OpenPGP digital signature armor.",
    url: `${siteUrl}/tools/security-txt-validator`,
    applicationCategory: "SecurityApplication",
    operatingSystem: "All",
    browserRequirements: "Requires JavaScript. Requires HTML5.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: SECURITY_TXT_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const supportedDirectives = [
    {
      name: "Contact",
      required: true,
      cardinality: "1 or more",
      description: "Direct channel for reporting vulnerabilities. Must use an absolute URI (mailto:, https:, or tel:).",
      example: "Contact: mailto:security@example.com",
      icon: Mail,
    },
    {
      name: "Expires",
      required: true,
      cardinality: "Exactly 1",
      description: "RFC 3339 timestamp with timezone indicating when contact data expires. Must be in the future.",
      example: "Expires: 2027-01-01T00:00:00.000Z",
      icon: Calendar,
    },
    {
      name: "Encryption",
      required: false,
      cardinality: "0 or more",
      description: "URI pointing to an OpenPGP public key or key server used for encrypting vulnerability disclosures.",
      example: "Encryption: https://example.com/pgp-key.asc",
      icon: Key,
    },
    {
      name: "Acknowledgments",
      required: false,
      cardinality: "0 or more",
      description: "URL linking to your security hall of fame or vulnerability disclosure acknowledgments page.",
      example: "Acknowledgments: https://example.com/hall-of-fame",
      icon: Award,
    },
    {
      name: "Canonical",
      required: false,
      cardinality: "0 or more",
      description: "The authoritative HTTPS URL where this security.txt file is permanently hosted.",
      example: "Canonical: https://example.com/.well-known/security.txt",
      icon: Globe,
    },
    {
      name: "Policy",
      required: false,
      cardinality: "0 or more",
      description: "Link to your formal Vulnerability Disclosure Policy (VDP) or safe harbor guidelines.",
      example: "Policy: https://example.com/disclosure-policy.html",
      icon: Shield,
    },
    {
      name: "Preferred-Languages",
      required: false,
      cardinality: "0 or 1",
      description: "Comma-separated list of natural language tags (RFC 5646) preferred for security communications.",
      example: "Preferred-Languages: en, de, fr",
      icon: FileCode,
    },
    {
      name: "Hiring",
      required: false,
      cardinality: "0 or more",
      description: "Link to security job opportunities or engineering career pages for visiting researchers.",
      example: "Hiring: https://example.com/jobs/security",
      icon: Briefcase,
    },
  ];

  const commonFailures = [
    {
      title: "Missing or Expired 'Expires' Directive",
      desc: "Under RFC 9116 Section 2.5.5, an Expires directive is strictly mandatory. If omitted or if the timestamp is in the past, security researchers and automated scanners will classify the file as stale and invalid.",
      remedy: "Add 'Expires: YYYY-MM-DDTHH:MM:SSZ' with a date within 366 days in the future, and set a calendar reminder to renew it annually.",
    },
    {
      title: "Missing 'Contact' Field or Invalid URI Scheme",
      desc: "RFC 9116 Section 2.5.3 requires at least one Contact directive using an absolute URI with a supported scheme. Plain un-prefixed email addresses or cleartext http:// links are non-compliant.",
      remedy: "Prefix email addresses with 'mailto:' (e.g. mailto:security@example.com) and web contact portals with secure 'https://'.",
    },
    {
      title: "Hosting in Root Instead of /.well-known/",
      desc: "RFC 9116 Section 2.5.2 specifies https://<domain>/.well-known/security.txt as the primary standard location. Hosting only in the root directory (/security.txt) is a deprecated fallback.",
      remedy: "Serve the file under /.well-known/security.txt, or place an HTTP 301/308 redirect from /security.txt to /.well-known/security.txt.",
    },
    {
      title: "Incorrect Content-Type Header",
      desc: "The file must be served with 'Content-Type: text/plain; charset=utf-8'. Serving HTML error pages (e.g. 200 OK SPA fallback) or application/octet-stream causes parser failures.",
      remedy: "Configure your web server (Nginx, Apache, Cloudflare) to explicitly set Content-Type to text/plain for the security.txt route.",
    },
    {
      title: "Serving Over Insecure HTTP",
      desc: "RFC 9116 Section 2.2 strictly mandates that security.txt must be accessed using HTTPS. Cleartext HTTP allows attackers to tamper with contact addresses in transit.",
      remedy: "Enforce TLS/HTTPS across your website and ensure unencrypted requests automatically redirect to HTTPS.",
    },
    {
      title: "Expiration Set Farther Than One Year Away",
      desc: "RFC 9116 Section 2.5.5 cautions against setting an expiration date more than one year in advance, because stale contact information creates serious security liabilities.",
      remedy: "Limit your expiration window to at most 365 days from the date of publication and integrate it into your deployment pipeline.",
    },
  ];

  const siblingTools = [
    {
      name: "DNS Lookup Tool",
      slug: "dns-lookup",
      badge: "DNS Records",
      description: "Inspect A, AAAA, CNAME, MX, NS, TXT, SOA, and CAA records without launching a full perimeter scan.",
      icon: Network,
    },
    {
      name: "HTTP Status & Redirect Checker",
      slug: "http-status-checker",
      badge: "HTTP Utility",
      description: "Inspect HTTP status codes, trace 301/302 redirect chains hop-by-hop, and detect SSL downgrade vulnerabilities.",
      icon: RefreshCw,
    },
    {
      name: "HTTP Security Headers Checker",
      slug: "security-headers-checker",
      badge: "HTTP Headers",
      description: "Analyze HSTS, Content-Security-Policy, X-Frame-Options, and defensive browser headers.",
      icon: FileCode,
    },
    {
      name: "SSL/TLS Certificate Checker",
      slug: "ssl-checker",
      badge: "SSL / TLS",
      description: "Verify certificate expiration dates, cipher suite strength, and certificate authority trust chains.",
      icon: Lock,
    },
    {
      name: "SPF, DKIM & DMARC Checker",
      slug: "email-security-checker",
      badge: "Email Security",
      description: "Review email authentication DNS records to protect domain reputation and prevent phishing attacks.",
      icon: Mail,
    },
    {
      name: "Instant Website Security Scanner",
      slug: "website-security-checker",
      badge: "Full Perimeter Scan",
      description: "Run an automated multi-vector security assessment across DNS, SSL, HTTP headers, ports, and disclosure.",
      icon: Zap,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F9FC] text-slate-900 selection:bg-sky-500 selection:text-white">
      <JsonLd data={breadcrumbsSchema} />
      <JsonLd data={webAppSchema} />
      <JsonLd data={faqSchema} />

      <Navbar />

      <main className="flex-1">
        {/* Top Breadcrumbs */}
        <div className="border-b border-slate-200/80 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
              <Link href="/" className="hover:text-slate-900 transition-colors">
                Home
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <Link href="/resources" className="hover:text-slate-900 transition-colors">
                Resources
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-900" aria-current="page">
                security.txt Validator
              </span>
            </nav>
          </div>
        </div>

        {/* Hero Section */}
        <section className="py-12 sm:py-16 border-b border-slate-200/80 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 text-sky-700 text-xs font-bold border border-sky-200/80">
              <FileCheck className="w-4 h-4 text-sky-600" />
              <span>RFC 9116 Standards Compliance Utility</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight leading-tight">
              security.txt Validator
            </h1>

            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Validate your website&apos;s vulnerability disclosure contact file strictly according to RFC 9116. Verify mandatory Contact and Expires directives, inspect OpenPGP armor, and ensure ethical hackers have a safe channel to report security issues.
            </p>

            {/* Feature Highlights Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs text-slate-600 font-medium">
              <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200/70 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Strict RFC 9116 Parser
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200/70 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Mandatory Directive Audits
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200/70 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Safe HTTPS Socket Pinning
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200/70 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                OpenPGP Armor Support
              </span>
            </div>
          </div>
        </section>

        {/* Interactive Tool App Section */}
        <section className="py-12 sm:py-16 border-b border-slate-200/80 bg-[#F7F9FC]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <SecurityTxtApp />
          </div>
        </section>

        {/* Educational Content Section 1: What is security.txt? */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-left">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <Shield className="w-3.5 h-3.5 text-slate-500" />
                <span>Standardized Vulnerability Disclosure</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                What is security.txt & Why Does It Matter?
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                When independent security researchers, ethical hackers, or academic analysts discover a critical vulnerability on a website or cloud service, they frequently struggle to find an authorized contact. Security findings often end up submitted to generic support forms, spam inboxes, or sales chats, leaving vulnerabilities unpatched for months or driving researchers to publicly disclose them out of frustration.
              </p>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                <strong className="text-slate-900">RFC 9116</strong> solves this communication barrier by standardizing a simple machine-readable and human-readable text file named <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-slate-800">security.txt</code>. Hosted in a predictable well-known location, it provides clear security reporting channels, PGP public encryption keys, disclosure policy links, and hall-of-fame acknowledgments.
              </p>
            </div>

            {/* Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div className="p-6 rounded-3xl bg-slate-50/70 border border-slate-200/90 space-y-3">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Without security.txt</h3>
                <ul className="text-xs sm:text-sm text-slate-600 space-y-2 list-disc list-inside leading-relaxed">
                  <li>Researchers submit bugs to general info@ or marketing mailboxes.</li>
                  <li>Critical vulnerability reports get lost in customer support queues.</li>
                  <li>Researchers cannot safely encrypt sensitive exploit proofs-of-concept.</li>
                  <li>Higher likelihood of premature public zero-day disclosure.</li>
                </ul>
              </div>

              <div className="p-6 rounded-3xl bg-emerald-50/50 border border-emerald-200/80 space-y-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-emerald-950">With a Valid security.txt</h3>
                <ul className="text-xs sm:text-sm text-emerald-800 space-y-2 list-disc list-inside leading-relaxed">
                  <li>Direct routing to your designated security team or bug bounty platform.</li>
                  <li>Researchers can encrypt reports using your declared OpenPGP key.</li>
                  <li>Clear safe harbor guidelines established via your linked policy.</li>
                  <li>Automated security crawlers recognize your defensive posture immediately.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Educational Content Section 2: Standard Location & Fallback */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-[#F7F9FC]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-left">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-bold">
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span>RFC 9116 Location Hierarchy</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Where Must security.txt Be Hosted?
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                RFC 9116 Section 2.5.2 specifies a strict hierarchy of locations for serving security disclosure files. Clients and automated crawlers inspect locations in the following sequence:
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Primary (Mandatory)
                    </span>
                    <span className="text-sm font-bold text-slate-900">The Well-Known Directory</span>
                  </div>
                  <code className="text-xs sm:text-sm font-mono text-sky-700 block">
                    https://&lt;your-domain&gt;/.well-known/security.txt
                  </code>
                  <p className="text-xs text-slate-500">
                    Defined under RFC 8615 well-known URI architecture. This location takes precedence over all others.
                  </p>
                </div>
                <div className="shrink-0 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                  RFC 9116 Compliant
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Legacy Fallback
                    </span>
                    <span className="text-sm font-bold text-slate-900">The Root Directory</span>
                  </div>
                  <code className="text-xs sm:text-sm font-mono text-slate-700 block">
                    https://&lt;your-domain&gt;/security.txt
                  </code>
                  <p className="text-xs text-slate-500">
                    Permitted solely for backward compatibility with early drafts when the /.well-known/ path is unavailable.
                  </p>
                </div>
                <div className="shrink-0 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                  Generates Warning
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Educational Content Section 3: Supported Directives Guide */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-left">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <FileCode className="w-3.5 h-3.5 text-slate-500" />
                <span>Field Reference</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Supported RFC 9116 Directives Specification
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                RFC 9116 defines eight standardized directives. Every line must follow the case-insensitive format <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">Directive: Value</code>:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {supportedDirectives.map((dir) => {
                const DirIcon = dir.icon;
                return (
                  <div
                    key={dir.name}
                    className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                          <DirIcon className="w-3.5 h-3.5" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">{dir.name}</h3>
                      </div>
                      {dir.required ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Mandatory
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Optional ({dir.cardinality})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{dir.description}</p>
                    <div className="pt-1">
                      <code className="text-[11px] font-mono text-sky-800 bg-sky-50/70 px-2 py-1 rounded block border border-sky-100/80 truncate">
                        {dir.example}
                      </code>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Educational Content Section 4: Common Failures */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-[#F7F9FC]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-left">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Audit & Remediation</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Top 6 Common security.txt Validation Failures
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Over 40% of security.txt implementations published across the web fail RFC 9116 validation due to common syntax mistakes and stale timestamps. Here are the most frequent violations and how to fix them:
              </p>
            </div>

            <div className="space-y-4">
              {commonFailures.map((fail, idx) => (
                <div
                  key={idx}
                  className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">{fail.title}</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pl-8">
                    {fail.desc}
                  </p>
                  <div className="pl-8 pt-1 text-xs text-slate-800 font-medium">
                    <span className="font-bold text-emerald-700">Remediation: </span>
                    {fail.remedy}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Educational Content Section 5: Step-by-Step Sample File */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Production Template</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Production-Ready security.txt Template
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Copy and adapt this RFC 9116 compliant template for your organization. Save the file to <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">public/.well-known/security.txt</code> in your project repository:
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900 text-slate-100 p-5 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
              <pre>{`# Our security contact information
Contact: mailto:security@example.com
Contact: https://example.com/security/report

# Expiration date: RFC 3339 format (maximum 1 year ahead)
Expires: 2027-01-01T00:00:00.000Z

# Public PGP Key for encrypted disclosures
Encryption: https://example.com/.well-known/pgp-key.asc

# Vulnerability disclosure policy and safe harbor
Policy: https://example.com/security/policy

# Security hall of fame / bug bounty acknowledgments
Acknowledgments: https://example.com/security/hall-of-fame

# Canonical location of this file
Canonical: https://example.com/.well-known/security.txt

# Preferred communication languages (RFC 5646)
Preferred-Languages: en, de

# Career opportunities for security researchers
Hiring: https://example.com/careers/security`}</pre>
            </div>
          </div>
        </section>

        {/* FAQ Accordion Section */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-[#F7F9FC]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-bold">
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>Frequently Asked Questions</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                security.txt Validator FAQs
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Answers to common technical questions about RFC 9116 validation, directive requirements, and disclosure policies.
              </p>
            </div>

            <SecurityTxtFaqAccordion faqs={SECURITY_TXT_FAQS} />
          </div>
        </section>

        {/* Sibling Tools Section */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Defensive Utilities
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Explore Companion Security Tools
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Check other aspects of your defensive perimeter with our standalone diagnostic utilities.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {siblingTools.map((tool) => {
                const IconComp = tool.icon;
                return (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    className="bg-slate-50/70 rounded-3xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col justify-between space-y-4 group text-left"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-2xl bg-white text-sky-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                          <IconComp className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white text-slate-700 border border-slate-200">
                          {tool.badge}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                        {tool.name}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {tool.description}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-sky-600 group-hover:text-sky-700">
                      <span>Launch Utility</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Global CTA Section */}
        <section className="py-16 sm:py-20 bg-gradient-to-b from-white to-[#F7F9FC]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 text-sky-700 text-xs font-bold border border-sky-200/80">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>Full Defensive Posture Assessment</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Ready to Secure Your Entire Website Perimeter?
            </h2>

            <p className="text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Don&apos;t stop at security disclosure files. SiteSecura evaluates SSL/TLS certificates, HTTP security headers, DNS configurations, exposed administration panels, and open attack vectors in seconds.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="w-full sm:w-auto px-8 py-3.5 bg-[#087FE8] hover:bg-sky-600 text-white rounded-2xl font-bold text-sm transition-all shadow-md inline-flex items-center justify-center gap-2"
              >
                <span>Run Free Perimeter Scan</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/resources"
                className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold text-sm transition-all shadow-xs inline-flex items-center justify-center gap-2"
              >
                <span>Browse All Defensive Tools</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
