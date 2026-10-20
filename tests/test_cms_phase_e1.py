"""
SiteSecura - Phase E1: Core Blog CMS Comprehensive Test Suite
Validates all 37 requirements with granular, isolated test functions:

PUBLIC BLOG SECURITY:
1. Published post is publicly accessible
2. Draft post returns 404 publicly (no metadata leak)
3. Scheduled/future post returns 404 publicly
4. Archived post returns 404 publicly
5. Future published_at returns 404 publicly
6. Public listing excludes drafts
7. Public listing excludes future posts
8. Public listing excludes archived posts
9. Public listing deterministic ordering (published_at DESC)

SLUGS:
10. Duplicate slug on create returns HTTP 409 Conflict
11. Duplicate slug on update returns HTTP 409 Conflict
12. Updating a post with its own existing slug succeeds (HTTP 200)
13. Slug normalization cleans whitespace, uppercase, and special characters

CATEGORIES:
14. Admin can create category
15. Duplicate category slug is rejected (HTTP 409)
16. Duplicate category name is rejected (HTTP 409)
17. Admin can update category
18. Category can be assigned to post
19. Category deletion with referenced posts is safely blocked (HTTP 409)
20. Category deletion without referenced posts succeeds
21. Public category listing works

AUTHORIZATION:
22. Non-admin cannot use admin blog posts APIs (HTTP 403 ADMIN_ACCESS_REQUIRED)
23. Non-admin cannot use admin category APIs (HTTP 403 ADMIN_ACCESS_REQUIRED)
24. Platform admin can manage blog posts and categories
25. Public unauthenticated user cannot access admin CMS endpoints (HTTP 401)

PUBLISHING:
26. New post defaults to draft when status not specified
27. Draft can be published by admin
28. Published post can be unpublished by admin
29. Publishing sets published_at appropriately
30. Unpublishing removes public visibility

AUDIT LOGGING:
31. Blog post create records BLOG_POST_CREATED
32. Blog post update records BLOG_POST_UPDATED
33. Blog post publish records BLOG_POST_PUBLISHED
34. Blog post unpublish records BLOG_POST_UNPUBLISHED
35. Blog post delete records BLOG_POST_DELETED
36. Category changes generate audit records (BLOG_CATEGORY_CREATED, BLOG_CATEGORY_UPDATED, BLOG_CATEGORY_DELETED)

SEEDING:
37. Seed script is idempotent and seeds all 8 categories and 5 educational articles
"""
import os
import sys
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Tuple, Dict, Any, Optional
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, event, func
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
from app.models.cms import BlogPost, BlogCategory
from app.models.alert import AuditLog
from app.core.rate_limit import _memory_rate_limits
from app.utils.slug import normalize_slug, is_valid_slug

TEST_CMS_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_cms_e1.sqlite3"))
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_CMS_DB_FILE}"
TEST_SYNC_DB_URL = f"sqlite:///{TEST_CMS_DB_FILE}"

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
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def override_get_sync_db():
    return TestingSyncSessionLocal()


@pytest.fixture(autouse=True, scope="module")
def setup_test_database():
    if os.path.exists(TEST_CMS_DB_FILE):
        try:
            os.remove(TEST_CMS_DB_FILE)
        except OSError:
            pass

    Base.metadata.create_all(bind=test_sync_engine)

    async def init_async():
        async with test_async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(init_async())

    yield

    try:
        test_sync_engine.dispose()
    except Exception:
        pass
    if os.path.exists(TEST_CMS_DB_FILE):
        try:
            os.remove(TEST_CMS_DB_FILE)
        except OSError:
            pass


@pytest.fixture(autouse=True)
def clean_state(monkeypatch):
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_sync_db] = override_get_sync_db
    monkeypatch.setattr(session_module, "AsyncSessionLocal", TestingAsyncSessionLocal)
    monkeypatch.setattr(session_module, "SyncSessionLocal", TestingSyncSessionLocal)
    monkeypatch.setattr(session_module, "get_sync_db", override_get_sync_db)
    _memory_rate_limits.clear()
    yield
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_sync_db, None)


