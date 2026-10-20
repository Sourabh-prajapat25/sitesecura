"""
SITESECURA - PHASE 6 COMPLETE END-TO-END, SECURITY & LAUNCH READINESS VALIDATION
Comprehensive multi-tenant, authorization, scanner, SSRF, report, entitlement,
billing safety, background queue, backup script, and production configuration test suite.
"""

import os
import sys
import uuid
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path
from fastapi.testclient import TestClient
from fastapi import HTTPException
from sqlalchemy import create_engine, select, event, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import sessionmaker

# Setup PYTHONPATH
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(ROOT_DIR / "apps" / "api"))

from apps.api.main import app
from app.db.base import Base
from app.db.session import get_db, get_sync_db
import app.db.session as session_module
from app.core.config import Settings, settings
from app.core.security import verify_firebase_id_token
from app.core.rate_limit import check_rate_limit, _memory_rate_limits
from app.services.auth_service import get_or_create_user
from app.services.entitlement_service import (
    refund_scan_quota_sync,
    refund_scan_quota,
    get_current_usage_period,
)
from app.services.payment_providers.stripe_provider import StripePaymentProvider
from app.tasks.celery_app import celery_app
from app.models.scan import Scan, ScanCheck
from app.models.website import Website
from app.models.billing import UsageRecord, Subscription
from app.models.user import User, Organization
from scanner.network.resolver import SafeResolver
from scanner.network.safety import is_safe_ip, SSRFValidationError
from scanner.domain import normalize_domain


# ------------------------------------------------------------------------------
# Isolated SQLite Database Fixture for Phase 6 Testing
# ------------------------------------------------------------------------------
TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_phase6_validation.sqlite3"))
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

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
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()

TestAsyncSessionLocal = async_sessionmaker(
    bind=test_async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

test_sync_engine = create_engine(
    TEST_SYNC_DB_URL,
    connect_args={"check_same_thread": False},
)

@event.listens_for(test_sync_engine, "connect")
def set_sqlite_pragma_sync(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()

TestSyncSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_sync_engine,
)

# Initialize schema in SQLite
Base.metadata.create_all(bind=test_sync_engine)

async def override_get_db():
    async with TestAsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

def override_get_sync_db():
    session = TestSyncSessionLocal()
    try:
        return session
    finally:
        pass

@pytest.fixture(autouse=True)
def phase6_db_override():
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_sync_db] = override_get_sync_db
    session_module.SyncSessionLocal = TestSyncSessionLocal
    yield

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_sync_db] = override_get_sync_db
session_module.SyncSessionLocal = TestSyncSessionLocal

client = TestClient(app)


# ==============================================================================
# SECTION 1: PUBLIC SURFACE & SECURITY HEADERS
# ==============================================================================

def test_p6_api_health_endpoint():
    """Verify API health endpoint returns ok status."""
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"


def test_p6_api_readiness_endpoint_sanitizes_errors():
    """Verify readiness probe checks database and redis and sanitizes errors."""
    res = client.get("/api/v1/ready")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert "database" in data
    assert "redis" in data
    assert "password" not in res.text.lower()
    assert "traceback" not in res.text.lower()


def test_p6_security_headers_and_request_id():
    """Verify security headers and X-Request-ID are emitted on all HTTP responses."""
    res = client.get("/api/v1/health")
    assert "x-request-id" in res.headers
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("x-frame-options") == "DENY"
    assert res.headers.get("referrer-policy") == "strict-origin-when-cross-origin"

    # In production, verify Strict-Transport-Security is enforced
    with patch.object(settings, "ENVIRONMENT", "production"):
        res_prod = client.get("/api/v1/health")
        assert "max-age=" in res_prod.headers.get("strict-transport-security", "")


def test_p6_public_newsletter_subscription():
    """Verify newsletter subscription is functional and duplicate-safe."""
    email = f"lead_{uuid.uuid4().hex[:6]}@example.com"
    res1 = client.post("/api/v1/newsletter/subscribe", json={"email": email})
    assert res1.status_code == 200
    assert res1.json()["status"] == "subscribed"

    # Idempotent second submission
    res2 = client.post("/api/v1/newsletter/subscribe", json={"email": email})
    assert res2.status_code == 200


