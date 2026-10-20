"""
SiteSecura - Phase C: Real Website Monitoring & Alerting Regression Test Suite

Validates:
1. Scan comparison engine (baseline, score drops >= 5pts, new/resolved findings, DNS changes, security headers, SSL expiry/renewal).
2. Fingerprint generation & atomic alert deduplication across organizations and statuses.
3. Subscription plan entitlement gates for monitoring (Free denied 403, Basic allowed weekly, Pro/Agency allowed daily/weekly).
4. Multi-tenant isolation for monitoring endpoints (404 IDOR protection).
5. Monitoring API endpoints: POST (enable), GET (status), PATCH (frequency/active), DELETE (deactivate).
6. Websites listing serialization with nested monitoring configuration.
7. Quota enforcement: Monitoring respects monthly scan quota, postpones by 24h on exhaustion, and audits event.
8. Monitoring orchestration: Baseline scan handling, diff alerts creation, error handling and status updates.
9. Celery Beat scheduler task: Queries due active records, ignores paused/future records, atomically advances next_run_at.
10. Celery worker task: Invocation and retry safety.
"""

import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient
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
from app.models.user import User, Organization, OrganizationMember
from app.models.billing import Subscription, UsageRecord
from app.models.website import Website, Monitoring
from app.models.scan import Scan, ScanCheck, Report
from app.models.alert import Alert, AuditLog
from app.core.rate_limit import _memory_rate_limits
from app.services.comparison_service import compare_scans
from app.services.monitoring_service import (
    generate_alert_fingerprint,
    create_alert_if_not_duplicate,
    run_monitored_scan_for_website,
    check_and_dispatch_alerts,
)
from app.tasks.worker import schedule_monitored_scans_task, run_monitoring_scan_task

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_monitoring_phase_c.sqlite3"))
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
def setup_test_db():
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

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_sync_db] = override_get_sync_db
    session_module.AsyncSessionLocal = TestAsyncSessionLocal
    session_module.get_sync_db = override_get_sync_db

    import app.tasks.worker as worker_module
    worker_module.get_sync_db = override_get_sync_db

    yield

    app.dependency_overrides.clear()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass


@pytest.fixture(autouse=True)
def clear_rate_limits():
    _memory_rate_limits.clear()


# =========================================================================
# HELPER FIXTURES & FUNCTIONS
# =========================================================================

def create_tenant(plan: str = "free"):
    """Creates a user and organization on the specified plan."""
    uid = f"user_{plan}_{uuid.uuid4().hex[:8]}"
    auth_header = f"Bearer dev-token-{uid}-free"
    client = TestClient(app)

    res = client.get("/api/v1/auth/me", headers={"Authorization": auth_header})
    assert res.status_code == 200
    data = res.json()
    org_id = uuid.UUID(data["organization"]["id"])
    user_id = uuid.UUID(data["user"]["id"])

    if plan != "free":
        with TestSyncSessionLocal() as sync_db:
            sub = sync_db.execute(select(Subscription).where(Subscription.organization_id == org_id)).scalar_one()
            sub.plan = plan
            sub.status = "active"
            sync_db.commit()

    return {
        "client": client,
        "auth_header": auth_header,
        "org_id": org_id,
        "user_id": user_id,
        "plan": plan,
    }


def create_mock_scan(
    org_id: uuid.UUID,
    site_id: uuid.UUID,
    domain: str,
    score: int = 90,
    checks_data: list = None,
    created_at: datetime = None,
):
    """Helper to persist a completed Scan with ScanCheck records in sync_db."""
    if created_at is None:
        created_at = datetime.now(timezone.utc)
    scan_id = uuid.uuid4()
    with TestSyncSessionLocal() as sync_db:
        scan = Scan(
            id=scan_id,
            organization_id=org_id,
            website_id=site_id,
            domain=domain,
            normalized_domain=domain.lower(),
            status="completed",
            scan_type="monitoring",
            score=score,
            passed_checks_count=10,
            total_checks_count=12,
            completed_at=created_at,
            created_at=created_at,
        )
        sync_db.add(scan)

        for cd in (checks_data or []):
            check = ScanCheck(
                id=uuid.uuid4(),
                scan_id=scan_id,
                check_type=cd.get("check_type", "ssl_tls"),
                name=cd.get("name", "Test Check"),
                status=cd.get("status", "pass"),
                severity=cd.get("severity", "medium"),
                title=cd.get("title", "Check Title"),
                summary=cd.get("summary", "Summary"),
                evidence=cd.get("evidence"),
                technical_details=cd.get("technical_details", {}),
            )
            sync_db.add(check)

        sync_db.commit()
        sync_db.refresh(scan)
        return scan