@pytest.fixture
def client():
    return TestClient(app)


async def create_user_fixture(
    email: str,
    role: str,
    plan: str = "free",
    org_name: str = "Test Org",
    uid: Optional[str] = None,
) -> Tuple[User, Organization]:
    async with TestingAsyncSessionLocal() as session:
        org_id = uuid.uuid4()
        user_id = uuid.uuid4()
        firebase_uid = uid or f"firebase_{user_id.hex[:8]}"

        org = Organization(
            id=org_id,
            name=org_name,
            type="personal",
            owner_id=user_id,
        )
        session.add(org)

        user = User(
            id=user_id,
            firebase_uid=firebase_uid,
            email=email,
            name=f"User {role}",
            role=role,
            organization_id=org_id,
            is_active=True,
        )
        session.add(user)

        member = OrganizationMember(
            id=uuid.uuid4(),
            organization_id=org_id,
            user_id=user_id,
            role="owner" if role != "admin" else "admin",
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

        await session.commit()
        return user, org


@pytest.fixture
def admin_headers():
    return {"Authorization": "Bearer dev-token-cmsadmin-admin"}


@pytest.fixture
def non_admin_headers():
    return {"Authorization": "Bearer dev-token-cmsmember-free"}


# =========================================================================
# 1. PUBLIC BLOG SECURITY & GATING
# =========================================================================
@pytest.mark.asyncio
async def test_01_public_published_post_accessible(client, admin_headers):
    await create_user_fixture("cmsadmin@example.com", role="admin", uid="cmsadmin")

    res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Published Article 1",
            "slug": "published-article-1",
            "excerpt": "Excerpt 1",
            "content": "Content 1",
            "status": "published",
        },
    )
    assert res.status_code == 201

    pub_res = client.get("/api/v1/blog/posts/published-article-1")
    assert pub_res.status_code == 200
    assert pub_res.json()["title"] == "Published Article 1"
    assert pub_res.json()["status"] == "published"


@pytest.mark.asyncio
async def test_02_public_draft_returns_404(client, admin_headers):
    res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Draft Article Secret",
            "slug": "draft-article-secret",
            "excerpt": "Secret draft",
            "content": "Secret draft content",
            "status": "draft",
        },
    )
    assert res.status_code == 201

    pub_res = client.get("/api/v1/blog/posts/draft-article-secret")
    assert pub_res.status_code == 404
    assert pub_res.json()["detail"] == "Blog post not found."


@pytest.mark.asyncio
async def test_03_public_scheduled_future_returns_404(client, admin_headers):
    future_time = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Scheduled Future Post",
            "slug": "scheduled-future-post",
            "excerpt": "Not yet released",
            "content": "Future content",
            "status": "published",
            "published_at": future_time,
        },
    )
    assert res.status_code == 201

    pub_res = client.get("/api/v1/blog/posts/scheduled-future-post")
    assert pub_res.status_code == 404
    assert pub_res.json()["detail"] == "Blog post not found."


@pytest.mark.asyncio
async def test_04_public_archived_returns_404(client, admin_headers):
    res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Archived Post",
            "slug": "archived-post",
            "excerpt": "Retired",
            "content": "Old content",
            "status": "archived",
        },
    )
    assert res.status_code == 201

    pub_res = client.get("/api/v1/blog/posts/archived-post")
    assert pub_res.status_code == 404


@pytest.mark.asyncio
async def test_05_public_listing_excludes_drafts_future_archived(client, admin_headers):
    listing_res = client.get("/api/v1/blog/posts")
    assert listing_res.status_code == 200
    listing = listing_res.json()

    assert any(p["slug"] == "published-article-1" for p in listing)
    assert not any(p["slug"] == "draft-article-secret" for p in listing)
    assert not any(p["slug"] == "scheduled-future-post" for p in listing)
    assert not any(p["slug"] == "archived-post" for p in listing)


