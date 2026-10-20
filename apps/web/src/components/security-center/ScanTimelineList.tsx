"use client";

import React from "react";
import Link from "next/link";
import {
  Clock,
  ArrowRight,
  Download,
  Loader2,
  Layers,
  Shield,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Scan } from "@/types";

interface ScanTimelineListProps {
  scans: Scan[];
  websiteId: string;
  downloadingScanId?: string | null;
  onDownloadScanPdf: (scanId: string) => void;
  maxItems?: number;
  onViewAll?: () => void;
}

export function ScanTimelineList({
  scans,
  websiteId,
  downloadingScanId,
  onDownloadScanPdf,
  maxItems,
  onViewAll,
}: ScanTimelineListProps) {
  const displayScans = maxItems ? scans.slice(0, maxItems) : scans;

  if (scans.length === 0) {
    return (
      <div className="bg-white dark:bg-[#111C2E] p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400 text-xs shadow-xs space-y-2">
        <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
        <p className="font-semibold text-slate-700 dark:text-slate-300">No scan history recorded yet</p>
        <p className="text-slate-400 dark:text-slate-500">Run your first scan to begin tracking your website security timeline.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayScans.map((scan, idx) => {
        const isDeep = scan.scan_type === "deep";
        const score = scan.score;
        const hasScore = typeof score === "number";
        const scoreBadgeColor =
          !hasScore
            ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            : score >= 90
            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
            : score >= 75
            ? "bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800"
            : score >= 60
            ? "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
            : "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800";

        const obsCount = scan.checks?.length ?? scan.total_checks_count;
        const viewLink = isDeep
          ? `/dashboard/websites/${websiteId}/deep-scan?scanId=${scan.id}`
          : `/scan/${scan.id}`;

        const formattedDate = new Date(scan.created_at).toLocaleString([], {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

        return (
          <div
            key={scan.id}
            className="bg-white dark:bg-[#111C2E] rounded-xl border border-slate-200/90 dark:border-slate-800 p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
          >
            {/* Left side: Date, Type, Observations */}
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                  isDeep
                    ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                {isDeep ? <Layers className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              </div>

              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {formattedDate}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      isDeep
                        ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {isDeep ? "Comprehensive Assessment" : "Quick Check"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded capitalize ${
                      scan.status === "completed"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : scan.status === "failed"
                        ? "text-rose-700 dark:text-rose-400"
                        : "text-sky-700 dark:text-sky-400"
                    }`}
                  >
                    {scan.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span>
                    {obsCount > 0 ? `${obsCount} security observations reviewed` : "Scan completed"}
                  </span>
                  {scan.passed_checks_count !== undefined && scan.passed_checks_count > 0 && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                        {scan.passed_checks_count} passed
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right side: Score & Actions */}
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
              {hasScore ? (
                <div
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border font-mono ${scoreBadgeColor}`}
                >
                  {score} / 100
                </div>
              ) : (
                <div className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  —
                </div>
              )}

              <div className="flex items-center gap-2">
                <Link
                  href={viewLink}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-700 dark:text-sky-300 hover:text-sky-800 dark:hover:text-sky-200 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-100 dark:border-sky-800 transition-colors flex items-center gap-1"
                >
                  <span>View</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>

                <button
                  type="button"
                  onClick={() => onDownloadScanPdf(scan.id)}
                  disabled={scan.status !== "completed" || downloadingScanId === scan.id}
                  title={
                    scan.status !== "completed"
                      ? "PDF report available once scan finishes"
                      : "Download PDF report for this scan"
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {downloadingScanId === scan.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500 dark:text-slate-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  )}
                  <span>PDF</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {maxItems && scans.length > maxItems && onViewAll && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-400 transition-colors inline-flex items-center gap-1"
          >
            <span>View all {scans.length} historical scans in timeline</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
