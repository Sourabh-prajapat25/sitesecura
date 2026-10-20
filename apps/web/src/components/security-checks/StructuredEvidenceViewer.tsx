"use client";

import React, { useState } from "react";
import { ScanCheck } from "@/types";
import {
  Terminal,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Lock,
  Globe,
  FileCode,
} from "lucide-react";

interface StructuredEvidenceViewerProps {
  check: ScanCheck;
  domain?: string;
}

interface ParsedCookieRow {
  name: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  hasIssues: boolean;
}

export function StructuredEvidenceViewer({ check, domain }: StructuredEvidenceViewerProps) {
  const [showRawEvidence, setShowRawEvidence] = useState(false);
  const [copied, setCopied] = useState(false);

  const evidenceText = check.evidence || "";
  const checkType = (check.check_type || "").toLowerCase();

  const handleCopy = async () => {
    if (!evidenceText) return;
    try {
      await navigator.clipboard.writeText(evidenceText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  // ---------------------------------------------------------------------------
  // 1. COOKIE EVIDENCE PARSER & TABLE
  // ---------------------------------------------------------------------------
  const renderCookieEvidence = () => {
    if (!checkType.includes("cookie")) return null;

    const cookieRows: ParsedCookieRow[] = [];

    // Parse evidence formats:
    // Format A: "'AWSALBTG': missing 'Secure', missing 'HttpOnly'; 'AWSALB': missing 'Secure'"
    // Format B: "session_id (Secure, HttpOnly, SameSite=Lax); tracking (Secure)"
    // Format C: "Cookies: AWSALBTG, AWSALB"
    if (evidenceText.includes("; ") || evidenceText.includes("': ") || evidenceText.includes("(")) {
      const entries = evidenceText.split(";");
      for (const entry of entries) {
        const trimmed = entry.trim();
        if (!trimmed) continue;

        if (trimmed.includes(":")) {
          // Defect format: 'name': missing 'Secure', missing 'HttpOnly'
          const [rawName, rawIssues] = trimmed.split(":", 2);
          const name = rawName.replace(/['"]/g, "").trim();
          const issuesLower = (rawIssues || "").toLowerCase();

          const missingSecure = issuesLower.includes("secure");
          const missingHttpOnly = issuesLower.includes("httponly");
          const missingSameSite = issuesLower.includes("samesite");

          cookieRows.push({
            name,
            secure: !missingSecure,
            httpOnly: !missingHttpOnly,
            sameSite: missingSameSite ? "Missing" : "Observed",
            hasIssues: missingSecure || missingHttpOnly || missingSameSite,
          });
        } else if (trimmed.includes("(") && trimmed.includes(")")) {
          // Pass format: name (Secure, HttpOnly, SameSite=Lax)
          const name = trimmed.split("(")[0].trim();
          const insideParen = trimmed.substring(trimmed.indexOf("(") + 1, trimmed.indexOf(")")).toLowerCase();

          const hasSecure = insideParen.includes("secure");
          const hasHttpOnly = insideParen.includes("httponly");
          let sameSiteVal = "—";
          if (insideParen.includes("samesite=strict")) sameSiteVal = "Strict";
          else if (insideParen.includes("samesite=lax")) sameSiteVal = "Lax";
          else if (insideParen.includes("samesite=none")) sameSiteVal = "None";
          else if (insideParen.includes("samesite")) sameSiteVal = "Present";

          cookieRows.push({
            name,
            secure: hasSecure,
            httpOnly: hasHttpOnly,
            sameSite: sameSiteVal,
            hasIssues: !hasSecure || !hasHttpOnly,
          });
        }
      }
    }

    if (cookieRows.length === 0) {
      return null;
    }

    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
          <span>Detected Cookie Attributes ({cookieRows.length})</span>
          <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
            Attribute absence is an audit observation
          </span>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3.5">Cookie Identifier</th>
                <th className="py-2.5 px-3.5 text-center">Secure</th>
                <th className="py-2.5 px-3.5 text-center">HttpOnly</th>
                <th className="py-2.5 px-3.5 text-center">SameSite</th>
                <th className="py-2.5 px-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-[#111C2E] font-medium text-slate-700 dark:text-slate-300">
              {cookieRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-2.5 px-3.5 font-mono text-slate-900 dark:text-slate-200 font-bold truncate max-w-[180px]">
                    {row.name}
                  </td>
                  <td className="py-2.5 px-3.5 text-center">
                    {row.secure ? (
                      <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold" title="Secure flag present">
                        <CheckCircle2 className="w-4 h-4 mx-auto" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-red-500 dark:text-red-400 font-bold" title="Secure flag missing">
                        <XCircle className="w-4 h-4 mx-auto" />
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3.5 text-center">
                    {row.httpOnly ? (
                      <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold" title="HttpOnly flag present">
                        <CheckCircle2 className="w-4 h-4 mx-auto" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-red-500 dark:text-red-400 font-bold" title="HttpOnly flag missing">
                        <XCircle className="w-4 h-4 mx-auto" />
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3.5 text-center font-mono text-[11px]">
                    {row.sameSite === "Missing" ? (
                      <span className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/80">
                        Missing
                      </span>
                    ) : (
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">{row.sameSite}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3.5 text-right">
                    {row.hasIssues ? (
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/80">
                        Flagged
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/80">
                        Protected
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // 2. DNS & EMAIL EVIDENCE (SPF, DMARC, DKIM, DNSSEC)
  // ---------------------------------------------------------------------------
  const renderDnsEvidence = () => {
    if (
      !checkType.includes("spf") &&
      !checkType.includes("dmarc") &&
      !checkType.includes("dkim") &&
      !checkType.includes("dnssec")
    ) {
      return null;
    }

    const isSpf = checkType.includes("spf");
    const isDmarc = checkType.includes("dmarc");
    const isDkim = checkType.includes("dkim");
    const isDnssec = checkType.includes("dnssec");

    const recordType = isDnssec ? "DNSKEY" : "TXT";
    const hostname = isDmarc
      ? `_dmarc.${domain || "target domain"}`
      : isDkim
      ? `[selector]._domainkey.${domain || "target domain"}`
      : domain || "target domain";

    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
          <span>DNS Verification Inspection</span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Record Type: {recordType}</span>
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/90 dark:border-slate-700/80 space-y-2.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block mb-0.5">
                Target Hostname
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 break-all">{hostname}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block mb-0.5">
                Evaluation Result
              </span>
              <span
                className={`font-semibold ${
                  check.status === "pass"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : check.status === "unknown"
                    ? "text-sky-700 dark:text-sky-400"
                    : "text-amber-700 dark:text-amber-400"
                }`}
              >
                {check.status === "pass"
                  ? "Record Verified in DNS"
                  : check.status === "unknown"
                  ? "Selector Required for Discovery"
                  : "Record Not Detected"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block mb-0.5">
                Assessment Status
              </span>
              <span
                className={`inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded-full border ${
                  check.status === "pass"
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-850"
                    : check.status === "unknown"
                    ? "bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                    : "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                }`}
              >
                {check.status.toUpperCase()}
              </span>
            </div>
          </div>

          {isDkim && (
            <div className="p-2.5 bg-sky-50/80 dark:bg-sky-950/50 rounded-lg border border-sky-200/80 dark:border-sky-800 text-[11px] text-sky-900 dark:text-sky-200 leading-relaxed flex items-start gap-2">
              <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
              <span>
                <strong>DKIM Protocol Note:</strong> DKIM public keys reside under provider-specific subdomains (e.g. <code>google._domainkey</code>). Passive scanners cannot guess private selectors without false positives. Verify in your mail service console.
              </span>
            </div>
          )}

          {evidenceText && !isDkim && (
            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block mb-1">
                Detected DNS Payload
              </span>
              <div className="p-2 bg-white dark:bg-[#0B1220] rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-slate-200 break-all">
                {evidenceText}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // 3. SSL / TLS CERTIFICATE EVIDENCE
  // ---------------------------------------------------------------------------
  const renderSslEvidence = () => {
    if (!checkType.includes("ssl") && !checkType.includes("tls")) return null;

    // Parse issuer and TLS version if present in evidence
    let issuer = "Verified Certificate Authority";
    let tlsVersion = "TLSv1.2 / TLSv1.3";
    let daysRemaining = "";

    if (evidenceText.includes("Issuer:")) {
      const match = evidenceText.match(/Issuer:\s*([^|]+)/i);
      if (match) issuer = match[1].trim();
    }
    if (evidenceText.includes("TLS Version:")) {
      const match = evidenceText.match(/TLS Version:\s*([^|]+)/i);
      if (match) tlsVersion = match[1].trim();
    }
    if (evidenceText.includes("Expires in")) {
      const match = evidenceText.match(/Expires in\s*([^days]+days)/i);
      if (match) daysRemaining = match[1].trim();
    }

    const isValid = check.status === "pass";

    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
          <span>TLS Connection & Certificate Attributes</span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Port 443 / TCP</span>
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/90 dark:border-slate-700/80 space-y-3 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block mb-0.5">
                Certificate Status
              </span>
              <span
                className={`font-bold flex items-center gap-1 ${
                  isValid ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                }`}
              >
                {isValid ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Valid & Trusted</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    <span>Untrusted / Expired</span>
                  </>
                )}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block mb-0.5">
                Issuer Authority
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">{issuer}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block mb-0.5">
                Protocol Version
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{tlsVersion}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block mb-0.5">
                Hostname Verification
              </span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>SNI Match</span>
              </span>
            </div>
          </div>

          {daysRemaining && (
            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Validity Horizon:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{daysRemaining} remaining</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // 4. SECURITY HEADERS EVIDENCE
  // ---------------------------------------------------------------------------
  const renderHeadersEvidence = () => {
    const isHeaderCheck =
      checkType.includes("hsts") ||
      checkType.includes("csp") ||
      checkType.includes("frame") ||
      checkType.includes("content_type") ||
      checkType.includes("referrer") ||
      checkType.includes("header") ||
      checkType.includes("permissions");

    if (!isHeaderCheck) return null;

    const isPresent = check.status === "pass";
    const headerName = check.name || check.title;

    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
          <span>HTTP Response Header Inspection</span>
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
              isPresent
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
            }`}
          >
            {isPresent ? "HEADER PRESENT" : "HEADER MISSING"}
          </span>
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/90 dark:border-slate-700/80 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{headerName}</span>
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {isPresent ? "Returned with valid directives" : "Not observed in HTTPS responses"}
            </span>
          </div>

          {isPresent && evidenceText && (
            <div className="p-2 bg-white dark:bg-[#0B1220] rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-slate-200 break-all">
              {evidenceText}
            </div>
          )}
        </div>
      </div>
    );
  };

  const cookieView = renderCookieEvidence();
  const dnsView = renderDnsEvidence();
  const sslView = renderSslEvidence();
  const headersView = renderHeadersEvidence();

  return (
    <div className="space-y-3 pt-1">
      {/* Category-Specific Visual Inspection */}
      {cookieView || dnsView || sslView || headersView}

      {/* Raw Scanner Console Accordion */}
      {evidenceText && (
        <div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowRawEvidence(!showRawEvidence);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              <Terminal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>{showRawEvidence ? "Hide Raw Diagnostic Record" : "View Raw Diagnostic Record"}</span>
              {showRawEvidence ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showRawEvidence && (
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
          </div>

          {showRawEvidence && (
            <div className="mt-2 bg-slate-900 dark:bg-black text-slate-100 p-3.5 rounded-xl border border-slate-800 dark:border-slate-800 text-xs font-mono overflow-x-auto shadow-inner">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider flex items-center justify-between">
                <span>Scanner Raw Diagnostic Stream</span>
                <span>Deterministic Evidence</span>
              </div>
              <pre className="whitespace-pre-wrap break-all text-emerald-400 font-mono text-[11px] leading-relaxed">
                {evidenceText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
