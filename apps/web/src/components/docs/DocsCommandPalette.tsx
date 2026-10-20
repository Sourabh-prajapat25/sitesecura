"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  BookOpen,
  ArrowRight,
  FileCode,
  Wrench,
  Clock,
  CornerDownLeft,
  Sparkles,
} from "lucide-react";
import { searchDocumentation, SearchResultItem } from "@/lib/docs/docsSearchIndex";

interface DocsCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DocsCommandPalette({ isOpen, onClose }: DocsCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Update search results when query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }
    const found = searchDocumentation(query, { limit: 8 });
    setResults(found);
    setSelectedIndex(0);
  }, [query]);

  // Focus management & scroll locking
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      document.body.style.overflow = "";
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
      setQuery("");
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSelectResult = useCallback(
    (item: SearchResultItem) => {
      const destination = item.matchedAnchor
        ? `${item.entry.href}#${item.matchedAnchor}`
        : item.entry.href;

      onClose();
      router.push(destination);
    },
    [onClose, router]
  );

  // Keyboard navigation within the palette
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (results.length > 0 && results[selectedIndex]) {
          handleSelectResult(results[selectedIndex]);
        }
      }
    },
    [onClose, results, selectedIndex, handleSelectResult]
  );

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Documentation search palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/40 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header / Search Input */}
        <div className="relative flex items-center border-b border-slate-100 px-4 py-3 sm:py-3.5">
          <Search className="w-5 h-5 text-slate-400 shrink-0 ml-1" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guides, headers (HSTS, CSP), records (SPF, DMARC), scores..."
            className="w-full px-3 py-1.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="palette-results-list"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 mr-2"
              aria-label="Clear query"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2" id="palette-results-list" role="listbox">
          {query.trim().length > 0 ? (
            results.length > 0 ? (
              <div className="space-y-1">
                {results.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={`${item.entry.id}-${idx}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectResult(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`group p-3.5 rounded-2xl cursor-pointer transition-all flex flex-col gap-1.5 ${
                        isSelected
                          ? "bg-sky-50 text-sky-950 border border-sky-100 shadow-2xs"
                          : "hover:bg-slate-50 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              isSelected
                                ? "bg-sky-100 text-sky-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {item.entry.categoryTitle}
                          </span>
                          {item.matchedHeading && (
                            <span className="text-[11px] font-medium text-slate-400 truncate max-w-xs">
                              in {item.matchedHeading}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {item.entry.readTimeMinutes && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{item.entry.readTimeMinutes}m</span>
                            </span>
                          )}
                          <CornerDownLeft
                            className={`w-3.5 h-3.5 transition-opacity ${
                              isSelected ? "opacity-100 text-sky-600" : "opacity-0"
                            }`}
                          />
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <h4
                          className={`text-sm font-bold leading-snug ${
                            isSelected ? "text-sky-900" : "text-slate-900"
                          }`}
                        >
                          {item.entry.title}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {item.excerpt}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm font-bold text-slate-900">
                  No documentation matches for &ldquo;{query}&rdquo;
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Try searching for a header like &ldquo;HSTS&rdquo;, &ldquo;CSP&rdquo;, or &ldquo;DMARC&rdquo;, or browse documentation categories.
                </p>
              </div>
            )
          ) : (
            /* Empty Query: Quick suggestions */
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                <span>Popular Technical Searches</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  "HSTS",
                  "Content-Security-Policy",
                  "X-Frame-Options",
                  "DMARC",
                  "SPF Record",
                  "SSL Expiration",
                  "Cookie Flags",
                  "Security Scores",
                  "Nginx Headers",
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setQuery(tag)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-sky-700 border border-slate-200/80 hover:border-sky-200 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-semibold font-mono">
                ↑
              </kbd>{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-semibold font-mono">
                ↓
              </kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-semibold font-mono">
                ↵
              </kbd>{" "}
              select
            </span>
          </div>
          <span>SiteSecura Full-Text Search</span>
        </div>
      </div>
    </div>
  );
}
