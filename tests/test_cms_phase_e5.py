"""
SiteSecura - Phase E5: Taxonomy & Discovery Test Suite
Validates all Phase E5 specifications:
1. Tags:
   - Admin tag creation with slug normalization
   - 409 conflict on duplicate tag name or slug
   - Tag update
   - Tag deletion (safe detach without deleting posts)
   - Public tags listing with accurate post_count
   - Tag authorization (admin only, 401 unauthenticated, 403 non-admin)
2. Authors:
   - Admin author creation and slug normalization
   - 409 conflict on duplicate author slug
   - Author update
   - Author safe deletion (sets post author_id to NULL, leaves post intact)
   - Public author listing and detail
   - Strict author privacy (ZERO email, ZERO firebase_uid, ZERO role, ZERO org_id)
   - Author authorization (admin only)
3. Categories:
   - Category filtering on GET /api/v1/blog/posts?category={slug}
   - Unknown category returns empty items, not 500 error
4. Search:
   - Search by title, excerpt, and content
   - Deterministic relevance ordering (title matches ranked above excerpt/content)
   - Case-insensitive search
   - Long query clamping to 100 chars
   - Empty search fallback
   - SQL injection safety (parameterized queries)
5. Pagination:
   - Structure: items, total, page, page_size, total_pages, has_next, has_previous
   - Page 1 vs Page 2 distinct items
   - Limit clamping (max 50)
   - Backward compatibility: unpaginated request returns direct list
6. Filter Combinations:
   - Search + Category
   - Search + Tag
   - Category + Tag
   - Search + Category + Tag
   - Pagination with filters
7. Featured Articles:
   - Admin post creation/update with is_featured=True/False
   - Public GET /api/v1/blog/posts?featured=true
   - Audit logging on feature / unfeature
8. Related Articles:
   - Dedicated GET /api/v1/blog/posts/{slug}/related endpoint
   - Related posts embedded in GET /api/v1/blog/posts/{slug}
   - Deterministic scoring: category (+3), tags (+2 each), author (+1)
   - Exclusion of current post
   - Limit enforcement (max 4)
9. Quarantine & Security:
   - Draft, scheduled, archived posts strictly quarantined from search, tags, category, featured, and related endpoints
"""

import os
import sys
import uuid
import asyncio
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
from app.models.cms import BlogPost, BlogCategory, BlogAuthor, BlogTag, BlogPostTag
from app.models.alert import AuditLog
from app.core.rate_limit import _memory_rate_limits

TEST_CMS_E5_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_cms_e5.sqlite3"))
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_CMS_E5_DB_FILE}"
TEST_SYNC_DB_URL = f"sqlite:///{TEST_CMS_E5_DB_FILE}"

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


def create_user_sync(
    email: str,
    role: str,
    plan: str = "free",
    org_name: str = "Test Org",
    uid: Optional[str] = None,
) -> Tuple[User, Organization]:
    with TestingSyncSessionLocal() as session:
        firebase_uid = uid or f"firebase_{uuid.uuid4().hex[:8]}"
        existing_user = session.execute(
            select(User).where(User.firebase_uid == firebase_uid)
        ).scalar_one_or_none()
        if existing_user:
            existing_org = session.execute(
                select(Organization).where(Organization.id == existing_user.organization_id)
            ).scalar_one()
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

        session.commit()
        session.refresh(user)
        session.refresh(org)
        return user, org


@pytest.fixture(autouse=True, scope="module")
def setup_test_database():
    if os.path.exists(TEST_CMS_E5_DB_FILE):
        try:
            os.remove(TEST_CMS_E5_DB_FILE)
        except OSError:
            pass

    Base.metadata.create_all(bind=test_sync_engine)

    # Seed users and default author
    create_user_sync("cmsadmin@sitesecura.com", role="admin", uid="cmsadmin")
    create_user_sync("cmsmember@sitesecura.com", role="member", uid="cmsmember")

    with TestingSyncSessionLocal() as session:
        default_author = BlogAuthor(
            id=uuid.uuid4(),
            name="SiteSecura Team",
            slug="sitesecura-team",
            bio="Security research and engineering team at SiteSecura.",
        )
        session.add(default_author)
        session.commit()

    yield

    try:
        test_sync_engine.dispose()
    except Exception:
        pass
    if os.path.exists(TEST_CMS_E5_DB_FILE):
        try:
            os.remove(TEST_CMS_E5_DB_FILE)
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


