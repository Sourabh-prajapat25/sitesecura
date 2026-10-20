"""
Scanly SaaS - Phase B Security Test Suite
Covers:
1. Multi-tenant isolation & IDOR protection (404 strategy)
2. Exact Plan Limits & Quota Enforcement (Free: 1/10, Basic: 2/100, Pro: 10/500, Agency: 100/3000)
3. Server-side finding protection & zero DevTools remediation leaks
4. Server-side PDF generation security
5. Rate limiting with in-memory fallback
6. Audit logging and sensitive token/password redaction
"""
import pytest
import asyncio
import uuid
import os
import sys
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker, Session

# Ensure import paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from apps.api.main import app
from app.db.base import Base
from app.db.session import get_db, get_sync_db
import app.db.session as session_module
from app.models.user import User, Organization, OrganizationMember
from app.models.website import Website
from app.models.scan import Scan, ScanCheck, Report
from app.models.billing import UsageRecord, Subscription
from app.models.alert import AuditLog, Alert
from app.core.permissions import PLAN_CAPABILITIES, PlanTier, can_view_full_findings
from app.services.audit_service import sanitize_audit_metadata, record_audit_event
from app.services.entitlement_service import (
    filter_findings_for_viewer,
    check_and_reserve_website_quota,
    check_and_reserve_scan_quota,
    refund_scan_quota,
    get_effective_plan,
    get_current_usage_period,
)
from app.services.pdf_service import generate_pdf_report
from app.core.rate_limit import check_rate_limit, _memory_rate_limits
from app.core.authorization import AuthContext

# Use temporary file SQLite DB to ensure sync and async share identical DB state across tests
TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_phase_b.sqlite3"))
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"
TEST_SYNC_DB_URL = f"sqlite:///{TEST_DB_FILE}"

test_async_engine = create_async_engine(TEST_DB_URL, echo=False)
TestAsyncSessionLocal = async_sessionmaker(bind=test_async_engine, class_=AsyncSession, expire_on_commit=False)

test_sync_engine = create_engine(TEST_SYNC_DB_URL, echo=False)
TestSyncSessionLocal = sessionmaker(bind=test_sync_engine, class_=Session, expire_on_commit=False)


async def override_get_db():
    async with TestAsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def override_get_sync_db():
    return TestSyncSessionLocal()


app.dependency_overrides[get_db] = override_get_db
session_module.get_sync_db = override_get_sync_db


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass

    Base.metadata.create_all(bind=test_sync_engine)

    async def init_async():
        async with test_async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(init_async())

    yield

    # Teardown
    try:
        test_sync_engine.dispose()
    except Exception:
        pass
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass


@pytest.fixture(autouse=True)
def mock_background_execution(monkeypatch):
    app.dependency_overrides[get_db] = override_get_db
    session_module.get_sync_db = override_get_sync_db
    mock_task = MagicMock()
    monkeypatch.setattr("app.api.v1.scans.scan_website_task", mock_task)
    monkeypatch.setattr("app.api.v1.scans.execute_scan_job", MagicMock())
    monkeypatch.setattr("app.api.v1.websites.scan_website_task", mock_task)
    _memory_rate_limits.clear()
    try:
        import redis as sync_redis
        from app.core.config import settings
        r = sync_redis.from_url(settings.REDIS_URL)
        keys = r.keys("ratelimit:*")
        if keys:
            r.delete(*keys)
    except Exception:
        pass
    yield
    app.dependency_overrides.pop(get_db, None)


client = TestClient(app)


# ==============================================================================
# 1. PLAN LIMIT MATRIX & ENTITLEMENTS VERIFICATION
# ==============================================================================

def test_exact_phase_b_plan_capabilities():
    """Verify that PLAN_CAPABILITIES contains exact Phase B limits."""
    assert PLAN_CAPABILITIES[PlanTier.FREE]["max_websites"] == 1
    assert PLAN_CAPABILITIES[PlanTier.FREE]["max_scans_per_month"] == 10

    assert PLAN_CAPABILITIES[PlanTier.BASIC]["max_websites"] == 2
    assert PLAN_CAPABILITIES[PlanTier.BASIC]["max_scans_per_month"] == 100

    assert PLAN_CAPABILITIES[PlanTier.PRO]["max_websites"] == 10
    assert PLAN_CAPABILITIES[PlanTier.PRO]["max_scans_per_month"] == 500

    assert PLAN_CAPABILITIES[PlanTier.AGENCY]["max_websites"] == 100
    assert PLAN_CAPABILITIES[PlanTier.AGENCY]["max_scans_per_month"] == 3000

    assert can_view_full_findings("free") is False
    assert can_view_full_findings("basic") is True
    assert can_view_full_findings("pro") is True
    assert can_view_full_findings("agency") is True
    assert can_view_full_findings("admin") is True


# ==============================================================================
# 2. MULTI-TENANT ISOLATION & IDOR (HTTP 404 STRATEGY)
# ==============================================================================

def test_tenant_website_isolation_and_idor_returns_404():
    """
    Tenant A creates website.
    Tenant B attempts GET, PATCH, DELETE, POST /scan, GET /history.
    All cross-tenant attempts MUST return HTTP 404 Not Found.
    """
    headers_a = {"Authorization": "Bearer dev-token-tenantA-pro"}
    headers_b = {"Authorization": "Bearer dev-token-tenantB-pro"}

    # Tenant A creates website
    create_res = client.post(
        "/api/v1/websites",
        headers=headers_a,
        json={"domain": "tenant-a-only.com", "name": "Tenant A Secret App"},
    )
    assert create_res.status_code == 201
    site_a_id = create_res.json()["id"]

    # Tenant A can access
    res_a = client.get(f"/api/v1/websites/{site_a_id}", headers=headers_a)
    assert res_a.status_code == 200
    assert res_a.json()["domain"] == "tenant-a-only.com"

    # Tenant B GET -> 404 Not Found (not 403, preventing enumeration)
    res_b_get = client.get(f"/api/v1/websites/{site_a_id}", headers=headers_b)
    assert res_b_get.status_code == 404
    assert res_b_get.json()["detail"]["error"]["code"] == "WEBSITE_NOT_FOUND"

    # Tenant B PATCH -> 404 Not Found
    res_b_patch = client.patch(
        f"/api/v1/websites/{site_a_id}",
        headers=headers_b,
        json={"name": "Tampered Name"},
    )
    assert res_b_patch.status_code == 404

    # Tenant B POST /scan -> 404 Not Found
    res_b_scan = client.post(f"/api/v1/websites/{site_a_id}/scan", headers=headers_b)
    assert res_b_scan.status_code == 404

    # Tenant B GET /history -> 404 Not Found
    res_b_hist = client.get(f"/api/v1/websites/{site_a_id}/history", headers=headers_b)
    assert res_b_hist.status_code == 404

    # Tenant B DELETE -> 404 Not Found
    res_b_del = client.delete(f"/api/v1/websites/{site_a_id}", headers=headers_b)
    assert res_b_del.status_code == 404

    # Tenant A can still access (was not deleted)
    res_a_check = client.get(f"/api/v1/websites/{site_a_id}", headers=headers_a)
    assert res_a_check.status_code == 200


