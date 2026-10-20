"use client";

import React, { useState, useEffect } from "react";
import { List, ChevronDown, ChevronUp } from "lucide-react";
import { TocItem } from "./blogUtils";

interface ArticleTableOfContentsProps {
  items: TocItem[];
  variant?: "desktop" | "mobile" | "both";
}

export function ArticleTableOfContents({
  items,
  variant = "both",
}: ArticleTableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (items.length === 0) return;

    // Observe all headings matching item IDs
    const observer = new IntersectionObserver(
      (entries) => {
        // Find visible intersecting headings
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      {
        rootMargin: "-80px 0% -60% 0%",
        threshold: 0.1,
      }
    );

    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -90; // Header offset
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
      setActiveId(id);
      setMobileOpen(false);
      // Update hash in browser without jumping
      history.pushState(null, "", `#${id}`);
    }
  };

  const renderLinks = () => (
    <ul className="space-y-1.5 text-xs">
      {items.map((item) => {
        const isActive = activeId === item.id;
        const isH3 = item.level === 3;

        return (
          <li
            key={item.id}
            className={`${isH3 ? "ml-3.5 pl-2 border-l border-slate-200" : ""}`}
          >
            <a
              href={`#${item.id}`}
              onClick={(e) => handleLinkClick(e, item.id)}
              className={`block py-1 transition-colors leading-relaxed ${
                isActive
                  ? "text-sky-600 font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.text}
            </a>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Mobile Collapsible TOC */}
      {(variant === "both" || variant === "mobile") && (
        <div className="lg:hidden my-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="w-full flex items-center justify-between text-left font-bold text-xs uppercase tracking-wider text-slate-700 focus:outline-none"
            aria-expanded={mobileOpen}
          >
            <div className="flex items-center gap-2">
              <List className="w-4 h-4 text-sky-600" />
              <span>Table of Contents ({items.length})</span>
            </div>
            {mobileOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {mobileOpen && (
            <div className="mt-3 pt-3 border-t border-slate-200/80">
              {renderLinks()}
            </div>
          )}
        </div>
      )}

      {/* Desktop Sticky Sidebar TOC */}
      {(variant === "both" || variant === "desktop") && (
        <aside
          aria-label="Table of contents"
          className="hidden lg:block sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto w-64 xl:w-72 shrink-0 p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs"
        >
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100 font-bold text-xs uppercase tracking-wider text-slate-900">
            <List className="w-4 h-4 text-sky-600" />
            <span>Table of Contents</span>
          </div>

          <div className="overflow-y-auto pr-1">
            {renderLinks()}
          </div>
        </aside>
      )}
    </>
  );
}