# =========================================================================
# 1. SCAN COMPARISON ENGINE TESTS
# =========================================================================

def test_comparison_service_baseline():
    """First scan of a website has no previous scan: is_baseline=True, no alerts."""
    curr = Scan(
        id=uuid.uuid4(),
        status="completed",
        score=95,
        checks=[],
    )
    result = compare_scans(previous_scan=None, current_scan=curr)
    assert result["is_baseline"] is True
    assert result["has_changes"] is False
    assert len(result["new_findings"]) == 0
    assert len(result["resolved_findings"]) == 0
    assert len(result["dns_changes"]) == 0
    assert len(result["header_changes"]) == 0
    assert len(result["ssl_changes"]) == 0


def test_comparison_service_score_drop():
    """Score drop >= 5 points is flagged as an active drop alert."""
    prev = Scan(id=uuid.uuid4(), status="completed", score=90, checks=[])
    curr = Scan(id=uuid.uuid4(), status="completed", score=82, checks=[])

    result = compare_scans(prev, curr, score_drop_threshold=5)
    assert result["is_baseline"] is False
    assert result["has_changes"] is True
    assert result["score"]["changed"] is True
    assert result["score"]["delta"] == -8
    assert result["score"]["is_drop"] is True
    assert result["score"]["is_increase"] is False


def test_comparison_service_no_score_drop_for_minor_fluctuation():
    """Score drops of less than threshold (e.g. 3 points) or increases do not trigger score drop alert."""
    prev = Scan(id=uuid.uuid4(), status="completed", score=90, checks=[])
    curr = Scan(id=uuid.uuid4(), status="completed", score=88, checks=[])

    result = compare_scans(prev, curr, score_drop_threshold=5)
    assert result["score"]["delta"] == -2
    assert result["score"]["is_drop"] is False

    # Score increase
    curr_inc = Scan(id=uuid.uuid4(), status="completed", score=95, checks=[])
    result_inc = compare_scans(prev, curr_inc, score_drop_threshold=5)
    assert result_inc["score"]["delta"] == 5
    assert result_inc["score"]["is_drop"] is False
    assert result_inc["score"]["is_increase"] is True


def test_comparison_service_new_and_resolved_findings():
    """Detects when a security check transitions from passing to failing and vice-versa."""
    prev_check1 = ScanCheck(check_type="ssl_tls", status="pass", severity="high", title="Valid SSL Certificate")
    prev_check2 = ScanCheck(check_type="headers_hsts", status="fail", severity="medium", title="HSTS Missing")
    prev = Scan(id=uuid.uuid4(), score=80, checks=[prev_check1, prev_check2])

    curr_check1 = ScanCheck(check_type="ssl_tls", status="fail", severity="high", title="Expired SSL Certificate")
    curr_check2 = ScanCheck(check_type="headers_hsts", status="pass", severity="medium", title="HSTS Configured")
    curr = Scan(id=uuid.uuid4(), score=80, checks=[curr_check1, curr_check2])

    result = compare_scans(prev, curr)
    assert result["has_changes"] is True

    # New finding: ssl_tls went pass -> fail
    assert len(result["new_findings"]) == 1
    assert result["new_findings"][0]["check_type"] == "ssl_tls"
    assert result["new_findings"][0]["severity"] == "high"

    # Resolved finding: headers_hsts went fail -> pass
    assert len(result["resolved_findings"]) == 1
    assert result["resolved_findings"][0]["check_type"] == "headers_hsts"


def test_comparison_service_dns_record_changes():
    """Detects normalized changes in A, MX, SPF, and DMARC records."""
    prev_check = ScanCheck(
        check_type="dns_records",
        status="pass",
        technical_details={
            "dns_data": {
                "a_records": ["192.0.2.1"],
                "mx_records": ["mail1.example.com"],
                "spf_record": "v=spf1 include:_spf.google.com ~all",
            }
        },
    )
    prev = Scan(id=uuid.uuid4(), score=90, checks=[prev_check])

    curr_check = ScanCheck(
        check_type="dns_records",
        status="pass",
        technical_details={
            "dns_data": {
                "a_records": ["192.0.2.2"],  # Changed IP
                "mx_records": ["mail1.example.com", "mail2.example.com"],  # Added MX
                "spf_record": "v=spf1 -all",  # Changed SPF
            }
        },
    )
    curr = Scan(id=uuid.uuid4(), score=90, checks=[curr_check])

    result = compare_scans(prev, curr)
    dns_diff = {d["record_type"]: d for d in result["dns_changes"]}

    assert "A" in dns_diff
    assert dns_diff["A"]["previous"] == ["192.0.2.1"]
    assert dns_diff["A"]["current"] == ["192.0.2.2"]
    assert "MX" in dns_diff
    assert "SPF" in dns_diff


