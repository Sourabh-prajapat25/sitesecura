"""
SiteSecura - Platform-Wide Production Readiness Audit Test Suite
Verifies:
1. Authentication Security (unauthenticated 401, malformed token 401)
2. Multi-Tenant Isolation (404 anti-enumeration strategy for websites, scans, reports, alerts)
3. Admin Privilege Escalation Prevention (regular user access to admin endpoints forbidden)
4. Plan Entitlements & Server-Side Enforcement (Free vs Pro limits, feature gates)
5. Quota Accounting & Atomic Reservation (Deep scan consumes 1 credit, refund on dispatch failure)
6. SSRF Prevention & Domain Validation
7. Defensive HTTP Security Headers
8. Error Response Sanitization
"""
import os
import sys
import uuid
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

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
from app.models.alert import Alert, AuditLog
from app.core.config import settings
from app.core.rate_limit import _memory_rate_limits
from app.services.entitlement_service import get_current_usage_period
from scanner.domain import normalize_domain, SSRFValidationError

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_audit_readiness.sqlite3"))
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


@pytest.fixture(scope="module", autouse=True)
def setup_audit_test_db():
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass

    Base.metadata.create_all(bind=test_sync_engine)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_sync_db] = override_get_sync_db
    session_module.get_sync_db = override_get_sync_db

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_sync_db, None)
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
def reset_mocks(monkeypatch):
    mock_task = MagicMock()
    monkeypatch.setattr("app.api.v1.scans.scan_website_task", mock_task)
    monkeypatch.setattr("app.api.v1.scans.execute_scan_job", MagicMock())
    monkeypatch.setattr("app.api.v1.websites.scan_website_task", mock_task)
    monkeypatch.setattr("app.api.v1.websites.deep_scan_website_task", mock_task)
    monkeypatch.setattr("app.api.v1.websites.execute_deep_scan_job", MagicMock())
    _memory_rate_limits.clear()


client = TestClient(app)


# ==============================================================================
# 1. AUTHENTICATION & ACCESS CONTROL
# ==============================================================================

def test_unauthenticated_requests_rejected_with_401():
    """Protected routes must strictly return 401 when Authorization header is absent."""
    protected_endpoints = [
        ("GET", "/api/v1/auth/me"),
        ("GET", "/api/v1/websites"),
        ("POST", "/api/v1/websites"),
        ("GET", "/api/v1/admin/metrics"),
        ("GET", "/api/v1/alerts"),
        ("GET", "/api/v1/billing"),
        ("GET", "/api/v1/agency/members"),
    ]
    for method, path in protected_endpoints:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path, json={})
        assert res.status_code == 401, f"{method} {path} returned {res.status_code} instead of 401"
        data = res.json()
        assert "error" in data["detail"]
        assert data["detail"]["error"]["code"] == "AUTHENTICATION_REQUIRED"


def test_malformed_token_rejected_with_401():
    """Requests with malformed tokens must return 401."""
    headers = {"Authorization": "Bearer invalid_gibberish_token"}
    res = client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 401
    assert res.json()["detail"]["error"]["code"] in ("AUTHENTICATION_REQUIRED", "INVALID_AUTH_TOKEN")


# ==============================================================================
# 2. MULTI-TENANT ISOLATION & IDOR DEFENSE (404 STRATEGY)
# ==============================================================================

def test_cross_tenant_website_access_returns_404():
    """User from Org A cannot read, edit, or delete websites belonging to Org B."""
    headers_a = {"Authorization": "Bearer dev-token-auditUserA-pro"}
    headers_b = {"Authorization": "Bearer dev-token-auditUserB-pro"}

    create_res = client.post(
        "/api/v1/websites",
        headers=headers_a,
        json={"domain": "audit-tenant-a.com", "name": "Org A Confidential Site"},
    )
    assert create_res.status_code == 201
    site_a_id = create_res.json()["id"]

    # Org B attempts GET -> 404
    get_res = client.get(f"/api/v1/websites/{site_a_id}", headers=headers_b)
    assert get_res.status_code == 404
    assert get_res.json()["detail"]["error"]["code"] == "WEBSITE_NOT_FOUND"

    # Org B attempts PATCH -> 404
    patch_res = client.patch(f"/api/v1/websites/{site_a_id}", headers=headers_b, json={"name": "Hacked"})
    assert patch_res.status_code == 404

    # Org B attempts DELETE -> 404
    del_res = client.delete(f"/api/v1/websites/{site_a_id}", headers=headers_b)
    assert del_res.status_code == 404


def test_cross_tenant_scan_and_pdf_access_returns_404():
    """User from Org B cannot read scan findings or download PDF report from Org A."""
    headers_a = {"Authorization": "Bearer dev-token-auditScanA-pro"}
    headers_b = {"Authorization": "Bearer dev-token-auditScanB-pro"}

    scan_res = client.post("/api/v1/scans", headers=headers_a, json={"domain": "scan-tenant-a.com"})
    assert scan_res.status_code == 201
    scan_id = scan_res.json()["id"]

    # Org B attempts to read scan details -> 404
    detail_res = client.get(f"/api/v1/scans/{scan_id}", headers=headers_b)
    assert detail_res.status_code == 404
    assert detail_res.json()["detail"]["error"]["code"] == "SCAN_NOT_FOUND"

    # Org B attempts to download PDF -> 404
    pdf_res = client.get(f"/api/v1/scans/{scan_id}/pdf", headers=headers_b)
    assert pdf_res.status_code == 404


