"use client";

import React, { useState } from "react";
import { Scan } from "@/types";
import { HelpCircle, ChevronDown, ChevronUp, Layers, ShieldCheck } from "lucide-react";

interface ScoreExplanationCardProps {
  latestScan: Scan | null;
}

const CATEGORY_NAMES: Record<string, string> = {
  https_ssl: "HTTPS & TLS",
  security_headers: "Security Headers",
  dns_email: "DNS & Email",
  cookie_security: "Cookie Security",
  server_hygiene: "Server Hygiene",
};

const DEFAULT_WEIGHTS: Record<string, number> = {
  https_ssl: 30,
  security_headers: 25,
  dns_email: 20,
  cookie_security: 10,
  server_hygiene: 15,
};

export function ScoreExplanationCard({ latestScan }: ScoreExplanationCardProps) {
  const [showComparison, setShowComparison] = useState(false);

  if (!latestScan) {
    return (
      <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between h-full">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Why this score?
        </span>
        <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
          Run a scan to generate category breakdown
        </div>
      </div>
    );
  }

  const breakdown = latestScan.score_breakdown || {};
  const totalScore = latestScan.score ?? 0;

  // Categories in standard order
  const categories = [
    "https_ssl",
    "security_headers",
    "dns_email",
    "cookie_security",
    "server_hygiene",
  ];

  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            Why is my Quick Check score {totalScore}?
          </h3>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span>Deterministic Scoring</span>
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
          Your score is calculated from verified security checks across 5 core defensive categories.
        </p>

        {/* Category Breakdown Table */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {categories.map((catKey) => {
            const data = breakdown[catKey];
            const maxScore = data?.max_score ?? DEFAULT_WEIGHTS[catKey] ?? 20;
            const score = data?.score ?? maxScore;
            const isFull = score === maxScore;

            return (
              <div key={catKey} className="py-2.5 flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {CATEGORY_NAMES[catKey] || catKey.replace("_", " ")}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-bold font-mono ${
                      isFull
                        ? "text-slate-800 dark:text-slate-100"
                        : score > 0
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {score}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 font-mono">/ {maxScore} pts</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 pt-3">
        {/* Total Row */}
        <div className="pt-2 border-t-2 border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
          <span className="text-slate-900 dark:text-white uppercase tracking-wider">Quick Check Total</span>
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-sky-700 dark:text-sky-400 text-sm font-black">{totalScore}</span>
            <span className="text-slate-400 dark:text-slate-500 font-semibold">/ 100</span>
          </div>
        </div>

        {/* Expandable: Why are these scores different? */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
          <button
            type="button"
            onClick={() => setShowComparison(!showComparison)}
            className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-sky-700 dark:hover:text-sky-400 transition-colors py-1"
          >
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>Why are Quick Check and Deep Scan scores different?</span>
            </span>
            {showComparison ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            )}
          </button>

          {showComparison && (
            <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed animate-in fade-in">
              <div className="space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  <span>Quick Security Check (13 Checks)</span>
                </span>
                <p className="text-slate-500 dark:text-slate-400">
                  Evaluates your core perimeter baseline across 5 categories: SSL/TLS encryption, critical security headers, DNS & email authentication (SPF/DMARC), cookie flags, and server information hygiene.
                </p>
              </div>

              <div className="space-y-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>Comprehensive Assessment / Deep Scan (31 Observations)</span>
                </span>
                <p className="text-slate-500 dark:text-slate-400">
                  Evaluates 8 deep security domains across multi-page crawls, client-side JavaScript, secret leaks, API endpoints, authentication workflows, cloud infrastructure, and 3 correlated multi-finding risk chains.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