def test_comparison_service_security_headers_removed():
    """Detects when essential security headers like HSTS or CSP are removed."""
    prev_hsts = ScanCheck(check_type="hsts", name="Strict-Transport-Security", status="pass")
    prev_csp = ScanCheck(check_type="csp", name="Content-Security-Policy", status="pass")
    prev = Scan(id=uuid.uuid4(), score=95, checks=[prev_hsts, prev_csp])

    curr_hsts = ScanCheck(check_type="hsts", name="Strict-Transport-Security", status="fail")
    curr_csp = ScanCheck(check_type="csp", name="Content-Security-Policy", status="fail")
    curr = Scan(id=uuid.uuid4(), score=80, checks=[curr_hsts, curr_csp])

    result = compare_scans(prev, curr)
    header_diff = {h["header_type"]: h for h in result["header_changes"]}

    assert "hsts" in header_diff
    assert header_diff["hsts"]["change"] == "removed"
    assert header_diff["hsts"]["severity"] == "high"

    assert "csp" in header_diff
    assert header_diff["csp"]["change"] == "removed"
    assert header_diff["csp"]["severity"] == "high"


def test_comparison_service_ssl_expiration_thresholds():
    """Generates appropriate alert levels for SSL expiring in 30, 14, 7 days or expired."""
    prev = Scan(id=uuid.uuid4(), score=90, checks=[])

    # 25 days remaining (< 30) -> warning
    curr_30 = Scan(
        id=uuid.uuid4(),
        score=90,
        checks=[
            ScanCheck(
                check_type="ssl_expiration",
                status="pass",
                technical_details={"days_remaining": 25},
            )
        ],
    )
    res_30 = compare_scans(prev, curr_30)
    assert any(s["bucket"] == "30_days" and s["severity"] == "warning" for s in res_30["ssl_changes"])

    # 10 days remaining (< 14) -> high
    curr_14 = Scan(
        id=uuid.uuid4(),
        score=90,
        checks=[
            ScanCheck(
                check_type="ssl_expiration",
                status="pass",
                technical_details={"days_remaining": 10},
            )
        ],
    )
    res_14 = compare_scans(prev, curr_14)
    assert any(s["bucket"] == "14_days" and s["severity"] == "high" for s in res_14["ssl_changes"])

    # 5 days remaining (< 7) -> critical
    curr_7 = Scan(
        id=uuid.uuid4(),
        score=90,
        checks=[
            ScanCheck(
                check_type="ssl_expiration",
                status="warning",
                technical_details={"days_remaining": 5},
            )
        ],
    )
    res_7 = compare_scans(prev, curr_7)
    assert any(s["bucket"] == "7_days" and s["severity"] == "critical" for s in res_7["ssl_changes"])

    # Expired (-2 days) -> critical
    curr_exp = Scan(
        id=uuid.uuid4(),
        score=50,
        checks=[
            ScanCheck(
                check_type="ssl_expiration",
                status="critical",
                technical_details={"days_remaining": -2},
            )
        ],
    )
    res_exp = compare_scans(prev, curr_exp)
    assert any(s["bucket"] == "expired" and s["severity"] == "critical" for s in res_exp["ssl_changes"])
    res_exp = compare_scans(prev, curr_exp)
    assert any(s["bucket"] == "expired" and s["severity"] == "critical" for s in res_exp["ssl_changes"])


# =========================================================================
# 2. ALERT DEDUPLICATION & FINGERPRINTING TESTS
# =========================================================================

def test_alert_fingerprint_generation_is_stable():
    """Fingerprint generation produces deterministic 64-char hex strings."""
    site_id = uuid.uuid4()
    fp1 = generate_alert_fingerprint("score_drop", site_id, "score:-10")
    fp2 = generate_alert_fingerprint("score_drop", site_id, "score:-10")
    fp3 = generate_alert_fingerprint("score_drop", site_id, "score:-15")

    assert fp1 == fp2
    assert fp1 != fp3
    assert len(fp1) == 64