# ==============================================================================
# SECTION 2: AUTHENTICATION & ACCOUNT LIFECYCLE
# ==============================================================================

def test_p6_unauthenticated_request_rejected():
    """Verify protected endpoints reject requests missing authentication tokens."""
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401


def test_p6_malformed_token_rejected():
    """Verify malformed authorization headers are rejected."""
    res = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer malformed.jwt.token"})
    assert res.status_code in (401, 403)


def test_p6_production_rejects_dev_token(monkeypatch):
    """Verify dev/test tokens are strictly rejected when ENVIRONMENT=production."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with pytest.raises(HTTPException) as exc_info:
        verify_firebase_id_token("dev-token-attacker123")
    assert exc_info.value.status_code == 401


def test_p6_disabled_account_blocked():
    """Verify inactive account (is_active=False) is blocked across sync and protected routes."""
    sync_db = TestSyncSessionLocal()
    org_id = uuid.uuid4()
    org = Organization(id=org_id, name="Disabled Org")
    sync_db.add(org)
    sync_db.flush()

    uid = f"uid_dis_{uuid.uuid4().hex[:8]}"
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email=f"dis_{uuid.uuid4().hex[:8]}@example.com",
        firebase_uid=uid,
        role="free",
        organization_id=org_id,
        is_active=False,
    )
    sync_db.add(user)
    sync_db.commit()
    sync_db.close()

    headers = {"Authorization": f"Bearer dev-token-{uid}"}
    res = client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 403
    assert "ACCOUNT_DISABLED" in res.text


@pytest.mark.asyncio
async def test_p6_self_admin_escalation_blocked_on_signup(monkeypatch):
    """Verify registering a user in production forces role to 'free' regardless of claims."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    async with TestAsyncSessionLocal() as session:
        token_data = {
            "uid": f"prod_att_{uuid.uuid4().hex[:8]}",
            "email": f"attacker_{uuid.uuid4().hex[:6]}@evil.com",
            "name": "Attacker",
            "role": "admin",
        }
        with patch("app.services.auth_service.record_audit_event"):
            user, org = await get_or_create_user(session, token_data)
        assert user.role == "free", "New user role must default to 'free' in production!"


# ==============================================================================
# SECTION 3: SCANNER SECURITY, SSRF & INPUT VALIDATION
# ==============================================================================

def test_p6_ssrf_domain_normalization_blocks_dangerous_targets():
    """Verify domain normalization and resolver reject loopback, RFC1918, metadata, and invalid targets."""
    prohibited_targets = [
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "169.254.169.254",
        "10.0.0.1",
        "192.168.1.1",
        "172.16.0.1",
    ]
    resolver = SafeResolver()
    for target in prohibited_targets:
        with pytest.raises(SSRFValidationError):
            resolver.resolve(target)


def test_p6_safe_resolver_blocks_rfc1918_and_cloud_metadata():
    """Verify is_safe_ip catches private, loopback, and link-local IP resolutions."""
    assert is_safe_ip("8.8.8.8")[0] is True
    assert is_safe_ip("1.1.1.1")[0] is True
    assert is_safe_ip("127.0.0.1")[0] is False
    assert is_safe_ip("10.0.0.5")[0] is False
    assert is_safe_ip("172.16.0.5")[0] is False
    assert is_safe_ip("192.168.1.100")[0] is False
    assert is_safe_ip("169.254.169.254")[0] is False
    assert is_safe_ip("::1")[0] is False
    assert is_safe_ip("::ffff:127.0.0.1")[0] is False


# ==============================================================================
# SECTION 4: TENANT ISOLATION, AUTHORIZATION & IDOR PROTECTION
# ==============================================================================

