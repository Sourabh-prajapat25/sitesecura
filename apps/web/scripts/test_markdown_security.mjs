/**
 * SiteSecura - Phase E2 Markdown Security & Sanitization Automated Test Suite
 * Tests neutralization of XSS attack vectors, protocol validation, and GFM features.
 */
import assert from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownRenderer, isSafeUrl } from "../src/components/MarkdownRenderer.tsx";

console.log("============================================================");
console.log("RUNNING PHASE E2 MARKDOWN SECURITY & FEATURE TESTS");
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
// 1. URL SCHEME SANITIZATION TESTS
// ------------------------------------------------------------
runTest("Neutralizes javascript: URL scheme", () => {
  assert.strictEqual(isSafeUrl("javascript:alert(1)"), false);
  assert.strictEqual(isSafeUrl("JAVASCRIPT:alert(document.cookie)"), false);
  assert.strictEqual(isSafeUrl("  javascript:void(0)"), false);
});

runTest("Neutralizes vbscript: URL scheme", () => {
  assert.strictEqual(isSafeUrl("vbscript:msgbox(1)"), false);
  assert.strictEqual(isSafeUrl("VBSCRIPT:run()"), false);
});

runTest("Neutralizes data: URL scheme", () => {
  assert.strictEqual(isSafeUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="), false);
  assert.strictEqual(isSafeUrl("DATA:image/svg+xml,..."), false);
});

runTest("Allows legitimate web protocols and relative paths", () => {
  assert.strictEqual(isSafeUrl("https://sitesecura.com"), true);
  assert.strictEqual(isSafeUrl("http://example.com/guide"), true);
  assert.strictEqual(isSafeUrl("mailto:support@sitesecura.com"), true);
  assert.strictEqual(isSafeUrl("/blog/understanding-hsts"), true);
  assert.strictEqual(isSafeUrl("#security-checklist"), true);
  assert.strictEqual(isSafeUrl(""), false);
  assert.strictEqual(isSafeUrl(undefined), false);
});

// ------------------------------------------------------------
// 2. XSS PAYLOAD NEUTRALIZATION IN RENDERED HTML
// ------------------------------------------------------------
runTest("Neutralizes raw <script> tag execution", () => {
  const markdown = "Hello <script>alert('xss')</script> World";
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));

  // Must NOT produce an active <script> tag element
  assert.strictEqual(html.includes("<script>"), false);
  assert.strictEqual(html.includes("<script"), false);
  // Must be escaped as harmless text entity
  assert.strictEqual(html.includes("&lt;script&gt;"), true);
});

runTest("Neutralizes <img src=x onerror=alert(1)> attribute injection", () => {
  const markdown = "Check this out: <img src=x onerror=alert(1)>";
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));

  // Must NOT produce an active <img> element
  assert.strictEqual(html.includes("<img"), false);
  // Must be safely escaped into text entity
  assert.strictEqual(html.includes("&lt;img"), true);
});

runTest("Neutralizes [Click me](javascript:alert(1)) markdown links", () => {
  const markdown = "[Click me](javascript:alert(1))";
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));

  assert.strictEqual(html.includes('href="javascript:'), false);
  assert.strictEqual(html.includes('href="#"'), true);
});

runTest("Neutralizes [VBScript](vbscript:msgbox(1)) markdown links", () => {
  const markdown = "[VBScript](vbscript:msgbox(1))";
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));

  assert.strictEqual(html.includes('href="vbscript:'), false);
  assert.strictEqual(html.includes('href="#"'), true);
});

runTest("Neutralizes <iframe> and <object> embed injection", () => {
  const markdown = "<iframe src='https://malicious.example.com'></iframe><object data='payload.swf'></object>";
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));

  assert.strictEqual(html.includes("<iframe"), false);
  assert.strictEqual(html.includes("<object"), false);
  assert.strictEqual(html.includes("&lt;iframe"), true);
  assert.strictEqual(html.includes("&lt;object"), true);
});

