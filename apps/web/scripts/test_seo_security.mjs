/**
 * SiteSecura - Phase E4: Frontend SEO & Security Test Suite
 * Tests SEO sanitization, JSON-LD script breakout neutralization,
 * URL security filtering, markdown stripping, and schema generation.
 */
import assert from "node:assert";
import {
  getSiteUrl,
  isSafeSeoUrl,
  toAbsoluteUrl,
  stripMarkdown,
  deriveMetaDescription,
  safeJsonLd,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "../src/lib/seo.ts";

console.log("====================================================");
console.log("RUNNING PHASE E4 FRONTEND SEO & SECURITY TEST SUITE");
console.log("====================================================");

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failed++;
  }
}

// 1. safeJsonLd XSS script breakout neutralization
runTest("safeJsonLd neutralizes </script> breakout injection", () => {
  const malicious = {
    title: "</script><script>alert('pwned')</script>",
    description: "Security analysis <!-- with comment injection -->",
  };
  const serialized = safeJsonLd(malicious);
  assert(!serialized.includes("</script>"), "Must not contain raw </script>");
  assert(!serialized.includes("<script>"), "Must not contain raw <script>");
  assert(!serialized.includes("<!--"), "Must not contain raw HTML comment starter");
  assert(serialized.includes("\\u003c/script\\u003e"), "Must contain escaped \\u003c/script\\u003e");
  
  // Verify it can still be cleanly parsed as JSON
  const parsed = JSON.parse(serialized);
  assert.strictEqual(parsed.title, "</script><script>alert('pwned')</script>");
});

// 2. isSafeSeoUrl protocol validation
runTest("isSafeSeoUrl permits valid http, https, and relative URLs", () => {
  assert(isSafeSeoUrl("https://sitesecura.com/blog/test"));
  assert(isSafeSeoUrl("http://localhost:3000/blog"));
  assert(isSafeSeoUrl("/blog/understanding-headers"));
  assert(isSafeSeoUrl("/images/og-preview.png"));
});

runTest("isSafeSeoUrl rejects dangerous URI schemes", () => {
  assert(!isSafeSeoUrl("javascript:alert(document.cookie)"));
  assert(!isSafeSeoUrl("JAVASCRIPT:alert(1)"));
  assert(!isSafeSeoUrl("data:text/html,<script>alert(1)</script>"));
  assert(!isSafeSeoUrl("vbscript:MsgBox(1)"));
  assert(!isSafeSeoUrl("file:///etc/passwd"));
  assert(!isSafeSeoUrl(null));
  assert(!isSafeSeoUrl(undefined));
  assert(!isSafeSeoUrl(""));
});

// 3. toAbsoluteUrl normalization
runTest("toAbsoluteUrl generates valid absolute URLs and filters unsafe schemes", () => {
  const siteUrl = getSiteUrl();
  assert.strictEqual(
    toAbsoluteUrl("/blog/security-audit"),
    `${siteUrl}/blog/security-audit`
  );
  assert.strictEqual(
    toAbsoluteUrl("https://external-cdn.com/image.png"),
    "https://external-cdn.com/image.png"
  );
  assert.strictEqual(toAbsoluteUrl("javascript:alert(1)"), "");
  assert.strictEqual(toAbsoluteUrl("data:text/html,test"), "");
  assert.strictEqual(toAbsoluteUrl(null), "");
});

// 4. stripMarkdown & deriveMetaDescription
runTest("stripMarkdown removes markdown tokens cleanly", () => {
  const md = "# Header 1\n\nThis is **bold** text and *italic* and [a link](https://sitesecura.com).\n\n```python\ncode\n```\n> A quote";
  const stripped = stripMarkdown(md);
  assert(!stripped.includes("# Header 1"), "Header token must be stripped");
  assert(!stripped.includes("**bold**"), "Bold token must be stripped");
  assert(!stripped.includes("[a link]"), "Link syntax must be stripped");
  assert(stripped.includes("bold text and italic and a link"), "Text content must be preserved");
  assert(stripped.includes("A quote"), "Quote content must be preserved");
});

