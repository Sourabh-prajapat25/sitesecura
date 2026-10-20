import React from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  ArrowLeft,
  ArrowRight,
  Wrench,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { DocArticle } from "./docsArticles";
import { DocsSidebar } from "./DocsSidebar";
import { DocsTableOfContents } from "./DocsTableOfContents";
import { DocsBreadcrumbs } from "./DocsBreadcrumbs";
import { DocsFeedback } from "./DocsFeedback";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { extractTocFromMarkdown, formatDate } from "@/components/blog/blogUtils";

interface DocsArticleLayoutProps {
  article: DocArticle;
  prevArticle?: DocArticle | null;
  nextArticle?: DocArticle | null;
}

export function DocsArticleLayout({
  article,
  prevArticle,
  nextArticle,
}: DocsArticleLayoutProps) {
  const tocItems = extractTocFromMarkdown(article.content);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        {/* Left Column: Docs Navigation Sidebar */}
        <DocsSidebar currentCategory={article.category} currentSlug={article.slug} />

        {/* Center Column: Main Article Body */}
        <main className="flex-1 min-w-0" id="main-docs-content">
          <article className="space-y-8">
            {/* Header Section */}
            <header className="space-y-4 pb-6 border-b border-slate-200/90">
              <DocsBreadcrumbs
                categoryTitle={article.categoryTitle}
                categorySlug={article.category}
                articleTitle={article.title}
              />

              <div className="space-y-3 pt-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200/70">
                  <Sparkles className="w-3 h-3 text-sky-600" />
                  <span>{article.categoryTitle}</span>
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-950 tracking-tight leading-tight">
                  {article.title}
                </h1>

                <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-3xl">
                  {article.description}
                </p>
              </div>

              {/* Editorial Metadata Bar */}
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-500 font-medium">
                {article.lastUpdated && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Last updated: {formatDate(article.lastUpdated)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{article.readingTimeMinutes} min read</span>
                </div>
              </div>
            </header>

            {/* Markdown Content */}
            <div className="prose-content">
              <MarkdownRenderer content={article.content} variant="article" />
            </div>

            {/* Related Defensive Tools Card */}
            {article.relatedTools && article.relatedTools.length > 0 && (
              <section aria-labelledby="related-tools-heading" className="pt-6 border-t border-slate-200/90">
                <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900">
                    <Wrench className="w-4 h-4 text-sky-600" />
                    <h2 id="related-tools-heading" className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Related Security Tools
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600">
                    Verify and test your configuration directly with these free standalone SiteSecura utilities:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {article.relatedTools.map((tool) => (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        className="group bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-sky-300 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md">
                            {tool.badge}
                          </span>
                          <h3 className="text-xs font-bold text-slate-900 group-hover:text-sky-600 transition-colors pt-1">
                            {tool.title}
                          </h3>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Related Articles Card */}
            {article.relatedArticles && article.relatedArticles.length > 0 && (
              <section aria-labelledby="related-articles-heading" className="pt-4">
                <div className="space-y-3">
                  <h2 id="related-articles-heading" className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-sky-600" />
                    <span>Related Documentation</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {article.relatedArticles.map((rel) => (
                      <Link
                        key={rel.slug}
                        href={`/docs/${rel.category}/${rel.slug}`}
                        className="group bg-white p-4 rounded-2xl border border-slate-200 hover:border-sky-300 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                      >
                        <span className="text-xs font-bold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-2">
                          {rel.title}
                        </span>
                        <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-sky-600">
                          <span>Read guide</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Previous and Next Navigation */}
            {(prevArticle || nextArticle) && (
              <nav aria-label="Article pagination" className="pt-6 border-t border-slate-200/90 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {prevArticle ? (
                  <Link
                    href={`/docs/${prevArticle.category}/${prevArticle.slug}`}
                    className="group bg-white p-4 rounded-2xl border border-slate-200 hover:border-sky-300 shadow-2xs transition-all flex flex-col text-left"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 group-hover:text-sky-600 transition-colors">
                      <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                      <span>Previous Article</span>
                    </div>
                    <span className="text-xs font-bold text-slate-900 mt-1 line-clamp-1 group-hover:text-sky-600 transition-colors">
                      {prevArticle.title}
                    </span>
                  </Link>
                ) : <div />}

                {nextArticle ? (
                  <Link
                    href={`/docs/${nextArticle.category}/${nextArticle.slug}`}
                    className="group bg-white p-4 rounded-2xl border border-slate-200 hover:border-sky-300 shadow-2xs transition-all flex flex-col text-right sm:ml-auto w-full"
                  >
                    <div className="flex items-center justify-end gap-1.5 text-[11px] font-semibold text-slate-400 group-hover:text-sky-600 transition-colors">
                      <span>Next Article</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 mt-1 line-clamp-1 group-hover:text-sky-600 transition-colors">
                      {nextArticle.title}
                    </span>
                  </Link>
                ) : <div />}
              </nav>
            )}

            {/* Article Feedback Widget */}
            <div className="pt-4">
              <DocsFeedback
                articleSlug={article.slug}
                category={article.category}
                articleTitle={article.title}
                path={`/docs/${article.category}/${article.slug}`}
              />
            </div>
          </article>
        </main>

        {/* Right Column: "On this page" Table of Contents */}
        <DocsTableOfContents items={tocItems} />
      </div>
    </div>
  );
}