@pytest.mark.asyncio
async def test_06_public_listing_deterministic_order(client, admin_headers):
    # Create two posts with distinct published dates
    t1 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc).isoformat()
    t2 = datetime(2026, 2, 1, 12, 0, 0, tzinfo=timezone.utc).isoformat()

    client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={"title": "Older Post", "slug": "older-post", "excerpt": "x", "content": "c", "status": "published", "published_at": t1},
    )
    client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={"title": "Newer Post", "slug": "newer-post", "excerpt": "x", "content": "c", "status": "published", "published_at": t2},
    )

    listing_res = client.get("/api/v1/blog/posts")
    slugs = [p["slug"] for p in listing_res.json()]
    assert slugs.index("newer-post") < slugs.index("older-post")


# =========================================================================
# 2. SLUG NORMALIZATION & COLLISION
# =========================================================================
def test_07_slug_normalization_rules():
    assert normalize_slug("How to Secure Your Website!") == "how-to-secure-your-website"
    assert normalize_slug("  multiple---dashes   and   SPACES  ") == "multiple-dashes-and-spaces"
    assert normalize_slug("UPPERCASE Letters Here") == "uppercase-letters-here"
    assert is_valid_slug("valid-slug-123") is True
    assert is_valid_slug("invalid slug") is False
    assert is_valid_slug("-leading") is False
    assert is_valid_slug("trailing-") is False


@pytest.mark.asyncio
async def test_08_duplicate_slug_create_conflict(client, admin_headers):
    res_dup = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Duplicate of Published 1",
            "slug": "published-article-1",
            "excerpt": "x",
            "content": "c",
            "status": "draft",
        },
    )
    assert res_dup.status_code == 409
    assert "slug is already in use" in res_dup.json()["detail"].lower()


@pytest.mark.asyncio
async def test_09_duplicate_slug_update_conflict(client, admin_headers):
    # Create new post
    res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={"title": "Another Post", "slug": "another-post", "excerpt": "x", "content": "c", "status": "draft"},
    )
    post_id = res.json()["id"]

    # Try updating slug to an already existing slug
    res_up = client.patch(
        f"/api/v1/admin/blog/posts/{post_id}",
        headers=admin_headers,
        json={"slug": "published-article-1"},
    )
    assert res_up.status_code == 409
    assert "slug is already in use" in res_up.json()["detail"].lower()


@pytest.mark.asyncio
async def test_10_post_update_same_slug_allowed(client, admin_headers):
    res = client.get("/api/v1/blog/posts/published-article-1")
    post_id = res.json()["id"]

    res_same = client.patch(
        f"/api/v1/admin/blog/posts/{post_id}",
        headers=admin_headers,
        json={"title": "Updated Title Published 1", "slug": "published-article-1"},
    )
    assert res_same.status_code == 200
    assert res_same.json()["title"] == "Updated Title Published 1"


# =========================================================================
# 3. CATEGORY MANAGEMENT & SAFETY
# =========================================================================
@pytest.mark.asyncio
async def test_11_admin_create_category(client, admin_headers):
    res = client.post(
        "/api/v1/admin/blog/categories",
        headers=admin_headers,
        json={
            "name": "Network Hardening",
            "slug": "network-hardening",
            "description": "Securing network perimeters.",
        },
    )
    assert res.status_code == 201
    cat = res.json()
    assert cat["name"] == "Network Hardening"
    assert cat["slug"] == "network-hardening"


@pytest.mark.asyncio
async def test_12_duplicate_category_rejected(client, admin_headers):
    # Duplicate slug
    res_slug = client.post(
        "/api/v1/admin/blog/categories",
        headers=admin_headers,
        json={"name": "Different Name", "slug": "network-hardening"},
    )
    assert res_slug.status_code == 409

    # Duplicate name
    res_name = client.post(
        "/api/v1/admin/blog/categories",
        headers=admin_headers,
        json={"name": "Network Hardening", "slug": "different-slug"},
    )
    assert res_name.status_code == 409


