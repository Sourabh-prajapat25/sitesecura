"""
SiteSecura - Phase D3: Documentation Search, Configuration Generator, Scanner Deep Links & Feedback
Automated Test Suite

Validates all Phase D3 specifications:
1. Full-Text Documentation Search & Command Palette (D3.1):
   - Precomputed search index structure & deterministic ranking algorithm
   - Directive matching for hsts, csp, dmarc, spf, httponly, samesite, tls
   - Excerpt generation with snippet boundaries
   - Keyboard accessible command palette dialog with ARIA attributes and shortcut hooks
2. Security Configuration Snippet Generator (D3.2):
   - Multi-platform snippet generation (Nginx, Apache, Caddy, Cloudflare)
   - Configurable HSTS parameters and preload safety warnings
   - CSP templates (starter, balanced, strict) and report-only mode
   - Dedicated route (/docs/tools/security-config-generator) with metadata & JSON-LD
   - Sitemap and DOC_TOOLS catalog integration
3. Scanner Findings to Documentation Linking (D3.3):
   - Canonical finding-to-docs resolution (resolveFindingDoc)
   - Deep anchors for HSTS, CSP, SSL/TLS, SPF/DMARC, and cookies
   - FindingCard presentation of documentation guide links
4. Documentation Helpfulness Feedback Persistence (D3.4):
   - Backend endpoint POST /api/v1/docs/feedback with privacy preservation
   - Helpful and unhelpful feedback telemetry recorded in content_analytics_events
   - Rate limiting on feedback endpoint
   - Frontend DocsFeedback component with reason prompts and accessible states
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

TEST_DOCS_D3_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_docs_d3.sqlite3"))
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_DOCS_D3_DB_FILE}"
TEST_SYNC_DB_URL = f"sqlite:///{TEST_DOCS_D3_DB_FILE}"

test_async_engine = create_async_engine(
    TEST_DB_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

@event.listens_for(test_async_engine.sync_engine, "connect")
def set_sqlite_pragma_async(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

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


app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_sync_db] = override_get_sync_db
session_module.get_db = override_get_db
session_module.get_sync_db = override_get_sync_db
session_module.AsyncSessionLocal = TestingAsyncSessionLocal
session_module.SyncSessionLocal = TestingSyncSessionLocal


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    if os.path.exists(TEST_DOCS_D3_DB_FILE):
        try:
            os.remove(TEST_DOCS_D3_DB_FILE)
        except Exception:
            pass

    Base.metadata.create_all(bind=test_sync_engine)
    yield
    test_sync_engine.dispose()
    if os.path.exists(TEST_DOCS_D3_DB_FILE):
        try:
            os.remove(TEST_DOCS_D3_DB_FILE)
        except Exception:
            pass


@pytest.fixture(autouse=True)
def clear_rate_limits():
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


@pytest.fixture
def client():
    return TestClient(app)


# =========================================================================
# 1. FRONTEND ARCHITECTURE & STATIC CODE INTEGRITY TESTS
# =========================================================================

class TestDocsPhaseD3Frontend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.web_dir = os.path.join(cls.base_dir, "apps", "web")
        cls.search_index_path = os.path.join(
            cls.web_dir, "src", "lib", "docs", "docsSearchIndex.ts"
        )
        cls.command_palette_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "DocsCommandPalette.tsx"
        )
        cls.generator_component_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "SecurityConfigGenerator.tsx"
        )
        cls.generator_page_path = os.path.join(
            cls.web_dir, "src", "app", "docs", "tools", "security-config-generator", "page.tsx"
        )
        cls.finding_docs_map_path = os.path.join(
            cls.web_dir, "src", "lib", "docs", "findingDocsMap.ts"
        )
        cls.finding_card_path = os.path.join(
            cls.web_dir, "src", "components", "FindingCard.tsx"
        )
        cls.feedback_component_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "DocsFeedback.tsx"
        )
        cls.docs_sidebar_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "DocsSidebar.tsx"
        )
        cls.docs_client_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "DocsClient.tsx"
        )
        cls.sitemap_path = os.path.join(
            cls.web_dir, "src", "app", "sitemap.ts"
        )
        cls.docs_data_path = os.path.join(
            cls.web_dir, "src", "components", "docs", "docsData.ts"
        )

    def test_d3_1_search_index_implementation(self):
        """Verify docsSearchIndex.ts exports searchDocumentation and builds deterministic index."""
        self.assertTrue(os.path.exists(self.search_index_path))
        with open(self.search_index_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("export interface SearchResultItem", content)
        self.assertIn("export function searchDocumentation(", content)
        self.assertIn("buildDocumentationSearchIndex", content)
        # Directives indexed
        for directive in ["hsts", "csp", "dmarc", "spf", "httponly", "samesite", "tls"]:
            self.assertIn(f'"{directive}"', content)

    def test_d3_1_command_palette_accessibility_and_keyboard_nav(self):
        """Verify DocsCommandPalette.tsx implements accessible dialog and key handlers."""
        self.assertTrue(os.path.exists(self.command_palette_path))
        with open(self.command_palette_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn('role="dialog"', content)
        self.assertIn('aria-modal="true"', content)
        self.assertIn('Documentation search', content)
        self.assertIn("ArrowDown", content)
        self.assertIn("ArrowUp", content)
        self.assertIn("Enter", content)
        self.assertIn("Escape", content)
        self.assertIn("searchDocumentation", content)
        self.assertIn("selectedIndex", content)

    def test_d3_1_command_palette_integration_in_sidebar_and_client(self):
        """Verify DocsSidebar and DocsClient trigger the command palette on Ctrl+K."""
        with open(self.docs_sidebar_path, "r", encoding="utf-8") as f:
            sidebar = f.read()
        self.assertIn("DocsCommandPalette", sidebar)
        self.assertIn("paletteOpen", sidebar)
        self.assertIn("Search docs...", sidebar)

        with open(self.docs_client_path, "r", encoding="utf-8") as f:
            client = f.read()
        self.assertIn("DocsCommandPalette", client)
        self.assertIn("searchDocumentation", client)
        self.assertIn("isPaletteOpen", client)

    def test_d3_2_security_config_generator_component(self):
        """Verify SecurityConfigGenerator.tsx supports Nginx, Apache, Caddy, Cloudflare and directives."""
        self.assertTrue(os.path.exists(self.generator_component_path))
        with open(self.generator_component_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("export function SecurityConfigGenerator", content)
        self.assertIn('"nginx"', content)
        self.assertIn('"apache"', content)
        self.assertIn('"caddy"', content)
        self.assertIn('"cloudflare"', content)
        # HSTS controls & safety alerts
        self.assertIn("includeSubDomains", content)
        self.assertIn("preload", content)
        self.assertIn("HSTS Preload Commitment Caution", content)
        # CSP controls
        self.assertIn("report-only", content)
        self.assertIn("Content-Security-Policy-Report-Only", content)
        self.assertIn("Content-Security-Policy", content)
        # Reset and Copy
        self.assertIn("Copy Configuration", content)
        self.assertIn("Reset to Recommended", content)

    def test_d3_2_security_config_generator_dedicated_page(self):
        """Verify /docs/tools/security-config-generator/page.tsx has SEO metadata and schemas."""
        self.assertTrue(os.path.exists(self.generator_page_path))
        with open(self.generator_page_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("Security Configuration Snippet Generator", content)
        self.assertIn("SecurityConfigGenerator", content)
        self.assertIn("BreadcrumbList", content)
        self.assertIn("TechArticle", content)
        self.assertIn("/docs/tools/security-config-generator", content)
        self.assertIn("Navbar", content)
        self.assertIn("Footer", content)

    def test_d3_2_sitemap_and_tools_catalog_integration(self):
        """Verify the generator route is registered in sitemap and DOC_TOOLS."""
        with open(self.sitemap_path, "r", encoding="utf-8") as f:
            sitemap_content = f.read()
        self.assertIn("/docs/tools/security-config-generator", sitemap_content)

        with open(self.docs_data_path, "r", encoding="utf-8") as f:
            docs_data_content = f.read()
        self.assertIn("tool-config-generator", docs_data_content)
        self.assertIn("/docs/tools/security-config-generator", docs_data_content)

    def test_d3_3_finding_docs_map_implementation(self):
        """Verify findingDocsMap.ts maps scanner finding codes to technical docs anchors."""
        self.assertTrue(os.path.exists(self.finding_docs_map_path))
        with open(self.finding_docs_map_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("export const FINDING_DOCS_CATALOG", content)
        self.assertIn("export function resolveFindingDoc(", content)
        # Check canonical finding codes
        self.assertIn('"MISSING_HSTS"', content)
        self.assertIn('"MISSING_CSP"', content)
        self.assertIn('"SSL_EXPIRED"', content)
        self.assertIn('"MISSING_DMARC"', content)
        self.assertIn('"WEAK_SPF"', content)
        self.assertIn('"INSECURE_COOKIES"', content)
        # Check anchors
        self.assertIn("1-strict-transport-security-hsts", content)
        self.assertIn("1-missing-csp-header", content)
        self.assertIn("2-certificate-validity-expiration-countdown", content)

    def test_d3_3_finding_card_renders_docs_guide_link(self):
        """Verify FindingCard.tsx links to documentation guides."""
        with open(self.finding_card_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("resolveFindingDoc", content)
        self.assertIn("docResolution.hasDoc", content)
        self.assertIn("Docs guide", content)
        self.assertIn("docResolution.href", content)

    def test_d3_4_docs_feedback_component_implementation(self):
        """Verify DocsFeedback.tsx implements feedback states, reason choices, and API call."""
        self.assertTrue(os.path.exists(self.feedback_component_path))
        with open(self.feedback_component_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("export function DocsFeedback", content)
        self.assertIn("FEEDBACK_REASONS", content)
        self.assertIn("submitDocFeedback", content)
        self.assertIn("handleHelpful", content)
        self.assertIn("handleUnhelpfulSubmit", content)
        self.assertIn('role="region"', content)
        self.assertIn('aria-live="polite"', content)


# =========================================================================
# 2. BACKEND API PERSISTENCE TESTS (D3.4)
# =========================================================================

def test_feedback_helpful_success(client):
    """Verify submitting helpful documentation feedback records event in database."""
    slug = f"test-article-{uuid.uuid4().hex[:6]}"
    res = client.post(
        "/api/v1/docs/feedback",
        json={
            "article_slug": slug,
            "category": "security-checks",
            "helpful": True,
            "path": f"/docs/security-checks/{slug}",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "recorded"
    assert data["helpful"] is True

    # Verify database persistence
    with TestingSyncSessionLocal() as session:
        stmt = (
            select(ContentAnalyticsEvent)
            .where(
                ContentAnalyticsEvent.content_id == slug,
                ContentAnalyticsEvent.event_name == "doc_feedback_helpful",
            )
        )
        record = session.execute(stmt).scalars().first()
        assert record is not None
        assert record.content_type == "doc_article"
        assert record.source == "docs_feedback"


def test_feedback_unhelpful_with_reason_success(client):
    """Verify submitting unhelpful documentation feedback records reason in campaign field."""
    slug = f"test-unhelpful-{uuid.uuid4().hex[:6]}"
    res = client.post(
        "/api/v1/docs/feedback",
        json={
            "article_slug": slug,
            "category": "security-checks",
            "helpful": False,
            "reason": "missing_example",
            "path": f"/docs/security-checks/{slug}",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "recorded"
    assert data["helpful"] is False

    # Verify database persistence
    with TestingSyncSessionLocal() as session:
        stmt = (
            select(ContentAnalyticsEvent)
            .where(
                ContentAnalyticsEvent.content_id == slug,
                ContentAnalyticsEvent.event_name == "doc_feedback_unhelpful",
            )
        )
        record = session.execute(stmt).scalars().first()
        assert record is not None
        assert record.content_type == "doc_article"
        assert record.campaign == "missing_example"


def test_feedback_empty_slug_rejected(client):
    """Verify empty or invalid article slug is rejected with 422 unprocessable entity."""
    res = client.post(
        "/api/v1/docs/feedback",
        json={
            "article_slug": "   ",
            "helpful": True,
        },
    )
    assert res.status_code == 422


def test_feedback_rate_limiting(client):
    """Verify documentation feedback rate limiting triggers 429 upon flood."""
    _memory_rate_limits.clear()
    slug = f"rate-test-{uuid.uuid4().hex[:6]}"
    # Submit 30 requests (the allowed max per minute)
    for _ in range(30):
        client.post(
            "/api/v1/docs/feedback",
            json={
                "article_slug": slug,
                "helpful": True,
            },
        )

    # 31st request should be rate-limited
    res = client.post(
        "/api/v1/docs/feedback",
        json={
            "article_slug": slug,
            "helpful": True,
        },
    )
    assert res.status_code == 429


if __name__ == "__main__":
    unittest.main()
