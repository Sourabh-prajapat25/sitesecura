"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { api } from "@/lib/api";
import { BlogPost, BlogCategory, BlogTag } from "@/types";
import { BlogHero } from "@/components/blog/BlogHero";
import { FeaturedArticle } from "@/components/blog/FeaturedArticle";
import { BlogSearch } from "@/components/blog/BlogSearch";
import { BlogFilters } from "@/components/blog/BlogFilters";
import { BlogGrid } from "@/components/blog/BlogGrid";
import { BlogArticleCard } from "@/components/blog/BlogArticleCard";
import { BlogPagination } from "@/components/blog/BlogPagination";
import { BlogGridSkeleton, FeaturedArticleSkeleton } from "@/components/blog/BlogSkeleton";
import { BlogEmptyState } from "@/components/blog/BlogEmptyState";
import { BlogErrorState } from "@/components/blog/BlogErrorState";
import { BlogCTA } from "@/components/blog/BlogCTA";
import { NewsletterSignup } from "@/components/blog/NewsletterSignup";

function BlogListPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Query parameter extraction
  const qParam = searchParams.get("q") || "";
  const categoryParam = searchParams.get("category") || "";
  const tagParam = searchParams.get("tag") || "";
  const pageParam = parseInt(searchParams.get("page") || "1", 10);
  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  // Local state
  const [searchInput, setSearchInput] = useState(qParam);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [tags, setTags] = useState<BlogTag[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync search input with URL query string
  useEffect(() => {
    setSearchInput(qParam);
  }, [qParam]);

  // Load taxonomy once on mount
  useEffect(() => {
    let isMounted = true;
    const loadTaxonomy = async () => {
      try {
        const [catsData, tagsData] = await Promise.all([
          api.getBlogCategories().catch(() => []),
          api.getBlogTags().catch(() => []),
        ]);
        if (isMounted) {
          setCategories(catsData || []);
          setTags(tagsData || []);
        }
      } catch (err) {
        console.error("Failed to load blog taxonomy:", err);
      }
    };
    loadTaxonomy();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update URL parameters helper
  const updateFilters = useCallback(
    (newParams: {
      q?: string | null;
      category?: string | null;
      tag?: string | null;
      page?: number | null;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (newParams.q !== undefined) {
        if (newParams.q) params.set("q", newParams.q);
        else params.delete("q");
      }
      if (newParams.category !== undefined) {
        if (newParams.category) params.set("category", newParams.category);
        else params.delete("category");
      }
      if (newParams.tag !== undefined) {
        if (newParams.tag) params.set("tag", newParams.tag);
        else params.delete("tag");
      }
      if (newParams.page !== undefined) {
        if (newParams.page && newParams.page > 1) {
          params.set("page", String(newParams.page));
        } else {
          params.delete("page");
        }
      }

      const qs = params.toString();
      router.push(`/blog${qs ? `?${qs}` : ""}`);
    },
    [router, searchParams]
  );

  // Load articles whenever query parameters change
  const loadArticles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getBlogPosts({
        q: qParam || undefined,
        category: categoryParam || undefined,
        tag: tagParam || undefined,
        page: currentPage,
        page_size: 9,
      });

      if (res && Array.isArray(res.items)) {
        setPosts(res.items);
        setTotalPosts(res.total);
        setTotalPages(res.total_pages || 1);
        setHasNext(res.has_next || false);
        setHasPrevious(res.has_previous || false);
      } else if (Array.isArray(res)) {
        setPosts(res);
        setTotalPosts(res.length);
        setTotalPages(1);
        setHasNext(false);
        setHasPrevious(false);
      } else {
        setPosts([]);
        setTotalPosts(0);
        setTotalPages(1);
        setHasNext(false);
        setHasPrevious(false);
      }
    } catch (err) {
      console.error("Failed to load blog posts:", err);
      setError("Unable to load security guides. Please try refreshing or check your connection.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [qParam, categoryParam, tagParam, currentPage]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const handleSearchSubmit = () => {
    updateFilters({ q: searchInput.trim() || null, page: 1 });
  };

  const handleClearSearch = () => {
    setSearchInput("");
    updateFilters({ q: null, page: 1 });
  };

  const handleSelectCategory = (slug: string | null) => {
    updateFilters({ category: slug, page: 1 });
  };

  const handleSelectTag = (slug: string | null) => {
    updateFilters({ tag: slug, page: 1 });
  };

  const handleClearAllFilters = () => {
    setSearchInput("");
    router.push("/blog");
  };

  const hasActiveFilters = Boolean(qParam || categoryParam || tagParam);

  // Determine if a featured article should be highlighted at the top
  const featuredPost =
    !hasActiveFilters && currentPage === 1 && posts.length > 0
      ? posts.find((p) => p.is_featured) || null
      : null;

  // Grid posts excluding the featured post if shown in the spotlight
  const gridPosts = featuredPost
    ? posts.filter((p) => p.id !== featuredPost.id)
    : posts;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Navbar />

      <main className="flex-1">
        {/* Editorial Publication Hero */}
        <BlogHero />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-10">
          {/* Featured Article Spotlight (when on front page without filters) */}
          {loading ? (
            !hasActiveFilters && currentPage === 1 && <FeaturedArticleSkeleton />
          ) : featuredPost ? (
            <section aria-label="Featured article spotlight">
              <FeaturedArticle post={featuredPost} />
            </section>
          ) : null}

          {/* Search & Taxonomy Filter Control Deck */}
          <section
            aria-label="Search and filter guides"
            className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-5"
          >
            <BlogSearch
              value={searchInput}
              onChange={setSearchInput}
              onSubmit={handleSearchSubmit}
              onClear={handleClearSearch}
            />

            <BlogFilters
              categories={categories}
              tags={tags}
              activeCategory={categoryParam || null}
              activeTag={tagParam || null}
              activeQuery={qParam || null}
              onSelectCategory={handleSelectCategory}
              onSelectTag={handleSelectTag}
              onClearQuery={handleClearSearch}
              onClearAll={handleClearAllFilters}
            />
          </section>

          {/* Results Summary Bar */}
          {!loading && !error && (
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
              <span>
                Showing{" "}
                <span className="font-semibold text-slate-800">
                  {totalPosts}
                </span>{" "}
                {totalPosts === 1 ? "guide" : "guides"}
                {hasActiveFilters && " matching selected filters"}
              </span>

              {totalPages > 1 && (
                <span>
                  Page {currentPage} of {totalPages}
                </span>
              )}
            </div>
          )}

          {/* Content States: Loading, Error, Empty, or Grid */}
          {loading ? (
            <BlogGridSkeleton count={6} />
          ) : error ? (
            <BlogErrorState message={error} onRetry={loadArticles} />
          ) : posts.length === 0 ? (
            <BlogEmptyState
              hasActiveFilters={hasActiveFilters}
              activeQuery={qParam}
              activeCategory={categoryParam}
              activeTag={tagParam}
              onReset={handleClearAllFilters}
            />
          ) : (
            <section aria-label="Security guides collection">
              {gridPosts.length > 0 ? (
                <BlogGrid>
                  {gridPosts.map((post) => (
                    <BlogArticleCard key={post.id} post={post} />
                  ))}
                </BlogGrid>
              ) : (
                // In the rare event only the featured post existed
                featuredPost && (
                  <div className="text-center py-6 text-xs text-slate-400">
                    All guides shown in the spotlight above.
                  </div>
                )
              )}
            </section>
          )}

          {/* Accessible Pagination */}
          {!loading && !error && totalPages > 1 && (
            <BlogPagination
              currentPage={currentPage}
              totalPages={totalPages}
              hasNext={hasNext}
              hasPrevious={hasPrevious}
              onPageChange={(p) => updateFilters({ page: p })}
              totalItems={totalPosts}
            />
          )}

          {/* Newsletter Signup */}
          <div className="mt-14">
            <NewsletterSignup
              source="blog_list"
              title="SiteSecura Security Dispatch"
              description="Get actionable vulnerability disclosures, defensive hardening runbooks, and zero-day threat analyses sent directly to your inbox."
            />
          </div>

          {/* SiteSecura Defensive Scanner CTA */}
          <BlogCTA className="mt-8" source="blog_list" campaign="blog_list_bottom_cta" />
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function BlogListPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
          Loading security publications...
        </div>
      }
    >
      <BlogListPageContent />
    </Suspense>
  );
}
