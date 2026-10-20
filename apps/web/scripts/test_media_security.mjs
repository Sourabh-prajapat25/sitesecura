/**
 * SiteSecura - Phase E3 Media & Article Content Automated Test Suite
 * Tests media URL resolution, Markdown image rendering, alt text preservation,
 * and neutralization of dangerous image protocols (javascript:, vbscript:, data:).
 */
import assert from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownRenderer, isSafeUrl } from "../src/components/MarkdownRenderer.tsx";
import { resolveMediaUrl } from "../src/lib/utils.ts";

console.log("============================================================");
console.log("RUNNING PHASE E3 MEDIA SECURITY & RENDERING TESTS");
console.log("============================================================");

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    testsFailed++;
  }
}

// ------------------------------------------------------------
// 1. PROTOCOL VALIDATION & RESOLUTION
// ------------------------------------------------------------
runTest("Allows legitimate media relative URLs", () => {
  assert.strictEqual(isSafeUrl("/api/v1/media/2026/09/banner.webp"), true);
  assert.strictEqual(isSafeUrl("/api/v1/media/2026/09/diagram.png"), true);
  assert.strictEqual(isSafeUrl("/api/v1/media/2026/09/photo.jpg"), true);
});

runTest("Allows external HTTPS and HTTP image URLs", () => {
  assert.strictEqual(isSafeUrl("https://images.unsplash.com/photo-1234"), true);
  assert.strictEqual(isSafeUrl("http://cdn.sitesecura.com/assets/logo.png"), true);
});

runTest("Strictly blocks dangerous protocols in image URLs", () => {
  assert.strictEqual(isSafeUrl("javascript:alert('XSS')"), false);
  assert.strictEqual(isSafeUrl("JAVASCRIPT:alert(1)"), false);
  assert.strictEqual(isSafeUrl("vbscript:msgbox(1)"), false);
  assert.strictEqual(isSafeUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="), false);
  assert.strictEqual(isSafeUrl("data:text/html,<script>alert(1)</script>"), false);
});

runTest("resolveMediaUrl properly handles various URL formats", () => {
  // External HTTPS
  assert.strictEqual(
    resolveMediaUrl("https://example.com/image.png"),
    "https://example.com/image.png"
  );
  // Null and empty
  assert.strictEqual(resolveMediaUrl(null), "");
  assert.strictEqual(resolveMediaUrl(undefined), "");
  assert.strictEqual(resolveMediaUrl(""), "");

  // Relative API path
  const resolved = resolveMediaUrl("/api/v1/media/2026/09/hero.webp");
  assert.ok(resolved.endsWith("/api/v1/media/2026/09/hero.webp"));
});

// ------------------------------------------------------------
// 2. MARKDOWN IMAGE RENDERING & SANITIZATION
// ------------------------------------------------------------
runTest("Renders safe markdown images with alt text and lazy loading", () => {
  const md = "![Network Architecture](/api/v1/media/2026/09/net.webp)";
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: md }));

  assert.ok(html.includes("<img"), "HTML should contain an img tag");
  assert.ok(html.includes('alt="Network Architecture"'), "HTML should contain the alt text");
  assert.ok(html.includes('loading="lazy"'), "HTML should specify loading=lazy");
  assert.ok(html.includes("/api/v1/media/2026/09/net.webp"), "HTML should contain image src");
});

runTest("Renders image caption via title attribute as figcaption", () => {
  const md = '![Architecture](/api/v1/media/2026/09/net.webp "Figure 1: SiteSecura Architecture")';
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: md }));

  assert.ok(html.includes("<figcaption"), "HTML should contain a figcaption tag");
  assert.ok(
    html.includes("Figure 1: SiteSecura Architecture"),
    "HTML should contain the caption text"
  );
});

runTest("Neutralizes malicious javascript: image sources completely", () => {
  const md = "![Exploit Attempt](javascript:alert(document.domain))";
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: md }));

  assert.ok(
    !html.includes("<img"),
    "Renderer must not render img tag for javascript: URL"
  );
  assert.ok(
    !html.includes("javascript:"),
    "Output must not contain javascript: protocol"
  );
});

runTest("Neutralizes malicious data: image sources completely", () => {
  const md = "![SVG XSS](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)";
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: md }));

  assert.ok(
    !html.includes("<img"),
    "Renderer must not render img tag for data: URL"
  );
});

// ------------------------------------------------------------
// SUMMARY
// ------------------------------------------------------------
console.log("============================================================");
console.log(`PHASE E3 MEDIA SECURITY TESTS COMPLETED: ${testsPassed} passed, ${testsFailed} failed`);
console.log("============================================================");

if (testsFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
