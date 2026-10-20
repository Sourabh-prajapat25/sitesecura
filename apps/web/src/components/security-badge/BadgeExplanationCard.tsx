"use client";

import React from "react";
import { ShieldCheck, Info, AlertTriangle, CheckCircle2, Lock } from "lucide-react";

export function BadgeExplanationCard() {
  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-100 dark:border-sky-800/60">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            What does SiteSecura Verified mean?
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Transparent, automated proof of defensive security posture for your visitors and customers.
          </p>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Point-in-Time Validation</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Confirms that the website achieved a qualifying security score without critical or unmitigated security defects under the active policy.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Tamper-Resistant Proof</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Every badge embeds a unique public token linked to a real-time verification endpoint that displays the verified timestamp and score snapshot.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Info className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Freshness Guaranteed</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Verifications remain valid for 30 days. Badges must be refreshed through regular automated scanning to maintain active trust status.
            </p>
          </div>
        </div>

        {/* Responsible Security Disclaimer Callout */}
        <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
            <p className="font-semibold text-amber-950 dark:text-amber-300">
              Important Trust & Limitations Notice
            </p>
            <p className="text-amber-800 dark:text-amber-300">
              The SiteSecura Verified badge demonstrates rigorous defensive hygiene based on automated checks (SSL/TLS strength, HTTP security headers, DNS authorization, and server configurations). It is <span className="font-medium">not a formal compliance certification</span> (such as SOC 2, ISO 27001, or PCI-DSS) and does <span className="font-medium">not guarantee 100% immunity</span> from all cyber threats or zero-day vulnerabilities.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
