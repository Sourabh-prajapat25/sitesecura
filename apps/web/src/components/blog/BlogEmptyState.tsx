import React from "react";
import { SearchX, RotateCcw, BookOpen } from "lucide-react";

interface BlogEmptyStateProps {
  hasActiveFilters: boolean;
  activeQuery?: string | null;
  activeCategory?: string | null;
  activeTag?: string | null;
  onReset: () => void;
}

export function BlogEmptyState({
  hasActiveFilters,
  activeQuery,
  activeCategory,
  activeTag,
  onReset,
}: BlogEmptyStateProps) {
  return (
    <div className="py-20 text-center bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 space-y-5 shadow-sm max-w-2xl mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mx-auto text-sky-600 shadow-2xs">
        {hasActiveFilters ? (
          <SearchX className="w-7 h-7 text-sky-600" />
        ) : (
          <BookOpen className="w-7 h-7 text-sky-600" />
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-bold text-slate-900 tracking-tight">
          {hasActiveFilters ? "No matching security guides found" : "No guides published yet"}
        </h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          {hasActiveFilters ? (
            <>
              We couldn't find any articles matching{" "}
              {activeQuery && <span className="font-semibold text-slate-800">"{activeQuery}"</span>}
              {activeCategory && <span> in this category</span>}
              {activeTag && <span> with tag #{activeTag}</span>}. Try broadening your search or resetting filters.
            </>
          ) : (
            "Our cybersecurity engineers are currently drafting technical guides. Check back shortly for research publications."
          )}
        </p>
      </div>

      {hasActiveFilters && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset all filters</span>
          </button>
        </div>
      )}
    </div>
  );
}
