import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { DocsArticleLayout } from "@/components/docs/DocsArticleLayout";
import {
  getAllArticles,
  getArticle,
  getPrevNextArticles,
} from "@/components/docs/docsArticles";
import { getSiteUrl } from "@/lib/seo";

interface PageProps {
  params: {
    category: string;
    slug: string;
  };
}

export function generateStaticParams() {
  const articles = getAllArticles();
  return articles.map((article) => ({
    category: article.category,
    slug: article.slug,
  }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const siteUrl = getSiteUrl();
  const article = getArticle(params.category, params.slug);

  if (!article) {
    return {
      title: "Article Not Found | SiteSecura Documentation",
      description: "The requested documentation guide could not be located.",
    };
  }

  const title = `${article.title} | SiteSecura Documentation`;
  const description = article.description;
  const canonical = `${siteUrl}/docs/${article.category}/${article.slug}`;

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "SiteSecura",
      locale: "en_US",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function DocArticlePage({ params }: PageProps) {
  const article = getArticle(params.category, params.slug);

  if (!article) {
    notFound();
  }

  const siteUrl = getSiteUrl();
  const articleUrl = `${siteUrl}/docs/${article.category}/${article.slug}`;
  const { prev, next } = getPrevNextArticles(params.category, params.slug);

  const breadcrumbsSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Documentation",
        item: `${siteUrl}/docs`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.categoryTitle,
        item: `${siteUrl}/docs#${article.category}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: article.title,
        item: articleUrl,
      },
    ],
  };

  const techArticleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: article.title,
    description: article.description,
    url: articleUrl,
    datePublished: article.lastUpdated,
    dateModified: article.lastUpdated,
    publisher: {
      "@type": "Organization",
      name: "SiteSecura",
      url: siteUrl,
    },
    inLanguage: "en-US",
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F9FC]">
      <Navbar />

      <JsonLd data={breadcrumbsSchema} />
      <JsonLd data={techArticleSchema} />

      <div className="flex-1">
        <DocsArticleLayout
          article={article}
          prevArticle={prev}
          nextArticle={next}
        />
      </div>

      <Footer />
    </div>
  );
}
