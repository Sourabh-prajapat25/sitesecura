import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  FileCode,
  ChevronRight,
  Bot,
  Layers,
  Globe,
  Compass,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Network,
  RefreshCw,
  Lock,
  Search,
  FileCheck,
  Zap,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getSiteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { RobotsSitemapApp } from "@/components/tools/robots-sitemap/RobotsSitemapApp";
import { RobotsSitemapFaqAccordion } from "@/components/tools/robots-sitemap/RobotsSitemapFaqAccordion";
import { ROBOTS_SITEMAP_FAQS } from "@/components/tools/robots-sitemap/faqData";

export const metadata: Metadata = {
  title: {
    absolute: "Robots.txt & Sitemap Checker | RFC 9309 & XML Validator | SiteSecura",
  },
  description:
    "Free online robots.txt and XML sitemap validator. Inspect crawler directives against RFC 9309, test paths with longest-match rule simulator, validate XML sitemap syntax, and check indexing boundaries.",
  alternates: {
    canonical: `${getSiteUrl()}/tools/robots-sitemap-checker`,
  },
  openGraph: {
    title: "Robots.txt & Sitemap Checker | RFC 9309 & XML Validator | SiteSecura",
    description:
      "Inspect robots.txt directives and validate XML sitemaps against official RFC 9309 and Sitemaps.org standards. Simulate crawler access rules with real-time longest-match evaluation for free.",
    url: `${getSiteUrl()}/tools/robots-sitemap-checker`,
    siteName: "SiteSecura",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Robots.txt & Sitemap Checker | RFC 9309 & XML Validator | SiteSecura",
    description:
      "Validate robots.txt directives under RFC 9309, simulate user-agent crawl access, and inspect XML sitemaps and sitemap indexes safely over HTTPS.",
  },
};

