"use client";

import React from "react";
import { Lock, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { ScanCheck } from "@/types";

interface LockedFindingCardProps {
  check?: Partial<ScanCheck>;
  index?: number;
  onUnlock: () => void;
}

export function LockedFindingCard({
  check,
  index = 1,
  onUnlock,
}: LockedFindingCardProps) {
  const title = check?.title || `Additional Security Audit Finding #${index}`;
  const category = check?.check_type
    ? check.check_type.replace(/_/g, " ").toUpperCase()
    : "DEEP SECURITY CHECK";

  return (
    <div
      onClick={onUnlock}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onUnlock();
        }
      }}
      className="group relative bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-500 rounded-xl p-5 shadow-2xs hover:shadow-md transition-all cursor-pointer overflow-hidden select-none"
    >
      {/* Background subtle preview with blur */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-50/70 via-white/80 to-sky-50/40 dark:from-slate-900/70 dark:via-[#111C2E]/80 dark:to-sky-950/30 pointer-events-none" />

      {/* Blurred simulated finding lines in background */}
      <div className="absolute inset-x-5 top-5 bottom-5 opacity-40 blur-[3px] select-none pointer-events-none space-y-2">
        <div className="h-4 bg-slate-400 dark:bg-slate-600 rounded w-1/3" />
        <div className="h-3 bg-slate-300 dark:bg-slate-700 rounded w-4/5" />
        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
      </div>

      {/* Foreground unlock content */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-sky-100/90 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 flex items-center justify-center shrink-0 border border-sky-200 dark:border-sky-800 group-hover:scale-105 transition-transform">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 dark:bg-sky-950/60 dark:text-sky-300 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                {category}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Locked finding
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
              🔒 {title}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
              Inspect technical evidence, affected response headers, step-by-step remediation commands, and documentation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 sm:self-center">
          <span className="hidden sm:inline-block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Available with <strong className="text-slate-800 dark:text-slate-200">Basic</strong>
          </span>
          <button
            type="button"
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs shadow-2xs group-hover:shadow-sm transition-all flex items-center gap-1.5"
          >
            <span>Unlock</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
