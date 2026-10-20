import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  ShieldCheck,
  FileCode,
  Sliders,
  ChevronRight,
  Lock,
  ArrowRight,
  BookOpen,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Terminal,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getSiteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { SecurityConfigGenerator } from "@/components/docs/SecurityConfigGenerator";

export const metadata: Metadata = {
  title: {
    absolute:
      "Security Configuration Snippet Generator | Nginx, Apache, Caddy & Cloudflare | SiteSecura Docs",
  },
  description:
    "Interactive security header configuration generator for Nginx, Apache, Caddy, and Cloudflare. Generate copy-ready HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy snippets with safe defaults and cautionary alerts.",
  alternates: {
    canonical: `${getSiteUrl()}/docs/tools/security-config-generator`,
  },
  openGraph: {
    title:
      "Security Configuration Snippet Generator | Nginx, Apache, Caddy & Cloudflare | SiteSecura Docs",
    description:
      "Generate production-ready defensive security header directives for Nginx, Apache, Caddy, and Cloudflare with safe defaults, CSP templates, and HSTS preload warnings.",
    url: `${getSiteUrl()}/docs/tools/security-config-generator`,
    siteName: "SiteSecura",
    locale: "en_US",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Security Configuration Snippet Generator | Nginx, Apache, Caddy & Cloudflare",
    description:
      "Generate production-hardened web server security header configurations with interactive controls and instant copy.",
  },
};

export default function SecurityConfigGeneratorPage() {
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
        name: "Documentation",
        item: `${siteUrl}/docs`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Security Configuration Snippet Generator",
        item: `${siteUrl}/docs/tools/security-config-generator`,
      },
    ],
  };

  const techArticleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Security Configuration Snippet Generator for Nginx, Apache, Caddy, and Cloudflare",
    description:
      "Interactive technical tool for generating copy-ready defensive HTTP response header snippets including HSTS, Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.",
    url: `${siteUrl}/docs/tools/security-config-generator`,
    author: {
      "@type": "Organization",
      name: "SiteSecura Security Engineering Team",
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "SiteSecura",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/logo.png`,
      },
    },
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      <JsonLd data={breadcrumbsSchema} />
      <JsonLd data={techArticleSchema} />
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full space-y-10">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Link href="/" className="hover:text-slate-900 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link href="/docs" className="hover:text-slate-900 transition-colors">
            Documentation
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900 font-semibold truncate">Security Config Generator</span>
        </nav>

        {/* Hero Header */}
        <div className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200/70">
            <Sliders className="w-3 h-3 text-sky-600" />
            <span>Interactive Documentation Utility</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight leading-tight">
            Security Configuration Snippet Generator
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Generate production-hardened defensive HTTP response header configurations tailored for{" "}
            <strong>Nginx</strong>, <strong>Apache</strong>, <strong>Caddy</strong>, or <strong>Cloudflare Transform Rules</strong>.
            Customize HSTS max-age, CSP templates, and framing policies with safe defaults and explicit cautionary alerts.
          </p>
        </div>

        {/* Interactive Snippet Generator Component */}
        <section aria-label="Configuration Generator Tool">
          <SecurityConfigGenerator />
        </section>

        {/* Educational Deployment Guidance */}
        <section aria-labelledby="deployment-guidance-heading" className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xs">
          <div className="space-y-2 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-600" />
              <h2 id="deployment-guidance-heading" className="text-base sm:text-lg font-bold text-slate-950">
                Safe Deployment Guidance: Rolling Out Security Headers Without Downtime
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              Applying restrictive security headers to production websites without validation can inadvertently break third-party analytics, embedded videos, payment gateways, or legitimate cross-domain iframes. Follow these industry best practices:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>1. Test HSTS in Stages</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Before setting <code className="text-[11px] font-mono bg-slate-200/60 px-1 py-0.5 rounded">max-age=31536000</code> with preload, test with a short duration (e.g., 300 seconds, then 86400 seconds). Ensure all subdomains resolve over valid HTTPS before adding <code className="text-[11px] font-mono bg-slate-200/60 px-1 py-0.5 rounded">includeSubDomains</code>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>2. Use CSP Report-Only First</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Never deploy an enforcing Content Security Policy without first running in <code className="text-[11px] font-mono bg-slate-200/60 px-1 py-0.5 rounded">Content-Security-Policy-Report-Only</code> mode. Monitor browser console logs or telemetry to catch missing CDN script origins.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>3. Check Iframe Dependencies</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                If your platform is legitimately embedded in partner dashboards or parent portal frames, setting <code className="text-[11px] font-mono bg-slate-200/60 px-1 py-0.5 rounded">X-Frame-Options: DENY</code> will break the integration. Use <code className="text-[11px] font-mono bg-slate-200/60 px-1 py-0.5 rounded">frame-ancestors</code> in CSP for granular origin whitelisting.
              </p>
            </div>
          </div>

          {/* Related Documentation Guides */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Detailed Documentation Guides</h3>
              <p className="text-xs text-slate-500">Read in-depth specifications on each header evaluated by SiteSecura:</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/docs/security-checks/http-security-headers"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600" />
                <span>HTTP Security Headers Guide</span>
              </Link>
              <Link
                href="/docs/security-checks/content-security-policy"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600" />
                <span>CSP Directives Guide</span>
              </Link>
              <Link
                href="/tools/security-headers-checker"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-2xs transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Test Live Headers</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