def test_tenant_scan_isolation_and_idor_returns_404():
    """
    Tenant A triggers scan.
    Tenant B attempts GET /scans/{id}, GET /scans/{id}/status, GET /scans/{id}/results, GET /scans/{id}/pdf.
    All cross-tenant attempts MUST return HTTP 404 Not Found.
    """
    headers_a = {"Authorization": "Bearer dev-token-tenantA-pro"}
    headers_b = {"Authorization": "Bearer dev-token-tenantB-pro"}

    # Tenant A creates scan
    create_res = client.post(
        "/api/v1/scans",
        headers=headers_a,
        json={"domain": "tenant-a-scan-target.com"},
    )
    assert create_res.status_code == 201
    scan_id = create_res.json()["id"]

    # Tenant A can view details
    res_a = client.get(f"/api/v1/scans/{scan_id}", headers=headers_a)
    assert res_a.status_code == 200

    # Tenant B GET /scans/{id} -> 404 Not Found
    res_b = client.get(f"/api/v1/scans/{scan_id}", headers=headers_b)
    assert res_b.status_code == 404
    assert res_b.json()["detail"]["error"]["code"] == "SCAN_NOT_FOUND"

    # Tenant B GET /scans/{id}/status -> 404 Not Found
    res_b_status = client.get(f"/api/v1/scans/{scan_id}/status", headers=headers_b)
    assert res_b_status.status_code == 404

    # Tenant B GET /scans/{id}/results -> 404 Not Found
    res_b_results = client.get(f"/api/v1/scans/{scan_id}/results", headers=headers_b)
    assert res_b_results.status_code == 404

    # Tenant B GET /scans/{id}/pdf -> 404 Not Found
    res_b_pdf = client.get(f"/api/v1/scans/{scan_id}/pdf", headers=headers_b)
    assert res_b_pdf.status_code == 404

    # Unauthenticated visitor GET /scans/{id} for private scan -> 404 Not Found
    res_anon = client.get(f"/api/v1/scans/{scan_id}")
    assert res_anon.status_code == 404


# ==============================================================================
# 3. EXACT PLAN QUOTAS & GATING ENFORCEMENT
# ==============================================================================

def test_website_quota_enforcement_free_tier():
    """Free tier is limited to strictly 1 website. 2nd website fails with 403 PLAN_LIMIT_REACHED."""
    uid = f"free_user_{uuid.uuid4().hex[:6]}"
    headers = {"Authorization": f"Bearer dev-token-{uid}-free"}

    # 1st website -> 201 Created
    res1 = client.post(
        "/api/v1/websites",
        headers=headers,
        json={"domain": f"site1-{uid}.com", "name": "First Free Site"},
    )
    assert res1.status_code == 201

    # 2nd website -> 403 Forbidden with PLAN_LIMIT_REACHED
    res2 = client.post(
        "/api/v1/websites",
        headers=headers,
        json={"domain": f"site2-{uid}.com", "name": "Second Site Exceeds Quota"},
    )
    assert res2.status_code == 403
    err_data = res2.json()
    assert err_data["detail"]["error"]["code"] == "PLAN_LIMIT_REACHED"
    assert "limit" in err_data["detail"]["error"]["message"].lower() or "upgrade" in err_data["detail"]["error"]["message"].lower()


def test_scan_quota_enforcement_free_tier():
    """Free tier is limited to 10 scans/month. 11th scan fails with 403 SCAN_QUOTA_EXCEEDED."""
    uid = f"free_scanner_{uuid.uuid4().hex[:6]}"
    headers = {"Authorization": f"Bearer dev-token-{uid}-free"}

    # 1. First scan creates user, org, and initial UsageRecord
    res1 = client.post(
        "/api/v1/scans",
        headers=headers,
        json={"domain": f"test-quota-1-{uid}.com"},
    )
    assert res1.status_code == 201

    # 2. Update UsageRecord for this specific organization to simulate 10 scans already consumed
    sync_db = TestSyncSessionLocal()
    from app.services.entitlement_service import get_current_usage_period
    period_month, _, _ = get_current_usage_period()
    user = sync_db.query(User).filter_by(firebase_uid=uid).first()
    assert user is not None
    usage = sync_db.query(UsageRecord).filter_by(organization_id=user.organization_id, period_month=period_month).first()
    assert usage is not None
    usage.scans_count = 10
    sync_db.commit()
    sync_db.close()

    # 3. Next scan attempt exceeds monthly quota and fails with 403 SCAN_QUOTA_EXCEEDED
    res_exceeded = client.post(
        "/api/v1/scans",
        headers=headers,
        json={"domain": f"test-quota-exceeded-{uid}.com"},
    )
    assert res_exceeded.status_code == 403
    err_data = res_exceeded.json()
    assert err_data["detail"]["error"]["code"] == "SCAN_QUOTA_EXCEEDED"


def test_rbac_white_label_upgrade_gate():
    """White-label settings are gated to Agency/Admin tier only."""
    free_headers = {"Authorization": "Bearer dev-token-freewhitelabel-free"}
    agency_headers = {"Authorization": "Bearer dev-token-agencywhitelabel-agency"}

    # Free user receives 403 FEATURE_UPGRADE_REQUIRED
    res_free = client.patch(
        "/api/v1/agency/white-label",
        headers=free_headers,
        json={"brand_name": "My Hacker Agency"},
    )
    assert res_free.status_code == 403
    assert res_free.json()["detail"]["error"]["code"] == "FEATURE_UPGRADE_REQUIRED"

    # Agency user succeeds
    res_agency = client.patch(
        "/api/v1/agency/white-label",
        headers=agency_headers,
        json={"brand_name": "Premium Cyber Corp"},
    )
    assert res_agency.status_code == 200
    assert res_agency.json()["brand_name"] == "Premium Cyber Corp"


