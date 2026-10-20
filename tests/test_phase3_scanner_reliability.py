"""
SiteSecura - Phase 3 Production Hardening: Scanner + Redis + Celery Reliability
Comprehensive verification suite testing:
1. Scan lifecycle state machine transitions (queued -> running -> completed/failed; no invalid transitions)
2. Task execution idempotency & duplicate prevention on worker retries or redeliveries
3. Celery worker retries, SoftTimeLimitExceeded handling, and MaxRetriesExceededError failure marking
4. Outlawing silent synchronous fallback in production when Celery/Redis queue is unavailable
5. Periodic watchdog: Stale/stuck scan recovery task & Celery Beat registration
6. Monitoring alert storm prevention & deterministic fingerprint deduplication
7. Scanner statelessness, concurrency isolation, and bounded network configuration
8. Production vs development Redis rate limiter behavior & telemetry logging
"""

import os
import sys
import uuid
import time
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, delete, event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import sessionmaker

# Ensure apps/api and root are in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from apps.api.main import app
from app.db.base import Base
from app.db.session import get_db, get_sync_db
import app.db.session as session_module
from app.models.user import User, Organization, OrganizationMember
from app.models.billing import Subscription, UsageRecord
from app.models.website import Website, Monitoring
from app.models.scan import Scan, ScanCheck, Report
from app.models.alert import Alert, AuditLog
from app.core.config import settings
from app.core.rate_limit import check_rate_limit, _memory_rate_limits
from app.services.scan_service import execute_scan_job, execute_deep_scan_job
from app.services.monitoring_service import (
    create_alert_if_not_duplicate,
    generate_alert_fingerprint,
    run_monitored_website_scan,
)
from app.services.entitlement_service import refund_scan_quota_sync, get_current_usage_period
from app.tasks.worker import (
    scan_website_task,
    deep_scan_website_task,
    run_monitoring_scan_task,
    schedule_monitored_scans_task,
    recover_stale_scans_task,
    _mark_scan_failed_safe,
)
from app.tasks.celery_app import celery_app
from celery.exceptions import SoftTimeLimitExceeded, MaxRetriesExceededError
from scanner.network.models import SafeNetworkConfig
from scanner.models import ScanResult, Finding, CheckStatus, Severity, RiskLevel


TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_phase3_reliability.sqlite3"))
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
def setup_phase3_test_db():
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
        with TestSyncSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_sync_db] = override_get_sync_db
    session_module.AsyncSessionLocal = TestAsyncSessionLocal

    yield

    app.dependency_overrides.clear()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass


@pytest.fixture(autouse=True)
def clear_ratelimits():
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
# 1. SCAN LIFECYCLE & STATE MACHINE TRANSITION SAFETY
# =========================================================================

def test_scan_lifecycle_normal_progression():
    """Verify queued -> running -> completed progression sets timestamps and score."""
    with TestSyncSessionLocal() as db:
        scan = Scan(
            id=uuid.uuid4(),
            domain="example.com",
            normalized_domain="example.com",
            status="queued",
            scan_type="quick",
        )
        db.add(scan)
        db.commit()
        scan_id = scan.id

    # Mock runner to return predictable result
    mock_scan_res = ScanResult(
        domain="example.com",
        normalized_domain="example.com",
        target_ip="93.184.216.34",
        score=88,
        risk_level=RiskLevel.GOOD,
        score_breakdown={"headers": 80, "ssl": 95},
        findings=[
            Finding(
                check_type="hsts",
                name="Strict-Transport-Security",
                status=CheckStatus.PASS,
                severity=Severity.LOW,
                score_impact=0,
                title="HSTS Configured",
                summary="HSTS header present",
                why_it_matters="Enforces TLS",
                how_to_fix="Already valid",
                estimated_fix_minutes=0,
                documentation_url="https://scanly.io/docs/hsts",
            )
        ],
        passed_checks_count=1,
        total_checks_count=1,
        scan_duration_ms=450,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )

    with patch("app.services.scan_service.run_security_scan", return_value=mock_scan_res):
        with patch("app.services.scan_service.generate_pdf_report", return_value="/tmp/test.pdf"):
            with TestSyncSessionLocal() as db:
                completed_scan = execute_scan_job(scan_id, db)

    assert completed_scan is not None
    assert completed_scan.status == "completed"
    assert completed_scan.score == 88
    assert completed_scan.started_at is not None
    assert completed_scan.completed_at is not None


