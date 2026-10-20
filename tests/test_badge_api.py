"""
SiteSecura - Verified Badge API & Lifecycle Test Suite (VB-3)
Tests:
1. Authentication gating (401 on unauthenticated calls).
2. Multi-tenant 404 isolation (IDOR/BOLA prevention on foreign websites).
3. Eligibility checking endpoint (GET /websites/{id}/badge/eligibility).
4. Verification issuance (POST /websites/{id}/badge/verify) for eligible website.
5. Verification rejection (400 ELIGIBILITY_REQUIREMENTS_NOT_MET) when criteria not met.
6. Verification idempotency (subsequent POST /verify calls return existing snapshot).
7. Current badge status & embed snippets retrieval (GET /websites/{id}/badge).
8. Badge revocation (DELETE /websites/{id}/badge).
9. Revocation idempotency & 404 for unconfigured website.
10. Immutable audit events (BADGE_ELIGIBILITY_CHECKED, BADGE_VERIFIED, BADGE_REVOKED).
"""
import os
import sys
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Tuple, Dict, Any, Optional
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
from app.models.user import User, Organization, OrganizationMember
from app.models.website import Website
from app.models.scan import Scan, ScanCheck
from app.models.verification import SecurityBadgePolicy, SecurityVerification, VerificationStatus
from app.models.alert import AuditLog
from app.schemas.verification import EligibilityReasonCode

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_badge_api.sqlite3"))
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


async def create_user_fixture(
    email: str,
    uid: str,
    role: str = "pro",
    org_name: str = "Test Org",
) -> Tuple[User, Organization]:
    async with TestingAsyncSessionLocal() as session:
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
            firebase_uid=uid,
            email=email,
            name=f"User {uid}",
            role=role,
            organization_id=org_id,
            is_active=True,
        )
        session.add(user)

        member = OrganizationMember(
            id=uuid.uuid4(),
            organization_id=org_id,
            user_id=user_id,
            role="owner",
        )
        session.add(member)

        # Ensure default badge policy exists
        pol_res = await session.execute(
            select(SecurityBadgePolicy).where(SecurityBadgePolicy.is_active == True)
        )
        if not pol_res.scalars().first():
            policy = SecurityBadgePolicy(
                id=uuid.uuid4(),
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

        await session.commit()
        return user, org


async def create_website_and_scan(
    org_id: uuid.UUID,
    domain: str = "example.com",
    score: int = 85,
    has_critical: bool = False,
    scan_age_days: int = 2,
    scan_status: str = "completed",
) -> Tuple[Website, Scan]:
    async with TestingAsyncSessionLocal() as session:
        website_id = uuid.uuid4()
        scan_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        completed_at = now - timedelta(days=scan_age_days)

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
            status=scan_status,
            score=score,
            risk_level="Good" if score >= 75 else "Medium Risk",
            completed_at=completed_at,
            created_at=completed_at,
        )
        session.add(scan)

        if has_critical:
            crit_check = ScanCheck(
                id=uuid.uuid4(),
                scan_id=scan_id,
                check_type="ssl_validity",
                name="SSL Certificate Expired",
                status="fail",
                severity="critical",
                score_impact=30,
                title="Critical SSL Certificate Failure",
                summary="Certificate has expired",
            )
            session.add(crit_check)

        await session.commit()
        return website, scan


# =========================================================================
# 1. Authentication Gating
# =========================================================================
def test_badge_endpoints_authentication_required(client):
    random_id = uuid.uuid4()

    # GET eligibility
    r = client.get(f"/api/v1/websites/{random_id}/badge/eligibility")
    assert r.status_code == 401

    # POST verify
    r = client.post(f"/api/v1/websites/{random_id}/badge/verify")
    assert r.status_code == 401

    # GET status
    r = client.get(f"/api/v1/websites/{random_id}/badge")
    assert r.status_code == 401

    # DELETE badge
    r = client.delete(f"/api/v1/websites/{random_id}/badge")
    assert r.status_code == 401