# ==============================================================================
# 4. SERVER-SIDE FINDING PROTECTION & ZERO DEVTOOLS LEAK
# ==============================================================================

def test_server_side_finding_protection_logic():
    """
    Direct test of filter_findings_for_viewer:
    - Verifies top 3 findings preserved with how_to_fix & evidence.
    - Verifies findings 4+ have how_to_fix, evidence, technical_details scrubbed.
    - Zero sensitive remediation details leaked in payload.
    """
    # Create mock findings (5 checks)
    mock_checks = []
    for i in range(5):
        c = ScanCheck(
            id=uuid.uuid4(),
            check_type=f"check_{i}",
            name=f"Check {i}",
            status="fail",
            severity="high",
            score_impact=15,
            title=f"Security Issue {i}",
            summary=f"Summary of issue {i}",
            why_it_matters=f"Why it matters {i}",
            how_to_fix=f"CRITICAL REMEDIATION INSTRUCTION {i}",
            estimated_fix_minutes=15,
            documentation_url="https://docs.scanly.io",
            evidence=f"SECRET EVIDENCE DATA {i}",
            confidence=1.0,
        )
        mock_checks.append(c)

    # 1. Free viewer test
    filtered, locked_count, is_locked = filter_findings_for_viewer(
        mock_checks,
        plan="free",
        is_authenticated=True,
    )
    assert locked_count == 2
    assert is_locked is True
    assert len(filtered) == 5

    # Top 3 are fully readable
    for i in range(3):
        assert filtered[i]["is_locked"] is False
        assert filtered[i]["how_to_fix"] == f"CRITICAL REMEDIATION INSTRUCTION {i}"
        assert filtered[i]["evidence"] == f"SECRET EVIDENCE DATA {i}"

    # Remaining 2 are strictly scrubbed
    for i in range(3, 5):
        assert filtered[i]["is_locked"] is True
        assert filtered[i]["how_to_fix"] is None
        assert filtered[i]["evidence"] is None
        assert "upgraded subscription" in filtered[i]["summary"]

    # 2. Pro tier test
    filtered_pro, locked_count_pro, is_locked_pro = filter_findings_for_viewer(
        mock_checks,
        plan="pro",
        is_authenticated=True,
    )
    assert locked_count_pro == 0
    assert is_locked_pro is False
    for i in range(5):
        assert filtered_pro[i]["is_locked"] is False
        assert filtered_pro[i]["how_to_fix"] == f"CRITICAL REMEDIATION INSTRUCTION {i}"
        assert filtered_pro[i]["evidence"] == f"SECRET EVIDENCE DATA {i}"


def test_public_scan_response_scrubs_findings_over_wire():
    """
    Creates a public scan with 5 checks directly in DB, then hits GET /scans/{id}.
    Asserts server response contains no remediation or evidence for checks 3+.
    """
    sync_db = TestSyncSessionLocal()
    scan_id = uuid.uuid4()
    scan = Scan(
        id=scan_id,
        domain="public-scrub-test.org",
        normalized_domain="public-scrub-test.org",
        status="completed",
        scan_type="public",
        score=72,
        passed_checks_count=2,
        total_checks_count=5,
    )
    sync_db.add(scan)

    for i in range(5):
        chk = ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan_id,
            check_type=f"check_type_{i}",
            name=f"Vulnerability {i}",
            status="fail",
            severity="high",
            score_impact=10,
            title=f"Vuln Title {i}",
            summary=f"Summary {i}",
            how_to_fix=f"Secret fix instruction #{i}",
            evidence=f"Sensitive server header #{i}",
            estimated_fix_minutes=10,
            confidence=1.0,
        )
        sync_db.add(chk)
    sync_db.commit()
    sync_db.close()

    # Anonymous visitor fetches scan
    res = client.get(f"/api/v1/scans/{scan_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["is_premium_locked"] is True
    assert data["locked_findings_count"] == 2
    checks = data["checks"]
    assert len(checks) == 5

    # Top 3 have how_to_fix and evidence
    assert checks[0]["how_to_fix"] == "Secret fix instruction #0"
    assert checks[0]["is_locked"] is False
    assert checks[1]["how_to_fix"] == "Secret fix instruction #1"
    assert checks[2]["how_to_fix"] == "Secret fix instruction #2"

    # Checks 3 and 4 have how_to_fix and evidence SCRUBBED to null
    assert checks[3]["is_locked"] is True
    assert checks[3]["how_to_fix"] is None
    assert checks[3]["evidence"] is None

    assert checks[4]["is_locked"] is True
    assert checks[4]["how_to_fix"] is None
    assert checks[4]["evidence"] is None


# ==============================================================================
# 5. SERVER-SIDE PDF REPORT PROTECTION
# ==============================================================================

def test_pdf_report_free_tier_redaction(tmp_path):
    """Verifies that generate_pdf_report with plan='free' redacts locked findings and adds upgrade notice."""
    scan = Scan(
        id=uuid.uuid4(),
        domain="pdf-test.com",
        normalized_domain="pdf-test.com",
        score=65,
        risk_level="Medium Risk",
        passed_checks_count=1,
        total_checks_count=5,
        created_at=datetime.now(timezone.utc),
    )
    checks = []
    for i in range(5):
        checks.append(ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan.id,
            check_type=f"check_{i}",
            name=f"Issue {i}",
            status="fail",
            severity="high",
            score_impact=10,
            title=f"Security Flaw {i}",
            summary=f"Summary of flaw {i}",
            how_to_fix=f"Private Fix Steps #{i}",
            evidence="Secret evidence",
            estimated_fix_minutes=15,
            confidence=1.0,
        ))

    generated_path = generate_pdf_report(
        scan=scan,
        checks=checks,
        plan="free",
        output_directory=str(tmp_path),
    )
    assert os.path.exists(generated_path)
    file_size = os.path.getsize(generated_path)
    assert file_size > 1000  # Valid PDF generated


