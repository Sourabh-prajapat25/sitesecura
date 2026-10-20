/**
 * SiteSecura - SEO Engine & Structured Data Utilities
 * Phase E4: Dynamic Article Metadata, JSON-LD Schemas, Canonical URLs, and Sanitization
 */
import { Metadata } from "next";
import { BlogPost, BlogPostFAQ } from "@/types";

/**
 * Returns the normalized site origin URL from environment variables,
 * defaulting to https://sitesecura.com in production and http://localhost:3000 in development.
 * Guarantees no trailing slashes.
 */
export function getSiteUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production" ? "https://sitesecura.com" : "http://localhost:3000");

  return configured.replace(/\/+$/, "");
}

/**
 * Validates whether a URL uses an allowed web protocol (http, https) or valid relative path.
 * Strictly neutralizes javascript:, data:, vbscript:, and file: schemes.
 */
export function isSafeSeoUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("vbscript:") ||
    trimmed.startsWith("file:")
  ) {
    return false;
  }
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  );
}

/**
 * Converts a path or URL into an absolute URL using the configured site origin.
 * Rejects unsafe schemes and handles both relative paths and external absolute URLs.
 */
export function toAbsoluteUrl(pathOrUrl?: string | null): string {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return "";
  const trimmed = pathOrUrl.trim();
  if (!isSafeSeoUrl(trimmed)) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const siteUrl = getSiteUrl();
  const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${siteUrl}${cleanPath}`;
}

/**
 * Safely strips Markdown formatting, code blocks, images, and HTML tags,
 * converting rich text to clean plain text.
 */
export function stripMarkdown(markdown?: string | null): string {
  if (!markdown) return "";
  let text = markdown;

  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/`([^`]+)`/g, "$1");

  // Remove images ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "");

  // Convert links [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, " ");

  // Remove headings (# Heading)
  text = text.replace(/^#{1,6}\s+/gm, "");

  // Remove blockquotes (> Quote)
  text = text.replace(/^>\s+/gm, "");

  // Remove bullet points / list markers
  text = text.replace(/^[\s]*[-*+]\s+/gm, "");
  text = text.replace(/^[\s]*\d+\.\s+/gm, "");

  // Remove bold / italic / strikethrough tokens
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");
  text = text.replace(/~~(.*?)~~/g, "$1");

  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, "");

  // Collapse multiple whitespaces and newlines
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Derives a clean meta description from excerpt or article Markdown body,
 * safely truncating to the specified maximum length without mutating stored content.
 */
export function deriveMetaDescription(
  content?: string | null,
  fallbackExcerpt?: string | null,
  maxLength: number = 160
): string {
  if (fallbackExcerpt && fallbackExcerpt.trim().length > 0) {
    const cleanExcerpt = fallbackExcerpt.trim().replace(/\s+/g, " ");
    if (cleanExcerpt.length <= maxLength) return cleanExcerpt;
    return cleanExcerpt.substring(0, maxLength - 3).trim() + "...";
  }

  const plain = stripMarkdown(content || "");
  if (!plain) return "SiteSecura website security guide and technical insights.";
  if (plain.length <= maxLength) return plain;

  // Truncate at word boundary
  const sub = plain.substring(0, maxLength - 3);
  const lastSpace = sub.lastIndexOf(" ");
  const truncated = lastSpace > 100 ? sub.substring(0, lastSpace) : sub;
  return `${truncated}...`;
}

/**
 * Safely serializes data to a JSON string for application/ld+json scripts.
 * Replaces '<' with '\u003c' and '>' with '\u003e' to neutralize script breakouts like
 * </script><script>alert(1)</script>.
 */
export function safeJsonLd(data: any): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

/**
 * Builds deterministic Next.js Metadata for a published blog post.
 */
export function buildArticleMetadata(post: BlogPost): Metadata {
  const siteUrl = getSiteUrl();

  // 1. Title precedence
  const title = (post.seo_title && post.seo_title.trim().length > 0)
    ? post.seo_title.trim()
    : post.title;

  // 2. Description precedence
  const description = (post.meta_description && post.meta_description.trim().length > 0)
    ? post.meta_description.trim()
    : (post.excerpt && post.excerpt.trim().length > 0)
    ? post.excerpt.trim()
    : deriveMetaDescription(post.content);

  // 3. Canonical URL
  const postUrl = `${siteUrl}/blog/${post.slug}`;
  let canonicalUrl = postUrl;
  if (post.canonical_url && isSafeSeoUrl(post.canonical_url)) {
    const trimmed = post.canonical_url.trim();
    canonicalUrl = trimmed.startsWith("http") ? trimmed : toAbsoluteUrl(trimmed);
  }

  // 4. Representative Image Precedence (OG & Twitter)
  let imageUrl = "";
  let imageWidth: number | undefined;
  let imageHeight: number | undefined;
  let imageAlt: string | undefined;

  if (post.og_image && isSafeSeoUrl(post.og_image)) {
    imageUrl = toAbsoluteUrl(post.og_image);
  } else if (post.featured_media?.public_url && isSafeSeoUrl(post.featured_media.public_url)) {
    imageUrl = toAbsoluteUrl(post.featured_media.public_url);
    imageWidth = post.featured_media.width || undefined;
    imageHeight = post.featured_media.height || undefined;
    imageAlt = post.featured_media.alt_text || post.title;
  } else if (post.featured_image && isSafeSeoUrl(post.featured_image)) {
    imageUrl = toAbsoluteUrl(post.featured_image);
  } else {
    imageUrl = `${siteUrl}/images/og-default.png`;
  }

  const ogImages = imageUrl
    ? [
        {
          url: imageUrl,
          width: imageWidth || 1200,
          height: imageHeight || 630,
          alt: imageAlt || title,
        },
      ]
    : [];

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: postUrl,
      siteName: "SiteSecura",
      locale: "en_US",
      type: "article",
      publishedTime: post.published_at || undefined,
      modifiedTime: post.updated_at || post.published_at || undefined,
      images: ogImages,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

/**
 * Builds Schema.org BlogPosting structured data for published articles.
 */
export function buildArticleJsonLd(post: BlogPost): Record<string, any> {
  const siteUrl = getSiteUrl();
  const canonicalUrl = (post.canonical_url && isSafeSeoUrl(post.canonical_url))
    ? toAbsoluteUrl(post.canonical_url)
    : `${siteUrl}/blog/${post.slug}`;

  const headline = (post.seo_title && post.seo_title.trim().length > 0)
    ? post.seo_title.trim()
    : post.title;

  const description = (post.meta_description && post.meta_description.trim().length > 0)
    ? post.meta_description.trim()
    : (post.excerpt && post.excerpt.trim().length > 0)
    ? post.excerpt.trim()
    : deriveMetaDescription(post.content);

  const rawImageUrl = post.featured_media?.public_url || post.featured_image || post.og_image;
  const imageUrl = isSafeSeoUrl(rawImageUrl) ? toAbsoluteUrl(rawImageUrl) : `${siteUrl}/images/og-default.png`;

  const schema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline,
    description,
    url: canonicalUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at || post.published_at || post.created_at,
    author: {
      "@type": post.author ? "Person" : "Organization",
      name: post.author?.name || "SiteSecura Security Engineering",
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "SiteSecura",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/images/logo.png`,
      },
    },
  };

  if (post.category?.name) {
    schema.articleSection = post.category.name;
  }

  if (imageUrl) {
    schema.image = imageUrl;
  }

  return schema;
}

/**
 * Builds Schema.org BreadcrumbList structured data for an article.
 * Adheres strictly to: Home -> Blog -> Article.
 */
export function buildBreadcrumbJsonLd(post: BlogPost): Record<string, any> {
  const siteUrl = getSiteUrl();
  const postUrl = `${siteUrl}/blog/${post.slug}`;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${siteUrl}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${siteUrl}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: postUrl,
      },
    ],
  };
}

/**
 * Builds Schema.org FAQPage structured data from article FAQs.
 * Returns null if no valid FAQs are present.
 */
export function buildFaqJsonLd(faqs?: BlogPostFAQ[] | null): Record<string, any> | null {
  if (!faqs || faqs.length === 0) return null;

  const validFaqs = faqs.filter(
    (f) => f.question && f.question.trim().length > 0 && f.answer && f.answer.trim().length > 0
  );

  if (validFaqs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: validFaqs.map((f) => ({
      "@type": "Question",
      name: f.question.trim(),
      acceptedAnswer: {
        "@type": "Answer",
        text: stripMarkdown(f.answer.trim()),
      },
    })),
  };
}
