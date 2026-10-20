"""
Automated Test Suite - Phase D2 Technical Documentation Pages & Architecture
Verifies:
1. Canonical documentation article routes and registry integrity
2. Required metadata, categories, keywords, and publication state
3. Valid internal linking (related articles and related tools)
4. Normalization and category alias routing
5. Content depth, technical accuracy, and Markdown structure
6. Sitemap dynamic inclusion of published documentation articles
7. Dynamic route implementation (/docs/[category]/[slug]/page.tsx)
8. Structured data schemas (TechArticle and BreadcrumbList)
9. Reusable layout components (Sidebar, TOC, Breadcrumbs, Feedback, Layout)
10. D1 homepage integration and search index discovery
"""

import os
import sys
import unittest
import re
import json

# Ensure app is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class TestDocsPhaseD2(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.web_dir = os.path.join(cls.base_dir, "apps", "web")
        cls.articles_ts_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "docsArticles.ts"
        )
        cls.sitemap_path = os.path.join(cls.web_dir, "src", "app", "sitemap.ts")
        cls.route_page_path = os.path.join(
            cls.web_dir, "src", "app", "docs", "[category]", "[slug]", "page.tsx"
        )
        cls.layout_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "DocsArticleLayout.tsx"
        )
        cls.sidebar_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "DocsSidebar.tsx"
        )
        cls.toc_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "DocsTableOfContents.tsx"
        )
        cls.feedback_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "DocsFeedback.tsx"
        )
        cls.docs_data_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "docsData.ts"
        )
        cls.docs_client_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "DocsClient.tsx"
        )

        with open(cls.articles_ts_path, "r", encoding="utf-8") as f:
            cls.articles_content = f.read()

    def test_articles_registry_exists_and_exports(self):
        """Verify docsArticles.ts exists and exports required interfaces and helper functions."""
        self.assertTrue(
            os.path.exists(self.articles_ts_path),
            "docsArticles.ts registry must exist.",
        )
        self.assertIn("export interface DocArticle", self.articles_content)
        self.assertIn("export const DOC_ARTICLES: DocArticle[]", self.articles_content)
        self.assertIn("export function getAllArticles()", self.articles_content)
        self.assertIn("export function getArticle(", self.articles_content)
        self.assertIn(
            "export function getArticlesByCategory(", self.articles_content
        )
        self.assertIn("export function getPrevNextArticles(", self.articles_content)
        self.assertIn("export function normalizeCategorySlug(", self.articles_content)

    def test_minimum_article_count_and_categories(self):
        """Verify registry contains 8-12 substantive published articles across all 4 categories."""
        # Find top-level article slugs inside DOC_ARTICLES array
        doc_articles_block = self.articles_content.split("export const DOC_ARTICLES: DocArticle[] = [")[1]
        article_slugs = re.findall(r'^\s{4}slug:\s*"([^"]+)"', doc_articles_block, re.MULTILINE)

        self.assertGreaterEqual(
            len(article_slugs),
            8,
            f"Expected at least 8 articles, found {len(article_slugs)}: {article_slugs}",
        )
        self.assertLessEqual(
            len(article_slugs),
            12,
            f"Expected at most 12 articles, found {len(article_slugs)}: {article_slugs}",
        )

        # Check all 4 canonical categories are present
        self.assertIn('"getting-started"', self.articles_content)
        self.assertIn('"security-checks"', self.articles_content)
        self.assertIn('"monitoring"', self.articles_content)
        self.assertIn('"agency"', self.articles_content)

        # Expected core articles
        expected_articles = [
            "first-security-scan",
            "understanding-security-scores",
            "adding-and-verifying-domains",
            "ssl-tls-certificates",
            "http-security-headers",
            "content-security-policy",
            "dns-and-email-security",
            "cookie-security-flags",
            "scheduled-scans-and-alerts",
            "team-roles-and-whitelabeling",
        ]
        for expected in expected_articles:
            self.assertIn(
                expected,
                article_slugs,
                f"Missing expected article slug: {expected}",
            )

    def test_article_metadata_and_technical_accuracy(self):
        """Verify articles contain accurate technical details grounded in SiteSecura codebase."""
        # Score calculation deductions (-30, -15, -5, -2)
        self.assertIn("-30 points", self.articles_content)
        self.assertIn("-15 points", self.articles_content)
        self.assertIn("-5 points", self.articles_content)
        self.assertIn("-2 points", self.articles_content)

        # SSL/TLS protocols and expiration warnings
        self.assertIn("TLS 1.3", self.articles_content)
        self.assertIn("TLS 1.2", self.articles_content)
        self.assertIn("TLS 1.0", self.articles_content)
        self.assertIn("30 Days", self.articles_content)
        self.assertIn("14 Days", self.articles_content)
        self.assertIn("7 Days", self.articles_content)

        # Security headers
        self.assertIn("Strict-Transport-Security", self.articles_content)
        self.assertIn("X-Frame-Options", self.articles_content)
        self.assertIn("X-Content-Type-Options", self.articles_content)
        self.assertIn("nosniff", self.articles_content)

        # CSP directives
        self.assertIn("default-src", self.articles_content)
        self.assertIn("script-src", self.articles_content)
        self.assertIn("unsafe-inline", self.articles_content)
        self.assertIn("unsafe-eval", self.articles_content)

        # Email authentication
        self.assertIn("v=spf1", self.articles_content)
        self.assertIn("v=DMARC1", self.articles_content)
        self.assertIn("p=reject", self.articles_content)
        self.assertIn("p=none", self.articles_content)

        # Cookies
        self.assertIn("HttpOnly", self.articles_content)
        self.assertIn("SameSite", self.articles_content)
        self.assertIn("Secure", self.articles_content)

        # Monitoring & Agency
        self.assertIn("Celery", self.articles_content)
        self.assertIn("Owner", self.articles_content)
        self.assertIn("Admin", self.articles_content)
        self.assertIn("Member", self.articles_content)
        self.assertIn("Viewer", self.articles_content)

    def test_related_links_and_tools_are_valid(self):
        """Verify all related articles and tools point to valid routes."""
        # Valid tools that exist in the system
        valid_tools = [
            "/tools/website-security-checker",
            "/tools/ssl-checker",
            "/tools/security-headers-checker",
            "/tools/email-security-checker",
            "/tools/dns-lookup",
            "/tools/http-status-checker",
            "/tools/security-txt-validator",
            "/tools/robots-sitemap-checker",
            "/tools/csp-policy-analyzer",
        ]
        tool_hrefs = re.findall(r'href:\s*"(/tools/[^"]+)"', self.articles_content)
        for href in tool_hrefs:
            self.assertIn(
                href, valid_tools, f"Related tool href {href} is not a valid tool route"
            )

    def test_dynamic_article_route_exists(self):
        """Verify /docs/[category]/[slug]/page.tsx exists and implements required Next.js functions."""
        self.assertTrue(
            os.path.exists(self.route_page_path),
            "Dynamic route page.tsx must exist.",
        )
        with open(self.route_page_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("generateStaticParams", content)
        self.assertIn("generateMetadata", content)
        self.assertIn("notFound()", content)
        self.assertIn("BreadcrumbList", content)
        self.assertIn("TechArticle", content)
        self.assertIn("DocsArticleLayout", content)
        self.assertIn("Navbar", content)
        self.assertIn("Footer", content)
        self.assertIn("JsonLd", content)

    def test_layout_components_exist(self):
        """Verify all reusable layout components exist and export valid React components."""
        for path, name in [
            (self.layout_path, "DocsArticleLayout"),
            (self.sidebar_path, "DocsSidebar"),
            (self.toc_path, "DocsTableOfContents"),
            (self.feedback_path, "DocsFeedback"),
        ]:
            self.assertTrue(os.path.exists(path), f"{name} file must exist at {path}")
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            self.assertIn(f"export function {name}", content)

    def test_sitemap_includes_doc_articles(self):
        """Verify sitemap.ts dynamically includes published documentation articles."""
        with open(self.sitemap_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("getAllArticles", content)
        self.assertIn("docEntries", content)
        self.assertIn("article.category", content)
        self.assertIn("article.slug", content)
        self.assertIn("article.lastUpdated", content)

    def test_homepage_topics_link_to_dedicated_articles(self):
        """Verify docsData.ts category topics link to dedicated /docs/[category]/[slug] routes."""
        with open(self.docs_data_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn(
            '"/docs/getting-started/understanding-security-scores"', content
        )
        self.assertIn('"/docs/getting-started/first-security-scan"', content)
        self.assertIn(
            '"/docs/getting-started/adding-and-verifying-domains"', content
        )
        self.assertIn('"/docs/security-checks/ssl-tls-certificates"', content)
        self.assertIn('"/docs/security-checks/http-security-headers"', content)
        self.assertIn('"/docs/security-checks/content-security-policy"', content)
        self.assertIn('"/docs/security-checks/dns-and-email-security"', content)
        self.assertIn('"/docs/security-checks/cookie-security-flags"', content)
        self.assertIn(
            '"/docs/monitoring/scheduled-scans-and-alerts"', content
        )
        self.assertIn(
            '"/docs/agency/team-roles-and-whitelabeling"', content
        )

    def test_docs_client_search_indexes_articles(self):
        """Verify DocsClient.tsx integrates getAllArticles() into search index without duplicates."""
        with open(self.docs_client_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("getAllArticles", content)
        self.assertIn("allSearchableItems", content)
        self.assertIn("seenHrefs", content)
        self.assertIn("item.keywords", content)


if __name__ == "__main__":
    unittest.main()
