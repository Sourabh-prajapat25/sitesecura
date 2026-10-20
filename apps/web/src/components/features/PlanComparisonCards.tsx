"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { PRICING_PLANS } from "@/lib/constants";

export function PlanComparisonCards() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");

  // Helper to extract non-redundant differentiator features for each plan card
  const getDifferentiatorFeatures = (planId: string, features: string[]) => {
    return features.filter((feat) => {
      const lower = feat.toLowerCase();
      // Exclude items already covered by the metrics table directly above
      if (lower.includes("website") || lower.includes("scans per month")) {
        return false;
      }
      if (lower.includes("automated monitoring")) {
        return false;
      }
      return true;
    }).slice(0, 5);
  };

  return (
    <div className="space-y-10">
      {/* Billing Cycle Switcher with Accessible ARIA Group */}
      <div className="flex items-center justify-center">
        <div
          role="group"
          aria-label="Billing cycle selector"
          className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
        >
          <button
            type="button"
            aria-pressed={billingCycle === "monthly"}
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
              billingCycle === "monthly"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            aria-pressed={billingCycle === "yearly"}
            onClick={() => setBillingCycle("yearly")}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
              billingCycle === "yearly"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Annual Billing</span>
            <span className="px-2 py-0.5 text-[11px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 rounded-full border border-sky-200 dark:border-sky-800">
              Save 16.7% (2 Mo. Free)
            </span>
          </button>
        </div>
      </div>

      {/* Grid of 4 Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {PRICING_PLANS.map((plan) => {
          const isPro = plan.id === "pro";
          const formattedYearly = plan.yearlyEquivalentMonthly.toFixed(2).replace(/\.00$/, "");
          const displayPrice =
            plan.id === "free"
              ? "$0"
              : billingCycle === "yearly"
              ? `$${formattedYearly}`
              : `$${plan.monthlyPrice}`;

          const billingSubtext =
            plan.id === "free"
              ? "Free forever"
              : billingCycle === "yearly"
              ? `Billed $${plan.yearlyAnnualTotal}/year`
              : "Billed monthly";

          const ctaHref = plan.id === "free" ? "/#scan-hero" : "/pricing";
          const ctaText =
            plan.id === "free"
              ? "Start Free Scan"
              : billingCycle === "yearly"
              ? plan.ctaYearly || "Choose Plan"
              : plan.ctaMonthly || "Get Started";

          const keyFeatures = getDifferentiatorFeatures(plan.id, plan.features);

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col p-6 sm:p-7 rounded-2xl transition-all ${
                isPro
                  ? "bg-white dark:bg-slate-900 border-2 border-sky-500 shadow-xl shadow-sky-500/10 ring-1 ring-sky-500"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              {isPro && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-sky-600 text-white shadow-sm">
                    <Sparkles className="w-3 h-3" />
                    Recommended
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-5">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                  {plan.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 min-h-[32px] line-clamp-2">
                  {plan.description}
                </p>
              </div>

              {/* Pricing */}
              <div className="mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {displayPrice}
                  </span>
                  {plan.id !== "free" && (
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      / month
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  {billingSubtext}
                </p>
              </div>

              {/* Core Limits Summary */}
              <div className="mb-6 space-y-2.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">Monitored Websites</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {plan.websiteLimit === 1 ? "1 Website" : `Up to ${plan.websiteLimit} Websites`}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">Monthly Scans</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {plan.scansLimit.toLocaleString()} / mo
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">Monitoring Cadence</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {plan.id === "free"
                      ? "On-Demand"
                      : plan.id === "basic"
                      ? "Weekly"
                      : "Daily Automated"}
                  </span>
                </div>
              </div>

              {/* Features List */}
              <div className="flex-1 space-y-2.5 mb-8">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Key Capabilities
                </div>
                {keyFeatures.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <Check className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              {/* Plan Action CTA */}
              <div>
                <Link
                  href={ctaHref}
                  aria-label={`${ctaText} - ${plan.name} plan`}
                  className={`w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                    isPro
                      ? "bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/20"
                      : "bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>{ctaText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Comparison Link */}
      <div className="text-center pt-2">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
        >
          <span>View full detailed feature comparison matrix on the Pricing page</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
