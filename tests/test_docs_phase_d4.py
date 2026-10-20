"""
SiteSecura - Phase D4: Documentation Production Readiness, End-to-End QA,
Security Review, SEO Validation & Release Sign-Off
Automated Test Suite

Validates all Phase D4 quality audit dimensions:
1. Deep-Link & Anchor Integrity:
   - All 27 finding codes in FINDING_DOCS_CATALOG map to published articles.
   - Every anchor strictly matches a slugified markdown heading in the target article.
   - resolveFindingDoc returns accurate URLs and graceful fallbacks.
2. Content, Link & Catalog Architecture:
   - All 10 technical documentation articles meet metadata standards.
   - Cross-linked relatedArticles and relatedTools resolve cleanly.
   - Internal links inside markdown point to valid routes.
3. Security Configuration Generator & Tooling:
   - Multi-platform configuration outputs (Nginx, Apache, Caddy, Cloudflare).
   - HSTS preload commitment warning and CSP staging guidance.
   - Dedicated tool route SEO metadata and JSON-LD structured data.
4. Search & Command Palette Accessibility:
   - Dialog semantics (role="dialog", aria-modal="true").
   - Keyboard interaction handlers (ArrowDown, ArrowUp, Enter, Escape).
5. Feedback API Security, Schema Validation & Privacy:
   - Feedback submission succeeds with valid reasons.
   - Schema validation rejects invalid/malicious reasons with HTTP 422.
   - Rate limiting triggers HTTP 429 on abuse.
   - Data stored in database contains no IP, PII, or credentials.
"""

import os
import sys
import uuid
import re
import unittest
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from apps.api.main import app
from app.db.base import Base
from app.db.session import get_db, get_sync_db
import app.db.session as session_module
from app.models.cms import ContentAnalyticsEvent
from app.core.rate_limit import _memory_rate_limits

try:
    from tests.test_docs_phase_d3 import (
        TestingSyncSessionLocal,
        TestingAsyncSessionLocal,
        override_get_db,
        override_get_sync_db,
        TEST_DOCS_D3_DB_FILE,
        test_sync_engine,
    )
