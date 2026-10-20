"""
SiteSecura - Public Verification Endpoint Test Suite (VB-4)
Tests:
1. Public unauthenticated access (GET /api/v1/public/verified/{token}).
2. Strict data minimization (zero leak of internal UUIDs, scores, findings, scan IDs).
3. Live effective status calculation:
   - Verified active state.
   - Dynamically expired state (expires_at in past without background cron requirement).
   - Revoked state.
4. Non-existent token 404 behavior.
5. Standard disclaimer text presence.
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
from app.models.user import User, Organization
from app.models.website import Website
from app.models.scan import Scan
from app.models.verification import SecurityBadgePolicy, SecurityVerification, VerificationStatus, generate_public_token

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_public_verification.sqlite3"))
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


async def seed_verification_record(
    domain: str,
    status_val: str,
    expires_delta_days: int = 30,
) -> Tuple[SecurityVerification, Website]:
    async with TestingAsyncSessionLocal() as session:
        org_id = uuid.uuid4()
        user_id = uuid.uuid4()
        website_id = uuid.uuid4()
        scan_id = uuid.uuid4()
        policy_id = uuid.uuid4()
        now = datetime.now(timezone.utc)

        org = Organization(id=org_id, name="Test Org", type="personal", owner_id=user_id)
        session.add(org)

        policy = SecurityBadgePolicy(
            id=policy_id,
            name="default",
            is_active=True,
            minimum_score=70,
            maximum_scan_age_days=30,
            verification_validity_days=30,
            disallow_critical_findings=True,
            disallow_high_findings=False,
            require_successful_scan=True,
            require_authorized_website=True,
            require_monitoring=False,
        )
        session.add(policy)

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
            score=95,
            risk_level="Excellent",
            completed_at=now,
        )
        session.add(scan)

        expires_at = now + timedelta(days=expires_delta_days)
        verification = SecurityVerification(
            id=uuid.uuid4(),
            website_id=website_id,
            scan_id=scan_id,
            policy_id=policy_id,
            status=status_val,
            public_token=generate_public_token(),
            score=95,
            risk_level="Excellent",
            verified_at=now - timedelta(days=2),
            expires_at=expires_at,
            eligibility_reason={"checks": {}, "reasons": []},
            monitoring_enabled=False,
            badge_settings={},
        )
        session.add(verification)

        await session.commit()
        return verification, website


# =========================================================================
# 1. Public Unauthenticated Lookup & Data Minimization
# =========================================================================
@pytest.mark.asyncio
async def test_public_verification_data_minimization(client):
    ver, website = await seed_verification_record(
        domain="public-secure.com",
        status_val=VerificationStatus.VERIFIED.value,
        expires_delta_days=25,
    )

    # Call endpoint without ANY Authorization header
    resp = client.get(f"/api/v1/public/verified/{ver.public_token}")
    assert resp.status_code == 200
    data = resp.json()

    # Required public fields
    assert data["domain"] == "public-secure.com"
    assert data["status"] == "verified"
    assert data["verification_tier"] == "Security Check Verified"
    assert f"/badges/{ver.public_token}.svg" in data["badge_url"]
    assert f"/verified/{ver.public_token}" in data["verification_url"]
    assert "disclaimer" in data
    assert len(data["disclaimer"]) > 50

    # Strict Data Minimization Checks: ABSOLUTELY NO SENSITIVE FIELDS
    forbidden_keys = [
        "id",
        "website_id",
        "scan_id",
        "policy_id",
        "score",
        "risk_level",
        "eligibility_reason",
        "badge_settings",
        "checks",
        "findings",
        "organization_id",
        "server",
        "technologies",
    ]
    for key in forbidden_keys:
        assert key not in data, f"Data leakage detected! '{key}' must NOT be in public response"


# =========================================================================
# 2. Dynamic Expiration Calculation (Without Background Cron)
# =========================================================================
@pytest.mark.asyncio
async def test_public_verification_dynamic_expiration(client):
    # Seed record with status='verified' in DB, but expires_at in the PAST (-5 days)
    ver, website = await seed_verification_record(
        domain="expired-site.com",
        status_val=VerificationStatus.VERIFIED.value,
        expires_delta_days=-5,
    )

    resp = client.get(f"/api/v1/public/verified/{ver.public_token}")
    assert resp.status_code == 200
    data = resp.json()

    # Engine must compute effective status as "expired"
    assert data["status"] == "expired"
    assert data["domain"] == "expired-site.com"


# =========================================================================
# 3. Revoked Verification State
# =========================================================================
@pytest.mark.asyncio
async def test_public_verification_revoked_state(client):
    ver, website = await seed_verification_record(
        domain="revoked-site.com",
        status_val=VerificationStatus.REVOKED.value,
        expires_delta_days=20,
    )

    resp = client.get(f"/api/v1/public/verified/{ver.public_token}")
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "revoked"
    assert data["domain"] == "revoked-site.com"


# =========================================================================
# 4. Unknown Token 404
# =========================================================================
def test_public_verification_unknown_token_404(client):
    resp = client.get("/api/v1/public/verified/non-existent-token-xyz")
    assert resp.status_code == 404
    err = resp.json()["detail"]["error"]
    assert err["code"] == "VERIFICATION_NOT_FOUND"
