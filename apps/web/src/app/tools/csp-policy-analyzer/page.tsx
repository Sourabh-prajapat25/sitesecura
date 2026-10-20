import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  FileCode,
  ChevronRight,
  Layers,
  Lock,
  Code2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Zap,
  Sparkles,
  FileCheck,
  Globe,
  SlidersHorizontal,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getSiteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { CspPolicyApp } from "@/components/tools/csp-policy/CspPolicyApp";
import { CspPolicyFaqAccordion } from "@/components/tools/csp-policy/CspPolicyFaqAccordion";
import { CSP_POLICY_FAQS } from "@/components/tools/csp-policy/faqData";

export const metadata: Metadata = {
  title: {
    absolute: "CSP Policy Analyzer | W3C Level 3 Content Security Policy Validator | SiteSecura",
  },
  description:
    "Free online Content Security Policy (CSP) analyzer and validator. Audit W3C CSP Level 3 directives, resolve fallback hierarchies, detect 'unsafe-inline' and 'unsafe-eval' bypasses, verify 'strict-dynamic' nonces, and score policy resistance.",
  alternates: {
    canonical: `${getSiteUrl()}/tools/csp-policy-analyzer`,
  },
  openGraph: {
    title: "CSP Policy Analyzer | W3C Level 3 Content Security Policy Validator | SiteSecura",
    description:
      "Analyze your Content-Security-Policy header or inspect live HTTPS website headers. Evaluates directive fallbacks, XSS injection resistance, unquoted keywords, and modern 'strict-dynamic' nonce configurations.",
    url: `${getSiteUrl()}/tools/csp-policy-analyzer`,
    siteName: "SiteSecura",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CSP Policy Analyzer | W3C Level 3 Content Security Policy Validator | SiteSecura",
    description:
      "Audit Content Security Policy syntax, resolve default-src fallback inheritance, evaluate script-src injection protection, and score CSP security resistance.",
  },
};

