"""
SiteSecura - Dynamic Verified Badge SVG Test Suite (VB-4)
Tests:
1. HTTP Content-Type (image/svg+xml) & Defensive Cache Headers.
2. Root (/badges/{token}.svg) and API (/api/v1/public/badges/{token}.svg) routing.
3. Live state representations:
   - VERIFIED: Emerald green palette, checkmark icon, "VERIFIED" text.
   - EXPIRED: Amber palette, clock icon, "EXPIRED" text.
   - REVOKED: Red palette, cross icon, "REVOKED" text.
   - UNVERIFIED / NOT FOUND: Neutral slate palette, "UNVERIFIED" text.
4. Style variants (standard vs compact).
5. SVG validity and XML escaping security.
"""
import os
import sys
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Tuple
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from apps.api.main import app
from app.db.base import Base
from app.db.session import get_db, get_sync_db
import app.db.session as session_module
from app.models.user import Organization
from app.models.website import Website
from app.models.scan import Scan
from app.models.verification import SecurityBadgePolicy, SecurityVerification, VerificationStatus, generate_public_token
from app.services.badge_renderer_service import render_badge_svg

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_dynamic_badge.sqlite3"))
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
    with TestingSyncSessionLocal() as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


@pytest.fixture(autouse=True, scope="module")
def setup_test_database():
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
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
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass


@pytest.fixture(autouse=True)
def clean_state(monkeypatch):
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_sync_db] = override_get_sync_db
    monkeypatch.setattr(session_module, "AsyncSessionLocal", TestingAsyncSessionLocal)
    monkeypatch.setattr(session_module, "SyncSessionLocal", TestingSyncSessionLocal)
    monkeypatch.setattr(session_module, "get_sync_db", override_get_sync_db)
    yield
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_sync_db, None)


@pytest.fixture
def client():
    return TestClient(app)


async def seed_badge_token(
    domain: str,
    status_val: str,
    expires_delta_days: int = 30,
) -> str:
    async with TestingAsyncSessionLocal() as session:
        org_id = uuid.uuid4()
        user_id = uuid.uuid4()
        website_id = uuid.uuid4()
        scan_id = uuid.uuid4()
        now = datetime.now(timezone.utc)

        org = Organization(id=org_id, name="Test Org", type="personal", owner_id=user_id)
        session.add(org)

        website = Website(
            id=website_id,
            organization_id=org_id,
            name=domain,
            domain=domain,
            normalized_domain=domain,
            status="active",
            last_scan_id=scan_id,
        )
        session.add(website)

        scan = Scan(
            id=scan_id,
            website_id=website_id,
            domain=domain,
            normalized_domain=domain,
            status="completed",
            score=90,
            completed_at=now,
        )
        session.add(scan)

        token = generate_public_token()
        ver = SecurityVerification(
            id=uuid.uuid4(),
            website_id=website_id,
            scan_id=scan_id,
            status=status_val,
            public_token=token,
            score=90,
            verified_at=now,
            expires_at=now + timedelta(days=expires_delta_days),
            monitoring_enabled=False,
        )
        session.add(ver)
        await session.commit()
        return token


# =========================================================================
# 1. Root & API Route Serving + Header Verification
# =========================================================================
@pytest.mark.asyncio
async def test_dynamic_badge_routes_and_headers(client):
    token = await seed_badge_token("header-test.com", VerificationStatus.VERIFIED.value, 20)

    # 1. Test root route /badges/{token}.svg
    r_root = client.get(f"/badges/{token}.svg")
    assert r_root.status_code == 200
    assert "image/svg+xml" in r_root.headers["Content-Type"]
    assert "max-age=300" in r_root.headers["Cache-Control"]
    assert "default-src 'none'" in r_root.headers["Content-Security-Policy"]

    # 2. Test api route /api/v1/public/badges/{token}.svg
    r_api = client.get(f"/api/v1/public/badges/{token}.svg")
    assert r_api.status_code == 200
    assert "image/svg+xml" in r_api.headers["Content-Type"]


# =========================================================================
# 2. Status Representation Testing
# =========================================================================
@pytest.mark.asyncio
async def test_dynamic_badge_states(client):
    # Active Verified
    ver_token = await seed_badge_token("verified-live.com", VerificationStatus.VERIFIED.value, 15)
    r_ver = client.get(f"/badges/{ver_token}.svg")
    assert r_ver.status_code == 200
    svg_ver = r_ver.text
    assert "<svg" in svg_ver
    assert "VERIFIED" in svg_ver
    assert "#059669" in svg_ver or "#10B981" in svg_ver

    # Dynamically Expired (status is verified in DB but expiration is past)
    exp_token = await seed_badge_token("expired-live.com", VerificationStatus.VERIFIED.value, -10)
    r_exp = client.get(f"/badges/{exp_token}.svg")
    assert r_exp.status_code == 200
    svg_exp = r_exp.text
    assert "EXPIRED" in svg_exp
    assert "#D97706" in svg_exp or "#F59E0B" in svg_exp

    # Revoked
    rev_token = await seed_badge_token("revoked-live.com", VerificationStatus.REVOKED.value, 20)
    r_rev = client.get(f"/badges/{rev_token}.svg")
    assert r_rev.status_code == 200
    svg_rev = r_rev.text
    assert "REVOKED" in svg_rev
    assert "#DC2626" in svg_rev or "#EF4444" in svg_rev

    # Unknown / Not Found token
    r_unknown = client.get("/badges/random-missing-token-12345.svg")
    assert r_unknown.status_code == 200
    svg_unknown = r_unknown.text
    assert "UNVERIFIED" in svg_unknown


# =========================================================================
# 3. Style Variants: Standard vs Compact
# =========================================================================
@pytest.mark.asyncio
async def test_dynamic_badge_styles(client):
    token = await seed_badge_token("style-test.com", VerificationStatus.VERIFIED.value, 10)

    # Standard style
    r_std = client.get(f"/badges/{token}.svg?style=standard")
    assert r_std.status_code == 200
    assert 'width="200"' in r_std.text or 'viewBox="0 0 200' in r_std.text
    assert "SiteSecura" in r_std.text

    # Compact style
    r_compact = client.get(f"/badges/{token}.svg?style=compact")
    assert r_compact.status_code == 200
    assert 'width="130"' in r_compact.text or 'viewBox="0 0 130' in r_compact.text
    assert "VERIFIED" in r_compact.text


# =========================================================================
# 4. XML Escaping Security & Sanitization
# =========================================================================
def test_badge_renderer_sanitization():
    # Attempt status with script tag injection
    malicious_status = '<script>alert("xss")</script>'
    svg = render_badge_svg(status=malicious_status, style="standard")

    assert "<script>" not in svg
    assert "&lt;script&gt;" not in svg  # Invalid status maps to not_found "UNVERIFIED"
    assert "UNVERIFIED" in svg
