"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Clock,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  FileText,
  FileCode,
  Info,
  CheckCircle2,
  XCircle,
  Lock,
  Layers,
  Code2,
  Sparkles,
  Download,
} from "lucide-react";
import { CspPolicyAnalyzeResponse, CspFinding, CspPolicyDetail } from "@/types";
import { CspDirectiveTable } from "./CspDirectiveTable";

export interface CspPolicyResultsProps {
  results: CspPolicyAnalyzeResponse | null;
  error: string | null;
  onRetry?: () => void;
  isLoading?: boolean;
}

export function CspPolicyResults({
  results,
  error,
  onRetry,
  isLoading,
}: CspPolicyResultsProps) {
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedRawIndex, setCopiedRawIndex] = useState<number | null>(null);
  const [activePolicyIndex, setActivePolicyIndex] = useState<number>(0);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [expandedFindings, setExpandedFindings] = useState<Record<string, boolean>>({});

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-xs">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 mb-4 animate-spin">
          <RotateCcw className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">
          Analyzing Content Security Policy...
        </h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Parsing W3C CSP Level 3 directives, evaluating fallback hierarchies, checking unsafe keywords, and scoring policy resistance.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-3xl border border-rose-200/80 p-8 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 text-rose-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Analysis Failed
            </h3>
            <p className="text-sm text-rose-700 mb-4 whitespace-pre-line">
              {error}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!results) {
    return null;
  }

  const { status, metrics, policies, findings, summary_markdown, url, http_status_code, duration_ms } = results;

  // Handle distinct non-fatal statuses
  const getStatusBadge = () => {
    switch (status) {
      case "success":
        return {
          label: "Policy Analyzed",
          style: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: ShieldCheck,
        };
      case "no_policy_found":
        return {
          label: "No CSP Header Found",
          style: "bg-amber-50 text-amber-700 border-amber-200",
          icon: AlertTriangle,
        };
      case "invalid_policy":
        return {
          label: "Invalid Syntax",
          style: "bg-rose-50 text-rose-700 border-rose-200",
          icon: XCircle,
        };
      case "blocked_target":
        return {
          label: "SSRF Protection Blocked",
          style: "bg-rose-50 text-rose-700 border-rose-200",
          icon: ShieldAlert,
        };
      case "fetch_error":
        return {
          label: "Fetch Error",
          style: "bg-rose-50 text-rose-700 border-rose-200",
          icon: AlertCircle,
        };
      default:
        return {
          label: status,
          style: "bg-slate-100 text-slate-700 border-slate-300",
          icon: Info,
        };
    }
  };

  const getScoreRatingStyle = (rating: string) => {
    switch (rating.toLowerCase()) {
      case "excellent":
        return {
          badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
          bar: "bg-emerald-500",
          text: "text-emerald-700",
        };
      case "good":
        return {
          badge: "bg-teal-50 text-teal-700 border-teal-200",
          bar: "bg-teal-500",
          text: "text-teal-700",
        };
      case "moderate":
        return {
          badge: "bg-amber-50 text-amber-700 border-amber-200",
          bar: "bg-amber-500",
          text: "text-amber-700",
        };
      case "weak":
        return {
          badge: "bg-orange-50 text-orange-700 border-orange-200",
          bar: "bg-orange-500",
          text: "text-orange-700",
        };
      case "inadequate":
      default:
        return {
          badge: "bg-rose-50 text-rose-700 border-rose-200",
          bar: "bg-rose-500",
          text: "text-rose-700",
        };
    }
  };

  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case "critical":
        return {
          badge: "bg-rose-50 text-rose-700 border-rose-200",
          icon: AlertCircle,
          label: "Critical",
        };
      case "high":
        return {
          badge: "bg-orange-50 text-orange-700 border-orange-200",
          icon: AlertTriangle,
          label: "High",
        };
      case "medium":
        return {
          badge: "bg-amber-50 text-amber-700 border-amber-200",
          icon: AlertTriangle,
          label: "Medium",
        };
      case "low":
        return {
          badge: "bg-blue-50 text-blue-700 border-blue-200",
          icon: Info,
          label: "Low",
        };
      case "info":
      default:
        return {
          badge: "bg-purple-50 text-purple-700 border-purple-200",
          icon: Info,
          label: "Informational",
        };
    }
  };

  const statusBadge = getStatusBadge();
  const StatusIcon = statusBadge.icon;
  const ratingStyle = getScoreRatingStyle(metrics.quality_rating);

  const handleCopyMarkdown = async () => {
    if (!summary_markdown) return;
    try {
      await navigator.clipboard.writeText(summary_markdown);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
    } catch (err) {
      console.error("Failed to copy markdown report:", err);
    }
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(results, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch (err) {
      console.error("Failed to copy JSON:", err);
    }
  };

  const handleCopyRawPolicy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedRawIndex(index);
      setTimeout(() => setCopiedRawIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy raw policy:", err);
    }
  };

  const toggleFindingExpanded = (id: string) => {
    setExpandedFindings((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Filter findings based on selected tab
  const filteredFindings = (findings || []).filter((f) => {
    if (severityFilter === "all") return true;
    return f.severity === severityFilter;
  });

  const activePolicy: CspPolicyDetail | undefined = policies[activePolicyIndex] || policies[0];

  return (
    <div className="w-full space-y-6">
      {/* 1. Header Overview & Quality Score Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusBadge.style}`}
              >
                <StatusIcon className="w-3.5 h-3.5" />
                {statusBadge.label}
              </span>

              {url && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200">
                  Target: <span className="font-mono font-semibold">{url}</span>
                  {http_status_code && ` (HTTP ${http_status_code})`}
                </span>
              )}

              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                {duration_ms} ms
              </span>
            </div>

            <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Content Security Policy Evaluation
            </h2>
            <p className="text-xs md:text-sm text-slate-600">
              Deterministic parsing under W3C CSP Level 3, fallback hierarchy mapping, and injection threat modeling.
            </p>
          </div>

          {/* Action Export Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={handleCopyMarkdown}
              disabled={!summary_markdown}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors shadow-2xs disabled:opacity-50"
              title="Copy audit report in Markdown format"
            >
              {copiedReport ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Report Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Report</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors shadow-2xs"
              title="Export complete inspection results as JSON"
            >
              {copiedJson ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">JSON Copied</span>
                </>
              ) : (
                <>
                  <FileCode className="w-3.5 h-3.5 text-slate-500" />
                  <span>Export JSON</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2. Score & Key Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 pt-6">
          {/* Quality Score Hero Metric */}
          <div className="col-span-2 bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-2xl p-4 border border-slate-200/90 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Quality Score
              </span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${ratingStyle.badge}`}
              >
                {metrics.quality_rating}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {metrics.quality_score}
              </span>
              <span className="text-xs font-medium text-slate-500">/ 100</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full ${ratingStyle.bar} transition-all duration-500`}
                style={{ width: `${Math.max(4, metrics.quality_score)}%` }}
              />
            </div>
          </div>

          {/* Metric 2: Enforcing Policies */}
          <div className="bg-slate-50/70 rounded-2xl p-3.5 border border-slate-200/70">
            <span className="text-[11px] font-semibold text-slate-500 block mb-1">
              Enforcing
            </span>
            <div className="text-xl font-bold text-slate-900">
              {metrics.enforcing_policies_count}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Header: Content-Security-Policy
            </span>
          </div>

          {/* Metric 3: Report-Only Policies */}
          <div className="bg-slate-50/70 rounded-2xl p-3.5 border border-slate-200/70">
            <span className="text-[11px] font-semibold text-slate-500 block mb-1">
              Report-Only
            </span>
            <div className="text-xl font-bold text-slate-900">
              {metrics.report_only_policies_count}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Staging / Monitoring
            </span>
          </div>

          {/* Metric 4: Directives Parsed */}
          <div className="bg-slate-50/70 rounded-2xl p-3.5 border border-slate-200/70">
            <span className="text-[11px] font-semibold text-slate-500 block mb-1">
              Directives
            </span>
            <div className="text-xl font-bold text-slate-900">
              {metrics.total_directives}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Explicit definitions
            </span>
          </div>

          {/* Metric 5: Total Findings */}
          <div className="bg-slate-50/70 rounded-2xl p-3.5 border border-slate-200/70">
            <span className="text-[11px] font-semibold text-slate-500 block mb-1">
              Findings
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900">
                {metrics.total_findings}
              </span>
              {metrics.critical_findings_count > 0 && (
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1 rounded">
                  {metrics.critical_findings_count} crit
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              {metrics.high_findings_count} high · {metrics.medium_findings_count} med
            </span>
          </div>
        </div>
      </div>

      {/* 3. Empty or Missing CSP Banner (when status == no_policy_found) */}
      {status === "no_policy_found" && (
        <div className="bg-amber-50/80 rounded-3xl border border-amber-200 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-amber-950">
                No Content Security Policy Header Discovered
              </h3>
              <p className="text-xs md:text-sm text-amber-900 leading-relaxed">
                The target server did not respond with either a{" "}
                <code className="font-mono font-semibold px-1 py-0.5 bg-amber-100 rounded">
                  Content-Security-Policy
                </code>{" "}
                or{" "}
                <code className="font-mono font-semibold px-1 py-0.5 bg-amber-100 rounded">
                  Content-Security-Policy-Report-Only
                </code>{" "}
                HTTP header. Without a CSP, the browser cannot restrict script execution, object embedding, style injection, or frame framing.
              </p>
              <div className="pt-2">
                <span className="text-xs font-semibold text-amber-950">Recommended initial step:</span>
                <p className="text-xs text-amber-900 mt-0.5">
                  Deploy a report-only header using{" "}
                  <code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-300">
                    Content-Security-Policy-Report-Only: default-src &apos;self&apos;; report-uri /csp-violation-report
                  </code>{" "}
                  to collect violation reports before enforcing restrictions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Multiple Policies Switcher (if remote returned > 1 policy) */}
      {policies.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-2 overflow-x-auto shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">
            Policies:
          </span>
          {policies.map((pol, idx) => (
            <button
              key={idx}
              onClick={() => setActivePolicyIndex(idx)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activePolicyIndex === idx
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              <span>
                {pol.policy_type === "enforce" ? "Enforcing Policy" : "Report-Only Policy"}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activePolicyIndex === idx ? "bg-indigo-700 text-indigo-100" : "bg-white text-slate-600"
                }`}
              >
                {pol.directives.length} directives
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 5. Active Policy Inspection Section */}
      {activePolicy && (
        <div className="space-y-6">
          {/* Policy Raw Code & Breakdown Header */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {activePolicy.policy_type === "enforce"
                      ? "Enforcing Policy Directives"
                      : "Report-Only Policy Directives"}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    {activePolicy.directive_count} explicit directives defined
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleCopyRawPolicy(activePolicy.raw_policy, activePolicyIndex)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 transition-colors self-start sm:self-auto"
              >
                {copiedRawIndex === activePolicyIndex ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy Raw Header</span>
                  </>
                )}
              </button>
            </div>

            {/* Raw Policy Code Display */}
            <div className="p-3.5 bg-slate-950 text-slate-200 rounded-2xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-sans font-bold tracking-wider mb-1">
                Header Value
              </div>
              <p className="break-all">{activePolicy.raw_policy}</p>
            </div>

            {/* Directive Table Component */}
            <div className="pt-2">
              <CspDirectiveTable
                directives={activePolicy.directives}
                effectiveDirectives={activePolicy.effective_directives}
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. Diagnostic Findings & Security Recommendations */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Security Findings & Actionable Remediations
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Audited against OWASP CSP guidelines and W3C CSP Level 3 bypass criteria.
            </p>
          </div>

          {/* Severity Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "all", label: "All", count: metrics.total_findings },
              { id: "critical", label: "Critical", count: metrics.critical_findings_count },
              { id: "high", label: "High", count: metrics.high_findings_count },
              { id: "medium", label: "Medium", count: metrics.medium_findings_count },
              { id: "low", label: "Low", count: metrics.low_findings_count },
              { id: "info", label: "Info", count: metrics.info_findings_count },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSeverityFilter(tab.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                  severityFilter === tab.id
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    severityFilter === tab.id
                      ? "bg-slate-700 text-white"
                      : "bg-white text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Findings List */}
        {filteredFindings.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-900">No Findings in this Category</h4>
            <p className="text-xs text-slate-500 mt-1">
              {severityFilter === "all"
                ? "No security defects or warnings detected. Your policy meets high-assurance standards."
                : `No findings matching severity "${severityFilter}".`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFindings.map((finding) => {
              const sev = getSeverityStyle(finding.severity);
              const SevIcon = sev.icon;
              const isExpanded = expandedFindings[finding.id] ?? false;

              return (
                <div
                  key={finding.id}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs transition-all hover:border-slate-300"
                >
                  {/* Finding Card Header */}
                  <div
                    onClick={() => toggleFindingExpanded(finding.id)}
                    className="p-4 md:p-5 flex items-start justify-between gap-4 cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-xl border shrink-0 mt-0.5 ${sev.badge}`}
                      >
                        <SevIcon className="w-3.5 h-3.5" />
                      </span>
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${sev.badge}`}
                          >
                            {sev.label}
                          </span>

                          {finding.directive && (
                            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-800">
                              {finding.directive}
                            </span>
                          )}

                          {finding.confidence && (
                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                              Confidence: {finding.confidence}
                            </span>
                          )}

                          {finding.is_conditional && (
                            <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                              Modern Polyfill Notice
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 leading-snug">
                          {finding.title}
                        </h4>
                      </div>
                    </div>

                    <button
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-lg shrink-0"
                      aria-label={isExpanded ? "Collapse finding" : "Expand finding"}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {/* Finding Card Body (Always visible summary + expanded details) */}
                  <div className="p-4 md:p-5 border-t border-slate-100 space-y-4">
                    {/* Explanation */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        Explanation
                      </span>
                      <p className="text-xs md:text-sm text-slate-700 leading-relaxed">
                        {finding.explanation}
                      </p>
                    </div>

                    {/* Evidence Snippet */}
                    {finding.evidence && (
                      <div>
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                          Evidence in Policy
                        </span>
                        <div className="p-2.5 bg-slate-900 text-amber-300 font-mono text-xs rounded-xl overflow-x-auto border border-slate-800">
                          {finding.evidence}
                        </div>
                      </div>
                    )}

                    {/* Expanded Detailed Sections */}
                    {isExpanded && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        {/* Security Impact */}
                        <div>
                          <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block mb-1">
                            Security Impact & Risk
                          </span>
                          <p className="text-xs md:text-sm text-slate-700 leading-relaxed bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                            {finding.security_impact}
                          </p>
                        </div>

                        {/* Actionable Recommendation */}
                        <div>
                          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                            Recommended Action
                          </span>
                          <p className="text-xs md:text-sm text-slate-700 leading-relaxed bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                            {finding.recommendation}
                          </p>
                        </div>

                        {/* Safe Example Snippet */}
                        {finding.safe_example && (
                          <div>
                            <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider block mb-1">
                              Remediated Configuration Example
                            </span>
                            <div className="p-3 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto border border-slate-800">
                              {finding.safe_example}
                            </div>
                          </div>
                        )}

                        {/* Reference Link */}
                        {finding.reference && (
                          <div className="pt-1">
                            <a
                              href={finding.reference}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                            >
                              <span>Official W3C / MDN Documentation Reference</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. Full Perimeter Security Scanner CTA Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-8 md:p-10 shadow-lg">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
            <Sparkles className="w-3.5 h-3.5" />
            Full Perimeter Security Intelligence
          </div>
          <h3 className="text-xl md:text-2xl font-bold tracking-tight text-white">
            Need comprehensive website security verification?
          </h3>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
            Content Security Policy is one layer of your defense. SiteSecura scans your full web presence across TLS/SSL cipher suites, DNSSEC, email authentication (SPF, DKIM, DMARC), HSTS, and HTTP headers in under 60 seconds.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold transition-colors shadow-sm"
            >
              <span>Run Full Perimeter Security Scan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/resources"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
            >
              Explore All Security Utilities
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
