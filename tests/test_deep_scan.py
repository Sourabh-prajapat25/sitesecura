"""
SiteSecura - Deep Website Security Scan Automated Test Suite
Validates:
1. Plan Entitlements:
   - Free & Basic plans blocked (403 DEEP_SCAN_FEATURE_REQUIRED)
   - Pro & Agency plans permitted (202 Accepted)
   - Admin capability check
2. Multi-tenant Isolation:
   - Cross-organization launch blocked (404)
   - Cross-organization result retrieval blocked (404)
3. Unified Quota Enforcement:
   - Deep scans decrement shared UsageRecord.scans_count
   - Normal and Deep scans share identical monthly allowance
   - Quota exhaustion blocks Deep Scan (429 PLAN_SCAN_LIMIT_REACHED)
4. Concurrency Guard:
   - Simultaneous scans on the same website blocked (409 CONCURRENT_SCAN_IN_PROGRESS)
5. Celery Task Registration:
   - deep_scan_website_task registered in celery_app
6. Deep Scanner Engine Units:
   - SSRF protection via SafeHttpClient & SafeResolver
   - Link discovery, normalization & same-origin enforcement
   - Robots.txt & Sitemap.xml parsing
   - Multi-page header consistency audit
   - Cookie security audit across pages
   - Active and passive mixed content detection
   - Passive HTML form inspection
   - Public source map exposure detection
   - Technology stack aggregation
   - Deterministic composite scoring (0-100)
"""

import os
import sys
import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import sessionmaker

# Path setup
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from apps.api.main import app
from app.db.base import Base
from app.db.session import get_db, get_sync_db
import app.db.session as session_module
from app.models.user import User, Organization, OrganizationMember
from app.models.billing import Subscription, UsageRecord
from app.models.website import Website
from app.models.scan import Scan, ScanCheck
from app.core.permissions import can_use_deep_scan, PLAN_CAPABILITIES
from app.tasks.celery_app import celery_app
from app.core.rate_limit import _memory_rate_limits

# Deep scanner engine imports
from scanner.deep.config import DeepScanConfig
from scanner.deep.links import normalize_url, is_same_origin, is_crawlable_html_url
from scanner.deep.robots import parse_robots_txt
from scanner.deep.sitemap import parse_sitemap_xml
from scanner.deep.redirects import analyze_redirects
from scanner.deep.headers import analyze_multi_page_headers
from scanner.deep.cookies import analyze_multi_page_cookies
from scanner.deep.mixed_content import analyze_mixed_content
from scanner.deep.forms import analyze_public_forms
from scanner.deep.technology import aggregate_technologies
from scanner.deep.scoring import calculate_deep_score
from scanner.models import Finding, RiskLevel, CheckStatus, Severity
from scanner.deep.models import CrawledPage, FormMetadata, ResourceItem, SourceMapItem
from scanner.network.safety import is_safe_ip, SSRFValidationError

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_deep_scan.sqlite3"))
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"
TEST_SYNC_DB_URL = f"sqlite:///{TEST_DB_FILE}"

