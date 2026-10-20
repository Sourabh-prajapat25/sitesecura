import { getAllArticles, DocArticle } from "@/components/docs/docsArticles";
import { DOC_CATEGORIES, DOC_TOOLS } from "@/components/docs/docsData";
import { slugify } from "@/components/blog/blogUtils";

export interface SearchableSection {
  heading: string;
  anchor: string;
  content: string;
}

export interface SearchIndexEntry {
  id: string;
  type: "article" | "topic" | "tool";
  title: string;
  description: string;
  categoryTitle: string;
  categorySlug: string;
  href: string;
  badge?: string;
  readTimeMinutes?: number;
  keywords: string[];
  headings: string[];
  sections: SearchableSection[];
  bodyText: string;
  directives: string[];
}

export interface SearchResultItem {
  entry: SearchIndexEntry;
  score: number;
  matchType: "title" | "heading" | "directive" | "keyword" | "summary" | "body";
  matchedHeading?: string;
  matchedAnchor?: string;
  excerpt: string;
}

/**
 * Common technical directives and cybersecurity identifiers to index with high relevance.
 */
const TECHNICAL_DIRECTIVES = [
  "hsts",
  "strict-transport-security",
  "csp",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "nosniff",
  "referrer-policy",
  "permissions-policy",
  "default-src",
  "script-src",
  "style-src",
  "object-src",
  "base-uri",
  "frame-ancestors",
  "unsafe-inline",
  "unsafe-eval",
  "sameorigin",
  "deny",
  "spf",
  "v=spf1",
  "dmarc",
  "v=dmarc1",
  "p=reject",
  "p=quarantine",
  "p=none",
  "dkim",
  "dnssec",
  "caa",
  "httponly",
  "samesite",
  "secure",
  "tls",
  "tls 1.2",
  "tls 1.3",
  "tls 1.0",
  "tls 1.1",
  "ssl",
  "san",
  "certificate",
  "certbot",
  "nginx",
  "apache",
  "caddy",
  "cloudflare",
  "celery",
  "rbac",
  "score",
  "deduction",
  "critical",
  "high",
  "medium",
  "low",
];

/**
 * Extracts sections, clean body text, and technical directives from raw markdown.
 */