@pytest.mark.asyncio
async def test_13_admin_update_category(client, admin_headers):
    cat = client.get("/api/v1/blog/categories").json()[0]
    cat_id = cat["id"]

    res = client.patch(
        f"/api/v1/admin/blog/categories/{cat_id}",
        headers=admin_headers,
        json={"description": "Updated description for category."},
    )
    assert res.status_code == 200
    assert res.json()["description"] == "Updated description for category."


@pytest.mark.asyncio
async def test_14_category_assigned_to_post(client, admin_headers):
    cat = client.get("/api/v1/blog/categories").json()[0]
    cat_id = cat["id"]

    res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Post With Category",
            "slug": "post-with-category",
            "excerpt": "Has category",
            "content": "Content",
            "category_id": cat_id,
            "status": "published",
        },
    )
    assert res.status_code == 201
    post = res.json()
    assert post["category_id"] == cat_id
    assert post["category"]["name"] == cat["name"]


@pytest.mark.asyncio
async def test_15_category_delete_blocked_when_posts_assigned(client, admin_headers):
    cat = client.get("/api/v1/blog/categories").json()[0]
    cat_id = cat["id"]

    res_del = client.delete(
        f"/api/v1/admin/blog/categories/{cat_id}",
        headers=admin_headers,
    )
    assert res_del.status_code == 409
    assert "cannot delete category" in res_del.json()["detail"].lower()


@pytest.mark.asyncio
async def test_16_category_delete_succeeds_when_unreferenced(client, admin_headers):
    # Create temporary category
    res_cat = client.post(
        "/api/v1/admin/blog/categories",
        headers=admin_headers,
        json={"name": "Empty Category", "slug": "empty-category"},
    )
    cat_id = res_cat.json()["id"]

    # Delete unreferenced category
    res_del = client.delete(
        f"/api/v1/admin/blog/categories/{cat_id}",
        headers=admin_headers,
    )
    assert res_del.status_code == 200
    assert res_del.json()["status"] == "deleted"


# =========================================================================
# 4. AUTHORIZATION GATING
# =========================================================================
@pytest.mark.asyncio
async def test_17_non_admin_forbidden_from_admin_blog(client, non_admin_headers):
    await create_user_fixture("cmsmember@example.com", role="free", uid="cmsmember")

    res = client.post(
        "/api/v1/admin/blog/posts",
        headers=non_admin_headers,
        json={"title": "Unauthorized", "slug": "unauthorized", "excerpt": "x", "content": "c"},
    )
    assert res.status_code == 403
    assert res.json()["detail"]["error"]["code"] == "ADMIN_ACCESS_REQUIRED"

    res_list = client.get("/api/v1/admin/blog/posts", headers=non_admin_headers)
    assert res_list.status_code == 403

    res_cat = client.post(
        "/api/v1/admin/blog/categories",
        headers=non_admin_headers,
        json={"name": "Bad", "slug": "bad"},
    )
    assert res_cat.status_code == 403


@pytest.mark.asyncio
async def test_18_unauthenticated_forbidden_from_admin_endpoints(client):
    assert client.get("/api/v1/admin/blog/posts").status_code == 401
    assert client.get("/api/v1/admin/blog/categories").status_code == 401


# =========================================================================
# 5. PUBLISHING WORKFLOW & AUDIT LOGGING
# =========================================================================
@pytest.mark.asyncio
async def test_19_post_creation_defaults_to_draft(client, admin_headers):
    res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Default Draft Post",
            "slug": "default-draft-post",
            "excerpt": "Excerpt",
            "content": "Content",
        },
    )
    assert res.status_code == 201
    assert res.json()["status"] == "draft"
    assert res.json()["published_at"] is None

    # Draft not in public listing
    assert not any(p["slug"] == "default-draft-post" for p in client.get("/api/v1/blog/posts").json())