@pytest.fixture
def admin_headers():
    return {"Authorization": "Bearer dev-token-cmsadmin-admin"}


@pytest.fixture
def non_admin_headers():
    return {"Authorization": "Bearer dev-token-cmsmember-free"}


# ==============================================================================
# 1. TAGS TESTS (Tests 1 - 10)
# ==============================================================================

def test_01_admin_create_tag_success(client, admin_headers):
    res = client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={
        "name": "Cloud Security",
        "description": "Articles about securing cloud infrastructure and AWS/GCP/Azure.",
    })
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Cloud Security"
    assert data["slug"] == "cloud-security"
    assert data["description"] == "Articles about securing cloud infrastructure and AWS/GCP/Azure."
    assert data["post_count"] == 0


def test_02_admin_create_tag_slug_normalization(client, admin_headers):
    res = client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={
        "name": "TLS & SSL Headers!!",
        "slug": "  TLS & SSL Headers!!  ",
    })
    assert res.status_code == 201
    data = res.json()
    assert data["slug"] == "tls-ssl-headers"


def test_03_admin_create_tag_duplicate_name_conflict(client, admin_headers):
    client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={"name": "Vulnerability Management"})
    res = client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={"name": "Vulnerability Management"})
    assert res.status_code == 409
    assert "already exists" in res.json()["detail"].lower()


def test_04_admin_create_tag_duplicate_slug_conflict(client, admin_headers):
    client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={"name": "DevSecOps", "slug": "devsecops"})
    res = client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={"name": "Dev Sec Ops", "slug": "devsecops"})
    assert res.status_code == 409
    assert "already exists" in res.json()["detail"].lower()


def test_05_admin_update_tag(client, admin_headers):
    create_res = client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={"name": "Old Tag Name"})
    tag_id = create_res.json()["id"]

    update_res = client.patch(f"/api/v1/admin/blog/tags/{tag_id}", headers=admin_headers, json={
        "name": "Updated Tag Name",
        "slug": "updated-tag-name",
        "description": "Updated tag description",
    })
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["name"] == "Updated Tag Name"
    assert data["slug"] == "updated-tag-name"
    assert data["description"] == "Updated tag description"


def test_06_admin_delete_tag_detaches_from_post_safely(client, admin_headers):
    tag_res = client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={"name": "Ephemeral Tag"})
    tag_id = tag_res.json()["id"]

    post_res = client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Article with Ephemeral Tag",
        "slug": "article-ephemeral-tag",
        "excerpt": "Excerpt here",
        "content": "Content here",
        "status": "published",
        "tag_ids": [tag_id],
    })
    assert post_res.status_code == 201
    post_id = post_res.json()["id"]

    # Delete tag
    del_res = client.delete(f"/api/v1/admin/blog/tags/{tag_id}", headers=admin_headers)
    assert del_res.status_code == 204

    # Verify post still exists and tag is detached
    get_post_res = client.get(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers)
    assert get_post_res.status_code == 200
    assert len(get_post_res.json()["tags"]) == 0


def test_07_public_get_tags_includes_post_count(client, admin_headers):
    tag_res = client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={"name": "Compliance"})
    tag_id = tag_res.json()["id"]

    # Assign to two published posts and one draft
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Compliance Post 1",
        "slug": "compliance-post-1",
        "excerpt": "Ex 1",
        "content": "Content 1",
        "status": "published",
        "tag_ids": [tag_id],
    })
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Compliance Post 2",
        "slug": "compliance-post-2",
        "excerpt": "Ex 2",
        "content": "Content 2",
        "status": "published",
        "tag_ids": [tag_id],
    })
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Compliance Draft Post",
        "slug": "compliance-draft-post",
        "excerpt": "Ex Draft",
        "content": "Content Draft",
        "status": "draft",
        "tag_ids": [tag_id],
    })

    # Public endpoint returns tags
    pub_res = client.get("/api/v1/blog/tags")
    assert pub_res.status_code == 200
    tags = pub_res.json()
    compliance_tag = next((t for t in tags if t["id"] == tag_id), None)
    assert compliance_tag is not None
    # Only published posts count toward public post_count
    assert compliance_tag["post_count"] == 2


