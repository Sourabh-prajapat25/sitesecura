"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  HelpCircle,
  AlertTriangle,
  Activity,
  CheckCircle2,
  Calendar,
  Lock,
  Globe,
  Loader2,
  RefreshCw,
  Play,
  ArrowRight,
} from "lucide-react";
import { WebsiteBadgeStatus, BadgeEligibilityResult } from "@/types";
import { getReasonDetail } from "./reasonCodeMap";

interface BadgeStatusHeroProps {
  badgeStatus: WebsiteBadgeStatus | null;
  eligibility: BadgeEligibilityResult | null;
  latestScanScore?: number | null;
  isVerifying: boolean;
  isCheckingEligibility: boolean;
  onVerify: () => void;
  onOpenRevoke: () => void;
  onCheckEligibility: () => void;
}

function formatDate(isoString?: string | null): string {
  if (!isoString) return "N/A";
  try {
    const d = new Date(isoString);
    return (
      d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }) + " UTC"
    );
  } catch {
    return isoString;
  }
}

export function BadgeStatusHero({
  badgeStatus,
  eligibility,
  latestScanScore,
  isVerifying,
  isCheckingEligibility,
  onVerify,
  onOpenRevoke,
  onCheckEligibility,
}: BadgeStatusHeroProps) {
  const status = badgeStatus?.status || "not_configured";
  const domain = badgeStatus?.domain || "Your Website";

  const isVerified = status === "verified";
  const isEligible = status === "eligible" || (!isVerified && eligibility?.eligible === true);
  const isExpired = status === "expired";
  const isRevoked = status === "revoked";
  const isIneligible = status === "ineligible" || (!isVerified && eligibility?.eligible === false);
  const isNotConfigured = status === "not_configured" && !eligibility;

  // Real score evaluation
  const scoreValue =
    badgeStatus?.score !== undefined && badgeStatus?.score !== null
      ? badgeStatus.score
      : eligibility?.score !== undefined && eligibility?.score !== null
      ? eligibility.score
      : null;

  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 sm:p-8 space-y-6">
      {/* Top Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {isVerified && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>SiteSecura Verified</span>
          </div>
        )}
        {!isVerified && isEligible && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 text-xs font-bold border border-sky-200 dark:border-sky-800">
            <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Eligible for Verification</span>
          </div>
        )}
        {isExpired && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-800">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Verification Expired</span>
          </div>
        )}
        {isRevoked && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-800">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Verification Revoked</span>
          </div>
        )}
        {isIneligible && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Not Currently Eligible</span>
          </div>
        )}
        {isNotConfigured && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700">
            <HelpCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>No Completed Scan Available</span>
          </div>
        )}

        {/* Website domain indicator */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">
          <Globe className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">{domain}</span>
        </div>
      </div>

      {/* Main Headline & Context Narrative */}
      <div className="space-y-2">
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {isVerified && "Active SiteSecura Verified Status"}
          {!isVerified && isEligible && "Your Website Qualifies for SiteSecura Verified"}
          {isExpired && "SiteSecura Verification Expired"}
          {isRevoked && "SiteSecura Verification Revoked"}
          {isIneligible && "Website Does Not Meet Active Verification Policy"}
          {isNotConfigured && "Run an Assessment to Determine Eligibility"}
        </h2>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {isVerified &&
            "Your website currently has an active SiteSecura verification snapshot. Visitors can verify your security posture through your public verification URL and dynamic SVG badge."}
          {!isVerified &&
            isEligible &&
            "Your latest completed SiteSecura security scan meets all criteria of the active verification policy. Issue your badge below to activate public verification."}
          {isExpired &&
            "The previous SiteSecura verification is no longer current. Run a new eligible scan or re-verify below to display the active badge again."}
          {isRevoked &&
            "The SiteSecura verification for this website was revoked by an administrator and is no longer active. You can re-check eligibility or re-verify at any time."}
          {isIneligible &&
            "Your latest completed scan did not meet one or more policy requirements. Review the specific reasons below, address any findings, and rescan."}
          {isNotConfigured &&
            "Run a completed SiteSecura defensive scan before requesting verification. Verification requires an authoritative completed scan within the last 30 days."}
        </p>
      </div>

      {/* Verification Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
        {/* Metric 1: Security Score */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            <span>Security Score</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            {scoreValue !== null ? `${scoreValue} / 100` : "Score unavailable"}
          </div>
          {badgeStatus?.risk_level && (
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Risk Level: {badgeStatus.risk_level}
            </div>
          )}
        </div>

        {/* Metric 2: Verified Date */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            <span>Assessment Date</span>
          </div>
          <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
            {formatDate(badgeStatus?.verified_at || eligibility?.evaluated_at)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {isVerified ? "Snapshot timestamp" : "Evaluation timestamp"}
          </div>
        </div>

        {/* Metric 3: Valid Until */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            <span>Valid Until</span>
          </div>
          <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
            {badgeStatus?.expires_at ? formatDate(badgeStatus.expires_at) : "30 days upon issuance"}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {isExpired ? "Status: Lapsed" : isVerified ? "Status: Active" : "Validity window"}
          </div>
        </div>

        {/* Metric 4: Monitoring State */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            <span>Monitoring</span>
          </div>
          <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
            {badgeStatus?.verified_at
              ? "Point-in-time check"
              : "Standard verification"}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Weekly/Daily monitoring available
          </div>
        </div>
      </div>

      {/* Snapshot distinction notice (if verification snapshot score differs from latest scan) */}
      {isVerified &&
        latestScanScore !== undefined &&
        latestScanScore !== null &&
        scoreValue !== null &&
        latestScanScore !== scoreValue && (
          <div className="p-3.5 bg-sky-50/70 dark:bg-sky-950/30 rounded-xl border border-sky-200/80 dark:border-sky-800/60 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-2.5">
            <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Notice regarding recent scan:</span>
              <p className="text-sky-800 dark:text-sky-300 leading-relaxed">
                Your current active verification snapshot score is <strong>{scoreValue}/100</strong>. Your most recent scan recorded <strong>{latestScanScore}/100</strong>. Verified badges preserve historical snapshot integrity until you re-verify.
              </p>
            </div>
          </div>
        )}

      {/* Ineligible Reasons Display */}
      {isIneligible && eligibility && eligibility.reasons.length > 0 && (
        <div className="p-4 sm:p-5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400" />
            <span>Policy Requirements Requiring Attention ({eligibility.reasons.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {eligibility.reasons.map((code) => {
              const detail = getReasonDetail(code);
              return (
                <div
                  key={code}
                  className="p-3 bg-white/90 dark:bg-[#0B1220]/80 rounded-lg border border-amber-200/60 dark:border-amber-900/40 space-y-1 shadow-2xs"
                >
                  <div className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>{detail.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {detail.description}
                  </p>
                  {detail.actionHint && (
                    <p className="text-[10px] font-semibold text-sky-700 dark:text-sky-400">
                      Recommendation: {detail.actionHint}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {/* Verify button for eligible or re-verifying */}
          {(isEligible || (isExpired && eligibility?.eligible)) && (
            <button
              type="button"
              onClick={onVerify}
              disabled={isVerifying}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Issuing Verification...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isExpired ? "Re-verify Website" : "Verify Website"}</span>
                </>
              )}
            </button>
          )}

          {/* Re-check eligibility button */}
          <button
            type="button"
            onClick={onCheckEligibility}
            disabled={isCheckingEligibility}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isCheckingEligibility ? "animate-spin" : ""}`}
            />
            <span>Check Eligibility</span>
          </button>

          {/* Link to scan website if ineligible or not configured */}
          {(isIneligible || isNotConfigured) && badgeStatus?.website_id && (
            <Link
              href={`/dashboard/websites/${badgeStatus.website_id}`}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span>View Scan & Fixes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {/* Destructive Revoke Button for Active Verification */}
        {isVerified && (
          <button
            type="button"
            onClick={onOpenRevoke}
            className="px-4 py-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 hover:border-rose-300 font-semibold text-xs rounded-xl transition-colors"
          >
            Revoke Verification
          </button>
        )}
      </div>
    </div>
  );
}
