import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import { BlogPost } from "@/types";

export const revalidate = 3600; // Cache for 1 hour

function escapeXml(unsafe?: string | null): string {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

export async function GET() {
  const siteUrl = "https://sitesecura.com";
  let posts: BlogPost[] = [];

  try {
    const res = await api.getBlogPosts({ page: 1, page_size: 50 });
    posts = Array.isArray(res) ? res : res?.items || [];
  } catch {
    posts = [];
  }

  const latestPostDate = posts.length > 0 && posts[0].published_at
    ? new Date(posts[0].published_at).toUTCString()
    : new Date().toUTCString();

  const itemsXml = posts
    .map((post) => {
      const postUrl = `${siteUrl}/blog/${post.slug}`;
      const pubDate = post.published_at
        ? new Date(post.published_at).toUTCString()
        : new Date(post.created_at).toUTCString();
      const categoryName = post.category ? post.category.name : "";
      const authorName = post.author ? post.author.name : "SiteSecura Engineering";

      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(post.excerpt || post.seo_title || post.title)}</description>
      ${categoryName ? `<category>${escapeXml(categoryName)}</category>` : ""}
      <author>${escapeXml(authorName)}</author>
    </item>`;
    })
    .join("\n");

  const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SiteSecura Cybersecurity Research &amp; Insights</title>
    <link>${siteUrl}/blog</link>
    <description>Actionable vulnerability analysis, defensive guidelines, and enterprise website security insights.</description>
    <language>en-us</language>
    <lastBuildDate>${latestPostDate}</lastBuildDate>
    <atom:link href="${siteUrl}/blog/rss.xml" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(rssFeed, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
