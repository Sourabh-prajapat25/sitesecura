import React from "react";
import { BlogPostSummary } from "@/types";
import { BlogArticleCard } from "./BlogArticleCard";
import { BookOpen } from "lucide-react";

interface RelatedArticlesProps {
  posts?: BlogPostSummary[] | null;
}

export function RelatedArticles({ posts }: RelatedArticlesProps) {
  if (!posts || posts.length === 0) return null;

  return (
    <section
      aria-label="Related articles"
      className="my-12 pt-10 border-t border-slate-200/80 space-y-6"
    >
      <div className="flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-sky-600" />
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Related Security Guides
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((relPost) => (
          <BlogArticleCard key={relPost.id} post={relPost} />
        ))}
      </div>
    </section>
  );
}
