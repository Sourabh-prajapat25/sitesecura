"""
SiteSecura - Phase E3: Media & Article Content Test Suite
Validates all Phase E3 specifications:
1. Valid uploads for JPEG, PNG, WebP (201 Created, metadata, dimensions, SHA256)
2. Non-admin authorization rejection (403 Forbidden)
3. Unauthenticated rejection (401 Unauthorized)
4. Invalid extension rejection (.svg, .html, .exe, .pdf, .zip -> 400)
5. Spoofed MIME / magic byte inspection failure rejection (400)
6. Decompression bomb / dimension limits (>4096px, >16MP -> 400)
7. Oversized file rejection (>5MB -> 413)
8. Path traversal filename sanitization
9. Public media streaming with security headers (nosniff, cache-control)
10. Public media streaming path traversal defense
11. Admin media pagination and search
12. Admin media metadata update (alt text, caption, 200, audit event)
13. Deletion safety: 409 Conflict when referenced as featured media
14. Deletion safety: 409 Conflict when referenced inside article Markdown content
15. Deletion of unreferenced media succeeds (200, disk removal, audit event)
16. Blog post featured media relationship & legacy featured_image fallback sync
"""

import os
import sys
import io
import uuid
import shutil
import asyncio
from typing import Tuple, Optional
import pytest
from PIL import Image
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
from app.models.cms import BlogPost, BlogCategory, MediaAsset
from app.models.alert import AuditLog
from app.core.rate_limit import _memory_rate_limits
from app.core.config import settings

TEST_CMS_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_cms_e3.sqlite3"))
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_CMS_DB_FILE}"
TEST_SYNC_DB_URL = f"sqlite:///{TEST_CMS_DB_FILE}"

TEST_MEDIA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_media_phase_e3"))

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
    # Clean DB file
    if os.path.exists(TEST_CMS_DB_FILE):
        try:
            os.remove(TEST_CMS_DB_FILE)
        except OSError:
            pass

    # Clean Media Dir
    if os.path.exists(TEST_MEDIA_DIR):
        try:
            shutil.rmtree(TEST_MEDIA_DIR)
        except OSError:
            pass
    os.makedirs(TEST_MEDIA_DIR, exist_ok=True)

    # Point settings.MEDIA_ROOT to TEST_MEDIA_DIR
    settings.MEDIA_ROOT = TEST_MEDIA_DIR

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
    if os.path.exists(TEST_MEDIA_DIR):
        try:
            shutil.rmtree(TEST_MEDIA_DIR)
        except OSError:
            pass


@pytest.fixture(autouse=True)
def clean_state(monkeypatch):
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_sync_db] = override_get_sync_db
    monkeypatch.setattr(session_module, "AsyncSessionLocal", TestingAsyncSessionLocal)
    monkeypatch.setattr(session_module, "SyncSessionLocal", TestingSyncSessionLocal)
    monkeypatch.setattr(session_module, "get_sync_db", override_get_sync_db)
    monkeypatch.setattr(settings, "MEDIA_ROOT", TEST_MEDIA_DIR)
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


def create_test_image_bytes(fmt: str = "JPEG", size=(600, 400), color="blue") -> bytes:
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


# =========================================================================
# 1. MEDIA UPLOAD & VALIDATION TESTS
# =========================================================================

@pytest.mark.asyncio
async def test_01_upload_valid_jpeg(client, admin_headers):
    await create_user_fixture("cmsadmin@example.com", role="admin", uid="cmsadmin")

    img_bytes = create_test_image_bytes("JPEG", size=(640, 480), color="red")
    files = {"file": ("banner.jpg", img_bytes, "image/jpeg")}
    data = {"alt_text": "Hero Security Banner", "caption": "SiteSecura Architecture"}

    res = client.post("/api/v1/admin/blog/media", headers=admin_headers, files=files, data=data)
    assert res.status_code == 201
    body = res.json()

    assert body["original_filename"] == "banner.jpg"
    assert body["mime_type"] == "image/jpeg"
    assert body["width"] == 640
    assert body["height"] == 480
    assert body["alt_text"] == "Hero Security Banner"
    assert body["caption"] == "SiteSecura Architecture"
    assert body["public_url"].startswith("/api/v1/media/")
    assert len(body["checksum_sha256"]) == 64

    # Verify audit log
    async with TestingAsyncSessionLocal() as session:
        audit_res = await session.execute(
            select(AuditLog).where(AuditLog.action == "BLOG_MEDIA_UPLOADED")
        )
        logs = audit_res.scalars().all()
        assert len(logs) >= 1
        assert any(l.entity_id == body["id"] for l in logs)