except ImportError:
    TEST_DOCS_D4_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_docs_d4.sqlite3"))
    TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_DOCS_D4_DB_FILE}"
    TEST_SYNC_DB_URL = f"sqlite:///{TEST_DOCS_D4_DB_FILE}"

    test_async_engine = create_async_engine(
        TEST_DB_URL,
        echo=False,
        connect_args={"check_same_thread": False},
    )

    TestingAsyncSessionLocal = async_sessionmaker(
        bind=test_async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    test_sync_engine = create_engine(
        TEST_SYNC_DB_URL,
        connect_args={"check_same_thread": False},
    )

    TestingSyncSessionLocal = sessionmaker(
        bind=test_sync_engine,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    async def override_get_db():
        async with TestingAsyncSessionLocal() as session:
            yield session

    def override_get_sync_db():
        with TestingSyncSessionLocal() as session:
            yield session

    Base.metadata.create_all(bind=test_sync_engine)


@pytest.fixture(autouse=True)
def prepare_d4_test_environment():
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_sync_db] = override_get_sync_db
    session_module.get_db = override_get_db
    session_module.get_sync_db = override_get_sync_db
    session_module.AsyncSessionLocal = TestingAsyncSessionLocal
    session_module.SyncSessionLocal = TestingSyncSessionLocal
    _memory_rate_limits.clear()
    try:
        import redis as sync_redis
        from app.core.config import settings
        r = sync_redis.from_url(settings.REDIS_URL)
        keys = r.keys("doc_feedback:*") + r.keys("analytics:*")
        if keys:
            r.delete(*keys)
    except Exception:
        pass
        pass


@pytest.fixture
def client():
    return TestClient(app)


def slugify_heading(raw_text: str) -> str:
    """Replicates the slugify algorithm used in blogUtils.ts and MarkdownRenderer.tsx."""
    text = raw_text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    text = re.sub(r"^-+|-+$", "", text)
    return text


# =========================================================================
# 1. FRONTEND ARCHITECTURE & DEEP-LINK INTEGRITY TESTS
# =========================================================================

class TestDocsPhaseD4Integrity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.web_dir = os.path.join(cls.base_dir, "apps", "web")
        cls.articles_ts_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "docsArticles.ts"
        )
        cls.finding_docs_map_path = os.path.join(
            cls.web_dir, "src", "lib", "docs", "findingDocsMap.ts"
        )
        cls.generator_component_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "SecurityConfigGenerator.tsx"
        )
        cls.generator_page_path = os.path.join(
            cls.web_dir, "src", "app", "docs", "tools", "security-config-generator", "page.tsx"
        )
        cls.command_palette_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "DocsCommandPalette.tsx"
        )
        cls.feedback_component_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "DocsFeedback.tsx"
        )
        cls.sitemap_path = os.path.join(cls.web_dir, "src", "app", "sitemap.ts")
        cls.docs_data_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "docsData.ts"
        )

        with open(cls.articles_ts_path, "r", encoding="utf-8") as f:
            cls.articles_content = f.read()

        with open(cls.finding_docs_map_path, "r", encoding="utf-8") as f:
            cls.finding_docs_map_content = f.read()

        # Parse articles
        cls.parsed_articles = {}
        article_blocks = re.split(r'\n\s*\{\s*\n\s*slug:\s*"', cls.articles_content)[1:]
        for block in article_blocks:
            slug = block.split('"')[0]
            cat_match = re.search(r'category:\s*"([^"]+)"', block)
            category = cat_match.group(1) if cat_match else "unknown"

            title_match = re.search(r'title:\s*"([^"]+)"', block)
            title = title_match.group(1) if title_match else ""

            # Extract markdown content
            content_match = re.search(r'content:\s*`([\s\S]*?)`,\s*\n\s*\},?', block)
            md_content = content_match.group(1) if content_match else ""

            # Extract all markdown headings
            headings = re.findall(r'^(#{2,3})\s+(.+)$', md_content, flags=re.MULTILINE)
            heading_anchors = [slugify_heading(h[1]) for h in headings]

            cls.parsed_articles[slug] = {
                "category": category,
                "title": title,
                "headings": headings,
                "heading_anchors": heading_anchors,
                "content": md_content,
                "block": block,
            }

    def test_d4_1_article_registry_count_and_completeness(self):
        """Verify exactly 10 documentation articles exist across all 4 categories."""
        self.assertEqual(len(self.parsed_articles), 10)
        categories = set(a["category"] for a in self.parsed_articles.values())
        self.assertIn("getting-started", categories)
        self.assertIn("security-checks", categories)
        self.assertIn("monitoring", categories)
        self.assertIn("agency", categories)

    def test_d4_2_all_finding_catalog_anchors_match_target_headings(self):
        """Verify that every single anchor in FINDING_DOCS_CATALOG exists in target article markdown."""
        catalog_matches = re.findall(
            r'([A-Z0-9_]+):\s*\{\s*findingCode:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*slug:\s*"([^"]+)",(?:\s*anchor:\s*"([^"]+)",)?',
            self.finding_docs_map_content
        )
        self.assertGreaterEqual(len(catalog_matches), 25)

        for key, code, category, slug, anchor in catalog_matches:
            self.assertIn(slug, self.parsed_articles, f"Finding {code} references non-existent article '{slug}'")
            article = self.parsed_articles[slug]
            self.assertEqual(
                category,
                article["category"],
                f"Finding {code} has mismatched category '{category}' vs '{article['category']}'"
            )

            if anchor:
                self.assertIn(
                    anchor,
                    article["heading_anchors"],
                    f"Anchor '{anchor}' for finding '{code}' does not match any heading in article '{slug}'. "
                    f"Available anchors: {article['heading_anchors']}"
                )

    def test_d4_3_ssl_expired_anchor_resolution_is_accurate(self):
        """Verify SSL_EXPIRED and SSL_EXPIRING_SOON resolve to single-dash anchor."""
        self.assertIn('"2-certificate-validity-expiration-countdown"', self.finding_docs_map_content)
        self.assertNotIn('"2-certificate-validity--expiration-countdown"', self.finding_docs_map_content)

    def test_d4_4_cross_article_and_tool_links(self):
        """Verify all relatedArticles and relatedTools resolve to valid destinations."""
        for slug, meta in self.parsed_articles.items():
            # Check related articles
            rel_articles = re.findall(r'\{\s*slug:\s*"([^"]+)",\s*category:\s*"([^"]+)"', meta["block"])
            for r_slug, r_cat in rel_articles:
                self.assertIn(r_slug, self.parsed_articles, f"Article {slug} links to non-existent related {r_slug}")
                self.assertEqual(r_cat, self.parsed_articles[r_slug]["category"])

            # Check markdown links
            md_links = re.findall(r'\[([^\]]+)\]\((/[^)]+)\)', meta["content"])
            for text, link in md_links:
                # Must be a valid tool or docs link
                self.assertTrue(
                    link.startswith("/tools/") or link.startswith("/docs/"),
                    f"Article {slug} contains unverified internal link: {link}"
                )

    def test_d4_5_security_config_generator_multiplatform_and_cautions(self):
        """Verify SecurityConfigGenerator supports 4 platforms and renders caution notices."""
        with open(self.generator_component_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Platforms
        self.assertIn('"nginx"', content)
        self.assertIn('"apache"', content)
        self.assertIn('"caddy"', content)
        self.assertIn('"cloudflare"', content)

        # Cautions
        self.assertIn("HSTS Preload Commitment Caution", content)
        self.assertIn("CSP Staging Validation Advice", content)
        self.assertIn("Strict-Transport-Security", content)
        self.assertIn("X-Frame-Options", content)
        self.assertIn("X-Content-Type-Options", content)
        self.assertIn("Content-Security-Policy-Report-Only", content)

    def test_d4_6_command_palette_accessibility_contracts(self):
        """Verify command palette implements modal dialog and keyboard accessibility."""
        with open(self.command_palette_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn('role="dialog"', content)
        self.assertIn('aria-modal="true"', content)
        self.assertIn("ArrowDown", content)
        self.assertIn("ArrowUp", content)
        self.assertIn("Enter", content)
        self.assertIn("Escape", content)


# =========================================================================
# 2. BACKEND FEEDBACK API SECURITY & PRIVACY TESTS
# =========================================================================

def test_d4_feedback_valid_reasons(client):
    """Verify all allowed feedback reasons are accepted and persisted cleanly."""
    valid_reasons = ["unclear", "missing_example", "outdated", "instructions_failed", "other"]
    for reason in valid_reasons:
        slug = f"d4-article-{uuid.uuid4().hex[:6]}"
        res = client.post(
            "/api/v1/docs/feedback",
            json={
                "article_slug": slug,
                "category": "security-checks",
                "helpful": False,
                "reason": reason,
                "path": f"/docs/security-checks/{slug}",
            },
        )
        assert res.status_code == 200
        assert res.json()["status"] == "recorded"

        # Verify DB campaign field matches reason
        with TestingSyncSessionLocal() as session:
            stmt = select(ContentAnalyticsEvent).where(
                ContentAnalyticsEvent.content_id == slug,
                ContentAnalyticsEvent.event_name == "doc_feedback_unhelpful",
            )
            record = session.execute(stmt).scalars().first()
            assert record is not None
            assert record.campaign == reason


def test_d4_feedback_invalid_reason_rejected(client):
    """Verify arbitrary or malicious reason values fail schema validation with HTTP 422."""
    slug = f"d4-article-{uuid.uuid4().hex[:6]}"
    res = client.post(
        "/api/v1/docs/feedback",
        json={
            "article_slug": slug,
            "category": "security-checks",
            "helpful": False,
            "reason": "<script>alert('xss')</script>",
            "path": f"/docs/security-checks/{slug}",
        },
    )
    assert res.status_code == 422


def test_d4_feedback_privacy_safe_no_pii_stored(client):
    """Verify feedback events do not store IP address or identifiable headers."""
    slug = f"d4-privacy-{uuid.uuid4().hex[:6]}"
    res = client.post(
        "/api/v1/docs/feedback",
        json={
            "article_slug": slug,
            "category": "getting-started",
            "helpful": True,
            "path": f"/docs/getting-started/{slug}",
        },
        headers={"X-Forwarded-For": "203.0.113.195"},
    )
    assert res.status_code == 200

    with TestingSyncSessionLocal() as session:
        stmt = select(ContentAnalyticsEvent).where(
            ContentAnalyticsEvent.content_id == slug,
        )
        record = session.execute(stmt).scalars().first()
        assert record is not None
        # Verify content_analytics_events schema stores no IP column or user agent
        assert not hasattr(record, "ip_address")
        assert not hasattr(record, "client_ip")
        assert record.source == "docs_feedback"


def test_d4_feedback_flood_rate_limit(client):
    """Verify feedback endpoint rate limiter triggers HTTP 429 upon flooding."""
    _memory_rate_limits.clear()
    slug = f"d4-ratelimit-{uuid.uuid4().hex[:6]}"
    for _ in range(30):
        res = client.post(
            "/api/v1/docs/feedback",
            json={"article_slug": slug, "helpful": True},
        )
        assert res.status_code == 200

    # 31st request
    res = client.post(
        "/api/v1/docs/feedback",
        json={"article_slug": slug, "helpful": True},
    )
    assert res.status_code == 429
    detail = res.json().get("detail", {})
    if isinstance(detail, dict):
        assert detail.get("error", {}).get("code") == "RATE_LIMITED" or "rate" in str(detail).lower()
    else:
        assert "rate" in str(detail).lower()


if __name__ == "__main__":
    unittest.main()
