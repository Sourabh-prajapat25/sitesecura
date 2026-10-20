"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  ShieldCheck,
  Activity,
  Building2,
  ChevronLeft,
  ChevronDown,
  Menu,
  X,
  FileText,
} from "lucide-react";
import { DOC_CATEGORY_METAS, getAllArticles, DocArticle } from "./docsArticles";

interface DocsSidebarProps {
  currentCategory: string;
  currentSlug: string;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "getting-started": BookOpen,
  "security-checks": ShieldCheck,
  "monitoring": Activity,
  "agency": Building2,
};

import { DocsCommandPalette } from "./DocsCommandPalette";
import { Search } from "lucide-react";

export function DocsSidebar({ currentCategory, currentSlug }: DocsSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const allArticles = getAllArticles();

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Group articles by category
  const articlesByCategory = DOC_CATEGORY_METAS.map((cat) => ({
    ...cat,
    articles: allArticles.filter((a) => a.category === cat.slug),
  }));

  const navContent = (
    <div className="flex flex-col space-y-6">
      {/* Return to Docs Home & Search Button */}
      <div className="space-y-2">
        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-sky-600 transition-colors py-1 px-2 rounded-lg hover:bg-slate-100/80 -ml-2"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
          <span>Documentation Home</span>
        </Link>

        {/* Quick Search Palette Trigger */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-500 bg-slate-50 hover:bg-sky-50 hover:text-sky-700 border border-slate-200/80 hover:border-sky-200 rounded-xl transition-all shadow-2xs group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600" />
            <span>Search docs...</span>
          </div>
          <kbd className="text-[10px] font-semibold text-slate-400 group-hover:text-sky-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Navigation Sections */}
      <nav aria-label="Documentation Categories" className="space-y-6">
        {articlesByCategory.map((category) => {
          const IconComponent = CATEGORY_ICONS[category.slug] || BookOpen;
          const isCurrentCat = category.slug === currentCategory;

          return (
            <div key={category.id} className="space-y-2">
              {/* Category Header */}
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900 pb-1 border-b border-slate-100">
                <IconComponent className={`w-3.5 h-3.5 ${isCurrentCat ? "text-sky-600" : "text-slate-400"}`} />
                <span>{category.title}</span>
              </div>

              {/* Articles in Category */}
              <ul className="space-y-1 pl-1" aria-label={`${category.title} articles`}>
                {category.articles.map((article) => {
                  const isActive = isCurrentCat && article.slug === currentSlug;
                  return (
                    <li key={article.slug}>
                      <Link
                        href={`/docs/${article.category}/${article.slug}`}
                        onClick={() => setMobileOpen(false)}
                        className={`group flex items-start gap-2 py-1.5 px-2.5 rounded-xl text-xs font-medium transition-all ${
                          isActive
                            ? "bg-sky-50 text-sky-700 font-semibold border border-sky-100 shadow-2xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                        }`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <FileText
                          className={`w-3.5 h-3.5 mt-0.5 shrink-0 transition-colors ${
                            isActive ? "text-sky-600" : "text-slate-400 group-hover:text-slate-600"
                          }`}
                        />
                        <span className="leading-snug">{article.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Toggle */}
      <div className="lg:hidden mb-6 flex items-center justify-between bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 hover:text-sky-600 transition-colors"
          aria-expanded={mobileOpen}
          aria-controls="docs-mobile-sidebar"
        >
          {mobileOpen ? <X className="w-4 h-4 text-slate-600" /> : <Menu className="w-4 h-4 text-sky-600" />}
          <span>Documentation Menu</span>
        </button>
        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
          {DOC_CATEGORY_METAS.find((c) => c.slug === currentCategory)?.title || "Docs"}
        </span>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          id="docs-mobile-sidebar"
          className="lg:hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="w-4/5 max-w-sm bg-white h-full p-6 shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-900">Documentation</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {navContent}
          </div>
        </div>
      )}

      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-4 scrollbar-thin">
          {navContent}
        </div>
      </aside>

      {/* Keyboard Command Palette Dialog */}
      <DocsCommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </>
  );
}