# =========================================================================
# 2. Multi-Tenant 404 Isolation (IDOR/BOLA Protection)
# =========================================================================
@pytest.mark.asyncio
async def test_tenant_isolation_idor_prevention(client):
    _, org_a = await create_user_fixture("tenant_a@example.com", uid="tenanta")
    _, org_b = await create_user_fixture("tenant_b@example.com", uid="tenantb")

    site_b, _ = await create_website_and_scan(org_b.id, domain="tenantb-secret.com", score=90)

    # Tenant A attempts to access Tenant B's website badge resources
    headers_a = {"Authorization": "Bearer dev-token-tenanta-pro"}

    r_elig = client.get(f"/api/v1/websites/{site_b.id}/badge/eligibility", headers=headers_a)
    assert r_elig.status_code == 404
    assert r_elig.json()["detail"]["error"]["code"] == "WEBSITE_NOT_FOUND"

    r_verify = client.post(f"/api/v1/websites/{site_b.id}/badge/verify", headers=headers_a)
    assert r_verify.status_code == 404

    r_status = client.get(f"/api/v1/websites/{site_b.id}/badge", headers=headers_a)
    assert r_status.status_code == 404

    r_delete = client.delete(f"/api/v1/websites/{site_b.id}/badge", headers=headers_a)
    assert r_delete.status_code == 404