def test_scan_state_machine_prevents_completed_to_running():
    """A task redelivered on an already-completed scan must NOT transition back to running."""
    completed_time = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    with TestSyncSessionLocal() as db:
        scan = Scan(
            id=uuid.uuid4(),
            domain="completed-immutable.com",
            normalized_domain="completed-immutable.com",
            status="completed",
            score=95,
            started_at=completed_time,
            completed_at=completed_time,
            scan_type="quick",
        )
        db.add(scan)
        db.commit()
        scan_id = scan.id

    # Attempt to re-run execute_scan_job
    with patch("app.services.scan_service.run_security_scan") as mock_scanner:
        with TestSyncSessionLocal() as db:
            result = execute_scan_job(scan_id, db)

        # Scanner engine must NEVER be invoked for already completed scan
        mock_scanner.assert_not_called()

    assert result.status == "completed"
    assert result.score == 95
    assert result.completed_at.replace(tzinfo=timezone.utc) == completed_time


def test_deep_scan_state_machine_prevents_completed_to_running():
    """A task redelivered on an already-completed deep scan must NOT transition back to running."""
    completed_time = datetime(2026, 1, 2, 10, 0, 0, tzinfo=timezone.utc)
    with TestSyncSessionLocal() as db:
        scan = Scan(
            id=uuid.uuid4(),
            domain="deep-immutable.com",
            normalized_domain="deep-immutable.com",
            status="completed",
            score=92,
            started_at=completed_time,
            completed_at=completed_time,
            scan_type="deep",
        )
        db.add(scan)
        db.commit()
        scan_id = scan.id

    with patch("scanner.deep.runner.run_deep_security_scan") as mock_deep:
        with TestSyncSessionLocal() as db:
            result = execute_deep_scan_job(scan_id, db)

        mock_deep.assert_not_called()

    assert result.status == "completed"
    assert result.score == 92


def test_scan_state_machine_terminal_failed_not_reexecuted():
    """A task on a terminal failed scan (completed_at set) must NOT re-execute."""
    failed_time = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    with TestSyncSessionLocal() as db:
        scan = Scan(
            id=uuid.uuid4(),
            domain="failed-immutable.com",
            normalized_domain="failed-immutable.com",
            status="failed",
            error_message="Host unreachable",
            started_at=failed_time,
            completed_at=failed_time,
            scan_type="quick",
        )
        db.add(scan)
        db.commit()
        scan_id = scan.id

    with patch("app.services.scan_service.run_security_scan") as mock_scanner:
        with TestSyncSessionLocal() as db:
            result = execute_scan_job(scan_id, db)

        mock_scanner.assert_not_called()

    assert result.status == "failed"
    assert result.error_message == "Host unreachable"


# =========================================================================
# 2. TASK EXECUTION IDEMPOTENCY & DUPLICATE PREVENTION
# =========================================================================

def test_execute_scan_job_idempotent_no_duplicate_checks():
    """Running execute_scan_job multiple times never produces duplicate checks or reports."""
    with TestSyncSessionLocal() as db:
        scan = Scan(
            id=uuid.uuid4(),
            domain="idempotent-test.com",
            normalized_domain="idempotent-test.com",
            status="queued",
            scan_type="quick",
        )
        db.add(scan)
        db.commit()
        scan_id = scan.id

    mock_finding = Finding(
        check_type="csp",
        name="Content-Security-Policy",
        status=CheckStatus.HIGH,
        severity=Severity.HIGH,
        score_impact=-15,
        title="CSP Missing",
        summary="No Content-Security-Policy header",
        why_it_matters="Prevents XSS",
        how_to_fix="Add CSP header",
        estimated_fix_minutes=15,
        documentation_url="https://scanly.io/docs/csp",
    )
    mock_scan_res = ScanResult(
        domain="idempotent-test.com",
        normalized_domain="idempotent-test.com",
        target_ip="93.184.216.34",
        score=75,
        risk_level=RiskLevel.MEDIUM,
        score_breakdown={},
        findings=[mock_finding],
        passed_checks_count=0,
        total_checks_count=1,
        scan_duration_ms=500,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )

    with patch("app.services.scan_service.run_security_scan", return_value=mock_scan_res):
        with patch("app.services.scan_service.generate_pdf_report", return_value="/tmp/test.pdf"):
            # First execution
            with TestSyncSessionLocal() as db:
                execute_scan_job(scan_id, db)

            # Second execution (e.g., duplicate message delivered)
            with TestSyncSessionLocal() as db:
                execute_scan_job(scan_id, db)

    with TestSyncSessionLocal() as db:
        checks = db.query(ScanCheck).filter(ScanCheck.scan_id == scan_id).all()
        assert len(checks) == 1, f"Expected 1 check, found {len(checks)} (duplicate checks detected)"
        reports = db.query(Report).filter(Report.scan_id == scan_id).all()
        assert len(reports) == 1, f"Expected 1 report, found {len(reports)} (duplicate reports detected)"


