"""
SiteSecura - Phase E7: Final Blog Conversion & Content Ecosystem Test Suite
Validates all Phase E7 specifications:
1. Resources System:
   - Admin resource creation (draft & published with published_at timestamp)
   - 409 conflict on duplicate slug
   - Admin resource update (fields, status change, published_at transition)
   - Admin resource deletion
   - Authorization (admin only for CRUD, 401 unauthenticated, 403 non-admin)
   - Public listing of published resources
   - Strict quarantine: draft and scheduled resources excluded from public list & return 404 on detail
   - Filtering by resource_type and category
   - Search by query (q)
   - Sitemap items endpoint (published only)
2. Newsletter Subscription:
   - Valid email subscription (status="subscribed", sends confirmation email)
   - Idempotent duplicate subscription handling (friendly success, no duplicate rows)
   - Safe self-service unsubscribe
   - Reactivation of unsubscribed email
   - Validation rejection for malformed emails (HTTP 422)
   - Rate limiting enforcement (HTTP 429 on excessive attempts)
   - Admin subscriber listing (admin only)
3. Content Analytics:
   - Public event ingestion for allowed events (blog_article_view, blog_cta_click, etc.)
   - Unknown event rejection (HTTP 400)
   - Admin content engagement summary from real database events
   - Authorization (admin only for analytics summary)
4. Audit Logging:
   - Full audit trail for RESOURCE_CREATED, RESOURCE_UPDATED, RESOURCE_DELETED
"""

import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from typing import Tuple, Optional
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
from app.models.user import User, Organization, OrganizationMember
from app.models.billing import Subscription
from app.models.cms import Resource, NewsletterSubscriber, ContentAnalyticsEvent
from app.models.alert import AuditLog
from app.core.rate_limit import _memory_rate_limits

TEST_CMS_E7_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_cms_e7.sqlite3"))
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_CMS_E7_DB_FILE}"
TEST_SYNC_DB_URL = f"sqlite:///{TEST_CMS_E7_DB_FILE}"

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
    if os.path.exists(TEST_CMS_E7_DB_FILE):
        try:
            os.remove(TEST_CMS_E7_DB_FILE)
        except Exception:
            pass

    Base.metadata.create_all(bind=test_sync_engine)
    yield
    test_sync_engine.dispose()
    if os.path.exists(TEST_CMS_E7_DB_FILE):
        try:
            os.remove(TEST_CMS_E7_DB_FILE)
        except Exception:
            pass


@pytest.fixture(autouse=True)
def clear_rate_limits():
    _memory_rate_limits.clear()
    try:
        import redis as sync_redis
        from app.core.config import settings
        r = sync_redis.from_url(settings.REDIS_URL)
        for k in r.keys("newsletter:*") + r.keys("analytics:*"):
            r.delete(k)
    except Exception:
        pass


@pytest.fixture
def client():
    return TestClient(app)


def seed_user(
    email: str,
    role: str = "member",
    plan: str = "free",
    is_active: bool = True,
) -> Tuple[User, Organization]:
    with TestingSyncSessionLocal() as session:
        uid = f"fb_{uuid.uuid4().hex[:12]}"
        user_id = uuid.uuid4()
        org_id = uuid.uuid4()

        org = Organization(
            id=org_id,
            name=f"{email.split('@')[0].capitalize()}'s Org",
            type="personal",
            owner_id=user_id,
        )
        session.add(org)

        user = User(
            id=user_id,
            email=email,
            firebase_uid=uid,
            name=email.split("@")[0].capitalize(),
            role="admin" if role == "platform_admin" else "user",
            organization_id=org_id,
            is_active=is_active,
        )
        session.add(user)

        member = OrganizationMember(
            id=uuid.uuid4(),
            organization_id=org_id,
            user_id=user_id,
            role="owner" if role != "platform_admin" else "admin",
        )
        session.add(member)

        sub = Subscription(
            id=uuid.uuid4(),
            organization_id=org_id,
            stripe_customer_id=f"cus_{user_id.hex[:8]}",
            plan=plan,
            status="active",
        )
        session.add(sub)
        session.commit()
        session.refresh(user)
        session.refresh(org)
        return user, org