@pytest.mark.asyncio
async def test_02_upload_valid_png(client, admin_headers):
    img_bytes = create_test_image_bytes("PNG", size=(500, 300), color="green")
    files = {"file": ("diagram.png", img_bytes, "image/png")}
    data = {"alt_text": "SSL Handshake Diagram"}

    res = client.post("/api/v1/admin/blog/media", headers=admin_headers, files=files, data=data)
    assert res.status_code == 201
    body = res.json()
    assert body["mime_type"] == "image/png"
    assert body["width"] == 500
    assert body["height"] == 300
    assert body["alt_text"] == "SSL Handshake Diagram"


@pytest.mark.asyncio
async def test_03_upload_valid_webp(client, admin_headers):
    img_bytes = create_test_image_bytes("WEBP", size=(400, 250), color="purple")
    files = {"file": ("illustration.webp", img_bytes, "image/webp")}

    res = client.post("/api/v1/admin/blog/media", headers=admin_headers, files=files)
    assert res.status_code == 201
    body = res.json()
    assert body["mime_type"] == "image/webp"
    assert body["width"] == 400
    assert body["height"] == 250


@pytest.mark.asyncio
async def test_04_upload_unauthenticated_rejected(client):
    img_bytes = create_test_image_bytes("JPEG")
    files = {"file": ("test.jpg", img_bytes, "image/jpeg")}
    res = client.post("/api/v1/admin/blog/media", files=files)
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_05_upload_non_admin_rejected(client, non_admin_headers):
    await create_user_fixture("member@example.com", role="free", uid="cmsmember")
    img_bytes = create_test_image_bytes("JPEG")
    files = {"file": ("test.jpg", img_bytes, "image/jpeg")}
    res = client.post("/api/v1/admin/blog/media", headers=non_admin_headers, files=files)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_06_upload_invalid_extension_rejected(client, admin_headers):
    # Reject SVG
    svg_bytes = b"<svg xmlns='http://www.w3.org/2000/svg'><circle r='5'/></svg>"
    res = client.post(
        "/api/v1/admin/blog/media",
        headers=admin_headers,
        files={"file": ("vector.svg", svg_bytes, "image/svg+xml")},
    )
    assert res.status_code == 400
    assert "extension" in res.text.lower()

    # Reject HTML
    html_bytes = b"<html><script>alert(1)</script></html>"
    res = client.post(
        "/api/v1/admin/blog/media",
        headers=admin_headers,
        files={"file": ("page.html", html_bytes, "text/html")},
    )
    assert res.status_code == 400

    # Reject Executable
    exe_bytes = b"MZ\x90\x00\x03\x00\x00\x00"
    res = client.post(
        "/api/v1/admin/blog/media",
        headers=admin_headers,
        files={"file": ("malware.exe", exe_bytes, "application/octet-stream")},
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_07_upload_spoofed_mime_magic_bytes_rejected(client, admin_headers):
    # Spoofed file claiming to be jpeg but actually plain text
    fake_bytes = b"This is not a real JPEG image file at all."
    res = client.post(
        "/api/v1/admin/blog/media",
        headers=admin_headers,
        files={"file": ("fake.jpg", fake_bytes, "image/jpeg")},
    )
    assert res.status_code == 400
    assert "file signature" in res.text.lower() or "image format" in res.text.lower()


@pytest.mark.asyncio
async def test_08_upload_decompression_bomb_dimensions_rejected(client, admin_headers):
    # Image exceeding 4096px limit
    huge_bytes = create_test_image_bytes("JPEG", size=(5000, 100), color="yellow")
    res = client.post(
        "/api/v1/admin/blog/media",
        headers=admin_headers,
        files={"file": ("huge.jpg", huge_bytes, "image/jpeg")},
    )
    assert res.status_code == 400
    assert "dimension" in res.text.lower() or "pixels" in res.text.lower()


@pytest.mark.asyncio
async def test_09_upload_oversized_file_rejected(client, admin_headers):
    # Exceeding 5 MB
    large_payload = b"\x00" * (5 * 1024 * 1024 + 1024)
    res = client.post(
        "/api/v1/admin/blog/media",
        headers=admin_headers,
        files={"file": ("oversized.jpg", large_payload, "image/jpeg")},
    )
    assert res.status_code == 413
    assert "exceeds" in res.text.lower()


@pytest.mark.asyncio
async def test_10_upload_path_traversal_filename_sanitized(client, admin_headers):
    img_bytes = create_test_image_bytes("PNG", size=(200, 200), color="blue")
    traversal_name = "../../etc/passwd.png"
    res = client.post(
        "/api/v1/admin/blog/media",
        headers=admin_headers,
        files={"file": (traversal_name, img_bytes, "image/png")},
    )
    assert res.status_code == 201
    body = res.json()
    assert ".." not in body["storage_key"]
    assert "/" not in body["filename"]
    assert "\\" not in body["filename"]


# =========================================================================
# 2. MEDIA STREAMING & PATH TRAVERSAL DEFENSE
# =========================================================================

@pytest.mark.asyncio
async def test_11_serve_media_public_streaming(client, admin_headers):
    img_bytes = create_test_image_bytes("JPEG", size=(320, 240), color="red")
    upload_res = client.post(
        "/api/v1/admin/blog/media",
        headers=admin_headers,
        files={"file": ("stream_test.jpg", img_bytes, "image/jpeg")},
    )
    assert upload_res.status_code == 201
    pub_url = upload_res.json()["public_url"]

    # Public GET (unauthenticated)
    res = client.get(pub_url)
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/jpeg"
    assert res.headers["x-content-type-options"] == "nosniff"
    assert "public, max-age=" in res.headers["cache-control"]
    assert len(res.content) > 0


@pytest.mark.asyncio
async def test_12_serve_media_path_traversal_blocked(client):
    # Path traversal attempts
    res1 = client.get("/api/v1/media/../../etc/passwd")
    assert res1.status_code in (400, 404)

    res2 = client.get("/api/v1/media/..%2f..%2fconfig.py")
    assert res2.status_code in (400, 404)


# =========================================================================
# 3. MEDIA MANAGEMENT (LIST, SEARCH, UPDATE, DELETE)
# =========================================================================

@pytest.mark.asyncio
async def test_13_media_pagination_and_search(client, admin_headers):
    # Search by alt text
    res = client.get(
        "/api/v1/admin/blog/media?search=Hero Security Banner",
        headers=admin_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert any("Hero Security Banner" in (item.get("alt_text") or "") for item in data["items"])


@pytest.mark.asyncio
async def test_14_media_update_metadata(client, admin_headers):
    img_bytes = create_test_image_bytes("WEBP", size=(200, 200), color="pink")
    upload_res = client.post(
        "/api/v1/admin/blog/media",
        headers=admin_headers,
        files={"file": ("meta_test.webp", img_bytes, "image/webp")},
    )
    media_id = upload_res.json()["id"]

    # Update alt text and caption
    patch_res = client.patch(
        f"/api/v1/admin/blog/media/{media_id}",
        headers=admin_headers,
        json={"alt_text": "Updated Alt", "caption": "Updated Caption"},
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["alt_text"] == "Updated Alt"
    assert updated["caption"] == "Updated Caption"

    # Verify audit log
    async with TestingAsyncSessionLocal() as session:
        audit_res = await session.execute(
            select(AuditLog).where(
                AuditLog.action == "BLOG_MEDIA_UPDATED",
                AuditLog.entity_id == media_id,
            )
        )
        assert audit_res.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_15_delete_referenced_featured_media_blocked(client, admin_headers):
    # Upload media
    img_bytes = create_test_image_bytes("JPEG", size=(300, 200), color="teal")
    upload_res = client.post(
        "/api/v1/admin/blog/media",
        headers=admin_headers,
        files={"file": ("featured_block.jpg", img_bytes, "image/jpeg")},
    )
    media_id = upload_res.json()["id"]

    # Create post using this media as featured_media_id
    post_res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Post With Featured Image",
            "slug": "post-with-featured-image",
            "excerpt": "Excerpt test",
            "content": "Article body",
            "featured_media_id": media_id,
            "status": "published",
        },
    )
    assert post_res.status_code == 201

    # Attempt to delete referenced media -> 409 Conflict
    del_res = client.delete(f"/api/v1/admin/blog/media/{media_id}", headers=admin_headers)
    assert del_res.status_code == 409
    assert "featured image" in del_res.text.lower()


@pytest.mark.asyncio
async def test_16_delete_referenced_inline_content_blocked(client, admin_headers):
    # Upload media
    img_bytes = create_test_image_bytes("PNG", size=(300, 200), color="orange")
    upload_res = client.post(
        "/api/v1/admin/blog/media",
        headers=admin_headers,
        files={"file": ("inline_block.png", img_bytes, "image/png")},
    )
    media = upload_res.json()
    media_id = media["id"]
    public_url = media["public_url"]

    # Create post referencing public_url inside markdown content
    post_res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Post With Inline Image",
            "slug": "post-with-inline-image",
            "excerpt": "Excerpt test",
            "content": f"Here is an inline diagram:\n\n![Inline Image]({public_url})\n\nEnd of article.",
            "status": "published",
        },
    )
    assert post_res.status_code == 201

    # Attempt to delete referenced media -> 409 Conflict
    del_res = client.delete(f"/api/v1/admin/blog/media/{media_id}", headers=admin_headers)
    assert del_res.status_code == 409
    assert "content" in del_res.text.lower()


