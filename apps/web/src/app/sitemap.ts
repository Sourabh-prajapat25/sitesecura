import { MetadataRoute } from "next";
import { getSiteUrl, toAbsoluteUrl, isSafeSeoUrl } from "@/lib/seo";
import { api } from "@/lib/api";
import { getAllArticles } from "@/components/docs/docsArticles";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  const staticRoutes = [
    "",
    "/features",
    "/pricing",
    "/blog",
    "/docs",
    "/resources",
    "/tools/website-security-checker",
    "/tools/ssl-checker",
    "/tools/security-headers-checker",
    "/tools/email-security-checker",
    "/tools/dns-lookup",
    "/tools/http-status-checker",
    "/tools/security-txt-validator",
    "/tools/robots-sitemap-checker",
    "/tools/csp-policy-analyzer",
    "/docs/tools/security-config-generator",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    "/cookies",
    "/responsible-disclosure",
    "/fair-usage",
    "/status",
    "/login",
    "/register",
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority:
      route === ""
        ? 1.0
        : route.startsWith("/tools/") || route === "/blog" || route === "/resources"
        ? 0.9
        : 0.8,
  }));

  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    const publishedPosts = await api.getBlogSitemapPosts();
    if (Array.isArray(publishedPosts)) {
      blogEntries = publishedPosts
        .filter((post) => post && post.slug)
        .map((post) => {
          const rawImg = post.featured_media_url || post.featured_image;
          const safeImg = rawImg && isSafeSeoUrl(rawImg) ? toAbsoluteUrl(rawImg) : undefined;

          const lastModDate = post.updated_at
            ? new Date(post.updated_at)
            : post.published_at
            ? new Date(post.published_at)
            : new Date();

          return {
            url: `${siteUrl}/blog/${post.slug}`,
            lastModified: lastModDate,
            changeFrequency: "weekly" as const,
            priority: 0.7,
            images: safeImg ? [safeImg] : undefined,
          };
        });
    }
  } catch (err) {
    console.error("Failed to dynamically load published blog posts for sitemap:", err);
  }

  let resourceEntries: MetadataRoute.Sitemap = [];
  try {
    const resources = await api.getResourceSitemapItems();
    if (Array.isArray(resources)) {
      resourceEntries = resources
        .filter((r) => r && r.slug)
        .map((r) => {
          const lastModDate = r.updated_at
            ? new Date(r.updated_at)
            : r.published_at
            ? new Date(r.published_at)
            : new Date();

          return {
            url: `${siteUrl}/resources/${r.slug}`,
            lastModified: lastModDate,
            changeFrequency: "weekly" as const,
            priority: 0.7,
          };
        });
    }
  } catch (err) {
    console.error("Failed to dynamically load published resources for sitemap:", err);
  }

  const docArticles = getAllArticles();
  const docEntries: MetadataRoute.Sitemap = docArticles.map((article) => ({
    url: `${siteUrl}/docs/${article.category}/${article.slug}`,
    lastModified: new Date(article.lastUpdated),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticEntries, ...docEntries, ...blogEntries, ...resourceEntries];
}
