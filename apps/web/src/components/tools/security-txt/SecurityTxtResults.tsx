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
  Mail,
  Calendar,
  Key,
  Award,
  Globe,
  Briefcase,
  FileCode,
  Info,
  CheckCircle2,
  XCircle,
  Lock,
} from "lucide-react";
import { SecurityTxtValidateResponse, SecurityTxtFinding, SecurityTxtField } from "@/types";

export interface SecurityTxtResultsProps {
  results: SecurityTxtValidateResponse | null;
  error: string | null;
  onRetry?: () => void;
  isLoading?: boolean;
}

export function SecurityTxtResults({
  results,
  error,
  onRetry,
  isLoading,
}: SecurityTxtResultsProps) {
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [showRawContent, setShowRawContent] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const getValidationBadge = (status: string) => {
    switch (status) {
      case "valid":
        return {
          label: "RFC 9116 Compliant",
          style: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: ShieldCheck,
        };
      case "valid_with_warnings":
        return {
          label: "Valid with Warnings",
          style: "bg-amber-50 text-amber-700 border-amber-200",
          icon: AlertTriangle,
        };
      case "invalid":
        return {
          label: "Non-Compliant (RFC 9116)",
          style: "bg-rose-50 text-rose-700 border-rose-200",
          icon: XCircle,
        };
      case "not_found":
        return {
          label: "security.txt Not Found",
          style: "bg-slate-100 text-slate-700 border-slate-300",
          icon: AlertCircle,
        };
      default:
        return {
          label: "Retrieval Error",
          style: "bg-rose-50 text-rose-700 border-rose-200",
          icon: AlertCircle,
        };
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return {
          label: "Error",
          badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
          icon: XCircle,
        };
      case "warning":
        return {
          label: "Warning",
          badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
          icon: AlertTriangle,
        };
      case "info":
        return {
          label: "Info",
          badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
          icon: Info,
        };
      case "success":
        return {
          label: "Success",
          badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: CheckCircle2,
        };
      default:
        return {
          label: severity,
          badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
          icon: Info,
        };
    }
  };

  const handleCopyReport = () => {
    if (!results || !navigator.clipboard) return;
    const lines: string[] = [
      `SiteSecura security.txt RFC 9116 Validation Report`,
      `==================================================`,
      `Target Domain:       ${results.domain}`,
      `File URL:            ${results.target_url}`,
      `Validation Status:   ${results.validation_status.toUpperCase()}`,
      `Retrieval Status:    ${results.retrieval_status}`,
      `Location Used:       ${results.source_location || "None"}`,
      `HTTP Status:         ${results.http_status_code || "N/A"}`,
      `Content-Type:        ${results.content_type || "N/A"}`,
      `Expires At:          ${results.expires_at || "Not set / Invalid"}`,
      `Is Expired:          ${results.is_expired ? "YES" : "No"}`,
      `Checked At:          ${results.checked_at}`,
      `Execution Latency:   ${results.duration_ms} ms`,
      ``,
      `Summary Statistics:`,
      `- Directives Parsed: ${results.summary.total_fields}`,
      `- Errors:            ${results.summary.errors_count}`,
      `- Warnings:          ${results.summary.warnings_count}`,
      `- Informational:     ${results.summary.info_count}`,
      `- Has Contact:       ${results.summary.has_contact ? "Yes" : "NO"}`,
      `- Has Expires:       ${results.summary.has_expires ? "Yes" : "NO"}`,
      `- Used Fallback:     ${results.summary.used_fallback ? "YES (/security.txt)" : "No (/.well-known/)"}`,
      ``,
      `Findings (${results.findings.length}):`,
    ];

    results.findings.forEach((f, idx) => {
      lines.push(
        `[#${idx + 1}] [${f.severity.toUpperCase()}] ${f.title} (${f.code})`
      );
      if (f.line_number) lines.push(`     Line: ${f.line_number}`);
      if (f.field_name) lines.push(`     Directive: ${f.field_name}`);
      lines.push(`     Details: ${f.message}`);
      if (f.recommendation) lines.push(`     Remediation: ${f.recommendation}`);
      if (f.reference) lines.push(`     Reference: ${f.reference}`);
      lines.push(``);
    });

    if (results.fields.length > 0) {
      lines.push(`Parsed Directives (${results.fields.length}):`);
      results.fields.forEach((f) => {
        lines.push(`- Line ${f.line_number}: ${f.name}: ${f.value} [Valid: ${f.is_valid}]`);
      });
    }

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
    });
  };

  const handleCopyJson = () => {
    if (!results || !navigator.clipboard) return;
    navigator.clipboard.writeText(JSON.stringify(results, null, 2)).then(() => {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    });
  };

  const handleCopyRaw = () => {
    if (!results?.raw_content || !navigator.clipboard) return;
    navigator.clipboard.writeText(results.raw_content).then(() => {
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
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
            <h3 className="text-base font-bold text-slate-900">Validation Request Failed</h3>
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
              <span>Retry Validation</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!results) {
    return null;
  }

  const badgeInfo = getValidationBadge(results.validation_status);
  const BadgeIcon = badgeInfo.icon;

  const filteredFindings = results.findings.filter((f) => {
    if (severityFilter === "all") return true;
    return f.severity === severityFilter;
  });

  return (
    <div className="space-y-6 text-left">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Target Domain:
              </span>
              <span className="text-base sm:text-lg font-mono font-bold text-slate-900">
                {results.domain}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badgeInfo.style}`}
              >
                <BadgeIcon className="w-3.5 h-3.5" />
                <span>{badgeInfo.label}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Validated URL:</span>
              <a
                href={results.target_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sky-700 hover:underline inline-flex items-center gap-1"
              >
                <span>{results.target_url}</span>
                <ExternalLink className="w-3 h-3 text-sky-600" />
              </a>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyReport}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
              title="Copy formatted text report"
            >
              {copiedReport ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied Report</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Report</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyJson}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
              title="Copy JSON payload"
            >
              {copiedJson ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied JSON</span>
                </>
              ) : (
                <>
                  <FileCode className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2. Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Retrieval</div>
            <div className="text-sm font-bold text-slate-900 capitalize">
              {results.retrieval_status.replace(/_/g, " ")}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Location</div>
            <div className="text-xs font-mono font-bold text-slate-900 truncate" title={results.source_location || "None"}>
              {results.source_location || "Not Found"}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">HTTP Status</div>
            <div className="text-sm font-bold text-slate-900">
              {results.http_status_code ? `${results.http_status_code} OK` : "N/A"}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Directives</div>
            <div className="text-sm font-bold text-slate-900">
              {results.summary.total_fields} Parsed
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Latency</div>
            <div className="text-sm font-bold text-slate-900">
              {Math.round(results.duration_ms)} ms
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Expiration</div>
            <div className="text-xs font-bold truncate">
              {results.is_expired ? (
                <span className="text-rose-600">Expired</span>
              ) : results.days_until_expiration !== null && results.days_until_expiration !== undefined ? (
                <span className="text-emerald-700">{results.days_until_expiration}d remaining</span>
              ) : (
                <span className="text-slate-500">None</span>
              )}
            </div>
          </div>
        </div>

        {/* Fallback Location Notice if applicable */}
        {results.summary.used_fallback && (
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Legacy Fallback Location Used:</span>
              <p>
                The security.txt file was retrieved from the legacy path <code className="bg-amber-100/70 px-1 py-0.5 rounded">https://{results.domain}/security.txt</code>. RFC 9116 Section 2.5.2 mandates that the file should primarily be hosted under <code className="bg-amber-100/70 px-1 py-0.5 rounded">/.well-known/security.txt</code>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Mandatory RFC Directives Highlights (Contact & Expires) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Contact Directive Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Contact Directive</h4>
            </div>
            {results.summary.has_contact ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                <Check className="w-3 h-3" />
                Present & Valid
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                Missing (RFC Violation)
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            RFC 9116 Section 2.5.3 requires at least one Contact field with an absolute URI (mailto:, https:, or tel:).
          </p>

          <div className="space-y-1.5 pt-1">
            {results.fields.filter((f) => f.name.toLowerCase() === "contact").length > 0 ? (
              results.fields
                .filter((f) => f.name.toLowerCase() === "contact")
                .map((f, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                  >
                    <code className="text-sky-700 font-mono break-all font-semibold">{f.value}</code>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">Line {f.line_number}</span>
                  </div>
                ))
            ) : (
              <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-200 text-xs text-rose-700">
                No Contact directives were discovered in the security.txt file.
              </div>
            )}
          </div>
        </div>

        {/* Expires Directive Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Expires Directive</h4>
            </div>
            {results.summary.has_expires ? (
              results.is_expired ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Expired
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Valid Expiration
                </span>
              )
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                Missing (RFC Violation)
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            RFC 9116 Section 2.5.5 requires exactly one Expires directive specifying an RFC 3339 timestamp with timezone.
          </p>

          <div className="pt-1">
            {results.expires_at ? (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Parsed Expiration:</span>
                  <code className="text-slate-900 font-mono font-bold">{results.expires_at}</code>
                </div>
                {results.days_until_expiration !== null && results.days_until_expiration !== undefined && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Remaining Time:</span>
                    <span className={results.is_expired ? "text-rose-600 font-bold" : "text-emerald-700 font-bold"}>
                      {results.is_expired
                        ? "File has expired"
                        : `${results.days_until_expiration} days remaining`}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-200 text-xs text-rose-700">
                No valid RFC 3339 Expires directive found in the security.txt file.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Supported Directives Presence Overview */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-slate-900">
          Supported RFC 9116 Directives Checklist
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            { name: "Contact", present: results.summary.has_contact, required: true },
            { name: "Expires", present: results.summary.has_expires, required: true },
            { name: "Encryption", present: results.summary.has_encryption, required: false },
            { name: "Policy", present: results.summary.has_policy, required: false },
            { name: "Canonical", present: results.summary.has_canonical, required: false },
            { name: "Hiring", present: results.summary.has_hiring, required: false },
          ].map((item) => (
            <div
              key={item.name}
              className={`p-3 rounded-2xl border text-xs flex flex-col justify-between space-y-2 ${
                item.present
                  ? "bg-emerald-50/50 border-emerald-200/80 text-emerald-950"
                  : item.required
                  ? "bg-rose-50/50 border-rose-200/80 text-rose-950"
                  : "bg-slate-50/70 border-slate-200/80 text-slate-500"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold">{item.name}</span>
                {item.present ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : item.required ? (
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                )}
              </div>
              <span className="text-[11px] font-medium">
                {item.present
                  ? "Present"
                  : item.required
                  ? "Missing (Required)"
                  : "Not declared"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Validation Findings List */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-bold text-slate-900">
              Validation Findings & RFC Checks ({results.findings.length})
            </h4>
            <p className="text-xs text-slate-500">
              Structured evaluation against RFC 9116 syntax, field cardinality, and security requirements.
            </p>
          </div>

          {/* Severity Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
            <button
              onClick={() => setSeverityFilter("all")}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                severityFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({results.findings.length})
            </button>
            <button
              onClick={() => setSeverityFilter("error")}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                severityFilter === "error" ? "bg-white text-rose-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Errors ({results.summary.errors_count})
            </button>
            <button
              onClick={() => setSeverityFilter("warning")}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                severityFilter === "warning" ? "bg-white text-amber-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Warnings ({results.summary.warnings_count})
            </button>
            <button
              onClick={() => setSeverityFilter("info")}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                severityFilter === "info" ? "bg-white text-sky-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Info ({results.summary.info_count})
            </button>
          </div>
        </div>

        {filteredFindings.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-50 text-center text-xs text-slate-500">
            No findings matching the selected filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFindings.map((finding, idx) => {
              const sevBadge = getSeverityBadge(finding.severity);
              const SevIcon = sevBadge.icon;
              return (
                <div
                  key={`${finding.code}-${idx}`}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2.5 hover:border-slate-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${sevBadge.badgeClass}`}
                      >
                        <SevIcon className="w-3 h-3" />
                        <span>{sevBadge.label}</span>
                      </span>
                      <h5 className="text-sm font-bold text-slate-900">{finding.title}</h5>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                      {finding.field_name && (
                        <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 font-semibold">
                          {finding.field_name}
                        </span>
                      )}
                      {finding.line_number && (
                        <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700">
                          Line {finding.line_number}
                        </span>
                      )}
                      <code className="text-slate-500">{finding.code}</code>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {finding.message}
                  </p>

                  {/* Recommendation and RFC Reference */}
                  <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-t border-slate-200/60 mt-2">
                    {finding.recommendation ? (
                      <div className="text-slate-700 font-medium">
                        <span className="font-bold text-slate-900">Remediation: </span>
                        {finding.recommendation}
                      </div>
                    ) : <span />}

                    {finding.reference && (
                      <span className="text-[11px] font-mono text-sky-700 shrink-0 font-medium bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                        {finding.reference}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Parsed Directives Table */}
      {results.fields.length > 0 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-bold text-slate-900">
              Parsed Directives ({results.fields.length})
            </h4>
            <span className="text-xs text-slate-400 font-mono">
              Line-by-line syntax evaluation
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3 w-16">Line</th>
                  <th className="py-2.5 px-3 w-36">Directive</th>
                  <th className="py-2.5 px-3">Value</th>
                  <th className="py-2.5 px-3 w-28">Syntax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {results.fields.map((field, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400">{field.line_number}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{field.name}</td>
                    <td className="py-2.5 px-3 text-slate-700 break-all font-sans text-xs">
                      {field.value.startsWith("http://") || field.value.startsWith("https://") ? (
                        <a
                          href={field.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-700 hover:underline inline-flex items-center gap-1 font-mono text-xs"
                        >
                          <span>{field.value}</span>
                          <ExternalLink className="w-3 h-3 text-sky-500 shrink-0" />
                        </a>
                      ) : field.value.startsWith("mailto:") ? (
                        <a
                          href={field.value}
                          className="text-sky-700 hover:underline font-mono text-xs"
                        >
                          {field.value}
                        </a>
                      ) : (
                        <code className="text-slate-800">{field.value}</code>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {field.is_valid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-2.5 h-2.5" />
                          Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-2.5 h-2.5" />
                          Invalid
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Collapsible Raw File Content */}
      {results.raw_content && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowRawContent(!showRawContent)}
              className="flex items-center gap-2 text-sm font-bold text-slate-900 hover:text-sky-600 transition-colors"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Raw security.txt Content</span>
              {showRawContent ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showRawContent && (
              <button
                onClick={handleCopyRaw}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors inline-flex items-center gap-1"
              >
                {copiedRaw ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-400" />
                    <span>Copy Raw</span>
                  </>
                )}
              </button>
            )}
          </div>

          {showRawContent && (
            <div className="pt-2">
              <pre className="p-4 rounded-2xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-96 leading-relaxed border border-slate-800">
                {results.raw_content}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 8. Full Security Perimeter Scanner CTA Banner */}
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
              security.txt is only one facet of your defensive posture. Scan SSL/TLS certificates, HTTP security headers, DNS records, subdomains, and exposed ports in 60 seconds with SiteSecura.
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
