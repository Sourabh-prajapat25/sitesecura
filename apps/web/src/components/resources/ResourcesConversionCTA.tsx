"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, ArrowRight, CheckCircle2, Wrench } from "lucide-react";
import { trackContentEvent } from "@/lib/analytics";

export function ResourcesConversionCTA() {
  const handleScanCtaClick = () => {
    trackContentEvent({
      event_name: "resource_view",
      content_type: "conversion",
      content_id: "scan_your_website_bottom_cta",
      source: "resources_conversion_cta",
    });
  };

  const handleScrollToTools = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    trackContentEvent({
      event_name: "resource_view",
      content_type: "navigation",
      content_id: "explore_tools_bottom_cta",
      source: "resources_conversion_cta",
    });
    const toolsEl = document.getElementById("tools");
    if (toolsEl) {
      toolsEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white p-8 sm:p-12 border border-slate-800 shadow-xl">
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-950/80 text-sky-400 border border-sky-800/80">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
          <span>Full Perimeter Assessment</span>
        </div>

        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
          Want a broader view of your website&apos;s security?
        </h2>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
          Individual tools help you investigate specific configurations. Run SiteSecura&apos;s website security scan to review the supported security checks in one place.
        </p>

        <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
          <Link
            href="/#scan-hero"
            onClick={handleScanCtaClick}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white shadow-lg shadow-sky-600/30 hover:-translate-y-0.5 active:translate-y-0 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Scan Your Website</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <a
            href="#tools"
            onClick={handleScrollToTools}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <Wrench className="w-4 h-4 text-slate-400" />
            <span>Explore Security Tools</span>
          </a>

          <div className="flex items-center gap-2 text-xs text-slate-400 sm:ml-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Zero software installation required</span>
          </div>
        </div>
      </div>
    </section>
  );
}
