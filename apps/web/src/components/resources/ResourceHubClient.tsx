"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Wrench,
  Lock,
  FileCode,
  Mail,
  Layers,
  BookOpen,
  Clock,
  Calendar,
  Sparkles,
  Search,
  Globe,
  RefreshCw,
  FileCheck,
  Bot,
  Shield,
  Zap,
} from "lucide-react";
import { Resource, BlogPost } from "@/types";
import { ResourceCard } from "./ResourceCard";
import { ResourceFilters, CATEGORY_OPTIONS } from "./ResourceFilters";
import { QuickToolFinder } from "./QuickToolFinder";
import { calculateReadingTime, formatDate } from "@/components/blog/blogUtils";
import { trackContentEvent } from "@/lib/analytics";

export interface UtilityToolDefinition {
  id: string;
  title: string;
  description: string;
  href: string;
  badge: string;
  category: "security" | "network" | "policy" | "crawlability";
  categoryLabel: string;
  executionType: string;
  useCase: string;
  featured: boolean;
  icon: React.ComponentType<{ className?: string }>;
  relatedToolIds: string[];
  tags: string[];
}

export const ALL_UTILITY_TOOLS: UtilityToolDefinition[] = [
  {
    id: "tool-scanner",
    title: "Website Security Scanner",
    description:
      "Assess your website's complete security posture with checks for HTTPS, TLS certificates, defensive HTTP security headers, DNS and email-security configuration.",
    href: "/tools/website-security-checker",
    badge: "Full Assessment",
    category: "security",
    categoryLabel: "Website Security",
    executionType: "Remote Perimeter Assessment",
    useCase: "Passive evaluation of public signals in under 60 seconds",
    featured: true,
    icon: Shield,
    relatedToolIds: ["tool-ssl", "tool-headers"],
    tags: ["scanner", "full", "perimeter", "tls", "headers", "overall", "security"],
  },
  {
    id: "tool-ssl",
    title: "SSL/TLS Certificate Checker",
    description:
      "Inspect TLS certificate validity, expiration countdown, Subject Alternative Names (SAN), issuer trust chains, and modern cryptographic protocols.",
    href: "/tools/ssl-checker",
    badge: "SSL / TLS",
    category: "security",
    categoryLabel: "Website Security",
    executionType: "Remote TLS Handshake",
    useCase: "Certificate validity, issuer trust, and expiry monitoring",
    featured: true,
    icon: Lock,
    relatedToolIds: ["tool-scanner", "tool-http-status"],
    tags: ["ssl", "tls", "certificate", "https", "cert", "san", "cipher"],
  },
  {
    id: "tool-headers",
    title: "HTTP Security Headers Checker",
    description:
      "Review defensive HTTP response headers including HSTS, Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy.",
    href: "/tools/security-headers-checker",
    badge: "HTTP Headers",
    category: "policy",
    categoryLabel: "Security Configuration",
    executionType: "Remote HTTP Inspection",
    useCase: "Evaluate browser hardening headers and injection resistance",
    featured: false,
    icon: FileCode,
    relatedToolIds: ["tool-csp", "tool-scanner"],
    tags: ["headers", "hsts", "csp", "xfo", "referrer-policy", "permissions-policy"],
  },
  {
    id: "tool-email",
    title: "SPF, DKIM & DMARC Checker",
    description:
      "Review DNS email-authentication records (SPF syntax, DMARC policies, and DKIM public keys) to protect your domain against spoofing and phishing.",
    href: "/tools/email-security-checker",
    badge: "Email Authentication",
    category: "security",
    categoryLabel: "Website Security",
    executionType: "Live DNS Query",
    useCase: "Detect anti-spoofing record gaps and DMARC enforcement levels",
    featured: false,
    icon: Mail,
    relatedToolIds: ["tool-dns", "tool-scanner"],
    tags: ["email", "spf", "dkim", "dmarc", "spoofing", "phishing", "mx"],
  },
  {
    id: "tool-dns",
    title: "DNS Lookup Tool",
    description:
      "Query forward DNS records (A, AAAA, MX, NS, TXT, SOA, CAA) with real-time resolution, TTL timings, authoritative nameservers, and CAA issuance rules.",
    href: "/tools/dns-lookup",
    badge: "DNS Utility",
    category: "network",
    categoryLabel: "Network & DNS",
    executionType: "Live DNS Resolution",
    useCase: "Inspect domain records, propagation, and mail server priority",
    featured: true,
    icon: Globe,
    relatedToolIds: ["tool-email", "tool-http-status"],
    tags: ["dns", "a", "aaaa", "cname", "mx", "ns", "txt", "soa", "caa"],
  },
  {
    id: "tool-http-status",
    title: "HTTP Status & Redirect Checker",
    description:
      "Inspect HTTP response codes and trace complete redirect chains hop-by-hop. Audit 301, 302, 307, 308 redirects, detect SSL downgrades, and measure latency.",
    href: "/tools/http-status-checker",
    badge: "HTTP Utility",
    category: "network",
    categoryLabel: "Network & DNS",
    executionType: "SSRF-Safe Hop Tracing",
    useCase: "Trace URL hops, identify redirect loops, and detect HTTP downgrades",
    featured: false,
    icon: RefreshCw,
    relatedToolIds: ["tool-dns", "tool-ssl"],
    tags: ["http", "redirect", "301", "302", "hops", "status", "chain"],
  },
  {
    id: "tool-security-txt",
    title: "security.txt Validator",
    description:
      "Validate vulnerability disclosure files against RFC 9116. Inspect mandatory Contact and Expires directives, verify OpenPGP encryption armor, and check HTTPS paths.",
    href: "/tools/security-txt-validator",
    badge: "Compliance Utility",
    category: "policy",
    categoryLabel: "Security Configuration",
    executionType: "RFC 9116 Remote Inspection",
    useCase: "Verify vulnerability disclosure files and security contact endpoints",
    featured: false,
    icon: FileCheck,
    relatedToolIds: ["tool-robots-sitemap", "tool-headers"],
    tags: ["security.txt", "rfc9116", "disclosure", "pgp", "vulnerability"],
  },
  {
    id: "tool-robots-sitemap",
    title: "Robots.txt & Sitemap Checker",
    description:
      "Inspect crawler access rules against RFC 9309, test crawl paths with longest-match rule simulator, and validate XML sitemaps and sitemap indexes.",
    href: "/tools/robots-sitemap-checker",
    badge: "Crawlability Utility",
    category: "crawlability",
    categoryLabel: "Crawlability & SEO",
    executionType: "RFC 9309 & XML Validation",
    useCase: "Audit search engine crawler directives and index boundaries",
    featured: false,
    icon: Bot,
    relatedToolIds: ["tool-security-txt", "tool-http-status"],
    tags: ["robots.txt", "sitemap", "xml", "crawler", "rfc9309", "seo", "bot"],
  },
  {
    id: "tool-csp",
    title: "CSP Policy Analyzer",
    description:
      "Analyze Content-Security-Policy headers against W3C Level 3 specs. Resolve directive fallback hierarchies, detect unsafe-inline/eval execution, and audit nonces.",
    href: "/tools/csp-policy-analyzer",
    badge: "Policy Utility",
    category: "policy",
    categoryLabel: "Security Configuration",
    executionType: "Offline Paste / Safe HTTPS Inspection",
    useCase: "Evaluate W3C CSP Level 3 directives and injection resistance",
    featured: true,
    icon: ShieldCheck,
    relatedToolIds: ["tool-headers", "tool-scanner"],
    tags: ["csp", "content-security-policy", "w3c", "strict-dynamic", "nonces", "xss"],
  },
];

