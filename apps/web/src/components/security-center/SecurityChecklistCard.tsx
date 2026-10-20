"use client";

import React from "react";
import { ScanCheck } from "@/types";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
  ListChecks,
} from "lucide-react";

interface SecurityChecklistCardProps {
  checks: ScanCheck[];
  onSelectCheck: (checkId: string) => void;
}

export function SecurityChecklistCard({
  checks,
  onSelectCheck,
}: SecurityChecklistCardProps) {
  if (checks.length === 0) {
    return (
      <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs h-full flex flex-col justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
          Security Checklist
        </span>
        <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
          No check items recorded yet
        </div>
      </div>
    );
  }

  const passedCount = checks.filter((c) => c.status === "pass").length;
  const totalCount = checks.length;

  const renderStatusIcon = (status?: string, severity?: string) => {
    const s = (status || "").toLowerCase();
    const sev = (severity || "").toLowerCase();

    if (s === "pass") {
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    }
    if (s === "critical" || sev === "critical" || s === "high" || sev === "high") {
      return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
    }
    if (s === "warning" || s === "fail" || sev === "medium" || sev === "warning") {
      return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
    }
    return <Info className="w-4 h-4 text-sky-500 shrink-0" />;
  };

  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Security Checklist
            </h3>
          </div>
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            {passedCount} / {totalCount} passing
          </span>
        </div>

        {/* Scrollable list of verified checks */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[360px] overflow-y-auto pr-1">
          {checks.map((check) => (
            <button
              key={check.id}
              type="button"
              onClick={() => onSelectCheck(check.id)}
              className="w-full py-2.5 px-1.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/50 rounded-lg text-left transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                {renderStatusIcon(check.status, check.severity)}
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white truncate">
                  {check.title || check.name}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {check.score_impact < 0 ? (
                  <span className="text-[11px] font-bold text-red-600 dark:text-red-400 font-mono">
                    {check.score_impact} pts
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 capitalize">
                    {check.status === "pass" ? "Passed" : check.status}
                  </span>
                )}
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-300 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-3.5 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <span>Click any check to view technical evidence</span>
        <span className="font-semibold text-slate-600 dark:text-slate-300">{Math.round((passedCount / totalCount) * 100)}% pass rate</span>
      </div>
    </div>
  );
}