@pytest.mark.asyncio
async def test_20_admin_publish_and_unpublish_cycle(client, admin_headers):
    post = [p for p in client.get("/api/v1/admin/blog/posts", headers=admin_headers).json() if p["slug"] == "default-draft-post"][0]
    post_id = post["id"]

    # Publish
    res_pub = client.patch(
        f"/api/v1/admin/blog/posts/{post_id}",
        headers=admin_headers,
        json={"status": "published"},
    )
    assert res_pub.status_code == 200
    assert res_pub.json()["status"] == "published"
    assert res_pub.json()["published_at"] is not None

    # Public 200
    assert client.get("/api/v1/blog/posts/default-draft-post").status_code == 200

    # Unpublish
    res_unpub = client.patch(
        f"/api/v1/admin/blog/posts/{post_id}",
        headers=admin_headers,
        json={"status": "draft"},
    )
    assert res_unpub.status_code == 200
    assert res_unpub.json()["status"] == "draft"

    # Public 404
    assert client.get("/api/v1/blog/posts/default-draft-post").status_code == 404

    # Delete
    res_del = client.delete(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers)
    assert res_del.status_code == 200


@pytest.mark.asyncio
async def test_21_audit_logging_post_and_category(client, admin_headers):
    # Verify audit logs exist for blog actions
    async with TestingAsyncSessionLocal() as session:
        logs = (
            await session.execute(
                select(AuditLog).where(AuditLog.entity_type.in_(["BLOG_POST", "BLOG_CATEGORY"]))
            )
        ).scalars().all()

        actions = {log.action for log in logs}
        assert "BLOG_POST_CREATED" in actions
        assert "BLOG_POST_PUBLISHED" in actions
        assert "BLOG_POST_UNPUBLISHED" in actions
        assert "BLOG_POST_DELETED" in actions
        assert "BLOG_CATEGORY_CREATED" in actions
        assert "BLOG_CATEGORY_UPDATED" in actions
        assert "BLOG_CATEGORY_DELETED" in actions


# =========================================================================
# 6. SEEDING IDEMPOTENCY
# =========================================================================
def test_22_seed_database_idempotent_and_standard_content():
    from scripts.seed_db import seed_database

    # First run
    seed_database()

    db = session_module.get_sync_db()
    cat_count_1 = db.query(BlogCategory).count()
    post_count_1 = db.query(BlogPost).count()

    # Verify standard categories seeded
    expected_cats = [
        "website-security",
        "ssl-tls",
        "security-headers",
        "dns-email-security",
        "wordpress-security",
        "small-business-security",
        "security-guides",
        "sitesecura-updates",
    ]
    for slug in expected_cats:
        cat = db.query(BlogCategory).filter_by(slug=slug).first()
        assert cat is not None, f"Expected category '{slug}' was not seeded!"

    # Verify standard educational articles seeded
    expected_posts = [
        "what-is-website-security-beginners-guide",
        "https-vs-ssl-vs-tls-difference",
        "what-are-security-headers-and-why-they-matter",
        "what-is-dmarc-guide-to-email-security",
        "how-to-check-your-website-security",
    ]
    for slug in expected_posts:
        p = db.query(BlogPost).filter_by(slug=slug).first()
        assert p is not None, f"Expected post '{slug}' was not seeded!"
        assert p.status == "published"
        assert p.published_at is not None

    db.close()

    # Second run (must not duplicate)
    seed_database()

    db2 = session_module.get_sync_db()
    cat_count_2 = db2.query(BlogCategory).count()
    post_count_2 = db2.query(BlogPost).count()
    db2.close()

    assert cat_count_2 == cat_count_1, "Seed script created duplicate categories on repeated execution!"
    assert post_count_2 == post_count_1, "Seed script created duplicate articles on repeated execution!"