interface ResourceHubClientProps {
  initialResources: Resource[];
  initialArticles?: BlogPost[];
}

export function ResourceHubClient({
  initialResources,
  initialArticles = [],
}: ResourceHubClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Map tool IDs to tool objects for quick lookup
  const toolsById = useMemo(() => {
    const map = new Map<string, UtilityToolDefinition>();
    for (const t of ALL_UTILITY_TOOLS) {
      map.set(t.id, t);
    }
    return map;
  }, []);

  // Safe client-side URL query parameter synchronization
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("category");
    const q = params.get("q");

    const validCategoryIds = CATEGORY_OPTIONS.map((c) => c.id);
    if (cat && validCategoryIds.includes(cat)) {
      setSelectedCategory(cat);
    }
    if (q) {
      setSearchQuery(q);
    }

    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      const newCat = p.get("category");
      const newQ = p.get("q");
      setSelectedCategory(newCat && validCategoryIds.includes(newCat) ? newCat : "all");
      setSearchQuery(newQ || "");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const updateUrlParams = useCallback((cat: string, q: string) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (cat && cat !== "all") {
      params.set("category", cat);
    } else {
      params.delete("category");
    }
    if (q.trim()) {
      params.set("q", q.trim());
    } else {
      params.delete("q");
    }
    const qs = params.toString();
    const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", newUrl);
  }, []);

  const handleSelectCategory = (catId: string) => {
    setSelectedCategory(catId);
    updateUrlParams(catId, searchQuery);
    trackContentEvent({
      event_name: "resource_view",
      content_type: "category_filter",
      content_id: catId,
      source: "resource_hub_filters",
    });
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    updateUrlParams(selectedCategory, q);
    if (q.trim().length >= 3) {
      trackContentEvent({
        event_name: "resource_view",
        content_type: "search",
        content_id: q.trim().toLowerCase(),
        source: "resource_hub_search",
      });
    }
  };

  const handleToolClick = (tool: UtilityToolDefinition, source: string) => {
    trackContentEvent({
      event_name: "resource_view",
      content_type: "tool",
      content_id: tool.title,
      source,
    });
  };

  // Filter tools based on search and category
  const filteredTools = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return ALL_UTILITY_TOOLS.filter((tool) => {
      // Category filter check
      if (selectedCategory !== "all") {
        if (selectedCategory === "guides") return false;
        if (tool.category !== selectedCategory) return false;
      }

      // Search query check
      if (q) {
        const inTitle = tool.title.toLowerCase().includes(q);
        const inDesc = tool.description.toLowerCase().includes(q);
        const inBadge = tool.badge.toLowerCase().includes(q);
        const inCategory = tool.categoryLabel.toLowerCase().includes(q);
        const inUseCase = tool.useCase.toLowerCase().includes(q);
        const inTags = tool.tags.some((tag) => tag.toLowerCase().includes(q));

        if (!inTitle && !inDesc && !inBadge && !inCategory && !inUseCase && !inTags) {
          return false;
        }
      }

      return true;
    });
  }, [selectedCategory, searchQuery]);

  // Featured utilities (curated subset)
  const featuredTools = useMemo(() => {
    return ALL_UTILITY_TOOLS.filter((tool) => tool.featured);
  }, []);

  // Filter published educational guides/articles
  const filteredArticles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    // If a specific tool category is active other than "all" or "guides", omit articles
    if (
      selectedCategory !== "all" &&
      selectedCategory !== "guides" &&
      selectedCategory !== "security"
    ) {
      return [];
    }

    return initialArticles.filter((article) => {
      if (!q) return true;
      const matchesTitle = article.title.toLowerCase().includes(q);
      const matchesExcerpt = article.excerpt ? article.excerpt.toLowerCase().includes(q) : false;
      const matchesCat = article.category?.name
        ? article.category.name.toLowerCase().includes(q)
        : false;
      return matchesTitle || matchesExcerpt || matchesCat;
    });
  }, [initialArticles, selectedCategory, searchQuery]);

  // Filter dynamic resources from the resources table
  const filteredResources = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return initialResources.filter((res) => {
      if (selectedCategory === "guides" && res.resource_type.toLowerCase() !== "guide") {
        return false;
      }

      if (q) {
        const matchesTitle = res.title.toLowerCase().includes(q);
        const matchesDesc = res.description ? res.description.toLowerCase().includes(q) : false;
        const matchesCat = res.category ? res.category.toLowerCase().includes(q) : false;
        return matchesTitle || matchesDesc || matchesCat;
      }
      return true;
    });
  }, [initialResources, selectedCategory, searchQuery]);

  // Compute category counts for badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: ALL_UTILITY_TOOLS.length + initialArticles.length + initialResources.length,
      security:
        ALL_UTILITY_TOOLS.filter((t) => t.category === "security").length +
        initialArticles.filter((a) =>
          a.category?.name?.toLowerCase().includes("security")
        ).length,
      network: ALL_UTILITY_TOOLS.filter((t) => t.category === "network").length,
      policy: ALL_UTILITY_TOOLS.filter((t) => t.category === "policy").length,
      crawlability: ALL_UTILITY_TOOLS.filter((t) => t.category === "crawlability").length,
      guides: initialArticles.length,
    };
    return counts;
  }, [initialArticles, initialResources]);

  // Total visible items count
  const totalVisibleCount =
    filteredTools.length + filteredArticles.length + filteredResources.length;

  const showFeaturedSection =
    selectedCategory === "all" && !searchQuery.trim();
  const showToolsSection = filteredTools.length > 0;
  const showArticlesSection = filteredArticles.length > 0;
  const showResourcesSection = filteredResources.length > 0;

  const handleClearFilters = () => {
    setSelectedCategory("all");
    setSearchQuery("");
    updateUrlParams("all", "");
  };

  return (
    <div className="space-y-14">
      {/* Section B: Quick Tool Finder */}
      <QuickToolFinder />

      {/* Section C: Featured Utilities (Curated Showcase) */}
      {showFeaturedSection && (
        <section aria-labelledby="featured-utilities-heading" className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Featured Utilities</span>
              </div>
              <h2 id="featured-utilities-heading" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Recommended Security Utilities
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                High-impact diagnostic tools for immediate website security inspection:
              </p>
            </div>
            <a
              href="#tools"
              className="text-xs font-bold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1 self-start sm:self-auto"
            >
              <span>View all {ALL_UTILITY_TOOLS.length} tools</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={`featured-${tool.id}`}
                  className="bg-gradient-to-br from-white to-slate-50/70 p-5 rounded-2xl border border-slate-200/90 hover:border-sky-300 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200/80 uppercase tracking-wider">
                        {tool.badge}
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors leading-snug">
                      <Link
                        href={tool.href}
                        onClick={() => handleToolClick(tool, "featured_section")}
                      >
                        {tool.title}
                      </Link>
                    </h3>

                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                      {tool.description}
                    </p>

                    <div className="text-[11px] text-slate-500 font-medium bg-white p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Use Case
                      </span>
                      <span className="text-slate-700 line-clamp-2">{tool.useCase}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <Link
                      href={tool.href}
                      onClick={() => handleToolClick(tool, "featured_section")}
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1"
                    >
                      <span>Open tool</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                    <span className="text-[10px] text-slate-500">
                      {tool.executionType.split(" ")[0]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Discovery Toolbar: Categories & Search */}
      <div id="tools" className="scroll-mt-24 space-y-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
            <Wrench className="w-3.5 h-3.5 text-sky-600" />
            <span>Complete Directory</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Security Tools, Guides &amp; Resources
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Search and filter across all standalone tools and technical hardening guides:
          </p>
        </div>

        <ResourceFilters
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          resultCount={totalVisibleCount}
          categoryCounts={categoryCounts}
        />

        {/* Global Empty State */}
        {totalVisibleCount === 0 && (
          <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              No matching resources found
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery
                ? `No items found matching "${searchQuery}". Try searching for broader terms like "SSL", "DNS", "Headers", or "CSP".`
                : "No tools or resources are currently published under this category."}
            </p>
            <div className="pt-2">
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors"
              >
                <span>Clear filters &amp; view all tools</span>
              </button>
            </div>
          </div>
        )}

        {/* Section D: All Free Tools Grid */}
        {showToolsSection && (
          <section aria-labelledby="all-tools-heading" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 id="all-tools-heading" className="text-base sm:text-lg font-bold text-slate-900">
                {selectedCategory === "all"
                  ? "All Free Website Security Tools"
                  : `${CATEGORY_OPTIONS.find((c) => c.id === selectedCategory)?.label || "Category"} Tools`}
                <span className="text-xs font-normal text-slate-500 ml-2">
                  ({filteredTools.length} {filteredTools.length === 1 ? "tool" : "tools"})
                </span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredTools.map((tool) => {
                const Icon = tool.icon;
                const relatedTools = tool.relatedToolIds
                  .map((rid) => toolsById.get(rid))
                  .filter(Boolean) as UtilityToolDefinition[];

                return (
                  <div
                    key={tool.id}
                    className="bg-white p-6 rounded-2xl border border-slate-200/90 hover:border-sky-300 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      {/* Card Badges Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200/80">
                            {tool.badge}
                          </span>
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                            {tool.executionType}
                          </span>
                        </div>
                        <Icon className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-colors" />
                      </div>

                      {/* Tool Title */}
                      <h4 className="text-lg font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                        <Link
                          href={tool.href}
                          onClick={() => handleToolClick(tool, "all_tools_grid")}
                        >
                          {tool.title}
                        </Link>
                      </h4>

                      {/* Description */}
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {tool.description}
                      </p>

                      {/* Main Use Case note */}
                      <div className="text-[11px] text-slate-500 pt-1">
                        <span className="font-semibold text-slate-700">Scope: </span>
                        <span>{tool.useCase}</span>
                      </div>
                    </div>

                    {/* Action & Related Tools Discovery Footer */}
                    <div className="pt-4 border-t border-slate-100 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <Link
                          href={tool.href}
                          onClick={() => handleToolClick(tool, "all_tools_grid")}
                          className="text-xs font-bold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1.5 transition-colors"
                        >
                          <span>Open Tool &amp; Guidance</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium border border-emerald-100">
                          Free Online Check
                        </span>
                      </div>

                      {/* Related Tools Discovery Section */}
                      {relatedTools.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-500">
                          <span className="text-slate-400 font-medium">Related:</span>
                          {relatedTools.map((rel, rIdx) => (
                            <React.Fragment key={rel.id}>
                              {rIdx > 0 && <span className="text-slate-300">·</span>}
                              <Link
                                href={rel.href}
                                onClick={() => handleToolClick(rel, `related_link_${tool.id}`)}
                                className="text-slate-600 hover:text-sky-600 hover:underline font-medium"
                              >
                                {rel.title.replace(" Checker", "").replace(" Tool", "").replace(" Validator", "").replace(" Analyzer", "")}
                              </Link>
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Section E: Learning Resources & Published Articles */}
        {showArticlesSection && (
          <section aria-labelledby="learn-security-heading" className="space-y-6 pt-6 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 mb-2">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Technical Knowledge Library</span>
                </div>
                <h3 id="learn-security-heading" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Learn Website Security
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
                  Practical guides, step-by-step walkthroughs, and hardening recommendations from our security engineers.
                </p>
              </div>
              <Link
                href="/blog"
                className="text-xs font-bold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1 shrink-0"
              >
                <span>Explore all articles</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map((article) => {
                const readingTime = calculateReadingTime(article.content);
                const formattedDate = formatDate(article.published_at || article.created_at);
                return (
                  <article
                    key={article.id}
                    className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        {article.category ? (
                          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            {article.category.name}
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            Security Guide
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span>{readingTime} min read</span>
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-2">
                        <Link href={`/blog/${article.slug}`}>{article.title}</Link>
                      </h4>

                      {article.excerpt && (
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                          {article.excerpt}
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px] flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formattedDate}</span>
                      </span>
                      <Link
                        href={`/blog/${article.slug}`}
                        className="font-bold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1"
                      >
                        <span>Read Guide</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Dynamic Resources Grid (if any resources exist in the database) */}
        {showResourcesSection && (
          <section aria-labelledby="dynamic-resources-heading" className="space-y-6 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h3 id="dynamic-resources-heading" className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-sky-600" />
                <span>Published Technical Resources</span>
                <span className="text-xs font-normal text-slate-500 ml-1">
                  ({filteredResources.length})
                </span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredResources.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