# =========================================================================
# 3. Eligibility Checking Endpoint
# =========================================================================
@pytest.mark.asyncio
async def test_badge_eligibility_endpoint(client):
    _, org = await create_user_fixture("owner_elig@example.com", uid="ownerelig")
    site, scan = await create_website_and_scan(org.id, domain="eligible-site.com", score=88)

    headers = {"Authorization": "Bearer dev-token-ownerelig-pro"}
    resp = client.get(f"/api/v1/websites/{site.id}/badge/eligibility", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["eligible"] is True
    assert data["score"] == 88
    assert data["checks"]["minimum_score"] is True
    assert data["checks"]["critical_findings"] is True
    assert len(data["reasons"]) == 0

    # Verify audit event emitted
    async with TestingAsyncSessionLocal() as session:
        audit_res = await session.execute(
            select(AuditLog).where(
                AuditLog.action == "BADGE_ELIGIBILITY_CHECKED",
                AuditLog.entity_id == str(site.id),
            )
        )
        entry = audit_res.scalar_one_or_none()
        assert entry is not None
        assert entry.metadata_json["eligible"] is True


# =========================================================================
# 4. Successful Verification Issuance & Idempotency
# =========================================================================
@pytest.mark.asyncio
async def test_badge_verification_issuance_and_idempotency(client):
    _, org = await create_user_fixture("issuer@example.com", uid="issueruser")
    site, scan = await create_website_and_scan(org.id, domain="verifiable-app.io", score=92)

    headers = {"Authorization": "Bearer dev-token-issueruser-pro"}

    # 1. Issue badge
    resp = client.post(f"/api/v1/websites/{site.id}/badge/verify", headers=headers)
    assert resp.status_code == 200
    body = resp.json()

    assert body["status"] == "verified"
    assert body["score"] == 92
    public_token = body["public_token"]
    assert len(public_token) >= 32
    assert "verification_url" in body
    assert f"/verified/{public_token}" in body["verification_url"]
    assert "badge_url" in body
    assert f"/badges/{public_token}.svg" in body["badge_url"]
    assert "embed_snippets" in body
    assert body["embed_snippets"]["html"] is not None

    verification_id = body["id"]

    # 2. Call verify a second time -> IDEMPOTENT: returns the exact same verification
    resp2 = client.post(f"/api/v1/websites/{site.id}/badge/verify", headers=headers)
    assert resp2.status_code == 200
    body2 = resp2.json()

    assert body2["id"] == verification_id
    assert body2["public_token"] == public_token

    # Verify only ONE active verification was created in DB
    async with TestingAsyncSessionLocal() as session:
        v_res = await session.execute(
            select(SecurityVerification).where(SecurityVerification.website_id == site.id)
        )
        records = v_res.scalars().all()
        assert len(records) == 1

        # Check audit log
        audit_res = await session.execute(
            select(AuditLog).where(
                AuditLog.action == "BADGE_VERIFIED",
                AuditLog.entity_id == verification_id,
            )
        )
        assert audit_res.scalar_one_or_none() is not None


# =========================================================================
# 5. Ineligible Website Rejection on POST /verify
# =========================================================================
@pytest.mark.asyncio
async def test_badge_verification_rejection_ineligible(client):
    _, org = await create_user_fixture("failing@example.com", uid="failuser")
    site, _ = await create_website_and_scan(
        org.id, domain="failing-score.com", score=55, has_critical=True
    )

    headers = {"Authorization": "Bearer dev-token-failuser-pro"}
    resp = client.post(f"/api/v1/websites/{site.id}/badge/verify", headers=headers)

    assert resp.status_code == 400
    err = resp.json()["detail"]["error"]
    assert err["code"] == "ELIGIBILITY_REQUIREMENTS_NOT_MET"
    assert EligibilityReasonCode.SCORE_BELOW_THRESHOLD.value in err["reasons"]
    assert EligibilityReasonCode.CRITICAL_FINDING_PRESENT.value in err["reasons"]


# =========================================================================
# 6. Current Badge Status Endpoint
# =========================================================================
@pytest.mark.asyncio
async def test_get_current_badge_status(client):
    _, org = await create_user_fixture("statuscheck@example.com", uid="statususer")
    site, _ = await create_website_and_scan(org.id, domain="status-site.com", score=80)

    headers = {"Authorization": "Bearer dev-token-statususer-pro"}

    # Prior to verification -> status is "eligible"
    s_pre = client.get(f"/api/v1/websites/{site.id}/badge", headers=headers)
    assert s_pre.status_code == 200
    assert s_pre.json()["status"] == "eligible"
    assert s_pre.json()["public_token"] is None

    # Verify website
    client.post(f"/api/v1/websites/{site.id}/badge/verify", headers=headers)

    # After verification -> status is "verified"
    s_post = client.get(f"/api/v1/websites/{site.id}/badge", headers=headers)
    assert s_post.status_code == 200
    body = s_post.json()
    assert body["status"] == "verified"
    assert body["public_token"] is not None
    assert body["embed_snippets"] is not None


# =========================================================================
# 7. Badge Revocation Endpoint & Lifecycle
# =========================================================================
@pytest.mark.asyncio
async def test_badge_revocation_lifecycle(client):
    _, org = await create_user_fixture("revoker@example.com", uid="revokeruser")
    site, _ = await create_website_and_scan(org.id, domain="revoke-site.com", score=85)

    headers = {"Authorization": "Bearer dev-token-revokeruser-pro"}

    # Issue badge first
    ver_resp = client.post(f"/api/v1/websites/{site.id}/badge/verify", headers=headers)
    assert ver_resp.status_code == 200

    # Revoke badge
    del_resp = client.delete(f"/api/v1/websites/{site.id}/badge", headers=headers)
    assert del_resp.status_code == 200
    del_body = del_resp.json()
    assert del_body["status"] == "revoked"

    # Status check now shows "revoked"
    status_resp = client.get(f"/api/v1/websites/{site.id}/badge", headers=headers)
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "revoked"

    # Repeated revocation is idempotent and succeeds
    del_resp2 = client.delete(f"/api/v1/websites/{site.id}/badge", headers=headers)
    assert del_resp2.status_code == 200
    assert del_resp2.json()["status"] == "revoked"

    # Verify audit event for revocation
    async with TestingAsyncSessionLocal() as session:
        audit_res = await session.execute(
            select(AuditLog).where(
                AuditLog.action == "BADGE_REVOKED",
                AuditLog.organization_id == org.id,
            )
        )
        assert audit_res.scalar_one_or_none() is not None
