"use client";

import React, { useState } from "react";
import { Scan, SubscriptionPlan } from "@/types";
import { api } from "@/lib/api";
import { canAccessAiAdvisor } from "@/lib/entitlements";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import {
  Sparkles,
  Bot,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Loader2,
  ChevronRight,
  Wrench,
} from "lucide-react";

import { SeverityBadge } from "../SeverityBadge";

interface AiSecurityAdvisorCardProps {
  latestScan: Scan | null;
  plan?: SubscriptionPlan | string;
  onOpenAdvisor: (tab?: "explain" | "fix" | "plan" | "chat") => void;
  onUpgrade: () => void;
}

export function AiSecurityAdvisorCard({
  latestScan,
  plan = "free",
  onOpenAdvisor,
  onUpgrade,
}: AiSecurityAdvisorCardProps) {
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEntitled = canAccessAiAdvisor(plan);

  const handleGenerateBrief = async () => {
    if (!latestScan) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSecuritySummary(latestScan.id);
      setBrief(res.structured_data || { posture_headline: res.content });
    } catch (err: any) {
      setError(err.message || "Failed to generate security summary.");
    } finally {
      setLoading(false);
    }
  };

  // If no scan
  if (!latestScan) {
    return (
      <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between h-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Security Advisor
            </span>
          </div>
          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            Defensive AI
          </span>
        </div>
        <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
          Run a scan to generate defensive security insights.
        </div>
      </div>
    );
  }

  // Free / Basic locked card
  if (!isEntitled) {
    return (
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 text-white rounded-2xl border border-slate-800 p-6 shadow-xs flex flex-col justify-between relative overflow-hidden h-full">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                Security Advisor
              </span>
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-400/20 flex items-center gap-1.5">
              <Lock className="w-2.5 h-2.5 text-sky-400" />
              <span>Pro & Agency</span>
            </span>
          </div>

          <div className="pt-4 pb-2 space-y-1.5">
            <h4 className="text-sm font-bold text-white tracking-tight">
              AI Remediation & Guided Fixes
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Transform raw scan findings into clear technical context, prioritized roadmaps, and ready-to-deploy configuration guides.
            </p>
          </div>

          <div className="py-3 space-y-2.5">
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0 mt-0.5">
                <Lightbulb className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-100">
                  Instant Vulnerability Context
                </div>
                <div className="text-[11px] text-slate-400 leading-tight">
                  Plain-English explanations of why SSL, header, and DNS findings matter.
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                <Wrench className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-100">
                  Step-by-Step Remediation Snippets
                </div>
                <div className="text-[11px] text-slate-400 leading-tight">
                  Copy-paste configs for Nginx, Apache, Cloudflare, and web frameworks.
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-100">
                  Prioritized Action Plan
                </div>
                <div className="text-[11px] text-slate-400 leading-tight">
                  Sequenced fixes ordered by score impact for maximum security rating gain.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800/80 space-y-2">
          <button
            type="button"
            onClick={onUpgrade}
            className="w-full py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Upgrade to Unlock Advisor</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-sky-400 shrink-0" />
            <span>Available on Pro and Agency plans • Instant unlock</span>
          </div>
        </div>
      </div>
    );
  }

  // Find top priority issue from scan checks
  const checks = latestScan.checks || [];
  const topIssue =
    checks.find((c) => (c.severity || "").toLowerCase() === "critical") ||
    checks.find((c) => (c.severity || "").toLowerCase() === "high") ||
    checks.find((c) => (c.status || "").toLowerCase() === "fail") ||
    checks.find((c) => (c.status || "").toLowerCase() === "warning");

  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between relative overflow-hidden h-full">
      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900/60">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Security Advisor
            </span>
          </div>

          <button
            type="button"
            onClick={() => onOpenAdvisor("chat")}
            className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 flex items-center gap-1 hover:underline"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Ask Advisor</span>
          </button>
        </div>

        {/* Card Content */}
        <div className="py-4 space-y-3 text-xs">
          {loading ? (
            <div className="py-8 text-center space-y-2">
              <Loader2 className="w-6 h-6 text-sky-600 dark:text-sky-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Analyzing verified posture findings...</p>
            </div>
          ) : brief ? (
            <div className="space-y-3">
              <MarkdownRenderer
                content={brief.posture_headline || brief.score_assessment || ""}
                variant="compact"
              />
              {brief.top_3_priorities && brief.top_3_priorities.length > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/80 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider block">
                    Top Priority Action:
                  </span>
                  <p className="font-bold text-slate-900 dark:text-white line-clamp-1">
                    {brief.top_3_priorities[0].title}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {brief.top_3_priorities[0].action || brief.top_3_priorities[0].why_it_matters}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Your latest scan scored <strong className="text-slate-900 dark:text-white">{latestScan.score ?? 0}/100</strong>.
                Generate an instant defensive security brief and step-by-step remediation guide.
              </p>

              {topIssue ? (
                <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                      Top Detected Issue
                    </span>
                    <SeverityBadge status={topIssue.status} severity={topIssue.severity} />
                  </div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                    {topIssue.title}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      Est. fix time: ~{topIssue.estimated_fix_minutes || 15} min
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenAdvisor("fix")}
                      className="font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline"
                    >
                      View recommendation &rarr;
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50/40 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-800/60 flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>No high-severity vulnerabilities detected on this target.</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-rose-600 dark:text-rose-400 text-xs font-medium">{error}</p>
          )}
        </div>
      </div>

      {/* Card Actions & Disclaimer */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
        {!brief ? (
          <button
            type="button"
            onClick={handleGenerateBrief}
            disabled={loading}
            className="w-full py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Security Brief</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpenAdvisor("plan")}
            className="w-full py-2.5 px-3 rounded-xl bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <span>View Security Plan</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
          <span>AI-generated guidance is based on your verified scan results</span>
        </div>
      </div>
    </div>
  );
}