def test_alert_deduplication_skips_unread_duplicate():
    """Does not create duplicate alerts when an unread alert with the same fingerprint exists."""
    tenant = create_tenant("pro")
    res = tenant["client"].post(
        "/api/v1/websites",
        json={"domain": "dedup-skip.com"},
        headers={"Authorization": tenant["auth_header"]},
    )
    site_id = uuid.UUID(res.json()["id"])

    with TestSyncSessionLocal() as sync_db:
        # Create first alert
        alert1, created1 = create_alert_if_not_duplicate(
            db=sync_db,
            organization_id=tenant["org_id"],
            website_id=site_id,
            alert_type="score_drop",
            change_token="drop_8",
            severity="high",
            title="Score dropped by 8 points",
            message="Score fell from 90 to 82",
        )
        assert created1 is True
        assert alert1 is not None

        # Attempt to create duplicate alert with exact same condition
        alert2, created2 = create_alert_if_not_duplicate(
            db=sync_db,
            organization_id=tenant["org_id"],
            website_id=site_id,
            alert_type="score_drop",
            change_token="drop_8",
            severity="high",
            title="Score dropped by 8 points",
            message="Score fell from 90 to 82",
        )
        assert created2 is False
        assert alert2 is None


def test_alert_deduplication_allows_alert_after_read_or_dismissal():
    """Allows creating a new alert if the prior alert was resolved/dismissed/read."""
    tenant = create_tenant("pro")
    res = tenant["client"].post(
        "/api/v1/websites",
        json={"domain": "dedup-read.com"},
        headers={"Authorization": tenant["auth_header"]},
    )
    site_id = uuid.UUID(res.json()["id"])

    with TestSyncSessionLocal() as sync_db:
        alert1, created1 = create_alert_if_not_duplicate(
            db=sync_db,
            organization_id=tenant["org_id"],
            website_id=site_id,
            alert_type="header_removed",
            change_token="csp_removed",
            severity="medium",
            title="CSP Header Removed",
            message="Content-Security-Policy is missing",
        )
        assert created1 is True

        # User reads and dismisses alert
        alert1.status = "read"
        sync_db.commit()

        # Same change token now creates a new alert since previous was acknowledged
        alert2, created2 = create_alert_if_not_duplicate(
            db=sync_db,
            organization_id=tenant["org_id"],
            website_id=site_id,
            alert_type="header_removed",
            change_token="csp_removed",
            severity="medium",
            title="CSP Header Removed",
            message="Content-Security-Policy is missing",
        )
        assert created2 is True
        assert alert2 is not None
        assert alert2.id != alert1.id


def test_alert_cross_organization_isolation():
    """Alert fingerprints do not collide across different organizations."""
    t1 = create_tenant("pro")
    t2 = create_tenant("pro")
    res1 = t1["client"].post(
        "/api/v1/websites",
        json={"domain": "cross-org-1.com"},
        headers={"Authorization": t1["auth_header"]},
    )
    res2 = t2["client"].post(
        "/api/v1/websites",
        json={"domain": "cross-org-2.com"},
        headers={"Authorization": t2["auth_header"]},
    )
    site1_id = uuid.UUID(res1.json()["id"])
    site2_id = uuid.UUID(res2.json()["id"])

    with TestSyncSessionLocal() as sync_db:
        a1, c1 = create_alert_if_not_duplicate(
            db=sync_db,
            organization_id=t1["org_id"],
            website_id=site1_id,
            alert_type="ssl_expiring",
            change_token="ssl_30d",
            severity="warning",
            title="SSL Expiring",
            message="Expires in 20 days",
        )
        a2, c2 = create_alert_if_not_duplicate(
            db=sync_db,
            organization_id=t2["org_id"],
            website_id=site2_id,
            alert_type="ssl_expiring",
            change_token="ssl_30d",
            severity="warning",
            title="SSL Expiring",
            message="Expires in 20 days",
        )

        assert c1 is True and a1 is not None
        assert c2 is True and a2 is not None
        assert a1.organization_id == t1["org_id"]
        assert a2.organization_id == t2["org_id"]


# =========================================================================
# 3. API ENDPOINTS & PLAN ENTITLEMENT GATES
# =========================================================================

