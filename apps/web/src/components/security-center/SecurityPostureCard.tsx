"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus, ShieldCheck, Clock } from "lucide-react";
import { Scan } from "@/types";
import { getRiskBadgeColor, getScoreRingColor } from "@/lib/utils";

interface SecurityPostureCardProps {
  latestScan: Scan | null;
  previousScan: Scan | null;
}

export function SecurityPostureCard({ latestScan, previousScan }: SecurityPostureCardProps) {
  if (!latestScan) {
    return (
      <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between h-full">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Quick Security Check
        </span>
        <div className="py-8 text-center space-y-2">
          <p className="text-3xl font-extrabold text-slate-300 dark:text-slate-700">— / 100</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Run a scan to determine posture score</p>
        </div>
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>No historical scans</span>
        </div>
      </div>
    );
  }

  const score = latestScan.score ?? 0;
  const clampedScore = Math.max(0, Math.min(100, score));
  const risk = latestScan.risk_level || "Unknown";

  // Calculate real score delta
  let delta: number | null = null;
  if (previousScan && typeof previousScan.score === "number" && typeof latestScan.score === "number") {
    delta = latestScan.score - previousScan.score;
  }

  // Refined radial posture progress
  const strokeColor = getScoreRingColor(clampedScore);
  const radius = 56;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Latest Quick Security Check
          </span>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRiskBadgeColor(
            risk
          )}`}
        >
          {risk.toUpperCase()}
        </span>
      </div>

      {/* Main Score Display */}
      <div className="py-5 flex flex-col sm:flex-row items-center justify-center gap-6">
        {/* Progress Ring */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg width={136} height={136} className="transform -rotate-90">
            <circle
              cx={68}
              cy={68}
              r={radius}
              stroke="currentColor"
              className="text-slate-100 dark:text-slate-800"
              strokeWidth={stroke}
              fill="transparent"
            />
            <circle
              cx={68}
              cy={68}
              r={radius}
              stroke={strokeColor}
              strokeWidth={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              {clampedScore}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              out of 100
            </span>
          </div>
        </div>

        {/* Narrative & Delta Details */}
        <div className="space-y-3 text-center sm:text-left">
          <div className="space-y-1">
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {clampedScore >= 90
                ? "Hardened Security Posture"
                : clampedScore >= 75
                ? "Strong Defensive Baseline"
                : clampedScore >= 60
                ? "Moderate Risk Posture"
                : "High Remediation Urgency"}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {clampedScore >= 90
                ? "Key security controls and protocols are verified active."
                : clampedScore >= 75
                ? "Core protocols verified with minor recommended improvements."
                : "Security deficiencies detected that require remediation."}
            </p>
          </div>

          {/* Delta Pill */}
          <div>
            {delta !== null ? (
              delta > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>+{delta} points since previous scan</span>
                </span>
              ) : delta < 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800">
                  <ArrowDownRight className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <span>{delta} points since previous scan</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Minus className="w-3.5 h-3.5 text-slate-400" />
                  <span>No score change since previous scan</span>
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-500" />
                <span>Initial baseline score established</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer Timestamp */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Last evaluated:</span>
        </span>
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {new Date(latestScan.created_at).toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      </div>
    </div>
  );
}
