"""
SiteSecura - Phase 4 Production Readiness Verification Test Suite
Verifies:
1. Production Configuration & Fail-Fast Validation (Settings)
2. Production CORS Restriction & Loopback Stripping
3. Firebase Auth Token Verification, Disabled User Rejection & Self-Admin Prevention
4. Quota Accounting Idempotency & Double-Refund Protection
5. Redis Rate Limiting Production Behavior & Fail-Safe Modes
6. Outgoing Email / SMTP Failure Isolation
7. Billing Gateway Safety & Deferred Payment Security
8. Security Headers & Request Correlation Identification
"""
import os
import sys
import uuid
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from fastapi import HTTPException
from sqlalchemy import create_engine, select, event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import sessionmaker

# Ensure apps/api and root are in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

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
from app.services.email_service import send_email
from app.models.scan import Scan
from app.models.billing import UsageRecord, Subscription
from app.models.user import User, Organization


TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_phase4_readiness.sqlite3"))
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
    autocommit=False,
    autoflush=False,
)

test_sync_engine = create_engine(
    TEST_SYNC_DB_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

@event.listens_for(test_sync_engine, "connect")
def set_sqlite_pragma_sync(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()

TestSyncSessionLocal = sessionmaker(
    bind=test_sync_engine,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture(scope="module", autouse=True)
def setup_phase4_test_db():
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass

    Base.metadata.create_all(bind=test_sync_engine)

    async def override_get_db():
        async with TestAsyncSessionLocal() as session:
            yield session

    def override_get_sync_db():
        return TestSyncSessionLocal()

    import app.api.v1.billing as billing_module
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_sync_db] = override_get_sync_db
    session_module.AsyncSessionLocal = TestAsyncSessionLocal
    session_module.SyncSessionLocal = TestSyncSessionLocal
    session_module.get_sync_db = override_get_sync_db
    billing_module.get_sync_db = override_get_sync_db

    yield

    app.dependency_overrides.clear()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass
    _memory_rate_limits.clear()


def create_tenant_helper(client: TestClient, plan: str = "free", role: str = "owner"):
    """Seeds a tenant organization and subscription in DB."""
    uid_str = f"usr_{uuid.uuid4().hex[:8]}"
    auth_header = f"Bearer dev-token-{uid_str}-{role}"
    res = client.get("/api/v1/auth/me", headers={"Authorization": auth_header})
    assert res.status_code == 200, res.text
    data = res.json()
    org_id = uuid.UUID(data["organization"]["id"])
    user_id = uuid.UUID(data["user"]["id"])

    with TestSyncSessionLocal() as sync_db:
        if plan != "free":
            sub = sync_db.query(Subscription).filter(Subscription.organization_id == org_id).first()
            if not sub:
                sub = Subscription(
                    id=uuid.uuid4(),
                    organization_id=org_id,
                    stripe_customer_id=f"cus_{org_id.hex[:8]}",
                    stripe_subscription_id=f"sub_{org_id.hex[:8]}",
                    plan=plan,
                    status="active",
                )
                sync_db.add(sub)
            else:
                sub.plan = plan
                sub.status = "active"

        sync_db.commit()

    return user_id, org_id, {"Authorization": auth_header}


# =========================================================================
# 1. PRODUCTION CONFIGURATION & FAIL-FAST VALIDATION
# =========================================================================

def test_production_config_rejects_default_secret_key():
    """In production, default development SECRET_KEY must trigger fail-fast ValueError."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="development-secret-key-scanly-replace-in-production",
        DATABASE_URL="postgresql+asyncpg://prod_user:strong_prod_pass@db.internal:5432/scanly",
        DATABASE_URL_SYNC="postgresql://prod_user:strong_prod_pass@db.internal:5432/scanly",
        NEXT_PUBLIC_APP_URL="https://app.sitesecura.com",
    )
    with pytest.raises(ValueError, match="SECRET_KEY must be set to a secure unique random secret"):
        prod_settings.validate_production_configuration()


def test_production_config_rejects_short_secret_key():
    """In production, SECRET_KEY shorter than 32 characters must fail fast."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="too-short-secret-key",
        DATABASE_URL="postgresql+asyncpg://prod_user:strong_prod_pass@db.internal:5432/scanly",
        DATABASE_URL_SYNC="postgresql://prod_user:strong_prod_pass@db.internal:5432/scanly",
        NEXT_PUBLIC_APP_URL="https://app.sitesecura.com",
    )
    with pytest.raises(ValueError, match="SECRET_KEY must be at least 32 characters"):
        prod_settings.validate_production_configuration()


def test_production_config_rejects_dev_database_password():
    """In production, default 'scanly_dev_password' in DATABASE_URL must trigger fail-fast."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="a" * 48,
        DATABASE_URL="postgresql+asyncpg://scanly:scanly_dev_password@db.internal:5432/scanly",
        DATABASE_URL_SYNC="postgresql://scanly:scanly_dev_password@db.internal:5432/scanly",
        NEXT_PUBLIC_APP_URL="https://app.sitesecura.com",
    )
    with pytest.raises(ValueError, match="DATABASE_URL contains development default password"):
        prod_settings.validate_production_configuration()


def test_production_config_rejects_localhost_frontend_url():
    """In production, NEXT_PUBLIC_APP_URL pointing to localhost must fail fast."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="a" * 48,
        DATABASE_URL="postgresql+asyncpg://prod_user:strong_prod_pass@db.internal:5432/scanly",
        DATABASE_URL_SYNC="postgresql://prod_user:strong_prod_pass@db.internal:5432/scanly",
        NEXT_PUBLIC_APP_URL="http://localhost:3000",
    )
    with pytest.raises(ValueError, match="NEXT_PUBLIC_APP_URL cannot point to localhost in production"):
        prod_settings.validate_production_configuration()


