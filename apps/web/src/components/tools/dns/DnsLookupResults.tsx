"use client";

import React, { useState } from "react";
import {
  Check,
  Copy,
  Clock,
  Layers,
  Globe,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { DnsLookupResponse, DnsTypeResult, DnsRecordItem } from "@/types";

export interface DnsLookupResultsProps {
  results: DnsLookupResponse | null;
  error: string | null;
  onRetry?: () => void;
  isLoading?: boolean;
}

export function DnsLookupResults({
  results,
  error,
  onRetry,
  isLoading,
}: DnsLookupResultsProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  const handleCopySingle = (text: string, key: string) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const handleCopyAll = () => {
    if (!results || !navigator.clipboard) return;

    const lines: string[] = [];
    lines.push(`SiteSecura DNS Lookup Report`);
    lines.push(`Domain: ${results.domain}`);
    lines.push(`Queried at: ${results.queried_at}`);
    lines.push(`Duration: ${results.duration_ms} ms`);
    lines.push(`Total Records: ${results.summary.total_records}`);
    lines.push(`----------------------------------------`);

    results.results.forEach((typeResult) => {
      lines.push(`\n[${typeResult.record_type}] (${typeResult.status.toUpperCase()})`);
      if (typeResult.records.length === 0) {
        lines.push(`  ${typeResult.message || "No records returned"}`);
      } else {
        typeResult.records.forEach((rec) => {
          const ttlStr = rec.ttl !== null && rec.ttl !== undefined ? ` (TTL: ${rec.ttl}s)` : "";
          lines.push(`  ${rec.value}${ttlStr}`);
        });
      }
    });

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
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
            <h3 className="text-base font-bold text-slate-900">Lookup Request Failed</h3>
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
              <span>Retry Lookup</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!results) {
    return null;
  }

  const formatTtl = (ttl?: number | null) => {
    if (ttl === null || ttl === undefined) return "—";
    if (ttl >= 3600) {
      const hours = (ttl / 3600).toFixed(1).replace(/\.0$/, "");
      return `${ttl}s (${hours}h)`;
    }
    if (ttl >= 60) {
      const mins = (ttl / 60).toFixed(1).replace(/\.0$/, "");
      return `${ttl}s (${mins}m)`;
    }
    return `${ttl}s`;
  };

  return (
    <div className="space-y-6 text-left">
      {/* Summary Header Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-600" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-mono">
              {results.domain}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{results.duration_ms} ms</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>{results.summary.successful_types} / {results.summary.requested_types} types queried</span>
            </span>
            <span>•</span>
            <span>{results.summary.total_records} record{results.summary.total_records !== 1 ? "s" : ""} returned</span>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={handleCopyAll}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-2"
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy All Results</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Record Type Results Cards */}
      <div className="space-y-4">
        {results.results.map((typeResult) => {
          const type = typeResult.record_type;
          const status = typeResult.status;
          const count = typeResult.records.length;

          return (
            <div
              key={type}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden"
            >
              {/* Type Card Header */}
              <div className="p-4 sm:px-6 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-sm px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800 border border-sky-200/60">
                    {type}
                  </span>
                  <span className="text-xs font-semibold text-slate-600 hidden sm:inline">
                    {getTypeFriendlyName(type)}
                  </span>
                </div>

                <div>
                  {status === "success" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{count} record{count !== 1 ? "s" : ""}</span>
                    </span>
                  )}
                  {status === "no_records" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                      <span>No records found</span>
                    </span>
                  )}
                  {status === "timeout" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>Timed out</span>
                    </span>
                  )}
                  {status === "error" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                      <AlertCircle className="w-3 h-3 text-rose-600" />
                      <span>Resolver error</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Records Content */}
              <div className="p-4 sm:p-6">
                {status === "success" && count > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="pb-2.5 pr-4">Value / Record Data</th>
                          {type === "MX" && <th className="pb-2.5 px-3">Preference</th>}
                          <th className="pb-2.5 px-3 w-28">TTL</th>
                          <th className="pb-2.5 pl-3 w-16 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {typeResult.records.map((rec, rIdx) => {
                          const itemKey = `${type}-${rIdx}`;
                          const isCopied = copiedKey === itemKey;

                          return (
                            <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 pr-4 font-mono text-slate-800 text-xs sm:text-sm break-all">
                                {renderRecordValue(type, rec)}
                              </td>

                              {type === "MX" && (
                                <td className="py-3 px-3">
                                  <span className="inline-block px-2 py-0.5 bg-sky-50 text-sky-700 font-mono text-xs font-bold rounded-md border border-sky-200/60">
                                    {rec.preference ?? "—"}
                                  </span>
                                </td>
                              )}

                              <td className="py-3 px-3 text-slate-500 font-mono text-xs whitespace-nowrap">
                                {formatTtl(rec.ttl)}
                              </td>

                              <td className="py-3 pl-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleCopySingle(rec.value, itemKey)}
                                  title="Copy record value"
                                  className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 transition-all inline-flex items-center justify-center"
                                >
                                  {isCopied ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {status === "no_records" && (
                  <div className="py-4 text-center sm:text-left text-xs sm:text-sm text-slate-500 space-y-1">
                    <p className="font-medium text-slate-700">
                      No <span className="font-mono font-bold">{type}</span> records were returned by the configured resolver.
                    </p>
                    <p className="text-slate-400 text-xs">
                      {typeResult.message || "Not every domain configures this record type. This does not indicate a website issue."}
                    </p>
                  </div>
                )}

                {status === "timeout" && (
                  <div className="py-4 text-xs sm:text-sm text-amber-700 bg-amber-50/50 rounded-xl p-3 border border-amber-200/60">
                    <p className="font-semibold">Query timed out for {type} records.</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      The upstream DNS nameserver did not respond within the 2.0-second timeout window.
                    </p>
                  </div>
                )}

                {status === "error" && (
                  <div className="py-4 text-xs sm:text-sm text-rose-700 bg-rose-50/50 rounded-xl p-3 border border-rose-200/60">
                    <p className="font-semibold">Resolver error for {type} records.</p>
                    <p className="text-xs text-rose-600 mt-0.5">
                      {typeResult.message || "Authoritative nameservers failed to answer or returned SERVFAIL."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getTypeFriendlyName(type: string): string {
  switch (type) {
    case "A":
      return "IPv4 Host Address";
    case "AAAA":
      return "IPv6 Host Address";
    case "CNAME":
      return "Canonical Name Alias";
    case "MX":
      return "Mail Exchanger";
    case "NS":
      return "Authoritative Name Servers";
    case "TXT":
      return "Text / Verification Records";
    case "SOA":
      return "Start of Authority";
    case "CAA":
      return "Certificate Authority Authorization";
    default:
      return "DNS Record";
  }
}

function renderRecordValue(type: string, rec: DnsRecordItem): React.ReactNode {
  if (type === "MX" && rec.exchange) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="text-slate-900 font-semibold">{rec.exchange}</span>
      </span>
    );
  }

  if (type === "CAA" && rec.tag) {
    return (
      <div className="space-y-0.5">
        <span className="text-sky-700 font-bold">{rec.tag}</span>
        <span className="text-slate-400 mx-1.5">•</span>
        <span className="text-slate-900">{rec.value}</span>
      </div>
    );
  }

  if (type === "SOA") {
    return (
      <div className="space-y-1 text-xs">
        <div className="font-bold text-slate-900">
          Primary NS: <span className="text-sky-700 font-normal">{rec.mname || "—"}</span>
        </div>
        <div className="text-slate-600">
          Admin Email: <span className="font-normal text-slate-800">{rec.rname || "—"}</span>
        </div>
        <div className="text-slate-500 text-[11px] flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
          <span>Serial: {rec.serial ?? "—"}</span>
          <span>Refresh: {rec.refresh ? `${rec.refresh}s` : "—"}</span>
          <span>Retry: {rec.retry ? `${rec.retry}s` : "—"}</span>
          <span>Expire: {rec.expire ? `${rec.expire}s` : "—"}</span>
          <span>Min TTL: {rec.minimum ? `${rec.minimum}s` : "—"}</span>
        </div>
      </div>
    );
  }

  // TXT or default
  return <span className="break-words whitespace-pre-wrap">{rec.value}</span>;
}
