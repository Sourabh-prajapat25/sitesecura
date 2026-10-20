"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ScanCheck } from "@/types";
import { SeverityBadge } from "./SeverityBadge";
import { StructuredEvidenceViewer } from "./security-checks/StructuredEvidenceViewer";
import { resolveFindingArticle } from "@/lib/blog/findingArticleMap";
import { resolveFindingDoc } from "@/lib/docs/findingDocsMap";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Code2,
  Lock,
  ArrowRight,
  Bot,
  Play,
  HelpCircle,
  Terminal,
  BookOpen,
  Sliders,
} from "lucide-react";


interface FindingCardProps {
  check: ScanCheck;
  defaultExpanded?: boolean;
  highlighted?: boolean;
  anchorId?: string;
  domain?: string;
  onOpenAdvisor?: (check: ScanCheck, tab?: "explain" | "fix" | "plan" | "chat") => void;
  onRescan?: () => void;
  onUnlock?: () => void;
}


export function getCategoryLabel(checkType: string): string {
  const ct = (checkType || "").toLowerCase();
  if (ct.includes("https") || ct.includes("ssl") || ct.includes("tls") || ct.includes("redirect")) {
    return "HTTPS & SSL/TLS";
  }
  if (
    ct.includes("hsts") ||
    ct.includes("csp") ||
    ct.includes("frame") ||
    ct.includes("content_type") ||
    ct.includes("referrer") ||
    ct.includes("header") ||
    ct.includes("permissions") ||
    ct.includes("coop") ||
    ct.includes("corp") ||
    ct.includes("coep") ||
    ct.includes("cors")
  ) {
    return "Security Headers";
  }
  // Phase F8: Security Correlation & Compound Risk Chains
  if (ct.includes("deep_risk_chain") || ct.includes("risk_intelligence")) {
    return "Security Correlation & Risk Chains";
  }
  // Phase F7: Data Security, Privacy & Sensitive Information Exposure
  if (
    ct.includes("deep_session_recording") ||
    ct.includes("deep_advertising_tracking") ||
    ct.includes("deep_tracking") ||
    ct.includes("deep_tracker") ||
    ct.includes("deep_consent") ||
    ct.includes("deep_privacy") ||
    ct.includes("deep_gdpr") ||
    ct.includes("deep_ccpa") ||
    ct.includes("deep_retention") ||
    ct.includes("deep_deletion") ||
    ct.includes("deep_access_request")
  ) {
    return "Privacy & Tracking Governance";
  }
  if (
    ct.includes("deep_pii") ||
    ct.includes("deep_public_pii") ||
    ct.includes("deep_public_government_id") ||
    ct.includes("deep_financial") ||
    ct.includes("deep_payment") ||
    ct.includes("deep_public_financial") ||
    ct.includes("deep_public_payment") ||
    ct.includes("deep_health") ||
    ct.includes("deep_public_health") ||
    ct.includes("deep_location") ||
    ct.includes("deep_public_location") ||
    ct.includes("deep_public_auth_data") ||
    ct.includes("deep_secret_in_url") ||
    ct.includes("deep_pii_in_url") ||
    ct.includes("deep_sensitive_parameter") ||
    ct.includes("deep_sensitive_referrer") ||
    ct.includes("deep_data_minimization") ||
    ct.includes("deep_excessive_data_collection") ||
    ct.includes("deep_document") ||
    ct.includes("deep_export") ||
    ct.includes("deep_database") ||
    ct.includes("deep_log_data") ||
    ct.includes("deep_data")
  ) {
    return "Data Security & Sensitive Exposure";
  }

  // Phase F5: Authentication, Session, Authorization & Business Logic
  if (ct.includes("deep_session")) {
    return "Cookie & Session Security";
  }
  if (ct.includes("deep_csrf")) {
    return "Forms & CSRF Security";
  }
  if (ct.includes("deep_password")) {
    return "Authentication & Password Security";
  }
  if (ct.includes("deep_oauth") || ct.includes("deep_oidc") || ct.includes("deep_saml")) {
    return "SSO & Identity Federation";
  }
  if (ct.includes("deep_authz")) {
    return "Authorization & Access Control";
  }
  if (ct.includes("deep_mfa")) {
    return "Multi-Factor Authentication";
  }
  if (ct.includes("deep_business")) {
    return "Business Logic Security";
  }
  if (ct.includes("deep_auth_enumeration")) {
    return "Authentication Security";
  }

  // Phase F6: Infrastructure, Cloud, Deployment & Operational Security
  if (ct.includes("deep_infra") || ct.includes("deep_cdn") || ct.includes("deep_origin") || ct.includes("deep_ipv6")) {
    return "Infrastructure & Edge Network";
  }
  if (ct.includes("deep_cloud") || ct.includes("deep_storage") || ct.includes("deep_serverless")) {
    return "Cloud & Storage Security";
  }
  if (ct.includes("deep_git") || ct.includes("deep_deployment") || ct.includes("deep_docker") || ct.includes("deep_kubernetes")) {
    return "Deployment & Containers";
  }
  if (ct.includes("deep_dev") || ct.includes("deep_staging") || ct.includes("deep_internal") || ct.includes("deep_localhost")) {
    return "Environment Security";
  }
  if (ct.includes("deep_management") || ct.includes("deep_monitoring") || ct.includes("deep_metrics") || ct.includes("deep_debug") || ct.includes("deep_actuator")) {
    return "Operational Security";
  }
  if (ct.includes("deep_takeover")) {
    return "DNS & Domain Security";
  }

  if (ct.includes("cookie")) {
    return "Cookie Security";
  }
  if (ct.includes("mixed_content")) {
    return "Content & Mixed Content";
  }
  if (ct.includes("form")) {
    return "Forms & Input Security";
  }
  if (ct.includes("deep_js") || ct.includes("websocket")) {
    return "Frontend & JavaScript";
  }
  if (
    ct.includes("api") ||
    ct.includes("deep_error") ||
    ct.includes("deep_cache") ||
    ct.includes("deep_http") ||
    ct.includes("deep_directory") ||
    ct.includes("deep_graphql") ||
    ct.includes("deep_auth") ||
    ct.includes("rate_limit")
  ) {
    return "Application & API Security";
  }
  if (ct.includes("robots") || ct.includes("sitemap") || ct.includes("source_map") || ct.includes("resource")) {
    return "Website & Discovery";
  }
  return "Server & Technology";
}

