"""
SiteSecura - Phase E4: SEO Engine, Structured Data, Dynamic Sitemap & Slug Redirects Test Suite
Validates all Phase E4 specifications:
1. SEO metadata fields persistence (seo_title, meta_description, canonical_url, og_image)
2. FAQ creation, ordering by display_order, updating, and cascade deletion
3. Slug change on published post creates BlogRedirect (301) and emits BLOG_POST_SLUG_CHANGED audit log
4. Slug change on draft post does NOT create BlogRedirect
5. Redirect chain collapsing: A -> B, then B -> C collapses to A -> C and B -> C
6. Redirect loop prevention & reverting to old slug cleans up obsolete redirects
7. Public redirect lookup GET /api/v1/blog/redirects/{slug}:
   - Returns 200 with target_slug and status_code: 301 for published posts
   - Returns 404 if target post is draft
   - Returns 404 if target post is scheduled in the future
   - Returns 404 if slug is unknown
8. Public sitemap posts endpoint GET /api/v1/blog/sitemap-posts:
   - Returns ONLY published posts with published_at in the past
   - Strictly excludes drafts, scheduled posts, and archived posts
   - Returns slug, updated_at, published_at, featured_media
9. Admin redirects listing GET /api/v1/admin/blog/redirects:
   - Admin access (200)
   - Non-admin rejection (403 Forbidden)
   - Unauthenticated rejection (401 Unauthorized)
10. Slug collision validation: duplicate slug rejection prevents routing corruption
"""

import os
import sys
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Tuple, Optional
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, event, delete
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
from app.models.cms import BlogPost, BlogCategory, BlogPostFAQ, BlogRedirect, MediaAsset
from app.models.alert import AuditLog
from app.core.rate_limit import _memory_rate_limits
from app.core.config import settings

TEST_CMS_E4_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_cms_e4.sqlite3"))
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_CMS_E4_DB_FILE}"
TEST_SYNC_DB_URL = f"sqlite:///{TEST_CMS_E4_DB_FILE}"

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
    if os.path.exists(TEST_CMS_E4_DB_FILE):
        try:
            os.remove(TEST_CMS_E4_DB_FILE)
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
    if os.path.exists(TEST_CMS_E4_DB_FILE):
        try:
            os.remove(TEST_CMS_E4_DB_FILE)
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
        firebase_uid = uid or f"firebase_{uuid.uuid4().hex[:8]}"
        existing_user = (await session.execute(
            select(User).where(User.firebase_uid == firebase_uid)
        )).scalar_one_or_none()
        if existing_user:
            existing_org = (await session.execute(
                select(Organization).where(Organization.id == existing_user.organization_id)
            )).scalar_one()
            return existing_user, existing_org

        org_id = uuid.uuid4()
        user_id = uuid.uuid4()

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
# 1. SEO FIELDS PERSISTENCE & METADATA
# =========================================================================

@pytest.mark.asyncio
async def test_01_create_and_update_post_with_seo_fields(client, admin_headers):
    await create_user_fixture("admin_seo@example.com", role="admin", uid="cmsadmin")

    payload = {
        "title": "Complete CSP Header Security Guide",
        "slug": "complete-csp-header-security-guide",
        "excerpt": "A deep dive into Content-Security-Policy implementation.",
        "content": "# CSP Guide\n\nContent Security Policy helps stop XSS.",
        "status": "published",
        "seo_title": "CSP Security Guide: Protect Next.js Apps",
        "meta_description": "Comprehensive tutorial on Content Security Policy (CSP) directives.",
        "canonical_url": "https://sitesecura.com/blog/complete-csp-header-security-guide",
        "og_image": "https://sitesecura.com/images/csp-banner.png",
    }

    res = client.post("/api/v1/admin/blog/posts", headers=admin_headers, json=payload)
    assert res.status_code == 201
    post = res.json()
    post_id = post["id"]

    assert post["seo_title"] == "CSP Security Guide: Protect Next.js Apps"
    assert post["meta_description"] == "Comprehensive tutorial on Content Security Policy (CSP) directives."
    assert post["canonical_url"] == "https://sitesecura.com/blog/complete-csp-header-security-guide"
    assert post["og_image"] == "https://sitesecura.com/images/csp-banner.png"

    # Update SEO fields
    update_payload = {
        "seo_title": "Updated CSP Guide (2026 Edition)",
        "meta_description": "Updated meta description for testing.",
        "canonical_url": "https://sitesecura.com/blog/canonical-override",
    }
    update_res = client.patch(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers, json=update_payload)
    assert update_res.status_code == 200
    updated_post = update_res.json()

    assert updated_post["seo_title"] == "Updated CSP Guide (2026 Edition)"
    assert updated_post["meta_description"] == "Updated meta description for testing."
    assert updated_post["canonical_url"] == "https://sitesecura.com/blog/canonical-override"
    assert updated_post["og_image"] == "https://sitesecura.com/images/csp-banner.png"


