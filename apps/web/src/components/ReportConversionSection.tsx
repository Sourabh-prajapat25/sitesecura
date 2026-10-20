"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Check, ArrowRight, ShieldCheck, Activity } from "lucide-react";
import { SubscriptionPlan } from "@/types";
import { normalizePlan } from "@/lib/entitlements";
import { UpgradeContextType } from "./UpgradeModal";

interface ReportConversionSectionProps {
  plan?: SubscriptionPlan | string | null;
  isAuthenticated: boolean;
  authLoading?: boolean;
  onUpgrade: (context: UpgradeContextType) => void;
}

/**
 * Entitlement-aware Report Conversion Section.
 * Strictly adheres to SiteSecura production audience rules:
 * - Basic / Pro / Agency / Admin: RETURNS NULL. Zero sales blocks or upgrade marketing.
 * - Authenticated Free: Renders ONE compact, contextually relevant continuous monitoring CTA.
 * - Anonymous / Public: Renders ONE polished, high-converting final CTA block.
 * - Loading: Returns null to eliminate CTA flashing.
 */
export function ReportConversionSection({
  plan,
  isAuthenticated,
  authLoading = false,
  onUpgrade,
}: ReportConversionSectionProps) {
  // Avoid CTA flashing while auth and subscription state are resolving
  if (authLoading) {
    return null;
  }

  const p = normalizePlan(plan);

  // Authenticated Paid Users: NEVER show upgrade or sales marketing
  if (isAuthenticated && (p === "basic" || p === "pro" || p === "agency" || p === "admin")) {
    return null;
  }

  // Authenticated Free Users: ONE compact upgrade CTA for continuous monitoring
  if (isAuthenticated && p === "free") {
    return (
      <section
        aria-label="Continuous Protection Upgrade"
        className="rounded-3xl bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 text-white p-8 sm:p-10 shadow-xl relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-2xl space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-500/30">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>Continuous Protection</span>
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
              Keep your website protected over time.
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed pt-1">
              Website configurations drift with deployments and renewals. Upgrade to Basic or Pro to enable scheduled weekly scans, instant alerts when SSL certificates or headers change, and full PDF audit reports.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs font-semibold text-slate-200">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Weekly automated background scans</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Full unredacted finding evidence</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Instant alerts on SSL expiry & header drift</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Executive PDF security audit downloads</span>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              onClick={() => onUpgrade("monitoring")}
              className="px-6 py-3.5 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-extrabold rounded-xl text-sm transition-colors shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Upgrade for Continuous Monitoring</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <Link
              href="/pricing"
              className="px-5 py-3.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-sm transition-colors text-center border border-white/10"
            >
              View Plans & Pricing
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Anonymous / Public Visitors: ONE polished conversion section placed at the end of report
  return (
    <section
      aria-label="Keep Your Website Protected"
      className="rounded-3xl bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 text-white p-8 sm:p-10 shadow-xl relative overflow-hidden"
    >
      <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl space-y-4 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-500/30">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>Continuous Website Protection</span>
        </div>

        <div className="space-y-1">
          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
            You&apos;ve reviewed your security snapshot.
            <br />
            <span className="text-sky-400">Keep your website protected over time.</span>
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed pt-1">
            Configurations change with deployments, renewals, and migrations. SiteSecura monitors your website in the background and alerts you the instant an issue appears.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs font-semibold text-slate-200">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Weekly automated background scans</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Instant SSL expiry & header drift alerts</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Executive PDF security audit reports</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>30-day security posture history</span>
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Link
            href="/register"
            className="px-6 py-3.5 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-extrabold rounded-xl text-sm transition-colors shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 cursor-pointer text-center"
          >
            <span>Create Free Account</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/pricing"
            className="px-5 py-3.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-sm transition-colors text-center border border-white/10"
          >
            Explore Plans & Pricing
          </Link>
        </div>

        <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Passive, read-only security assessment • No server modification required</span>
        </div>
      </div>
    </section>
  );
}
