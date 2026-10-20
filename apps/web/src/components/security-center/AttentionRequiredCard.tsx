"use client";

import React from "react";
import { ScanCheck } from "@/types";
import { SeverityBadge } from "../SeverityBadge";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, ShieldCheck } from "lucide-react";

interface AttentionRequiredCardProps {
  checks: ScanCheck[];
  onSelectCheck: (checkId: string) => void;
  onViewAllFindings: () => void;
}

// Severity priority for ordering issues (higher = more urgent)
function getSeverityWeight(status?: string, severity?: string): number {
  const s = (status || "").toLowerCase();
  const sev = (severity || "").toLowerCase();

  if (s === "critical" || sev === "critical") return 5;
  if (s === "high" || sev === "high") return 4;
  if (s === "warning" || sev === "medium" || sev === "warning") return 3;
  if (s === "fail") return 3;
  if (sev === "low") return 2;
  return 1;
}

export function AttentionRequiredCard({
  checks,
  onSelectCheck,
  onViewAllFindings,
}: AttentionRequiredCardProps) {
  // Filter for checks that indicate an issue or defect
  const issues = checks.filter((c) => {
    const status = (c.status || "").toLowerCase();
    const sev = (c.severity || "").toLowerCase();
    return (
      status === "critical" ||
      status === "high" ||
      status === "warning" ||
      status === "fail" ||
      sev === "critical" ||
      sev === "high" ||
      sev === "medium"
    );
  });

  // Sort descending by severity weight and score impact
  const sortedIssues = [...issues].sort((a, b) => {
    const weightDiff =
      getSeverityWeight(b.status, b.severity) - getSeverityWeight(a.status, a.severity);
    if (weightDiff !== 0) return weightDiff;
    return Math.abs(b.score_impact || 0) - Math.abs(a.score_impact || 0);
  });

  // Take top 3 for the command center summary
  const topIssues = sortedIssues.slice(0, 3);

  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Top security improvements
            </h3>
          </div>
          {issues.length > 0 ? (
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
              {issues.length} {issues.length === 1 ? "action item" : "action items"}
            </span>
          ) : (
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              0 action items
            </span>
          )}
        </div>

        {topIssues.length === 0 ? (
          <div className="py-8 text-center space-y-2 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 my-2">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">All security checks passing</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                No high or medium severity vulnerabilities were detected on this target.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {topIssues.map((check) => (
              <div
                key={check.id}
                className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SeverityBadge status={check.status} severity={check.severity} />
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                      {check.title}
                    </h4>
                  </div>
                  {check.score_impact < 0 && (
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded border border-red-100 dark:border-red-900/60 font-mono">
                      {check.score_impact} pts
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {check.summary}
                  </p>
                  {check.why_it_matters && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      <strong className="font-semibold text-slate-700 dark:text-slate-300">Why it matters:</strong> {check.why_it_matters}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-slate-400 dark:text-slate-400 flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Fix time: ~{check.estimated_fix_minutes || 15} min
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => onSelectCheck(check.id)}
                    className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-semibold hover:underline"
                  >
                    <span>View recommendation</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-400 dark:text-slate-500 font-medium">
          Prioritized by impact & effort
        </span>
        <button
          type="button"
          onClick={onViewAllFindings}
          className="inline-flex items-center gap-1 font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline"
        >
          <span>View all {checks.length} observations →</span>
        </button>
      </div>
    </div>
  );
}