export default function RobotsSitemapCheckerPage() {
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
        name: "Robots.txt & Sitemap Checker",
        item: `${siteUrl}/tools/robots-sitemap-checker`,
      },
    ],
  };

  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "SiteSecura Robots.txt & Sitemap Checker",
    description:
      "Free standalone RFC 9309 robots.txt parser and XML sitemap validator. Checks crawler access directives, simulates user-agent crawl paths, inspects sitemap indexes, and audits search engine crawlability boundaries.",
    url: `${siteUrl}/tools/robots-sitemap-checker`,
    applicationCategory: "SecurityApplication",
    operatingSystem: "All",
    browserRequirements: "Requires JavaScript. Requires HTML5.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Organization",
      name: "SiteSecura",
      url: siteUrl,
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: ROBOTS_SITEMAP_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const commonFailureCases = [
    {
      title: "Missing User-agent Declaration",
      code: "ROBOTS_SYNTAX_ERROR",
      desc: "Allow or Disallow directives published without an preceding User-agent line are invalid under RFC 9309 and will be discarded by crawlers.",
      fix: "Always group crawl rules under explicit 'User-agent: *' or specific bot token lines.",
    },
    {
      title: "UTF-8 BOM Characters",
      code: "ROBOTS_BOM_PRESENT",
      desc: "Text editors sometimes save robots.txt with a Byte Order Mark (\\uFEFF), which can cause older parsers to misread the first User-agent directive.",
      fix: "Save robots.txt in plain UTF-8 without BOM encoding.",
    },
    {
      title: "Disallowing URLs with 'noindex'",
      code: "ROBOTS_BLOCKS_NOINDEX",
      desc: "If a page is blocked in robots.txt, crawlers cannot fetch it to discover the meta noindex tag, causing the URL to remain indexed via external links.",
      fix: "Remove the Disallow rule and place '<meta name=\"robots\" content=\"noindex\">' in the HTML <head>.",
    },
    {
      title: "Exceeding Sitemap Limits (50k URLs / 50 MB)",
      code: "SITEMAP_SIZE_LIMIT_EXCEEDED",
      desc: "A single XML sitemap containing more than 50,000 URLs or exceeding 50 MB uncompressed violates the official Sitemaps.org specification.",
      fix: "Partition URLs into multiple child sitemaps and link them using a Sitemap Index document (<sitemapindex>).",
    },
    {
      title: "Invalid ISO 8601 <lastmod> Timestamps",
      code: "SITEMAP_INVALID_LASTMOD",
      desc: "Using non-standard date formats (e.g. MM/DD/YYYY) instead of W3C Datetime format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ).",
      fix: "Format all <lastmod> entries following ISO 8601 / W3C specifications.",
    },
    {
      title: "Cross-Origin Sitemaps on External Hosts",
      code: "SITEMAP_EXTERNAL_ORIGIN",
      desc: "Declaring sitemap URLs located on an external domain without cross-submission proof. These are skipped under safe-origin security policies.",
      fix: "Host sitemaps on the same domain and protocol as the website.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-slate-900 flex flex-col font-sans">
      <JsonLd data={breadcrumbsSchema} />
      <JsonLd data={webAppSchema} />
      <JsonLd data={faqSchema} />

      <Navbar />

      <main className="flex-1">
        {/* Breadcrumb Navigation */}
        <div className="border-b border-slate-200/80 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 text-xs text-slate-500 font-medium"
            >
              <Link
                href="/"
                className="hover:text-slate-900 transition-colors flex items-center gap-1"
              >
                Home
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <Link
                href="/resources"
                className="hover:text-slate-900 transition-colors"
              >
                Resources
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-900 font-bold" aria-current="page">
                Robots.txt & Sitemap Checker
              </span>
            </nav>
          </div>
        </div>

        {/* Hero Section */}
        <section className="py-12 sm:py-16 border-b border-slate-200/80 bg-white text-left">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold border border-sky-200/80">
              <Bot className="w-3.5 h-3.5 text-sky-600" />
              <span>Crawlability & Technical SEO Utility</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-950 tracking-tight leading-[1.15]">
                Robots.txt & Sitemap Checker
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-3xl">
                Inspect your website's <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">robots.txt</code> against the official <strong>RFC 9309 Robots Exclusion Protocol</strong>, test crawler access with an interactive path simulator, and validate <strong>XML Sitemaps</strong> for search engine compliance.
              </p>
            </div>

            {/* Feature Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                <FileCode className="w-3.5 h-3.5 text-slate-500" />
                RFC 9309 Protocol
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                XML Sitemaps.org
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                <Compass className="w-3.5 h-3.5 text-slate-500" />
                Interactive Path Simulator
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                SSRF-Protected
              </span>
            </div>
          </div>
        </section>

        {/* Interactive Tool Workspace */}
        <section className="py-12 sm:py-16 bg-[#F7F9FC]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <RobotsSitemapApp />
          </div>
        </section>

        {/* Educational Content Section 1: What is robots.txt & RFC 9309 */}
        <section className="py-14 sm:py-16 border-t border-b border-slate-200/80 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <FileCode className="w-3.5 h-3.5 text-slate-500" />
                <span>Internet Standard</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                What is robots.txt & RFC 9309?
              </h2>
            </div>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              The Robots Exclusion Protocol originated in 1994 as an informal consensus among early web crawler developers. For nearly three decades, different search engines implemented slightly divergent interpretations of pattern matching, wildcards, and rule precedence.
            </p>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              In September 2022, the Internet Engineering Task Force (IETF) published <strong>RFC 9309</strong>, codifying robots.txt into a formal Proposed Standard. RFC 9309 establishes deterministic rules for:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-sky-600" />
                  User-Agent Grouping
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Directives are grouped under one or more <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[11px] font-mono">User-agent:</code> lines. Crawlers must match the most specific group matching their product token, or fall back to the wildcard <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[11px] font-mono">*</code> group.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Compass className="w-4 h-4 text-sky-600" />
                  Longest Match Precedence
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  When multiple Allow and Disallow rules match a URL path, the rule with the longest matching pattern length in octets takes precedence.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Equal Specificity Allow Precedence
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  If an <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[11px] font-mono">Allow:</code> and <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[11px] font-mono">Disallow:</code> rule match a path with equal pattern length, the <strong>Allow</strong> directive wins under RFC 9309 §2.2.2.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-purple-600" />
                  Empty Disallow Means Allow All
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  An empty <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[11px] font-mono">Disallow:</code> line clears all crawl restrictions, explicitly declaring the entire origin open to crawling.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Educational Content Section 2: What is an XML Sitemap */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-[#F7F9FC]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Discovery Architecture</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                What is an XML Sitemap?
              </h2>
            </div>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              While <strong>robots.txt</strong> defines boundaries on what crawlers may <em>not</em> fetch, an <strong>XML sitemap</strong> serves the opposite purpose: it acts as a structured catalog telling search engines which canonical URLs exist, when they were last updated, and how they should be prioritized.
            </p>

            <div className="space-y-4 pt-2">
              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                      Standard URL Set
                    </span>
                    <span className="text-sm font-bold text-slate-900">&lt;urlset&gt;</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    The root XML tag for standard sitemaps containing up to 50,000 individual &lt;url&gt; nodes with &lt;loc&gt;, &lt;lastmod&gt;, &lt;changefreq&gt;, and &lt;priority&gt;.
                  </p>
                </div>
                <div className="shrink-0 text-xs font-bold text-sky-700 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200">
                  Up to 50,000 URLs
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      Sitemap Index
                    </span>
                    <span className="text-sm font-bold text-slate-900">&lt;sitemapindex&gt;</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    The parent catalog tag for websites with more than 50,000 URLs or multiple sections. Lists child sitemaps inside &lt;sitemap&gt; elements.
                  </p>
                </div>
                <div className="shrink-0 text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200">
                  Parent Catalog
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Educational Content Section 3: Where Should Files Be Located */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span>Host Location Requirements</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Where Should Files Be Located?
              </h2>
            </div>

            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Robots.txt Location (Strict RFC 9309 Rule)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Origin Root Only
                  </span>
                </div>
                <code className="text-xs sm:text-sm font-mono text-sky-700 block">
                  https://&lt;your-domain&gt;/robots.txt
                </code>
                <p className="text-xs text-slate-500">
                  robots.txt MUST be hosted at the root path of the target origin. Subdirectory placements (e.g., <code className="font-mono">/blog/robots.txt</code>) are ignored by compliant crawlers.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    XML Sitemap Location & Declaration
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                    Conventional & Declared
                  </span>
                </div>
                <code className="text-xs sm:text-sm font-mono text-slate-700 block">
                  Sitemap: https://&lt;your-domain&gt;/sitemap.xml
                </code>
                <p className="text-xs text-slate-500">
                  Conventionally placed at <code className="font-mono">/sitemap.xml</code>, but may reside anywhere within the same host origin as long as it is explicitly declared inside robots.txt.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Educational Content Section 4: Common Failures */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-[#F7F9FC]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-left">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
                <span>Configuration Diagnostics</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Common Failures & Syntax Errors
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Automated validation regularly uncovers the following critical configuration mistakes:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {commonFailureCases.map((fCase) => (
                <div
                  key={fCase.code}
                  className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">{fCase.title}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono text-rose-700 bg-rose-50 border border-rose-200">
                      {fCase.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{fCase.desc}</p>
                  <div className="pt-1 text-xs text-emerald-800 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100">
                    <span className="font-bold">Fix: </span>
                    {fCase.fix}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Educational Content Section 5: Security Myth: Does robots.txt Protect Private Pages? */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                <Lock className="w-3.5 h-3.5 text-rose-600" />
                <span>Security Myth Debunked</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Does robots.txt Protect Private Pages?
              </h2>
            </div>

            <div className="p-6 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-3">
              <h3 className="text-sm font-bold text-rose-950 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                robots.txt is NOT an Access Control Boundary
              </h3>
              <p className="text-xs sm:text-sm text-rose-900 leading-relaxed">
                A common and dangerous mistake is using robots.txt to hide sensitive endpoints such as <code className="font-mono bg-white/80 px-1 py-0.5 rounded">/admin/</code>, <code className="font-mono bg-white/80 px-1 py-0.5 rounded">/staging/</code>, or <code className="font-mono bg-white/80 px-1 py-0.5 rounded">/internal/</code>.
              </p>
              <p className="text-xs sm:text-sm text-rose-900 leading-relaxed">
                robots.txt is a <strong>publicly accessible file</strong>. Malicious actors, scrapers, and penetration testers regularly inspect robots.txt as part of initial reconnaissance to discover confidential or unlinked endpoints.
              </p>
              <div className="pt-2 text-xs font-medium text-rose-950 bg-white/90 p-3 rounded-xl border border-rose-200">
                <strong>Best Practice:</strong> Secure sensitive endpoints using proper authentication, multi-factor authorization, IP allowlists, or firewalls. Never rely on robots.txt for security or privacy.
              </div>
            </div>
          </div>
        </section>

        {/* Educational Content Section 6: FAQ Accordion */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-[#F7F9FC]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-left">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>Frequently Asked Questions</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Robots.txt & Sitemap FAQs
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Detailed technical guidance on RFC 9309 parsing, sitemap validation, search engine indexing, and safe crawler configuration.
              </p>
            </div>

            <RobotsSitemapFaqAccordion />
          </div>
        </section>

        {/* Related Free Cybersecurity Tools */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-left">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <Zap className="w-3.5 h-3.5 text-slate-500" />
                <span>SiteSecura Utilities</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Explore More Free Security & Web Tools
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Inspect other facets of your website’s security, transport integrity, and domain posture:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link
                href="/tools/security-txt-validator"
                className="group p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50/30 transition-all space-y-2"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <FileCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                  security.txt Validator
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Validate RFC 9116 security disclosure files, Contact directives, and PGP encryption keys.
                </p>
              </Link>

              <Link
                href="/tools/http-status-checker"
                className="group p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50/30 transition-all space-y-2"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                  HTTP Status & Redirect Checker
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Inspect HTTP status codes, trace redirect chains, and detect SSL downgrade loops.
                </p>
              </Link>

              <Link
                href="/tools/dns-lookup"
                className="group p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50/30 transition-all space-y-2"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Network className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                  DNS Lookup Tool
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Query forward DNS records (A, AAAA, MX, NS, TXT, SOA, CAA) with TTL metrics.
                </p>
              </Link>

              <Link
                href="/tools/ssl-checker"
                className="group p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50/30 transition-all space-y-2"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                  SSL/TLS Certificate Checker
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Inspect TLS certificate validity, issuer trust chains, expiration dates, and cipher suites.
                </p>
              </Link>

              <Link
                href="/tools/security-headers-checker"
                className="group p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50/30 transition-all space-y-2"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                  Security Headers Checker
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Audit CSP, HSTS, X-Frame-Options, Permissions-Policy, and CORS configurations.
                </p>
              </Link>

              <Link
                href="/tools/website-security-checker"
                className="group p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50/30 transition-all space-y-2"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                  Website Security Checker
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Launch a comprehensive perimeter scan assessing vulnerabilities, SSL, and DNS posture.
                </p>
              </Link>
            </div>
          </div>
        </section>

        {/* Bottom CTA Section */}
        <section className="py-16 sm:py-20 bg-slate-900 text-white text-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-sky-400 text-xs font-bold border border-slate-700">
              <ShieldCheck className="w-3.5 h-3.5" />
              Automated Perimeter Defense
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Ready for a Complete Security Assessment?
            </h2>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              Robots.txt and sitemaps define crawlability, but what about SSL misconfigurations, open ports, missing HTTP security headers, and domain spoofing risks?
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/tools/website-security-checker"
                className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center gap-2"
              >
                <span>Launch Free Full Security Scan</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/resources"
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm rounded-xl border border-slate-700 transition-all"
              >
                Browse All Resources
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
