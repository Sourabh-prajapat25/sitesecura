import React from "react";
import { ShieldCheck, Terminal, BookOpen } from "lucide-react";

export function BlogHero() {
  return (
    <section className="relative overflow-hidden pt-8 pb-10 border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50/50 to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <BookOpen className="w-3.5 h-3.5 text-sky-600" />
            <span>SiteSecura Engineering Publications</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Website Security Guides & Threat Insights
          </h1>

          <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
            Actionable technical tutorials on SSL/TLS encryption, SPF/DMARC email security,
            HTTP security headers hardening, and automated vulnerability defense.
          </p>

          {/* Editorial Trust Badges */}
          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Tested defensive rules</span>
            </div>
            <span className="hidden sm:inline text-slate-300">•</span>
            <div className="flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-sky-600" />
              <span>Production-ready configurations</span>
            </div>
            <span className="hidden sm:inline text-slate-300">•</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Updated for 2026 security standards</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
