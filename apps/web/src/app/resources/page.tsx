import React from "react";
import { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { api } from "@/lib/api";
import { Resource, BlogPost } from "@/types";
import { getSiteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { ResourcesHero } from "@/components/resources/ResourcesHero";
import { ResourceHubClient } from "@/components/resources/ResourceHubClient";
import { ResourceFAQ } from "@/components/resources/ResourceFAQ";
import { RESOURCE_FAQS } from "@/components/resources/faqData";
import { ResourcesConversionCTA } from "@/components/resources/ResourcesConversionCTA";
import { NewsletterSignup } from "@/components/blog/NewsletterSignup";

export const revalidate = 60; // ISR cache every 60 seconds

export function generateMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  const title = "Website Security Tools, Checklists & Guides | SiteSecura";
  const description =
    "Explore actionable website security implementation guides, hardening checklists, and free defensive web utilities from SiteSecura.";
  const canonical = `${siteUrl}/resources`;

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

export default async function ResourcesPage() {
  const siteUrl = getSiteUrl();
  let initialResources: Resource[] = [];
  let initialArticles: BlogPost[] = [];

  // Graceful data fetching for offline development or initial empty databases
  try {
    const [resourceData, blogData] = await Promise.allSettled([
      api.getResources({ page_size: 50 }),
      api.getBlogPosts({ page_size: 6 }),
    ]);

    if (resourceData.status === "fulfilled" && resourceData.value?.items) {
      initialResources = resourceData.value.items;
    }

    if (blogData.status === "fulfilled" && blogData.value?.items) {
      initialArticles = blogData.value.items;
    }
  } catch (err) {
    initialResources = [];
    initialArticles = [];
  }

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
        name: "Resources",
        item: `${siteUrl}/resources`,
      },
    ],
  };

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "SiteSecura Technical Resources & Defensive Tools",
    description:
      "Curated cybersecurity hardening checklists, technical deployment guides, verification templates, and instant security testing utilities.",
    url: `${siteUrl}/resources`,
    publisher: {
      "@type": "Organization",
      name: "SiteSecura",
      url: siteUrl,
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: RESOURCE_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F9FC] text-slate-900 selection:bg-sky-500 selection:text-white">
      <JsonLd data={breadcrumbsSchema} />
      <JsonLd data={collectionSchema} />
      <JsonLd data={faqSchema} />
      <Navbar />

      <main className="flex-1">
        {/* Section B: Hero */}
        <ResourcesHero />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-16">
          {/* Section C (Finder/Filters), Section D (Tools), Section E (Guides), Section F (Checklists) */}
          <ResourceHubClient
            initialResources={initialResources}
            initialArticles={initialArticles}
          />

          {/* Section H: FAQ */}
          <ResourceFAQ />

          {/* Section G: Bottom Conversion CTA */}
          <ResourcesConversionCTA />

          {/* Newsletter Signup */}
          <div className="pt-2">
            <NewsletterSignup
              source="resources_hub"
              title="Stay Ahead of Emerging Vulnerabilities"
              description="Subscribe to receive our latest security checklists, defensive hardening walkthroughs, and CVE analyses directly in your inbox."
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
