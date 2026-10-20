"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, ShieldCheck, Wrench } from "lucide-react";
import { trackContentEvent } from "@/lib/analytics";

export function ResourcesHero() {
  const handleScrollToTools = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    trackContentEvent({
      event_name: "resource_view",
      content_type: "navigation",
      content_id: "explore_free_tools_cta",
      source: "resources_hero",
    });
    const toolsEl = document.getElementById("tools");
    if (toolsEl) {
      toolsEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleScanCtaClick = () => {
    trackContentEvent({
      event_name: "resource_view",
      content_type: "conversion",
      content_id: "run_security_scan_hero_cta",
      source: "resources_hero",
    });
  };

  return (
    <section className="relative overflow-hidden pt-10 pb-12 sm:pt-14 sm:pb-16 border-b border-slate-200/80 bg-gradient-to-b from-white via-white to-[#F7F9FC]">
      <div className="absolute inset-0 bg-[radial-gradient(#087fe8_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5">
        {/* Eyebrow Label */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-sky-600" />
          <span>FREE WEBSITE SECURITY TOOLKIT</span>
        </div>

        {/* Main Heading */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight leading-tight">
          Website Security Tools &amp; Resources
        </h1>

        {/* Supporting Text */}
        <p className="max-w-2xl mx-auto text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed">
          Check website security configurations, investigate common technical issues, and learn practical ways to improve your website’s security with SiteSecura’s free tools and guides.
        </p>

        {/* CTAs */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <Link
            href="/#scan-hero"
            onClick={handleScanCtaClick}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 shadow-md shadow-sky-600/20 hover:-translate-y-0.5 active:translate-y-0 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Run a Website Security Scan</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <a
            href="#tools"
            onClick={handleScrollToTools}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-all focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <Wrench className="w-4 h-4 text-slate-500" />
            <span>Explore Free Tools</span>
          </a>
        </div>
      </div>
    </section>
  );
}