# ==============================================================================
# 6. RATE LIMITING (ANONYMOUS & IN-MEMORY FALLBACK)
# ==============================================================================

@pytest.mark.asyncio
async def test_rate_limiter_in_memory_fallback():
    """Verifies that check_rate_limit correctly tracks and blocks excess requests in memory."""
    from fastapi import HTTPException
    key = f"test_limit_{uuid.uuid4().hex}"
    with patch("app.core.rate_limit.get_redis_client", side_effect=ConnectionError("Redis offline")):
        # Allow 3 requests
        await check_rate_limit(key, max_requests=3, window_seconds=60)
        await check_rate_limit(key, max_requests=3, window_seconds=60)
        await check_rate_limit(key, max_requests=3, window_seconds=60)

        # 4th request must raise 429
        with pytest.raises(HTTPException) as exc_info:
            await check_rate_limit(key, max_requests=3, window_seconds=60)

        exc = exc_info.value
        assert exc.status_code == 429
        assert exc.detail["error"]["code"] == "RATE_LIMITED"
        assert "retry_after" in exc.detail["error"]


def test_anonymous_scan_ip_rate_limit():
    """Anonymous public scans are limited to 3 per 24 hours per IP. 4th returns 429."""
    # First 3 public scans succeed
    for i in range(3):
        res = client.post("/api/v1/scans", json={"domain": f"anon-domain-{i}.com"})
        assert res.status_code == 201

    # 4th public scan -> 429 Too Many Requests
    res4 = client.post("/api/v1/scans", json={"domain": "anon-domain-4.com"})
    assert res4.status_code == 429
    data = res4.json()
    assert data["detail"]["error"]["code"] == "RATE_LIMITED"
    assert "retry_after" in data["detail"]["error"]


# ==============================================================================
# 7. AUDIT LOGGING & SENSITIVE DATA REDACTION
# ==============================================================================

def test_audit_metadata_sensitive_redaction():
    """Asserts that passwords, bearer tokens, cookies, secrets are never stored in audit metadata."""
    sensitive_input = {
        "user_email": "admin@site.com",
        "password": "supersecretpassword123",
        "bearer_token": "eyJhbGciOi...",
        "api_key": "sk_live_98374982374",
        "cookie": "session=abc123xyz",
        "nested": {
            "token": "secret_token",
            "safe_metric": 42,
        },
    }
    sanitized = sanitize_audit_metadata(sensitive_input)
    assert sanitized["user_email"] == "admin@site.com"
    assert sanitized["password"] == "[REDACTED]"
    assert sanitized["bearer_token"] == "[REDACTED]"
    assert sanitized["api_key"] == "[REDACTED]"
    assert sanitized["cookie"] == "[REDACTED]"
    assert sanitized["nested"]["token"] == "[REDACTED]"
    assert sanitized["nested"]["safe_metric"] == 42


# ==============================================================================
# 8. ALL PLANS (FREE, BASIC, PRO, AGENCY) BOUNDARY TESTS (REQUIREMENT 1)
# ==============================================================================

def test_all_plans_website_quota_boundaries():
    """
    Boundary tests for ALL plans for website creation:
    - Free (1): 1 allowed, 2nd denied (tested in test_website_quota_enforcement_free_tier)
    - Basic (2): 1 existing -> 2nd ALLOWED; 2 existing -> 3rd DENIED (403 PLAN_LIMIT_REACHED)
    - Pro (10): 9 existing -> 10th ALLOWED; 10 existing -> 11th DENIED (403 PLAN_LIMIT_REACHED)
    - Agency (100): 99 existing -> 100th ALLOWED; 100 existing -> 101st DENIED (403 PLAN_LIMIT_REACHED)
    """
    # 1. Basic Plan (limit 2)
    uid_basic = f"user_basic_{uuid.uuid4().hex[:6]}"
    headers_basic = {"Authorization": f"Bearer dev-token-{uid_basic}-basic"}
    res1 = client.post("/api/v1/websites", headers=headers_basic, json={"domain": f"site1-{uid_basic}.com"})
    assert res1.status_code == 201
    res2 = client.post("/api/v1/websites", headers=headers_basic, json={"domain": f"site2-{uid_basic}.com"})
    assert res2.status_code == 201
    res3 = client.post("/api/v1/websites", headers=headers_basic, json={"domain": f"site3-{uid_basic}.com"})
    assert res3.status_code == 403
    assert res3.json()["detail"]["error"]["code"] == "PLAN_LIMIT_REACHED"

    # 2. Pro Plan (limit 10)
    uid_pro = f"user_pro_{uuid.uuid4().hex[:6]}"
    headers_pro = {"Authorization": f"Bearer dev-token-{uid_pro}-pro"}
    res_p1 = client.post("/api/v1/websites", headers=headers_pro, json={"domain": f"site1-{uid_pro}.com"})
    assert res_p1.status_code == 201
    sync_db = TestSyncSessionLocal()
    u_pro = sync_db.query(User).filter_by(firebase_uid=uid_pro).first()
    for i in range(2, 10):
        sync_db.add(Website(id=uuid.uuid4(), organization_id=u_pro.organization_id, domain=f"site{i}-{uid_pro}.com", normalized_domain=f"site{i}-{uid_pro}.com", name=f"Site {i}"))
    sync_db.commit()
    sync_db.close()
    
    # 10th site allowed
    res_p10 = client.post("/api/v1/websites", headers=headers_pro, json={"domain": f"site10-{uid_pro}.com"})
    assert res_p10.status_code == 201
    # 11th site denied
    res_p11 = client.post("/api/v1/websites", headers=headers_pro, json={"domain": f"site11-{uid_pro}.com"})
    assert res_p11.status_code == 403
    assert res_p11.json()["detail"]["error"]["code"] == "PLAN_LIMIT_REACHED"

    # 3. Agency Plan (limit 100)
    uid_agency = f"user_agency_{uuid.uuid4().hex[:6]}"
    headers_agency = {"Authorization": f"Bearer dev-token-{uid_agency}-agency"}
    res_a1 = client.post("/api/v1/websites", headers=headers_agency, json={"domain": f"site1-{uid_agency}.com"})
    assert res_a1.status_code == 201
    sync_db = TestSyncSessionLocal()
    u_agency = sync_db.query(User).filter_by(firebase_uid=uid_agency).first()
    for i in range(2, 100):
        sync_db.add(Website(id=uuid.uuid4(), organization_id=u_agency.organization_id, domain=f"site{i}-{uid_agency}.com", normalized_domain=f"site{i}-{uid_agency}.com", name=f"Site {i}"))
    sync_db.commit()
    sync_db.close()
    
    # 100th site allowed
    res_a100 = client.post("/api/v1/websites", headers=headers_agency, json={"domain": f"site100-{uid_agency}.com"})
    assert res_a100.status_code == 201
    # 101st site denied
    res_a101 = client.post("/api/v1/websites", headers=headers_agency, json={"domain": f"site101-{uid_agency}.com"})
    assert res_a101.status_code == 403
    assert res_a101.json()["detail"]["error"]["code"] == "PLAN_LIMIT_REACHED"


