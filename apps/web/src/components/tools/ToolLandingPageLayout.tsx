"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Info,
  HelpCircle,
  ArrowRight,
  Layers,
  Sparkles,
  Lock,
  FileCode,
  Mail,
  ChevronDown,
  ChevronUp,
  Globe,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export interface ToolCheckItem {
  name: string;
  description: string;
  impact: string;
}

export interface ToolFaqItem {
  question: string;
  answer: string;
}

export interface RelatedGuideItem {
  title: string;
  slug: string;
  category: string;
  readingTimeMinutes?: number;
}

export interface SiblingToolItem {
  name: string;
  slug: string;
  badge: string;
  description: string;
  iconName: "scanner" | "ssl" | "headers" | "email" | "dns";
}

export interface ToolLandingPageLayoutProps {
  toolName: string;
  eyebrow: string;
  heading: string;
  description: string;
  launcherSlot: React.ReactNode;
  checksHeading?: string;
  checksDescription?: string;
  checks: ToolCheckItem[];
  limitations: string[];
  steps: { step: number; title: string; description: string }[];
  resultInterpretation: {
    status: string;
    label: string;
    description: string;
    badgeClass: string;
  }[];
  remediationOverview: React.ReactNode;
  faqs: ToolFaqItem[];
  siblingTools: SiblingToolItem[];
  relatedGuides?: RelatedGuideItem[];
}

