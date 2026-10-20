"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Clock,
  Shield,
  FileCode,
  Globe,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  Bot,
  Layers,
  ArrowUpRight,
  Code2,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  Network,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import {
  RobotsSitemapCheckResponse,
  RobotsSitemapFinding,
  SitemapDocumentResult,
} from "@/types";
import { RobotsPathSimulator } from "./RobotsPathSimulator";

export interface RobotsSitemapResultsProps {
  results: RobotsSitemapCheckResponse | null;
  error: string | null;
  isLoading: boolean;
  onRetry?: () => void;
}

export function RobotsSitemapResults({
  results,
  error,
  isLoading,
  onRetry,
}: RobotsSitemapResultsProps) {
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<string>("all");
  const [expandedSitemapIndex, setExpandedSitemapIndex] = useState<number | null>(0);
  const [showRawRobots, setShowRawRobots] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-sm space-y-6 animate-pulse text-left">
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-slate-200 rounded-lg" />
            <div className="h-4 w-72 bg-slate-100 rounded-lg" />
          </div>
          <div className="h-8 w-24 bg-slate-200 rounded-xl" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="h-4 w-20 bg-slate-200 rounded" />
              <div className="h-7 w-32 bg-slate-200 rounded-lg" />
            </div>
          ))}
        </div>

        <div className="h-48 bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-3">
          <div className="h-5 w-40 bg-slate-200 rounded" />
          <div className="h-4 w-full bg-slate-100 rounded" />
          <div className="h-4 w-3/4 bg-slate-100 rounded" />
        </div>

        <div className="text-center text-xs text-slate-400 pt-2 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
          Inspecting robots.txt, checking sitemaps, and evaluating RFC 9309 rules...
        </div>
      </div>
    );
  }

  // Error State Banner
  if (error) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-rose-200 shadow-sm text-left space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1 flex-1">
            <h3 className="text-lg font-bold text-slate-900">Check Failed</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{error}</p>
          </div>
        </div>

        {onRetry && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onRetry}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry Inspection
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!results) return null;

  const { robots, sitemap_discovery, sitemaps, summary, findings } = results;

  // Filter findings based on selected severity
  const filteredFindings = findings.filter((f) => {
    if (activeSeverityFilter === "all") return true;
    return f.severity === activeSeverityFilter;
  });

  // Copy full summary markdown report
  const handleCopyReport = () => {
    const lines = [
      `# SiteSecura Robots.txt & Sitemap Diagnostic Report`,
      `Domain: ${results.domain}`,
      `Target URL: ${results.target_url}`,
      `Timestamp: ${results.checked_at}`,
      `Duration: ${results.duration_ms.toFixed(1)} ms`,
      ``,
      `## Summary Metrics`,
      `- Robots.txt: ${robots.is_valid ? "Valid (HTTP " + (robots.http_status_code || 200) + ")" : "Not Found / Inaccessible (" + robots.retrieval_status + ")"}`,
      `- User-Agent Groups: ${summary.total_user_agent_groups}`,
      `- Disallow Directives: ${summary.total_disallow_rules}`,
      `- Allow Directives: ${summary.total_allow_rules}`,
      `- Declared Sitemaps: ${summary.sitemaps_declared_count}`,
      `- Validated Sitemaps: ${summary.sitemaps_validated_count}`,
      `- Total URLs Counted: ${summary.total_urls_discovered}`,
      `- Findings: ${summary.errors_count} Errors, ${summary.warnings_count} Warnings, ${summary.info_count} Info`,
      ``,
      `## Discovered Sitemaps`,
      ...sitemaps.map(
        (s) =>
          `- [${s.document_type.toUpperCase()}] ${s.url} (${s.validity_status}, ${s.url_count} URLs)`
      ),
      ``,
      `## Diagnostic Findings`,
      ...findings.map(
        (f) =>
          `[${f.severity.toUpperCase()}] ${f.title} (${f.code})\n${f.message}${
            f.recommendation ? "\nRecommendation: " + f.recommendation : ""
          }\n`
      ),
      ``,
      `Generated by SiteSecura (https://sitesecura.com/tools/robots-sitemap-checker)`,
    ];

    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  // Copy raw JSON
  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  // Copy raw robots.txt
  const handleCopyRaw = () => {
    if (robots.raw_content) {
      navigator.clipboard.writeText(robots.raw_content);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2500);
    }
  };

  return (
    <div className="space-y-8 text-left">
      {/* 1. Header Overview Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {results.domain}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                <Globe className="w-3.5 h-3.5 text-sky-600" />
                {results.target_url}
              </span>
              {robots.is_valid ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  RFC 9309 Valid
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  No robots.txt
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Checked: {new Date(results.checked_at).toLocaleTimeString()} UTC
              </span>
              <span>•</span>
              <span className="font-mono">{results.duration_ms.toFixed(1)} ms</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleCopyReport}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
            >
              {copiedReport ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Report Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Report</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleCopyJson}
              className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
            >
              {copiedJson ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>JSON Copied</span>
                </>
              ) : (
                <>
                  <Code2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>JSON</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: robots.txt status */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>robots.txt Status</span>
              <FileCode className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-lg font-bold text-slate-900">
              {robots.retrieval_status === "success" ? (
                <span className="text-emerald-700">200 OK</span>
              ) : robots.retrieval_status === "not_found" ? (
                <span className="text-slate-600">404 Not Found</span>
              ) : (
                <span className="text-amber-700 capitalize">{robots.retrieval_status.replace("_", " ")}</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-mono truncate">
              {robots.content_length ? `${(robots.content_length / 1024).toFixed(1)} KB` : "0 KB"} • {robots.effective_url || robots.requested_url}
            </div>
          </div>

          {/* Card 2: User-Agent Groups */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Directive Groups</span>
              <Bot className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-lg font-bold text-slate-900">
              {summary.total_user_agent_groups} <span className="text-xs font-normal text-slate-500">groups</span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-2">
              <span className="text-emerald-700 font-semibold">{summary.total_allow_rules} Allows</span>
              <span>•</span>
              <span className="text-rose-700 font-semibold">{summary.total_disallow_rules} Disallows</span>
            </div>
          </div>

          {/* Card 3: Discovered Sitemaps */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Sitemaps Validated</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-lg font-bold text-slate-900">
              {summary.sitemaps_validated_count} <span className="text-xs font-normal text-slate-500">of {summary.sitemaps_discovered_count}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              {summary.sitemaps_declared_count} declared in robots.txt
            </div>
          </div>

          {/* Card 4: Total URLs Discovered */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Total URLs Counted</span>
              <Globe className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono">
              {summary.total_urls_discovered.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500">
              {sitemaps.length > 0 ? `Across ${sitemaps.length} parsed sitemaps` : "No sitemaps parsed"}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Diagnostic Findings Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-sky-600" />
              Diagnostic Findings & Standards Analysis
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated compliance checks evaluated against RFC 9309 and Sitemaps.org XML standards.
            </p>
          </div>

          {/* Severity Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveSeverityFilter("all")}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                activeSeverityFilter === "all"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({findings.length})
            </button>
            {summary.errors_count > 0 && (
              <button
                type="button"
                onClick={() => setActiveSeverityFilter("error")}
                className={`px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  activeSeverityFilter === "error"
                    ? "bg-rose-100 text-rose-800 shadow-2xs"
                    : "text-rose-600 hover:text-rose-800"
                }`}
              >
                Errors ({summary.errors_count})
              </button>
            )}
            {summary.warnings_count > 0 && (
              <button
                type="button"
                onClick={() => setActiveSeverityFilter("warning")}
                className={`px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  activeSeverityFilter === "warning"
                    ? "bg-amber-100 text-amber-800 shadow-2xs"
                    : "text-amber-600 hover:text-amber-800"
                }`}
              >
                Warnings ({summary.warnings_count})
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveSeverityFilter("info")}
              className={`px-2 py-1 rounded-lg transition-colors ${
                activeSeverityFilter === "info"
                  ? "bg-sky-100 text-sky-800 shadow-2xs"
                  : "text-sky-600 hover:text-sky-800"
              }`}
            >
              Info ({summary.info_count})
            </button>
          </div>
        </div>

        {/* Findings List */}
        <div className="space-y-3">
          {filteredFindings.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-500">
              No findings match the selected filter.
            </div>
          ) : (
            filteredFindings.map((finding, idx) => {
              const isErr = finding.severity === "error";
              const isWarn = finding.severity === "warning";
              const isSucc = finding.severity === "success";

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border text-xs space-y-2 transition-all ${
                    isErr
                      ? "bg-rose-50/60 border-rose-200"
                      : isWarn
                      ? "bg-amber-50/60 border-amber-200"
                      : isSucc
                      ? "bg-emerald-50/60 border-emerald-200"
                      : "bg-slate-50/70 border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isErr ? (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      ) : isWarn ? (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : isSucc ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Info className="w-4 h-4 text-sky-600 shrink-0" />
                      )}
                      <span className="font-bold text-slate-900 text-sm">
                        {finding.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wide ${
                          isErr
                            ? "bg-rose-200/80 text-rose-900"
                            : isWarn
                            ? "bg-amber-200/80 text-amber-900"
                            : isSucc
                            ? "bg-emerald-200/80 text-emerald-900"
                            : "bg-sky-200/80 text-sky-900"
                        }`}
                      >
                        {finding.severity}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-white border border-slate-200">
                        {finding.code}
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-700 leading-relaxed pl-6">
                    {finding.message}
                  </p>

                  {finding.affected_item && (
                    <div className="pl-6 text-[11px] font-mono text-slate-600">
                      <span className="text-slate-400">Target:</span> {finding.affected_item}
                    </div>
                  )}

                  {finding.recommendation && (
                    <div className="pl-6 pt-1 text-slate-700 flex items-start gap-1.5">
                      <span className="font-bold text-slate-900 shrink-0">Action:</span>
                      <span>{finding.recommendation}</span>
                    </div>
                  )}

                  {finding.reference && (
                    <div className="pl-6 pt-0.5 text-[11px] text-slate-500 italic">
                      Standard Reference: {finding.reference}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Parsed User-Agent Directive Groups */}
      {robots.groups.length > 0 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bot className="w-5 h-5 text-sky-600" />
              Parsed RFC 9309 Directive Groups ({robots.groups.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Directives grouped by declared crawler user-agents with Allow and Disallow rules.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {robots.groups.map((group, idx) => (
              <div
                key={idx}
                className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200 space-y-3"
              >
                {/* User Agent Header */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500">User-agent:</span>
                    {group.user_agents.map((ua) => (
                      <span
                        key={ua}
                        className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-white text-slate-900 border border-slate-300 shadow-2xs"
                      >
                        {ua}
                      </span>
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Group #{idx + 1}
                  </span>
                </div>

                {/* Allow Directives */}
                {group.allows.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                      Allow Directives ({group.allows.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.allows.map((allow, aIdx) => (
                        <span
                          key={aIdx}
                          className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/90"
                        >
                          {allow || "/"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disallow Directives */}
                {group.disallows.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">
                      Disallow Directives ({group.disallows.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.disallows.map((disallow, dIdx) => (
                        <span
                          key={dIdx}
                          className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-rose-50 text-rose-800 border border-rose-200/90"
                        >
                          {disallow === "" ? "(empty - allows all)" : disallow}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Directives (e.g. Crawl-delay) */}
                {Object.keys(group.other_directives).length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-200 text-xs">
                    <div className="text-[11px] font-semibold text-slate-500">
                      Non-standard Directives:
                    </div>
                    {Object.entries(group.other_directives).map(([k, v]) => (
                      <div key={k} className="font-mono text-slate-700">
                        {k}: {v}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Interactive RFC 9309 Path Simulator */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            Interactive Crawler Simulator
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Validate whether search engine crawlers are allowed or blocked for any specific path using RFC 9309 rules.
          </p>
        </div>

        <RobotsPathSimulator groups={robots.groups} />
      </div>

      {/* 5. Sitemaps Inspection Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-600" />
              Sitemaps Discovery & Validation ({sitemaps.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              XML sitemaps parsed, validated, and indexed under Sitemaps.org specifications.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            {sitemap_discovery.conventional_checked && (
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                /sitemap.xml: {sitemap_discovery.conventional_found ? "Discovered" : "Not Found"}
              </span>
            )}
          </div>
        </div>

        {/* Skipped External Sitemaps Notice */}
        {sitemap_discovery.external_urls_skipped.length > 0 && (
          <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl text-xs space-y-1.5">
            <div className="font-bold text-sky-900 flex items-center gap-1.5">
              <Network className="w-4 h-4 text-sky-600" />
              External Sitemaps Skipped Under Safe-Origin Policy (SSRF Protection)
            </div>
            <p className="text-sky-700 leading-relaxed">
              The following declared sitemaps point to external third-party domains. SiteSecura adheres to strict safe-origin security controls and does not fetch cross-origin documents:
            </p>
            <ul className="list-disc list-inside font-mono text-[11px] text-sky-800 space-y-0.5">
              {sitemap_discovery.external_urls_skipped.map((extUrl, i) => (
                <li key={i}>{extUrl}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Sitemap Documents List */}
        {sitemaps.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 text-sm text-slate-500 space-y-2">
            <FileCode className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="font-semibold text-slate-700">No XML sitemaps discovered.</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No 'Sitemap:' directives were declared in robots.txt, and '/sitemap.xml' did not return a valid sitemap document.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sitemaps.map((sm, smIdx) => {
              const isExpanded = expandedSitemapIndex === smIdx;
              const isIndex = sm.document_type === "sitemapindex";
              const isValid = sm.validity_status === "valid";

              return (
                <div
                  key={smIdx}
                  className="bg-slate-50/60 rounded-2xl border border-slate-200 overflow-hidden"
                >
                  {/* Sitemap Header Row */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 truncate max-w-md">
                          {sm.url}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
                            isIndex
                              ? "bg-purple-100 text-purple-800"
                              : "bg-sky-100 text-sky-800"
                          }`}
                        >
                          {isIndex ? "SITEMAP INDEX" : "URL SET"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                            isValid
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {sm.validity_status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Source: {sm.source}</span>
                        <span>•</span>
                        <span>HTTP {sm.http_status_code || 200}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-700">
                          {isIndex
                            ? `${sm.child_sitemap_count} Child Sitemaps`
                            : `${sm.url_count} URLs`}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSitemapIndex(isExpanded ? null : smIdx)
                      }
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      {isExpanded ? (
                        <>
                          <span>Collapse</span>
                          <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          <span>Inspect URLs</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Expanded URLs & Child Sitemaps */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 border-t border-slate-200 space-y-4 text-xs">
                      {/* If Sitemap Index: List Child Sitemaps */}
                      {isIndex && sm.child_sitemaps.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-purple-600" />
                            Child Sitemaps ({sm.child_sitemaps.length})
                          </h5>
                          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto">
                            {sm.child_sitemaps.map((childUrl, cIdx) => (
                              <div
                                key={cIdx}
                                className="px-3 py-2 font-mono text-[11px] text-slate-700 flex items-center justify-between"
                              >
                                <span>{childUrl}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* If URL Set: Sample URLs Table */}
                      {!isIndex && sm.sample_urls.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h5 className="font-bold text-slate-800 text-xs">
                              Sample URLs ({Math.min(sm.sample_urls.length, 100)} shown)
                            </h5>
                            <span className="text-[11px] text-slate-400">
                              Total: {sm.url_count}
                            </span>
                          </div>
                          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto max-h-64 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                                <tr>
                                  <th className="px-3 py-2">Location (&lt;loc&gt;)</th>
                                  <th className="px-3 py-2">Lastmod</th>
                                  <th className="px-3 py-2">Changefreq</th>
                                  <th className="px-3 py-2">Priority</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                {sm.sample_urls.map((item, uIdx) => (
                                  <tr key={uIdx} className="hover:bg-slate-50/80">
                                    <td className="px-3 py-1.5 text-slate-800 truncate max-w-sm">
                                      {item.loc}
                                    </td>
                                    <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">
                                      {item.lastmod || "-"}
                                    </td>
                                    <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">
                                      {item.changefreq || "-"}
                                    </td>
                                    <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">
                                      {item.priority !== null && item.priority !== undefined
                                        ? item.priority.toFixed(1)
                                        : "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Raw robots.txt Viewer */}
      {robots.raw_content && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-600" />
                Raw robots.txt Source
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Exact unmodified content retrieved over HTTPS from {robots.effective_url || robots.requested_url}.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyRaw}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {copiedRaw ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy Raw</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowRawRobots(!showRawRobots)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {showRawRobots ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {showRawRobots && (
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto leading-relaxed">
              <pre>{robots.raw_content}</pre>
            </div>
          )}
        </div>
      )}

      {/* 7. Full Perimeter Scanner CTA Banner */}
      <div className="bg-gradient-to-br from-slate-900 to-sky-950 rounded-3xl p-6 sm:p-8 text-white space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-400/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Comprehensive Website Assessment</span>
            </div>
            <h4 className="text-lg sm:text-xl font-bold">
              Run Complete Security Perimeter Scan for {results.domain}
            </h4>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              robots.txt and sitemaps only define crawler visibility. Scan SSL/TLS certificates, HTTP security headers, DNS records, subdomains, and exposed ports in 60 seconds with SiteSecura.
            </p>
          </div>

          <Link
            href={`/?domain=${encodeURIComponent(results.domain)}`}
            className="px-6 py-3 bg-[#087FE8] hover:bg-sky-500 text-white rounded-2xl font-bold text-sm transition-all shadow-md inline-flex items-center justify-center gap-2 shrink-0 group self-start sm:self-auto"
          >
            <span>Scan Entire Perimeter</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