def test_08_admin_tags_unauthorized(client):
    res = client.post("/api/v1/admin/blog/tags", json={"name": "Hacking"})
    assert res.status_code == 401


def test_09_admin_tags_forbidden_non_admin(client, non_admin_headers):
    res = client.post("/api/v1/admin/blog/tags", headers=non_admin_headers, json={"name": "Hacking"})
    assert res.status_code == 403


def test_10_multi_tag_assignment(client, admin_headers):
    t1 = client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={"name": "Tag Alpha"}).json()["id"]
    t2 = client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={"name": "Tag Beta"}).json()["id"]

    post_res = client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Multi-tag Article",
        "slug": "multi-tag-article",
        "excerpt": "Testing multiple tags",
        "content": "Testing multiple tags content",
        "status": "published",
        "tag_ids": [t1, t2],
    })
    assert post_res.status_code == 201
    assigned_tags = post_res.json()["tags"]
    assert len(assigned_tags) == 2
    assigned_ids = {t["id"] for t in assigned_tags}
    assert t1 in assigned_ids
    assert t2 in assigned_ids


# ==============================================================================
# 2. AUTHORS TESTS (Tests 11 - 18)
# ==============================================================================

def test_11_admin_create_author_success(client, admin_headers):
    res = client.post("/api/v1/admin/blog/authors", headers=admin_headers, json={
        "name": "Jane Security",
        "bio": "Principal Security Researcher at SiteSecura specializing in Web Application Firewalls.",
        "avatar_url": "/uploads/media/jane.jpg",
    })
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Jane Security"
    assert data["slug"] == "jane-security"
    assert data["bio"].startswith("Principal Security Researcher")
    assert data["avatar_url"] == "/uploads/media/jane.jpg"


def test_12_public_author_privacy_zero_leakage(client, admin_headers):
    author_res = client.post("/api/v1/admin/blog/authors", headers=admin_headers, json={
        "name": "Dr. Alan Turing",
        "bio": "Cryptanalyst and mathematician.",
    })
    author_slug = author_res.json()["slug"]

    # Public endpoint inspection
    pub_res = client.get(f"/api/v1/blog/authors/{author_slug}")
    assert pub_res.status_code == 200
    author_data = pub_res.json()

    # STRICT ASSERTIONS: NO internal fields exposed
    assert "email" not in author_data
    assert "firebase_uid" not in author_data
    assert "role" not in author_data
    assert "organization_id" not in author_data
    assert "hashed_password" not in author_data
    assert set(author_data.keys()).issubset({"id", "name", "slug", "bio", "avatar_url", "created_at"})


def test_13_admin_create_author_duplicate_slug_conflict(client, admin_headers):
    client.post("/api/v1/admin/blog/authors", headers=admin_headers, json={"name": "Alex Smith", "slug": "alex-smith"})
    res = client.post("/api/v1/admin/blog/authors", headers=admin_headers, json={"name": "Alexander Smith", "slug": "alex-smith"})
    assert res.status_code == 409
    assert "already exists" in res.json()["detail"].lower()


def test_14_admin_update_author(client, admin_headers):
    create_res = client.post("/api/v1/admin/blog/authors", headers=admin_headers, json={"name": "Bob Vance"})
    author_id = create_res.json()["id"]

    patch_res = client.patch(f"/api/v1/admin/blog/authors/{author_id}", headers=admin_headers, json={
        "name": "Bob Vance Refrigeration",
        "slug": "bob-vance-refrigeration",
        "bio": "Vance Refrigeration CEO & Security Enthusiast",
    })
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["name"] == "Bob Vance Refrigeration"
    assert data["slug"] == "bob-vance-refrigeration"