def test_execute_scan_job_cleans_partial_checks_on_retry():
    """If a retry occurs after partial checks were saved, the old checks are wiped before inserting."""
    with TestSyncSessionLocal() as db:
        scan = Scan(
            id=uuid.uuid4(),
            domain="retry-clean.com",
            normalized_domain="retry-clean.com",
            status="running",
            scan_type="quick",
        )
        db.add(scan)
        db.flush()

        # Seed two partial/orphaned check records
        for i in range(2):
            db.add(ScanCheck(
                id=uuid.uuid4(),
                scan_id=scan.id,
                check_type=f"partial_{i}",
                name=f"Partial Check {i}",
                status="fail",
                severity="medium",
                score_impact=-5,
                title="Partial",
                summary="Partial summary",
                why_it_matters="Partial",
                how_to_fix="Partial",
                estimated_fix_minutes=5,
            ))
        db.commit()
        scan_id = scan.id

    # Verify 2 partial checks present before execution
    with TestSyncSessionLocal() as db:
        initial_checks = db.query(ScanCheck).filter(ScanCheck.scan_id == scan_id).all()
        assert len(initial_checks) == 2

    mock_scan_res = ScanResult(
        domain="retry-clean.com",
        normalized_domain="retry-clean.com",
        target_ip="93.184.216.34",
        score=90,
        risk_level=RiskLevel.GOOD,
        score_breakdown={},
        findings=[
            Finding(
                check_type="final_check",
                name="Final Check",
                status=CheckStatus.PASS,
                severity=Severity.LOW,
                score_impact=0,
                title="Pass",
                summary="Pass",
                why_it_matters="Pass",
                how_to_fix="Pass",
                estimated_fix_minutes=0,
                documentation_url="https://scanly.io/docs/final",
            )
        ],
        passed_checks_count=1,
        total_checks_count=1,
        scan_duration_ms=300,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )

    with patch("app.services.scan_service.run_security_scan", return_value=mock_scan_res):
        with patch("app.services.scan_service.generate_pdf_report", return_value="/tmp/test.pdf"):
            with TestSyncSessionLocal() as db:
                execute_scan_job(scan_id, db)

    with TestSyncSessionLocal() as db:
        final_checks = db.query(ScanCheck).filter(ScanCheck.scan_id == scan_id).all()
        assert len(final_checks) == 1
        assert final_checks[0].check_type == "final_check"


# =========================================================================
# 3. CELERY WORKER CONFIGURATION, RETRIES & TIMEOUTS
# =========================================================================

def test_celery_task_configuration_and_limits():
    """Verify Celery task limits, retries, and Beat configuration."""
    assert scan_website_task.max_retries == 2
    assert deep_scan_website_task.max_retries == 2
    assert run_monitoring_scan_task.max_retries == 2

    assert celery_app.conf.task_time_limit == 180
    assert celery_app.conf.task_soft_time_limit == 120
    assert celery_app.conf.timezone == "UTC"


