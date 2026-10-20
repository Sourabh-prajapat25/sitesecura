"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { WebsiteBadgeStatus, BadgeEligibilityResult } from "@/types";
import { api } from "@/lib/api";
import { getReasonDetail } from "../security-badge/reasonCodeMap";

interface WebsiteDetailBadgeCardProps {
  websiteId: string;
  latestScanScore?: number | null;
}

function formatDate(isoString?: string | null): string {
  if (!isoString) return "N/A";
  try {
    const d = new Date(isoString);
    return (
      d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }) + " UTC"
    );
  } catch {
    return isoString;
  }
}

export function WebsiteDetailBadgeCard({
  websiteId,
  latestScanScore,
}: WebsiteDetailBadgeCardProps) {
  const [badgeStatus, setBadgeStatus] = useState<WebsiteBadgeStatus | null>(null);
  const [eligibility, setEligibility] = useState<BadgeEligibilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [statusData, eligData] = await Promise.all([
          api.getBadgeStatus(websiteId),
          api.getBadgeEligibility(websiteId),
        ]);
        setBadgeStatus(statusData);
        setEligibility(eligData);
      } catch (err: any) {
        console.error("Failed to load website badge status:", err);
        setError("Unable to load badge status.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [websiteId]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs animate-pulse space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
        </div>
        <div className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded" />
      </div>
    );
  }

  const rawStatus = (badgeStatus?.status || "not_configured").toLowerCase();
  const isVerified = rawStatus === "verified";
  const isExpired = rawStatus === "expired";
  const isRevoked = rawStatus === "revoked";
  const isEligible = Boolean(eligibility?.eligible);

  const snapshotScore = badgeStatus?.score;
  const hasScoreDiscrepancy =
    isVerified &&
    snapshotScore !== null &&
    snapshotScore !== undefined &&
    latestScanScore !== null &&
    latestScanScore !== undefined &&
    snapshotScore !== latestScanScore;

  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between h-full">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Security Badge
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Pill */}
            {isVerified && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                Verified
              </span>
            )}
            {isExpired && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                Expired
              </span>
            )}
            {isRevoked && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                Revoked
              </span>
            )}
            {!isVerified && !isExpired && !isRevoked && isEligible && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                <CheckCircle2 className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                Eligible
              </span>
            )}
            {!isVerified && !isExpired && !isRevoked && !isEligible && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                <HelpCircle className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                Not Verified
              </span>
            )}

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              title="Refresh badge status"
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-sky-600 dark:text-sky-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {error ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
        ) : isVerified ? (
          <div className="space-y-3">
            {/* Score Snapshot Display */}
            <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Verified Score
                </span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {snapshotScore !== null && snapshotScore !== undefined
                    ? `${snapshotScore}/100`
                    : "Score unavailable"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Valid Until
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {formatDate(badgeStatus?.expires_at)}
                </span>
              </div>
            </div>

            {/* Snapshot Distinction Notice */}
            {hasScoreDiscrepancy && (
              <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-0.5">
                <div className="flex items-center justify-between font-semibold">
                  <span>Latest Scan Score:</span>
                  <span>{latestScanScore}/100</span>
                </div>
                <p className="text-amber-800 dark:text-amber-400 text-[10px] leading-tight">
                  Public badge preserves verified snapshot ({snapshotScore}/100) until a new badge is issued.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isEligible
                ? "This website meets all security criteria and qualifies for a SiteSecura Verified trust badge."
                : eligibility?.reasons && eligibility.reasons.length > 0
                ? getReasonDetail(eligibility.reasons[0]).title
                : "Run a security scan to evaluate eligibility for the SiteSecura Verified trust badge."}
            </p>
            {eligibility && !isEligible && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                <span>Requires score &ge; {eligibility.policy.minimum_score} and 0 critical findings.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <Link
          href={`/dashboard/security-badge?website=${encodeURIComponent(websiteId)}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
        >
          <span>Manage Badge</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>

        {isVerified && badgeStatus?.public_token && (
          <Link
            href={`/verified/${encodeURIComponent(badgeStatus.public_token)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <span>Public Page</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