export function ToolLandingPageLayout({
  toolName,
  eyebrow,
  heading,
  description,
  launcherSlot,
  checksHeading = "What This Tool Checks",
  checksDescription,
  checks,
  limitations,
  steps,
  resultInterpretation,
  remediationOverview,
  faqs,
  siblingTools,
  relatedGuides = [],
}: ToolLandingPageLayoutProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F9FC] text-slate-900 selection:bg-sky-500 selection:text-white">
      <Navbar />

      <main className="flex-1">
        {/* Top Breadcrumbs */}
        <div className="border-b border-slate-200/80 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
              <Link href="/" className="hover:text-slate-900 transition-colors">
                Home
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <Link href="/resources" className="hover:text-slate-900 transition-colors">
                Resources
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-800 truncate" aria-current="page">
                {toolName}
              </span>
            </nav>
          </div>
        </div>

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-20 border-b border-slate-200/80 bg-gradient-to-b from-white via-white to-[#F7F9FC]">
          <div className="absolute inset-0 bg-[radial-gradient(#087fe8_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none" />

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>{eyebrow}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight leading-tight">
              {heading}
            </h1>

            <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 leading-relaxed">
              {description}
            </p>

            {/* Launcher Slot */}
            <div className="pt-4">{launcherSlot}</div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16">
          {/* Section 1: How It Works (Step-by-Step) */}
          <section aria-labelledby="steps-heading" className="space-y-6">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <h2 id="steps-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
                How to Use This Tool
              </h2>
              <p className="text-sm text-slate-600">
                Run an automated assessment in three straightforward steps.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {steps.map((item) => (
                <div
                  key={item.step}
                  className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 font-bold text-sm flex items-center justify-center">
                      {item.step}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 2: What This Tool Checks */}
          <section aria-labelledby="checks-heading" className="space-y-6">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified Inspection Signals</span>
              </div>
              <h2 id="checks-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
                {checksHeading}
              </h2>
              {checksDescription && (
                <p className="text-sm text-slate-600">{checksDescription}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {checks.map((check, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>{check.name}</span>
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {check.impact}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {check.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: Interpreting Results */}
          <section aria-labelledby="interpretation-heading" className="space-y-6">
            <div className="max-w-2xl space-y-2">
              <h2 id="interpretation-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
                Interpreting Scan Results
              </h2>
              <p className="text-sm text-slate-600">
                Every scan item receives an explicit status indicator to help you prioritize remediation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {resultInterpretation.map((statusItem, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-2"
                >
                  <span
                    className={`inline-block text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${statusItem.badgeClass}`}
                  >
                    {statusItem.label}
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed pt-1">
                    {statusItem.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 4: Remediation Guidance */}
          <section aria-labelledby="remediation-heading" className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-slate-200/90 shadow-xs space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                <FileCode className="w-3.5 h-3.5 text-sky-600" />
                <span>Actionable Remediation</span>
              </div>
              <h2 id="remediation-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
                Practical Remediation Guidance
              </h2>
              <p className="text-sm text-slate-600">
                How to resolve common gaps and harden your server configurations.
              </p>
            </div>

            <div className="prose prose-slate max-w-none text-sm text-slate-700 leading-relaxed">
              {remediationOverview}
            </div>
          </section>

          {/* Section 5: Limitations & Boundary Considerations */}
          <section aria-labelledby="limitations-heading" className="bg-amber-50/60 rounded-3xl p-6 sm:p-8 border border-amber-200/80 space-y-4">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <h2 id="limitations-heading" className="text-lg font-bold">
                Assessment Limitations & Technical Scope
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-amber-900/90 leading-relaxed">
              SiteSecura performs deterministic, non-intrusive perimeter checks. Understanding what a passive assessment cannot evaluate ensures responsible risk management:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1 text-xs sm:text-sm text-amber-900/90">
              {limitations.map((limitation, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold mt-0.5">•</span>
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Section 6: Related Security Guides */}
          {relatedGuides.length > 0 && (
            <section aria-labelledby="guides-heading" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 id="guides-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
                    Recommended Technical Guides
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Learn defensive concepts and architectural best practices from our engineering team.
                  </p>
                </div>
                <Link
                  href="/blog"
                  className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700"
                >
                  <span>View all articles</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedGuides.map((guide, idx) => (
                  <Link
                    key={idx}
                    href={`/blog/${guide.slug}`}
                    className="group bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:border-sky-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {guide.category}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-2">
                        {guide.title}
                      </h3>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-sky-600 group-hover:text-sky-700">
                      <span>Read Guide</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Section 7: Sibling Security Tools */}
          <section aria-labelledby="sibling-tools-heading" className="space-y-6">
            <div>
              <h2 id="sibling-tools-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
                Related Security Utilities
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Explore dedicated perimeter verification tools in the SiteSecura toolkit.
              </p>
            </div>

            <div className={`grid grid-cols-1 gap-6 ${siblingTools.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"}`}>
              {siblingTools.map((sibling, idx) => {
                const getSiblingIcon = (iconName: string) => {
                  switch (iconName) {
                    case "ssl":
                      return Lock;
                    case "headers":
                      return FileCode;
                    case "email":
                      return Mail;
                    case "dns":
                      return Globe;
                    default:
                      return Shield;
                  }
                };
                const Icon = getSiblingIcon(sibling.iconName);
                return (
                  <Link
                    key={idx}
                    href={`/tools/${sibling.slug}`}
                    className="group bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:border-sky-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200/80">
                          {sibling.badge}
                        </span>
                        <Icon className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-colors" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                        {sibling.name}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                        {sibling.description}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-sky-600 group-hover:text-sky-700">
                      <span>Launch Tool</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Section 8: Frequently Asked Questions */}
          <section aria-labelledby="faq-heading" className="space-y-6">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
                <span>Common Questions</span>
              </div>
              <h2 id="faq-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div
                    key={index}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-colors"
                  >
                    <button
                      onClick={() => toggleFaq(index)}
                      aria-expanded={isOpen}
                      className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-900 hover:text-sky-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      <span>{faq.question}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 9: Contextual Full Scanner Conversion Banner */}
          <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white p-8 sm:p-12 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-950/80 text-sky-400 border border-sky-800/80">
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                <span>Comprehensive Security Assessment</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Ready for a Complete Website Security Evaluation?
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Run an end-to-end passive scan across HTTPS, SSL certificates, defensive HTTP response headers, and DNS email authentication records in under 60 seconds.
              </p>
              <div className="pt-2">
                <Link
                  href="/tools/website-security-checker"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/30 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>Launch Full Website Assessment</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