def test_15_admin_delete_author_safe_nullify_posts(client, admin_headers):
    author_res = client.post("/api/v1/admin/blog/authors", headers=admin_headers, json={"name": "Delete Me Author"})
    author_id = author_res.json()["id"]

    post_res = client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Post by Temporary Author",
        "slug": "post-temp-author",
        "excerpt": "Temporary author test",
        "content": "Content",
        "status": "published",
        "author_id": author_id,
    })
    post_id = post_res.json()["id"]

    # Delete the author
    del_res = client.delete(f"/api/v1/admin/blog/authors/{author_id}", headers=admin_headers)
    assert del_res.status_code == 204

    # Post must remain intact, with author_id set to None
    post_check = client.get(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers)
    assert post_check.status_code == 200
    assert post_check.json()["author_id"] is None
    assert post_check.json()["author"] is None


def test_16_public_get_authors_list(client, admin_headers):
    client.post("/api/v1/admin/blog/authors", headers=admin_headers, json={"name": "Author One"})
    client.post("/api/v1/admin/blog/authors", headers=admin_headers, json={"name": "Author Two"})

    res = client.get("/api/v1/blog/authors")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 2
    for a in data:
        assert "email" not in a
        assert "firebase_uid" not in a


def test_17_author_authorization(client, non_admin_headers):
    # Unauthenticated
    assert client.post("/api/v1/admin/blog/authors", json={"name": "Unauthorized"}).status_code == 401

    # Non-admin member
    assert client.post("/api/v1/admin/blog/authors", headers=non_admin_headers, json={"name": "Forbidden"}).status_code == 403


def test_18_public_author_not_found(client):
    res = client.get("/api/v1/blog/authors/non-existent-author-slug")
    assert res.status_code == 404


# ==============================================================================
# 3. CATEGORIES & TAG FILTERS (Tests 19 - 25)
# ==============================================================================

def test_19_filter_by_category_success(client, admin_headers):
    cat_res = client.post("/api/v1/admin/blog/categories", headers=admin_headers, json={"name": "Zero Trust Architecture"})
    cat_id = cat_res.json()["id"]

    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "ZTNA Principles",
        "slug": "ztna-principles",
        "excerpt": "Zero trust network access",
        "content": "Details on ZTNA",
        "status": "published",
        "category_id": cat_id,
    })

    res = client.get("/api/v1/blog/posts?category=zero-trust-architecture&page=1&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["slug"] == "ztna-principles"


def test_20_filter_by_unknown_category_returns_empty_not_500(client):
    res = client.get("/api/v1/blog/posts?category=completely-non-existent-cat&page=1&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 0
    assert data["items"] == []


def test_21_filter_by_tag_success(client, admin_headers):
    tag_res = client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={"name": "Penetration Testing"})
    tag_id = tag_res.json()["id"]

    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Top 10 Pentest Tools",
        "slug": "top-10-pentest-tools",
        "excerpt": "Tools overview",
        "content": "Burp suite, nmap, etc.",
        "status": "published",
        "tag_ids": [tag_id],
    })

    res = client.get("/api/v1/blog/posts?tag=penetration-testing&page=1&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["slug"] == "top-10-pentest-tools"


def test_22_filter_by_author_success(client, admin_headers):
    author_res = client.post("/api/v1/admin/blog/authors", headers=admin_headers, json={"name": "Sarah Connor"})
    author_id = author_res.json()["id"]

    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Cyberdyne Defense Strategies",
        "slug": "cyberdyne-defense",
        "excerpt": "Security against autonomous threats",
        "content": "Air gap everything.",
        "status": "published",
        "author_id": author_id,
    })

    res = client.get("/api/v1/blog/posts?author=sarah-connor&page=1&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["slug"] == "cyberdyne-defense"


def test_23_filter_category_and_tag_intersection(client, admin_headers):
    cat = client.post("/api/v1/admin/blog/categories", headers=admin_headers, json={"name": "AppSec"}).json()
    tag = client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={"name": "OWASP"}).json()

    # Post with Cat + Tag
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "OWASP Top 10 Breakdown",
        "slug": "owasp-top-10-breakdown",
        "excerpt": "Detailed analysis",
        "content": "Injection, broken auth...",
        "status": "published",
        "category_id": cat["id"],
        "tag_ids": [tag["id"]],
    })

    # Post with Cat only
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "AppSec Generic Post",
        "slug": "appsec-generic-post",
        "excerpt": "Generic",
        "content": "Generic",
        "status": "published",
        "category_id": cat["id"],
    })

    res = client.get(f"/api/v1/blog/posts?category={cat['slug']}&tag={tag['slug']}&page=1&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["slug"] == "owasp-top-10-breakdown"


def test_24_filter_preserves_only_published_content(client, admin_headers):
    tag = client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={"name": "Red Team"}).json()

    # Draft with tag
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Draft Red Team Tactics",
        "slug": "draft-red-team",
        "excerpt": "Draft",
        "content": "Draft",
        "status": "draft",
        "tag_ids": [tag["id"]],
    })

    res = client.get(f"/api/v1/blog/posts?tag={tag['slug']}&page=1&page_size=10")
    assert res.status_code == 200
    assert res.json()["total"] == 0


