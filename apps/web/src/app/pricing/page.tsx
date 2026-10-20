import React from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PricingContent } from "@/components/pricing/PricingContent";
import { PRICING_PLANS, PRICING_PAGE_FAQS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "SiteSecura Pricing | Website Security Plans",
  description:
    "Compare SiteSecura Free, Basic, Pro, and Agency plans. Choose flexible monthly or annual pricing for website security scanning, monitoring, alerts, and reporting.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "SiteSecura Pricing | Website Security Plans",
    description:
      "Compare SiteSecura Free, Basic, Pro, and Agency plans. Choose flexible monthly or annual pricing for website security scanning, monitoring, alerts, and reporting.",
    url: "https://sitesecura.com/pricing",
    siteName: "SiteSecura",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SiteSecura Pricing | Website Security Plans",
    description:
      "Compare SiteSecura Free, Basic, Pro, and Agency plans. Choose flexible monthly or annual pricing for website security scanning, monitoring, alerts, and reporting.",
  },
};

export default function PricingPage() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production" ? "https://sitesecura.com" : "http://localhost:3000");

  const jsonLdData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "SiteSecura Website Security Platform",
        operatingSystem: "Web",
        applicationCategory: "SecurityApplication",
        description:
          "Defensive website cybersecurity posture assessment and continuous automated monitoring.",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: "0",
          highPrice: "990",
          offerCount: "4",
          offers: PRICING_PLANS.map((plan) => ({
            "@type": "Offer",
            name: `${plan.name} Plan`,
            price: plan.monthlyPrice.toString(),
            priceCurrency: "USD",
            description: plan.description,
            url: `${siteUrl}/pricing`,
          })),
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: PRICING_PAGE_FAQS.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 selection:bg-sky-500 selection:text-white">
      {/* Search Engine Structured Data (JSON-LD) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
      />

      {/* Global Navigation Header */}
      <Navbar />

      {/* Main Pricing Interactive View */}
      <main className="flex-1">
        <PricingContent />
      </main>

      {/* Global Footer */}
      <Footer />
    </div>
  );
}