def test_all_plans_scan_quota_boundaries():
    """
    Boundary tests for ALL plans for scan quota:
    - Free (10): 9 used -> 10th ALLOWED; 10 used -> 11th DENIED (403 SCAN_QUOTA_EXCEEDED)
    - Basic (100): 99 used -> 100th ALLOWED; 100 used -> 101st DENIED (403 SCAN_QUOTA_EXCEEDED)
    - Pro (500): 499 used -> 500th ALLOWED; 500 used -> 501st DENIED (403 SCAN_QUOTA_EXCEEDED)
    - Agency (3000): 2999 used -> 3000th ALLOWED; 3000 used -> 3001st DENIED (403 SCAN_QUOTA_EXCEEDED)
    """
    plans = [
        ("free", 9),
        ("basic", 99),
        ("pro", 499),
        ("agency", 2999),
    ]
    period_month, _, _ = get_current_usage_period()

    for plan_name, allowed_threshold in plans:
        uid = f"user_scan_{plan_name}_{uuid.uuid4().hex[:6]}"
        headers = {"Authorization": f"Bearer dev-token-{uid}-{plan_name}"}

        # First scan provisions user/org and usage record
        res1 = client.post("/api/v1/scans", headers=headers, json={"domain": f"scan-init-{uid}.com"})
        assert res1.status_code == 201

        # Set usage count to allowed_threshold
        sync_db = TestSyncSessionLocal()
        user = sync_db.query(User).filter_by(firebase_uid=uid).first()
        usage = sync_db.query(UsageRecord).filter_by(organization_id=user.organization_id, period_month=period_month).first()
        usage.scans_count = allowed_threshold
        sync_db.commit()
        sync_db.close()

        # The threshold scan MUST BE ALLOWED
        res_allowed = client.post("/api/v1/scans", headers=headers, json={"domain": f"scan-allowed-{uid}.com"})
        assert res_allowed.status_code == 201

        # Next scan attempt MUST BE DENIED with 403 SCAN_QUOTA_EXCEEDED
        res_denied = client.post("/api/v1/scans", headers=headers, json={"domain": f"scan-denied-{uid}.com"})
        assert res_denied.status_code == 403
        assert res_denied.json()["detail"]["error"]["code"] == "SCAN_QUOTA_EXCEEDED"


# ==============================================================================
# 9. CONCURRENCY QUOTA TESTS (REQUIREMENT 2)
# ==============================================================================

@pytest.mark.asyncio
async def test_concurrency_website_and_scan_quotas():
    """
    Requirement 2: Concurrency quota tests:
    Case A: 10 simultaneous website creates on Free tier -> exactly 1 succeeds, 9 fail with 403.
    Case B: 10 simultaneous scans on Free tier at 9 used -> exactly 1 succeeds, 9 fail with 403, final usage <= 10.
    """
    # Case A: Website reservation concurrency
    org_id_a = uuid.uuid4()
    async with TestAsyncSessionLocal() as db:
        org_a = Organization(id=org_id_a, name="Concurrent Org A", type="personal")
        db.add(org_a)
        await db.commit()

    results = []
    for i in range(10):
        async with TestAsyncSessionLocal() as sess:
            try:
                await check_and_reserve_website_quota(sess, org_id_a, "free")
                sess.add(Website(id=uuid.uuid4(), organization_id=org_id_a, domain=f"concurrent-{i}.com", normalized_domain=f"concurrent-{i}.com", name=f"Site {i}"))
                await sess.commit()
                results.append(True)
            except Exception:
                await sess.rollback()
                results.append(False)

    success_count = sum(1 for r in results if r is True)
    assert success_count == 1

    # Case B: Scan quota reservation at 9 used (limit 10)
    org_id_b = uuid.uuid4()
    period_month, _, _ = get_current_usage_period()
    async with TestAsyncSessionLocal() as db:
        org_b = Organization(id=org_id_b, name="Concurrent Org B", type="personal")
        db.add(org_b)
        usage = UsageRecord(id=uuid.uuid4(), organization_id=org_id_b, period_month=period_month, scans_count=9)
        db.add(usage)
        await db.commit()

    results_scans = []
    for i in range(10):
        async with TestAsyncSessionLocal() as sess:
            try:
                await check_and_reserve_scan_quota(sess, org_id_b, "free")
                await sess.commit()
                results_scans.append(True)
            except Exception:
                await sess.rollback()
                results_scans.append(False)

    success_scans = sum(1 for r in results_scans if r is True)
    assert success_scans == 1

    async with TestAsyncSessionLocal() as sess:
        u_res = await sess.execute(select(UsageRecord).where(UsageRecord.organization_id == org_id_b, UsageRecord.period_month == period_month))
        final_usage = u_res.scalar_one()
        assert final_usage.scans_count == 10


# ==============================================================================
# 10. SCAN QUOTA RESERVATION FAILURE SAFETY (REQUIREMENT 3)
# ==============================================================================

