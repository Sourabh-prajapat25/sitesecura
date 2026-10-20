import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Website Security Guides & Insights",
  description:
    "Actionable cybersecurity tutorials on SSL/TLS encryption, SPF/DMARC email authentication, and HTTP security header hardening.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Website Security Guides & Insights | SiteSecura Blog",
    description:
      "Actionable cybersecurity tutorials on SSL/TLS encryption, SPF/DMARC email authentication, and HTTP security header hardening.",
    url: "/blog",
    siteName: "SiteSecura",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Website Security Guides & Insights | SiteSecura Blog",
    description:
      "Actionable cybersecurity tutorials on SSL/TLS encryption, SPF/DMARC email authentication, and HTTP security header hardening.",
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
