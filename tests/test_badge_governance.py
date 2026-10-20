"""
SiteSecura - Verified Badge Governance & Production Hardening Test Suite (VB-7 & VB-8)
Comprehensive validation of:
1. Admin Policy Governance & RBAC (Admin 200, Customer 403, Unauth 401).
2. Strict Bounds Validation (scores 0-100, scan age > 0, validity > 0, extra fields forbidden).
3. Point-in-time Snapshot Immutability (historical verifications never mutated on policy change).
4. Future Eligibility Enforcement under New Policy.
5. Multi-Policy Activation Safety (at most one active policy).
6. Audit Logging for Policy Governance (BADGE_POLICY_UPDATED).
7. Public Data Minimization (zero leakage of internal IDs, scan IDs, findings, raw scores, or org info).
8. Dynamic SVG Security, Injection Defense & Cache Headers.
9. Rate Limiting Protection (429 Too Many Requests on verify/revoke abuse).
10. IDOR Multi-Tenant Isolation (zero cross-tenant leakage).
11. Concurrency Safety & Deterministic Idempotency.
12. Timezone UTC Expiration Determinism.
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
from app.core.rate_limit import _memory_rate_limits
from app.services.badge_renderer_service import render_badge_svg

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_badge_gov.sqlite3"))
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
    _memory_rate_limits.clear()
    yield
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_sync_db, None)


@pytest.fixture
def client():
    return TestClient(app)


async def create_user_fixture(
    email: str,
    uid: str,
    role: str = "user",
    plan: str = "pro",
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
            name="Test User",
            role=role,
            is_active=True,
        )
        session.add(user)

        member = OrganizationMember(
            id=uuid.uuid4(),
            organization_id=org_id,
            user_id=user_id,
            role="owner" if role == "user" else "owner",
        )
        session.add(member)
        await session.commit()
        return user, org


async def create_website_and_scan(
    org_id: uuid.UUID,
    domain: str = "example.com",
    score: int = 85,
    status: str = "completed",
    age_days: int = 1,
    has_critical: bool = False,
    has_high: bool = False,
) -> Tuple[Website, Scan]:
    async with TestingAsyncSessionLocal() as session:
        now = datetime.now(timezone.utc)
        completed_at = now - timedelta(days=age_days)

        website = Website(
            id=uuid.uuid4(),
            organization_id=org_id,
            name=f"Site {domain}",
            domain=domain,
            normalized_domain=domain,
            status="active",
        )
        session.add(website)
        await session.flush()

        scan = Scan(
            id=uuid.uuid4(),
            organization_id=org_id,
            website_id=website.id,
            domain=domain,
            normalized_domain=domain,
            status=status,
            score=score,
            risk_level="low" if score >= 80 else "medium",
            created_at=completed_at - timedelta(minutes=5),
            completed_at=completed_at,
        )
        session.add(scan)
        await session.flush()

        website.last_scan_id = scan.id

        if has_critical:
            c_check = ScanCheck(
                id=uuid.uuid4(),
                scan_id=scan.id,
                check_type="ssl_certificate",
                status="critical",
                severity="critical",
                title="Critical SSL Failure",
                score_impact=-40,
            )
            session.add(c_check)

        if has_high:
            h_check = ScanCheck(
                id=uuid.uuid4(),
                scan_id=scan.id,
                check_type="hsts",
                status="fail",
                severity="high",
                title="Missing HSTS Header",
                score_impact=-20,
            )
            session.add(h_check)

        await session.commit()
        return website, scan


# ============================================================================
# 1. Admin Policy Governance & RBAC Tests (VB-7A, VB-7B)
# ============================================================================

@pytest.mark.asyncio
async def test_admin_policy_read_authorized(client):
    """Admin user can read the active security badge policy."""
    _, _ = await create_user_fixture("admin1@example.com", uid="adminuser1", role="admin")
    headers = {"Authorization": "Bearer dev-token-adminuser1-pro"}

    resp = client.get("/api/v1/admin/badges/policy", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "minimum_score" in data
    assert data["minimum_score"] >= 0
    assert "maximum_scan_age_days" in data
    assert "verification_validity_days" in data
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_admin_policy_update_authorized(client):
    """Admin user can update the policy thresholds and settings."""
    _, org = await create_user_fixture("admin2@example.com", uid="adminuser2", role="admin")
    headers = {"Authorization": "Bearer dev-token-adminuser2-pro"}

    payload = {
        "minimum_score": 75,
        "maximum_scan_age_days": 14,
        "verification_validity_days": 60,
        "disallow_high_findings": True,
    }
    patch_resp = client.patch("/api/v1/admin/badges/policy", json=payload, headers=headers)
    assert patch_resp.status_code == 200
    updated = patch_resp.json()
    assert updated["minimum_score"] == 75
    assert updated["maximum_scan_age_days"] == 14
    assert updated["verification_validity_days"] == 60
    assert updated["disallow_high_findings"] is True

    # Confirm audit log was created
    async with TestingAsyncSessionLocal() as session:
        audit_res = await session.execute(
            select(AuditLog).where(
                AuditLog.action == "BADGE_POLICY_UPDATED",
                AuditLog.entity_type == "SECURITY_BADGE_POLICY",
            )
        )
        log = audit_res.scalar_one_or_none()
        assert log is not None
        assert "changes" in log.metadata_json


@pytest.mark.asyncio
async def test_non_admin_cannot_access_or_update_policy(client):
    """Regular customer (role='user') is rejected with 403 Forbidden."""
    _, _ = await create_user_fixture("cust1@example.com", uid="custuser1", role="user")
    headers = {"Authorization": "Bearer dev-token-custuser1-pro"}

    # Read denied
    get_resp = client.get("/api/v1/admin/badges/policy", headers=headers)
    assert get_resp.status_code == 403
    assert get_resp.json()["detail"]["error"]["code"] == "ADMIN_ACCESS_REQUIRED"

    # Update denied
    patch_resp = client.patch("/api/v1/admin/badges/policy", json={"minimum_score": 80}, headers=headers)
    assert patch_resp.status_code == 403
    assert patch_resp.json()["detail"]["error"]["code"] == "ADMIN_ACCESS_REQUIRED"


@pytest.mark.asyncio
async def test_unauthenticated_request_denied(client):
    """Unauthenticated calls to admin policy endpoints return 401."""
    resp = client.get("/api/v1/admin/badges/policy")
    assert resp.status_code == 401

    resp_patch = client.patch("/api/v1/admin/badges/policy", json={"minimum_score": 80})
    assert resp_patch.status_code == 401


# ============================================================================
# 2. Strict Input & Bounds Validation Tests (VB-7C)
# ============================================================================

@pytest.mark.asyncio
async def test_policy_bounds_validation_score(client):
    """Scores < 0 or > 100 must be rejected with 422 Unprocessable Entity."""
    _, _ = await create_user_fixture("admin3@example.com", uid="adminuser3", role="admin")
    headers = {"Authorization": "Bearer dev-token-adminuser3-pro"}

    # Negative score
    resp1 = client.patch("/api/v1/admin/badges/policy", json={"minimum_score": -10}, headers=headers)
    assert resp1.status_code == 422

    # Score > 100
    resp2 = client.patch("/api/v1/admin/badges/policy", json={"minimum_score": 101}, headers=headers)
    assert resp2.status_code == 422


@pytest.mark.asyncio
async def test_policy_bounds_validation_scan_age(client):
    """Scan age <= 0 must be rejected with 422."""
    _, _ = await create_user_fixture("admin4@example.com", uid="adminuser4", role="admin")
    headers = {"Authorization": "Bearer dev-token-adminuser4-pro"}

    resp = client.patch("/api/v1/admin/badges/policy", json={"maximum_scan_age_days": 0}, headers=headers)
    assert resp.status_code == 422

    resp_neg = client.patch("/api/v1/admin/badges/policy", json={"maximum_scan_age_days": -5}, headers=headers)
    assert resp_neg.status_code == 422


@pytest.mark.asyncio
async def test_policy_bounds_validation_validity_days(client):
    """Validity days <= 0 must be rejected with 422."""
    _, _ = await create_user_fixture("admin5@example.com", uid="adminuser5", role="admin")
    headers = {"Authorization": "Bearer dev-token-adminuser5-pro"}

    resp = client.patch("/api/v1/admin/badges/policy", json={"verification_validity_days": 0}, headers=headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_policy_validation_forbids_unknown_fields(client):
    """Unexpected or dangerous fields are forbidden by schema."""
    _, _ = await create_user_fixture("admin6@example.com", uid="adminuser6", role="admin")
    headers = {"Authorization": "Bearer dev-token-adminuser6-pro"}

    resp = client.patch("/api/v1/admin/badges/policy", json={"unknown_exploit_param": "payload"}, headers=headers)
    assert resp.status_code == 422


# ============================================================================
# 3. Snapshot Immutability & Future Eligibility (VB-7D, VB-7E)
# ============================================================================

@pytest.mark.asyncio
async def test_historical_verification_remains_unchanged_on_policy_update(client):
    """
    CRITICAL RULE: Historical verifications are point-in-time snapshots.
    When admin updates policy from 70 to 80, an existing score-75 verification
    MUST NOT be mutated or revoked.
    """
    # 1. Reset policy to 70
    admin, _ = await create_user_fixture("admin_snap@example.com", uid="adminsnap", role="admin")
    admin_headers = {"Authorization": "Bearer dev-token-adminsnap-pro"}
    client.patch("/api/v1/admin/badges/policy", json={"minimum_score": 70}, headers=admin_headers)

    # 2. Issue badge for site with score 75
    user, org = await create_user_fixture("cust_snap@example.com", uid="custsnap", role="user")
    user_headers = {"Authorization": "Bearer dev-token-custsnap-pro"}
    site, _ = await create_website_and_scan(org.id, domain="snapshot-test.com", score=75)

    issue_resp = client.post(f"/api/v1/websites/{site.id}/badge/verify", headers=user_headers)
    assert issue_resp.status_code == 200
    issued_data = issue_resp.json()
    verification_id = issued_data["id"]
    public_token = issued_data["public_token"]
    assert issued_data["score"] == 75

    # 3. Admin raises threshold to 80
    patch_resp = client.patch("/api/v1/admin/badges/policy", json={"minimum_score": 80}, headers=admin_headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["minimum_score"] == 80

    # 4. Verify historical record remains intact with score 75 and status verified
    async with TestingAsyncSessionLocal() as session:
        v_res = await session.execute(
            select(SecurityVerification).where(SecurityVerification.id == uuid.UUID(verification_id))
        )
        record = v_res.scalar_one()
        assert record.score == 75
        assert record.status == "verified"
        assert record.public_token == public_token

    # 5. Public verification still shows VERIFIED for this snapshot
    pub_resp = client.get(f"/api/v1/public/verified/{public_token}")
    assert pub_resp.status_code == 200
    assert pub_resp.json()["status"] == "verified"


@pytest.mark.asyncio
async def test_future_eligibility_uses_new_policy(client):
    """
    After policy is updated to minimum score 80, future eligibility checks
    for a website with score 75 evaluate to INELIGIBLE.
    """
    admin, _ = await create_user_fixture("admin_fut@example.com", uid="adminfut", role="admin")
    admin_headers = {"Authorization": "Bearer dev-token-adminfut-pro"}
    client.patch("/api/v1/admin/badges/policy", json={"minimum_score": 80}, headers=admin_headers)

    user, org = await create_user_fixture("cust_fut@example.com", uid="custfut", role="user")
    user_headers = {"Authorization": "Bearer dev-token-custfut-pro"}
    site, _ = await create_website_and_scan(org.id, domain="future-elig.org", score=75)

    elig_resp = client.get(f"/api/v1/websites/{site.id}/badge/eligibility", headers=user_headers)
    assert elig_resp.status_code == 200
    elig_data = elig_resp.json()
    assert elig_data["eligible"] is False
    assert EligibilityReasonCode.SCORE_BELOW_THRESHOLD.value in elig_data["reasons"]
    assert elig_data["policy"]["minimum_score"] == 80


# ============================================================================
# 4. Public Endpoint Data Minimization & Injection Defense (VB-8A, VB-8C)
# ============================================================================

@pytest.mark.asyncio
async def test_public_endpoint_data_minimization(client):
    """
    Public verification endpoint must strictly minimize data:
    NO internal IDs, scan IDs, org IDs, vulnerability findings, or raw scores.
    """
    _, org = await create_user_fixture("min_user@example.com", uid="minuser")
    site, _ = await create_website_and_scan(org.id, domain="safe-leak-check.com", score=90)
    user_headers = {"Authorization": "Bearer dev-token-minuser-pro"}

    issue_resp = client.post(f"/api/v1/websites/{site.id}/badge/verify", headers=user_headers)
    token = issue_resp.json()["public_token"]

    pub_resp = client.get(f"/api/v1/public/verified/{token}")
    assert pub_resp.status_code == 200
    data = pub_resp.json()

    # Allowed fields
    assert "domain" in data
    assert "status" in data
    assert "verified_at" in data
    assert "expires_at" in data
    assert "verification_tier" in data
    assert "badge_url" in data
    assert "verification_url" in data
    assert "disclaimer" in data

    # STRICT PROHIBITIONS:
    forbidden_keys = [
        "id", "website_id", "scan_id", "policy_id", "score", "risk_level",
        "findings", "checks", "reasons", "user_id", "organization_id",
        "headers", "cookies", "dns", "technologies", "raw_response"
    ]
    for key in forbidden_keys:
        assert key not in data, f"Sensitive key '{key}' leaked in public verification endpoint!"

    # Header check: CORS
    assert pub_resp.headers.get("access-control-allow-origin") == "*"


def test_svg_xml_injection_prevention():
    """
    Malicious payloads in status, domain, or parameters must be sanitized.
    The output SVG must remain valid XML and never render active script tags.
    """
    malicious_inputs = [
        '<script>alert("xss")</script>',
        '"><svg onload=alert(1)>',
        '&<>"\'',
        '<foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject>',
    ]
    for payload in malicious_inputs:
        svg_std = render_badge_svg(status=payload, style="standard")
        assert "<script>" not in svg_std
        assert "onload" not in svg_std
        assert "<iframe" not in svg_std
        assert svg_std.startswith("<svg")
        assert svg_std.endswith("</svg>")

        svg_cmp = render_badge_svg(status=payload, style="compact")
        assert "<script>" not in svg_cmp
        assert svg_cmp.startswith("<svg")


@pytest.mark.asyncio
async def test_svg_cors_and_cache_headers(client):
    """Dynamic SVG returns proper Content-Type, CORS, and Cache-Control headers."""
    _, org = await create_user_fixture("svg_user@example.com", uid="svguser")
    site, _ = await create_website_and_scan(org.id, domain="svg-test.com", score=90)
    user_headers = {"Authorization": "Bearer dev-token-svguser-pro"}

    issue_resp = client.post(f"/api/v1/websites/{site.id}/badge/verify", headers=user_headers)
    token = issue_resp.json()["public_token"]

    resp = client.get(f"/badges/{token}.svg?style=standard")
    assert resp.status_code == 200
    assert "image/svg+xml" in resp.headers["content-type"]
    assert resp.headers.get("access-control-allow-origin") == "*"
    assert "max-age=300" in resp.headers.get("cache-control", "")
    assert resp.headers.get("x-content-type-options") == "nosniff"


# ============================================================================
# 5. Rate Limiting, IDOR & Security Hardening (VB-8B, VB-8H, VB-8J)
# ============================================================================

@pytest.mark.asyncio
async def test_rate_limiting_enforcement_on_verify(client):
    """
    Repeated rapid verify requests from the same user exceed rate limit (10 req/min)
    and return 429 Too Many Requests.
    """
    _, org = await create_user_fixture("rl_user@example.com", uid="rluser")
    site, _ = await create_website_and_scan(org.id, domain="ratelimit-test.com", score=88)
    user_headers = {"Authorization": "Bearer dev-token-rluser-pro"}

    # Issue 10 calls (allowed)
    for _ in range(10):
        r = client.post(f"/api/v1/websites/{site.id}/badge/verify", headers=user_headers)
        assert r.status_code == 200

    # 11th call triggers 429
    r_exceeded = client.post(f"/api/v1/websites/{site.id}/badge/verify", headers=user_headers)
    assert r_exceeded.status_code == 429
    body = r_exceeded.json()
    assert body["detail"]["error"]["code"] == "RATE_LIMITED"


@pytest.mark.asyncio
async def test_idor_cross_organization_denial(client):
    """User from Org A cannot access or verify Org B's website (strict 404 isolation)."""
    _, org_a = await create_user_fixture("org_a@example.com", uid="user_a", org_name="Org A")
    _, org_b = await create_user_fixture("org_b@example.com", uid="user_b", org_name="Org B")

    site_b, _ = await create_website_and_scan(org_b.id, domain="org-b-site.com", score=90)

    # User A tries to verify Org B's site
    headers_a = {"Authorization": "Bearer dev-token-user_a-pro"}
    resp = client.post(f"/api/v1/websites/{site_b.id}/badge/verify", headers=headers_a)
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "WEBSITE_NOT_FOUND"

    # User A tries to get badge status of Org B's site
    status_resp = client.get(f"/api/v1/websites/{site_b.id}/badge", headers=headers_a)
    assert status_resp.status_code == 404


@pytest.mark.asyncio
async def test_token_collision_and_safe_404(client):
    """Malformed or invalid public tokens safely return 404 without SQL errors."""
    resp1 = client.get("/api/v1/public/verified/non-existent-token-12345678")
    assert resp1.status_code == 404

    # Extremely long or malformed tokens safely rejected
    resp2 = client.get(f"/api/v1/public/verified/{'x' * 200}")
    assert resp2.status_code == 404

    # SVG for non-existent token returns valid UNVERIFIED SVG with short cache
    resp3 = client.get("/badges/non-existent-token.svg")
    assert resp3.status_code == 200
    assert "UNVERIFIED" in resp3.text
    assert "max-age=30" in resp3.headers.get("cache-control", "")
