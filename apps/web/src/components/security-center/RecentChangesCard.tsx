"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight, ArrowRight, History, ShieldCheck } from "lucide-react";
import { Scan, ScanCheck } from "@/types";

interface RecentChangesCardProps {
  latestScan: Scan | null;
  previousScan: Scan | null;
}

function isDefect(check: ScanCheck): boolean {
  const status = (check.status || "").toLowerCase();
  return status === "fail" || status === "warning" || status === "high" || status === "critical";
}

export function RecentChangesCard({ latestScan, previousScan }: RecentChangesCardProps) {
  if (!latestScan || !previousScan) {
    return (
      <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Recent Security Changes
            </h3>
          </div>
          <div className="py-8 text-center space-y-2 bg-slate-50/50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-6">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Changes will appear after your next comparison scan.
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
              Automated diff comparison requires at least two completed scans to evaluate security posture modifications.
            </p>
          </div>
        </div>

        <div className="pt-3.5 mt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
          Continuous delta tracking active
        </div>
      </div>
    );
  }

  const prevChecksMap = new Map((previousScan.checks || []).map((c) => [c.check_type, c]));
  const currChecks = latestScan.checks || [];

  const improved: { title: string; desc: string }[] = [];
  const regressed: { title: string; desc: string }[] = [];
  const unchanged: { title: string; desc: string }[] = [];

  for (const curr of currChecks) {
    const prev = prevChecksMap.get(curr.check_type);
    if (!prev) continue;

    const currDefect = isDefect(curr);
    const prevDefect = isDefect(prev);

    if (prevDefect && !currDefect) {
      improved.push({
        title: curr.title || curr.name,
        desc: "Issue resolved; security control now passing",
      });
    } else if (!prevDefect && currDefect) {
      regressed.push({
        title: curr.title || curr.name,
        desc: "New issue detected; security control flagged",
      });
    } else if (!currDefect && !prevDefect && curr.status === "pass") {
      unchanged.push({
        title: curr.title || curr.name,
        desc: "Defensive control remains intact",
      });
    }
  }

  const hasExplicitChanges = improved.length > 0 || regressed.length > 0;

  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Recent Changes
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Consecutive Scan Diff
          </span>
        </div>

        <div className="space-y-2.5">
          {improved.map((item, idx) => (
            <div
              key={`imp-${idx}`}
              className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs flex items-start gap-2.5"
            >
              <div className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 mt-0.5 shrink-0">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-emerald-900 dark:text-emerald-200 block truncate">
                  Improved: {item.title}
                </span>
                <span className="text-emerald-700 dark:text-emerald-300 text-[11px] block">{item.desc}</span>
              </div>
            </div>
          ))}

          {regressed.map((item, idx) => (
            <div
              key={`reg-${idx}`}
              className="p-3 bg-red-50/60 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800 text-xs flex items-start gap-2.5"
            >
              <div className="p-1 rounded-md bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 mt-0.5 shrink-0">
                <ArrowDownRight className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-red-900 dark:text-red-200 block truncate">
                  Needs attention: {item.title}
                </span>
                <span className="text-red-700 dark:text-red-300 text-[11px] block">{item.desc}</span>
              </div>
            </div>
          ))}

          {!hasExplicitChanges && (
            <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Security Posture Unchanged</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                No new security regressions or alterations were detected since the previous scan.
              </p>
            </div>
          )}

          {/* Sample unchanged pass items */}
          {unchanged.slice(0, 2).map((item, idx) => (
            <div
              key={`unc-${idx}`}
              className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between text-slate-600 dark:text-slate-300"
            >
              <div className="flex items-center gap-2 truncate pr-2">
                <span className="text-slate-400 dark:text-slate-500 font-mono">→</span>
                <span className="font-medium truncate">{item.title}</span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 shrink-0">Unchanged</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-3.5 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <span>Compared against scan on {new Date(previousScan.created_at).toLocaleDateString()}</span>
        <span className="font-semibold text-slate-600 dark:text-slate-300">Automated Audit</span>
      </div>
    </div>
  );
}
