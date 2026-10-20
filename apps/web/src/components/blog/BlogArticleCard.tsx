import React from "react";
import Link from "next/link";
import { Clock, Shield, Star, ArrowRight } from "lucide-react";
import { BlogPost, BlogPostSummary } from "@/types";
import { resolveMediaUrl } from "@/lib/utils";
import { calculateReadingTime, formatDate } from "./blogUtils";

interface BlogArticleCardProps {
  post: BlogPost | BlogPostSummary;
}

export function BlogArticleCard({ post }: BlogArticleCardProps) {
  const featuredImageUrl = resolveMediaUrl(
    post.featured_media?.public_url || post.featured_image
  );
  const featuredImageAlt = post.featured_media?.alt_text || post.title;
  // Estimate reading time from content or excerpt
  const contentToEstimate = "content" in post && post.content ? post.content : post.excerpt || "";
  const readingTime = calculateReadingTime(contentToEstimate);
  const formattedDate = formatDate(post.published_at);

  return (
    <article className="group bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-sky-300 transition-all duration-200 flex flex-col justify-between overflow-hidden">
      {/* Thumbnail */}
      <Link
        href={`/blog/${post.slug}`}
        aria-label={`Read article: ${post.title}`}
        className="block aspect-[16/9] w-full overflow-hidden bg-slate-100 border-b border-slate-100 relative"
      >
        {featuredImageUrl ? (
          <img
            src={featuredImageUrl}
            alt={featuredImageAlt}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>
            <Shield className="w-12 h-12 text-sky-400/80 group-hover:scale-110 transition-transform duration-300" />
          </div>
        )}
      </Link>

      {/* Body Content */}
      <div className="p-6 space-y-3.5 flex-1 flex flex-col">
        {/* Meta Bar: Category + Featured + Reading Time */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            {post.is_featured && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                Featured
              </span>
            )}
            {post.category && (
              <Link
                href={`/blog?category=${post.category.slug}`}
                className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-100 transition-colors"
              >
                {post.category.name}
              </Link>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 ml-auto">
            <Clock className="w-3 h-3" />
            <span>{readingTime} min read</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-2 leading-snug">
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-xs sm:text-sm text-slate-600 line-clamp-3 leading-relaxed">
            {post.excerpt}
          </p>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-1 mt-auto">
            {post.tags.slice(0, 3).map((t) => (
              <Link
                key={t.id}
                href={`/blog?tag=${t.slug}`}
                className="text-[10px] font-medium text-slate-500 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 px-2 py-0.5 rounded transition-colors"
              >
                #{t.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer / Author & Date */}
      <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2 min-w-0">
          {post.author?.avatar_url ? (
            <img
              src={resolveMediaUrl(post.author.avatar_url)}
              alt={post.author.name}
              className="w-6 h-6 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
              {post.author?.name ? post.author.name.charAt(0).toUpperCase() : "S"}
            </div>
          )}
          <div className="flex flex-col truncate">
            <span className="font-medium text-slate-800 truncate text-[11px]">
              {post.author?.name || "SiteSecura Team"}
            </span>
            {formattedDate && (
              <span className="text-[10px] text-slate-400">{formattedDate}</span>
            )}
          </div>
        </div>

        <Link
          href={`/blog/${post.slug}`}
          className="inline-flex items-center gap-1 font-semibold text-sky-600 hover:text-sky-700 group/link shrink-0 ml-3"
        >
          <span>Read guide</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </article>
  );
}
