"use client";

import React from "react";
import { Globe, ChevronDown } from "lucide-react";
import { Website } from "@/types";

interface WebsiteBadgeSelectorProps {
  websites: Website[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}

export function WebsiteBadgeSelector({
  websites,
  selectedId,
  onSelect,
  loading = false,
}: WebsiteBadgeSelectorProps) {
  if (websites.length === 0) return null;

  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1">
        <label
          htmlFor="website-badge-select"
          className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block"
        >
          Selected Website
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Choose which website target to view, verify, or configure badges for.
        </p>
      </div>

      <div className="relative min-w-[260px] sm:max-w-xs w-full sm:w-auto">
        <div className="relative">
          <select
            id="website-badge-select"
            value={selectedId || ""}
            onChange={(e) => onSelect(e.target.value)}
            disabled={loading || websites.length === 0}
            className="w-full appearance-none bg-slate-50 dark:bg-[#0B1220] hover:bg-slate-100/80 dark:hover:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-semibold rounded-xl pl-10 pr-10 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {websites.map((w) => (
              <option key={w.id} value={w.id}>
                {w.domain} {w.name && w.name !== w.domain ? `(${w.name})` : ""}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Globe className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