export default function CspPolicyAnalyzerPage() {
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
        name: "CSP Policy Analyzer",
        item: `${siteUrl}/tools/csp-policy-analyzer`,
      },
    ],
  };

  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "SiteSecura Content Security Policy (CSP) Analyzer",
    description:
      "Free standalone W3C CSP Level 3 policy analyzer and header inspector. Parses raw CSP strings offline with zero outbound network calls, inspects live website headers over HTTPS with SSRF protection, models directive fallback inheritance, and grades policy security resistance.",
    url: `${siteUrl}/tools/csp-policy-analyzer`,
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
    mainEntity: CSP_POLICY_FAQS.map((faq) => ({
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
      title: "Omitted 'object-src' Directive",
      code: "CSP_OBJECT_SRC_MISSING",
      desc: "Leaving out object-src allows malicious Flash, Java applets, or PDF plugins to execute in older or legacy browser contexts, bypassing script-src restrictions.",
      fix: "Explicitly declare object-src 'none' in your policy unless plugin execution is mandatory.",
    },
    {
      title: "Missing 'base-uri' Restriction",
      code: "CSP_BASE_URI_MISSING",
      desc: "base-uri does NOT inherit from default-src. If omitted, attackers can inject a <base href=\"https://attacker.com\"> tag to hijack relative script imports.",
      fix: "Explicitly set base-uri 'self' or base-uri 'none' to prevent base tag manipulation.",
    },
    {
      title: "Permissive Wildcard Host Sources",
      code: "CSP_WILDCARD_SOURCE",
      desc: "Using wildcard origins like * or https:* grants unrestricted script loading, permitting any external domain to serve executable JavaScript.",
      fix: "Replace wildcards with cryptographic nonces, SHA-256 hashes, or specific trusted origins.",
    },
    {
      title: "Unquoted Keyword Literals",
      code: "CSP_UNQUOTED_KEYWORD",
      desc: "Writing self, none, or unsafe-inline without single quotes causes browsers to treat them as hostname endpoints (e.g., http://self) rather than special directives.",
      fix: "Always wrap keywords in single quotes: 'self', 'none', 'unsafe-inline', 'strict-dynamic'.",
    },
    {
      title: "Missing 'frame-ancestors' (Clickjacking)",
      code: "CSP_FRAME_ANCESTORS_MISSING",
      desc: "frame-ancestors does NOT fall back to default-src. Without it, third-party sites can embed your application in an iframe for UI redressing attacks.",
      fix: "Declare frame-ancestors 'self' or frame-ancestors 'none' to supersede legacy X-Frame-Options.",
    },
    {
      title: "Active 'unsafe-eval' in Production",
      code: "CSP_UNSAFE_EVAL_USAGE",
      desc: "Enabling 'unsafe-eval' permits window.eval(), Function(), and setTimeout(string), dramatically increasing the blast radius of injection flaws.",
      fix: "Refactor legacy templating or math parsing libraries to use precompiled templates and JSON parsers.",
    },
  ];

  const fallbackHierarchyItems = [
    {
      directive: "script-src",
      fallsBackTo: "default-src",
      inherits: true,
      description: "Restricts sources for JavaScript execution. Inherits from default-src if absent.",
    },
    {
      directive: "style-src",
      fallsBackTo: "default-src",
      inherits: true,
      description: "Restricts stylesheets and style attributes. Inherits from default-src if absent.",
    },
    {
      directive: "img-src",
      fallsBackTo: "default-src",
      inherits: true,
      description: "Controls image loading origins. Inherits from default-src if absent.",
    },
    {
      directive: "connect-src",
      fallsBackTo: "default-src",
      inherits: true,
      description: "Restricts XHR, fetch(), WebSocket, and EventSource connections. Inherits from default-src.",
    },
    {
      directive: "object-src",
      fallsBackTo: "default-src",
      inherits: true,
      description: "Restricts <object>, <embed>, and <applet> plugins. Highly recommended to set to 'none'.",
    },
    {
      directive: "base-uri",
      fallsBackTo: "None (Never inherits)",
      inherits: false,
      description: "Restricts URLs allowed in <base> tags. MUST be explicitly configured; never inherits.",
    },
    {
      directive: "form-action",
      fallsBackTo: "None (Never inherits)",
      inherits: false,
      description: "Restricts targets for form submissions (<form action>). MUST be explicitly configured.",
    },
    {
      directive: "frame-ancestors",
      fallsBackTo: "None (Never inherits)",
      inherits: false,
      description: "Controls which sites can embed this page in <iframe>. Never inherits from default-src.",
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
                CSP Policy Analyzer
              </span>
            </nav>
          </div>
        </div>

        {/* Hero Section */}
        <section className="py-12 sm:py-16 border-b border-slate-200/80 bg-white text-left">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200/80">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>W3C CSP Level 3 Security Utility</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-950 tracking-tight leading-[1.15]">
                Content Security Policy (CSP) Analyzer
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-3xl">
                Validate your website's <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono font-semibold">Content-Security-Policy</code> against <strong>W3C CSP Level 3</strong> specifications. Inspect directive fallbacks, detect dangerous <code className="text-xs bg-rose-50 text-rose-700 px-1 rounded font-mono">&apos;unsafe-inline&apos;</code> execution, verify cryptographic nonces, and score injection resistance.
              </p>
            </div>

            {/* Feature Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                <FileCode className="w-3.5 h-3.5 text-slate-500" />
                W3C CSP Level 3
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                Fallback Hierarchy Resolution
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                &apos;strict-dynamic&apos; & Nonces
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                <Zap className="w-3.5 h-3.5 text-slate-500" />
                Offline Paste & Remote Modes
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
            <CspPolicyApp />
          </div>
        </section>

        {/* Educational Content Section 1: What is Content Security Policy */}
        <section className="py-14 sm:py-16 border-t border-b border-slate-200/80 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <FileCode className="w-3.5 h-3.5 text-slate-500" />
                <span>W3C Standard Defense</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                What is Content Security Policy (CSP)?
              </h2>
            </div>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              <strong>Content Security Policy (CSP)</strong> is an HTTP response header that provides a declarative defense-in-depth security layer against <strong>Cross-Site Scripting (XSS)</strong>, clickjacking, code injection, and data exfiltration. By instructing modern browsers which origins, scripts, stylesheets, and embedded frames are authorized to run, CSP drastically limits the harm an attacker can inflict even if an application suffers from an input sanitization failure.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">Enforcing Mode</h3>
                </div>
                <div className="text-xs font-mono bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-700">
                  Content-Security-Policy: ...
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  Instructs the browser to strictly block any resources or inline scripts that violate your rules. Violations trigger browser console errors and optional reports to your monitoring server.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">Report-Only Mode</h3>
                </div>
                <div className="text-xs font-mono bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-700">
                  Content-Security-Policy-Report-Only: ...
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  Permits all scripts and resources to execute normally while dispatching violation reports in the background. Used in staging to benchmark third-party dependencies before full enforcement.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Educational Content Section 2: Directive Fallback Hierarchy */}
        <section className="py-14 sm:py-16 bg-[#F7F9FC] border-b border-slate-200/80">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200/80">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Deterministic Inheritance</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                Understanding the CSP Fallback Hierarchy
              </h2>
            </div>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              A common misconception in CSP engineering is that all directives inherit from <code className="font-mono font-semibold px-1 py-0.5 bg-slate-100 rounded text-slate-800">default-src</code>. Under W3C CSP Level 3, fetch directives fall back to <code className="font-mono text-xs">default-src</code> when omitted, but critical boundary directives such as <code className="font-mono text-xs">base-uri</code>, <code className="font-mono text-xs">form-action</code>, and <code className="font-mono text-xs">frame-ancestors</code> <strong>never inherit</strong> from <code className="font-mono text-xs">default-src</code>.
            </p>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3 min-w-[140px]">Directive</th>
                      <th className="px-4 py-3 min-w-[160px]">Fallback Rule</th>
                      <th className="px-4 py-3 min-w-[280px]">Security Scope</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fallbackHierarchyItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {item.directive}
                        </td>
                        <td className="px-4 py-3">
                          {item.inherits ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Inherits default-src
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3 h-3" />
                              Never inherits
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 leading-relaxed">
                          {item.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Educational Content Section 3: Modern CSP Level 3 Architecture */}
        <section className="py-14 sm:py-16 bg-white border-b border-slate-200/80">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Next-Gen Security Model</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                Modern CSP: Nonces & &apos;strict-dynamic&apos;
              </h2>
            </div>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Traditional CSP policies relied on host allowlists (e.g. <code className="font-mono text-xs">script-src &apos;self&apos; cdn.example.com</code>). Empirical security research demonstrated that over 90% of host allowlists are bypassable via open redirects, CDN JSONP endpoints, or Angular library vulnerabilities. CSP Level 3 introduces <strong>nonce-based policies</strong> with <code className="font-mono text-xs">&apos;strict-dynamic&apos;</code>.
            </p>

            <div className="p-6 rounded-2xl bg-indigo-950 text-indigo-100 space-y-3 font-mono text-xs border border-indigo-900 shadow-md">
              <div className="text-[11px] font-bold text-indigo-300 font-sans uppercase tracking-wider">
                Recommended Modern Strict CSP Architecture
              </div>
              <div className="p-3 bg-slate-950 rounded-xl text-emerald-400 overflow-x-auto leading-relaxed border border-indigo-900/50">
                default-src &apos;none&apos;;
                script-src &apos;strict-dynamic&apos; &apos;nonce-RANDOM_BASE64&apos; &apos;unsafe-inline&apos; https:;
                object-src &apos;none&apos;;
                base-uri &apos;none&apos;;
                form-action &apos;self&apos;;
                frame-ancestors &apos;none&apos;;
              </div>
              <p className="text-xs text-indigo-200 font-sans leading-relaxed pt-2">
                <strong>Why &apos;unsafe-inline&apos; is included:</strong> In CSP Level 3 browsers, presence of a nonce or hash causes the browser to automatically ignore <code className="text-amber-300 font-mono">&apos;unsafe-inline&apos;</code>. It is retained solely as a backward-compatibility fallback for older browsers that lack Level 3 support.
              </p>
            </div>
          </div>
        </section>

        {/* Educational Content Section 4: Common CSP Failure Modes */}
        <section className="py-14 sm:py-16 bg-[#F7F9FC] border-b border-slate-200/80">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Configuration Vulnerabilities</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                Common CSP Anti-Patterns & Bypasses
              </h2>
            </div>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              A poorly crafted Content Security Policy provides false reassurance while failing to prevent XSS exploits. Here are six of the most frequent misconfigurations audited by our analyzer:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {commonFailureCases.map((f, i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {f.title}
                    </h3>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 shrink-0 border border-rose-100">
                      {f.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {f.desc}
                  </p>
                  <div className="pt-1 border-t border-slate-100 text-xs text-slate-800">
                    <span className="font-semibold text-emerald-700">Remediation: </span>
                    <span>{f.fix}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Educational Content Section 5: Step-by-Step CSP Rollout Guide */}
        <section className="py-14 sm:py-16 bg-white border-b border-slate-200/80">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <FileCheck className="w-3.5 h-3.5 text-slate-500" />
                <span>Production Roadmap</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                How to Roll Out a Strict CSP Without Breaking Production
              </h2>
            </div>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Deploying an aggressive CSP overnight will inevitably break third-party analytics, chat widgets, or inline tag managers. Follow this staged production rollout protocol:
            </p>

            <div className="space-y-3 pt-2">
              {[
                {
                  step: "Phase 1: Asset & Script Inventory",
                  desc: "Catalog all external script sources, CDNs, analytics providers, and third-party widgets across all application routes.",
                },
                {
                  step: "Phase 2: Deploy Report-Only Header",
                  desc: "Publish Content-Security-Policy-Report-Only with a report-uri or report-to endpoint. Collect telemetry across real browser traffic for 7 to 14 days.",
                },
                {
                  step: "Phase 3: Refactor Inline Scripts to Nonces",
                  desc: "Replace raw inline <script> tags and onclick handlers with server-generated cryptographic nonces or external modular JS files.",
                },
                {
                  step: "Phase 4: Enforce Strict CSP",
                  desc: "Switch the response header name to Content-Security-Policy. Block unauthorized resources while maintaining telemetry reporting.",
                },
                {
                  step: "Phase 5: Automated CI/CD Regression Verification",
                  desc: "Integrate SiteSecura's CSP analyzer into your CI pipeline to prevent new pull requests from introducing permissive wildcards or unsafe keywords.",
                },
              ].map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-200"
                >
                  <div className="w-7 h-7 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">{s.step}</h4>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Accordion Section */}
        <section className="py-14 sm:py-16 bg-[#F7F9FC] border-b border-slate-200/80">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                Frequently Asked Questions
              </h2>
              <p className="text-sm text-slate-600">
                Detailed answers covering W3C specifications, bypass scenarios, report endpoints, and nonce implementation.
              </p>
            </div>

            <div className="pt-2">
              <CspPolicyFaqAccordion />
            </div>
          </div>
        </section>

        {/* Cross-Link Sibling Tools Section */}
        <section className="py-14 sm:py-16 bg-white border-b border-slate-200/80 text-left">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                <span>Related Security Utilities</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                Explore More Standalone Security Tools
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              <Link
                href="/tools/security-headers-checker"
                className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-slate-50/60 transition-all space-y-1.5 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                    Security Headers Checker
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">
                  Inspect HSTS, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy headers.
                </p>
              </Link>

              <Link
                href="/tools/security-txt-validator"
                className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-slate-50/60 transition-all space-y-1.5 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                    security.txt Validator
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">
                  Verify RFC 9116 compliance, PGP keys, contact channels, and expiration timestamps.
                </p>
              </Link>

              <Link
                href="/tools/robots-sitemap-checker"
                className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-slate-50/60 transition-all space-y-1.5 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                    Robots.txt & Sitemap Checker
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">
                  Validate RFC 9309 crawler directives and XML sitemaps with longest-match simulator.
                </p>
              </Link>
            </div>
          </div>
        </section>

        {/* Global CTA Section */}
        <section className="py-16 sm:py-20 bg-slate-950 text-white text-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold border border-indigo-500/20">
              <Zap className="w-3.5 h-3.5" />
              <span>Full-Stack Security Assessment</span>
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Complete Perimeter Website Security Audit
              </h2>
              <p className="text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
                Scan your website across SSL/TLS certificates, DNSSEC, email security (SPF, DKIM, DMARC), security headers, and open ports in under 60 seconds.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm transition-colors shadow-sm"
              >
                <span>Launch Free Security Scan</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/resources"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-colors"
              >
                Browse All Free Tools
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