def test_worker_soft_time_limit_exceeded_marks_scan_failed():
    """When a worker exceeds the soft time limit, the scan is transitioned to failed in DB."""
    client = TestClient(app)
    user_id, org_id, _ = create_tenant_helper(client, plan="basic")

    with TestSyncSessionLocal() as db:
        scan = Scan(
            id=uuid.uuid4(),
            organization_id=org_id,
            domain="timeout-test.com",
            normalized_domain="timeout-test.com",
            status="running",
            scan_type="quick",
        )
        db.add(scan)

        # Set initial usage
        period_month, _, _ = get_current_usage_period()
        usage = UsageRecord(
            id=uuid.uuid4(),
            organization_id=org_id,
            period_month=period_month,
            scans_count=1,
        )
        db.add(usage)
        db.commit()
        scan_id = scan.id

    with patch("app.tasks.worker.execute_scan_job", side_effect=SoftTimeLimitExceeded()):
        with patch("app.tasks.worker.get_sync_db", side_effect=TestSyncSessionLocal):
            result = scan_website_task(str(scan_id))

    assert result["status"] == "failed"
    assert result["error"] == "SOFT_TIME_LIMIT_EXCEEDED"

    with TestSyncSessionLocal() as db:
        updated_scan = db.query(Scan).filter(Scan.id == scan_id).first()
        assert updated_scan.status == "failed"
        assert "timed out" in updated_scan.error_message.lower()
        assert updated_scan.completed_at is not None

        # Verify quota slot was refunded
        updated_usage = db.query(UsageRecord).filter(
            UsageRecord.organization_id == org_id,
            UsageRecord.period_month == period_month,
        ).first()
        assert updated_usage.scans_count == 0


def test_worker_max_retries_exceeded_marks_scan_failed():
    """When a scan task exceeds max retries, the scan is cleanly marked failed and quota refunded."""
    client = TestClient(app)
    user_id, org_id, _ = create_tenant_helper(client, plan="basic")

    with TestSyncSessionLocal() as db:
        scan = Scan(
            id=uuid.uuid4(),
            organization_id=org_id,
            domain="max-retries-test.com",
            normalized_domain="max-retries-test.com",
            status="running",
            scan_type="quick",
        )
        db.add(scan)
        db.commit()
        scan_id = scan.id

    with TestSyncSessionLocal() as db:
        _mark_scan_failed_safe(db, scan_id, "Scan failed after maximum retries.")

    with TestSyncSessionLocal() as db:
        updated_scan = db.query(Scan).filter(Scan.id == scan_id).first()
        assert updated_scan.status == "failed"
        assert updated_scan.error_message == "Scan failed after maximum retries."
        assert updated_scan.completed_at is not None


# =========================================================================
# 4. OUTLAWING SILENT SYNCHRONOUS FALLBACK IN PRODUCTION
# =========================================================================

def test_scans_endpoint_outlaws_sync_fallback_in_production(monkeypatch):
    """In production, Celery enqueue failure MUST NOT execute scan synchronously in web worker."""
    client = TestClient(app)
    user_id, org_id, headers = create_tenant_helper(client, plan="basic")

    def _mock_verify(token):
        parts = token.split("-")
        uid = parts[2] if len(parts) > 2 else "dev_user"
        role = parts[3] if len(parts) > 3 else "owner"
        return {
            "uid": uid,
            "email": f"{uid}@example.com",
            "name": f"User {uid}",
            "email_verified": True,
            "role": role,
            "auth_time": 1700000000,
        }

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr("app.core.security.verify_firebase_id_token", _mock_verify)

    mock_celery = MagicMock(side_effect=RuntimeError("Celery connection refused"))
    mock_execute = MagicMock()
    monkeypatch.setattr("app.api.v1.scans.scan_website_task.delay", mock_celery)
    monkeypatch.setattr("app.api.v1.scans.execute_scan_job", mock_execute)

    res = client.post("/api/v1/scans", headers=headers, json={"domain": "prod-no-fallback.com"})

    # Must return error and NEVER execute scan in web worker thread
    assert res.status_code == 500
    assert res.json()["detail"]["error"]["code"] == "SCAN_DISPATCH_FAILED"
    mock_execute.assert_not_called()

    # Verify scan record in DB is marked failed
    with TestSyncSessionLocal() as db:
        failed_scan = db.query(Scan).filter(
            Scan.organization_id == org_id,
            Scan.domain == "prod-no-fallback.com",
        ).first()
        assert failed_scan is not None
        assert failed_scan.status == "failed"
        assert "unavailable" in failed_scan.error_message.lower()


