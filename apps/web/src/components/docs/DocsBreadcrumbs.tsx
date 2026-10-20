import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface DocsBreadcrumbsProps {
  categoryTitle: string;
  categorySlug: string;
  articleTitle: string;
}

export function DocsBreadcrumbs({
  categoryTitle,
  categorySlug,
  articleTitle,
}: DocsBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
      <Link href="/" className="hover:text-slate-900 transition-colors">
        Home
      </Link>
      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <Link href="/docs" className="hover:text-slate-900 transition-colors">
        Documentation
      </Link>
      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span className="text-slate-700">
        {categoryTitle}
      </span>
      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span className="text-slate-950 font-semibold truncate max-w-xs sm:max-w-md" aria-current="page">
        {articleTitle}
      </span>
    </nav>
  );
}
