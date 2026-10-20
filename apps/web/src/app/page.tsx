"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Bell,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  Globe,
  KeyRound,
  MailCheck,
  Server,
  Sparkles,
  Check,
  Code2,
  Users,
  Briefcase,
  Terminal,
  Eye,
  ShieldCheck,
  HelpCircle,
  Copy,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ScoreRing } from "@/components/ScoreRing";
import { PRICING_PLANS, FAQ_ITEMS } from "@/lib/constants";
import { api } from "@/lib/api";

export default function LandingPage() {
  const router = useRouter();
  const domainInputRef = useRef<HTMLInputElement>(null);
  const [domainInput, setDomainInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [copiedCode, setCopiedCode] = useState(false);

  // Progressive scroll-reveal observer
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Activate progressive reveal styles now that JavaScript is running
    document.documentElement.classList.add("js-reveal-ready");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelectorAll(".reveal-on-scroll, .reveal-card").forEach((el) => {
        el.classList.add("revealed");
      });
      return;
    }

    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal-on-scroll, .reveal-card").forEach((el) => {
        el.classList.add("revealed");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    document.querySelectorAll(".reveal-on-scroll, .reveal-card").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Smooth scroll and focus helper for all scan CTAs
  const handleFocusScanInput = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (domainInputRef.current) {
      domainInputRef.current.focus();
      domainInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      const el = document.getElementById("domain-input");
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  const handleStartScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = domainInput.trim();
    if (!trimmed) {
      setErrorMessage("Please enter a domain name (e.g. example.com).");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const scan = await api.startScan(trimmed);
      router.push(`/scan/${scan.id}`);
    } catch (err: any) {
      setErrorMessage(
        err.message || "Failed to initiate scan. Please enter a valid public domain."
      );
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    const code = 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;';
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Structured Data (JSON-LD) for SEO
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production" ? "https://sitesecura.com" : "http://localhost:3000");

  const jsonLdData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "SiteSecura",
        url: siteUrl,
        logo: `${siteUrl}/brand/sitesecura-logo.svg`,
        description:
          "Defensive website cybersecurity posture platform providing deterministic security scanning and continuous monitoring.",
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "SiteSecura",
        publisher: { "@id": `${siteUrl}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/?domain={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "SoftwareApplication",
        name: "SiteSecura Website Security Scanner",
        operatingSystem: "Web",
        applicationCategory: "SecurityApplication",
        description:
          "Passive website security assessment platform providing deterministic scoring, vulnerability detection, and remediation guidance.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 selection:bg-sky-500 selection:text-white">
      {/* Search Engine Structured Data (JSON-LD) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
      />

      {/* 01. STICKY HEADER */}
      <Navbar />

      <main className="flex-1">
        {/* ========================================================================= */}
        {/* 02. HERO SECTION */}
        {/* ========================================================================= */}
        <section
          id="scan-hero"
          aria-labelledby="hero-heading"
          className="relative pt-12 pb-16 lg:pt-20 lg:pb-24 overflow-hidden bg-gradient-to-b from-sky-50/40 via-white to-slate-50/60"
        >
          {/* Subtle Security-Themed Dot Grid Background Pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage: "radial-gradient(#0284c7 0.65px, transparent 0.65px)",
              backgroundSize: "24px 24px",
            }}
          />
          {/* Gentle slow-moving radial glow */}
          <div className="absolute top-1/3 left-1/2 w-[650px] h-[350px] bg-sky-400/12 blur-[120px] rounded-full pointer-events-none animate-hero-glow" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="w-full mx-auto text-center flex flex-col items-center">
              {/* Small Eyebrow Badge */}
              <div className="animate-hero-eyebrow inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 text-sky-800 text-xs font-bold border border-sky-200/80 shadow-2xs mb-7 sm:mb-8">
                <Shield className="w-3.5 h-3.5 text-sky-600" />
                <span className="tracking-wider uppercase text-[11px]">
                  Defensive Website Security Platform
                </span>
              </div>

              {/* Primary H1 Headline — Exact two-line desktop presentation, ZERO underline */}
              <div className="w-full max-w-[1100px] mx-auto mb-6 sm:mb-7">
                <h1
                  id="hero-heading"
                  className="animate-hero-h1 hero-title font-extrabold text-slate-900 tracking-tight text-center"
                >
                  <span className="hero-title-line">
                    Understand Your Website
                  </span>
                  <span className="hero-title-line">
                    Security in <span className="hero-title-accent text-sky-600">60 Seconds.</span>
                  </span>
                </h1>
              </div>

              {/* Supporting Text */}
              <p className="animate-hero-desc text-base sm:text-lg lg:text-[19px] text-slate-600 leading-relaxed max-w-[740px] mx-auto font-normal mb-8 sm:mb-9">
                Scan your website for SSL/TLS, HTTPS, security headers, DNS, cookies, and configuration
                issues. Get a deterministic security score with clear, plain-English recommendations.
              </p>

              {/* Premium Scan Form */}
              <form
                onSubmit={handleStartScan}
                className="animate-hero-form w-full max-w-[700px] mx-auto"
                aria-label="Website Security Scanner Form"
              >
                <div className="flex flex-col sm:flex-row items-center gap-2 p-2 sm:p-2.5 bg-white rounded-2xl shadow-xl shadow-sky-950/5 border border-slate-200/90 focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-500/15 transition-all">
                  <div className="flex-1 flex items-center px-3.5 w-full">
                    <span className="text-slate-400 font-medium text-sm select-none mr-1.5 hidden sm:inline">
                      https://
                    </span>
                    <label htmlFor="domain-input" className="sr-only">
                      Website URL or Domain
                    </label>
                    <input
                      ref={domainInputRef}
                      id="domain-input"
                      type="text"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      placeholder="yourwebsite.com"
                      className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none text-base py-2.5 font-medium"
                      disabled={isSubmitting}
                      autoComplete="url"
                      aria-invalid={errorMessage ? "true" : "false"}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-7 py-3.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold rounded-xl text-base shadow-md shadow-sky-600/25 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer shrink-0"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Starting Scan...</span>
                      </>
                    ) : (
                      <>
                        <span>Scan Free</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                {errorMessage && (
                  <p
                    role="alert"
                    className="text-sm font-semibold text-red-700 mt-3 text-left bg-red-50 p-3 rounded-xl border border-red-200 shadow-2xs"
                  >
                    {errorMessage}
                  </p>
                )}

                {/* Hero Trust Microcopy — Exactly 3 items in a single horizontal row on desktop */}
                <div className="animate-hero-trust flex flex-wrap sm:flex-nowrap items-center justify-center gap-x-7 sm:gap-x-8 gap-y-2 mt-3.5 sm:mt-4 text-xs sm:text-sm font-medium text-slate-500 w-fit mx-auto">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Real automated security checks
                  </span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    No credit card required
                  </span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    No account required
                  </span>
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 03. TRUST / VALUE STRIP */}
        {/* ========================================================================= */}
        <section
          aria-label="Core Security Principles"
          className="reveal-on-scroll bg-white border-y border-slate-100 py-7"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center md:text-left">
              <div className="reveal-card flex flex-col sm:flex-row items-center sm:items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Passive & Non-Destructive
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Safe read-only evaluation without modifying your server.
                  </p>
                </div>
              </div>

              <div className="reveal-card flex flex-col sm:flex-row items-center sm:items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Deterministic Scoring
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Transparent, mathematically weighted 0–100 calculations.
                  </p>
                </div>
              </div>

              <div className="reveal-card flex flex-col sm:flex-row items-center sm:items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Plain-English Findings
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Clear explanations of business risk, not just cryptic codes.
                  </p>
                </div>
              </div>

              <div className="reveal-card flex flex-col sm:flex-row items-center sm:items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Actionable Guidance
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Direct copy-paste remediation directives for Apache, Nginx, & CDNs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 04. PRODUCT PREVIEW / "SEE SITESECURA IN ACTION" */}
        {/* ========================================================================= */}
        <section
          id="see-in-action"
          aria-labelledby="preview-heading"
          className="reveal-on-scroll py-20 lg:py-28 bg-slate-50/60 scroll-mt-24"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100/70 text-sky-800 text-xs font-bold border border-sky-200">
                <Eye className="w-3.5 h-3.5 text-sky-600" />
                <span>See SiteSecura in Action</span>
              </div>
              <h2
                id="preview-heading"
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight"
              >
                See Your Website Security Clearly
              </h2>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
                From the first scan to actionable remediation, SiteSecura turns technical security
                signals into clear engineering decisions.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* LEFT: Large Browser-Window Style Product Preview */}
              <div className="lg:col-span-7">
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/80 border border-slate-200 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                  {/* Browser Topbar */}
                  <div className="bg-slate-100/90 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-amber-400" />
                      <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    </div>
                    <div className="text-xs font-mono text-slate-600 bg-white px-4 py-1 rounded-md border border-slate-200 flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      <span>https://example-saas.com</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-200/70 px-2 py-0.5 rounded">
                      Demo
                    </span>
                  </div>

                  {/* Score & Posture Banner */}
                  <div className="p-6 sm:p-7 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center border-b border-slate-100 bg-gradient-to-r from-white via-sky-50/20 to-white">
                    <div className="flex justify-center sm:justify-start">
                      <ScoreRing score={78} riskLevel="Good" size="md" themeMode="light" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                          Security Assessment
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          Risk Grade: <strong className="text-slate-800">Good (78/100)</strong>
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-900">
                        Posture Overview: example-saas.com
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        SSL certificate is active and HTTPS is enforced. However, Strict-Transport-Security (HSTS)
                        and Content-Security-Policy (CSP) headers are absent.
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-semibold">
                        <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                          10 of 13 checks passed
                        </span>
                        <span className="text-slate-500">Duration: 1.6s</span>
                      </div>
                    </div>
                  </div>

                  {/* Sample Evaluated Checks */}
                  <div className="p-6 space-y-3 bg-slate-50/50">
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-slate-900">SSL Certificate Valid</div>
                          <div className="text-[11px] text-slate-500">Let's Encrypt Authority • 74 days remaining</div>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Passed
                      </span>
                    </div>

                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-slate-900">HTTPS Enforced</div>
                          <div className="text-[11px] text-slate-500">HTTP port 80 strictly redirects to 443</div>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Passed
                      </span>
                    </div>

                    <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-slate-900">Missing HSTS Header</div>
                          <div className="text-[11px] text-slate-500">Missing Strict-Transport-Security • -8 pts</div>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Needs Attention
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-100 border-t border-slate-200 text-center">
                    <span className="text-xs font-bold text-slate-500">
                      Interactive Product Demonstration (Real scans display live findings)
                    </span>
                  </div>
                </div>
              </div>

              {/* RIGHT: "One Clear Security Picture" */}
              <div className="lg:col-span-5 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    One Clear Security Picture
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Stop piecing together command-line outputs and cryptic headers. SiteSecura aggregates
                    public defense signals into one clean assessment that anyone on your team can interpret.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 font-bold" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Deterministic security score</h4>
                      <p className="text-xs text-slate-500">Transparent point deductions rather than subjective AI estimates.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 font-bold" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Security checks grouped by area</h4>
                      <p className="text-xs text-slate-500">Transport encryption, response headers, DNS/email, cookies, and server hygiene.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 font-bold" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Prioritized findings</h4>
                      <p className="text-xs text-slate-500">Clearly marks what needs immediate remediation vs minor observations.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 font-bold" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Plain-English explanations</h4>
                      <p className="text-xs text-slate-500">Every finding explains why it matters to your business reputation and visitors.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 font-bold" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Technical evidence when you need it</h4>
                      <p className="text-xs text-slate-500">Raw HTTP headers, DNS answers, and SSL cipher suites available on demand.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 font-bold" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Remediation recommendations</h4>
                      <p className="text-xs text-slate-500">Copy-paste server config blocks for Apache, Nginx, Caddy, and Cloudflare.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleFocusScanInput}
                    className="inline-flex items-center gap-2 px-6 py-3.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold rounded-xl text-sm shadow-md shadow-sky-600/20 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
                  >
                    <span>Run a Free Scan</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 05. SECURITY COVERAGE ("WHAT SITESECURA CHECKS") */}
        {/* ========================================================================= */}
        <section
          id="coverage"
          aria-labelledby="coverage-heading"
          className="reveal-on-scroll py-20 lg:py-28 bg-white scroll-mt-24"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <Shield className="w-3.5 h-3.5 text-sky-600" />
                <span>Comprehensive Defensive Perimeter Inspection</span>
              </div>
              <h2
                id="coverage-heading"
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight"
              >
                What SiteSecura Checks
              </h2>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
                SiteSecura evaluates the defensive controls that are visible from the public website surface,
                identifying configuration gaps before adversaries do.
              </p>
            </div>

            {/* 6 Core Cards in 3x2 Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Category 1: HTTPS */}
              <div className="reveal-card p-7 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between hover:border-sky-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Globe className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">1. HTTPS Enforcement</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Verifies that all cleartext HTTP traffic on port 80 is strictly redirected
                    to encrypted HTTPS on port 443 to prevent session interception.
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-200/60 text-xs text-slate-500">
                  <strong className="text-slate-700">Why it matters:</strong> Prevents
                  eavesdropping and credential exposure on open Wi-Fi networks.
                </div>
              </div>

              {/* Category 2: SSL/TLS */}
              <div className="reveal-card p-7 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between hover:border-sky-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">2. SSL / TLS Certificates</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Inspects certificate trust chain, issuer authority, expiration timeline,
                    and Subject Alternative Names (SAN) to avoid browser warnings.
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-200/60 text-xs text-slate-500">
                  <strong className="text-slate-700">Why it matters:</strong> Expired or
                  mismatched certificates cause browser security blocks that destroy visitor trust.
                </div>
              </div>

              {/* Category 3: Security Headers */}
              <div className="reveal-card p-7 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between hover:border-sky-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">3. HTTP Security Headers</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Audits HSTS (max-age/preload), Content-Security-Policy (CSP),
                    X-Frame-Options, X-Content-Type-Options, and Referrer-Policy.
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-200/60 text-xs text-slate-500">
                  <strong className="text-slate-700">Why it matters:</strong> Defends against
                  Cross-Site Scripting (XSS), Clickjacking, and protocol downgrade attacks.
                </div>
              </div>

              {/* Category 4: DNS & Email */}
              <div className="reveal-card p-7 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between hover:border-sky-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <MailCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">4. DNS & Email Security</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Evaluates SPF records, DMARC policies, and DNSSEC keys to verify domain
                    authenticity and prevent unauthorized domain impersonation.
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-200/60 text-xs text-slate-500">
                  <strong className="text-slate-700">Why it matters:</strong> Protects your
                  brand identity and ensures transactional emails reach customer inboxes.
                </div>
              </div>

              {/* Category 5: Cookie Security */}
              <div className="reveal-card p-7 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between hover:border-sky-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">5. Cookie Security</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Analyzes session cookies for Secure, HttpOnly, and SameSite flags to
                    safeguard authenticated user tokens from unauthorized extraction.
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-200/60 text-xs text-slate-500">
                  <strong className="text-slate-700">Why it matters:</strong> Prevents
                  session cookie theft via Cross-Site Scripting (XSS) and CSRF attacks.
                </div>
              </div>

              {/* Category 6: Server Hygiene */}
              <div className="reveal-card p-7 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between hover:border-sky-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Server className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">6. Server Hygiene & Tech</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Detects server version disclosure banners (Apache/Nginx/PHP versions) and
                    identifies exposed software framework signatures.
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-200/60 text-xs text-slate-500">
                  <strong className="text-slate-700">Why it matters:</strong> Minimizing
                  software version disclosures eliminates low-hanging targets for automated CVE botnets.
                </div>
              </div>
            </div>

            {/* Visual Relationship Flow */}
            <div className="mt-16 p-6 sm:p-8 bg-slate-50 rounded-2xl border border-slate-200/90">
              <div className="text-center mb-6">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Evaluation Flow
                </h4>
                <p className="text-sm font-bold text-slate-800">
                  How Public Signals Become Your Security Score
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-sky-600 uppercase">Target</div>
                  <div className="text-xs font-extrabold text-slate-900 mt-1">Website URL</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-sky-600 uppercase">Check 1-2</div>
                  <div className="text-xs font-extrabold text-slate-900 mt-1">HTTPS & SSL</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-sky-600 uppercase">Check 3</div>
                  <div className="text-xs font-extrabold text-slate-900 mt-1">Headers</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-sky-600 uppercase">Check 4</div>
                  <div className="text-xs font-extrabold text-slate-900 mt-1">DNS & Mail</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-sky-600 uppercase">Check 5-6</div>
                  <div className="text-xs font-extrabold text-slate-900 mt-1">Cookies & Tech</div>
                </div>
                <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-sky-700 uppercase">Engine</div>
                  <div className="text-xs font-extrabold text-sky-900 mt-1">0–100 Score</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 shadow-2xs col-span-2 sm:col-span-1">
                  <div className="text-[10px] font-bold text-emerald-700 uppercase">Output</div>
                  <div className="text-xs font-extrabold text-emerald-900 mt-1">Fix Plan</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 06. HOW SITESECURA WORKS */}
        {/* ========================================================================= */}
        <section
          id="how-it-works"
          aria-labelledby="how-it-works-heading"
          className="reveal-on-scroll py-20 lg:py-28 bg-slate-50/60 scroll-mt-24"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100/70 text-sky-800 text-xs font-bold border border-sky-200">
                <span>Simple 4-Step Process</span>
              </div>
              <h2
                id="how-it-works-heading"
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight"
              >
                From Website URL to Security Action Plan
              </h2>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
                No software installation, no browser extensions, and no server configuration needed.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
              {/* Step 1 */}
              <div className="reveal-card p-7 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 relative hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="text-3xl font-black text-sky-600/30">01</div>
                <h3 className="text-base font-bold text-slate-900">Enter Your Website</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter any public domain. No credit card, API key, or software installation is required.
                </p>
              </div>

              {/* Step 2 */}
              <div className="reveal-card p-7 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 relative hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="text-3xl font-black text-sky-600/30">02</div>
                <h3 className="text-base font-bold text-slate-900">Run Passive Checks</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  SiteSecura evaluates publicly observable security signals without modifying your server.
                </p>
              </div>

              {/* Step 3 */}
              <div className="reveal-card p-7 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 relative hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="text-3xl font-black text-sky-600/30">03</div>
                <h3 className="text-base font-bold text-slate-900">Understand Your Findings</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Receive a deterministic security score with prioritized observations and clear risk rationale.
                </p>
              </div>

              {/* Step 4 */}
              <div className="reveal-card p-7 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 relative hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="text-3xl font-black text-sky-600/30">04</div>
                <h3 className="text-base font-bold text-slate-900">Fix & Monitor</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Follow clear remediation guidance and monitor changes over time with automated background guards.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 07. WHY SITESECURA / PRODUCT DIFFERENTIATION */}
        {/* ========================================================================= */}
        <section
          id="why-sitesecura"
          aria-labelledby="why-heading"
          className="reveal-on-scroll py-20 lg:py-28 bg-white scroll-mt-24"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100/70 text-sky-800 text-xs font-bold border border-sky-200">
                <span>Product Philosophy</span>
              </div>
              <h2
                id="why-heading"
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight"
              >
                Security Shouldn't Require a Security Degree
              </h2>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
                SiteSecura bridges the gap between technical security checks and practical action.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Block 1 */}
              <div className="reveal-card p-8 rounded-3xl bg-slate-50/80 border border-slate-200/90 space-y-4 hover:border-sky-300 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Built for clarity</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Technical security results translated into plain-English actions. We avoid impenetrable
                  cybersecurity jargon so founders, product managers, and developers can immediately grasp risk.
                </p>
              </div>

              {/* Block 2 */}
              <div className="reveal-card p-8 rounded-3xl bg-slate-50/80 border border-slate-200/90 space-y-4 hover:border-sky-300 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Terminal className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Evidence when you need it</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Start with a simple explanation. Open technical details when deeper verification is needed.
                  Engineers can inspect exact HTTP response headers, DNS records, and TLS handshake ciphers.
                </p>
              </div>

              {/* Block 3 */}
              <div className="reveal-card p-8 rounded-3xl bg-slate-50/80 border border-slate-200/90 space-y-4 hover:border-sky-300 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Deterministic results</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Security scores are based on defined defensive checks rather than opaque generated answers.
                  Our math is transparent, reproducible, and strictly based on verified findings.
                </p>
              </div>

              {/* Block 4 */}
              <div className="reveal-card p-8 rounded-3xl bg-slate-50/80 border border-slate-200/90 space-y-4 hover:border-sky-300 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Eye className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Passive by design</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  SiteSecura focuses on read-only, non-destructive security assessment. We never attempt
                  aggressive penetration tests, brute-force logins, or intrusive injections that endanger production stability.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 08. SECURITY FINDINGS → ACTIONABLE REMEDIATION */}
        {/* ========================================================================= */}
        <section
          id="remediation"
          aria-labelledby="remediation-heading"
          className="reveal-on-scroll py-20 lg:py-28 bg-slate-50/60 scroll-mt-24"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/80 text-amber-800 text-xs font-bold border border-amber-200">
                <Code2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Actionable Remediation</span>
              </div>
              <h2
                id="remediation-heading"
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight"
              >
                Don't Just Find Problems. Know What to Fix.
              </h2>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
                Every identified issue provides plain-English impact rationale and direct configuration directives.
              </p>
            </div>

            {/* Realistic Finding Card Showcase */}
            <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-200 overflow-hidden">
              {/* Finding Header */}
              <div className="p-6 sm:p-7 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-amber-50/30 via-white to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        Warning
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        Score Impact: <strong className="text-red-600">-8 pts</strong>
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                      Missing HSTS Header
                    </h3>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-500 block">Estimated effort</span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 inline-block mt-0.5">
                    ~2 minutes
                  </span>
                </div>
              </div>

              {/* Finding Body */}
              <div className="p-6 sm:p-7 space-y-6">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                    Summary
                  </h4>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    Strict-Transport-Security is missing from HTTPS responses on this domain.
                  </p>
                </div>

                <div className="p-4 bg-sky-50/60 rounded-xl border border-sky-100">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-sky-800 mb-1">
                    Why This Matters
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Without HSTS, browsers may still attempt an initial insecure connection before redirecting.
                    This leaves visitors vulnerable to man-in-the-middle SSL-stripping attacks on shared networks.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                      Recommended Action
                    </h4>
                    <span className="text-[11px] font-medium text-slate-500">
                      Web Server Configuration
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    Add an appropriate Strict-Transport-Security response header to your web server or CDN configuration:
                  </p>

                  {/* Code snippet with copy button */}
                  <div className="relative rounded-xl bg-slate-900 text-slate-200 p-4 font-mono text-xs overflow-x-auto shadow-inner">
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-[11px]"
                      title="Copy snippet"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <code className="text-sky-300 block pr-16 leading-relaxed">
                      add_header Strict-Transport-Security &quot;max-age=31536000; includeSubDomains; preload&quot; always;
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 09. BEFORE / AFTER SECURITY EXPERIENCE */}
        {/* ========================================================================= */}
        <section
          aria-labelledby="comparison-heading"
          className="reveal-on-scroll py-20 bg-white scroll-mt-24"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <span>The SiteSecura Difference</span>
              </div>
              <h2
                id="comparison-heading"
                className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight"
              >
                From Security Guesswork to Total Clarity
              </h2>
              <p className="text-slate-600 text-base leading-relaxed">
                Stop wondering what public misconfigurations exist on your domains.
              </p>
            </div>

            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Before */}
              <div className="reveal-card p-8 rounded-3xl bg-slate-50 border border-slate-200 space-y-6">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Before SiteSecura
                  </span>
                  <h3 className="text-xl font-bold text-slate-800">
                    &quot;I know my website is online, but I don't know what security settings are missing.&quot;
                  </h3>
                </div>

                <ul className="space-y-3.5 text-xs text-slate-600">
                  <li className="flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">✕</span>
                    <span>Running separate CLI tools (curl, dig, openssl) without context</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">✕</span>
                    <span>No clear prioritization of which issue to tackle first</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">✕</span>
                    <span>Sudden SSL expiration warnings in browser windows</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">✕</span>
                    <span>Configuration drift going unnoticed after production deployments</span>
                  </li>
                </ul>
              </div>

              {/* After */}
              <div className="reveal-card p-8 rounded-3xl bg-gradient-to-b from-sky-50/60 to-white border-2 border-sky-500 shadow-md space-y-6 relative">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-700">
                    With SiteSecura
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-slate-900">78 / 100</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Good Posture
                    </span>
                  </div>
                </div>

                <div className="space-y-3 text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">Prioritized Action Plan:</p>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 font-bold text-[10px]">1</span>
                      <span className="font-bold text-slate-900">Top Priority: HTTPS port 80 redirect</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 font-bold text-[10px]">2</span>
                      <span className="font-bold text-slate-900">Next: Add Strict-Transport-Security header</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 font-bold text-[10px]">3</span>
                      <span className="font-bold text-slate-900">Next: Configure DMARC policy for email</span>
                    </div>
                  </div>
                </div>

                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Instant deterministic score & audit PDF</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Automated weekly or daily drift alerts</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 10. CONTINUOUS MONITORING */}
        {/* ========================================================================= */}
        <section
          id="monitoring"
          aria-labelledby="monitoring-heading"
          className="reveal-on-scroll py-20 lg:py-28 bg-slate-900 text-white overflow-hidden scroll-mt-24"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-6 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 text-xs font-bold border border-emerald-800">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Automated Posture Guard</span>
                </div>

                <h2
                  id="monitoring-heading"
                  className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white"
                >
                  One Scan Shows Today.
                  <br />
                  <span className="text-sky-400">Monitoring Shows What Changes.</span>
                </h2>

                <p className="text-slate-300 text-base leading-relaxed">
                  Website configurations drift over time. Code deployments remove response
                  headers, SSL certificates expire, and DNS records change. SiteSecura's automated
                  background monitoring catches issues before visitors or attackers do.
                </p>

                <div className="space-y-3.5 pt-2">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-white">Scheduled Recurring Scans</h4>
                      <p className="text-xs text-slate-400">Weekly automated scans on Basic; daily scans on Pro.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-white">Immediate Score Drop Alerts</h4>
                      <p className="text-xs text-slate-400">Instant email notifications when security score drops below your threshold.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-white">SSL Expiration Warnings</h4>
                      <p className="text-xs text-slate-400">Early alerts 14 days and 7 days prior to SSL/TLS certificate expiry.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <a
                    href="#pricing"
                    className="inline-flex items-center gap-2 px-6 py-3.5 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-extrabold rounded-xl text-sm transition-colors shadow-lg cursor-pointer"
                  >
                    <span>Explore Monitoring Plans</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Monitoring Mockup Card */}
              <div className="lg:col-span-6">
                <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 space-y-6 relative overflow-hidden">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Automated Posture Guard
                      </span>
                    </div>
                    <span className="text-xs font-mono text-emerald-400">Status: Active</span>
                  </div>

                  {/* Sample Alert Card 1 */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/30 flex items-start gap-3.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-300">Score Alert</span>
                        <span className="text-[10px] text-slate-400">12 mins ago</span>
                      </div>
                      <p className="text-xs text-slate-200">
                        HSTS header dropped after server migration on <strong>app.example.com</strong>. Score decreased from 92 to 82.
                      </p>
                    </div>
                  </div>

                  {/* Sample Alert Card 2 */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-sky-500/30 flex items-start gap-3.5">
                    <Bell className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-sky-300">Certificate Notice</span>
                        <span className="text-[10px] text-slate-400">Yesterday</span>
                      </div>
                      <p className="text-xs text-slate-200">
                        SSL certificate for <strong>api.example.com</strong> expires in 14 days. Automated renewal recommended.
                      </p>
                    </div>
                  </div>

                  {/* Trend Indicator */}
                  <div className="pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span>90-Day Security Trend</span>
                      <span className="text-emerald-400 font-semibold">+28 pts improvement</span>
                    </div>
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between font-mono text-xs text-slate-300">
                      <div className="text-center">
                        <div className="text-slate-500 text-[10px]">JAN</div>
                        <div className="font-bold text-amber-400">64 / 100</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                      <div className="text-center">
                        <div className="text-slate-500 text-[10px]">FEB</div>
                        <div className="font-bold text-sky-400">78 / 100</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                      <div className="text-center">
                        <div className="text-slate-500 text-[10px]">MAR</div>
                        <div className="font-bold text-emerald-400">92 / 100</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 11. WHO SITESECURA IS FOR */}
        {/* ========================================================================= */}
        <section
          id="who-its-for"
          aria-labelledby="audiences-heading"
          className="reveal-on-scroll py-20 lg:py-28 bg-white scroll-mt-24"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <span>Tailored Use Cases</span>
              </div>
              <h2
                id="audiences-heading"
                className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight"
              >
                Built for Teams That Need Security Clarity
              </h2>
              <p className="text-slate-600 text-base leading-relaxed">
                Whether you run a single web project or manage a portfolio of client properties.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Audience 1 */}
              <div className="reveal-card p-7 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3 hover:border-sky-300 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <Briefcase className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Small Business Owners</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Understand whether your public website has common security gaps without hiring an expensive cybersecurity agency.
                </p>
              </div>

              {/* Audience 2 */}
              <div className="reveal-card p-7 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3 hover:border-sky-300 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Terminal className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Developers & DevOps</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Catch security configuration regressions in production before they impact user sessions or compliance audits.
                </p>
              </div>

              {/* Audience 3 */}
              <div className="reveal-card p-7 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3 hover:border-sky-300 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Digital & Web Agencies</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Audit client websites in seconds, deliver white-label PDF reports, and provide ongoing monitoring as a recurring service.
                </p>
              </div>

              {/* Audience 4 */}
              <div className="reveal-card p-7 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3 hover:border-sky-300 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Growing Product Teams</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Track security posture across multiple staging and production domains and prioritize fixes as a unified engineering team.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 12. PRODUCT CAPABILITIES OVERVIEW */}
        {/* ========================================================================= */}
        <section
          id="capabilities"
          aria-labelledby="capabilities-heading"
          className="reveal-on-scroll py-20 lg:py-28 bg-slate-50/60 scroll-mt-24"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100/70 text-sky-800 text-xs font-bold border border-sky-200">
                <span>Platform Capabilities</span>
              </div>
              <h2
                id="capabilities-heading"
                className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight"
              >
                Everything You Need to Guard Your Web Perimeter
              </h2>
              <p className="text-slate-600 text-base leading-relaxed">
                A unified platform combining instant diagnostics, automated guards, and exportable audit documentation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="reveal-card p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Normal Security Scan</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Instant 60-second public perimeter evaluation with deterministic 0–100 scoring.
                </p>
                <ul className="text-xs text-slate-500 space-y-1.5 pt-1">
                  <li>• 13 defensive checks evaluated</li>
                  <li>• Top prioritized findings</li>
                  <li>• Plain-English recommendations</li>
                </ul>
              </div>

              <div className="reveal-card p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Deep Security Assessment</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  In-depth F1–F8 defensive intelligence pipeline covering extended attack surfaces.
                </p>
                <ul className="text-xs text-slate-500 space-y-1.5 pt-1">
                  <li>• Multi-phase passive discovery</li>
                  <li>• Correlated risk chain analysis</li>
                  <li>• Root cause remediation roadmap</li>
                </ul>
              </div>

              <div className="reveal-card p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Bell className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Automated Monitoring</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Background scheduled scans that catch certificate expiry and configuration drift.
                </p>
                <ul className="text-xs text-slate-500 space-y-1.5 pt-1">
                  <li>• Weekly or daily scheduled checks</li>
                  <li>• Early SSL/TLS expiration warnings</li>
                  <li>• Instant score reduction email alerts</li>
                </ul>
              </div>

              <div className="reveal-card p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Executive PDF Reports</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Boardroom-ready security posture documentation to share with clients and leaders.
                </p>
                <ul className="text-xs text-slate-500 space-y-1.5 pt-1">
                  <li>• Comprehensive itemized checks</li>
                  <li>• Technical evidence verification logs</li>
                  <li>• Agency white-label customization</li>
                </ul>
              </div>

              <div className="reveal-card p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">AI Security Advisor</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Interactive contextual guidance for understanding and fixing complex issues.
                </p>
                <ul className="text-xs text-slate-500 space-y-1.5 pt-1">
                  <li>• Plain-English risk explanations</li>
                  <li>• Server-specific remediation directives</li>
                  <li>• Interactive security consultation</li>
                </ul>
              </div>

              <div className="reveal-card p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Multi-Domain & Team Seats</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Centralized management for agencies and growing multi-domain portfolios.
                </p>
                <ul className="text-xs text-slate-500 space-y-1.5 pt-1">
                  <li>• Manage 1 to 100+ websites</li>
                  <li>• Up to 15 team collaborator seats</li>
                  <li>• Bulk CSV domain import & export</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 13. TRUST & SECURITY PRINCIPLES */}
        {/* ========================================================================= */}
        <section
          id="principles"
          aria-labelledby="principles-heading"
          className="reveal-on-scroll py-20 lg:py-28 bg-white scroll-mt-24"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                <span>Our Security Commitment</span>
              </div>
              <h2
                id="principles-heading"
                className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight"
              >
                Built With a Defensive-First Approach
              </h2>
              <p className="text-slate-600 text-base leading-relaxed">
                SiteSecura is engineered for safe, ethical, and non-destructive web observation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="reveal-card p-6 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2 hover:border-sky-300 transition-colors">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Passive by Design
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Strictly read-only assessment. We never perform intrusive vulnerability exploitation or payload injections.
                </p>
              </div>

              <div className="reveal-card p-6 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2 hover:border-sky-300 transition-colors">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  No Server Modification
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  SiteSecura does not alter your web server configuration, upload files, or modify application state.
                </p>
              </div>

              <div className="reveal-card p-6 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2 hover:border-sky-300 transition-colors">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Bounded Requests
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Security checks operate within strict timeout and rate limits to safeguard your server bandwidth.
                </p>
              </div>

              <div className="reveal-card p-6 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2 hover:border-sky-300 transition-colors">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Clear Evidence
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Every finding is tied directly to publicly observable HTTP headers, DNS records, or SSL metadata.
                </p>
              </div>

              <div className="reveal-card p-6 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2 hover:border-sky-300 transition-colors">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Deterministic Scoring
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Results follow mathematically defined scoring formulas rather than non-deterministic black-box models.
                </p>
              </div>

              <div className="reveal-card p-6 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-2 hover:border-sky-300 transition-colors">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Privacy Conscious
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  We avoid unnecessary data ingestion and never harvest private internal database records or visitor credentials.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 14. DESIGNED FOR REAL SECURITY WORKFLOWS (Truthful, non-fabricated section) */}
        {/* ========================================================================= */}
        <section
          aria-labelledby="workflows-heading"
          className="reveal-on-scroll py-20 bg-slate-50/60 scroll-mt-24"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100/70 text-sky-800 text-xs font-bold border border-sky-200">
                <span>Product Philosophy</span>
              </div>
              <h2
                id="workflows-heading"
                className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight"
              >
                Designed for Teams That Need Security Clarity
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                Built to provide actionable security intelligence without operational friction or downtime risks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="reveal-card p-7 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  <Terminal className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Engineering-Led Remediation</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Receive exact copy-paste configuration directives for Nginx, Apache, Caddy, and Cloudflare
                  rather than ambiguous security warnings that take hours to research.
                </p>
              </div>

              <div className="reveal-card p-7 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Deterministic Governance</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Rely on mathematical scoring rules derived from verified defensive controls. Your team gets
                  consistent, repeatable benchmarks across every release and deployment.
                </p>
              </div>

              <div className="reveal-card p-7 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Drift-Resistant Operations</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Automated background guards run continuous checks on critical endpoints, catching SSL certificate
                  expirations and dropped security headers before they become security incidents.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 15. SIMPLE, TRANSPARENT PRICING */}
        {/* ========================================================================= */}
        <section
          id="pricing"
          aria-labelledby="pricing-heading"
          className="reveal-on-scroll py-20 lg:py-28 bg-white scroll-mt-24"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <span>Transparent Plans</span>
              </div>
              <h2
                id="pricing-heading"
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight"
              >
                Simple, Transparent Pricing
              </h2>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
                Start scanning for free. Upgrade whenever you need continuous automated monitoring,
                email alerts, or white-label agency reports.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {PRICING_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`reveal-card bg-white rounded-2xl p-6 sm:p-7 border flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 ${
                    plan.popular
                      ? "border-sky-500 shadow-xl shadow-sky-500/10 ring-2 ring-sky-500/20 relative"
                      : "border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sky-600 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-sm">
                      Most Popular
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 min-h-[32px]">
                        {plan.description}
                      </p>
                    </div>

                    <div className="pt-2 pb-4 border-b border-slate-100">
                      <span className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                        {plan.price}
                      </span>
                      <span className="text-xs text-slate-500 font-medium ml-1">
                        {plan.interval}
                      </span>
                    </div>

                    <ul className="space-y-2.5 text-xs text-slate-600">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6">
                    {plan.id === "free" ? (
                      <button
                        type="button"
                        onClick={handleFocusScanInput}
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-center block bg-slate-100 hover:bg-slate-200 text-slate-800 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
                      >
                        Start Free
                      </button>
                    ) : (
                      <Link
                        href="/register"
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-center block hover:-translate-y-0.5 active:translate-y-0 transition-all ${
                          plan.popular
                            ? "bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                        }`}
                      >
                        {plan.cta}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 16. FAQ SECTION */}
        {/* ========================================================================= */}
        <section
          id="faq"
          aria-labelledby="faq-heading"
          className="reveal-on-scroll py-20 lg:py-28 bg-slate-50/60 scroll-mt-24"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
                <span>Common Questions</span>
              </div>
              <h2
                id="faq-heading"
                className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight"
              >
                Frequently Asked Questions
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Got questions about how SiteSecura works? Here are answers to common questions.
              </p>
            </div>

            <div className="space-y-3.5">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div
                    key={index}
                    className="border border-slate-200/90 rounded-2xl bg-white overflow-hidden shadow-2xs transition-colors"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${index}`}
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-slate-900 text-sm sm:text-base hover:bg-slate-50/70 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-2xl transition-colors cursor-pointer"
                    >
                      <span>{item.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-sky-600 shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div
                        id={`faq-answer-${index}`}
                        className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100"
                      >
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 17. FINAL CTA */}
        {/* ========================================================================= */}
        <section
          aria-labelledby="final-cta-heading"
          className="reveal-on-scroll py-20 lg:py-28 bg-gradient-to-br from-slate-950 via-sky-950 to-slate-900 text-white text-center relative overflow-hidden"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-sky-300 text-xs font-bold border border-white/15">
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <span>Get Started in Seconds</span>
            </div>

            <h2
              id="final-cta-heading"
              className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white"
            >
              Know Where Your Website Stands.
            </h2>
            <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
              Run a free SiteSecura security assessment and get a clear picture of what is working,
              what needs attention, and what to fix first.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={handleFocusScanInput}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-black rounded-xl text-base shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
              >
                <span>Scan My Website Free</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <a
                href="#pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-base hover:-translate-y-0.5 active:translate-y-0 transition-all border border-white/15 cursor-pointer"
              >
                View Pricing Plans
              </a>
            </div>

            <p className="text-xs text-slate-400 pt-2 font-medium">
              No credit card required · 100% passive & non-destructive · Results in under 60 seconds
            </p>
          </div>
        </section>
      </main>

      {/* 18. FOOTER */}
      <Footer />
    </div>
  );
}