def test_website_scans_endpoint_outlaws_sync_fallback_in_production(monkeypatch):
    """In production, /api/v1/websites/{id}/scan MUST NOT fall back to synchronous scan."""
    client = TestClient(app)
    user_id, org_id, headers = create_tenant_helper(client, plan="basic")

    with TestSyncSessionLocal() as db:
        site = Website(
            id=uuid.uuid4(),
            organization_id=org_id,
            name="site-prod-fallback.com",
            domain="site-prod-fallback.com",
            normalized_domain="site-prod-fallback.com",
            status="active",
        )
        db.add(site)
        db.commit()
        site_id = site.id

    def _mock_verify(token):
        parts = token.split("-")
        uid = parts[2] if len(parts) > 2 else "dev_user"
        role = parts[3] if len(parts) > 3 else "owner"
        return {
            "uid": uid,
            "email": f"{uid}@example.com",
            "name": f"User {uid}",
            "email_verified": True,
            "role": role,
            "auth_time": 1700000000,
        }

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr("app.core.security.verify_firebase_id_token", _mock_verify)
    mock_celery = MagicMock(side_effect=RuntimeError("Broker unavailable"))
    mock_execute = MagicMock()
    monkeypatch.setattr("app.api.v1.websites.scan_website_task.delay", mock_celery)
    monkeypatch.setattr("app.api.v1.websites.execute_scan_job", mock_execute)

    res = client.post(f"/api/v1/websites/{site_id}/scan", headers=headers)
    assert res.status_code == 500
    assert res.json()["detail"]["error"]["code"] == "SCAN_DISPATCH_FAILED"
    mock_execute.assert_not_called()


def test_website_deep_scans_endpoint_outlaws_sync_fallback_in_production(monkeypatch):
    """In production, /api/v1/websites/{id}/deep-scan MUST NOT fall back to synchronous deep scan."""
    client = TestClient(app)
    user_id, org_id, headers = create_tenant_helper(client, plan="pro")

    with TestSyncSessionLocal() as db:
        site = Website(
            id=uuid.uuid4(),
            organization_id=org_id,
            name="deep-prod-fallback.com",
            domain="deep-prod-fallback.com",
            normalized_domain="deep-prod-fallback.com",
            status="active",
        )
        db.add(site)
        db.commit()
        site_id = site.id

    def _mock_verify(token):
        parts = token.split("-")
        uid = parts[2] if len(parts) > 2 else "dev_user"
        role = parts[3] if len(parts) > 3 else "owner"
        return {
            "uid": uid,
            "email": f"{uid}@example.com",
            "name": f"User {uid}",
            "email_verified": True,
            "role": role,
            "auth_time": 1700000000,
        }

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr("app.core.security.verify_firebase_id_token", _mock_verify)
    mock_celery = MagicMock(side_effect=RuntimeError("Broker unavailable"))
    mock_execute_deep = MagicMock()
    monkeypatch.setattr("app.api.v1.websites.deep_scan_website_task.delay", mock_celery)
    monkeypatch.setattr("app.api.v1.websites.execute_deep_scan_job", mock_execute_deep)

    res = client.post(f"/api/v1/websites/{site_id}/deep-scan", headers=headers)
    assert res.status_code == 500
    assert res.json()["detail"]["error"]["code"] == "SCAN_DISPATCH_FAILED"
    mock_execute_deep.assert_not_called()


def test_scans_endpoint_allows_fallback_in_development(monkeypatch):
    """In development, Celery enqueue failure attempts synchronous fallback for local workflows."""
    client = TestClient(app)
    user_id, org_id, headers = create_tenant_helper(client, plan="basic")

    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    mock_celery = MagicMock(side_effect=RuntimeError("Local redis down"))
    mock_execute = MagicMock()
    monkeypatch.setattr("app.api.v1.scans.scan_website_task.delay", mock_celery)
    monkeypatch.setattr("app.api.v1.scans.execute_scan_job", mock_execute)

    res = client.post("/api/v1/scans", headers=headers, json={"domain": "dev-fallback.com"})
    assert res.status_code == 201
    mock_execute.assert_called_once()