def test_api_free_tier_cannot_enable_monitoring():
    """Free tier users receive 403 Forbidden when attempting to enable monitoring."""
    t = create_tenant("free")
    # Create website
    res = t["client"].post(
        "/api/v1/websites",
        json={"domain": "example-free-mon.com"},
        headers={"Authorization": t["auth_header"]},
    )
    assert res.status_code == 201
    site_id = res.json()["id"]

    mon_res = t["client"].post(
        f"/api/v1/websites/{site_id}/monitoring",
        json={"frequency": "weekly"},
        headers={"Authorization": t["auth_header"]},
    )
    assert mon_res.status_code == 403
    assert mon_res.json()["detail"]["error"]["code"] == "FEATURE_UPGRADE_REQUIRED"


def test_api_basic_tier_can_enable_monitoring_weekly():
    """Basic tier users can enable weekly monitoring (201 Created)."""
    t = create_tenant("basic")
    res = t["client"].post(
        "/api/v1/websites",
        json={"domain": "example-basic-mon.com"},
        headers={"Authorization": t["auth_header"]},
    )
    assert res.status_code == 201
    site_id = res.json()["id"]

    mon_res = t["client"].post(
        f"/api/v1/websites/{site_id}/monitoring",
        json={"frequency": "weekly"},
        headers={"Authorization": t["auth_header"]},
    )
    assert mon_res.status_code == 201
    data = mon_res.json()
    assert data["is_active"] is True
    assert data["frequency"] == "weekly"
    assert data["status"] == "active"
    assert data["next_run_at"] is not None


def test_api_pro_tier_can_enable_monitoring_daily():
    """Pro tier users can enable daily monitoring (201 Created)."""
    t = create_tenant("pro")
    res = t["client"].post(
        "/api/v1/websites",
        json={"domain": "example-pro-mon.com"},
        headers={"Authorization": t["auth_header"]},
    )
    assert res.status_code == 201
    site_id = res.json()["id"]

    mon_res = t["client"].post(
        f"/api/v1/websites/{site_id}/monitoring",
        json={"frequency": "daily"},
        headers={"Authorization": t["auth_header"]},
    )
    assert mon_res.status_code == 201
    data = mon_res.json()
    assert data["is_active"] is True
    assert data["frequency"] == "daily"


def test_api_cross_tenant_monitoring_access_returns_404():
    """A tenant cannot view, enable, patch, or delete monitoring for another tenant's website (404 IDOR)."""
    t1 = create_tenant("pro")
    t2 = create_tenant("pro")

    res1 = t1["client"].post(
        "/api/v1/websites",
        json={"domain": "tenant1-secret.com"},
        headers={"Authorization": t1["auth_header"]},
    )
    site1_id = res1.json()["id"]

    # Enable monitoring by tenant 1
    t1["client"].post(
        f"/api/v1/websites/{site1_id}/monitoring",
        json={"frequency": "weekly"},
        headers={"Authorization": t1["auth_header"]},
    )

    # Tenant 2 attempts GET monitoring
    get_res = t2["client"].get(
        f"/api/v1/websites/{site1_id}/monitoring",
        headers={"Authorization": t2["auth_header"]},
    )
    assert get_res.status_code == 404

    # Tenant 2 attempts PATCH monitoring
    patch_res = t2["client"].patch(
        f"/api/v1/websites/{site1_id}/monitoring",
        json={"is_active": False},
        headers={"Authorization": t2["auth_header"]},
    )
    assert patch_res.status_code == 404

    # Tenant 2 attempts DELETE monitoring
    del_res = t2["client"].delete(
        f"/api/v1/websites/{site1_id}/monitoring",
        headers={"Authorization": t2["auth_header"]},
    )
    assert del_res.status_code == 404


def test_api_patch_and_delete_monitoring():
    """Allows pausing and updating frequency, and deactivating via DELETE."""
    t = create_tenant("pro")
    res = t["client"].post(
        "/api/v1/websites",
        json={"domain": "example-patch-mon.com"},
        headers={"Authorization": t["auth_header"]},
    )
    site_id = res.json()["id"]

    # Enable
    t["client"].post(
        f"/api/v1/websites/{site_id}/monitoring",
        json={"frequency": "weekly"},
        headers={"Authorization": t["auth_header"]},
    )

    # Patch: change frequency to daily and pause
    patch_res = t["client"].patch(
        f"/api/v1/websites/{site_id}/monitoring",
        json={"frequency": "daily", "is_active": False},
        headers={"Authorization": t["auth_header"]},
    )
    assert patch_res.status_code == 200
    pdata = patch_res.json()
    assert pdata["frequency"] == "daily"
    assert pdata["is_active"] is False
    assert pdata["status"] == "paused"

    # Delete (deactivates)
    del_res = t["client"].delete(
        f"/api/v1/websites/{site_id}/monitoring",
        headers={"Authorization": t["auth_header"]},
    )
    assert del_res.status_code == 204

    # Verify website is updated
    site_check = t["client"].get(f"/api/v1/websites/{site_id}", headers={"Authorization": t["auth_header"]})
    assert site_check.status_code == 200
    assert site_check.json()["monitoring_enabled"] is False