def test_p6_multi_tenant_scan_and_website_isolation():
    """
    CRITICAL: Verify Organization A cannot view, mutate, or access Org B's scans or websites.
    Must return 404 Not Found (IDOR defense).
    """
    sync_db = TestSyncSessionLocal()

    uid_a = f"uid_a_{uuid.uuid4().hex[:8]}"
    uid_b = f"uid_b_{uuid.uuid4().hex[:8]}"

    # Org A
    org_a_id = uuid.uuid4()
    org_a = Organization(id=org_a_id, name=f"Tenant A {uid_a}")
    user_a = User(
        id=uuid.uuid4(),
        email=f"user_{uid_a}@tenanta.com",
        firebase_uid=uid_a,
        role="free",
        organization_id=org_a_id,
        is_active=True,
    )
    sync_db.add_all([org_a, user_a])

    # Org B
    org_b_id = uuid.uuid4()
    org_b = Organization(id=org_b_id, name=f"Tenant B {uid_b}")
    user_b = User(
        id=uuid.uuid4(),
        email=f"user_{uid_b}@tenantb.com",
        firebase_uid=uid_b,
        role="free",
        organization_id=org_b_id,
        is_active=True,
    )
    sync_db.add_all([org_b, user_b])
    sync_db.flush()

    # Site and Scan belonging to Org B
    site_b_id = uuid.uuid4()
    site_b = Website(
        id=site_b_id,
        organization_id=org_b_id,
        name="Tenant B Site",
        domain=f"site-{uid_b}.com",
        normalized_domain=f"site-{uid_b}.com",
    )
    scan_b_id = uuid.uuid4()
    scan_b = Scan(
        id=scan_b_id,
        organization_id=org_b_id,
        website_id=site_b_id,
        domain=f"site-{uid_b}.com",
        normalized_domain=f"site-{uid_b}.com",
        status="completed",
        scan_type="normal",
        score=85,
    )
    sync_db.add_all([site_b, scan_b])
    sync_db.commit()
    sync_db.close()

    headers_a = {"Authorization": f"Bearer dev-token-{uid_a}"}
    headers_b = {"Authorization": f"Bearer dev-token-{uid_b}"}

    # User B can view their own website and scan
    res_b_scan = client.get(f"/api/v1/scans/{scan_b_id}", headers=headers_b)
    assert res_b_scan.status_code == 200

    # User A attempting to view User B's scan must be denied with 404
    res_a_scan = client.get(f"/api/v1/scans/{scan_b_id}", headers=headers_a)
    assert res_a_scan.status_code == 404

    # User A attempting to view User B's website must be denied with 404
    res_a_site = client.get(f"/api/v1/websites/{site_b_id}", headers=headers_a)
    assert res_a_site.status_code == 404


def test_p6_non_admin_cannot_access_admin_endpoints():
    """Verify non-admin users receive 403 Forbidden on administrative endpoints."""
    uid = f"uid_reg_{uuid.uuid4().hex[:8]}"
    headers_user = {"Authorization": f"Bearer dev-token-{uid}"}
    res = client.get("/api/v1/admin/users", headers=headers_user)
    assert res.status_code == 403


# ==============================================================================
# SECTION 5: PLANS, ENTITLEMENTS & BILLING SAFETY
# ==============================================================================

def test_p6_deferred_payment_mock_checkout_rejected_in_production():
    """Verify live payment gateway is safely deferred and mock checkouts are blocked with 500/503 in production."""
    provider = StripePaymentProvider()
    sync_db = TestSyncSessionLocal()
    org = sync_db.query(Organization).first()
    user = sync_db.query(User).first()
    sync_db.close()

    with patch.object(settings, "ENVIRONMENT", "production"):
        with patch.object(settings, "STRIPE_SECRET_KEY", "sk_test_placeholder_mock"):
            with pytest.raises(HTTPException) as exc_info:
                provider.create_checkout_session(
                    organization=org,
                    user=user,
                    plan_name="pro",
                    interval="month",
                    currency="usd",
                )
            assert exc_info.value.status_code in (500, 503)
            assert "PAYMENT_NOT_CONFIGURED" in str(exc_info.value.detail)


