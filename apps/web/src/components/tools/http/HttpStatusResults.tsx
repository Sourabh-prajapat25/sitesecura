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
  Network,
  Lock,
  Unlock,
} from "lucide-react";
import { HttpStatusCheckResponse, HttpRedirectHop } from "@/types";

export interface HttpStatusResultsProps {
  results: HttpStatusCheckResponse | null;
  error: string | null;
  onRetry?: () => void;
  isLoading?: boolean;
}

export function HttpStatusResults({
  results,
  error,
  onRetry,
  isLoading,
}: HttpStatusResultsProps) {
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [openHeadersStep, setOpenHeadersStep] = useState<number | null>(null);

  const getStatusBadgeStyle = (code: number | null | undefined) => {
    if (!code) return "bg-slate-100 text-slate-700 border-slate-200";
    if (code >= 200 && code < 300) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (code >= 300 && code < 400) return "bg-sky-50 text-sky-700 border-sky-200";
    if (code >= 400 && code < 500) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-rose-50 text-rose-700 border-rose-200";
  };

  const handleCopySummary = () => {
    if (!results || !navigator.clipboard) return;
    const lines: string[] = [
      `SiteSecura HTTP Status & Redirect Check Report`,
      `Requested URL: ${results.requested_url}`,
      `Final Destination: ${results.final_url}`,
      `Final Status: ${results.final_status_code || "N/A"} ${results.final_status_text || ""}`,
      `Redirect Count: ${results.redirect_count}`,
      `Total Latency: ${results.duration_ms} ms`,
      `SSL Downgrade Detected: ${results.summary.has_ssl_downgrade ? "YES (Security Risk)" : "No"}`,
      `Result Status: ${results.result_status}`,
      `----------------------------------------`,
      `Chain of Hops:`,
    ];

    results.chain.forEach((hop) => {
      lines.push(
        `[Hop #${hop.step}] ${hop.status_code} ${hop.status_text} | ${hop.url} (${hop.response_time_ms} ms)`
      );
      if (hop.location) {
        lines.push(`   Redirects to: ${hop.next_url || hop.location}`);
      }
    });

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    });
  };

  const handleCopyJson = () => {
    if (!results || !navigator.clipboard) return;
    navigator.clipboard.writeText(JSON.stringify(results, null, 2)).then(() => {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    });
  };

  if (error) {
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-rose-200/90 shadow-sm space-y-4 text-left">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">HTTP Inspection Failed</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{error}</p>
          </div>
        </div>

        {onRetry && (
          <div className="pt-2">
            <button
              onClick={onRetry}
              disabled={isLoading}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Check</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!results) {
    return null;
  }

  // Extract hostname for scanner link
  let finalDomain = "";
  try {
    const parsed = new URL(results.final_url);
    finalDomain = parsed.hostname;
  } catch {
    finalDomain = results.requested_url.replace(/https?:\/\//, "").split("/")[0];
  }

  return (
    <div className="space-y-6 text-left">
      {/* SSL Downgrade Warning Banner */}
      {results.summary.has_ssl_downgrade && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-rose-900">Insecure SSL/HTTPS Downgrade Detected</h4>
            <p className="text-xs sm:text-sm text-rose-700 leading-relaxed">
              One of the redirects in this chain routed a secure HTTPS connection to unencrypted HTTP.
              This exposes cookies, sessions, and data transmission to interception. Fix server redirection rules to ensure all requests resolve over HTTPS.
            </p>
          </div>
        </div>
      )}

      {/* Blocked or Error Result Banner */}
      {results.result_status === "blocked_redirect" && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-amber-900">Unsafe Redirect Target Blocked</h4>
            <p className="text-xs sm:text-sm text-amber-700 leading-relaxed">
              {results.message || "A redirect in the chain targeted a private IP address, loopback network, or cloud metadata service. SiteSecura blocked connection to prevent SSRF."}
            </p>
          </div>
        </div>
      )}

      {results.result_status === "redirect_loop" && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-amber-900">Redirect Loop Detected</h4>
            <p className="text-xs sm:text-sm text-amber-700 leading-relaxed">
              {results.message || "The server created a loop that continually redirects back to a previously visited URL. Web browsers will fail with ERR_TOO_MANY_REDIRECTS."}
            </p>
          </div>
        </div>
      )}

      {/* Primary Summary Overview Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                HTTP Inspection Result
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeStyle(results.final_status_code)}`}>
                {results.final_status_code ? `${results.final_status_code} ${results.final_status_text || ""}` : results.result_status.toUpperCase()}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 break-all font-mono">
              {results.final_url}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopySummary}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
            >
              {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSummary ? "Copied" : "Copy Report"}</span>
            </button>
            <button
              onClick={handleCopyJson}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
            >
              {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedJson ? "Copied" : "JSON"}</span>
            </button>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Redirect Count
            </span>
            <div className="text-lg sm:text-xl font-bold text-slate-900">
              {results.redirect_count === 0 ? "0 (Direct)" : `${results.redirect_count} ${results.redirect_count === 1 ? "Hop" : "Hops"}`}
            </div>
            <span className="text-[11px] text-slate-400">
              {results.redirect_count === 0 ? "No redirects" : "Redirect chain"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Total Latency
            </span>
            <div className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-1">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>{results.duration_ms} ms</span>
            </div>
            <span className="text-[11px] text-slate-400">
              Across all hops
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Protocol Security
            </span>
            <div className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-1.5">
              {results.summary.is_https_final ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Secure HTTPS</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span className="text-amber-700">HTTP Insecure</span>
                </>
              )}
            </div>
            <span className="text-[11px] text-slate-400">
              {results.summary.has_ssl_downgrade ? "Downgrade detected" : "Final destination"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Connected IP
            </span>
            <div className="text-sm sm:text-base font-bold font-mono text-slate-900 truncate">
              {results.chain[results.chain.length - 1]?.ip_address || "N/A"}
            </div>
            <span className="text-[11px] text-slate-400">
              Pinned TCP socket
            </span>
          </div>
        </div>
      </div>

      {/* Redirect Chain Timeline */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h4 className="text-base font-bold text-slate-900">Redirect Chain Progression</h4>
            <p className="text-xs text-slate-500">
              Detailed step-by-step breakdown of every request, response status, and Location header.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-lg text-slate-600">
            {results.chain.length} {results.chain.length === 1 ? "Step" : "Steps"}
          </span>
        </div>

        <div className="space-y-4">
          {results.chain.map((hop, idx) => {
            const isLast = idx === results.chain.length - 1;
            const isRedirect = hop.status_code >= 300 && hop.status_code < 400;
            const isHeadersOpen = openHeadersStep === hop.step;
            const headerCount = Object.keys(hop.headers).length;

            return (
              <div
                key={hop.step}
                className={`relative rounded-2xl border p-4 sm:p-5 transition-all ${
                  isLast
                    ? "bg-slate-50/70 border-slate-200"
                    : "bg-white border-slate-200/80 shadow-xs"
                }`}
              >
                {/* Header row: Step pill, Status Code, Protocol, Latency */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                      {hop.step}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeStyle(
                        hop.status_code
                      )}`}
                    >
                      {hop.status_code} {hop.status_text}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                        hop.is_https
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {hop.is_https ? (
                        <>
                          <Lock className="w-3 h-3" /> HTTPS
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3 h-3" /> HTTP
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {hop.response_time_ms} ms
                    </span>
                    {hop.ip_address && (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
                        {hop.ip_address}
                      </span>
                    )}
                  </div>
                </div>

                {/* Requested URL at this hop */}
                <div className="space-y-1.5 mb-3">
                  <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                    Requested URL
                  </div>
                  <div className="font-mono text-xs sm:text-sm text-slate-900 break-all bg-white p-2.5 rounded-xl border border-slate-200/60">
                    {hop.url}
                  </div>
                </div>

                {/* Next URL indicator for redirects */}
                {isRedirect && hop.location && (
                  <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-100 text-xs space-y-1 mb-3">
                    <div className="flex items-center gap-1.5 text-sky-800 font-semibold">
                      <ArrowRight className="w-3.5 h-3.5 text-sky-600" />
                      <span>Redirects via Location Header:</span>
                    </div>
                    <div className="font-mono text-sky-900 break-all pl-5">
                      {hop.next_url || hop.location}
                    </div>
                  </div>
                )}

                {/* Response Headers Drawer */}
                {headerCount > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setOpenHeadersStep(isHeadersOpen ? null : hop.step)}
                      className="text-xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1 transition-colors"
                    >
                      <span>
                        {isHeadersOpen ? "Hide Response Headers" : `View Response Headers (${headerCount})`}
                      </span>
                      {isHeadersOpen ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {isHeadersOpen && (
                      <div className="mt-2.5 p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs space-y-1.5 overflow-x-auto">
                        {Object.entries(hop.headers).map(([key, val]) => (
                          <div key={key} className="flex gap-2">
                            <span className="text-sky-400 font-semibold shrink-0">{key}:</span>
                            <span className="text-slate-200 break-all">{val}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cross-Sell Perimeter Scanner CTA */}
      <div className="bg-gradient-to-r from-slate-900 to-sky-950 rounded-3xl p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="space-y-1.5 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-400/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Complete Defensive Audit</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold">
            Inspect Entire Perimeter Security for {finalDomain || "Your Website"}
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            HTTP status checks verify routing, but don't inspect SSL certificate ciphers, HTTP security headers (CSP, HSTS), or email security records (SPF, DMARC). Run a full perimeter audit in 60 seconds.
          </p>
        </div>

        <Link
          href={`/tools/website-security-checker${finalDomain ? `?domain=${encodeURIComponent(finalDomain)}` : ""}`}
          className="shrink-0 px-6 py-3.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-md inline-flex items-center gap-2"
        >
          <span>Run Free Security Scan</span>
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
