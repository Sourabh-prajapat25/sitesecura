import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import {
  Globe,
  Layers,
  Sparkles,
  ChevronRight,
  Shield,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Server,
  Network,
  Cpu,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
  FileCode,
  Mail,
  Zap,
  FileCheck,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getSiteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { HttpStatusApp } from "@/components/tools/http/HttpStatusApp";
import { HttpStatusFaqAccordion } from "@/components/tools/http/HttpStatusFaqAccordion";
import { HTTP_TOOL_FAQS } from "@/components/tools/http/faqData";

export const metadata: Metadata = {
  title: {
    absolute: "HTTP Status Checker & Redirect Chain Tracer | SiteSecura",
  },
  description:
    "Check HTTP response status codes and trace complete redirect chains hop-by-hop with SiteSecura. Inspect 301, 302, 307, 308 redirects, SSL downgrade risks, and response headers for free.",
  alternates: {
    canonical: `${getSiteUrl()}/tools/http-status-checker`,
  },
  openGraph: {
    title: "HTTP Status Checker & Redirect Chain Tracer | SiteSecura",
    description:
      "Check HTTP status codes and trace redirect chains hop-by-hop. Inspect status 301, 302, 307, 308, 404, SSL downgrade issues, and response headers for free.",
    url: `${getSiteUrl()}/tools/http-status-checker`,
    siteName: "SiteSecura",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HTTP Status Checker & Redirect Chain Tracer | SiteSecura",
    description:
      "Inspect HTTP status codes, trace complete redirect chains hop-by-hop, detect 301/302 redirects, SSL downgrade vulnerabilities, and response latency for any public URL.",
  },
};

export default function HttpStatusCheckerPage() {
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
        name: "HTTP Status & Redirect Checker",
        item: `${siteUrl}/tools/http-status-checker`,
      },
    ],
  };

  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "SiteSecura HTTP Status & Redirect Checker",
    description:
      "Free standalone HTTP status code and redirect tracer utility for inspecting HTTP response codes, tracing 301/302/307/308 redirect chains, auditing response headers, and detecting SSL downgrade risks.",
    url: `${siteUrl}/tools/http-status-checker`,
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
    mainEntity: HTTP_TOOL_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const statusCategories = [
    {
      range: "2xx",
      name: "Success Codes",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: "The request was successfully received, understood, and accepted by the web server.",
      examples: [
        { code: "200 OK", desc: "Standard response for successful HTTP requests." },
        { code: "201 Created", desc: "Request succeeded and led to resource creation." },
        { code: "204 No Content", desc: "Request succeeded but server sends no body content." },
      ],
    },
    {
      range: "3xx",
      name: "Redirection Codes",
      badge: "bg-sky-50 text-sky-700 border-sky-200",
      description: "Further action is required by the client to fulfill the request at a new destination URL.",
      examples: [
        { code: "301 Moved Permanently", desc: "Permanent redirect; transfers search engine PageRank." },
        { code: "302 Found", desc: "Temporary redirect; does not permanently transfer link equity." },
        { code: "307 Temporary Redirect", desc: "Temporary redirect preserving the original HTTP method." },
        { code: "308 Permanent Redirect", desc: "Permanent redirect preserving the original HTTP method." },
      ],
    },
    {
      range: "4xx",
      name: "Client Error Codes",
      badge: "bg-amber-50 text-amber-700 border-amber-200",
      description: "The request contains invalid syntax, missing authentication, or points to missing resources.",
      examples: [
        { code: "400 Bad Request", desc: "Server cannot process request due to malformed syntax." },
        { code: "401 Unauthorized", desc: "Authentication credentials required or invalid." },
        { code: "403 Forbidden", desc: "Server understands request but refuses to authorize it." },
        { code: "404 Not Found", desc: "Requested resource could not be found on server." },
        { code: "429 Too Many Requests", desc: "User has sent too many requests in a given amount of time." },
      ],
    },
    {
      range: "5xx",
      name: "Server Error Codes",
      badge: "bg-rose-50 text-rose-700 border-rose-200",
      description: "The server failed to fulfill an apparently valid request due to internal application errors.",
      examples: [
        { code: "500 Internal Server Error", desc: "Generic server error when no specific message fits." },
        { code: "502 Bad Gateway", desc: "Invalid response from upstream backend or gateway server." },
        { code: "503 Service Unavailable", desc: "Server temporarily overloaded or down for maintenance." },
        { code: "504 Gateway Timeout", desc: "Upstream server did not send timely response." },
      ],
    },
  ];

  const commonIssues = [
    {
      title: "Redirect Chains & Crawl Waste",
      desc: "Chains with 3 or more intermediate hops add unnecessary round-trip latency, degrade Core Web Vitals, and waste search engine crawl budgets. Always point internal links directly to the final canonical URL.",
      badge: "Performance & SEO",
    },
    {
      title: "Redirect Loops (Infinite Cycles)",
      desc: "Conflicting rewrite rules (e.g. HTTP -> HTTPS -> HTTP or non-www -> www -> non-www) create loops where browsers crash with ERR_TOO_MANY_REDIRECTS, preventing users from accessing your site.",
      badge: "Availability Risk",
    },
    {
      title: "Insecure SSL/HTTPS Downgrades",
      desc: "When a secure HTTPS URL redirects to unencrypted HTTP, session cookies and form inputs can be intercepted by network eavesdroppers. Every URL redirection must terminate over TLS (HTTPS).",
      badge: "Critical Security",
    },
    {
      title: "302 vs 301 PageRank Leakage",
      desc: "Using temporary 302 redirects for permanent site migrations prevents search engines from consolidating link authority to your new destination URL, causing severe ranking drops.",
      badge: "SEO Strategy",
    },
  ];

  const howToSteps = [
    {
      step: 1,
      title: "Enter Target URL",
      description: "Type or paste any website URL or domain name (e.g. https://example.com/login). If you omit the scheme, HTTPS will be used automatically.",
    },
    {
      step: 2,
      title: "Socket Pinning & SSRF Defense",
      description: "SiteSecura validates hostnames, resolves DNS, and pins socket connections to verified public IPs to prevent Server-Side Request Forgery.",
    },
    {
      step: 3,
      title: "Trace Hop-by-Hop Progression",
      description: "Our engine executes requests without automatic redirection, capturing the status code, status text, and Location header for each intermediate hop.",
    },
    {
      step: 4,
      title: "Inspect Latency & Protocol Security",
      description: "Analyze individual round-trip response times, server IP addresses, and verify that no hops downgrade to unencrypted HTTP.",
    },
    {
      step: 5,
      title: "Review Response Headers & Export",
      description: "Inspect safe response headers (Server, Content-Type, HSTS, CSP) and copy the structured diagnostic summary or JSON output.",
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
      name: "Website Security Scanner",
      slug: "website-security-checker",
      badge: "Full Assessment",
      description: "Run an automated passive security scan across HTTPS, certificates, headers, and domain defenses.",
      icon: Shield,
    },
    {
      name: "SSL/TLS Certificate Checker",
      slug: "ssl-checker",
      badge: "SSL / TLS",
      description: "Inspect certificate validity, CA issuer chains, SAN domains, and weak TLS protocol ciphers.",
      icon: Lock,
    },
    {
      name: "HTTP Security Headers Checker",
      slug: "security-headers-checker",
      badge: "HTTP Headers",
      description: "Audit HSTS preload readiness, Content-Security-Policy (CSP), X-Frame-Options, and referrer policies.",
      icon: FileCode,
    },
    {
      name: "SPF, DKIM & DMARC Checker",
      slug: "email-security-checker",
      badge: "Email Security",
      description: "Review email authentication DNS records to protect domain reputation and prevent phishing attacks.",
      icon: Mail,
    },
    {
      name: "security.txt Validator",
      slug: "security-txt-validator",
      badge: "Compliance Utility",
      description: "Validate security contact disclosure files against RFC 9116 syntax, mandatory Contact and Expires fields.",
      icon: FileCheck,
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
            <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Link href="/" className="hover:text-slate-900 transition-colors">
                Home
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <Link href="/resources" className="hover:text-slate-900 transition-colors">
                Resources
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-900 font-semibold">HTTP Status & Redirect Checker</span>
            </nav>
          </div>
        </div>

        {/* Hero Section */}
        <section className="pt-10 pb-12 sm:pt-14 sm:pb-16 border-b border-slate-200/80 bg-gradient-to-b from-white to-[#F7F9FC]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200/80 text-sky-700 text-xs font-bold tracking-wide">
              <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
              <span>HTTP Status & Redirect Tracer</span>
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>Hop-by-Hop Visibility</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-950 tracking-tight leading-[1.15]">
                HTTP Status & Redirect Checker
              </h1>
              <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                Check HTTP status codes and trace redirect chains hop-by-hop. Inspect 301, 302, 307, and 308 redirects, detect SSL downgrade vulnerabilities, and audit safe response headers in real time.
              </p>
            </div>

            {/* Standalone Tool Application */}
            <div className="pt-4">
              <HttpStatusApp />
            </div>
          </div>
        </section>

        {/* How to Use Section */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                How to Use the HTTP Status & Redirect Checker
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Follow these five steps to diagnose URL redirects, measure latency, and detect configuration errors.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {howToSteps.map((step) => (
                <div
                  key={step.step}
                  className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-3 text-left relative flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <span className="w-7 h-7 rounded-lg bg-sky-600 text-white font-bold text-xs flex items-center justify-center">
                      {step.step}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900">{step.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Understanding HTTP Status Codes Guide */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-[#F7F9FC]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <FileCode className="w-3.5 h-3.5 text-slate-500" />
                <span>Reference Guide</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Understanding HTTP Status Code Ranges
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Every HTTP response code returned by a web server communicates a specific standardized outcome.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {statusCategories.map((cat) => (
                <div
                  key={cat.range}
                  className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-4 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${cat.badge}`}>
                        {cat.range}
                      </span>
                      <h3 className="font-bold text-base text-slate-900">{cat.name}</h3>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{cat.description}</p>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Common Status Codes
                    </span>
                    <div className="space-y-1.5">
                      {cat.examples.map((item) => (
                        <div key={item.code} className="text-xs flex items-baseline justify-between gap-3">
                          <span className="font-mono font-bold text-slate-900 shrink-0">{item.code}</span>
                          <span className="text-slate-500 text-right">{item.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Common Redirect Issues & SEO Impact */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Diagnostics & Optimization</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Common Redirect Issues & SEO Impact
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Poorly configured URL redirects impair search engine crawling, drain server resources, and introduce critical security flaws.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {commonIssues.map((issue) => (
                <div
                  key={issue.title}
                  className="bg-slate-50/60 rounded-3xl p-6 border border-slate-200/80 space-y-2.5 text-left"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-slate-900">{issue.title}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white border border-slate-200 text-slate-700">
                      {issue.badge}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{issue.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tool Limitations Section */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-[#F7F9FC]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left">
            <div className="space-y-2 text-center sm:text-left">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Boundary Disclosures
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Scope & Limitations of This Utility
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                To maintain production security, reliability, and fair usage across all users, this standalone tool operates under the following explicit constraints:
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-4">
              <ul className="space-y-3.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">URL-Specific Hop Inspection:</strong> This tool inspects the exact URL path provided and traces its redirect chain. It does not crawl the entire domain or map all internal site URLs.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Strict SSRF & Cloud Metadata Protection:</strong> In accordance with our security policies, the checker strictly prohibits connections to private RFC 1918 subnets, loopback addresses (`127.0.0.1`), link-local IPs, cloud metadata endpoints (`169.254.169.254`), and non-standard network ports.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Redirect Cap & Loop Termination:</strong> The utility follows up to 10 redirects per chain. If a chain exceeds 10 hops or enters an infinite loop, execution halts safely with an explanatory diagnosis.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Rate Limiting:</strong> Public unauthenticated queries are bounded to 15 checks per minute per IP address to safeguard network availability.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>Frequently Asked Questions</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                HTTP Status & Redirect Checker FAQs
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Answers to common questions regarding HTTP response codes, redirect chains, SEO link equity, and SSL security.
              </p>
            </div>

            <HttpStatusFaqAccordion faqs={HTTP_TOOL_FAQS} />
          </div>
        </section>

        {/* Sibling Tools Section */}
        <section className="py-14 sm:py-16 border-b border-slate-200/80 bg-[#F7F9FC]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Defensive Utilities
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Explore Related Security Tools
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Discover our companion security and network assessment utilities designed for website operators and developers.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {siblingTools.map((tool) => {
                const IconComp = tool.icon;
                return (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col justify-between space-y-4 group text-left"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors">
                          <IconComp className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                          {tool.badge}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-slate-900 group-hover:text-sky-600 transition-colors">
                        {tool.name}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">{tool.description}</p>
                    </div>

                    <div className="pt-2 flex items-center gap-1 text-xs font-bold text-sky-600 group-hover:text-sky-500">
                      <span>Launch Tool</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Global Security Assessment Banner */}
        <section className="py-16 sm:py-20 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-400 text-xs font-bold">
              <Shield className="w-3.5 h-3.5" />
              <span>Free Comprehensive Website Security Scan</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Looking for a Complete Website Security Audit?
            </h2>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
              HTTP status checks are only the first step. Audit SSL certificate ciphers, HTTP security headers, SPF/DMARC records, and open server vulnerabilities in 60 seconds.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/tools/website-security-checker"
                className="w-full sm:w-auto px-8 py-4 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-2xl text-sm transition-all shadow-lg shadow-sky-500/20 inline-flex items-center justify-center gap-2"
              >
                <span>Run Free Website Security Scan</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/resources"
                className="w-full sm:w-auto px-6 py-4 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-2xl text-sm transition-colors"
              >
                Browse All Defensive Resources
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