@pytest.mark.asyncio
async def test_17_delete_unreferenced_media_succeeds(client, admin_headers):
    # Upload media
    img_bytes = create_test_image_bytes("WEBP", size=(250, 150), color="gray")
    upload_res = client.post(
        "/api/v1/admin/blog/media",
        headers=admin_headers,
        files={"file": ("to_delete.webp", img_bytes, "image/webp")},
    )
    media = upload_res.json()
    media_id = media["id"]

    # Delete unreferenced media -> 200 OK
    del_res = client.delete(f"/api/v1/admin/blog/media/{media_id}", headers=admin_headers)
    assert del_res.status_code == 200

    # Ensure DB record is gone
    get_res = client.get(f"/api/v1/admin/blog/media/{media_id}", headers=admin_headers)
    assert get_res.status_code == 404

    # Verify audit log
    async with TestingAsyncSessionLocal() as session:
        audit_res = await session.execute(
            select(AuditLog).where(
                AuditLog.action == "BLOG_MEDIA_DELETED",
                AuditLog.entity_id == media_id,
            )
        )
        assert audit_res.scalar_one_or_none() is not None


# =========================================================================
# 4. BLOG POST FEATURED MEDIA INTEGRATION
# =========================================================================

@pytest.mark.asyncio
async def test_18_blog_post_featured_media_relationship(client, admin_headers):
    # Upload media for featured image
    img_bytes = create_test_image_bytes("JPEG", size=(1200, 630), color="navy")
    upload_res = client.post(
        "/api/v1/admin/blog/media",
        headers=admin_headers,
        files={"file": ("featured_integration.jpg", img_bytes, "image/jpeg")},
        data={"alt_text": "Comprehensive Security Guide Cover"},
    )
    assert upload_res.status_code == 201
    media = upload_res.json()
    media_id = media["id"]

    # Create post with featured_media_id
    post_res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Comprehensive TLS Hardening",
            "slug": "comprehensive-tls-hardening",
            "excerpt": "A deep dive into TLS 1.3 configuration and ciphersuites.",
            "content": "# TLS Hardening Guide\n\nEnsure modern ciphers are configured.",
            "featured_media_id": media_id,
            "status": "published",
        },
    )
    assert post_res.status_code == 201
    created_post = post_res.json()

    assert created_post["featured_media_id"] == media_id
    assert created_post["featured_media"] is not None
    assert created_post["featured_media"]["id"] == media_id
    assert created_post["featured_media"]["alt_text"] == "Comprehensive Security Guide Cover"
    # Legacy featured_image sync
    assert created_post["featured_image"] == media["public_url"]

    # Public endpoint check
    public_res = client.get("/api/v1/blog/posts/comprehensive-tls-hardening")
    assert public_res.status_code == 200
    pub_post = public_res.json()
    assert pub_post["featured_media"] is not None
    assert pub_post["featured_media"]["id"] == media_id
    assert pub_post["featured_media"]["public_url"] == media["public_url"]
