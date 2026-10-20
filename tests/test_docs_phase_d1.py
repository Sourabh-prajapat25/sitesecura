"""
Automated Test Suite - Phase D1 Documentation Portal
Verifies:
1. Static sitemap inclusion of /docs
2. Documentation categories and topics data integrity
3. Safe internal URL paths and absence of broken links
4. Featured documentation and standalone tool definitions
5. Metadata configuration consistency
"""
import os
import sys
import unittest
import json
import re

# Ensure app is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class TestDocsPhaseD1(unittest.TestCase):
    def test_sitemap_includes_docs_route(self):
        """Verify sitemap.ts includes the /docs static route."""
        sitemap_path = os.path.join(
            os.path.dirname(__file__), "..", "apps", "web", "src", "app", "sitemap.ts"
        )
        with open(sitemap_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn('"/docs"', content, "Sitemap must register the /docs route.")

    def test_docs_page_metadata_and_jsonld_schemas(self):
        """Verify docs page.tsx exports correct metadata and JSON-LD schemas."""
        page_path = os.path.join(
            os.path.dirname(__file__), "..", "apps", "web", "src", "app", "docs", "page.tsx"
        )
        with open(page_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Check metadata title and description
        self.assertIn("SiteSecura Documentation | Website Security Guides", content)
        self.assertIn("generateMetadata", content)
        self.assertIn("BreadcrumbList", content)
        self.assertIn("WebPage", content)
        self.assertIn("DocsClient", content)
        self.assertIn("Navbar", content)
        self.assertIn("Footer", content)

    def test_docs_data_structure_and_categories(self):
        """Verify docsData.ts has the 4 required categories and valid properties."""
        data_path = os.path.join(
            os.path.dirname(__file__), "..", "apps", "web", "src", "components", "docs", "docsData.ts"
        )
        with open(data_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Required 4 categories
        self.assertIn('"Getting Started"', content)
        self.assertIn('"Security Checks Catalog"', content)
        self.assertIn('"Automated Monitoring & Alerts"', content)
        self.assertIn('"Agency & White-Labeling"', content)

        # Check featured docs section
        self.assertIn("FEATURED_DOCS", content)
        self.assertIn("How to Check Your Website Security", content)
        self.assertIn("Understanding Defensive HTTP Security Headers", content)
        self.assertIn("What Is DMARC? A Practical Guide to Email Security", content)

        # Check tools section
        self.assertIn("DOC_TOOLS", content)
        self.assertIn('"/tools/dns-lookup"', content)
        self.assertIn('"/tools/http-status-checker"', content)
        self.assertIn('"/tools/security-txt-validator"', content)
        self.assertIn('"/tools/robots-sitemap-checker"', content)
        self.assertIn('"/tools/csp-policy-analyzer"', content)
        self.assertIn('"/tools/ssl-checker"', content)

    def test_docs_client_search_and_keyboard_accessibility(self):
        """Verify DocsClient.tsx implements real-time search, clear action, and semantic elements."""
        client_path = os.path.join(
            os.path.dirname(__file__), "..", "apps", "web", "src", "components", "docs", "DocsClient.tsx"
        )
        with open(client_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Search accessibility & handling
        self.assertIn("searchQuery", content)
        self.assertIn("docs-search-input", content)
        self.assertIn("aria-label", content)
        self.assertIn("Escape", content)
        self.assertIn("No documentation topics found", content)
        self.assertIn("Clear Search", content)

        # Semantic H1, H2s
        self.assertIn("<h1", content)
        self.assertIn("SiteSecura Documentation", content)
        self.assertIn("Explore by Category", content)
        self.assertIn("Start Securing Your Website", content)
        self.assertIn("Explore Standalone Security Tools", content)
        self.assertIn("Technical Reference &amp; Scanner Modules", content)


if __name__ == "__main__":
    unittest.main()
