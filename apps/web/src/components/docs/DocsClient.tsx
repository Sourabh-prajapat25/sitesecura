"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  X,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Shield,
  Layers,
  Wrench,
  CheckCircle2,
} from "lucide-react";
import {
  DOC_CATEGORIES,
  FEATURED_DOCS,
  DOC_TOOLS,
  DOC_REFERENCE_MODULES,
  DocCategory,
  DocTopic,
} from "./docsData";
import { getAllArticles } from "./docsArticles";
import { searchDocumentation, SearchResultItem } from "@/lib/docs/docsSearchIndex";
import { DocsCommandPalette } from "./DocsCommandPalette";

export function DocsClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in another input/textarea unless it's the shortcut
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Precomputed registry preserving D2 item resolution and keywords
  const allSearchableItems = useMemo(() => {
    const articles = getAllArticles();
    const seenHrefs = new Set<string>();
    return articles.map((item) => {
      seenHrefs.add(`/docs/${item.category}/${item.slug}`);
      return {
        ...item,
        keywords: item.keywords || [],
      };
    });
  }, []);

  // Full-Text Search results with deterministic ranking and section excerpts
  const searchResults = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return [];
    return searchDocumentation(query, { limit: 20 });
  }, [searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="w-full">
      {/* SECTION B: Documentation Hero */}
      <section className="relative overflow-hidden pt-10 pb-12 sm:pt-14 sm:pb-16 border-b border-slate-200/80 bg-gradient-to-b from-white via-white to-[#F7F9FC]">
        <div className="absolute inset-0 bg-[radial-gradient(#087fe8_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-900 font-semibold" aria-current="page">
              Documentation
            </span>
          </nav>

          {/* Eyebrow Label */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80 shadow-2xs">
            <BookOpen className="w-3.5 h-3.5 text-sky-600" />
            <span>DOCUMENTATION &amp; KNOWLEDGE BASE</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight leading-tight max-w-3xl mx-auto">
            SiteSecura Documentation
          </h1>

          {/* Supporting Description */}
          <p className="max-w-2xl mx-auto text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed">
            Learn how to assess website security, understand scan results, and configure SiteSecura&apos;s defensive security tools.
          </p>

          {/* Prominent Search Input Field */}
          <div className="max-w-xl mx-auto pt-2">
            <div className="relative flex items-center">
              <label htmlFor="docs-search-input" className="sr-only">
                Search documentation topics and guides
              </label>
              <div className="absolute left-4 pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="docs-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchQuery("");
                  }
                }}
                placeholder="Search topics, security checks, or configuration guides..."
                className="w-full pl-11 pr-24 py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all"
              />
              <div className="absolute right-3 flex items-center gap-1.5">
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search query"
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsPaletteOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition-colors"
                  title="Open Command Palette (Ctrl+K or ⌘K)"
                >
                  <kbd>Ctrl K</kbd>
                </button>
              </div>
            </div>

            {/* Quick search hints */}
            {!isSearching && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-3 text-xs text-slate-500">
                <span className="font-semibold text-slate-400">Popular:</span>
                {["SSL/TLS", "Security Headers", "DMARC", "Security Scores", "Monitoring"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSearchQuery(tag)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/90 hover:border-slate-300 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs font-medium"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SEARCH ACTIVE VIEW */}
      {isSearching && (
        <section className="py-12 lg:py-16 bg-[#F7F9FC]" aria-label="Search Results">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Search Results
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Showing {searchResults.length} topic{searchResults.length !== 1 ? "s" : ""} matching &ldquo;{searchQuery}&rdquo;
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-100 transition-colors"
              >
                Clear Search
              </button>
            </div>

            {searchResults.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/60">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">
                    No documentation topics found
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                    We couldn&apos;t find any documentation topics matching &ldquo;{searchQuery}&rdquo;. Try searching for &ldquo;SSL&rdquo;, &ldquo;Headers&rdquo;, &ldquo;Scores&rdquo;, or &ldquo;DMARC&rdquo;.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors"
                >
                  <span>Reset Search</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {searchResults.map((result, idx) => {
                  const targetHref = result.matchedAnchor
                    ? `${result.entry.href}#${result.matchedAnchor}`
                    : result.entry.href;

                  return (
                    <Link
                      key={`${result.entry.id}-${idx}`}
                      href={targetHref}
                      className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-sky-300 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                            {result.entry.categoryTitle}
                          </span>
                          {result.matchedHeading ? (
                            <span className="text-[11px] font-medium text-slate-400 truncate max-w-xs">
                              in {result.matchedHeading}
                            </span>
                          ) : result.entry.badge ? (
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {result.entry.badge}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                          {result.entry.title}
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {result.excerpt}
                        </p>
                      </div>
                      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-sky-600">
                        <span>View Documentation</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Keyboard Command Palette Dialog */}
      <DocsCommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
      />

      {/* DEFAULT HOMEPAGE CONTENT VIEW */}
      {!isSearching && (
        <div className="bg-[#F7F9FC] space-y-16 sm:space-y-20 py-12 lg:py-16">
          {/* SECTION C: Documentation Category Cards */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left space-y-8" aria-labelledby="section-categories-heading">
            <div className="space-y-2 max-w-3xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-600">
                <Layers className="w-3.5 h-3.5" />
                <span>Documentation Hierarchy</span>
              </div>
              <h2 id="section-categories-heading" className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Explore by Category
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Browse SiteSecura technical documentation, scanner specifications, and operational guides organized across four core areas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {DOC_CATEGORIES.map((category) => {
                const IconComponent = category.icon;
                return (
                  <div
                    key={category.id}
                    id={category.slug}
                    className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-5">
                      {/* Category Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100/80 shrink-0">
                          <IconComponent className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                          {category.topics.length} topics
                        </span>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                          {category.title}
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed min-h-[3rem]">
                          {category.description}
                        </p>
                      </div>

                      {/* Topics List */}
                      <ul className="space-y-2.5 pt-3 border-t border-slate-100" aria-label={`${category.title} topics`}>
                        {category.topics.map((topic) => (
                          <li key={topic.id}>
                            <Link
                              href={topic.href}
                              className="group flex items-start gap-2 text-xs font-medium text-slate-700 hover:text-sky-600 transition-colors py-0.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                              <span className="leading-snug">{topic.title}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-5 mt-5 border-t border-slate-100">
                      <Link
                        href={category.topics[0]?.href || "/features"}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 group transition-colors"
                      >
                        <span>Explore category guides</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION D: Featured Documentation */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left space-y-8" aria-labelledby="section-featured-heading">
            <div className="space-y-2 max-w-3xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-600">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Featured Technical Guides</span>
              </div>
              <h2 id="section-featured-heading" className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Start Securing Your Website
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Step-by-step guidance on running audits, hardening browser response headers, and securing domain email against spoofing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {FEATURED_DOCS.map((doc) => {
                const IconComponent = doc.icon;
                return (
                  <Link
                    key={doc.id}
                    href={doc.href}
                    className="group bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shrink-0">
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-semibold">
                          <span className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                            {doc.categoryLabel}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500">{doc.readTime}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors leading-snug">
                          {doc.title}
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {doc.summary}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-sky-600">
                      <span>Read Technical Guide</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* SECTION E: Explore Existing Security Tools */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left space-y-8" aria-labelledby="section-tools-heading">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
              <div className="space-y-2 max-w-3xl">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-600">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Interactive Security Utilities</span>
                </div>
                <h2 id="section-tools-heading" className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Explore Standalone Security Tools
                </h2>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Need to investigate a specific technical configuration? Use SiteSecura&apos;s free standalone defensive utilities.
                </p>
              </div>

              <div>
                <Link
                  href="/resources"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-4 py-2 rounded-xl border border-sky-100 hover:border-sky-200 transition-colors shrink-0"
                >
                  <span>Explore Resources Hub</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {DOC_TOOLS.map((tool) => {
                const IconComponent = tool.icon;
                return (
                  <Link
                    key={tool.id}
                    href={tool.href}
                    className="group bg-white rounded-2xl p-5 border border-slate-200 hover:border-sky-300 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-sky-50 text-slate-600 group-hover:text-sky-600 flex items-center justify-center transition-colors shrink-0">
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {tool.badge}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                          {tool.title}
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {tool.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500 group-hover:text-sky-600 transition-colors">
                      <span>Launch Utility</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* SECTION F: Technical Reference & Scanner Modules */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left space-y-8" aria-labelledby="section-reference-heading">
            <div className="space-y-2 max-w-3xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-600">
                <Shield className="w-3.5 h-3.5" />
                <span>Scanner Architecture Reference</span>
              </div>
              <h2 id="section-reference-heading" className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Technical Reference &amp; Scanner Modules
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Summary of the core scanning modules executed during an automated SiteSecura website audit.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {DOC_REFERENCE_MODULES.map((module) => (
                <div
                  key={module.id}
                  className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs space-y-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[11px] font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-md border border-sky-100">
                      {module.code}
                    </span>
                    <Link
                      href={module.href}
                      className="text-xs font-semibold text-slate-500 hover:text-sky-600 flex items-center gap-1 transition-colors"
                    >
                      <span>Explore Module</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-slate-900">
                      {module.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {module.description}
                    </p>
                  </div>

                  <div className="pt-2">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                      Key Signals Audited:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {module.signalsChecked.map((signal) => (
                        <span
                          key={signal}
                          className="text-[11px] font-medium text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION G: Helpful Final CTA */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left" aria-labelledby="section-cta-heading">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white p-8 sm:p-12 border border-slate-800 shadow-xl">
              <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-3xl space-y-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-950/80 text-sky-400 border border-sky-800/80">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>Immediate Defensive Assessment</span>
                </div>

                <h2 id="section-cta-heading" className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  Ready to test your website&apos;s security posture?
                </h2>

                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                  Documentation guides explain how web security works. SiteSecura&apos;s scanner actively audits your public endpoint in 60 seconds and delivers a plain-English remediation plan.
                </p>

                <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                  <Link
                    href="/#scan-hero"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white shadow-lg shadow-sky-600/30 hover:-translate-y-0.5 active:translate-y-0 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Run a Website Security Scan</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    href="/resources"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition-all focus:outline-none focus:ring-2 focus:ring-slate-500"
                  >
                    <span>Browse Free Utilities</span>
                  </Link>

                  <Link
                    href="/contact"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-slate-400 hover:text-slate-200 transition-all focus:outline-none focus:ring-2 focus:ring-slate-500"
                  >
                    <span>Contact Support</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