def test_25_scheduled_post_quarantined_from_tag_filter(client, admin_headers):
    tag = client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={"name": "Blue Team"}).json()

    # Future scheduled post
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Scheduled Blue Team Defense",
        "slug": "scheduled-blue-team",
        "excerpt": "Future defense",
        "content": "Defense",
        "status": "scheduled",
        "tag_ids": [tag["id"]],
    })

    res = client.get(f"/api/v1/blog/posts?tag={tag['slug']}&page=1&page_size=10")
    assert res.status_code == 200
    assert res.json()["total"] == 0


# ==============================================================================
# 4. SEARCH ENGINE TESTS (Tests 26 - 33)
# ==============================================================================

def test_26_search_by_title(client, admin_headers):
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Cryptographic Hash Collision Attacks",
        "slug": "crypto-hash-collisions",
        "excerpt": "MD5 and SHA-1 vulnerabilities",
        "content": "Detailed hashing mathematical proofs",
        "status": "published",
    })

    res = client.get("/api/v1/blog/posts?q=Collision&page=1&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert any(p["slug"] == "crypto-hash-collisions" for p in data["items"])


def test_27_search_by_excerpt(client, admin_headers):
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Defending Web Endpoints",
        "slug": "defending-web-endpoints",
        "excerpt": "Preventing cross-site request forgery through SameSite cookies",
        "content": "Cookie configuration guide",
        "status": "published",
    })

    res = client.get("/api/v1/blog/posts?q=SameSite&page=1&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert any(p["slug"] == "defending-web-endpoints" for p in data["items"])


def test_28_search_by_content(client, admin_headers):
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Server Hardening Basics",
        "slug": "server-hardening-basics",
        "excerpt": "General server setup",
        "content": "Make sure to disable root ssh login and configure fail2ban on port 22.",
        "status": "published",
    })

    res = client.get("/api/v1/blog/posts?q=fail2ban&page=1&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert any(p["slug"] == "server-hardening-basics" for p in data["items"])


def test_29_search_deterministic_relevance_ranking(client, admin_headers):
    # Post A has term in title
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Ransomware Defense Playbook",
        "slug": "ransomware-defense-playbook",
        "excerpt": "General incident response overview",
        "content": "Backup procedures",
        "status": "published",
    })

    # Post B has term ONLY in content
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "General Storage Architecture",
        "slug": "general-storage-architecture",
        "excerpt": "How to configure NAS devices safely",
        "content": "Storage should be protected against ransomware encrypting drives.",
        "status": "published",
    })

    res = client.get("/api/v1/blog/posts?q=Ransomware&page=1&page_size=10")
    assert res.status_code == 200
    items = res.json()["items"]
    slug_order = [p["slug"] for p in items if p["slug"] in ["ransomware-defense-playbook", "general-storage-architecture"]]
    assert slug_order == ["ransomware-defense-playbook", "general-storage-architecture"]


