import React from "react";
import { Tag as TagIcon, X, Filter } from "lucide-react";
import { BlogCategory, BlogTag } from "@/types";

interface BlogFiltersProps {
  categories: BlogCategory[];
  tags: BlogTag[];
  activeCategory: string | null;
  activeTag: string | null;
  activeQuery: string | null;
  onSelectCategory: (slug: string | null) => void;
  onSelectTag: (slug: string | null) => void;
  onClearQuery: () => void;
  onClearAll: () => void;
}

export function BlogFilters({
  categories,
  tags,
  activeCategory,
  activeTag,
  activeQuery,
  onSelectCategory,
  onSelectTag,
  onClearQuery,
  onClearAll,
}: BlogFiltersProps) {
  const hasActiveFilters = Boolean(activeQuery || activeCategory || activeTag);
  const activeCategoryObj = categories.find((c) => c.slug === activeCategory);
  const activeTagObj = tags.find((t) => t.slug === activeTag);

  return (
    <div className="space-y-4">
      {/* Category Pills Navigation */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-slate-400" />
            Categories
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200">
          <button
            type="button"
            onClick={() => onSelectCategory(null)}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              !activeCategory
                ? "bg-slate-900 text-white font-semibold shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            All Guides
          </button>
          {categories.map((cat) => {
            const isActive = activeCategory === cat.slug;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(isActive ? null : cat.slug)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? "bg-sky-600 text-white font-semibold shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tag Chips Row */}
      {tags.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <TagIcon className="w-3 h-3 text-slate-400" />
            Popular Topics
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.slice(0, 12).map((t) => {
              const isSelected = activeTag === t.slug;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTag(isSelected ? null : t.slug)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all ${
                    isSelected
                      ? "bg-emerald-600 text-white font-semibold shadow-sm"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <span>#{t.name}</span>
                  {isSelected && <X className="w-3 h-3 ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Filter Pills Indicator */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-medium">Active filters:</span>

          {activeQuery && (
            <span className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 px-2.5 py-1 rounded-md font-medium border border-sky-200 shadow-2xs">
              <span>Query: "{activeQuery}"</span>
              <button
                type="button"
                onClick={onClearQuery}
                aria-label="Remove search filter"
                className="hover:text-sky-900 focus:outline-none"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {activeCategory && (
            <span className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 px-2.5 py-1 rounded-md font-medium border border-sky-200 shadow-2xs">
              <span>Category: {activeCategoryObj?.name || activeCategory}</span>
              <button
                type="button"
                onClick={() => onSelectCategory(null)}
                aria-label="Remove category filter"
                className="hover:text-sky-900 focus:outline-none"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {activeTag && (
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md font-medium border border-emerald-200 shadow-2xs">
              <span>Tag: #{activeTagObj?.name || activeTag}</span>
              <button
                type="button"
                onClick={() => onSelectTag(null)}
                aria-label="Remove tag filter"
                className="hover:text-emerald-900 focus:outline-none"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 ml-auto transition-colors"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