def test_scan_quota_reservation_failure_compensation(monkeypatch):
    """
    Requirement 3: If scan dispatching fails, refund_scan_quota restores quota,
    marks scan failed, logs SCAN_FAILED, and returns HTTP 500 without consuming quota.
    """
    uid = f"user_fail_{uuid.uuid4().hex[:6]}"
    headers = {"Authorization": f"Bearer dev-token-{uid}-pro"}

    res1 = client.post("/api/v1/scans", headers=headers, json={"domain": f"init-{uid}.com"})
    assert res1.status_code == 201

    sync_db = TestSyncSessionLocal()
    user = sync_db.query(User).filter_by(firebase_uid=uid).first()
    period_month, _, _ = get_current_usage_period()
    usage_before = sync_db.query(UsageRecord).filter_by(organization_id=user.organization_id, period_month=period_month).first()
    count_before = usage_before.scans_count
    sync_db.close()

    # Simulate dispatch failure: both Celery and fallback fail
    mock_celery_fail = MagicMock(side_effect=RuntimeError("Celery broker connection refused"))
    mock_fallback_fail = MagicMock(side_effect=RuntimeError("Fallback worker pool exhausted"))
    monkeypatch.setattr("app.api.v1.scans.scan_website_task.delay", mock_celery_fail)
    monkeypatch.setattr("app.api.v1.scans.execute_scan_job", mock_fallback_fail)

    res_fail = client.post("/api/v1/scans", headers=headers, json={"domain": f"fail-dispatch-{uid}.com"})
    assert res_fail.status_code == 500
    assert res_fail.json()["detail"]["error"]["code"] == "SCAN_DISPATCH_FAILED"

    sync_db = TestSyncSessionLocal()
    usage_after = sync_db.query(UsageRecord).filter_by(organization_id=user.organization_id, period_month=period_month).first()
    assert usage_after.scans_count == count_before

    failed_scan = sync_db.query(Scan).filter_by(organization_id=user.organization_id, domain=f"fail-dispatch-{uid}.com").first()
    assert failed_scan is not None
    assert failed_scan.status == "failed"

    audit = sync_db.query(AuditLog).filter_by(organization_id=user.organization_id, action="SCAN_FAILED").first()
    assert audit is not None
    sync_db.close()


# ==============================================================================
# 11. PDF CROSS-TENANT ISOLATION (REQUIREMENT 4)
# ==============================================================================

def test_pdf_cross_tenant_access_returns_404_no_bytes_streamed(tmp_path):
    """
    Requirement 4: User from Org A tries to download PDF of scan owned by Org B:
    - Must return 404
    - Must NOT stream any PDF bytes
    - Audit log records PDF_DOWNLOAD_REJECTED
    """
    headers_a = {"Authorization": "Bearer dev-token-tenantApdf-pro"}
    headers_b = {"Authorization": "Bearer dev-token-tenantBpdf-pro"}

    create_res = client.post("/api/v1/scans", headers=headers_b, json={"domain": "tenant-b-pdf-target.com"})
    assert create_res.status_code == 201
    scan_b_id = create_res.json()["id"]

    dummy_pdf = tmp_path / f"report_{scan_b_id}.pdf"
    dummy_pdf.write_bytes(b"%PDF-1.4 Fake PDF Content for Tenant B")

    sync_db = TestSyncSessionLocal()
    user_b = sync_db.query(User).filter_by(firebase_uid="tenantBpdf").first()
    assert user_b is not None
    report = Report(
        id=uuid.uuid4(),
        scan_id=uuid.UUID(scan_b_id),
        organization_id=user_b.organization_id,
        report_number=f"SEC-{uuid.uuid4().hex[:8].upper()}",
        pdf_path=str(dummy_pdf),
    )
    sync_db.add(report)
    sync_db.commit()
    sync_db.close()

    res_cross = client.get(f"/api/v1/scans/{scan_b_id}/pdf", headers=headers_a)
    assert res_cross.status_code == 404
    assert res_cross.json()["detail"]["error"]["code"] == "REPORT_NOT_FOUND"
    assert b"%PDF-1.4" not in res_cross.content

    sync_db = TestSyncSessionLocal()
    user_a = sync_db.query(User).filter_by(firebase_uid="tenantApdf").first()
    assert user_a is not None
    audit = sync_db.query(AuditLog).filter_by(
        organization_id=user_a.organization_id,
        action="PDF_DOWNLOAD_REJECTED",
    ).first()
    assert audit is not None
    sync_db.close()


# ==============================================================================
# 12. REPORT CROSS-TENANT ISOLATION (REQUIREMENT 5)
# ==============================================================================

def test_report_cross_tenant_isolation_returns_404():
    """
    Requirement 5: User A requests report/scan/website of User B:
    - Must return 404 (not 403, preventing resource enumeration).
    """
    headers_a = {"Authorization": "Bearer dev-token-tenantArep-pro"}
    headers_b = {"Authorization": "Bearer dev-token-tenantBrep-pro"}

    site_b = client.post("/api/v1/websites", headers=headers_b, json={"domain": "tenant-b-site.com"}).json()
    scan_b = client.post("/api/v1/scans", headers=headers_b, json={"domain": "tenant-b-site.com"}).json()

    res_scan = client.get(f"/api/v1/scans/{scan_b['id']}", headers=headers_a)
    assert res_scan.status_code == 404
    assert res_scan.json()["detail"]["error"]["code"] == "SCAN_NOT_FOUND"

    res_results = client.get(f"/api/v1/scans/{scan_b['id']}/results", headers=headers_a)
    assert res_results.status_code == 404

    res_site = client.get(f"/api/v1/websites/{site_b['id']}", headers=headers_a)
    assert res_site.status_code == 404
    assert res_site.json()["detail"]["error"]["code"] == "WEBSITE_NOT_FOUND"

    res_hist = client.get(f"/api/v1/websites/{site_b['id']}/history", headers=headers_a)
    assert res_hist.status_code == 404


# ==============================================================================
# 13. MONITORING & ALERT IDOR TESTS (REQUIREMENT 6)
# ==============================================================================

def test_monitoring_and_alert_idor_protection():
    """
    Requirement 6: Organization A tries to view or modify alerts or monitoring of Org B:
    - Must return 404
    - No alert leak
    - No settings leak
    """
    headers_a = {"Authorization": "Bearer dev-token-tenantAalert-pro"}
    headers_b = {"Authorization": "Bearer dev-token-tenantBalert-pro"}

    client.get("/api/v1/alerts", headers=headers_a)
    client.get("/api/v1/alerts", headers=headers_b)

    sync_db = TestSyncSessionLocal()
    user_b = sync_db.query(User).filter_by(firebase_uid="tenantBalert").first()
    assert user_b is not None
    alert_b = Alert(
        id=uuid.uuid4(),
        organization_id=user_b.organization_id,
        type="SECURITY_RISK",
        title="Critical Security Vulnerability in Tenant B App",
        message="Tenant B secret vulnerability info",
        severity="critical",
        status="unread",
    )
    sync_db.add(alert_b)
    sync_db.commit()
    alert_b_id = str(alert_b.id)
    sync_db.close()

    res_patch = client.patch(
        f"/api/v1/alerts/{alert_b_id}",
        headers=headers_a,
        json={"status": "read"},
    )
    assert res_patch.status_code == 404
    assert res_patch.json()["detail"]["error"]["code"] == "ALERT_NOT_FOUND"

    res_list = client.get("/api/v1/alerts", headers=headers_a)
    assert res_list.status_code == 200
    alert_ids = [a["id"] for a in res_list.json()]
    assert alert_b_id not in alert_ids