def test_production_config_passes_with_proper_credentials_and_tolerates_deferred_gateway():
    """Valid production settings pass validation and yield non-blocking warnings for deferred gateway."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="super-secret-random-production-key-at-least-32-chars",
        DATABASE_URL="postgresql+asyncpg://prod_user:strong_prod_pass@db.internal:5432/scanly",
        DATABASE_URL_SYNC="postgresql://prod_user:strong_prod_pass@db.internal:5432/scanly",
        REDIS_URL="redis://redis.internal:6379/0",
        FIREBASE_PROJECT_ID="sitesecura-prod",
        NEXT_PUBLIC_APP_URL="https://app.sitesecura.com",
        API_URL="https://api.sitesecura.com",
        EMAIL_MODE="console",
    )
    warnings = prod_settings.validate_production_configuration()
    assert isinstance(warnings, list)
    assert any("deferred" in w.lower() for w in warnings)


def test_development_config_bypasses_production_restrictions():
    """Development environment must not raise errors for local defaults."""
    dev_settings = Settings(
        ENVIRONMENT="development",
        SECRET_KEY="development-secret-key-scanly-replace-in-production",
        DATABASE_URL="postgresql+asyncpg://scanly:scanly_dev_password@localhost:5432/scanly",
    )
    warnings = dev_settings.validate_production_configuration()
    assert warnings == []


# =========================================================================
# 2. CORS SECURITY & LOOPBACK STRIPPING IN PRODUCTION
# =========================================================================

def test_production_cors_strips_localhost_and_loopback():
    """In production, cors_origins property must exclude all localhost/127.0.0.1 origins."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        NEXT_PUBLIC_APP_URL="https://app.sitesecura.com",
        CORS_ORIGINS=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://sitesecura.com",
            "https://app.sitesecura.com",
        ],
    )
    origins = prod_settings.cors_origins
    assert "http://localhost:3000" not in origins
    assert "http://127.0.0.1:3000" not in origins
    assert "https://sitesecura.com" in origins
    assert "https://app.sitesecura.com" in origins


def test_development_cors_preserves_localhost():
    """In development, cors_origins retains localhost for developer convenience."""
    dev_settings = Settings(
        ENVIRONMENT="development",
        CORS_ORIGINS=["http://localhost:3000", "https://sitesecura.com"],
    )
    origins = dev_settings.cors_origins
    assert "http://localhost:3000" in origins


def test_cors_middleware_rejects_untrusted_origin():
    """FastAPI CORS middleware must NOT set allow-origin headers for malicious origins."""
    client = TestClient(app)
    res = client.get(
        "/api/v1/health",
        headers={"Origin": "https://malicious-attacker-site.com"},
    )
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") != "https://malicious-attacker-site.com"


# =========================================================================
# 3. FIREBASE AUTH, ROLE IMMUTABILITY & DISABLED USER HANDLING
# =========================================================================