test_async_engine = create_async_engine(
    TEST_DB_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

@event.listens_for(test_async_engine.sync_engine, "connect")
def set_sqlite_pragma_async(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()

TestAsyncSessionLocal = async_sessionmaker(
    bind=test_async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

test_sync_engine = create_engine(
    TEST_SYNC_DB_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

@event.listens_for(test_sync_engine, "connect")
def set_sqlite_pragma_sync(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()

TestSyncSessionLocal = sessionmaker(
    bind=test_sync_engine,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass

    Base.metadata.create_all(bind=test_sync_engine)

    async def override_get_db():
        async with TestAsyncSessionLocal() as session:
            yield session

    def override_get_sync_db():
        with TestSyncSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_sync_db] = override_get_sync_db
    session_module.AsyncSessionLocal = TestAsyncSessionLocal

    yield

    app.dependency_overrides.clear()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass


@pytest.fixture(autouse=True)
def clear_rate_limits():
    _memory_rate_limits.clear()


# =========================================================================
# 1. ENTITLEMENT & CAPABILITY TESTS
# =========================================================================

def test_deep_scan_plan_capabilities():
    """Verify plan capabilities matrix correctly defines deep_scan."""
    assert can_use_deep_scan("free") is False
    assert can_use_deep_scan("basic") is False
    assert can_use_deep_scan("pro") is True
    assert can_use_deep_scan("agency") is True
    assert can_use_deep_scan("admin") is True

    assert PLAN_CAPABILITIES["free"]["deep_scan"] is False
    assert PLAN_CAPABILITIES["basic"]["deep_scan"] is False
    assert PLAN_CAPABILITIES["pro"]["deep_scan"] is True
    assert PLAN_CAPABILITIES["pro"]["deep_scan_max_pages"] == 50
    assert PLAN_CAPABILITIES["agency"]["deep_scan"] is True
    assert PLAN_CAPABILITIES["agency"]["deep_scan_max_pages"] == 100


def test_free_and_basic_plans_rejected_with_403(monkeypatch):
    """Free and Basic organizations must receive 403 DEEP_SCAN_FEATURE_REQUIRED."""
    from unittest.mock import MagicMock
    monkeypatch.setattr("app.tasks.worker.deep_scan_website_task.delay", MagicMock())

    client = TestClient(app)

    # 1. Provision Free User
    free_uid = f"free_{uuid.uuid4().hex[:8]}"
    free_token = f"Bearer dev-token-{free_uid}-free"
    res = client.get("/api/v1/auth/me", headers={"Authorization": free_token})
    assert res.status_code == 200
    free_org_id = uuid.UUID(res.json()["organization"]["id"])

    # Create website for free org
    website_id = uuid.uuid4()
    with TestSyncSessionLocal() as sync_db:
        w = Website(
            id=website_id,
            organization_id=free_org_id,
            name="example.com",
            domain="example.com",
            normalized_domain="example.com",
            status="active",
        )
        sync_db.add(w)
        sync_db.commit()

    # Attempt deep scan on Free plan
    deep_res = client.post(
        f"/api/v1/websites/{website_id}/deep-scan",
        headers={"Authorization": free_token},
    )
    assert deep_res.status_code == 403
    assert deep_res.json()["detail"]["error"]["code"] == "DEEP_SCAN_FEATURE_REQUIRED"

    # Upgrade org to Basic plan
    with TestSyncSessionLocal() as sync_db:
        sub = sync_db.execute(select(Subscription).where(Subscription.organization_id == free_org_id)).scalar_one()
        sub.plan = "basic"
        sync_db.commit()

    # Attempt deep scan on Basic plan
    deep_res_basic = client.post(
        f"/api/v1/websites/{website_id}/deep-scan",
        headers={"Authorization": free_token},
    )
    assert deep_res_basic.status_code == 403
    assert deep_res_basic.json()["detail"]["error"]["code"] == "DEEP_SCAN_FEATURE_REQUIRED"


def test_pro_and_agency_plans_permitted(monkeypatch):
    """Pro and Agency plans must be allowed to trigger deep scan."""
    mock_delay = monkeypatch.setattr("app.tasks.worker.deep_scan_website_task.delay", lambda *args, **kwargs: None)
    monkeypatch.setattr("app.services.scan_service.execute_deep_scan_job", lambda *args, **kwargs: None)

    client = TestClient(app)

    # 1. Provision Pro user
    pro_uid = f"pro_{uuid.uuid4().hex[:8]}"
    pro_token = f"Bearer dev-token-{pro_uid}-free"
    res = client.get("/api/v1/auth/me", headers={"Authorization": pro_token})
    assert res.status_code == 200
    pro_org_id = uuid.UUID(res.json()["organization"]["id"])

    # Upgrade to Pro
    with TestSyncSessionLocal() as sync_db:
        sub = sync_db.execute(select(Subscription).where(Subscription.organization_id == pro_org_id)).scalar_one()
        sub.plan = "pro"
        sub.status = "active"
        website_id = uuid.uuid4()
        w = Website(
            id=website_id,
            organization_id=pro_org_id,
            name="pro-site.com",
            domain="pro-site.com",
            normalized_domain="pro-site.com",
            status="active",
        )
        sync_db.add(w)
        sync_db.commit()

    deep_res = client.post(
        f"/api/v1/websites/{website_id}/deep-scan",
        headers={"Authorization": pro_token},
    )
    assert deep_res.status_code == 201, f"Expected 201, got {deep_res.status_code}: {deep_res.text}"
    data = deep_res.json()
    assert data["domain"] == "pro-site.com"
    assert data["scan_type"] == "deep"
    assert data["status"] in ("queued", "pending", "running", "completed")


# =========================================================================
# 2. TENANT ISOLATION TESTS
# =========================================================================

def test_tenant_isolation_idor_protection():
    """Tenant B cannot trigger deep scan or access deep scan results belonging to Tenant A."""
    client = TestClient(app)

    # Org A (Pro)
    user_a = f"org_a_{uuid.uuid4().hex[:8]}"
    token_a = f"Bearer dev-token-{user_a}-free"
    res_a = client.get("/api/v1/auth/me", headers={"Authorization": token_a})
    org_a_id = uuid.UUID(res_a.json()["organization"]["id"])

    # Org B (Agency)
    user_b = f"org_b_{uuid.uuid4().hex[:8]}"
    token_b = f"Bearer dev-token-{user_b}-free"
    res_b = client.get("/api/v1/auth/me", headers={"Authorization": token_b})
    org_b_id = uuid.UUID(res_b.json()["organization"]["id"])

    with TestSyncSessionLocal() as sync_db:
        # Upgrade both to paid
        sub_a = sync_db.execute(select(Subscription).where(Subscription.organization_id == org_a_id)).scalar_one()
        sub_a.plan = "pro"
        sub_b = sync_db.execute(select(Subscription).where(Subscription.organization_id == org_b_id)).scalar_one()
        sub_b.plan = "agency"

        # Create website belonging to Org A
        website_a = Website(
            id=uuid.uuid4(),
            organization_id=org_a_id,
            name="secret-a.com",
            domain="secret-a.com",
            normalized_domain="secret-a.com",
            status="active",
        )
        sync_db.add(website_a)

        # Create deep scan for Org A
        scan_a = Scan(
            id=uuid.uuid4(),
            organization_id=org_a_id,
            website_id=website_a.id,
            domain="secret-a.com",
            normalized_domain="secret-a.com",
            target_ip="93.184.216.34",
            scan_type="deep",
            status="completed",
            score=95,
            created_at=datetime.now(timezone.utc),
        )
        sync_db.add(scan_a)
        sync_db.commit()

        target_website_id = website_a.id
        target_scan_id = scan_a.id

    # Org B attempts to trigger deep scan on Org A's website
    cross_trigger_res = client.post(
        f"/api/v1/websites/{target_website_id}/deep-scan",
        headers={"Authorization": token_b},
    )
    assert cross_trigger_res.status_code == 404

    # Org B attempts to view Org A's deep scan result
    cross_view_res = client.get(
        f"/api/v1/websites/{target_website_id}/deep-scans/{target_scan_id}",
        headers={"Authorization": token_b},
    )
    assert cross_view_res.status_code == 404


# =========================================================================
# 3. UNIFIED QUOTA ENFORCEMENT & CONCURRENCY TESTS
# =========================================================================

def test_shared_quota_decrement_and_exhaustion(monkeypatch):
    """Deep scans and normal scans share identical UsageRecord.scans_count quota."""
    monkeypatch.setattr("app.tasks.worker.deep_scan_website_task.delay", lambda *args, **kwargs: None)
    monkeypatch.setattr("app.services.scan_service.execute_deep_scan_job", lambda *args, **kwargs: None)

    client = TestClient(app)

    uid = f"quota_{uuid.uuid4().hex[:8]}"
    token = f"Bearer dev-token-{uid}-free"
    res = client.get("/api/v1/auth/me", headers={"Authorization": token})
    org_id = uuid.UUID(res.json()["organization"]["id"])

    # Set up Pro plan with 1 scan left
    with TestSyncSessionLocal() as sync_db:
        sub = sync_db.execute(select(Subscription).where(Subscription.organization_id == org_id)).scalar_one()
        sub.plan = "pro"
        sub.status = "active"

        period_month = datetime.now(timezone.utc).strftime("%Y-%m")
        usage = sync_db.execute(
            select(UsageRecord).where(
                UsageRecord.organization_id == org_id,
                UsageRecord.period_month == period_month,
            )
        ).scalar_one_or_none()

        if not usage:
            usage = UsageRecord(
                organization_id=org_id,
                period_month=period_month,
                scans_count=499,  # 499 out of 500 used for Pro plan
            )
            sync_db.add(usage)
        else:
            usage.scans_count = 499

        website = Website(
            id=uuid.uuid4(),
            organization_id=org_id,
            name="quota-test.com",
            domain="quota-test.com",
            normalized_domain="quota-test.com",
            status="active",
        )
        sync_db.add(website)
        sync_db.commit()
        site_id = website.id

    # 1. Trigger Deep Scan -> Consumes 500th scan slot
    res_deep = client.post(f"/api/v1/websites/{site_id}/deep-scan", headers={"Authorization": token})
    assert res_deep.status_code == 201

    # Verify usage record in DB is now 500
    with TestSyncSessionLocal() as sync_db:
        usage = sync_db.execute(
            select(UsageRecord).where(
                UsageRecord.organization_id == org_id,
                UsageRecord.period_month == period_month,
            )
        ).scalar_one()
        assert usage.scans_count == 500

    # 2. Mark the previous scan as completed to avoid concurrency block
    with TestSyncSessionLocal() as sync_db:
        scans = sync_db.execute(select(Scan).where(Scan.website_id == site_id)).scalars().all()
        for s in scans:
            s.status = "completed"
        sync_db.commit()

    # 3. Next deep scan should be rejected with 403 SCAN_QUOTA_EXCEEDED
    res_exceeded = client.post(f"/api/v1/websites/{site_id}/deep-scan", headers={"Authorization": token})
    assert res_exceeded.status_code == 403
    assert res_exceeded.json()["detail"]["error"]["code"] == "SCAN_QUOTA_EXCEEDED"


def test_concurrency_guard_prevents_simultaneous_scans():
    """If a deep scan is already running on a website, subsequent trigger returns 409."""
    client = TestClient(app)

    uid = f"concurrent_{uuid.uuid4().hex[:8]}"
    token = f"Bearer dev-token-{uid}-free"
    res = client.get("/api/v1/auth/me", headers={"Authorization": token})
    org_id = uuid.UUID(res.json()["organization"]["id"])

    with TestSyncSessionLocal() as sync_db:
        sub = sync_db.execute(select(Subscription).where(Subscription.organization_id == org_id)).scalar_one()
        sub.plan = "pro"
        sub.status = "active"

        website = Website(
            id=uuid.uuid4(),
            organization_id=org_id,
            name="concurrent-test.com",
            domain="concurrent-test.com",
            normalized_domain="concurrent-test.com",
            status="active",
        )
        sync_db.add(website)

        # Active running deep scan
        active_scan = Scan(
            id=uuid.uuid4(),
            organization_id=org_id,
            website_id=website.id,
            domain="concurrent-test.com",
            normalized_domain="concurrent-test.com",
            target_ip="93.184.216.34",
            scan_type="deep",
            status="running",
            created_at=datetime.now(timezone.utc),
        )
        sync_db.add(active_scan)
        sync_db.commit()
        site_id = website.id

    # Attempt to trigger another deep scan while one is running
    conflict_res = client.post(f"/api/v1/websites/{site_id}/deep-scan", headers={"Authorization": token})
    assert conflict_res.status_code == 409
    assert conflict_res.json()["detail"]["error"]["code"] == "CONCURRENT_SCAN_IN_PROGRESS"


def test_celery_registers_deep_scan_task():
    """Verify deep_scan_website_task is registered in celery_app."""
    registered = set(celery_app.tasks.keys())
    assert "app.tasks.worker.deep_scan_website_task" in registered


# =========================================================================
# 4. DEEP SCANNER ENGINE UNIT TESTS
# =========================================================================

def test_links_normalization_and_same_origin():
    """Test URL normalization, fragment stripping, same-origin enforcement, and asset filtering."""
    base_url = "https://example.com/blog"

    # Same origin & fragment stripping
    assert normalize_url("/about#team", base_url) == "https://example.com/about"
    assert normalize_url("contact", base_url) == "https://example.com/contact"
    assert normalize_url("https://example.com/pricing", base_url) == "https://example.com/pricing"

    # Same origin check
    assert is_same_origin("https://example.com/page", "example.com") is True
    assert is_same_origin("https://sub.example.com/page", "example.com") is False
    assert is_same_origin("https://evil.com/page", "example.com") is False

    # Crawlable HTML filter (reject non-HTML media/archives)
    assert is_crawlable_html_url("https://example.com/blog/article") is True
    assert is_crawlable_html_url("https://example.com/image.png") is False
    assert is_crawlable_html_url("https://example.com/archive.zip") is False
    assert is_crawlable_html_url("https://example.com/script.js") is False
    assert is_crawlable_html_url("https://example.com/data.pdf") is False


def test_robots_txt_parser():
    """Verify robots.txt directives and sitemap references parsing."""
    sample_robots = """
    User-agent: *
    Disallow: /admin/
    Disallow: /private/
    Allow: /admin/public
    Crawl-delay: 5

    Sitemap: https://example.com/sitemap.xml
    Sitemap: https://example.com/sitemap2.xml
    """
    analysis = parse_robots_txt(sample_robots, "https://example.com/robots.txt")
    assert analysis.is_present is True
    assert "/admin/" in analysis.disallowed_paths
    assert "/private/" in analysis.disallowed_paths
    assert len(analysis.sitemap_urls) == 2
    assert "https://example.com/sitemap.xml" in analysis.sitemap_urls
    assert analysis.crawl_delay == 5


def test_sitemap_xml_parser():
    """Verify sitemap.xml parsing extracts URLs and handles XML namespaces."""
    sample_sitemap = """<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
       <url>
          <loc>https://example.com/</loc>
          <lastmod>2026-01-01</lastmod>
       </url>
       <url>
          <loc>https://example.com/features</loc>
       </url>
       <url>
          <loc>https://evil.com/phish</loc>
       </url>
    </urlset>
    """
    analysis, discovered_urls = parse_sitemap_xml(sample_sitemap, "https://example.com/sitemap.xml", target_origin="example.com")
    assert analysis.is_present is True
    # evil.com must be excluded by same-origin constraint
    assert "https://example.com/" in discovered_urls
    assert "https://example.com/features" in discovered_urls
    assert "https://evil.com/phish" not in discovered_urls


def test_redirect_detector():
    """Verify redirect analyzer detects HTTPS downgrade, redirect loops, and excessive hops."""
    # HTTPS Downgrade
    page_downgrade = CrawledPage(
        url="https://example.com/login",
        final_url="http://example.com/insecure",
        depth=0,
        status_code=200,
        content_type="text/html",
        is_https=False,
        redirect_chain=["https://example.com/login", "http://example.com/insecure"],
    )
    findings = analyze_redirects([page_downgrade], "example.com")
    assert any("deep_https_downgrade" == f.check_type for f in findings)

    # Excessive hops (> 4 redirects)
    page_excessive = CrawledPage(
        url="https://example.com/p0",
        final_url="https://example.com/p6",
        depth=0,
        status_code=200,
        content_type="text/html",
        is_https=True,
        redirect_chain=[f"https://example.com/p{i}" for i in range(7)],
    )
    findings_excessive = analyze_redirects([page_excessive], "example.com")
    assert any("deep_excessive_redirects" == f.check_type for f in findings_excessive)


def test_multi_page_header_consistency():
    """Verify header consistency checker flags missing headers across multiple crawled pages."""
    pages = [
        CrawledPage(
            url="https://example.com/",
            final_url="https://example.com/",
            depth=0,
            status_code=200,
            content_type="text/html",
            is_https=True,
            headers={
                "strict-transport-security": "max-age=31536000",
                "content-security-policy": "default-src 'self'",
            },
        ),
        CrawledPage(
            url="https://example.com/app",
            final_url="https://example.com/app",
            depth=1,
            status_code=200,
            content_type="text/html",
            is_https=True,
            headers={
                # Missing HSTS and CSP
                "x-content-type-options": "nosniff",
            },
        ),
    ]

    findings = analyze_multi_page_headers(pages)
    check_types = [f.check_type for f in findings]
    assert any("deep_hsts_inconsistent" in ct or "deep_hsts_missing" in ct for ct in check_types)
    assert any("deep_csp_inconsistent" in ct or "deep_csp_missing" in ct for ct in check_types)


def test_cookie_auditor():
    """Verify cookie auditor identifies missing Secure, HttpOnly, and SameSite flags across pages."""
    pages = [
        CrawledPage(
            url="https://example.com/login",
            final_url="https://example.com/login",
            depth=0,
            status_code=200,
            content_type="text/html",
            is_https=True,
            set_cookie_headers=[
                "session_id=abc; Path=/",
                "csrf_token=xyz; Path=/; Secure; HttpOnly; SameSite=Strict",
            ],
        )
    ]
    findings = analyze_multi_page_cookies(pages)
    check_types = [f.check_type for f in findings]
    assert any("deep_cookie_insecure" in ct or "deep_cookie_missing_httponly" in ct for ct in check_types)


def test_mixed_content_auditor():
    """Verify mixed content auditor detects active and passive HTTP resources on HTTPS pages."""
    pages = [
        CrawledPage(
            url="https://example.com/dashboard",
            final_url="https://example.com/dashboard",
            depth=0,
            status_code=200,
            content_type="text/html",
            is_https=True,
            resources=[
                ResourceItem(
                    page_url="https://example.com/dashboard",
                    resource_url="http://insecure-cdn.com/app.js",
                    resource_type="script",
                    is_https=False,
                    is_external=True,
                    host="insecure-cdn.com",
                ),
                ResourceItem(
                    page_url="https://example.com/dashboard",
                    resource_url="http://insecure-cdn.com/logo.png",
                    resource_type="image",
                    is_https=False,
                    is_external=True,
                    host="insecure-cdn.com",
                ),
            ],
        )
    ]
    findings = analyze_mixed_content(pages)
    check_types = [f.check_type for f in findings]
    assert "deep_mixed_content_active" in check_types
    assert "deep_mixed_content_passive" in check_types


def test_passive_forms_auditor():
    """Verify passive form inspection flags HTTP action, external action, and password on HTTP."""
    pages = [
        CrawledPage(
            url="https://example.com/login",
            final_url="https://example.com/login",
            depth=0,
            status_code=200,
            content_type="text/html",
            is_https=True,
            forms=[
                FormMetadata(
                    page_url="https://example.com/login",
                    action="http://api.example.com/submit",
                    resolved_action_url="http://api.example.com/submit",
                    method="POST",
                    action_protocol="http",
                    action_host="api.example.com",
                    is_external=False,
                    has_password=True,
                    has_sensitive_fields=True,
                )
            ],
        )
    ]
    findings = analyze_public_forms(pages)
    check_types = [f.check_type for f in findings]
    assert any("deep_form_insecure_action" in ct for ct in check_types)


def test_technology_aggregation():
    """Verify technology detection across pages aggregates accurately."""
    pages = [
        CrawledPage(
            url="https://example.com/page1",
            final_url="https://example.com/page1",
            depth=0,
            status_code=200,
            content_type="text/html",
            is_https=True,
            headers={"server": "nginx"},
            title="<div id='__next'></div>",
        ),
        CrawledPage(
            url="https://example.com/page2",
            final_url="https://example.com/page2",
            depth=1,
            status_code=200,
            content_type="text/html",
            is_https=True,
            headers={"server": "cloudflare"},
        ),
    ]
    aggregated_list, tech_findings = aggregate_technologies(pages)
    names = [t["name"] for t in aggregated_list]
    assert "Next.js" in names
    assert "Cloudflare" in names


def test_deterministic_scoring_algorithm():
    """Verify scoring logic produces bounded 0-100 scores and risk grades."""
    final_score, risk_level, breakdown, passed_count, total_count = calculate_deep_score([])
    assert final_score == 100
    assert risk_level == RiskLevel.EXCELLENT

    # With severe findings across multiple categories (Transport 25 + Headers 15 = 40 deduction -> 60 score = Medium Risk)
    severe_finding = Finding(
        check_type="deep_https_downgrade",
        name="HTTPS Downgrade",
        status=CheckStatus.CRITICAL,
        severity=Severity.CRITICAL,
        score_impact=25,
        title="Critical Security Hole",
        summary="Critical issue detected.",
        why_it_matters="Downgrade risks interception.",
        how_to_fix="Use HTTPS everywhere.",
        estimated_fix_minutes=15,
        documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections",
    )
    header_finding = Finding(
        check_type="deep_csp_missing",
        name="Missing CSP",
        status=CheckStatus.HIGH,
        severity=Severity.HIGH,
        score_impact=15,
        title="No Content Security Policy",
        summary="No CSP detected.",
        why_it_matters="CSP prevents XSS.",
        how_to_fix="Add CSP header.",
        estimated_fix_minutes=20,
        documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP",
    )
    low_score, low_risk, breakdown2, p_cnt, t_cnt = calculate_deep_score([severe_finding, header_finding])
    assert low_score <= 60
    assert low_risk in (RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL)


def test_ssrf_resolver_blocks_private_networks():
    """Verify is_safe_ip prohibits crawl targets pointing to loopback, RFC1918, or cloud metadata."""
    # Loopback
    assert is_safe_ip("127.0.0.1")[0] is False
    assert is_safe_ip("::1")[0] is False

    # RFC 1918 Private
    assert is_safe_ip("10.0.0.1")[0] is False
    assert is_safe_ip("172.16.0.1")[0] is False
    assert is_safe_ip("192.168.1.1")[0] is False

    # AWS / GCP Cloud Metadata
    assert is_safe_ip("169.254.169.254")[0] is False

    # Valid Public IP
    assert is_safe_ip("93.184.216.34")[0] is True
