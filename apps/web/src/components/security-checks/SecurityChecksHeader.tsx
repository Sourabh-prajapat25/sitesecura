"use client";

import React from "react";
import {
  Search,
  X,
  Filter,
  SlidersHorizontal,
  ChevronsDown,
  ChevronsUp,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Shield,
} from "lucide-react";

export type QuickFilterType =
  | "all"
  | "attention"
  | "pass"
  | "critical"
  | "high"
  | "warning"
  | "info";

interface SecurityChecksHeaderProps {
  totalCount: number;
  passedCount: number;
  warningCount: number;
  highCount: number;
  criticalCount: number;
  infoCount: number;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  quickFilter: QuickFilterType;
  onQuickFilterChange: (filter: QuickFilterType) => void;
  categoryFilter: string;
  onCategoryFilterChange: (category: string) => void;
  severityFilter: string;
  onSeverityFilterChange: (sev: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onExpandAllIssues: () => void;
  onCollapseAll: () => void;
}

export function SecurityChecksHeader({
  totalCount,
  passedCount,
  warningCount,
  highCount,
  criticalCount,
  infoCount,
  searchQuery,
  onSearchChange,
  quickFilter,
  onQuickFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  severityFilter,
  onSeverityFilterChange,
  statusFilter,
  onStatusFilterChange,
  onExpandAllIssues,
  onCollapseAll,
}: SecurityChecksHeaderProps) {
  const needsAttentionCount = warningCount + highCount + criticalCount;

  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
      {/* 1. TOP SUMMARY METRICS BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Security Audit Findings & Verification
            </h2>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              {totalCount} checks
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Deterministic evaluations covering transport encryption, perimeter headers, DNS integrity, and cookie flags.
          </p>
        </div>

        {/* Breakdown Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{passedCount} Passed</span>
          </span>

          {criticalCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-red-100 dark:bg-red-950/60 text-red-900 dark:text-red-200 border border-red-300 dark:border-red-800">
              <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              <span>{criticalCount} Critical</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span>0 Critical</span>
            </span>
          )}

          {highCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-orange-50 dark:bg-orange-950/50 text-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-800">
              <AlertCircle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              <span>{highCount} High</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span>0 High</span>
            </span>
          )}

          {warningCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{warningCount} Warnings</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span>0 Warnings</span>
            </span>
          )}

          {infoCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              <Info className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>{infoCount} Info</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. SEARCH & QUICK FILTER PILLS ROW */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        {/* Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onQuickFilterChange("all")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              quickFilter === "all"
                ? "bg-slate-900 dark:bg-sky-600 text-white shadow-2xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            All ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => onQuickFilterChange("attention")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
              quickFilter === "attention"
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800"
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Needs Attention ({needsAttentionCount})</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickFilterChange("pass")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
              quickFilter === "pass"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800"
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Passed ({passedCount})</span>
          </button>

          {criticalCount > 0 && (
            <button
              type="button"
              onClick={() => onQuickFilterChange("critical")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                quickFilter === "critical"
                  ? "bg-red-600 text-white shadow-2xs"
                  : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800"
              }`}
            >
              Critical ({criticalCount})
            </button>
          )}

          {highCount > 0 && (
            <button
              type="button"
              onClick={() => onQuickFilterChange("high")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                quickFilter === "high"
                  ? "bg-orange-600 text-white shadow-2xs"
                  : "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40 border border-orange-200 dark:border-orange-800"
              }`}
            >
              High ({highCount})
            </button>
          )}

          {warningCount > 0 && (
            <button
              type="button"
              onClick={() => onQuickFilterChange("warning")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                quickFilter === "warning"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800"
              }`}
            >
              Warning ({warningCount})
            </button>
          )}

          {infoCount > 0 && (
            <button
              type="button"
              onClick={() => onQuickFilterChange("info")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                quickFilter === "info"
                  ? "bg-sky-700 text-white shadow-2xs"
                  : "bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40 border border-sky-200 dark:border-sky-800"
              }`}
            >
              Info ({infoCount})
            </button>
          )}
        </div>

        {/* Live Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search security checks..."
            className="w-full pl-8.5 pr-8 py-1.5 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. MULTI-FACET DROPDOWNS & BULK EXPAND ROW */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-slate-500 font-semibold text-[11px] uppercase">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => onCategoryFilterChange(e.target.value)}
              className="bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Categories</option>
              <option value="https_ssl">HTTPS & SSL/TLS</option>
              <option value="security_headers">Security Headers</option>
              <option value="dns_email">DNS & Email Security</option>
              <option value="cookie_security">Cookie Security</option>
              <option value="server_hygiene">Server & Technology</option>
            </select>
          </div>

          {/* Severity Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-slate-500 font-semibold text-[11px] uppercase">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => onSeverityFilterChange(e.target.value)}
              className="bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium / Warning</option>
              <option value="low">Low</option>
              <option value="info">Informational</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-slate-500 font-semibold text-[11px] uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Statuses</option>
              <option value="pass">Passed</option>
              <option value="fail">Failed / Warning</option>
              <option value="unknown">Unable to Verify</option>
            </select>
          </div>
        </div>

        {/* Bulk Expand / Collapse Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExpandAllIssues}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <ChevronsDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span>Expand Issues</span>
          </button>
          <button
            type="button"
            onClick={onCollapseAll}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <ChevronsUp className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span>Collapse All</span>
          </button>
        </div>
      </div>
    </div>
  );
}