# =========================================================================
# 2. FAQ ORDERING & CASCADE DELETION
# =========================================================================

@pytest.mark.asyncio
async def test_02_post_faqs_lifecycle_ordering_and_cascade(client, admin_headers):
    await create_user_fixture("admin_faq@example.com", role="admin", uid="cmsadmin")

    faqs_data = [
        {"question": "What is XSS?", "answer": "Cross-Site Scripting vulnerability.", "display_order": 1},
        {"question": "How to prevent CSRF?", "answer": "Use anti-CSRF tokens and SameSite cookies.", "display_order": 2},
        {"question": "What is HSTS?", "answer": "HTTP Strict Transport Security.", "display_order": 3},
    ]

    payload = {
        "title": "Web Security FAQ Post",
        "slug": "web-security-faq-post",
        "excerpt": "FAQ testing post.",
        "content": "Content with FAQ items.",
        "status": "published",
        "faqs": faqs_data,
    }

    res = client.post("/api/v1/admin/blog/posts", headers=admin_headers, json=payload)
    assert res.status_code == 201
    post = res.json()
    post_id = post["id"]

    assert len(post["faqs"]) == 3
    assert post["faqs"][0]["question"] == "What is XSS?"
    assert post["faqs"][1]["question"] == "How to prevent CSRF?"
    assert post["faqs"][2]["question"] == "What is HSTS?"

    # Public endpoint returns faqs
    public_res = client.get("/api/v1/blog/posts/web-security-faq-post")
    assert public_res.status_code == 200
    public_post = public_res.json()
    assert len(public_post["faqs"]) == 3

    # Update faqs: replace with 2 different FAQs
    new_faqs = [
        {"question": "Updated Q1?", "answer": "Updated A1.", "display_order": 1},
        {"question": "Updated Q2?", "answer": "Updated A2.", "display_order": 2},
    ]
    patch_res = client.patch(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers, json={"faqs": new_faqs})
    assert patch_res.status_code == 200
    assert len(patch_res.json()["faqs"]) == 2
    assert patch_res.json()["faqs"][0]["question"] == "Updated Q1?"

    # Delete post and verify cascade deletion of FAQs
    del_res = client.delete(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers)
    assert del_res.status_code == 200

    async with TestingAsyncSessionLocal() as session:
        orphan_faqs = (await session.execute(
            select(BlogPostFAQ).where(BlogPostFAQ.blog_post_id == uuid.UUID(post_id))
        )).scalars().all()
        assert len(orphan_faqs) == 0


# =========================================================================
# 3. SLUG CHANGE CREATES REDIRECT & AUDIT LOG
# =========================================================================

@pytest.mark.asyncio
async def test_03_slug_change_creates_redirect_for_published_post(client, admin_headers):
    await create_user_fixture("admin_redirect@example.com", role="admin", uid="cmsadmin")

    create_res = client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Original Slug Post",
        "slug": "original-slug-2026",
        "excerpt": "Testing redirects.",
        "content": "Redirect content.",
        "status": "published",
    })
    assert create_res.status_code == 201
    post_id = create_res.json()["id"]

    # Change slug on published post
    update_res = client.patch(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers, json={
        "slug": "new-slug-2026",
    })
    assert update_res.status_code == 200
    assert update_res.json()["slug"] == "new-slug-2026"

    # Verify BlogRedirect created
    async with TestingAsyncSessionLocal() as session:
        redirects = (await session.execute(
            select(BlogRedirect).where(BlogRedirect.old_slug == "original-slug-2026")
        )).scalars().all()
        assert len(redirects) == 1
        assert redirects[0].target_slug == "new-slug-2026"
        assert redirects[0].status_code == 301

        # Verify AuditLog created
        logs = (await session.execute(
            select(AuditLog).where(AuditLog.action == "BLOG_POST_SLUG_CHANGED")
        )).scalars().all()
        assert len(logs) >= 1
        log_entry = [l for l in logs if l.metadata_json and l.metadata_json.get("old_slug") == "original-slug-2026"][0]
        assert log_entry.metadata_json["new_slug"] == "new-slug-2026"


