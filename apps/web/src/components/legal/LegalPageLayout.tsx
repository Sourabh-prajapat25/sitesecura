"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Shield, AlertTriangle, Info, ChevronDown, ListFilter } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export interface TocItem {
  id: string;
  title: string;
}

interface LegalPageLayoutProps {
  title: string;
  description: string;
  effectiveDate?: string;
  toc?: TocItem[];
  children: React.ReactNode;
}

export function LegalCallout({
  variant = "info",
  title,
  children,
}: {
  variant?: "info" | "warning" | "alert";
  title?: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: {
      container: "bg-sky-50/80 border-sky-200 text-sky-950",
      icon: <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />,
      titleColor: "text-sky-900",
    },
    warning: {
      container: "bg-amber-50/90 border-amber-300 text-amber-950",
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />,
      titleColor: "text-amber-900",
    },
    alert: {
      container: "bg-red-50/90 border-red-300 text-red-950",
      icon: <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />,
      titleColor: "text-red-900",
    },
  }[variant];

  return (
    <div
      role="note"
      className={`p-5 rounded-2xl border ${styles.container} my-6 space-y-2 shadow-2xs`}
    >
      <div className="flex items-start gap-3">
        {styles.icon}
        <div className="space-y-1 text-xs sm:text-sm leading-relaxed">
          {title && <h4 className={`font-bold ${styles.titleColor}`}>{title}</h4>}
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function LegalPageLayout({
  title,
  description,
  effectiveDate = LEGAL_CONFIG.LAST_UPDATED,
  toc = [],
  children,
}: LegalPageLayoutProps) {
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="flex-1 pb-20">
        {/* ========================================================================= */}
        {/* LEGAL HERO */}
        {/* ========================================================================= */}
        <section className="bg-gradient-to-b from-sky-50/50 via-white to-slate-50/70 border-b border-slate-200/80 pt-12 pb-14 lg:pt-16 lg:pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Eyebrow Label */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100/80 text-sky-800 text-xs font-bold border border-sky-200 shadow-2xs">
                <Shield className="w-3.5 h-3.5 text-sky-600" />
                <span className="tracking-wider uppercase text-[11px]">LEGAL & TRUST</span>
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                {title}
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
                {description}
              </p>

              {/* Last Updated Date */}
              <div className="pt-2 flex items-center gap-4 text-xs font-medium text-slate-500">
                <span>Last Updated: <strong className="text-slate-700">{effectiveDate}</strong></span>
                <span>•</span>
                <span>Version: <strong className="text-slate-700">1.0</strong></span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* MAIN LEGAL CONTENT CONTAINER WITH SIDEBAR TOC */}
        {/* ========================================================================= */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Desktop Table of Contents (Sticky Sidebar) */}
            {toc.length > 0 && (
              <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
                <div className="sticky top-24 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 max-h-[calc(100vh-7rem)] overflow-y-auto">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100">
                    <ListFilter className="w-3.5 h-3.5 text-sky-600" />
                    <span>On this page</span>
                  </div>
                  <nav aria-label="Table of contents">
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      {toc.map((item) => (
                        <li key={item.id}>
                          <a
                            href={`#${item.id}`}
                            className="block py-1 px-2 rounded-lg hover:text-sky-700 hover:bg-sky-50/80 transition-colors leading-snug font-medium"
                          >
                            {item.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </div>
              </aside>
            )}

            {/* Mobile Table of Contents Accordion */}
            {toc.length > 0 && (
              <div className="lg:hidden col-span-1">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setMobileTocOpen(!mobileTocOpen)}
                    className="w-full flex items-center justify-between p-4 text-xs font-bold text-slate-800"
                    aria-expanded={mobileTocOpen}
                  >
                    <span className="flex items-center gap-2">
                      <ListFilter className="w-4 h-4 text-sky-600" />
                      Table of Contents ({toc.length} sections)
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 transition-transform ${
                        mobileTocOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {mobileTocOpen && (
                    <div className="p-4 pt-0 border-t border-slate-100 max-h-60 overflow-y-auto">
                      <ul className="space-y-1.5 text-xs text-slate-600 pt-2">
                        {toc.map((item) => (
                          <li key={item.id}>
                            <a
                              href={`#${item.id}`}
                              onClick={() => setMobileTocOpen(false)}
                              className="block py-1 hover:text-sky-600 transition-colors"
                            >
                              {item.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Document Body */}
            <article
              className={`col-span-1 ${
                toc.length > 0 ? "lg:col-span-8 xl:col-span-9" : "lg:col-span-12"
              }`}
            >
              <div className="bg-white p-6 sm:p-10 lg:p-12 rounded-3xl border border-slate-200/90 shadow-sm max-w-4xl space-y-10 text-slate-700 leading-relaxed text-sm sm:text-base">
                {children}
              </div>
            </article>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
