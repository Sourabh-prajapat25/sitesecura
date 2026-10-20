"use client";

import React from "react";
import {
  Search,
  BookOpen,
  Wrench,
  Layers,
  X,
  Globe,
  FileCode,
  Bot,
  Shield,
} from "lucide-react";

export interface CategoryOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: "all", label: "All Resources", icon: Layers },
  { id: "security", label: "Website Security", icon: Shield },
  { id: "network", label: "Network & DNS", icon: Globe },
  { id: "policy", label: "Security Configuration", icon: FileCode },
  { id: "crawlability", label: "Crawlability & SEO", icon: Bot },
  { id: "guides", label: "Guides & Learning", icon: BookOpen },
];

export interface ResourceFiltersProps {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  resultCount?: number;
  categoryCounts?: Record<string, number>;
}

export function ResourceFilters({
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  resultCount,
  categoryCounts,
}: ResourceFiltersProps) {
  const handleClearSearch = () => {
    onSearchChange("");
  };

  return (
    <div className="space-y-4 py-4 border-b border-slate-200">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Category Tabs */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none"
          role="tablist"
          aria-label="Filter resources by category"
        >
          {CATEGORY_OPTIONS.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            const count = categoryCounts ? categoryCounts[cat.id] : undefined;

            return (
              <button
                key={cat.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  isActive
                    ? "bg-sky-600 text-white shadow-sm shadow-sky-600/20"
                    : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive ? "text-white" : "text-slate-500"
                  }`}
                />
                <span>{cat.label}</span>
                {count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? "bg-sky-700 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Input & Result Count */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex-1 sm:w-80">
            <label htmlFor="resource-search-input" className="sr-only">
              Search security tools, guides, and checklists
            </label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="resource-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tools, guides, SSL, DNS, CSP..."
              className="w-full pl-9 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-3 focus:ring-sky-100 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search input"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {resultCount !== undefined && (
            <span
              className="hidden sm:inline-flex text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-2 rounded-xl whitespace-nowrap"
              aria-live="polite"
            >
              {resultCount} {resultCount === 1 ? "result" : "results"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
