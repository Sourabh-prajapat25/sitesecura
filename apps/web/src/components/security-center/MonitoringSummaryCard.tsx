"use client";

import React from "react";
import { Website } from "@/types";
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sliders,
  ShieldAlert,
  Loader2,
} from "lucide-react";

interface MonitoringSummaryCardProps {
  website: Website;
  onConfigureMonitoring: () => void;
  onToggleMonitoring: () => void;
  actionLoading: boolean;
}

export function MonitoringSummaryCard({
  website,
  onConfigureMonitoring,
  onToggleMonitoring,
  actionLoading,
}: MonitoringSummaryCardProps) {
  const isEnabled = website.monitoring_enabled;
  const monitoring = website.monitoring;
  const frequency = monitoring?.frequency || website.monitoring_frequency || "weekly";
  const isFailing = isEnabled && monitoring?.status === "failing";

  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Monitoring Summary
            </h3>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
              isEnabled
                ? isFailing
                  ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                  : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
            }`}
          >
            {isEnabled ? (
              isFailing ? (
                <>
                  <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Failing
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active
                </>
              )
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-400" /> Paused
              </>
            )}
          </span>
        </div>

        {isEnabled ? (
          <div className="space-y-3.5 text-xs">
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Automated background monitoring runs on a{" "}
              <strong className="text-slate-900 dark:text-white capitalize">{frequency}</strong> schedule.
            </p>

            <div className="grid grid-cols-2 gap-2.5 p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-0.5">
                  Last Checked
                </span>
                <span className="text-slate-800 dark:text-slate-100 font-semibold truncate block">
                  {monitoring?.last_run_at
                    ? new Date(monitoring.last_run_at).toLocaleDateString()
                    : "Pending first run"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-0.5">
                  Next Scan
                </span>
                <span className="text-slate-800 dark:text-slate-100 font-semibold truncate block">
                  {monitoring?.next_run_at
                    ? new Date(monitoring.next_run_at).toLocaleDateString()
                    : "Scheduled by Beat"}
                </span>
              </div>
            </div>

            {/* Coverage Vectors */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block tracking-wider">
                Automated Coverage
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>SSL Expiration</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>DNS Tampering</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Security Headers</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Score Drops (≥5)</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-3 text-xs">
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Automated monitoring is paused. Enable continuous evaluation to receive instant alerts when certificates expire, headers are removed, or scores decline.
            </p>

            <button
              type="button"
              onClick={onToggleMonitoring}
              disabled={actionLoading}
              className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Enabling...</span>
                </>
              ) : (
                <span>Enable Monitoring</span>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="pt-3.5 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={onConfigureMonitoring}
          className="inline-flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline"
        >
          <Sliders className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span>Configure Schedule & Alerts →</span>
        </button>

        {isEnabled && (
          <button
            type="button"
            onClick={onToggleMonitoring}
            disabled={actionLoading}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold transition-colors disabled:opacity-50"
          >
            {actionLoading ? "Updating..." : "Pause"}
          </button>
        )}
      </div>
    </div>
  );
}