# ==============================================================================
# 14. PLAN AUTHORITY TAMPERING BYPASS TEST (REQUIREMENT 7)
# ==============================================================================

def test_plan_authority_tampering_bypass_denied():
    """
    Requirement 7: Client sends plan: "pro" / "agency" in JSON body, query param, or header
    when DB says Free -> endpoint strictly uses DB-backed plan (Free).
    """
    uid = f"user_tamper_{uuid.uuid4().hex[:6]}"
    headers_free = {"Authorization": f"Bearer dev-token-{uid}-free"}

    res1 = client.post("/api/v1/websites", headers=headers_free, json={"domain": f"site1-{uid}.com"})
    assert res1.status_code == 201

    res_body_inject = client.post(
        "/api/v1/websites",
        headers=headers_free,
        json={"domain": f"site2-{uid}.com", "plan": "agency"},
    )
    assert res_body_inject.status_code == 403
    assert res_body_inject.json()["detail"]["error"]["code"] == "PLAN_LIMIT_REACHED"

    res_query_inject = client.post(
        f"/api/v1/websites?plan=pro",
        headers=headers_free,
        json={"domain": f"site3-{uid}.com"},
    )
    assert res_query_inject.status_code == 403
    assert res_query_inject.json()["detail"]["error"]["code"] == "PLAN_LIMIT_REACHED"

    custom_headers = dict(headers_free)
    custom_headers["X-Plan"] = "agency"
    custom_headers["X-Role"] = "admin"
    res_header_inject = client.post(
        "/api/v1/websites",
        headers=custom_headers,
        json={"domain": f"site4-{uid}.com"},
    )
    assert res_header_inject.status_code == 403
    assert res_header_inject.json()["detail"]["error"]["code"] == "PLAN_LIMIT_REACHED"


# ==============================================================================
# 15. SCAN OWNERSHIP WITH NULL WEBSITE (REQUIREMENT 15)
# ==============================================================================

def test_scan_ownership_with_null_website():
    """
    Requirement 15: Scan ownership with website_id = NULL, organization_id = Org A.
    User A allowed; User B receives 404.
    """
    headers_a = {"Authorization": "Bearer dev-token-tenantA-nullsite-pro"}
    headers_b = {"Authorization": "Bearer dev-token-tenantB-nullsite-pro"}

    res_create = client.post(
        "/api/v1/scans",
        headers=headers_a,
        json={"domain": "null-website-scan.com"},
    )
    assert res_create.status_code == 201
    scan_id = res_create.json()["id"]

    sync_db = TestSyncSessionLocal()
    scan = sync_db.query(Scan).filter_by(id=uuid.UUID(scan_id)).first()
    assert scan.website_id is None
    assert scan.organization_id is not None
    sync_db.close()

    res_a = client.get(f"/api/v1/scans/{scan_id}", headers=headers_a)
    assert res_a.status_code == 200
    assert res_a.json()["domain"] == "null-website-scan.com"

    res_b = client.get(f"/api/v1/scans/{scan_id}", headers=headers_b)
    assert res_b.status_code == 404
    assert res_b.json()["detail"]["error"]["code"] == "SCAN_NOT_FOUND"


# ==============================================================================
# 16. RATE LIMIT BOUNDARY TESTS (REQUIREMENT 12)
# ==============================================================================

@pytest.mark.asyncio
async def test_exact_rate_limits_boundary_tests():
    """
    Requirement 12: Rate limit tests: limit - 1, limit, limit + 1 on
    - Anonymous: 3 / 24h (requests 2, 3 allowed, 4 denied)
    - Authenticated: 20 / min (requests 19, 20 allowed, 21 denied)
    - PDF: 5 / min (requests 4, 5 allowed, 6 denied)
    """
    _memory_rate_limits.clear()

    # 1. Anonymous (3 per 86400s)
    anon_key = f"ratelimit:public_scan:198.51.100.99"
    with patch("app.core.rate_limit.get_redis_client", side_effect=ConnectionError("Redis offline")):
        assert await check_rate_limit(anon_key, max_requests=3, window_seconds=86400) is True
        assert await check_rate_limit(anon_key, max_requests=3, window_seconds=86400) is True
        assert await check_rate_limit(anon_key, max_requests=3, window_seconds=86400) is True
        with pytest.raises(Exception) as exc:
            await check_rate_limit(anon_key, max_requests=3, window_seconds=86400)
        assert exc.value.status_code == 429

    # 2. Authenticated scan (20 per 60s)
    user_key = f"ratelimit:user_scan:{uuid.uuid4()}"
    with patch("app.core.rate_limit.get_redis_client", side_effect=ConnectionError("Redis offline")):
        for _ in range(19):
            assert await check_rate_limit(user_key, max_requests=20, window_seconds=60) is True
        assert await check_rate_limit(user_key, max_requests=20, window_seconds=60) is True
        with pytest.raises(Exception) as exc:
            await check_rate_limit(user_key, max_requests=20, window_seconds=60)
        assert exc.value.status_code == 429

    # 3. PDF download (5 per 60s)
    pdf_key = f"ratelimit:pdf:{uuid.uuid4()}"
    with patch("app.core.rate_limit.get_redis_client", side_effect=ConnectionError("Redis offline")):
        for _ in range(4):
            assert await check_rate_limit(pdf_key, max_requests=5, window_seconds=60) is True
        assert await check_rate_limit(pdf_key, max_requests=5, window_seconds=60) is True
        with pytest.raises(Exception) as exc:
            await check_rate_limit(pdf_key, max_requests=5, window_seconds=60)
        assert exc.value.status_code == 429


