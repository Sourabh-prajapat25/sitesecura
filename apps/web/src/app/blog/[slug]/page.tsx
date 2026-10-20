import React from "react";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { JsonLd } from "@/components/JsonLd";
import { ArticleFaqAccordion } from "@/components/ArticleFaqAccordion";
import { api } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/utils";
import {
  buildArticleMetadata,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/lib/seo";
import { BlogPost } from "@/types";
import { ArticleBreadcrumbs } from "@/components/blog/ArticleBreadcrumbs";
import { ArticleHeader } from "@/components/blog/ArticleHeader";
import { ArticleTableOfContents } from "@/components/blog/ArticleTableOfContents";
import { ArticleShareBar } from "@/components/blog/ArticleShareBar";
import { BlogCTA, BlogCTAVariant } from "@/components/blog/BlogCTA";
import { NewsletterSignup } from "@/components/blog/NewsletterSignup";
import { BlogArticleTelemetry } from "@/components/blog/BlogArticleTelemetry";
import { RelatedArticles } from "@/components/blog/RelatedArticles";
import { extractTocFromMarkdown } from "@/components/blog/blogUtils";

interface PageProps {
  params: {
    slug: string;
  };
}

async function getPostOrRedirect(slug: string): Promise<{
  post: BlogPost | null;
  targetSlug: string | null;
}> {
  try {
    const post = await api.getBlogPost(slug);
    if (post && post.id) {
      return { post, targetSlug: null };
    }
  } catch {
    // Post not found directly under current slug
  }

  // Check for historical slug redirect (Phase E4)
  try {
    const redirectInfo = await api.getBlogRedirect(slug);
    if (redirectInfo && redirectInfo.target_slug) {
      return { post: null, targetSlug: redirectInfo.target_slug };
    }
  } catch {
    // No redirect registered
  }

  return { post: null, targetSlug: null };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { post } = await getPostOrRedirect(params.slug);
  if (!post) {
    return {
      title: "Article Not Found | SiteSecura",
      robots: { index: false, follow: false },
    };
  }

  return buildArticleMetadata(post);
}

export default async function BlogPostDetailPage({ params }: PageProps) {
  const { post, targetSlug } = await getPostOrRedirect(params.slug);

  if (targetSlug) {
    // 308 Permanent redirect to updated article slug (Phase E4)
    redirect(`/blog/${targetSlug}`);
  }

  if (!post) {
    notFound();
  }

  // Generate Schema.org JSON-LD structured data (Phase E4)
  const articleJsonLd = buildArticleJsonLd(post);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(post);
  const faqJsonLd = buildFaqJsonLd(post.faqs);

  const featuredImageUrl = resolveMediaUrl(
    post.featured_media?.public_url || post.featured_image
  );
  const featuredImageAlt = post.featured_media?.alt_text || post.title;
  const featuredImageCaption = post.featured_media?.caption;

  // Extract deterministic Table of Contents from content
  const tocItems = extractTocFromMarkdown(post.content);

  // Determine contextual CTA variant
  const getContextualVariant = (categorySlug?: string, title?: string): BlogCTAVariant => {
    const text = `${categorySlug || ""} ${title || ""}`.toLowerCase();
    if (text.includes("ssl") || text.includes("tls") || text.includes("cert")) return "ssl";
    if (text.includes("header") || text.includes("csp") || text.includes("hsts")) return "headers";
    if (text.includes("email") || text.includes("dns") || text.includes("dmarc") || text.includes("spf")) return "email";
    if (text.includes("compliance") || text.includes("nist") || text.includes("owasp")) return "compliance";
    return "general";
  };
  const ctaVariant = getContextualVariant(post.category?.slug, post.title);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50">
      {/* Schema.org Structured Data */}
      <JsonLd data={articleJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      <BlogArticleTelemetry slug={post.slug} />

      <Navbar />

      <main className="flex-1 py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumbs Navigation */}
          <div className="mb-6">
            <ArticleBreadcrumbs category={post.category} title={post.title} />
          </div>

          {/* Two-Column Editorial Layout (Content + Sticky TOC) */}
          <div className="flex flex-col lg:flex-row items-start justify-center gap-10 xl:gap-14">
            {/* Primary Reading Column */}
            <article className="w-full max-w-[760px] bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 lg:p-12 shadow-sm space-y-8">
              {/* Structured Article Header */}
              <ArticleHeader post={post} />

              {/* High-Resolution Featured Image */}
              {featuredImageUrl && (
                <figure className="my-8">
                  <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-slate-900">
                    <img
                      src={featuredImageUrl}
                      alt={featuredImageAlt}
                      className="w-full h-full object-cover"
                      loading="eager"
                    />
                  </div>
                  {featuredImageCaption && (
                    <figcaption className="text-center text-xs text-slate-500 mt-2.5 italic">
                      {featuredImageCaption}
                    </figcaption>
                  )}
                </figure>
              )}

              {/* Mobile Collapsible Table of Contents */}
              <ArticleTableOfContents items={tocItems} variant="mobile" />

              {/* Safe Markdown Content Body */}
              <section aria-label="Article content" className="pt-2">
                <MarkdownRenderer content={post.content} theme="light" />
              </section>

              {/* Visible Frequently Asked Questions (FAQ) */}
              <ArticleFaqAccordion faqs={post.faqs} />

              {/* Share & Navigation Controls */}
              <div className="pt-4 border-t border-slate-100">
                <ArticleShareBar title={post.title} slug={post.slug} />
              </div>

              {/* In-Article Defensive Security Callout */}
              <BlogCTA
                className="my-8"
                variant={ctaVariant}
                articleSlug={post.slug}
                source="blog_article"
                campaign={post.slug}
              />

              {/* Newsletter Dispatch */}
              <div className="pt-4 border-t border-slate-100">
                <NewsletterSignup
                  source={`article_${post.slug}`}
                  title="Subscribe to Security Insights"
                  description="Receive practical defensive blueprints, vulnerability analyses, and security updates directly from our engineering team."
                />
              </div>
            </article>

            {/* Desktop Sticky Table of Contents Sidebar */}
            {tocItems.length > 0 && (
              <ArticleTableOfContents items={tocItems} variant="desktop" />
            )}
          </div>

          {/* Related Articles Section */}
          <div className="max-w-[760px] lg:max-w-6xl mx-auto mt-12">
            <RelatedArticles posts={post.related_posts} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
