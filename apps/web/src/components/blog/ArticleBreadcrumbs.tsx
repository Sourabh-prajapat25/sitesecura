import React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { BlogCategory } from "@/types";

interface ArticleBreadcrumbsProps {
  category?: BlogCategory | null;
  title: string;
}

export function ArticleBreadcrumbs({ category, title }: ArticleBreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-xs text-slate-500 overflow-hidden py-1"
    >
      <Link
        href="/"
        className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors shrink-0"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="sr-only sm:not-sr-only">Home</span>
      </Link>

      <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

      <Link
        href="/blog"
        className="hover:text-slate-900 transition-colors shrink-0 font-medium"
      >
        Blog
      </Link>

      {category && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <Link
            href={`/blog?category=${category.slug}`}
            className="hover:text-slate-900 transition-colors shrink-0 font-medium max-w-[150px] truncate"
          >
            {category.name}
          </Link>
        </>
      )}

      <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

      <span
        aria-current="page"
        className="text-slate-900 font-semibold truncate max-w-[220px] sm:max-w-[340px]"
        title={title}
      >
        {title}
      </span>
    </nav>
  );
}