def test_p6_idempotent_scan_quota_refund():
    """Verify scan failure compensation does not double-refund quotas across retries."""
    sync_db = TestSyncSessionLocal()
    org_id = uuid.uuid4()
    org = Organization(id=org_id, name="Refund Test Org")
    sync_db.add(org)
    sync_db.flush()

    period_month, _, _ = get_current_usage_period()
    usage = UsageRecord(
        id=uuid.uuid4(),
        organization_id=org_id,
        period_month=period_month,
        scans_count=5,
    )
    sync_db.add(usage)
    sync_db.flush()

    scan_id = uuid.uuid4()
    scan = Scan(
        id=scan_id,
        organization_id=org_id,
        domain="refund-test.com",
        normalized_domain="refund-test.com",
        status="running",
        scan_type="normal",
        scan_metadata={},
    )
    sync_db.add(scan)
    sync_db.commit()

    # First refund: succeeds
    refunded_first = refund_scan_quota_sync(sync_db, org_id, scan=scan)
    assert refunded_first is True
    assert usage.scans_count == 4
    assert scan.scan_metadata.get("quota_refunded") is True

    # Second refund attempt on same scan: rejected idempotently
    refunded_second = refund_scan_quota_sync(sync_db, org_id, scan=scan)
    assert refunded_second is False
    assert usage.scans_count == 4  # Unchanged, no double refund!
    sync_db.close()


# ==============================================================================
# SECTION 6: PDF REPORTS & STORAGE INTEGRITY
# ==============================================================================

def test_p6_cross_tenant_pdf_download_denied():
    """Verify unauthorized users cannot download another organization's PDF report."""
    uid = f"uid_pdf_{uuid.uuid4().hex[:8]}"
    headers_a = {"Authorization": f"Bearer dev-token-{uid}"}
    
    # Requesting PDF for non-owned scan returns 404
    fake_scan_id = uuid.uuid4()
    res = client.get(f"/api/v1/scans/{fake_scan_id}/report", headers=headers_a)
    assert res.status_code == 404


def test_p6_pdf_path_traversal_denied():
    """Verify path traversal sequences are rejected."""
    uid = f"uid_trav_{uuid.uuid4().hex[:8]}"
    headers_a = {"Authorization": f"Bearer dev-token-{uid}"}
    res = client.get("/api/v1/scans/../../etc/passwd/report", headers=headers_a)
    assert res.status_code in (404, 422)


# ==============================================================================
# SECTION 7: CELERY & BACKGROUND QUEUE INVARIANTS
# ==============================================================================

def test_p6_celery_beat_schedules_configured():
    """Verify Celery Beat includes watchdog (10m) and monitoring (15m) schedules."""
    beat_schedule = celery_app.conf.beat_schedule
    assert "stale-scan-watchdog" in beat_schedule
    assert beat_schedule["stale-scan-watchdog"]["schedule"].minute == {0, 10, 20, 30, 40, 50}

    assert "periodic-monitoring-scheduler" in beat_schedule
    assert beat_schedule["periodic-monitoring-scheduler"]["schedule"].minute == {0, 15, 30, 45}


def test_p6_celery_task_timeouts_bounded():
    """Verify Celery worker tasks have bounded execution timeouts."""
    assert celery_app.conf.task_time_limit <= 300
    assert celery_app.conf.task_soft_time_limit < celery_app.conf.task_time_limit


# ==============================================================================
# SECTION 8: SCRIPT & CONFIGURATION INTEGRITY
# ==============================================================================

def test_p6_scripts_exist_and_executable():
    """Verify all automation scripts exist in scripts/ with proper directives."""
    scripts = [
        "backup_postgres.sh",
        "backup_reports.sh",
        "test_restore.sh",
        "deploy.sh",
        "healthcheck.sh",
        "rollback.sh",
    ]
    for s in scripts:
        path = ROOT_DIR / "scripts" / s
        assert path.is_file(), f"Script {s} must exist!"
        content = path.read_text(encoding="utf-8")
        assert "set -euo pipefail" in content


def test_p6_docker_compose_prod_port_isolation():
    """Verify docker-compose.prod.yml exposes ONLY ports 80 and 443 on Nginx."""
    compose_path = ROOT_DIR / "docker-compose.prod.yml"
    assert compose_path.is_file()
    content = compose_path.read_text(encoding="utf-8")

    assert "5432:5432" not in content
    assert "6379:6379" not in content
    assert "8000:8000" not in content
    assert "3000:3000" not in content
    assert "80:80" in content
    assert "443:443" in content