def test_api_list_websites_serializes_monitoring_object():
    """GET /api/v1/websites returns monitoring nested object."""
    t = create_tenant("pro")
    res = t["client"].post(
        "/api/v1/websites",
        json={"domain": "serialized-mon.com"},
        headers={"Authorization": t["auth_header"]},
    )
    site_id = res.json()["id"]

    t["client"].post(
        f"/api/v1/websites/{site_id}/monitoring",
        json={"frequency": "weekly"},
        headers={"Authorization": t["auth_header"]},
    )

    list_res = t["client"].get("/api/v1/websites", headers={"Authorization": t["auth_header"]})
    assert list_res.status_code == 200
    items = [x for x in list_res.json() if x["id"] == site_id]
    assert len(items) == 1
    assert items[0]["monitoring_enabled"] is True
    assert items[0]["monitoring"] is not None
    assert items[0]["monitoring"]["frequency"] == "weekly"
    assert items[0]["monitoring"]["status"] == "active"


# =========================================================================
# 4. MONITORING ORCHESTRATION & QUOTA ENFORCEMENT TESTS
# =========================================================================

def test_monitoring_orchestration_quota_exhausted():
    """If monthly scan quota is exhausted, monitoring run is postponed and audited without scanning."""
    t = create_tenant("basic")
    res = t["client"].post(
        "/api/v1/websites",
        json={"domain": "quota-exhausted.com"},
        headers={"Authorization": t["auth_header"]},
    )
    site_id = uuid.UUID(res.json()["id"])

    # Enable monitoring
    t["client"].post(
        f"/api/v1/websites/{site_id}/monitoring",
        json={"frequency": "weekly"},
        headers={"Authorization": t["auth_header"]},
    )

    # Exhaust monthly scan quota in UsageRecord (Basic plan allows 100 scans)
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    with TestSyncSessionLocal() as sync_db:
        usage = sync_db.execute(
            select(UsageRecord).where(
                UsageRecord.organization_id == t["org_id"],
                UsageRecord.period_month == current_month,
            )
        ).scalar_one_or_none()
        if not usage:
            usage = UsageRecord(
                id=uuid.uuid4(),
                organization_id=t["org_id"],
                period_month=current_month,
                scans_count=100,
            )
            sync_db.add(usage)
        else:
            usage.scans_count = 100
        sync_db.commit()

        # Attempt to run monitored scan
        result = run_monitored_scan_for_website(site_id, sync_db)
        assert result is None

        # Verify monitoring next_run_at postponed by ~24 hours
        mon = sync_db.execute(select(Monitoring).where(Monitoring.website_id == site_id)).scalar_one()
        next_dt = mon.next_run_at.replace(tzinfo=timezone.utc) if mon.next_run_at.tzinfo is None else mon.next_run_at
        assert next_dt > datetime.now(timezone.utc) + timedelta(hours=20)

        # Verify audit log recorded
        audit = sync_db.execute(
            select(AuditLog).where(
                AuditLog.organization_id == t["org_id"],
                AuditLog.action == "MONITORING_SKIPPED_QUOTA",
            )
        ).scalar_one_or_none()
        assert audit is not None