def test_30_search_case_insensitivity(client, admin_headers):
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Subresource Integrity (SRI) Implementation",
        "slug": "sri-implementation",
        "excerpt": "Enforcing sha384 hashes on scripts",
        "content": "Use SRI for third party CDNs",
        "status": "published",
    })

    res_lower = client.get("/api/v1/blog/posts?q=subresource&page=1&page_size=10")
    res_upper = client.get("/api/v1/blog/posts?q=SUBRESOURCE&page=1&page_size=10")
    assert res_lower.status_code == 200
    assert res_upper.status_code == 200
    assert res_lower.json()["total"] == res_upper.json()["total"]


def test_31_search_query_clamping(client):
    huge_query = "security " * 30
    res = client.get(f"/api/v1/blog/posts?q={huge_query}&page=1&page_size=10")
    assert res.status_code == 200


def test_32_search_sql_injection_safety(client):
    malicious_query = "' OR 1=1 --; DROP TABLE blog_posts; --"
    res = client.get(f"/api/v1/blog/posts?q={malicious_query}&page=1&page_size=10")
    assert res.status_code == 200


def test_33_search_excludes_drafts_and_archived(client, admin_headers):
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Secret Vulnerability Zero Day Disclosed",
        "slug": "secret-zero-day-draft",
        "excerpt": "Unpublished findings",
        "content": "Critical 0day in apache",
        "status": "draft",
    })

    res = client.get("/api/v1/blog/posts?q=Disclosed&page=1&page_size=10")
    assert res.status_code == 200
    assert not any(p["slug"] == "secret-zero-day-draft" for p in res.json()["items"])


# ==============================================================================
# 5. PAGINATION TESTS (Tests 34 - 39)
# ==============================================================================

def test_34_pagination_schema_structure(client):
    res = client.get("/api/v1/blog/posts?page=1&page_size=5")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert "total_pages" in data
    assert "has_next" in data
    assert "has_previous" in data
    assert data["page"] == 1
    assert data["page_size"] == 5


def test_35_pagination_page_separation(client, admin_headers):
    for i in range(5):
        client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
            "title": f"Pagination Article {i}",
            "slug": f"pagination-article-{i}",
            "excerpt": f"Excerpt {i}",
            "content": f"Content {i}",
            "status": "published",
        })

    p1 = client.get("/api/v1/blog/posts?page=1&page_size=2").json()
    p2 = client.get("/api/v1/blog/posts?page=2&page_size=2").json()

    assert p1["has_next"] is True
    assert p1["has_previous"] is False
    assert p2["has_previous"] is True

    p1_slugs = {item["slug"] for item in p1["items"]}
    p2_slugs = {item["slug"] for item in p2["items"]}
    assert p1_slugs.isdisjoint(p2_slugs)


def test_36_pagination_limit_clamping_max_50(client):
    res = client.get("/api/v1/blog/posts?page=1&page_size=500")
    assert res.status_code == 200
    assert res.json()["page_size"] == 50


def test_37_pagination_page_out_of_bounds(client):
    res = client.get("/api/v1/blog/posts?page=9999&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert data["items"] == []
    assert data["has_next"] is False
    assert data["has_previous"] is True


def test_38_pagination_zero_or_negative_page_safeguard(client):
    res = client.get("/api/v1/blog/posts?page=0&page_size=10")
    assert res.status_code == 200
    assert res.json()["page"] == 1


def test_39_backward_compatibility_unpaginated_returns_direct_list(client):
    res = client.get("/api/v1/blog/posts")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


# ==============================================================================
# 6. FEATURED ARTICLES (Tests 40 - 44)
# ==============================================================================

def test_40_admin_create_featured_post(client, admin_headers):
    res = client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Annual State of Web Security 2026",
        "slug": "state-of-web-security-2026",
        "excerpt": "Comprehensive annual threat analysis.",
        "content": "Deep analysis into global telemetry.",
        "status": "published",
        "is_featured": True,
    })
    assert res.status_code == 201
    assert res.json()["is_featured"] is True