runTest("Neutralizes inline SVG with onload attributes", () => {
  const markdown = "<svg onload=alert(1)><circle r=10/></svg>";
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));

  // Must NOT produce an active <svg> element
  assert.strictEqual(html.includes("<svg"), false);
  // Must be safely escaped into text entity
  assert.strictEqual(html.includes("&lt;svg"), true);
});

// ------------------------------------------------------------
// 3. MARKDOWN SYNTAX & GFM FEATURE TESTS
// ------------------------------------------------------------
runTest("Renders Headings correctly", () => {
  const markdown = "# Heading 1\n## Heading 2\n### Heading 3";
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));

  assert.strictEqual(html.includes("<h1"), true);
  assert.strictEqual(html.includes("Heading 1</h1>"), true);
  assert.strictEqual(html.includes("<h2"), true);
  assert.strictEqual(html.includes("Heading 2</h2>"), true);
  assert.strictEqual(html.includes("<h3"), true);
  assert.strictEqual(html.includes("Heading 3</h3>"), true);
});

runTest("Renders Bold, Italic, and Strikethrough", () => {
  const markdown = "This is **bold**, this is *italic*, and this is ~~deprecated~~.";
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));

  assert.strictEqual(html.includes("<strong"), true);
  assert.strictEqual(html.includes("bold</strong>"), true);
  assert.strictEqual(html.includes("<em"), true);
  assert.strictEqual(html.includes("italic</em>"), true);
  assert.strictEqual(html.includes("<del"), true);
  assert.strictEqual(html.includes("deprecated</del>"), true);
});

runTest("Renders Unordered and Ordered Lists", () => {
  const markdown = "- Item Alpha\n- Item Beta\n\n1. Step One\n2. Step Two";
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));

  assert.strictEqual(html.includes("<ul"), true);
  assert.strictEqual(html.includes("<ol"), true);
  assert.strictEqual(html.includes("Item Alpha</li>"), true);
  assert.strictEqual(html.includes("Step One</li>"), true);
});

runTest("Renders Blockquotes", () => {
  const markdown = "> Strict Transport Security is mandatory.";
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));

  assert.strictEqual(html.includes("<blockquote"), true);
  assert.strictEqual(html.includes("Strict Transport Security is mandatory."), true);
});

runTest("Renders Inline Code and Fenced Code Blocks", () => {
  const markdown = "Run `curl -I https://sitesecura.com` to inspect headers.\n\n```bash\ncurl -s https://api.sitesecura.com\n```";
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));

  assert.strictEqual(html.includes("<code"), true);
  assert.strictEqual(html.includes("curl -I https://sitesecura.com"), true);
  assert.strictEqual(html.includes("BASH"), true); // Language badge
  assert.strictEqual(html.includes("Copy"), true); // Copy button
  assert.strictEqual(html.includes("curl -s https://api.sitesecura.com"), true);
});

runTest("Renders GFM Tables", () => {
  const markdown = "| Header A | Header B |\n| --- | --- |\n| Value 1 | Value 2 |";
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));

  assert.strictEqual(html.includes("<table"), true);
  assert.strictEqual(html.includes("<thead"), true);
  assert.strictEqual(html.includes("<tbody"), true);
  assert.strictEqual(html.includes("Header A</th>"), true);
  assert.strictEqual(html.includes("Value 1</td>"), true);
});

runTest("Renders Horizontal Rules", () => {
  const markdown = "Above\n\n---\n\nBelow";
  const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));

  assert.strictEqual(html.includes("<hr"), true);
});

runTest("Handles plain text, empty content, and multiline content safely", () => {
  const emptyHtml = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: "" }));
  assert.strictEqual(typeof emptyHtml, "string");

  const plainHtml = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: "Plain simple sentence." }));
  assert.strictEqual(plainHtml.includes("Plain simple sentence."), true);

  const multilineHtml = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: "Line 1\n\nLine 2\n\nLine 3" }));
  assert.strictEqual(multilineHtml.includes("Line 1"), true);
  assert.strictEqual(multilineHtml.includes("Line 3"), true);
});

console.log("============================================================");
console.log(`TOTAL PASSED: ${testsPassed}`);
console.log(`TOTAL FAILED: ${testsFailed}`);
console.log("============================================================");

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log("All Markdown security & feature tests passed successfully!");
}