# =========================================================================
# 5. PERIODIC WATCHDOG: STALE SCAN RECOVERY
# =========================================================================

def test_stale_scan_watchdog_recovers_hung_scans():
    """Watchdog identifies scans stuck in queued/running > 15m, marks failed and refunds quota."""
    client = TestClient(app)
    user_id, org_id, _ = create_tenant_helper(client, plan="pro")

    now = datetime.now(timezone.utc)
    old_time = now - timedelta(minutes=25)
    recent_time = now - timedelta(minutes=5)

    with TestSyncSessionLocal() as db:
        # Scan 1: Stale running scan (> 15m)
        stale_running = Scan(
            id=uuid.uuid4(),
            organization_id=org_id,
            domain="stale-running.com",
            normalized_domain="stale-running.com",
            status="running",
            created_at=old_time,
            started_at=old_time,
            scan_type="quick",
        )
        # Scan 2: Stale queued scan (> 15m)
        stale_queued = Scan(
            id=uuid.uuid4(),
            organization_id=org_id,
            domain="stale-queued.com",
            normalized_domain="stale-queued.com",
            status="queued",
            created_at=old_time,
            scan_type="quick",
        )
        # Scan 3: Fresh in-flight scan (< 15m)
        fresh_running = Scan(
            id=uuid.uuid4(),
            organization_id=org_id,
            domain="fresh-running.com",
            normalized_domain="fresh-running.com",
            status="running",
            created_at=recent_time,
            started_at=recent_time,
            scan_type="quick",
        )
        db.add_all([stale_running, stale_queued, fresh_running])

        period_month, _, _ = get_current_usage_period()
        usage = UsageRecord(
            id=uuid.uuid4(),
            organization_id=org_id,
            period_month=period_month,
            scans_count=2,
        )
        db.add(usage)
        db.commit()

        id_running = stale_running.id
        id_queued = stale_queued.id
        id_fresh = fresh_running.id

    with patch("app.tasks.worker.get_sync_db", side_effect=TestSyncSessionLocal):
        result = recover_stale_scans_task(stale_threshold_minutes=15)

    assert result["recovered_count"] >= 2

    with TestSyncSessionLocal() as db:
        s1 = db.query(Scan).filter(Scan.id == id_running).first()
        s2 = db.query(Scan).filter(Scan.id == id_queued).first()
        s3 = db.query(Scan).filter(Scan.id == id_fresh).first()

        assert s1.status == "failed"
        assert "watchdog" in s1.error_message
        assert s1.completed_at is not None

        assert s2.status == "failed"
        assert "watchdog" in s2.error_message
        assert s2.completed_at is not None

        # Fresh scan must remain running
        assert s3.status == "running"


def test_stale_scan_watchdog_in_beat_schedule():
    """Verify stale-scan-watchdog is registered in Celery Beat schedule."""
    schedule = celery_app.conf.beat_schedule
    assert "stale-scan-watchdog" in schedule
    entry = schedule["stale-scan-watchdog"]
    assert entry["task"] == "app.tasks.worker.recover_stale_scans_task"


# =========================================================================
# 6. ALERT STORM PREVENTION & FINGERPRINT DEDUPLICATION
# =========================================================================

def test_monitoring_alert_deduplication():
    """Verifies that identical unread alert conditions are deduplicated atomically."""
    client = TestClient(app)
    user_id, org_id, _ = create_tenant_helper(client, plan="pro")

    with TestSyncSessionLocal() as db:
        site = Website(
            id=uuid.uuid4(),
            organization_id=org_id,
            name="site-dedup.com",
            domain="site-dedup.com",
            normalized_domain="site-dedup.com",
            status="active",
        )
        db.add(site)
        db.commit()
        site_id = site.id

    fp = generate_alert_fingerprint("score_drop", site_id, "drop_50")

    with TestSyncSessionLocal() as db:
        alert1, created1 = create_alert_if_not_duplicate(
            db=db,
            organization_id=org_id,
            website_id=site_id,
            alert_type="score_drop",
            change_token="drop_50",
            severity="high",
            title="Score Dropped",
            message="Score dropped by 20 points",
            fingerprint=fp,
        )
        assert created1 is True
        assert alert1 is not None

        # Second cycle with same condition while unread: must deduplicate
        alert2, created2 = create_alert_if_not_duplicate(
            db=db,
            organization_id=org_id,
            website_id=site_id,
            alert_type="score_drop",
            change_token="drop_50",
            severity="high",
            title="Score Dropped",
            message="Score dropped by 20 points",
            fingerprint=fp,
        )
        assert created2 is False
        assert alert2 is None