def test_monitoring_orchestration_baseline_run():
    """First monitoring execution records baseline scan without generating false alerts."""
    t = create_tenant("pro")
    res = t["client"].post(
        "/api/v1/websites",
        json={"domain": "baseline-test.com"},
        headers={"Authorization": t["auth_header"]},
    )
    site_id = uuid.UUID(res.json()["id"])

    # Enable monitoring
    t["client"].post(
        f"/api/v1/websites/{site_id}/monitoring",
        json={"frequency": "daily"},
        headers={"Authorization": t["auth_header"]},
    )

    with TestSyncSessionLocal() as sync_db:
        def fake_baseline_scan_job(scan_id, db):
            scan = db.execute(select(Scan).where(Scan.id == scan_id)).scalar_one()
            scan.status = "completed"
            scan.score = 92
            scan.completed_at = datetime.now(timezone.utc)
            check = ScanCheck(
                id=uuid.uuid4(),
                scan_id=scan.id,
                check_type="ssl_tls",
                name="SSL/TLS Configuration",
                status="pass",
                severity="high",
                title="SSL OK",
                summary="Valid SSL certificate",
            )
            db.add(check)
            db.commit()
            db.refresh(scan)
            return scan

        with patch("app.services.monitoring_service.execute_scan_job", side_effect=fake_baseline_scan_job):
            completed = run_monitored_scan_for_website(site_id, sync_db)

        assert completed is not None
        assert completed.status == "completed"

        # Check monitoring record state
        mon = sync_db.execute(select(Monitoring).where(Monitoring.website_id == site_id)).scalar_one()
        assert mon.status == "active"
        assert mon.last_success_at is not None
        assert mon.last_scan_id == completed.id

        # No alerts should be generated on baseline
        alerts = sync_db.execute(
            select(Alert).where(Alert.organization_id == t["org_id"], Alert.website_id == site_id)
        ).scalars().all()
        assert len(alerts) == 0


def test_monitoring_orchestration_diff_alert_creation():
    """Follow-up monitoring execution detects score drop and header removal and generates alerts."""
    t = create_tenant("pro")
    res = t["client"].post(
        "/api/v1/websites",
        json={"domain": "diff-alert.com"},
        headers={"Authorization": t["auth_header"]},
    )
    site_id = uuid.UUID(res.json()["id"])

    t["client"].post(
        f"/api/v1/websites/{site_id}/monitoring",
        json={"frequency": "weekly"},
        headers={"Authorization": t["auth_header"]},
    )

    # 1. Establish baseline scan in DB
    prev_scan = create_mock_scan(
        org_id=t["org_id"],
        site_id=site_id,
        domain="diff-alert.com",
        score=95,
        checks_data=[
            {
                "check_type": "hsts",
                "name": "Strict-Transport-Security",
                "status": "pass",
                "summary": "HSTS is active",
            }
        ],
    )

    with TestSyncSessionLocal() as sync_db:
        # 2. Mock scanner job to update the newly created scan with score 80 (-15 pt drop) and removed HSTS
        def fake_diff_scan_job(scan_id, db):
            scan = db.execute(select(Scan).where(Scan.id == scan_id)).scalar_one()
            scan.status = "completed"
            scan.score = 80
            scan.completed_at = datetime.now(timezone.utc)
            check = ScanCheck(
                id=uuid.uuid4(),
                scan_id=scan.id,
                check_type="hsts",
                name="Strict-Transport-Security",
                status="fail",
                severity="high",
                title="Missing HSTS",
                summary="HSTS header was removed",
            )
            db.add(check)
            db.commit()
            db.refresh(scan)
            return scan

        with patch("app.services.monitoring_service.execute_scan_job", side_effect=fake_diff_scan_job):
            with patch("app.services.monitoring_service.send_score_drop_alert"):
                with patch("app.services.monitoring_service.send_email"):
                    completed = run_monitored_scan_for_website(site_id, sync_db)

        assert completed is not None

        # Verify alerts created: score_drop and header_removed
        alerts = sync_db.execute(
            select(Alert).where(Alert.organization_id == t["org_id"], Alert.website_id == site_id)
        ).scalars().all()

        types = [a.type for a in alerts]
        assert "score_drop" in types
        assert "header_removed" in types


def test_monitoring_orchestration_scanner_error_handling():
    """Handles scanner failures gracefully by marking status=error and recording last_error."""
    t = create_tenant("pro")
    res = t["client"].post(
        "/api/v1/websites",
        json={"domain": "scanner-fails.com"},
        headers={"Authorization": t["auth_header"]},
    )
    site_id = uuid.UUID(res.json()["id"])

    t["client"].post(
        f"/api/v1/websites/{site_id}/monitoring",
        json={"frequency": "weekly"},
        headers={"Authorization": t["auth_header"]},
    )

    with TestSyncSessionLocal() as sync_db:
        def fake_failing_scan_job(scan_id, db):
            scan = db.execute(select(Scan).where(Scan.id == scan_id)).scalar_one()
            scan.status = "failed"
            scan.error_message = "Connection timed out after 30s"
            db.commit()
            db.refresh(scan)
            return scan

        with patch("app.services.monitoring_service.execute_scan_job", side_effect=fake_failing_scan_job):
            completed = run_monitored_scan_for_website(site_id, sync_db)

        mon = sync_db.execute(select(Monitoring).where(Monitoring.website_id == site_id)).scalar_one()
        assert mon.status == "error"
        assert mon.last_failure_at is not None
        assert "timed out" in mon.last_error

        # Audit event recorded
        audit = sync_db.execute(
            select(AuditLog).where(
                AuditLog.organization_id == t["org_id"],
                AuditLog.action == "MONITORING_SCAN_FAILED",
            )
        ).scalar_one_or_none()
        assert audit is not None


