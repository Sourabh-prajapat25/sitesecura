import React from "react";
import Link from "next/link";
import { Clock, Calendar, ShieldCheck } from "lucide-react";
import { BlogPost } from "@/types";
import { resolveMediaUrl } from "@/lib/utils";
import { calculateReadingTime, formatDate } from "./blogUtils";

interface ArticleHeaderProps {
  post: BlogPost;
}

export function ArticleHeader({ post }: ArticleHeaderProps) {
  const readingTime = calculateReadingTime(post.content);
  const formattedDate = formatDate(post.published_at);
  const authorAvatarUrl = post.author?.avatar_url
    ? resolveMediaUrl(post.author.avatar_url)
    : null;

  return (
    <header className="space-y-6 pb-6 border-b border-slate-200/80">
      {/* Category Pill & Defensive Badge */}
      <div className="flex items-center gap-2 flex-wrap">
        {post.category && (
          <Link
            href={`/blog?category=${post.category.slug}`}
            className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors"
          >
            {post.category.name}
          </Link>
        )}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Security Verified</span>
        </div>
      </div>

      {/* Main Headline */}
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
        {post.title}
      </h1>

      {/* Excerpt Lead */}
      {post.excerpt && (
        <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
          {post.excerpt}
        </p>
      )}

      {/* Author & Publication Metadata */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-y border-slate-100">
        {/* Author info */}
        <div className="flex items-center gap-3">
          {authorAvatarUrl ? (
            <img
              src={authorAvatarUrl}
              alt={post.author?.name || "Author avatar"}
              className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-2xs"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
              {post.author?.name ? post.author.name.charAt(0).toUpperCase() : "S"}
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-900">
              {post.author?.name || "SiteSecura Team"}
            </span>
            <span className="text-xs text-slate-500">
              {post.author?.bio || "Cybersecurity Engineering & Research"}
            </span>
          </div>
        </div>

        {/* Date & Reading time */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          {formattedDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{formattedDate}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{readingTime} min read</span>
          </div>
        </div>
      </div>

      {/* Topic Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-slate-400 font-medium mr-1">Topics:</span>
          {post.tags.map((t) => (
            <Link
              key={t.id}
              href={`/blog?tag=${t.slug}`}
              className="inline-flex items-center text-xs text-slate-600 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors"
            >
              #{t.name}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