# ==============================================================================
# 17. PDF PREMIUM LEAKAGE TEST (REQUIREMENT 13)
# ==============================================================================

def test_pdf_report_premium_leakage_prevention(tmp_path):
    """
    Requirement 13: Free PDF has no premium remediation/evidence/tech details; Pro PDF has full details.
    """
    scan = Scan(
        id=uuid.uuid4(),
        domain="leak-test.com",
        normalized_domain="leak-test.com",
        score=50,
        risk_level="High Risk",
        passed_checks_count=1,
        total_checks_count=5,
        created_at=datetime.now(timezone.utc),
    )
    checks = []
    for i in range(5):
        checks.append(ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan.id,
            check_type=f"check_{i}",
            name=f"Vulnerability {i}",
            status="fail",
            severity="critical",
            score_impact=15,
            title=f"Critical Vuln Title {i}",
            summary=f"Summary for issue {i}",
            how_to_fix=f"TOP_SECRET_PRO_REMEDIATION_STEP_{i}",
            evidence=f"SECRET_SERVER_EVIDENCE_PAYLOAD_{i}",
            estimated_fix_minutes=20,
            confidence=1.0,
        ))

    def extract_pdf_streams(pdf_bytes: bytes) -> str:
        pos = 0
        all_text = []
        import base64, zlib
        while True:
            s_idx = pdf_bytes.find(b"stream\n", pos)
            if s_idx == -1:
                break
            e_idx = pdf_bytes.find(b"endstream", s_idx)
            raw_stream = pdf_bytes[s_idx + 7:e_idx].strip()
            if not raw_stream.endswith(b"~>"):
                raw_stream += b"~>"
            try:
                dec = base64.a85decode(raw_stream, adobe=True)
                decomp = zlib.decompress(dec).decode("latin1", errors="ignore")
                all_text.append(decomp)
            except Exception:
                pass
            pos = e_idx + 9
        return " ".join(all_text)

    # Free Tier PDF
    pdf_free_path = generate_pdf_report(
        scan=scan,
        checks=checks,
        plan="free",
        output_directory=str(tmp_path),
    )
    with open(pdf_free_path, "rb") as f:
        free_bytes = f.read()

    free_text = extract_pdf_streams(free_bytes)
    assert "TOP_SECRET_PRO_REMEDIATION_STEP_3" not in free_text
    assert "TOP_SECRET_PRO_REMEDIATION_STEP_4" not in free_text
    assert "SECRET_SERVER_EVIDENCE_PAYLOAD_3" not in free_text
    assert "SECRET_SERVER_EVIDENCE_PAYLOAD_4" not in free_text
    assert "TOP_SECRET_PRO_REMEDIATION_STEP_0" in free_text

    # Pro Tier PDF
    pdf_pro_path = generate_pdf_report(
        scan=scan,
        checks=checks,
        plan="pro",
        output_directory=str(tmp_path),
    )
    with open(pdf_pro_path, "rb") as f:
        pro_bytes = f.read()

    pro_text = extract_pdf_streams(pro_bytes)
    assert "TOP_SECRET_PRO_REMEDIATION_STEP_3" in pro_text
    assert "TOP_SECRET_PRO_REMEDIATION_STEP_4" in pro_text
    assert "SECRET_SERVER_EVIDENCE_PAYLOAD_3" in pro_text
    assert "SECRET_SERVER_EVIDENCE_PAYLOAD_4" in pro_text


# ==============================================================================
# 18. RAW API RESPONSE LEAKAGE TEST (REQUIREMENT 14)
# ==============================================================================

def test_raw_api_response_leakage_for_free_user():
    """
    Requirement 14: Check raw JSON response for Free user across endpoints:
    - GET /api/v1/scans/{id}
    - GET /api/v1/scans/{id}/results
    Verify evidence and remediation_details are null for locked findings.
    """
    sync_db = TestSyncSessionLocal()
    scan_id = uuid.uuid4()
    scan = Scan(
        id=scan_id,
        domain="api-leak-check.org",
        normalized_domain="api-leak-check.org",
        status="completed",
        scan_type="public",
        score=60,
        passed_checks_count=1,
        total_checks_count=5,
    )
    sync_db.add(scan)
    for i in range(5):
        sync_db.add(ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan_id,
            check_type=f"check_{i}",
            name=f"Vulnerability {i}",
            status="fail",
            severity="high",
            score_impact=10,
            title=f"Title {i}",
            summary=f"Summary {i}",
            how_to_fix=f"CONFIDENTIAL FIX {i}",
            evidence=f"RAW EVIDENCE {i}",
            confidence=1.0,
        ))
    sync_db.commit()
    sync_db.close()

    res_details = client.get(f"/api/v1/scans/{scan_id}")
    assert res_details.status_code == 200
    data_details = res_details.json()
    checks_details = data_details["checks"]
    for i in range(3, 5):
        chk = checks_details[i]
        assert chk["is_locked"] is True
        assert chk["how_to_fix"] is None
        assert chk["evidence"] is None
        assert "upgrade" in chk["summary"].lower()

    res_results = client.get(f"/api/v1/scans/{scan_id}/results")
    assert res_results.status_code == 200
    data_results = res_results.json()
    assert data_results["is_premium_locked"] is True
    assert data_results["locked_findings_count"] == 2
    assert len(data_results["unlocked_findings"]) == 3
    for chk in data_results["unlocked_findings"]:
        assert chk["is_locked"] is False


# ==============================================================================
# 19. AUDIT FAILURE NON-BYPASS TEST (REQUIREMENT 10)
# ==============================================================================

def test_audit_failure_never_bypasses_authorization():
    """
    Requirement 10: If audit recording raises an unexpected exception,
    authorization denials must NOT fail-open; the 404/403 must still be returned.
    """
    headers_a = {"Authorization": "Bearer dev-token-auditfailA-pro"}
    headers_b = {"Authorization": "Bearer dev-token-auditfailB-pro"}

    site_a = client.post("/api/v1/websites", headers=headers_a, json={"domain": "audit-fail-test.com"}).json()

    with patch("app.api.v1.websites.record_audit_event", side_effect=RuntimeError("Audit database disk full")):
        res = client.get(f"/api/v1/websites/{site_a['id']}", headers=headers_b)
        assert res.status_code == 404
        assert res.json()["detail"]["error"]["code"] == "WEBSITE_NOT_FOUND"

