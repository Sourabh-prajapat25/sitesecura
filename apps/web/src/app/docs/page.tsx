import React from "react";
import { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DocsClient } from "@/components/docs/DocsClient";
import { JsonLd } from "@/components/JsonLd";
import { getSiteUrl } from "@/lib/seo";

export function generateMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  const title = "SiteSecura Documentation | Website Security Guides";
  const description =
    "Learn how to use SiteSecura to assess website security, understand scan results, and explore practical security configuration guides.";
  const canonical = `${siteUrl}/docs`;

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
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function DocsPage() {
  const siteUrl = getSiteUrl();

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
    ],
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "SiteSecura Documentation",
    description:
      "Learn how to assess website security, understand scan results, and configure SiteSecura's defensive security tools.",
    url: `${siteUrl}/docs`,
    isPartOf: {
      "@type": "WebSite",
      name: "SiteSecura",
      url: siteUrl,
    },
    inLanguage: "en-US",
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F9FC]">
      {/* SECTION A: Existing Global Header */}
      <Navbar />

      {/* Structured Data */}
      <JsonLd data={breadcrumbsSchema} />
      <JsonLd data={webPageSchema} />

      {/* Main Documentation Portal Content */}
      <main className="flex-1">
        <DocsClient />
      </main>

      {/* SECTION H: Existing Global Footer */}
      <Footer />
    </div>
  );
}