def test_production_auth_rejects_mock_dev_tokens(monkeypatch):
    """In production, dev-token- and test-token- prefixes must be strictly rejected."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with pytest.raises(HTTPException) as exc:
        verify_firebase_id_token("dev-token-attacker-admin")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_production_registration_prevents_self_admin_escalation(monkeypatch):
    """In production, new user signup with admin/agency claim must default strictly to 'free'."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    async with TestAsyncSessionLocal() as session:
        token_data = {
            "uid": f"prod_att_{uuid.uuid4().hex[:8]}",
            "email": f"attacker_{uuid.uuid4().hex[:6]}@evil.com",
            "name": "Attacker",
            "role": "admin",  # Attacker attempts self-elevation
        }
        with patch("app.services.auth_service.record_audit_event"):
            user, org = await get_or_create_user(session, token_data)

        # In production, role must be 'free', NEVER 'admin'
        assert user.role == "free"


def test_disabled_user_rejected_on_authentication():
    """Deactivated/disabled user (is_active=False) must be blocked with HTTP 403."""
    client = TestClient(app)
    user_id, _, headers = create_tenant_helper(client, plan="free")

    # Set user.is_active = False in sync DB
    with TestSyncSessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.is_active = False
            db.commit()

    res = client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 403
    data = res.json()
    err = data.get("detail", {}).get("error", {}) if isinstance(data.get("detail"), dict) else data.get("error", {})
    assert err.get("code") == "ACCOUNT_DISABLED"

    # Restore user.is_active
    with TestSyncSessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.is_active = True
            db.commit()


# =========================================================================
# 4. QUOTA ACCOUNTING IDEMPOTENCY & DOUBLE-REFUND PREVENTION
# =========================================================================

def test_quota_refund_sync_is_strictly_idempotent():
    """Calling refund_scan_quota_sync twice on the same scan must ONLY refund quota ONCE."""
    with TestSyncSessionLocal() as db:
        org_id = uuid.uuid4()
        org = Organization(id=org_id, name="Test Quota Org", type="personal")
        db.add(org)
        db.flush()

        period_month, _, _ = get_current_usage_period()

        # Provision usage record with 5 scans used
        usage = UsageRecord(
            id=uuid.uuid4(),
            organization_id=org_id,
            period_month=period_month,
            scans_count=5,
            monitored_sites_count=0,
            pdf_reports_count=0,
        )
        db.add(usage)

        # Create scan record
        scan_id = uuid.uuid4()
        scan = Scan(
            id=scan_id,
            organization_id=org_id,
            domain="double-refund-test.com",
            normalized_domain="double-refund-test.com",
            status="failed",
            scan_type="manual",
            passed_checks_count=0,
            total_checks_count=0,
            scan_metadata={},
        )
        db.add(scan)
        db.commit()

        # 1st refund (e.g. worker failure handler): should succeed
        refunded_1 = refund_scan_quota_sync(db, org_id, scan=scan)
        assert refunded_1 is True
        assert usage.scans_count == 4
        assert scan.scan_metadata.get("quota_refunded") is True

        # 2nd refund (e.g. watchdog recovery or task retry): must be NO-OP
        refunded_2 = refund_scan_quota_sync(db, org_id, scan=scan)
        assert refunded_2 is False
        assert usage.scans_count == 4  # Count must remain 4, NOT 3!

        # 3rd refund via scan_id lookup: must also be NO-OP
        refunded_3 = refund_scan_quota_sync(db, org_id, scan_id=scan.id)
        assert refunded_3 is False
        assert usage.scans_count == 4


@pytest.mark.asyncio
async def test_quota_refund_async_is_strictly_idempotent():
    """Calling async refund_scan_quota twice on the same scan must NOT double-decrement quota."""
    async with TestAsyncSessionLocal() as db:
        org_id = uuid.uuid4()
        org = Organization(id=org_id, name="Test Quota Org Async", type="personal")
        db.add(org)
        await db.flush()

        period_month, _, _ = get_current_usage_period()

        usage = UsageRecord(
            id=uuid.uuid4(),
            organization_id=org_id,
            period_month=period_month,
            scans_count=3,
            monitored_sites_count=0,
            pdf_reports_count=0,
        )
        db.add(usage)

        scan_id = uuid.uuid4()
        scan = Scan(
            id=scan_id,
            organization_id=org_id,
            domain="async-refund-test.com",
            normalized_domain="async-refund-test.com",
            status="failed",
            scan_type="manual",
            passed_checks_count=0,
            total_checks_count=0,
            scan_metadata={},
        )
        db.add(scan)
        await db.commit()

        # 1st call
        res1 = await refund_scan_quota(db, org_id, scan=scan)
        assert res1 is True
        assert usage.scans_count == 2
        assert scan.scan_metadata.get("quota_refunded") is True

        # 2nd call
        res2 = await refund_scan_quota(db, org_id, scan=scan)
        assert res2 is False
        assert usage.scans_count == 2  # Quota preserved, no double-refund