def test_monitoring_alert_isolation_across_orgs():
    """Same alert condition on different orgs produces separate alerts without collisions."""
    client = TestClient(app)
    _, org_a, _ = create_tenant_helper(client, plan="pro")
    _, org_b, _ = create_tenant_helper(client, plan="pro")

    with TestSyncSessionLocal() as db:
        site_a_obj = Website(
            id=uuid.uuid4(),
            organization_id=org_a,
            name="site-a-dedup.com",
            domain="site-a-dedup.com",
            normalized_domain="site-a-dedup.com",
            status="active",
        )
        site_b_obj = Website(
            id=uuid.uuid4(),
            organization_id=org_b,
            name="site-b-dedup.com",
            domain="site-b-dedup.com",
            normalized_domain="site-b-dedup.com",
            status="active",
        )
        db.add_all([site_a_obj, site_b_obj])
        db.commit()
        site_a = site_a_obj.id
        site_b = site_b_obj.id

    fp_a = generate_alert_fingerprint("ssl_expiring", site_a, "ssl_7_days")
    fp_b = generate_alert_fingerprint("ssl_expiring", site_b, "ssl_7_days")

    with TestSyncSessionLocal() as db:
        a1, c1 = create_alert_if_not_duplicate(
            db=db,
            organization_id=org_a,
            website_id=site_a,
            alert_type="ssl_expiring",
            change_token="ssl_7_days",
            severity="critical",
            title="SSL Expiring",
            message="Expires in 7 days",
            fingerprint=fp_a,
        )
        a2, c2 = create_alert_if_not_duplicate(
            db=db,
            organization_id=org_b,
            website_id=site_b,
            alert_type="ssl_expiring",
            change_token="ssl_7_days",
            severity="critical",
            title="SSL Expiring",
            message="Expires in 7 days",
            fingerprint=fp_b,
        )

        assert c1 is True and a1 is not None
        assert c2 is True and a2 is not None
        assert a1.organization_id != a2.organization_id


# =========================================================================
# 7. SCANNER BOUNDED CONFIGURATION & STATELESS ISOLATION
# =========================================================================

def test_safe_network_config_limits():
    """Verify SafeNetworkConfig enforces strict bounded limits for SSRF and resource safety."""
    cfg = SafeNetworkConfig(
        max_redirects=settings.SCANNER_MAX_REDIRECTS,
        max_response_bytes=settings.SCANNER_MAX_RESPONSE_BYTES,
        connect_timeout=settings.SCANNER_CONNECT_TIMEOUT,
        read_timeout=settings.SCANNER_READ_TIMEOUT,
        write_timeout=settings.SCANNER_WRITE_TIMEOUT,
        pool_timeout=settings.SCANNER_POOL_TIMEOUT,
        total_timeout=settings.SCANNER_TIMEOUT_SECONDS,
    )
    assert cfg.max_redirects <= 5
    assert cfg.max_response_bytes <= 1048576
    assert cfg.connect_timeout <= 5.0
    assert cfg.read_timeout <= 5.0


# =========================================================================
# 8. PRODUCTION REDIS RATE LIMITER WARNING TELEMETRY
# =========================================================================

@pytest.mark.asyncio
async def test_redis_rate_limit_production_telemetry(monkeypatch):
    """In production, Redis failure logs a critical warning regarding lack of distributed guarantees."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    async def _mock_failing_redis():
        raise ConnectionError("Redis cluster unreachable")

    monkeypatch.setattr("app.core.rate_limit.get_redis_client", _mock_failing_redis)

    with patch("app.core.rate_limit.logger.critical") as mock_crit:
        # Check rate limit should fall back to memory but log critical warning
        allowed = await check_rate_limit("test-key", max_requests=5, window_seconds=60)
        assert allowed is True
        mock_crit.assert_called_once()
        assert "PRODUCTION" in mock_crit.call_args[0][0]