# =========================================================================
# 5. CELERY BEAT SCHEDULER & WORKER TASK TESTS
# =========================================================================

def test_scheduler_queries_and_dispatches_due_records():
    """Celery Beat schedule_monitored_scans_task queries due records and dispatches run_monitoring_scan_task."""
    t = create_tenant("pro")
    res = t["client"].post(
        "/api/v1/websites",
        json={"domain": "sched-due.com"},
        headers={"Authorization": t["auth_header"]},
    )
    site_id = uuid.UUID(res.json()["id"])

    # Create monitoring record that is DUE (next_run_at in the past)
    with TestSyncSessionLocal() as sync_db:
        site = sync_db.execute(select(Website).where(Website.id == site_id)).scalar_one()
        site.monitoring_enabled = True
        mon = Monitoring(
            id=uuid.uuid4(),
            website_id=site_id,
            organization_id=t["org_id"],
            frequency="weekly",
            enabled=True,
            status="active",
            next_run_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        sync_db.add(mon)
        sync_db.commit()

    with patch("app.tasks.worker.run_monitoring_scan_task.delay") as mock_delay:
        sched_res = schedule_monitored_scans_task()

    assert sched_res["scheduled_count"] >= 1
    mock_delay.assert_called_with(str(site_id))

    # Verify next_run_at was atomically advanced to prevent re-enqueueing race condition
    with TestSyncSessionLocal() as sync_db:
        mon_after = sync_db.execute(select(Monitoring).where(Monitoring.website_id == site_id)).scalar_one()
        after_dt = mon_after.next_run_at.replace(tzinfo=timezone.utc) if mon_after.next_run_at.tzinfo is None else mon_after.next_run_at
        assert after_dt > datetime.now(timezone.utc)


def test_scheduler_ignores_paused_and_future_records():
    """Scheduler task does not dispatch scans for paused or future-scheduled websites."""
    t = create_tenant("pro")
    res1 = t["client"].post("/api/v1/websites", json={"domain": "paused.com"}, headers={"Authorization": t["auth_header"]})
    res2 = t["client"].post("/api/v1/websites", json={"domain": "future.com"}, headers={"Authorization": t["auth_header"]})
    id_paused = uuid.UUID(res1.json()["id"])
    id_future = uuid.UUID(res2.json()["id"])

    with TestSyncSessionLocal() as sync_db:
        s1 = sync_db.execute(select(Website).where(Website.id == id_paused)).scalar_one()
        s1.monitoring_enabled = True
        s2 = sync_db.execute(select(Website).where(Website.id == id_future)).scalar_one()
        s2.monitoring_enabled = True

        # Paused record
        sync_db.add(
            Monitoring(
                id=uuid.uuid4(),
                website_id=id_paused,
                organization_id=t["org_id"],
                frequency="weekly",
                enabled=False,  # PAUSED
                status="paused",
                next_run_at=datetime.now(timezone.utc) - timedelta(hours=2),
            )
        )
        # Future record
        sync_db.add(
            Monitoring(
                id=uuid.uuid4(),
                website_id=id_future,
                organization_id=t["org_id"],
                frequency="weekly",
                enabled=True,
                status="active",
                next_run_at=datetime.now(timezone.utc) + timedelta(days=5),  # FUTURE
            )
        )
        sync_db.commit()

    with patch("app.tasks.worker.run_monitoring_scan_task.delay") as mock_delay:
        schedule_monitored_scans_task()

    # Neither paused nor future ID should have been dispatched
    called_args = [call.args[0] for call in mock_delay.call_args_list]
    assert str(id_paused) not in called_args
    assert str(id_future) not in called_args


def test_celery_worker_task_retry_configuration():
    """Verifies that run_monitoring_scan_task has retry attributes configured for resilient execution."""
    assert hasattr(run_monitoring_scan_task, "max_retries")
    assert run_monitoring_scan_task.max_retries == 2
    assert run_monitoring_scan_task.default_retry_delay == 30
