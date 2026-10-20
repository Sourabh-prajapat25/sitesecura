"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Link2, Check, ArrowLeft, Share2 } from "lucide-react";

interface ArticleShareBarProps {
  title: string;
  slug: string;
}

export function ArticleShareBar({ title, slug }: ArticleShareBarProps) {
  const [copied, setCopied] = useState(false);

  const getArticleUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/blog/${slug}`;
    }
    return `https://sitesecura.com/blog/${slug}`;
  };

  const handleCopyLink = async () => {
    try {
      const url = getArticleUrl();
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy article URL:", err);
    }
  };

  const articleUrl = getArticleUrl();
  const encodedUrl = encodeURIComponent(articleUrl);
  const encodedTitle = encodeURIComponent(`${title} | SiteSecura Blog`);

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 px-5 bg-slate-50 border border-slate-200/80 rounded-2xl">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to all guides</span>
      </Link>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400 font-medium flex items-center gap-1">
          <Share2 className="w-3.5 h-3.5" />
          Share:
        </span>

        {/* Copy Link */}
        <button
          type="button"
          onClick={handleCopyLink}
          aria-label="Copy article link to clipboard"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors font-medium shadow-2xs"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Link2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Copy Link</span>
            </>
          )}
        </button>

        {/* Twitter/X */}
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors font-medium shadow-2xs"
        >
          X (Twitter)
        </a>

        {/* LinkedIn */}
        <a
          href={linkedInUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors font-medium shadow-2xs"
        >
          LinkedIn
        </a>
      </div>
    </div>
  );
}