export function FindingCard({
  check,
  defaultExpanded = false,
  highlighted = false,
  anchorId,
  domain,
  onOpenAdvisor,
  onRescan,
  onUnlock,
}: FindingCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || highlighted);

  useEffect(() => {
    if (highlighted) {
      setIsExpanded(true);
    }
  }, [highlighted]);

  const isPass = check.status === "pass";
  const isUnknown = check.status === "unknown";
  const isCriticalOrHigh =
    check.status === "critical" ||
    check.status === "high" ||
    check.severity === "critical" ||
    check.severity === "high";

  const category = getCategoryLabel(check.check_type || "");
  const articleResolution = resolveFindingArticle(check);
  const docResolution = resolveFindingDoc(check);

  // ---------------------------------------------------------------------------
  // GATED / LOCKED FINDING PRESENTATION
  // ---------------------------------------------------------------------------
  if (check.is_locked) {
    return (
      <div
        id={anchorId || `check-${check.id}`}
        onClick={onUnlock}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onUnlock?.();
          }
        }}
        className="group relative bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-500 rounded-xl p-5 shadow-2xs hover:shadow-md transition-all cursor-pointer overflow-hidden select-none scroll-mt-24"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-slate-50/70 via-white/80 to-sky-50/40 dark:from-slate-900/70 dark:via-[#111C2E]/80 dark:to-sky-950/30 pointer-events-none" />
        <div className="absolute inset-x-5 top-5 bottom-5 opacity-30 blur-[2px] select-none pointer-events-none space-y-2">
          <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-1/3" />
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-4/5" />
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
        </div>

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
                  Advanced Audit Finding
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                🔒 {check.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
                Unlock full technical evidence, diagnostic records, remediation commands, and the AI Security Advisor.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 sm:self-center">
            <span className="hidden sm:inline-block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Available with <strong className="text-slate-800 dark:text-slate-200">Basic/Pro</strong>
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

  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  return (
    <div
      id={anchorId || `check-${check.id}`}
      className={`border rounded-xl transition-all duration-200 bg-white dark:bg-[#111C2E] overflow-hidden scroll-mt-24 ${
        highlighted
          ? "ring-2 ring-sky-500 border-sky-400 dark:border-sky-500 shadow-sm"
          : isPass
          ? "border-slate-200/80 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
          : isCriticalOrHigh
          ? "border-red-200/80 shadow-2xs hover:border-red-300 dark:border-red-900/50 dark:hover:border-red-800/80"
          : isUnknown
          ? "border-slate-200 shadow-2xs hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
          : "border-amber-200/80 shadow-2xs hover:border-amber-300 dark:border-amber-900/50 dark:hover:border-amber-800/80"
      }`}
    >
      {/* CARD HEADER (CLICKABLE SUMMARY) */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        className="p-4 sm:p-5 flex items-start justify-between cursor-pointer select-none gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="mt-0.5 shrink-0">
            {isPass ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : isCriticalOrHigh ? (
              <AlertCircle className="w-5 h-5 text-red-500" />
            ) : isUnknown ? (
              <Info className="w-5 h-5 text-sky-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            )}
          </div>

          <div className="min-w-0 space-y-1">
            {/* Meta & Title Row */}
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge status={check.status} severity={check.severity} />

              <span className="text-xs text-slate-400 font-medium">
                {category}
              </span>

              {check.score_impact < 0 && (
                <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded border border-red-100 dark:border-red-900/60 font-mono">
                  {check.score_impact} pts
                </span>
              )}
            </div>

            <h4 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-snug">
              {check.title}
            </h4>

            {/* Concise One-Sentence Summary */}
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
              {check.summary}
            </p>
          </div>
        </div>

        {/* Right Side: Fix Time & Expand Chevron */}
        <div className="flex items-center gap-3 shrink-0">
          {check.estimated_fix_minutes > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-200/70 dark:border-slate-700">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>~{check.estimated_fix_minutes} min</span>
            </span>
          )}
          <div className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* EXPANDED FINDING BODY */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-4 bg-slate-50/30 dark:bg-slate-900/40 text-xs sm:text-sm">
          {/* USER-FACING LAYER: WHY IT MATTERS & RECOMMENDED ACTION */}
          {check.why_it_matters && (
            <div className="space-y-1">
              <h5 className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wide">
                Why this matters
              </h5>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs sm:text-sm">
                {check.why_it_matters}
              </p>
            </div>
          )}

          {check.how_to_fix && (
            <div className="bg-emerald-50/40 dark:bg-emerald-950/30 rounded-xl p-4 border border-emerald-100 dark:border-emerald-800/60 space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-emerald-950 dark:text-emerald-300 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>Recommended action</span>
                </h5>
                {check.estimated_fix_minutes > 0 && (
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                    Estimated effort: ~{check.estimated_fix_minutes} minutes
                  </span>
                )}
              </div>
              <p className="text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {check.how_to_fix}
              </p>
            </div>
          )}

          {/* PROGRESSIVE DISCLOSURE: TECHNICAL DETAILS ACCORDION */}
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors py-1"
            >
              <Terminal className="w-3.5 h-3.5 text-slate-400" />
              <span>{showTechnicalDetails ? "Hide technical details" : "View technical details"}</span>
              {showTechnicalDetails ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {showTechnicalDetails && (
              <div className="mt-3 bg-white dark:bg-[#0B1220] p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
                {/* Definition / Value Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Observed finding</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 break-words mt-0.5 block">{check.summary || "Gap identified"}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target / Record checked</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 break-all mt-0.5 block">{domain || check.check_type || "Domain host"}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assessment category</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block">{category}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Severity & score impact</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                      {check.severity || check.status} ({check.score_impact} pts)
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Internal check code</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400 break-all mt-0.5 block">{check.check_type}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Verification confidence</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                      {Math.round((check.confidence || 1.0) * 100)}% verified
                    </span>
                  </div>
                </div>

                {/* Structured Technical Evidence Block */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <h6 className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                    Raw evidence & diagnostic data
                  </h6>
                  <StructuredEvidenceViewer check={check} domain={domain} />
                </div>

                {/* Contextual actions & Documentation Links */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {onOpenAdvisor && (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenAdvisor(check, "explain")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-800 dark:text-sky-300 font-semibold text-xs border border-sky-200 dark:border-sky-800 transition-colors"
                        >
                          <Bot className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                          <span>Explain with Advisor</span>
                        </button>

                        {!isPass && (
                          <button
                            type="button"
                            onClick={() => onOpenAdvisor(check, "fix")}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-800 transition-colors"
                          >
                            <Terminal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Generate Fix Guide</span>
                          </button>
                        )}
                      </>
                    )}

                    {onRescan && !isPass && (
                      <button
                        type="button"
                        onClick={onRescan}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-semibold text-xs border border-emerald-200 dark:border-emerald-800 transition-colors"
                      >
                        <Play className="w-3 h-3 text-emerald-600 dark:text-emerald-400 fill-current" />
                        <span>Run Verification Scan</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {docResolution.hasDoc && (
                      <Link
                        href={docResolution.href}
                        className="inline-flex items-center gap-1.5 font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline transition-colors"
                        title={docResolution.title ? `Read the documentation guide: ${docResolution.title}` : "Documentation Guide"}
                      >
                        <BookOpen className="w-3.5 h-3.5 text-sky-500" />
                        <span>Docs guide</span>
                        <ArrowRight className="w-3.5 h-3.5 text-sky-500" />
                      </Link>
                    )}

                    {docResolution.toolHref && (
                      <Link
                        href={docResolution.toolHref}
                        className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 hover:underline transition-colors"
                        title={docResolution.toolLabel || "Launch tool"}
                      >
                        <Sliders className="w-3.5 h-3.5 text-slate-400" />
                        <span>{docResolution.toolLabel || "Tool"}</span>
                      </Link>
                    )}

                    {articleResolution.hasArticle && (
                      <Link
                        href={articleResolution.href}
                        className="inline-flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:underline transition-colors"
                        title="Read educational blog guide"
                      >
                        <span>Learn more</span>
                      </Link>
                    )}

                    {!docResolution.hasDoc && !articleResolution.hasArticle && check.documentation_url && (
                      <a
                        href={check.documentation_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:underline"
                        title="Technical reference documentation"
                      >
                        <span>Technical documentation</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
