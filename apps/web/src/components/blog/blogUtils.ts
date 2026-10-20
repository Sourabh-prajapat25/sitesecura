import React from "react";

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

/**
 * Normalizes a heading text into a deterministic, URL-safe anchor slug.
 */
export function slugify(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Extracts plain text recursively from a React node tree (used for heading IDs).
 */
export function extractTextFromNode(node: React.ReactNode): string {
  if (!node) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromNode).join("");
  if (React.isValidElement(node) && node.props && "children" in node.props) {
    return extractTextFromNode(node.props.children);
  }
  return "";
}

/**
 * Deterministically extracts Table of Contents (H2 and H3) from Markdown content.
 * Safely ignores headings nested within fenced code blocks (```).
 */
export function extractTocFromMarkdown(content?: string | null): TocItem[] {
  if (!content) return [];
  const lines = content.split("\n");
  const items: TocItem[] = [];
  let inCodeBlock = false;
  const seenSlugs: Record<string, number> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Check for H2 (## ) and H3 (### )
    const h3Match = trimmed.match(/^###\s+(.+)$/);
    const h2Match = trimmed.match(/^##\s+(.+)$/);

    if (h3Match) {
      const rawText = h3Match[1].replace(/[*_~`]/g, "").trim();
      let slug = slugify(rawText);
      if (!slug) slug = `section-${items.length + 1}`;
      if (seenSlugs[slug]) {
        seenSlugs[slug] += 1;
        slug = `${slug}-${seenSlugs[slug]}`;
      } else {
        seenSlugs[slug] = 1;
      }
      items.push({ id: slug, text: rawText, level: 3 });
    } else if (h2Match) {
      const rawText = h2Match[1].replace(/[*_~`]/g, "").trim();
      let slug = slugify(rawText);
      if (!slug) slug = `section-${items.length + 1}`;
      if (seenSlugs[slug]) {
        seenSlugs[slug] += 1;
        slug = `${slug}-${seenSlugs[slug]}`;
      } else {
        seenSlugs[slug] = 1;
      }
      items.push({ id: slug, text: rawText, level: 2 });
    }
  }

  return items;
}

/**
 * Calculates estimated reading time in minutes based on average technical reading speed (220 WPM).
 */
export function calculateReadingTime(content?: string | null): number {
  if (!content) return 1;
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

/**
 * Formats an ISO date string into a consistent, human-readable publication date.
 */
export function formatDate(dateString?: string | null): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
