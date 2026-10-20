import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { BlogCTA, BlogCTAVariant } from "@/components/blog/BlogCTA";
import { NewsletterSignup } from "@/components/blog/NewsletterSignup";
import { JsonLd } from "@/components/JsonLd";
import { api } from "@/lib/api";
import { Resource } from "@/types";
import {
  ChevronRight,
  Download,
  ExternalLink,
  Calendar,
  Layers,
  ArrowLeft,
  Shield,
  BookOpen,
  CheckSquare,
  Wrench,
  FileText,
} from "lucide-react";
import { ResourceDetailTelemetry } from "./ResourceDetailTelemetry";

interface ResourcePageProps {
  params: {
    slug: string;
  };
}

export const revalidate = 60;

export async function generateMetadata({ params }: ResourcePageProps): Promise<Metadata> {
  try {
    const resource = await api.getResource(params.slug);
    if (!resource || resource.status !== "published") {
      return {
        title: "Resource Not Found | SiteSecura",
        robots: { index: false, follow: false },
      };
    }

    const title = `${resource.title} | SiteSecura Resources`;
    const description = resource.description || "Defensive cybersecurity guide and technical documentation.";
    const canonical = `https://sitesecura.com/resources/${resource.slug}`;

    return {
      title,
      description,
      alternates: {
        canonical,
      },
      openGraph: {
        title,
        description,
        url: canonical,
        siteName: "SiteSecura",
        type: "article",
        publishedTime: resource.published_at || undefined,
        images: resource.featured_image ? [{ url: resource.featured_image }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: resource.featured_image ? [resource.featured_image] : undefined,
      },
    };
  } catch {
    return {
      title: "Resource Not Found | SiteSecura",
      robots: { index: false, follow: false },
    };
  }
}

export default async function ResourceDetailPage({ params }: ResourcePageProps) {
  let resource: Resource | null = null;

  try {
    resource = await api.getResource(params.slug);
  } catch {
    notFound();
  }

  if (!resource || resource.status !== "published") {
    notFound();
  }

  // Determine contextual CTA variant
  const getContextualVariant = (category?: string | null, type?: string): BlogCTAVariant => {
    const text = `${category || ""} ${type || ""}`.toLowerCase();
    if (text.includes("ssl") || text.includes("tls") || text.includes("cert")) return "ssl";
    if (text.includes("header") || text.includes("csp") || text.includes("hsts")) return "headers";
    if (text.includes("email") || text.includes("dns") || text.includes("dmarc") || text.includes("spf")) return "email";
    if (text.includes("compliance") || text.includes("nist") || text.includes("owasp")) return "compliance";
    return "general";
  };

  const ctaVariant = getContextualVariant(resource.category, resource.resource_type);

  const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "checklist":
        return CheckSquare;
      case "tool":
        return Wrench;
      case "template":
        return FileText;
      case "guide":
        return BookOpen;
      default:
        return Shield;
    }
  };

  const TypeIcon = getIcon(resource.resource_type);

  const breadcrumbsSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://sitesecura.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Resources",
        item: "https://sitesecura.com/resources",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: resource.title,
        item: `https://sitesecura.com/resources/${resource.slug}`,
      },
    ],
  };

  const techArticleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: resource.title,
    description: resource.description,
    url: `https://sitesecura.com/resources/${resource.slug}`,
    datePublished: resource.published_at || resource.created_at,
    dateModified: resource.updated_at || resource.published_at || resource.created_at,
    publisher: {
      "@type": "Organization",
      name: "SiteSecura",
      url: "https://sitesecura.com",
    },
    inLanguage: "en-US",
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F9FC] text-slate-900 selection:bg-sky-500 selection:text-white">
      <JsonLd data={breadcrumbsSchema} />
      <JsonLd data={techArticleSchema} />
      <ResourceDetailTelemetry slug={resource.slug} resourceType={resource.resource_type} />
      <Navbar />

      <main className="flex-1 py-12 sm:py-16">
        <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <Link href="/resources" className="hover:text-slate-900 transition-colors">
              Resources
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-800 font-semibold truncate max-w-[200px] sm:max-w-xs">
              {resource.title}
            </span>
          </nav>

          {/* Header */}
          <header className="space-y-4 border-b border-slate-200 pb-8">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 uppercase tracking-wide">
                <TypeIcon className="w-3.5 h-3.5" />
                <span>{resource.resource_type}</span>
              </span>
              {resource.category && (
                <span className="text-xs text-slate-600 font-medium px-2.5 py-1 rounded-md bg-white border border-slate-200">
                  {resource.category}
                </span>
              )}
              {resource.published_at && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <time dateTime={resource.published_at}>
                    {new Date(resource.published_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-950 tracking-tight leading-tight">
              {resource.title}
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-3xl">
              {resource.description}
            </p>

            {/* Direct Action Buttons */}
            {(resource.file_url || resource.external_url) && (
              <div className="pt-2 flex flex-wrap items-center gap-3">
                {resource.file_url && (
                  <a
                    href={resource.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-sky-600/20 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Resource Asset</span>
                  </a>
                )}
                {resource.external_url && (
                  <a
                    href={resource.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open External Resource</span>
                  </a>
                )}
              </div>
            )}
          </header>

          {/* Body Content */}
          {resource.content ? (
            <div className="py-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-2xs">
              <MarkdownRenderer content={resource.content} theme="light" />
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-slate-600 text-sm shadow-2xs">
              <p>
                This resource includes downloadable or external verification assets. Please use the links above to access the materials.
              </p>
            </div>
          )}

          {/* Contextual CTA */}
          <div className="pt-6">
            <BlogCTA
              variant={ctaVariant}
              articleSlug={resource.slug}
              source="resource_detail"
              campaign={`resource_${resource.slug}`}
            />
          </div>

          {/* Newsletter Signup */}
          <div className="pt-4">
            <NewsletterSignup
              source={`resource_${resource.slug}`}
              title="Want More Defensive Runbooks?"
              description="Get newly released checklists, CVE remediations, and engineering architecture deep-dives delivered to your inbox."
            />
          </div>

          {/* Back to Hub Link */}
          <div className="pt-4 border-t border-slate-200">
            <Link
              href="/resources"
              className="inline-flex items-center gap-2 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to all resources</span>
            </Link>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