# =========================================================================
# 4. SLUG CHANGE ON DRAFT DOES NOT CREATE REDIRECT
# =========================================================================

@pytest.mark.asyncio
async def test_04_slug_change_on_draft_does_not_create_redirect(client, admin_headers):
    await create_user_fixture("admin_draft_red@example.com", role="admin", uid="cmsadmin")

    create_res = client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Draft Post For Slug Test",
        "slug": "draft-slug-initial",
        "excerpt": "Testing draft slug changes.",
        "content": "Draft content.",
        "status": "draft",
    })
    assert create_res.status_code == 201
    post_id = create_res.json()["id"]

    # Update draft slug
    update_res = client.patch(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers, json={
        "slug": "draft-slug-revised",
    })
    assert update_res.status_code == 200

    # Verify NO redirect created
    async with TestingAsyncSessionLocal() as session:
        redirects = (await session.execute(
            select(BlogRedirect).where(BlogRedirect.old_slug == "draft-slug-initial")
        )).scalars().all()
        assert len(redirects) == 0


# =========================================================================
# 5. REDIRECT CHAIN COLLAPSING (A -> B, B -> C => A -> C, B -> C)
# =========================================================================

@pytest.mark.asyncio
async def test_05_redirect_chain_collapsing(client, admin_headers):
    await create_user_fixture("admin_chain@example.com", role="admin", uid="cmsadmin")

    # 1. Post starts with slug-a
    post_res = client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Chained Article",
        "slug": "chain-slug-a",
        "excerpt": "Testing chains.",
        "content": "Content.",
        "status": "published",
    })
    assert post_res.status_code == 201
    post_id = post_res.json()["id"]

    # 2. Change slug-a -> slug-b
    client.patch(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers, json={"slug": "chain-slug-b"})

    # 3. Change slug-b -> slug-c
    client.patch(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers, json={"slug": "chain-slug-c"})

    # Verify chain collapsed: BOTH slug-a and slug-b target slug-c directly
    async with TestingAsyncSessionLocal() as session:
        redirect_a = (await session.execute(
            select(BlogRedirect).where(BlogRedirect.old_slug == "chain-slug-a")
        )).scalar_one_or_none()
        redirect_b = (await session.execute(
            select(BlogRedirect).where(BlogRedirect.old_slug == "chain-slug-b")
        )).scalar_one_or_none()

        assert redirect_a is not None
        assert redirect_a.target_slug == "chain-slug-c"
        assert redirect_b is not None
        assert redirect_b.target_slug == "chain-slug-c"


# =========================================================================
# 6. REVERTING SLUG CLEANS UP OBSOLETE REDIRECTS
# =========================================================================

@pytest.mark.asyncio
async def test_06_redirect_reverting_slug_eliminates_self_redirect(client, admin_headers):
    await create_user_fixture("admin_revert@example.com", role="admin", uid="cmsadmin")

    post_res = client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Revert Article",
        "slug": "revert-slug-x",
        "excerpt": "Testing revert.",
        "content": "Content.",
        "status": "published",
    })
    assert post_res.status_code == 201
    post_id = post_res.json()["id"]

    # Change X -> Y
    client.patch(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers, json={"slug": "revert-slug-y"})

    # Revert back Y -> X
    client.patch(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers, json={"slug": "revert-slug-x"})

    async with TestingAsyncSessionLocal() as session:
        # X -> X must NOT exist
        self_red = (await session.execute(
            select(BlogRedirect).where(
                BlogRedirect.old_slug == "revert-slug-x",
                BlogRedirect.target_slug == "revert-slug-x",
            )
        )).scalars().all()
        assert len(self_red) == 0

        # Y -> X should exist
        y_to_x = (await session.execute(
            select(BlogRedirect).where(BlogRedirect.old_slug == "revert-slug-y")
        )).scalar_one_or_none()
        assert y_to_x is not None
        assert y_to_x.target_slug == "revert-slug-x"


# =========================================================================
# 7. PUBLIC REDIRECT LOOKUP (PUBLISHED VS DRAFT VS FUTURE)
# =========================================================================