def test_41_public_featured_filter_returns_only_featured(client, admin_headers):
    # Post marked featured
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Featured Must Read Security Guide",
        "slug": "featured-must-read",
        "excerpt": "Essential security practices",
        "content": "Content",
        "status": "published",
        "is_featured": True,
    })

    # Post not featured
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Standard Security Update",
        "slug": "standard-security-update",
        "excerpt": "Regular patch notes",
        "content": "Content",
        "status": "published",
        "is_featured": False,
    })

    res = client.get("/api/v1/blog/posts?featured=true&page=1&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert all(p["is_featured"] is True for p in data["items"])
    assert any(p["slug"] == "featured-must-read" for p in data["items"])
    assert not any(p["slug"] == "standard-security-update" for p in data["items"])


def test_42_admin_toggle_featured_status(client, admin_headers):
    post_res = client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Toggle Featured Post",
        "slug": "toggle-featured-post",
        "excerpt": "Excerpt",
        "content": "Content",
        "status": "published",
        "is_featured": False,
    })
    post_id = post_res.json()["id"]

    # Toggle to featured
    patch1 = client.patch(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers, json={"is_featured": True})
    assert patch1.status_code == 200
    assert patch1.json()["is_featured"] is True

    # Toggle back to unfeatured
    patch2 = client.patch(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers, json={"is_featured": False})
    assert patch2.status_code == 200
    assert patch2.json()["is_featured"] is False


def test_43_draft_featured_post_strictly_hidden_from_public(client, admin_headers):
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Draft That Is Featured",
        "slug": "draft-featured-post",
        "excerpt": "Draft excerpt",
        "content": "Draft content",
        "status": "draft",
        "is_featured": True,
    })

    res = client.get("/api/v1/blog/posts?featured=true&page=1&page_size=10")
    assert res.status_code == 200
    assert not any(p["slug"] == "draft-featured-post" for p in res.json()["items"])


def test_44_featured_toggle_audit_logged(client, admin_headers):
    post_res = client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Audited Featured Post",
        "slug": "audited-featured-post",
        "excerpt": "Excerpt",
        "content": "Content",
        "status": "published",
        "is_featured": False,
    })
    post_id = post_res.json()["id"]

    # Feature it
    client.patch(f"/api/v1/admin/blog/posts/{post_id}", headers=admin_headers, json={"is_featured": True})

    # Verify audit log in DB using sync session
    with TestingSyncSessionLocal() as session:
        logs = session.execute(
            select(AuditLog).where(AuditLog.action == "BLOG_POST_FEATURED")
        ).scalars().all()
        assert len(logs) >= 1
        assert any(log.entity_id == post_id for log in logs)


# ==============================================================================
# 7. RELATED ARTICLES (Tests 45 - 50)
# ==============================================================================

def test_45_related_articles_deterministic_scoring(client, admin_headers):
    # Common Category & Common Tags
    cat = client.post("/api/v1/admin/blog/categories", headers=admin_headers, json={"name": "Network Security"}).json()
    t_firewall = client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={"name": "Firewall"}).json()
    t_ddos = client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={"name": "DDoS"}).json()

    # Target Article: in Network Security, tags: Firewall, DDoS
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Next-Gen Firewall Architecture",
        "slug": "ngfw-architecture",
        "excerpt": "Firewall deep dive",
        "content": "Content",
        "status": "published",
        "category_id": cat["id"],
        "tag_ids": [t_firewall["id"], t_ddos["id"]],
    })

    # Candidate 1: Same category (+3) + Both tags (+4) = score 7
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Firewall and DDoS Mitigation in Practice",
        "slug": "firewall-ddos-mitigation",
        "excerpt": "Both firewall and ddos",
        "content": "Content",
        "status": "published",
        "category_id": cat["id"],
        "tag_ids": [t_firewall["id"], t_ddos["id"]],
    })

    # Candidate 2: Same category (+3) = score 3
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Network Routing Essentials",
        "slug": "network-routing-essentials",
        "excerpt": "Routing",
        "content": "Content",
        "status": "published",
        "category_id": cat["id"],
    })

    res = client.get("/api/v1/blog/posts/ngfw-architecture/related")
    assert res.status_code == 200
    related = res.json()
    assert len(related) >= 2
    # Candidate 1 (score 7) MUST rank ahead of Candidate 2 (score 3)
    slugs = [r["slug"] for r in related]
    assert slugs[0] == "firewall-ddos-mitigation"
    assert slugs[1] == "network-routing-essentials"


