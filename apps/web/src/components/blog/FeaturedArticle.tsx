import React from "react";
import Link from "next/link";
import { Star, Clock, ArrowRight, Shield } from "lucide-react";
import { BlogPost, BlogPostSummary } from "@/types";
import { resolveMediaUrl } from "@/lib/utils";
import { calculateReadingTime, formatDate } from "./blogUtils";

interface FeaturedArticleProps {
  post: BlogPost | BlogPostSummary;
}

export function FeaturedArticle({ post }: FeaturedArticleProps) {
  const featuredImageUrl = resolveMediaUrl(
    post.featured_media?.public_url || post.featured_image
  );
  const featuredImageAlt = post.featured_media?.alt_text || post.title;
  const contentToEstimate = "content" in post && post.content ? post.content : post.excerpt || "";
  const readingTime = calculateReadingTime(contentToEstimate);
  const formattedDate = formatDate(post.published_at);

  return (
    <article className="group bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-sky-300 transition-all duration-300 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch">
        {/* Left Column: Large Image */}
        <Link
          href={`/blog/${post.slug}`}
          aria-label={`Read featured article: ${post.title}`}
          className="lg:col-span-7 relative aspect-[16/9] lg:aspect-auto min-h-[260px] lg:min-h-[380px] bg-slate-950 overflow-hidden block"
        >
          {featuredImageUrl ? (
            <img
              src={featuredImageUrl}
              alt={featuredImageAlt}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
              loading="eager"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 flex items-center justify-center p-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] opacity-20"></div>
              <div className="relative text-center space-y-3">
                <Shield className="w-16 h-16 text-sky-400 mx-auto group-hover:scale-110 transition-transform duration-300" />
                <p className="text-xs uppercase font-mono tracking-widest text-sky-300/80">
                  Featured Security Advisory
                </p>
              </div>
            </div>
          )}
        </Link>

        {/* Right Column: Editorial Summary */}
        <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Top Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                Featured Guide
              </span>
              {post.category && (
                <Link
                  href={`/blog?category=${post.category.slug}`}
                  className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-100 transition-colors"
                >
                  {post.category.name}
                </Link>
              )}
              <div className="flex items-center gap-1 text-xs text-slate-400 ml-auto">
                <Clock className="w-3.5 h-3.5" />
                <span>{readingTime} min read</span>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug group-hover:text-sky-600 transition-colors">
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed line-clamp-3">
                {post.excerpt}
              </p>
            )}

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {post.tags.slice(0, 4).map((t) => (
                  <Link
                    key={t.id}
                    href={`/blog?tag=${t.slug}`}
                    className="text-xs font-medium text-slate-500 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 px-2.5 py-0.5 rounded-md transition-colors"
                  >
                    #{t.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Row: Author + CTA Button */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {post.author?.avatar_url ? (
                <img
                  src={resolveMediaUrl(post.author.avatar_url)}
                  alt={post.author.name}
                  className="w-9 h-9 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                  {post.author?.name ? post.author.name.charAt(0).toUpperCase() : "S"}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-900">
                  {post.author?.name || "SiteSecura Team"}
                </span>
                {formattedDate && (
                  <span className="text-[11px] text-slate-400">{formattedDate}</span>
                )}
              </div>
            </div>

            <Link
              href={`/blog/${post.slug}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all group/btn"
            >
              <span>Read complete guide</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