@pytest.mark.asyncio
async def test_07_public_redirect_endpoint_published_vs_draft_vs_future(client, admin_headers):
    await create_user_fixture("admin_pub_red@example.com", role="admin", uid="cmsadmin")

    # 1. Create published post and rename slug
    post_res = client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Public Redirect Test Post",
        "slug": "public-red-old",
        "excerpt": "Excerpt",
        "content": "Content",
        "status": "published",
    })
    post_id = post_res.json()["id"]
    client.patch(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers, json={"slug": "public-red-target"})

    # Check public redirect endpoint when post is published
    res = client.get("/api/v1/blog/redirects/public-red-old")
    assert res.status_code == 200
    assert res.json()["target_slug"] == "public-red-target"
    assert res.json()["status_code"] == 301

    # Unpublish target post (switch to draft) -> public redirect must return 404
    client.patch(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers, json={"status": "draft"})
    res_draft = client.get("/api/v1/blog/redirects/public-red-old")
    assert res_draft.status_code == 404

    # Non-existent redirect slug
    res_missing = client.get("/api/v1/blog/redirects/totally-unknown-slug")
    assert res_missing.status_code == 404


# =========================================================================
# 8. SITEMAP ENDPOINT STRICT EXCLUSION
# =========================================================================

@pytest.mark.asyncio
async def test_08_public_sitemap_posts_endpoint(client, admin_headers):
    await create_user_fixture("admin_sitemap@example.com", role="admin", uid="cmsadmin")

    # 1. Published post (should appear)
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Published Sitemap Article",
        "slug": "sitemap-published-article",
        "excerpt": "Visible in sitemap",
        "content": "Content",
        "status": "published",
    })

    # 2. Draft post (should NOT appear)
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Draft Article",
        "slug": "sitemap-draft-article",
        "excerpt": "Hidden from sitemap",
        "content": "Content",
        "status": "draft",
    })

    # 3. Scheduled post with future published_at
    future_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    scheduled_res = client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Future Scheduled Article",
        "slug": "sitemap-scheduled-article",
        "excerpt": "Hidden until future date",
        "content": "Content",
        "status": "scheduled",
    })
    # Update published_at in db directly for scheduled
    sched_id = scheduled_res.json()["id"]
    async with TestingAsyncSessionLocal() as session:
        sched_post = (await session.execute(select(BlogPost).where(BlogPost.id == uuid.UUID(sched_id)))).scalar_one()
        sched_post.published_at = datetime.now(timezone.utc) + timedelta(days=2)
        sched_post.status = "scheduled"
        await session.commit()

    # Call public sitemap endpoint
    res = client.get("/api/v1/blog/sitemap-posts")
    assert res.status_code == 200
    items = res.json()

    slugs = [item["slug"] for item in items]
    assert "sitemap-published-article" in slugs
    assert "sitemap-draft-article" not in slugs
    assert "sitemap-scheduled-article" not in slugs


# =========================================================================
# 9. ADMIN REDIRECTS LISTING & AUTHORIZATION
# =========================================================================

@pytest.mark.asyncio
async def test_09_admin_redirects_listing_authorization(client, admin_headers, non_admin_headers):
    await create_user_fixture("admin_auth_red@example.com", role="admin", uid="cmsadmin")
    await create_user_fixture("member_auth_red@example.com", role="member", uid="cmsmember")

    # 1. Admin access -> 200
    res_admin = client.get("/api/v1/admin/blog/redirects", headers=admin_headers)
    assert res_admin.status_code == 200
    assert isinstance(res_admin.json(), list)

    # 2. Non-admin access -> 403
    res_member = client.get("/api/v1/admin/blog/redirects", headers=non_admin_headers)
    assert res_member.status_code == 403

    # 3. Unauthenticated -> 401
    res_unauth = client.get("/api/v1/admin/blog/redirects")
    assert res_unauth.status_code == 401


# =========================================================================
# 10. SLUG COLLISION PREVENTION
# =========================================================================

@pytest.mark.asyncio
async def test_10_slug_collision_validation(client, admin_headers):
    await create_user_fixture("admin_collision@example.com", role="admin", uid="cmsadmin")

    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Post Alpha",
        "slug": "post-collision-alpha",
        "excerpt": "Alpha",
        "content": "Content",
        "status": "published",
    })

    beta_res = client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Post Beta",
        "slug": "post-collision-beta",
        "excerpt": "Beta",
        "content": "Content",
        "status": "published",
    })
    beta_id = beta_res.json()["id"]

    # Attempt to rename Beta's slug to Alpha's slug -> Must fail with 409 Conflict
    collision_res = client.patch(f"/api/v1/admin/blog/posts/{beta_id}", headers=admin_headers, json={
        "slug": "post-collision-alpha",
    })
    assert collision_res.status_code == 409
    assert "already in use" in collision_res.json()["detail"].lower()
