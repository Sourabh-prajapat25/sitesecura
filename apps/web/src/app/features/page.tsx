import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  Lock,
  Mail,
  Layers,
  Activity,
  FileText,
  Sparkles,
  BadgeCheck,
  Globe,
  Sliders,
  ArrowRight,
  CheckCircle2,
  Zap,
  Check,
  KeyRound,
  Compass,
  FileCode2,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { getSiteUrl, stripMarkdown } from "@/lib/seo";
import { PRICING_PLANS } from "@/lib/constants";
import { RemediationSnippetPreview } from "@/components/features/RemediationSnippetPreview";
import { PlanComparisonCards } from "@/components/features/PlanComparisonCards";
import { FeaturesFaqAccordion } from "@/components/features/FeaturesFaqAccordion";
import { FEATURES_PAGE_FAQS } from "@/components/features/faqData";

export function generateMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  const title = "Website Security Scanner Features & Capabilities | SiteSecura";
  const description =
    "Explore SiteSecura website security features, including SSL/TLS checks, security headers, DNS and SPF/DMARC analysis, security scoring, monitoring, and reports.";
  const canonical = `${siteUrl}/features`;

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "SiteSecura",
      locale: "en_US",
      type: "website",
      images: [
        {
          url: `${siteUrl}/brand/sitesecura-logo.svg`,
          width: 1200,
          height: 630,
          alt: "SiteSecura Website Security Platform",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${siteUrl}/brand/sitesecura-logo.svg`],
    },
  };
}

export default function FeaturesPage() {
  const siteUrl = getSiteUrl();

  const breadcrumbsSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${siteUrl}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Features",
        item: `${siteUrl}/features`,
      },
    ],
  };

  const softwareAppSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "SiteSecura Website Security Platform",
    applicationCategory: "SecurityApplication",
    operatingSystem: "Web",
    description:
      "Defensive website cybersecurity posture assessment, deterministic scoring, automated monitoring, and executive PDF reporting.",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "0",
      highPrice: "990",
      offerCount: PRICING_PLANS.length.toString(),
      offers: PRICING_PLANS.map((plan) => ({
        "@type": "Offer",
        name: `${plan.name} Plan`,
        price: plan.monthlyPrice.toString(),
        priceCurrency: "USD",
        description: plan.description,
        url: `${siteUrl}/pricing`,
      })),
    },
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Website Security Scanner Features & Capabilities | SiteSecura",
    description:
      "Explore SiteSecura website security features, including SSL/TLS checks, security headers, DNS and SPF/DMARC analysis, security scoring, monitoring, and reports.",
    url: `${siteUrl}/features`,
    publisher: {
      "@type": "Organization",
      name: "SiteSecura",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/brand/sitesecura-logo.svg`,
      },
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FEATURES_PAGE_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: stripMarkdown(faq.answer),
      },
    })),
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F9FC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-sky-500 selection:text-white transition-colors">
      <JsonLd data={breadcrumbsSchema} />
      <JsonLd data={softwareAppSchema} />
      <JsonLd data={webPageSchema} />
      <JsonLd data={faqSchema} />

      <Navbar />

      <main className="flex-1">
        {/* ========================================================================= */}
        {/* SECTION A: HERO                                                          */}
        {/* ========================================================================= */}
        <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-28 border-b border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-b from-sky-50/60 via-[#F7F9FC] to-[#F7F9FC] dark:from-slate-900 dark:via-slate-950 dark:to-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            {/* Eyebrow Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-100/80 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 text-xs font-bold border border-sky-200 dark:border-sky-800/80 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>WEBSITE SECURITY PLATFORM</span>
            </div>

            {/* Exactly One H1 */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight max-w-4xl mx-auto leading-[1.15]">
              Website Security Scanner & Monitoring for Modern Teams
            </h1>

            {/* Supporting Paragraph */}
            <p className="text-slate-600 dark:text-slate-300 text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed">
              SiteSecura replaces enterprise jargon with fast, non-intrusive cybersecurity evaluations. Instantly evaluate SSL/TLS encryption, security headers, DNS email authentication, and cookie defenses with a transparent 0–100 deterministic security score.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link
                href="/#scan-hero"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              >
                <span>Start Free Scan</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-sm border border-slate-200 dark:border-slate-800 shadow-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              >
                <span>View Plans & Pricing</span>
              </Link>
            </div>

            {/* Trust Points */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>Non-intrusive passive inspection</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>Perimeter scan results in ~15s</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>Deterministic 0–100 scoring</span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION B: CORE CAPABILITIES (6 CARDS)                                   */}
        {/* ========================================================================= */}
        <section className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Core Defensive Web Security Capabilities
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
              Comprehensive, non-intrusive assessments across the six foundational pillars of modern web security hygiene.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
            {/* Card 1: Deterministic Security Scoring */}
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-sky-400 dark:hover:border-sky-500/50 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Deterministic Security Scoring
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Every assessment calculates a transparent 0 to 100 mathematical score starting from a base of 100 points. Deductions apply across five weighted categories: HTTPS/SSL (30 pts), Security Headers (25 pts), DNS & Email (20 pts), Server Hygiene (15 pts), and Cookie Security (10 pts). Scores map strictly to risk levels: Excellent (90–100), Good (75–89), Medium Risk (60–74), High Risk (40–59), and Critical Risk (0–39).
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <span>100% rule-based mathematical scoring</span>
              </div>
            </div>

            {/* Card 2: SSL & TLS Certificate Auditing */}
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-sky-400 dark:hover:border-sky-500/50 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  SSL & TLS Certificate Auditing
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Deep inspection of transport-layer encryption certificates, trust paths, and protocol handshakes. Validates Certificate Authority (CA) trust chains, Subject Alternative Names (SAN), and expiration countdowns. Identifies support for TLS 1.3 and TLS 1.2, and flags deprecated protocols (SSLv3, TLS 1.0, TLS 1.1) or weak cipher suites to prevent browser security warnings and interception.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <span>Avoid sudden browser SSL warning screens</span>
              </div>
            </div>

            {/* Card 3: DNS, SPF & DMARC Email Authentication */}
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-sky-400 dark:hover:border-sky-500/50 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900">
                  <Mail className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  DNS, SPF & DMARC Email Authentication
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Audits public DNS records for SPF syntax (<code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">v=spf1</code>), DMARC policy enforcement (<code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">v=DMARC1</code> at <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">_dmarc.domain</code>), and DNSSEC validation to protect brand reputation against domain spoofing.
                </p>
                <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                  <span className="font-bold">Scope Notice:</span> SiteSecura audits public DNS-level authentication records. It does not read email inboxes, inspect email messages, filter spam, or scan attachments.
                </div>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <span>DNS-level domain spoofing defense</span>
              </div>
            </div>

            {/* Card 4: HTTP Security Headers Inspection */}
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-sky-400 dark:hover:border-sky-500/50 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  HTTP Security Headers Inspection
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Evaluates browser-enforced defense headers that stop client-side exploitation. Inspects Strict-Transport-Security (<code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">HSTS</code> with includeSubDomains and preload), Content-Security-Policy (<code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">CSP</code>), X-Frame-Options (clickjacking mitigation), X-Content-Type-Options (MIME-sniffing prevention), and Referrer-Policy.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <span>Defense-in-depth header verification</span>
              </div>
            </div>

            {/* Card 5: Cookie Security Inspection */}
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-sky-400 dark:hover:border-sky-500/50 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Cookie Security Inspection
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Inspects all <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">Set-Cookie</code> headers issued by your server for vital defense flags. Verifies the <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">Secure</code> attribute (enforcing encrypted HTTPS transit), <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">HttpOnly</code> (blocking JavaScript access to prevent session theft), and <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">SameSite</code> (Strict or Lax) to neutralize CSRF attacks.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <span>Session security & CSRF defense</span>
              </div>
            </div>

            {/* Card 6: Website Technology Detection */}
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-sky-400 dark:hover:border-sky-500/50 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900">
                  <Globe className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Website Technology Detection
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Passive fingerprinting that identifies underlying web servers (Nginx, Apache, Cloudflare, Caddy), content management systems (WordPress, Drupal), and application frameworks without intrusive probing. Flags exposed <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">Server</code> and <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">X-Powered-By</code> version disclosures that advertise known CVE vulnerabilities to attackers.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <span>Identify software version disclosures</span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION C: FINDINGS & REMEDIATION (2 COLUMNS)                            */}
        {/* ========================================================================= */}
        <section className="py-20 lg:py-28 border-y border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Actionable Findings with Ready-to-Deploy Fixes
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
                We don&apos;t just point out problems—SiteSecura provides copy-ready configuration directives and plain-English remediation guidance for every detected issue.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Left Column: Benefits & Details */}
              <div className="lg:col-span-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5 border border-sky-100 dark:border-sky-900">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        Prioritized Severity Tiers
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        Findings are classified into Critical, High, Warning, Info, and Pass so your engineering team knows exactly what to tackle first.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5 border border-sky-100 dark:border-sky-900">
                      <FileCode2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        Drop-In Server Configuration Snippets
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        Copy-paste directives tailored for Nginx, Apache, and Cloudflare response header transform rules. Eliminate guesswork and save hours of developer research.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5 border border-sky-100 dark:border-sky-900">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        Traceable Mathematical Impact
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        Every finding shows its exact point deduction. Fix an issue, re-scan in 15 seconds, and watch your security score rise immediately.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <Link
                    href="/docs"
                    className="inline-flex items-center gap-2 text-sm font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
                  >
                    <span>Browse technical documentation</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <Link
                    href="/tools/csp-policy-analyzer"
                    className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
                  >
                    <span>Try CSP Policy Analyzer tool</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Right Column: Interactive Code Snippet Mockup */}
              <div className="lg:col-span-6">
                <RemediationSnippetPreview />
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION D: ADVANCED FEATURES (4 CARDS WITH PLAN BADGES)                  */}
        {/* ========================================================================= */}
        <section className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Advanced Security Capabilities for Teams & Agencies
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
              Enhanced tools designed for engineering teams managing critical production sites and digital agencies overseeing client portfolios.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Card 1: AI Security Advisor */}
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Pro & Agency Plans
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  AI Security Advisor
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Integrates contextual LLM intelligence to evaluate your website&apos;s specific audit findings and generate tailored remediation roadmaps. Translates complex vulnerabilities into step-by-step developer checklists, framework-specific code snippets, and executive summaries for leadership.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <span>Included with 100 req/mo on Pro, 500 req/mo on Agency</span>
              </div>
            </div>

            {/* Card 2: SiteSecura Verified Trust Badge */}
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-emerald-400 dark:hover:border-emerald-500/50 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900">
                    <BadgeCheck className="w-6 h-6" />
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Basic, Pro & Agency
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  SiteSecura Verified Trust Badge
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Demonstrate your defensive cybersecurity posture to visitors with an embeddable SVG or iframe trust badge. Badges automatically reflect your website&apos;s latest scan and are available for qualifying domains achieving a verified score of 75 or higher.
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                  * Note: The badge reflects observable defensive configuration checks and does not represent an independent compliance certification or guarantee against attacks.
                </div>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span>Requires qualifying score ≥ 75 (Good or Excellent)</span>
              </div>
            </div>

            {/* Card 3: Deep Website Crawl & Attack Surface Discovery */}
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-sky-400 dark:hover:border-sky-500/50 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900">
                    <Compass className="w-6 h-6" />
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                    Pro (50 pages) • Agency (100 pages)
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Deep Website Crawl & Attack Surface Discovery
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Go beyond single-page testing. Performs a bounded multi-page crawl (up to 50 pages on Pro, 100 pages on Agency at depth 2) to evaluate your domain structure, discovering observable internal assets, identifying broken mixed-content HTTP links, and auditing frontend third-party script dependencies.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <span>Multi-page bounded crawl (depth 2)</span>
              </div>
            </div>

            {/* Card 4: Interactive Security Configuration Utilities */}
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-slate-400 dark:hover:border-slate-600 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                    Included Free on All Plans
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Interactive Security Configuration Utilities
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Access a full suite of free standalone security utilities for instant debugging and validation. Includes our CSP Policy Analyzer, DNS Lookup Tool, HTTP Status & Redirect Tracer, Robots.txt & Sitemap Checker, and security.txt Validator.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Link
                  href="/resources"
                  className="hover:underline flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
                >
                  <span>Explore all free security tools</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION E: MONITORING & REPORTS (2 BALANCED PANELS)                      */}
        {/* ========================================================================= */}
        <section className="py-20 lg:py-28 border-y border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Automated Monitoring & Professional PDF Reporting
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
                Maintain continuous visibility into configuration drift and share polished, audit-ready security reports with stakeholders.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              {/* Panel 1: Continuous Automated Monitoring */}
              <div className="p-8 sm:p-10 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6">
                <div className="space-y-5">
                  <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200 dark:border-sky-800">
                    <Activity className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Automated Scheduled Monitoring & Drift Alerts
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Website security isn&apos;t static. Software deployments, CDN updates, and DNS modifications can inadvertently drop defensive headers or break encryption chains. SiteSecura scans your portfolio in the background so you know before your visitors or clients do.
                  </p>

                  <ul className="space-y-3 pt-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Flexible Monitoring Cadence:</strong> Weekly automated scans on Basic; daily scans on Pro and Agency.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>14-Day SSL Expiry Warnings:</strong> Proactive alerts dispatched 14 days before certificate expiration to eliminate downtime.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Security Drift Notifications:</strong> Instant alerts if security headers drop, DNS changes occur, or your score decreases.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Security Health Timeline:</strong> 30 to 365 days of historical posture tracking to demonstrate compliance progress.</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
                  >
                    <span>Compare monitoring frequencies on Pricing</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Panel 2: Executive & White-Label PDF Reports */}
              <div className="p-8 sm:p-10 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6">
                <div className="space-y-5">
                  <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200 dark:border-sky-800">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Executive PDF Reports & White-Label Branding
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Transform technical findings into clear, beautifully formatted PDF audit reports ready for management, clients, cyber-insurance underwriters, and compliance reviews.
                  </p>

                  <ul className="space-y-3 pt-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Free Plan Preview:</strong> Watermarked PDF summary showing overall score, posture grade, and top findings.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Full Technical Audit Reports:</strong> Unredacted findings, technical evidence, and step-by-step remediation commands.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Custom Agency White-Labeling:</strong> Upload your agency logo, set your primary brand color, and customize footer text.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                      <span><strong>Audit & Insurance Ready:</strong> Structured summaries designed for SOC 2, ISO 27001, and cyber-insurance questionnaires.</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
                  >
                    <span>View agency white-label capabilities</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION F: COMPACT PLAN COMPARISON                                       */}
        {/* ========================================================================= */}
        <section className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Find the Right Security Plan for Your Needs
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
              Simple, transparent pricing. Start free and scale up as your website portfolio, scan limits, and monitoring requirements grow.
            </p>
          </div>

          <PlanComparisonCards />
        </section>

        {/* ========================================================================= */}
        {/* SECTION G: HOW SITESECURA WORKS (4 STEPS)                                */}
        {/* ========================================================================= */}
        <section className="py-20 lg:py-28 border-y border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                How SiteSecura Works in 4 Simple Steps
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
                Zero agent installation required. No DNS reconfiguration, no software dependencies, and actionable results in seconds.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Step 1 */}
              <div className="relative p-6 sm:p-7 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 space-y-3">
                <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest">
                  Step 01
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Enter Your Domain
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Simply enter your website URL into the scanner. SiteSecura performs passive inspections without modifying your server or requiring DNS verification to run an initial scan.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative p-6 sm:p-7 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 space-y-3">
                <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest">
                  Step 02
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Run Defensive Checks
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Our scanning engine executes non-intrusive inspections across SSL/TLS certificates, DNS records, HTTP response headers, and cookie flags in 5 to 15 seconds.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative p-6 sm:p-7 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 space-y-3">
                <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest">
                  Step 03
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Review Actionable Fixes
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Receive an exact 0 to 100 security score with prioritized findings, transparent point deductions, and copy-paste remediation directives for Nginx, Apache, and Cloudflare.
                </p>
              </div>

              {/* Step 4 */}
              <div className="relative p-6 sm:p-7 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 space-y-3">
                <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest">
                  Step 04
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Track & Preserve Posture
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Add your domain to automated monitoring to receive proactive alerts when certificates approach expiration or when recent deployments drop critical security headers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION H: FREQUENTLY ASKED QUESTIONS (8 QUESTIONS)                      */}
        {/* ========================================================================= */}
        <section className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
              Everything you need to know about SiteSecura&apos;s defensive scanning engine, deterministic scoring, and data privacy.
            </p>
          </div>

          <FeaturesFaqAccordion />

          <div className="text-center pt-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            <span>Have additional technical questions? Explore our </span>
            <Link
              href="/docs"
              className="text-sky-600 dark:text-sky-400 font-bold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
            >
              Documentation Guides
            </Link>
            <span> or browse our free </span>
            <Link
              href="/resources"
              className="text-sky-600 dark:text-sky-400 font-bold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
            >
              Defensive Web Utilities
            </Link>
            .
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION I: FINAL CONVERSION CTA BANNER                                   */}
        {/* ========================================================================= */}
        <section className="py-16 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-800 text-white p-8 sm:p-14 text-center space-y-8 overflow-hidden shadow-2xl">
            {/* Subtle background glow */}
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-3xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold backdrop-blur-xs border border-white/20">
                <Zap className="w-3.5 h-3.5 text-sky-200" />
                <span>INSTANT SECURITY AUDIT</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Ready to Understand Your Website&apos;s Security?
              </h2>
              <p className="text-sky-100 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                Scan your domain for free without creating an account or providing a credit card. Get a deterministic score and actionable fix recommendations in under 15 seconds.
              </p>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/#scan-hero"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-sky-700 font-extrabold rounded-xl text-sm shadow-lg hover:bg-sky-50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sky-700"
              >
                <span>Start Free Scan</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-sky-800/80 hover:bg-sky-800 text-white font-bold rounded-xl text-sm border border-white/20 backdrop-blur-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sky-700"
              >
                <span>Compare Plans & Pricing</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
