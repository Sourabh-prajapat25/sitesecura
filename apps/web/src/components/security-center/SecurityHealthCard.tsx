"use client";

import React from "react";
import { Scan } from "@/types";
import { ShieldCheck, Activity } from "lucide-react";

interface SecurityHealthCardProps {
  latestScan: Scan | null;
  onSelectCategory?: (categoryKey: string) => void;
}

const CATEGORY_META: Record<string, { name: string; defaultMax: number }> = {
  https_ssl: { name: "Transport & TLS", defaultMax: 30 },
  security_headers: { name: "Security Headers", defaultMax: 25 },
  dns_email: { name: "DNS & Email", defaultMax: 20 },
  cookie_security: { name: "Cookies", defaultMax: 10 },
  server_hygiene: { name: "Server Security", defaultMax: 15 },
};

function getStatusBadge(percent: number) {
  if (percent >= 85) {
    return {
      label: "Excellent",
      className: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800",
      barColor: "bg-emerald-500",
    };
  }
  if (percent >= 70) {
    return {
      label: "Good",
      className: "text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800",
      barColor: "bg-sky-500",
    };
  }
  return {
    label: "Needs attention",
    className: "text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800",
    barColor: "bg-amber-500",
  };
}

export function SecurityHealthCard({ latestScan, onSelectCategory }: SecurityHealthCardProps) {
  if (!latestScan) {
    return (
      <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs h-full">
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 block mb-4">
          Security health
        </span>
        <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
          No security scan metrics available yet
        </div>
      </div>
    );
  }

  const breakdown = latestScan.score_breakdown || {};
  const categories = Object.keys(CATEGORY_META);

  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Security health
            </h3>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            By security area
          </span>
        </div>

        <div className="space-y-3">
          {categories.map((catKey) => {
            const meta = CATEGORY_META[catKey];
            const data = breakdown[catKey];
            const maxScore = data?.max_score ?? meta.defaultMax;
            const score = data?.score ?? maxScore;
            const percent = Math.max(0, Math.min(100, Math.round((score / Math.max(maxScore, 1)) * 100)));
            const status = getStatusBadge(percent);

            return (
              <div
                key={catKey}
                onClick={() => onSelectCategory?.(catKey)}
                role={onSelectCategory ? "button" : undefined}
                tabIndex={onSelectCategory ? 0 : undefined}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && onSelectCategory) {
                    e.preventDefault();
                    onSelectCategory(catKey);
                  }
                }}
                className={`p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 transition-colors ${
                  onSelectCategory
                    ? "hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
                    : "bg-slate-50/40 dark:bg-slate-800/30"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{meta.name}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${status.barColor}`}
                    style={{ width: `${percent}%` }}
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${meta.name}: ${status.label}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Core defensive areas</span>
        </span>
        <span className="text-slate-400 dark:text-slate-500 text-[11px]">Click an area to view details</span>
      </div>
    </div>
  );
}
