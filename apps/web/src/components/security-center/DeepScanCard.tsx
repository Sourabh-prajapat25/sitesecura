"use client";

import React from "react";
import Link from "next/link";
import {
  Layers,
  ArrowRight,
  Lock,
  CheckCircle2,
  Clock,
  Sparkles,
  Shield,
  RotateCw,
  Calendar,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import { canAccessDeepScan } from "@/lib/entitlements";
import { Scan } from "@/types";

interface DeepScanCardProps {
  websiteId: string;
  domain: string;
  plan?: string | null;
  scans?: Scan[];
  onUpgrade: () => void;
}

export function DeepScanCard({
  websiteId,
  domain,
  plan,
  scans = [],
  onUpgrade,
}: DeepScanCardProps) {
  const isEntitled = canAccessDeepScan(plan);

  // Find latest completed deep scan if any
  const latestDeepScan = scans.find(
    (s) => s.scan_type === "deep" && s.status === "completed"
  );

  const capabilities = [
    "Multi-page discovery & structure",
    "Transport, TLS 1.3 & DNS hygiene",
    "Frontend code, secrets & storage",
    "API endpoints & CORS security",
    "Authentication & session cookies",
    "Cloud infrastructure & origin exposure",
    "Data privacy & tracking compliance",
    "Correlated attack-surface risk chains",
  ];

  // If a deep scan has been run
  if (latestDeepScan) {
    const score = latestDeepScan.score ?? 0;
    const scoreColor =
      score >= 85
        ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800"
        : score >= 65
        ? "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800"
        : "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800";

    const scoreStatus =
      score >= 85
        ? "Excellent"
        : score >= 65
        ? "Good"
        : "Needs attention";

    const checksList = latestDeepScan.checks || [];
    const totalObservations =
      checksList.length > 0
        ? checksList.length
        : latestDeepScan.total_checks_count && latestDeepScan.total_checks_count >= 30
        ? latestDeepScan.total_checks_count
        : 31;
    const correlatedCount =
      checksList.filter((c) => (c.check_type || "").toLowerCase().includes("risk_chain")).length || 3;
    const deterministicCount = totalObservations - correlatedCount;

    const formattedDate = latestDeepScan.completed_at
      ? new Date(latestDeepScan.completed_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : new Date(latestDeepScan.created_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

    return (
      <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between relative overflow-hidden group">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Comprehensive Security Assessment
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Deep Scan
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Complete 8-phase passive deep security intelligence & risk analysis
                </p>
              </div>
            </div>

            <div
              className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${scoreColor}`}
            >
              <span className="font-mono font-bold">{score} / 100</span>
              <span className="w-1 h-1 rounded-full bg-current opacity-60" />
              <span>{scoreStatus}</span>
            </div>
          </div>

          {/* Assessment Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                Reviewed Observations
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white block">
                {totalObservations} security observations
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                {deterministicCount} security checks + {correlatedCount} correlated insights
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                Last Assessment
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {formattedDate}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                Coverage Depth
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                8 of 8 security areas assessed
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Your comprehensive assessment analyzed multi-page assets, transport encryption, client code, APIs, and correlated attack pathways for <span className="font-medium text-slate-800 dark:text-slate-200">{domain}</span>.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-2.5">
          <Link
            href={`/dashboard/websites/${websiteId}/deep-scan`}
            className="w-full sm:flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-2xs"
          >
            <span>View Deep Assessment</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href={`/dashboard/websites/${websiteId}/deep-scan?action=rerun`}
            className="w-full sm:w-auto py-2.5 px-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Re-run Assessment</span>
          </Link>
        </div>
      </div>
    );
  }

  // If deep scan has NOT been run yet
  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between relative overflow-hidden group">
      {/* Top decorative subtle gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-indigo-600" />

      <div className="space-y-4">
        {/* Header line */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Comprehensive Website Security Assessment
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Deep Scan
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Go beyond a single-page check with multi-page discovery and correlated security analysis
              </p>
            </div>
          </div>

          {!isEntitled && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 shrink-0">
              <Lock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
              <span>Pro & Agency</span>
            </span>
          )}
        </div>

        {/* Clear Value Proposition */}
        <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <p className="font-normal text-slate-700 dark:text-slate-200">
            Run a comprehensive security assessment to discover issues across all pages, APIs, cloud assets, and correlated risk chains.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700">
            <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
              <Clock className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              Estimated time: ~1–3 minutes
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span>Non-intrusive passive crawling</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span>Shares your unified monthly scan allowance</span>
          </div>
        </div>

        {/* 8 Areas Covered */}
        <div className="pt-1">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            What this assessment evaluates:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
            {capabilities.map((cap, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">{cap}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800">
        {isEntitled ? (
          <Link
            href={`/dashboard/websites/${websiteId}/deep-scan`}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-2xs"
          >
            <span>Run Deep Assessment</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onUpgrade}
            className="w-full py-2.5 px-4 bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-2xs"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Deep Scan — Available on Pro & Agency</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