# =========================================================================
# 5. REDIS RATE LIMITER PRODUCTION BEHAVIOR & FAIL-SAFE MODES
# =========================================================================

@pytest.mark.asyncio
async def test_redis_rate_limit_fails_closed_when_configured(monkeypatch):
    """When fail_closed=True in production, Redis failure must raise HTTP 503 instead of silent bypass."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    async def _mock_unreachable_redis():
        raise ConnectionError("Redis cluster unreachable")

    monkeypatch.setattr("app.core.rate_limit.get_redis_client", _mock_unreachable_redis)

    with pytest.raises(HTTPException) as exc:
        await check_rate_limit("test-key", max_requests=10, window_seconds=60, fail_closed=True)

    assert exc.value.status_code == 503
    assert exc.value.detail["error"]["code"] == "RATE_LIMITER_UNAVAILABLE"


@pytest.mark.asyncio
async def test_redis_rate_limit_bounded_memory_fallback_in_dev(monkeypatch):
    """In development, Redis failure must fall back to memory without raising 503."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    async def _mock_unreachable_redis():
        raise ConnectionError("Redis cluster unreachable")

    monkeypatch.setattr("app.core.rate_limit.get_redis_client", _mock_unreachable_redis)

    # Should succeed for requests under limit
    allowed = await check_rate_limit("dev-unique-key-1", max_requests=3, window_seconds=60)
    assert allowed is True


# =========================================================================
# 6. TRANSACTIONAL EMAIL / SMTP FAILURE ISOLATION
# =========================================================================

def test_send_email_catches_smtp_failure_without_crashing(monkeypatch):
    """SMTP network error must be safely caught, logged, and return False without crashing caller."""
    monkeypatch.setattr(settings, "EMAIL_MODE", "smtp")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "mock-password")
    monkeypatch.setattr(settings, "SMTP_HOST", "invalid-smtp-host.internal")

    success = send_email(
        to_email="test@sitesecura.com",
        subject="Test Alert",
        text_content="Content",
    )
    assert success is False


# =========================================================================
# 7. BILLING SAFETY & DEFERRED PAYMENT ARCHITECTURE
# =========================================================================

def test_production_rejects_mock_checkout_sessions(monkeypatch):
    """In production, calling /billing/session-status with cs_mock_ must be rejected with HTTP 400."""
    client = TestClient(app)
    user_id, org_id, headers = create_tenant_helper(client, plan="free")

    def _mock_verify(token):
        return {
            "uid": f"usr_{user_id.hex[:8]}",
            "email": "test@example.com",
            "name": "Test User",
            "email_verified": True,
            "role": "free",
            "auth_time": 1700000000,
        }

    monkeypatch.setattr("app.core.security.verify_firebase_id_token", _mock_verify)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    res = client.get("/api/v1/billing/session-status?session_id=cs_mock_123456", headers=headers)
    assert res.status_code == 400
    data = res.json()
    err = data.get("detail", {}).get("error", {}) if isinstance(data.get("detail"), dict) else data.get("error", {})
    assert err.get("code") == "INVALID_CHECKOUT_SESSION"


def test_stripe_webhook_rejects_invalid_signature(monkeypatch):
    """Stripe webhook endpoint must reject payloads with invalid signature with HTTP 400."""
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_live_secret_for_validation")
    client = TestClient(app)
    res = client.post(
        "/api/v1/billing/webhooks/stripe",
        content=b'{"id": "evt_test", "type": "checkout.session.completed"}',
        headers={"Stripe-Signature": "t=1700000000,v1=invalid_signature_hash"},
    )
    assert res.status_code == 400
    assert "Invalid webhook payload or signature" in res.text


# =========================================================================
# 8. SECURITY HEADERS & REQUEST CORRELATION IDENTIFICATION
# =========================================================================

def test_security_headers_and_correlation_id_present():
    """API responses must include X-Request-ID, nosniff, DENY, and strict referrer policy."""
    client = TestClient(app)
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert "X-Request-ID" in res.headers
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


def test_custom_request_id_preserved_across_headers():
    """Client-provided X-Request-ID must be echoed in the response for end-to-end tracing."""
    client = TestClient(app)
    custom_id = "req_custom_trace_98765"
    res = client.get("/api/v1/health", headers={"X-Request-ID": custom_id})
    assert res.status_code == 200
    assert res.headers.get("X-Request-ID") == custom_id