function parseMarkdownContent(markdown: string): {
  headings: string[];
  sections: SearchableSection[];
  bodyText: string;
  directives: string[];
} {
  const headings: string[] = [];
  const sections: SearchableSection[] = [];
  const foundDirectives = new Set<string>();

  const lines = markdown.split("\n");
  let currentHeading = "Overview";
  let currentAnchor = "";
  let currentLines: string[] = [];

  const lowerMd = markdown.toLowerCase();
  for (const directive of TECHNICAL_DIRECTIVES) {
    if (lowerMd.includes(directive)) {
      foundDirectives.add(directive);
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^(?:##|###)\s+(.+)$/);

    if (headingMatch) {
      if (currentLines.length > 0) {
        sections.push({
          heading: currentHeading,
          anchor: currentAnchor,
          content: currentLines.join(" "),
        });
      }

      const rawHeading = headingMatch[1].replace(/[*_~`]/g, "").trim();
      currentHeading = rawHeading;
      currentAnchor = slugify(rawHeading);
      headings.push(rawHeading);
      currentLines = [];
    } else if (trimmed && !trimmed.startsWith("```")) {
      const cleanLine = trimmed
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[*_~>#-]/g, " ")
        .trim();
      if (cleanLine) {
        currentLines.push(cleanLine);
      }
    }
  }

  if (currentLines.length > 0) {
    sections.push({
      heading: currentHeading,
      anchor: currentAnchor,
      content: currentLines.join(" "),
    });
  }

  const bodyText = sections.map((s) => s.content).join(" ");

  return {
    headings,
    sections,
    bodyText,
    directives: Array.from(foundDirectives),
  };
}

/**
 * Generates an excerpt around the matched search terms.
 */
function createExcerpt(text: string, queryTerms: string[], maxLength = 140): string {
  if (!text) return "";
  const lowerText = text.toLowerCase();
  let firstIndex = -1;

  for (const term of queryTerms) {
    const idx = lowerText.indexOf(term);
    if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) {
      firstIndex = idx;
    }
  }

  if (firstIndex === -1) {
    return text.length > maxLength ? text.slice(0, maxLength).trim() + "..." : text;
  }

  const start = Math.max(0, firstIndex - 40);
  const end = Math.min(text.length, start + maxLength);
  let excerpt = text.slice(start, end).trim();

  if (start > 0) excerpt = "..." + excerpt;
  if (end < text.length) excerpt = excerpt + "...";

  return excerpt;
}

/**
 * Precomputed static search index singleton.
 */
let cachedSearchIndex: SearchIndexEntry[] | null = null;

export function buildDocumentationSearchIndex(): SearchIndexEntry[] {
  if (cachedSearchIndex) return cachedSearchIndex;

  const entries: SearchIndexEntry[] = [];
  const seenHrefs = new Set<string>();

  // 1. Index All Published D2 Articles
  const articles: DocArticle[] = getAllArticles();
  for (const art of articles) {
    const href = `/docs/${art.category}/${art.slug}`;
    seenHrefs.add(href);

    const parsed = parseMarkdownContent(art.content);

    entries.push({
      id: `article-${art.slug}`,
      type: "article",
      title: art.title,
      description: art.description,
      categoryTitle: art.categoryTitle,
      categorySlug: art.category,
      href,
      badge: "Guide & Spec",
      readTimeMinutes: art.readingTimeMinutes,
      keywords: art.keywords,
      headings: parsed.headings,
      sections: parsed.sections,
      bodyText: parsed.bodyText,
      directives: parsed.directives,
    });
  }

  // 2. Index Topics from DOC_CATEGORIES that point to tools or external guides
  for (const cat of DOC_CATEGORIES) {
    for (const topic of cat.topics) {
      if (!seenHrefs.has(topic.href)) {
        seenHrefs.add(topic.href);
        entries.push({
          id: `topic-${topic.id}`,
          type: "topic",
          title: topic.title,
          description: topic.description,
          categoryTitle: cat.title,
          categorySlug: cat.slug,
          href: topic.href,
          badge: topic.badge || "Topic",
          keywords: [cat.title.toLowerCase(), topic.title.toLowerCase()],
          headings: [],
          sections: [],
          bodyText: `${topic.title} ${topic.description}`,
          directives: [],
        });
      }
    }
  }

  // 3. Index Interactive Security Tools
  for (const tool of DOC_TOOLS) {
    if (!seenHrefs.has(tool.href)) {
      seenHrefs.add(tool.href);
      entries.push({
        id: `tool-${tool.id}`,
        type: "tool",
        title: tool.title,
        description: tool.description,
        categoryTitle: "Interactive Utilities",
        categorySlug: "tools",
        href: tool.href,
        badge: tool.badge,
        keywords: [tool.badge.toLowerCase(), "security tool", "utility"],
        headings: [],
        sections: [],
        bodyText: `${tool.title} ${tool.description}`,
        directives: [],
      });
    }
  }

  cachedSearchIndex = entries;
  return entries;
}

/**
 * Searches the documentation index using deterministic scoring and ranking.
 */
export function searchDocumentation(
  rawQuery: string,
  options?: { limit?: number; categoryFilter?: string }
): SearchResultItem[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const index = buildDocumentationSearchIndex();
  const queryTerms = query.split(/\s+/).filter((t) => t.length > 0);
  const limit = options?.limit ?? 12;

  const results: SearchResultItem[] = [];

  for (const entry of index) {
    if (options?.categoryFilter && entry.categorySlug !== options.categoryFilter) {
      continue;
    }

    let score = 0;
    let matchType: SearchResultItem["matchType"] = "summary";
    let matchedHeading: string | undefined;
    let matchedAnchor: string | undefined;
    let matchedContent = entry.description;

    const lowerTitle = entry.title.toLowerCase();
    const lowerDesc = entry.description.toLowerCase();
    const lowerCategory = entry.categoryTitle.toLowerCase();

    // 1. Exact Title Match
    if (lowerTitle === query) {
      score += 120;
      matchType = "title";
    } else if (lowerTitle.includes(query)) {
      score += 80;
      matchType = "title";
    }

    // 2. Technical Directives / Identifiers Match
    for (const directive of entry.directives) {
      if (directive === query || query.includes(directive)) {
        score += 50;
        if (score < 80) matchType = "directive";
      }
    }

    // 3. Headings Match
    for (const section of entry.sections) {
      const lowerHeading = section.heading.toLowerCase();
      if (lowerHeading === query) {
        score += 65;
        matchedHeading = section.heading;
        matchedAnchor = section.anchor;
        matchedContent = section.content;
        matchType = "heading";
        break;
      } else if (lowerHeading.includes(query)) {
        score += 45;
        if (!matchedHeading) {
          matchedHeading = section.heading;
          matchedAnchor = section.anchor;
          matchedContent = section.content;
          matchType = "heading";
        }
      }
    }

    // 4. Keyword Matches
    for (const kw of entry.keywords) {
      const lowerKw = kw.toLowerCase();
      if (lowerKw === query) {
        score += 40;
        if (score < 45) matchType = "keyword";
      } else if (lowerKw.includes(query)) {
        score += 25;
        if (score < 45) matchType = "keyword";
      }
    }

    // 5. Summary / Description Match
    if (lowerDesc.includes(query)) {
      score += 30;
    }

    // 6. Section Body Matches
    for (const section of entry.sections) {
      const lowerSec = section.content.toLowerCase();
      if (lowerSec.includes(query)) {
        score += 20;
        if (!matchedHeading) {
          matchedHeading = section.heading;
          matchedAnchor = section.anchor;
          matchedContent = section.content;
          matchType = "body";
        }
        break;
      }
    }

    // 7. Multi-Term Token Check
    let allTokensPresent = true;
    for (const term of queryTerms) {
      const inTitle = lowerTitle.includes(term);
      const inDesc = lowerDesc.includes(term);
      const inCategory = lowerCategory.includes(term);
      const inBody = entry.bodyText.toLowerCase().includes(term);
      const inDirectives = entry.directives.some((d) => d.includes(term));
      const inKeywords = entry.keywords.some((k) => k.toLowerCase().includes(term));

      if (inTitle) score += 15;
      if (inDesc) score += 10;
      if (inBody) score += 6;
      if (inDirectives) score += 8;
      if (inKeywords) score += 6;

      if (!inTitle && !inDesc && !inCategory && !inBody && !inDirectives && !inKeywords) {
        allTokensPresent = false;
      }
    }

    // If query has multiple terms, require all tokens to match somewhere in the document
    if (queryTerms.length > 1 && !allTokensPresent) {
      continue;
    }

    if (score > 0) {
      const excerpt = createExcerpt(matchedContent || entry.description, queryTerms);
      results.push({
        entry,
        score,
        matchType,
        matchedHeading,
        matchedAnchor,
        excerpt,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}