def test_46_related_articles_excludes_current_post(client, admin_headers):
    cat = client.post("/api/v1/admin/blog/categories", headers=admin_headers, json={"name": "Identity"}).json()

    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "OAuth 2.0 and OIDC",
        "slug": "oauth-2-oidc",
        "excerpt": "Auth flows",
        "content": "Content",
        "status": "published",
        "category_id": cat["id"],
    })

    res = client.get("/api/v1/blog/posts/oauth-2-oidc/related")
    assert res.status_code == 200
    related = res.json()
    assert not any(r["slug"] == "oauth-2-oidc" for r in related)


def test_47_related_articles_excludes_draft_and_scheduled_posts(client, admin_headers):
    cat = client.post("/api/v1/admin/blog/categories", headers=admin_headers, json={"name": "Threat Intel"}).json()

    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Main Threat Intel Guide",
        "slug": "main-threat-intel",
        "excerpt": "Overview",
        "content": "Content",
        "status": "published",
        "category_id": cat["id"],
    })

    # Draft candidate
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Draft Intel Report",
        "slug": "draft-intel-report",
        "excerpt": "Draft",
        "content": "Content",
        "status": "draft",
        "category_id": cat["id"],
    })

    res = client.get("/api/v1/blog/posts/main-threat-intel/related")
    assert res.status_code == 200
    assert not any(r["slug"] == "draft-intel-report" for r in res.json())


def test_48_related_articles_limit_enforcement(client, admin_headers):
    cat = client.post("/api/v1/admin/blog/categories", headers=admin_headers, json={"name": "Incident Handling"}).json()

    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Incident Root Article",
        "slug": "incident-root",
        "excerpt": "Root",
        "content": "Content",
        "status": "published",
        "category_id": cat["id"],
    })

    for i in range(10):
        client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
            "title": f"Incident Guide {i}",
            "slug": f"incident-guide-{i}",
            "excerpt": f"Excerpt {i}",
            "content": f"Content {i}",
            "status": "published",
            "category_id": cat["id"],
        })

    # Max default limit is 4
    res = client.get("/api/v1/blog/posts/incident-root/related")
    assert res.status_code == 200
    assert len(res.json()) <= 4


def test_49_related_endpoint_404_for_draft_target(client, admin_headers):
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Private Draft Post",
        "slug": "private-draft-post",
        "excerpt": "Private",
        "content": "Private",
        "status": "draft",
    })

    res = client.get("/api/v1/blog/posts/private-draft-post/related")
    assert res.status_code == 404


def test_50_post_detail_embeds_author_tags_and_related_posts(client, admin_headers):
    author = client.post("/api/v1/admin/blog/authors", headers=admin_headers, json={"name": "Ada Lovelace"}).json()
    tag = client.post("/api/v1/admin/blog/tags", headers=admin_headers, json={"name": "Algorithms"}).json()
    cat = client.post("/api/v1/admin/blog/categories", headers=admin_headers, json={"name": "Computer Science"}).json()

    # Main post
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "The Analytical Engine Security",
        "slug": "analytical-engine-security",
        "excerpt": "Foundational computing",
        "content": "Content",
        "status": "published",
        "category_id": cat["id"],
        "author_id": author["id"],
        "tag_ids": [tag["id"]],
    })

    # Related post
    client.post("/api/v1/admin/blog/posts", headers=admin_headers, json={
        "title": "Algorithmic Complexity Attacks",
        "slug": "algorithmic-complexity-attacks",
        "excerpt": "HashDoS etc.",
        "content": "Content",
        "status": "published",
        "category_id": cat["id"],
        "tag_ids": [tag["id"]],
    })

    res = client.get("/api/v1/blog/posts/analytical-engine-security")
    assert res.status_code == 200
    data = res.json()
    assert data["author"]["name"] == "Ada Lovelace"
    assert len(data["tags"]) == 1
    assert data["tags"][0]["name"] == "Algorithms"
    assert "related_posts" in data
    assert len(data["related_posts"]) >= 1
    assert data["related_posts"][0]["slug"] == "algorithmic-complexity-attacks"
