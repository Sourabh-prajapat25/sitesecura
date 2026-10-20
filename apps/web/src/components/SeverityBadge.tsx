import React from "react";
import { CheckStatus, Severity } from "@/types";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, HelpCircle } from "lucide-react";

interface SeverityBadgeProps {
  status?: CheckStatus | string;
  severity?: Severity | string;
  className?: string;
}

export function SeverityBadge({ status, severity, className = "" }: SeverityBadgeProps) {
  const normStatus = (status || "").toLowerCase();
  const normSeverity = (severity || "").toLowerCase();

  if (normStatus === "pass") {
    return (
      <span
        role="status"
        aria-label="Severity: Pass"
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80 shadow-2xs ${className}`}
      >
        <span className="font-mono text-xs leading-none">✓</span>
        <span>PASS</span>
      </span>
    );
  }

  if (normStatus === "info" || normStatus === "not_applicable" || normSeverity === "info") {
    return (
      <span
        role="status"
        aria-label="Severity: Info"
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/80 shadow-2xs ${className}`}
      >
        <span className="font-mono text-xs leading-none font-bold">i</span>
        <span>INFO</span>
      </span>
    );
  }

  if (normStatus === "critical" || normSeverity === "critical") {
    return (
      <span
        role="status"
        aria-label="Severity: Critical"
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-400 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/80 shadow-2xs ${className}`}
      >
        <span className="font-mono text-xs leading-none font-black">!!</span>
        <span>CRITICAL</span>
      </span>
    );
  }

  if (normStatus === "high" || normSeverity === "high") {
    return (
      <span
        role="status"
        aria-label="Severity: High"
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-900 border border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800/80 shadow-2xs ${className}`}
      >
        <span className="font-mono text-xs leading-none font-black">!</span>
        <span>HIGH</span>
      </span>
    );
  }

  if (normStatus === "warning" || normSeverity === "medium" || normSeverity === "low") {
    return (
      <span
        role="status"
        aria-label="Severity: Warning"
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80 shadow-2xs ${className}`}
      >
        <span className="font-mono text-xs leading-none font-bold">⚠</span>
        <span>WARNING</span>
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-label="Severity: Unknown"
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 shadow-2xs ${className}`}
    >
      <span className="font-mono text-xs leading-none font-bold">?</span>
      <span>UNKNOWN</span>
    </span>
  );
}
