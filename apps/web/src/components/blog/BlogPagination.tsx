import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface BlogPaginationProps {
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  onPageChange: (page: number) => void;
  totalItems?: number;
}

export function BlogPagination({
  currentPage,
  totalPages,
  hasNext,
  hasPrevious,
  onPageChange,
  totalItems,
}: BlogPaginationProps) {
  if (totalPages <= 1) return null;

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav
      role="navigation"
      aria-label="Blog pagination navigation"
      className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-200/80"
    >
      <div className="text-xs text-slate-500 font-medium order-2 sm:order-1">
        Page <span className="font-semibold text-slate-800">{currentPage}</span> of{" "}
        <span className="font-semibold text-slate-800">{totalPages}</span>
        {typeof totalItems === "number" && (
          <span className="ml-1 text-slate-400">({totalItems} total guides)</span>
        )}
      </div>

      <div className="flex items-center gap-1.5 order-1 sm:order-2">
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrevious}
          aria-label="Go to previous page"
          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Numbered Page Buttons */}
        <div className="hidden sm:flex items-center gap-1 mx-1">
          {pageNumbers.map((page, idx) => {
            if (typeof page === "string") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-xs text-slate-400 select-none"
                >
                  ...
                </span>
              );
            }

            const isCurrent = page === currentPage;
            return (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                aria-current={isCurrent ? "page" : undefined}
                aria-label={`Go to page ${page}`}
                className={`min-w-[36px] h-9 px-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isCurrent
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNext}
          aria-label="Go to next page"
          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