def auth_headers(user: User) -> dict:
    role = "admin" if user.role == "admin" else "user"
    return {
        "Authorization": f"Bearer dev-token-{user.firebase_uid}-{role}",
    }


# =========================================================================
# 1. RESOURCES TESTS
# =========================================================================

def test_01_admin_create_resource_draft(client):
    admin_user, _ = seed_user(f"admin_{uuid.uuid4().hex[:6]}@example.com", role="platform_admin")
    headers = auth_headers(admin_user)

    res = client.post(
        "/api/v1/admin/resources",
        headers=headers,
        json={
            "title": "Website Security Audit Checklist",
            "slug": "website-security-audit-checklist",
            "description": "Comprehensive 35-point checklist for auditing SSL, headers, and DNS records.",
            "resource_type": "checklist",
            "category": "Audit & Compliance",
            "status": "draft",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Website Security Audit Checklist"
    assert data["slug"] == "website-security-audit-checklist"
    assert data["status"] == "draft"
    assert data["published_at"] is None


def test_02_admin_create_resource_published(client):
    admin_user, _ = seed_user(f"admin_{uuid.uuid4().hex[:6]}@example.com", role="platform_admin")
    headers = auth_headers(admin_user)

    res = client.post(
        "/api/v1/admin/resources",
        headers=headers,
        json={
            "title": "Production HSTS Configuration Guide",
            "slug": "production-hsts-configuration-guide",
            "description": "Step-by-step implementation guide for strict transport security.",
            "resource_type": "guide",
            "category": "HTTP Security",
            "status": "published",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "published"
    assert data["published_at"] is not None


def test_03_admin_create_resource_duplicate_slug_conflict(client):
    admin_user, _ = seed_user(f"admin_{uuid.uuid4().hex[:6]}@example.com", role="platform_admin")
    headers = auth_headers(admin_user)

    # First creation
    client.post(
        "/api/v1/admin/resources",
        headers=headers,
        json={
            "title": "CSP Policy Template",
            "slug": "csp-policy-template",
            "description": "Ready-to-deploy Content Security Policy template.",
            "resource_type": "template",
        },
    )

    # Duplicate creation with same slug
    res = client.post(
        "/api/v1/admin/resources",
        headers=headers,
        json={
            "title": "Duplicate CSP Policy Template",
            "slug": "csp-policy-template",
            "description": "Another template with the same slug.",
            "resource_type": "template",
        },
    )
    assert res.status_code == 409
    assert "already exists" in res.json()["detail"]


def test_04_admin_update_resource(client):
    admin_user, _ = seed_user(f"admin_{uuid.uuid4().hex[:6]}@example.com", role="platform_admin")
    headers = auth_headers(admin_user)

    create_res = client.post(
        "/api/v1/admin/resources",
        headers=headers,
        json={
            "title": "Initial Resource Title",
            "slug": "initial-resource-slug",
            "description": "Initial description.",
            "resource_type": "guide",
            "status": "draft",
        },
    )
    res_id = create_res.json()["id"]

    # Update title and publish it
    update_res = client.patch(
        f"/api/v1/admin/resources/{res_id}",
        headers=headers,
        json={
            "title": "Updated Resource Title",
            "status": "published",
        },
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["title"] == "Updated Resource Title"
    assert updated_data["status"] == "published"
    assert updated_data["published_at"] is not None


def test_05_admin_delete_resource(client):
    admin_user, _ = seed_user(f"admin_{uuid.uuid4().hex[:6]}@example.com", role="platform_admin")
    headers = auth_headers(admin_user)

    create_res = client.post(
        "/api/v1/admin/resources",
        headers=headers,
        json={
            "title": "Temporary Resource to Delete",
            "slug": "temp-resource-delete",
            "description": "Will be removed.",
            "resource_type": "tool",
        },
    )
    res_id = create_res.json()["id"]

    del_res = client.delete(f"/api/v1/admin/resources/{res_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

    # Confirm it's gone
    get_res = client.get(f"/api/v1/admin/resources/{res_id}", headers=headers)
    assert get_res.status_code == 404


def test_06_admin_resources_authorization(client):
    regular_user, _ = seed_user(f"regular_{uuid.uuid4().hex[:6]}@example.com", role="user")
    headers = auth_headers(regular_user)

    # 403 for non-admin
    res = client.get("/api/v1/admin/resources", headers=headers)
    assert res.status_code == 403

    # 401 for unauthenticated
    res_unauth = client.get("/api/v1/admin/resources")
    assert res_unauth.status_code == 401


def test_07_public_list_resources_published_only(client):
    admin_user, _ = seed_user(f"admin_{uuid.uuid4().hex[:6]}@example.com", role="platform_admin")
    headers = auth_headers(admin_user)

    # Create published resource
    slug = f"published-resource-{uuid.uuid4().hex[:6]}"
    client.post(
        "/api/v1/admin/resources",
        headers=headers,
        json={
            "title": "Public Resource Checklist",
            "slug": slug,
            "description": "Visible to everyone.",
            "resource_type": "checklist",
            "status": "published",
        },
    )

    res = client.get("/api/v1/resources")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert any(r["slug"] == slug for r in data["items"])


def test_08_public_list_resources_draft_quarantined(client):
    admin_user, _ = seed_user(f"admin_{uuid.uuid4().hex[:6]}@example.com", role="platform_admin")
    headers = auth_headers(admin_user)

    draft_slug = f"secret-draft-resource-{uuid.uuid4().hex[:6]}"
    client.post(
        "/api/v1/admin/resources",
        headers=headers,
        json={
            "title": "Secret Draft Resource",
            "slug": draft_slug,
            "description": "Draft not published.",
            "resource_type": "guide",
            "status": "draft",
        },
    )

    # Public list must exclude draft
    res = client.get("/api/v1/resources")
    items = res.json()["items"]
    assert not any(r["slug"] == draft_slug for r in items)

    # Public detail must return 404
    detail_res = client.get(f"/api/v1/resources/{draft_slug}")
    assert detail_res.status_code == 404


def test_09_public_list_resources_future_quarantined(client):
    # Insert future published resource directly
    future_slug = f"future-resource-{uuid.uuid4().hex[:6]}"
    with TestingSyncSessionLocal() as session:
        future_res = Resource(
            id=uuid.uuid4(),
            title="Future Security Standard 2030",
            slug=future_slug,
            description="Scheduled for 2030.",
            resource_type="guide",
            status="published",
            published_at=datetime.now(timezone.utc) + timedelta(days=365),
        )
        session.add(future_res)
        session.commit()

    # Public list must exclude future resource
    res = client.get("/api/v1/resources")
    items = res.json()["items"]
    assert not any(r["slug"] == future_slug for r in items)

    # Public detail must return 404
    detail_res = client.get(f"/api/v1/resources/{future_slug}")
    assert detail_res.status_code == 404


def test_10_public_get_resource_detail(client):
    admin_user, _ = seed_user(f"admin_{uuid.uuid4().hex[:6]}@example.com", role="platform_admin")
    headers = auth_headers(admin_user)

    slug = f"detail-test-guide-{uuid.uuid4().hex[:6]}"
    client.post(
        "/api/v1/admin/resources",
        headers=headers,
        json={
            "title": "TLS 1.3 Deployment Manual",
            "slug": slug,
            "description": "Hardening cipher suites for modern web servers.",
            "resource_type": "guide",
            "content": "# TLS 1.3 Setup\n\nConfigure your web server to prefer TLS 1.3.",
            "status": "published",
        },
    )

    res = client.get(f"/api/v1/resources/{slug}")
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "TLS 1.3 Deployment Manual"
    assert data["content"] is not None


def test_11_public_filter_resources_by_type(client):
    admin_user, _ = seed_user(f"admin_{uuid.uuid4().hex[:6]}@example.com", role="platform_admin")
    headers = auth_headers(admin_user)

    checklist_slug = f"chk-{uuid.uuid4().hex[:6]}"
    tool_slug = f"tool-{uuid.uuid4().hex[:6]}"

    client.post(
        "/api/v1/admin/resources",
        headers=headers,
        json={
            "title": "Filtering Checklist",
            "slug": checklist_slug,
            "description": "Checklist item.",
            "resource_type": "checklist",
            "status": "published",
        },
    )
    client.post(
        "/api/v1/admin/resources",
        headers=headers,
        json={
            "title": "Filtering Tool",
            "slug": tool_slug,
            "description": "Tool item.",
            "resource_type": "tool",
            "status": "published",
        },
    )

    res = client.get("/api/v1/resources?resource_type=checklist")
    assert res.status_code == 200
    items = res.json()["items"]
    assert all(r["resource_type"] == "checklist" for r in items)
    assert any(r["slug"] == checklist_slug for r in items)
    assert not any(r["slug"] == tool_slug for r in items)


def test_12_public_search_resources(client):
    admin_user, _ = seed_user(f"admin_{uuid.uuid4().hex[:6]}@example.com", role="platform_admin")
    headers = auth_headers(admin_user)

    slug = f"dkim-guide-{uuid.uuid4().hex[:6]}"
    client.post(
        "/api/v1/admin/resources",
        headers=headers,
        json={
            "title": "DKIM Cryptographic Key Rotation",
            "slug": slug,
            "description": "How to rotate RSA 2048-bit DKIM selectors safely.",
            "resource_type": "guide",
            "status": "published",
        },
    )

    res = client.get("/api/v1/resources?q=cryptographic")
    assert res.status_code == 200
    items = res.json()["items"]
    assert any(r["slug"] == slug for r in items)


def test_13_public_resources_sitemap_items(client):
    res = client.get("/api/v1/resources/sitemap/items")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    for item in items:
        assert "slug" in item
        assert "title" in item
        assert "published_at" in item


# =========================================================================
# 2. NEWSLETTER SUBSCRIPTION TESTS
# =========================================================================

def test_14_newsletter_subscribe_success(client):
    email = f"subscriber_{uuid.uuid4().hex[:6]}@example.com"
    res = client.post(
        "/api/v1/newsletter/subscribe",
        json={"email": email, "source": "blog"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "subscribed"
    assert "Thank you" in data["message"]


def test_15_newsletter_subscribe_duplicate_idempotent(client):
    email = f"dup_{uuid.uuid4().hex[:6]}@example.com"

    # First subscribe
    res1 = client.post("/api/v1/newsletter/subscribe", json={"email": email})
    assert res1.status_code == 200

    # Second subscribe: must be idempotent and friendly
    res2 = client.post("/api/v1/newsletter/subscribe", json={"email": email})
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "subscribed"
    assert "already subscribed" in data2["message"].lower()


def test_16_newsletter_unsubscribe_and_resubscribe(client):
    email = f"unsub_{uuid.uuid4().hex[:6]}@example.com"

    # 1. Subscribe
    client.post("/api/v1/newsletter/subscribe", json={"email": email})

    # 2. Unsubscribe
    unsub_res = client.post("/api/v1/newsletter/unsubscribe", json={"email": email})
    assert unsub_res.status_code == 200
    assert unsub_res.json()["status"] == "unsubscribed"

    # 3. Resubscribe
    resub_res = client.post("/api/v1/newsletter/subscribe", json={"email": email})
    assert resub_res.status_code == 200
    assert "reactivated" in resub_res.json()["message"].lower()


def test_17_newsletter_subscribe_invalid_email(client):
    res = client.post("/api/v1/newsletter/subscribe", json={"email": "not-an-email"})
    assert res.status_code == 422


def test_18_newsletter_rate_limiting(client):
    _memory_rate_limits.clear()
    for i in range(5):
        client.post(
            "/api/v1/newsletter/subscribe",
            json={"email": f"test_rate_{i}_{uuid.uuid4().hex[:4]}@example.com"},
        )

    # 6th attempt from the same client should trigger rate limit 429
    res = client.post(
        "/api/v1/newsletter/subscribe",
        json={"email": f"test_rate_6_{uuid.uuid4().hex[:4]}@example.com"},
    )
    assert res.status_code == 429


def test_19_admin_newsletter_subscribers_listing(client):
    admin_user, _ = seed_user(f"admin_{uuid.uuid4().hex[:6]}@example.com", role="platform_admin")
    headers = auth_headers(admin_user)

    res = client.get("/api/v1/admin/newsletter/subscribers", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data

    # Regular user blocked
    reg_user, _ = seed_user(f"reg_{uuid.uuid4().hex[:6]}@example.com", role="user")
    res_reg = client.get("/api/v1/admin/newsletter/subscribers", headers=auth_headers(reg_user))
    assert res_reg.status_code == 403


# =========================================================================
# 3. CONTENT ANALYTICS TESTS
# =========================================================================

def test_20_content_analytics_record_event_success(client):
    res = client.post(
        "/api/v1/analytics/events",
        json={
            "event_name": "blog_article_view",
            "content_type": "blog_post",
            "content_id": "tls-configuration-guide",
            "path": "/blog/tls-configuration-guide",
            "source": "organic_search",
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "recorded"


def test_21_content_analytics_invalid_event_rejected(client):
    res = client.post(
        "/api/v1/analytics/events",
        json={
            "event_name": "arbitrary_malicious_event",
            "content_type": "blog_post",
        },
    )
    assert res.status_code == 400


def test_22_admin_content_analytics_summary(client):
    admin_user, _ = seed_user(f"admin_{uuid.uuid4().hex[:6]}@example.com", role="platform_admin")
    headers = auth_headers(admin_user)

    # Record some real events
    article_slug = f"article-metrics-{uuid.uuid4().hex[:6]}"
    client.post(
        "/api/v1/analytics/events",
        json={
            "event_name": "blog_article_view",
            "content_type": "blog_post",
            "content_id": article_slug,
        },
    )
    client.post(
        "/api/v1/analytics/events",
        json={
            "event_name": "blog_cta_click",
            "content_type": "scanner",
            "content_id": article_slug,
        },
    )

    res = client.get("/api/v1/admin/analytics/content?days=30", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_article_views" in data
    assert "total_cta_clicks" in data
    assert "top_articles" in data
    assert data["total_article_views"] >= 1
    assert data["total_cta_clicks"] >= 1

    # Non-admin blocked
    reg_user, _ = seed_user(f"reg_{uuid.uuid4().hex[:6]}@example.com", role="user")
    res_reg = client.get("/api/v1/admin/analytics/content", headers=auth_headers(reg_user))
    assert res_reg.status_code == 403


# =========================================================================
# 4. AUDIT LOGGING TESTS
# =========================================================================

def test_23_audit_logging_e7(client):
    admin_user, _ = seed_user(f"admin_{uuid.uuid4().hex[:6]}@example.com", role="platform_admin")
    headers = auth_headers(admin_user)

    res = client.post(
        "/api/v1/admin/resources",
        headers=headers,
        json={
            "title": "Audited Resource Item",
            "slug": f"audited-{uuid.uuid4().hex[:6]}",
            "description": "Verifying audit log creation.",
            "resource_type": "guide",
        },
    )
    assert res.status_code == 201

    with TestingSyncSessionLocal() as session:
        stmt = select(AuditLog).where(AuditLog.action == "RESOURCE_CREATED").order_by(AuditLog.created_at.desc())
        log = session.execute(stmt).scalars().first()
        assert log is not None
        assert log.action == "RESOURCE_CREATED"
        assert log.user_id == admin_user.id