# ==============================================================================
# 3. ADMIN PRIVILEGE ESCALATION PREVENTION
# ==============================================================================

def test_admin_privilege_escalation_blocked():
    """Regular user cannot access admin endpoints."""
    headers_regular = {"Authorization": "Bearer dev-token-regularUser-free"}
    admin_endpoints = [
        "/api/v1/admin/metrics",
        "/api/v1/admin/dashboard",
        "/api/v1/admin/users",
        "/api/v1/admin/system/health",
    ]
    for endpoint in admin_endpoints:
        res = client.get(endpoint, headers=headers_regular)
        assert res.status_code == 403, f"{endpoint} allowed regular user!"
        assert res.json()["detail"]["error"]["code"] == "ADMIN_ACCESS_REQUIRED"


def test_admin_user_can_access_admin_endpoints():
    """Platform administrator with role 'admin' can access admin endpoints."""
    headers_admin = {"Authorization": "Bearer dev-token-adminAuditor-admin"}
    res = client.get("/api/v1/admin/metrics", headers=headers_admin)
    assert res.status_code == 200
    assert "total_users" in res.json()


# ==============================================================================
# 4. PLAN ENTITLEMENTS & FEATURE GATES
# ==============================================================================

def test_free_user_cannot_exceed_website_limit():
    """Free tier permits maximum 1 website; 2nd website creation is rejected with 403."""
    headers = {"Authorization": "Bearer dev-token-freeQuotaUser-free"}

    # 1st website -> Allowed
    res1 = client.post("/api/v1/websites", headers=headers, json={"domain": "free-quota-1.com"})
    assert res1.status_code == 201

    # 2nd website -> 403 PLAN_LIMIT_REACHED
    res2 = client.post("/api/v1/websites", headers=headers, json={"domain": "free-quota-2.com"})
    assert res2.status_code == 403
    assert res2.json()["detail"]["error"]["code"] == "PLAN_LIMIT_REACHED"


def test_free_user_cannot_trigger_deep_scan():
    """Deep scan is restricted to Pro, Agency, Admin; Free tier receives 403."""
    headers = {"Authorization": "Bearer dev-token-freeDeepUser-free"}
    res_site = client.post("/api/v1/websites", headers=headers, json={"domain": "free-deep-test.com"})
    assert res_site.status_code == 201
    site_id = res_site.json()["id"]

    res_deep = client.post(f"/api/v1/websites/{site_id}/deep-scan", headers=headers)
    assert res_deep.status_code == 403
    assert res_deep.json()["detail"]["error"]["code"] == "DEEP_SCAN_FEATURE_REQUIRED"


def test_pro_user_can_trigger_deep_scan_and_consumes_one_credit():
    """Pro user can trigger Deep Scan, which consumes exactly 1 scan credit."""
    headers = {"Authorization": "Bearer dev-token-proDeepUser-pro"}
    res_site = client.post("/api/v1/websites", headers=headers, json={"domain": "pro-deep-test.com"})
    assert res_site.status_code == 201
    site_id = res_site.json()["id"]

    # Initial scan usage
    sync_db = TestSyncSessionLocal()
    user = sync_db.query(User).filter_by(firebase_uid="proDeepUser").first()
    period_month, _, _ = get_current_usage_period()
    usage_init = sync_db.query(UsageRecord).filter_by(organization_id=user.organization_id, period_month=period_month).first()
    count_before = usage_init.scans_count if usage_init else 0
    sync_db.close()

    res_deep = client.post(f"/api/v1/websites/{site_id}/deep-scan", headers=headers)
    assert res_deep.status_code == 201
    assert res_deep.json()["scan_type"] == "deep"

    # Verify exactly 1 credit was consumed
    sync_db = TestSyncSessionLocal()
    usage_after = sync_db.query(UsageRecord).filter_by(organization_id=user.organization_id, period_month=period_month).first()
    assert usage_after is not None
    assert usage_after.scans_count == count_before + 1
    sync_db.close()


# ==============================================================================
# 5. DEFENSIVE HTTP SECURITY HEADERS
# ==============================================================================

def test_defensive_security_headers_present():
    """FastAPI responses must include defensive security headers."""
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "accelerometer=" in res.headers.get("Permissions-Policy", "")


# ==============================================================================
# 6. ERROR RESPONSE SANITIZATION
# ==============================================================================

def test_readiness_endpoint_sanitizes_errors():
    """Readiness probe returns status structure without leaking stack traces."""
    res = client.get("/api/v1/ready")
    assert res.status_code == 200
    body = res.json()
    assert "status" in body
    assert "database" in body
    assert "password=" not in str(body).lower()
    assert "traceback" not in str(body).lower()


# ==============================================================================
# 7. SSRF PREVENTION REGRESSION
# ==============================================================================

def test_ssrf_domain_normalization_blocks_loopback_and_metadata():
    """SSRF targets such as localhost and 127.0.0.1 must be rejected by normalize_domain."""
    blocked_domains = [
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "http://localhost",
        "http://127.0.0.1",
        "http://169.254.169.254",
    ]
    for d in blocked_domains:
        with pytest.raises(SSRFValidationError):
            normalize_domain(d)