runTest("deriveMetaDescription truncates to target max length without orphan words", () => {
  const longText = "This is a comprehensive cybersecurity analysis explaining how malicious threat actors utilize sophisticated techniques to bypass web application firewalls and penetrate backend services.";
  const meta = deriveMetaDescription(null, longText, 80);
  assert(meta.length <= 83, `Description length ${meta.length} exceeds limit`);
  assert(meta.endsWith("..."), "Must end with ellipsis when truncated");
});

// 5. Schema generators: BlogPosting, Breadcrumbs, FAQs
runTest("buildArticleJsonLd outputs valid Schema.org BlogPosting", () => {
  const post = {
    id: "1",
    title: "Guide to CSP Headers",
    slug: "guide-to-csp-headers",
    excerpt: "Learn how to configure CSP headers.",
    content: "Full markdown content goes here.",
    status: "published",
    published_at: "2026-09-23T12:00:00Z",
    updated_at: "2026-09-23T14:00:00Z",
    created_at: "2026-09-23T10:00:00Z",
    category: { id: "c1", name: "Security", slug: "security" },
    featured_image: "/media/csp-header.png",
  };
  const jsonLd = buildArticleJsonLd(post);
  assert.strictEqual(jsonLd["@context"], "https://schema.org");
  assert.strictEqual(jsonLd["@type"], "BlogPosting");
  assert.strictEqual(jsonLd.headline, "Guide to CSP Headers");
  assert.strictEqual(jsonLd.articleSection, "Security");
  assert.strictEqual(jsonLd.author["@type"], "Organization");
  assert.strictEqual(jsonLd.publisher.name, "SiteSecura");
});

runTest("buildBreadcrumbJsonLd outputs valid BreadcrumbList", () => {
  const post = {
    id: "1",
    title: "Guide to CSP Headers",
    slug: "guide-to-csp-headers",
    content: "",
    status: "published",
    created_at: "",
    updated_at: "",
  };
  const breadcrumb = buildBreadcrumbJsonLd(post);
  assert.strictEqual(breadcrumb["@context"], "https://schema.org");
  assert.strictEqual(breadcrumb["@type"], "BreadcrumbList");
  assert.strictEqual(breadcrumb.itemListElement.length, 3);
  assert.strictEqual(breadcrumb.itemListElement[0].name, "Home");
  assert.strictEqual(breadcrumb.itemListElement[1].name, "Blog");
  assert.strictEqual(breadcrumb.itemListElement[2].name, "Guide to CSP Headers");
});

runTest("buildFaqJsonLd outputs valid FAQPage schema and ignores empty items", () => {
  const faqs = [
    { id: "f1", blog_post_id: "1", question: "What is CSP?", answer: "Content Security Policy.", display_order: 1, created_at: "" },
    { id: "f2", blog_post_id: "1", question: "", answer: "Empty question", display_order: 2, created_at: "" },
    { id: "f3", blog_post_id: "1", question: "Is CSP enough?", answer: "No, defense in depth is required.", display_order: 3, created_at: "" },
  ];
  const faqSchema = buildFaqJsonLd(faqs);
  assert(faqSchema !== null, "Schema should not be null");
  assert.strictEqual(faqSchema["@type"], "FAQPage");
  assert.strictEqual(faqSchema.mainEntity.length, 2, "Only non-empty question/answers should be included");
  assert.strictEqual(faqSchema.mainEntity[0].name, "What is CSP?");
  assert.strictEqual(faqSchema.mainEntity[0].acceptedAnswer.text, "Content Security Policy.");
});

runTest("safeJsonLd safely neutralizes script breakouts inside FAQ items", () => {
  const maliciousFaqs = [
    {
      id: "f1",
      blog_post_id: "1",
      question: "Can an attacker break out? </script><script>alert(1)</script>",
      answer: "Not with safeJsonLd escaping! </script>",
      display_order: 1,
      created_at: "",
    },
  ];
  const schema = buildFaqJsonLd(maliciousFaqs);
  const serialized = safeJsonLd(schema);
  assert(!serialized.includes("</script>"), "Serialized JSON-LD must never contain raw </script>");
  assert(serialized.includes("\\u003c/script\\u003e"), "Must have escaped unicode breakout");
});

console.log("====================================================");
console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
console.log("====================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
