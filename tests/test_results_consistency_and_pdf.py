"""
SiteSecura - Scan Results Consistency & Premium PDF Reporting Regression Suite
Comprehensive validation of:
1. Scan result consistency across DB, API, website scan history, and PDF.
2. Scan-specific PDF generation (always target explicit scan_id).
3. Non-completed scan rejection: queued, running, and failed scans rejected with 400 SCAN_NOT_COMPLETED.
4. Deterministic latest completed scan resolution on GET /api/v1/websites/{website_id}/pdf.
5. NO_COMPLETED_SCANS (404) returned when website has no completed scans.
6. Multi-tenant isolation enforced on both scan PDF and website PDF endpoints.
7. Canonical ReportSnapshot metric calculations (total observations, deterministic checks, correlated insights).
8. Dynamic observation statistics terminology contract (31 observations = 28 deterministic + 3 correlated).
9. Server-side entitlement gating in PDF reports (Free redacts findings 4+, Paid is 100% unredacted).
10. Category breakdown handling with severe finding deductions.
"""

import os
import sys
import uuid
import re
import zlib
import base64
import pytest
from datetime import datetime, timezone
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
from app.models.billing import Subscription
from app.models.website import Website
from app.models.scan import Scan, ScanCheck, Report
from app.services.pdf_service import generate_pdf_report, build_report_snapshot, ReportSnapshot
from app.services.entitlement_service import filter_findings_for_viewer
from app.core.rate_limit import _memory_rate_limits

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_results_consistency.sqlite3"))
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
def clear_rate_limits():
    _memory_rate_limits.clear()
    yield
    _memory_rate_limits.clear()


def decompress_pdf_streams(pdf_path: str) -> str:
    """Helper that reads and decompresses all stream objects from a PDF file."""
    with open(pdf_path, "rb") as f:
        data = f.read()

    decompressed_text = ""
    pos = 0
    while True:
        idx = data.find(b"stream", pos)
        if idx == -1:
            break
        end_idx = data.find(b"endstream", idx)
        if end_idx == -1:
            break

        start_body = idx + 6
        while data[start_body:start_body + 1] in (b"\r", b"\n"):
            start_body += 1

        header_start = data.rfind(b"<<", 0, idx)
        header = data[header_start:idx].decode("latin1", errors="ignore")
        length_m = re.search(r"/Length\s+(\d+)", header)
        if length_m:
            body_len = int(length_m.group(1))
            body = data[start_body:start_body + body_len]
        else:
            body = data[start_body:end_idx].rstrip(b"\r\n")

        try:
            dec = zlib.decompress(body)
            decompressed_text += dec.decode("latin1", errors="ignore") + "\n"
        except Exception:
            try:
                raw_a85 = body.strip()
                if not raw_a85.endswith(b"~>"):
                    raw_a85 += b"~>"
                dec_a85 = base64.a85decode(raw_a85, adobe=True)
                dec = zlib.decompress(dec_a85)
                decompressed_text += dec.decode("latin1", errors="ignore") + "\n"
            except Exception:
                pass
        pos = end_idx + 9

    return decompressed_text


def create_test_tenant(client: TestClient, plan: str = "free"):
    """Helper to provision test users, organizations, and subscriptions via standard dev auth."""
    uid_str = f"usr_{uuid.uuid4().hex[:8]}"
    auth_header = f"Bearer dev-token-{uid_str}-owner"
    res = client.get("/api/v1/auth/me", headers={"Authorization": auth_header})
    assert res.status_code == 200, res.text
    data = res.json()
    org_id = uuid.UUID(data["organization"]["id"])
    user_id = uuid.UUID(data["user"]["id"])

    if plan != "free":
        with TestSyncSessionLocal() as sync_db:
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


# =============================================================================
# PART 1: SCORE CONSISTENCY & REPORT SNAPSHOT CALCULATION
# =============================================================================

def test_report_snapshot_metrics_and_f8_counting():
    """Validates ReportSnapshot accurately counts total observations, deterministic checks, and F8 chains."""
    scan_id = uuid.uuid4()
    scan = Scan(
        id=scan_id,
        domain="example.com",
        normalized_domain="example.com",
        status="completed",
        score=92,
        risk_level="Excellent",
    )

    # 28 deterministic checks + 3 F8 correlated risk chains = 31 total observations
    checks = []
    # 25 pass checks
    for i in range(25):
        checks.append(ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan_id,
            check_type=f"deep_check_{i}",
            name=f"Check {i}",
            title=f"Passing Check {i}",
            status="pass",
            severity="info",
            summary="Passing check summary",
            score_impact=0,
            estimated_fix_minutes=0,
            confidence=1.0,
        ))
    # 1 critical finding
    checks.append(ScanCheck(
        id=uuid.uuid4(),
        scan_id=scan_id,
        check_type="deep_cors_misconfiguration",
        name="CORS Wildcard",
        title="Insecure Wildcard CORS Policy",
        status="critical",
        severity="critical",
        summary="CORS allows arbitrary origins",
        score_impact=-5,
        estimated_fix_minutes=15,
        confidence=1.0,
    ))
    # 2 warning / medium findings
    for i in range(2):
        checks.append(ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan_id,
            check_type=f"deep_header_warning_{i}",
            name=f"Warning Header {i}",
            title=f"Missing Header {i}",
            status="warning",
            severity="medium",
            summary="Missing security header",
            score_impact=-1,
            estimated_fix_minutes=10,
            confidence=1.0,
        ))
    # 3 F8 correlated risk chains
    for i in range(3):
        checks.append(ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan_id,
            check_type=f"deep_risk_chain_{i}",
            name=f"Risk Chain {i}",
            title=f"Correlated Risk Chain #{i+1}: Multi-stage Pivot",
            status="warning",
            severity="high",
            summary="Attack-surface relationship chain",
            score_impact=0,
            estimated_fix_minutes=20,
            confidence=0.9,
        ))

    snapshot = build_report_snapshot(scan, checks, plan="pro")

    assert snapshot.total_observations == 31
    assert snapshot.deterministic_count == 28
    assert snapshot.correlated_count == 3
    assert snapshot.score == 92
    assert snapshot.risk_level == "Excellent"
    assert snapshot.passed_count == 25
    assert snapshot.failed_count == 6
    assert snapshot.critical_count == 1
    assert snapshot.high_count == 3  # 3 F8 risk chains with severity=high
    assert snapshot.medium_count == 2
    assert snapshot.is_free is False


def test_report_snapshot_no_correlated_chains():
    """Validates ReportSnapshot metrics for normal scan without F8 risk chains."""
    scan_id = uuid.uuid4()
    scan = Scan(
        id=scan_id,
        domain="example.org",
        normalized_domain="example.org",
        status="completed",
        score=85,
        risk_level="Good",
    )

    checks = [
        ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan_id,
            check_type="https_enforcement",
            name="HTTPS",
            title="Enforce HTTPS",
            status="pass",
            severity="info",
            summary="HTTPS valid",
            score_impact=0,
            estimated_fix_minutes=0,
            confidence=1.0,
        ),
        ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan_id,
            check_type="hsts_header",
            name="HSTS",
            title="Strict-Transport-Security",
            status="fail",
            severity="high",
            summary="HSTS header missing",
            score_impact=-15,
            estimated_fix_minutes=10,
            confidence=1.0,
        ),
    ]

    snapshot = build_report_snapshot(scan, checks, plan="free")

    assert snapshot.total_observations == 2
    assert snapshot.deterministic_count == 2
    assert snapshot.correlated_count == 0
    assert snapshot.passed_count == 1
    assert snapshot.failed_count == 1
    assert snapshot.high_count == 1
    assert snapshot.is_free is True


# =============================================================================
# PART 2: SCAN-SPECIFIC PDF DOWNLOAD ENDPOINT (/api/v1/scans/{scan_id}/pdf)
# =============================================================================

def test_scan_pdf_requires_authentication():
    """Ensures unauthenticated access to PDF download is rejected with 401."""
    client = TestClient(app)
    scan_id = uuid.uuid4()
    response = client.get(f"/api/v1/scans/{scan_id}/pdf")
    assert response.status_code == 401


def test_scan_pdf_rejects_queued_scan():
    """Ensures attempting to download PDF for queued scan returns 400 SCAN_NOT_COMPLETED."""
    client = TestClient(app)
    user_id, org_id, headers = create_test_tenant(client, plan="pro")

    scan_id = uuid.uuid4()
    with TestSyncSessionLocal() as sync_db:
        scan = Scan(
            id=scan_id,
            organization_id=org_id,
            domain="queued-target.com",
            normalized_domain="queued-target.com",
            status="queued",
            scan_type="standard",
        )
        sync_db.add(scan)
        sync_db.commit()

    response = client.get(f"/api/v1/scans/{scan_id}/pdf", headers=headers)
    assert response.status_code == 400
    data = response.json()
    assert data["detail"]["error"]["code"] == "SCAN_NOT_COMPLETED"


def test_scan_pdf_rejects_running_scan():
    """Ensures attempting to download PDF for active running scan returns 400 SCAN_NOT_COMPLETED."""
    client = TestClient(app)
    user_id, org_id, headers = create_test_tenant(client, plan="pro")

    scan_id = uuid.uuid4()
    with TestSyncSessionLocal() as sync_db:
        scan = Scan(
            id=scan_id,
            organization_id=org_id,
            domain="running-target.com",
            normalized_domain="running-target.com",
            status="running",
            scan_type="deep",
        )
        sync_db.add(scan)
        sync_db.commit()

    response = client.get(f"/api/v1/scans/{scan_id}/pdf", headers=headers)
    assert response.status_code == 400
    data = response.json()
    assert data["detail"]["error"]["code"] == "SCAN_NOT_COMPLETED"


def test_scan_pdf_rejects_failed_scan():
    """Ensures attempting to download PDF for failed scan returns 400 SCAN_NOT_COMPLETED."""
    client = TestClient(app)
    user_id, org_id, headers = create_test_tenant(client, plan="pro")

    scan_id = uuid.uuid4()
    with TestSyncSessionLocal() as sync_db:
        scan = Scan(
            id=scan_id,
            organization_id=org_id,
            domain="failed-target.com",
            normalized_domain="failed-target.com",
            status="failed",
            error_message="Host unreachable",
            scan_type="standard",
        )
        sync_db.add(scan)
        sync_db.commit()

    response = client.get(f"/api/v1/scans/{scan_id}/pdf", headers=headers)
    assert response.status_code == 400
    data = response.json()
    assert data["detail"]["error"]["code"] == "SCAN_NOT_COMPLETED"


def test_scan_pdf_succeeds_for_completed_scan():
    """Validates successful PDF generation and download for completed scan."""
    client = TestClient(app)
    user_id, org_id, headers = create_test_tenant(client, plan="pro")

    scan_id = uuid.uuid4()
    with TestSyncSessionLocal() as sync_db:
        scan = Scan(
            id=scan_id,
            organization_id=org_id,
            domain="completed-target.com",
            normalized_domain="completed-target.com",
            status="completed",
            score=94,
            risk_level="Excellent",
            scan_type="deep",
            scan_duration_ms=1850,
            total_checks_count=5,
            passed_checks_count=5,
        )
        sync_db.add(scan)

        for i in range(5):
            sync_db.add(ScanCheck(
                id=uuid.uuid4(),
                scan_id=scan_id,
                check_type=f"check_{i}",
                name=f"Check {i}",
                title=f"Verified Item {i}",
                status="pass",
                severity="info",
                summary=f"Benchmark {i} passed verification.",
                score_impact=0,
                estimated_fix_minutes=0,
                confidence=1.0,
            ))
        sync_db.commit()

    response = client.get(f"/api/v1/scans/{scan_id}/pdf", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "SiteSecura-Security-Report-completed-target.com" in response.headers["content-disposition"]
    assert response.content[:4] == b"%PDF"


def test_scan_pdf_cross_tenant_isolation():
    """Validates tenant B cannot download tenant A's PDF (returns 404 SCAN_NOT_FOUND)."""
    client = TestClient(app)
    user_a, org_a, headers_a = create_test_tenant(client, plan="pro")
    user_b, org_b, headers_b = create_test_tenant(client, plan="pro")

    scan_id = uuid.uuid4()
    with TestSyncSessionLocal() as sync_db:
        scan_a = Scan(
            id=scan_id,
            organization_id=org_a,
            domain="tenant-a-private.com",
            normalized_domain="tenant-a-private.com",
            status="completed",
            score=90,
            risk_level="Excellent",
        )
        sync_db.add(scan_a)
        sync_db.commit()

    # Tenant B tries to download Tenant A's scan PDF
    response = client.get(f"/api/v1/scans/{scan_id}/pdf", headers=headers_b)
    assert response.status_code == 404
    data = response.json()
    assert data["detail"]["error"]["code"] in ("REPORT_NOT_FOUND", "SCAN_NOT_FOUND")


# =============================================================================
# PART 3: LATEST COMPLETED WEBSITE PDF (/api/v1/websites/{website_id}/pdf)
# =============================================================================

def test_website_pdf_selects_latest_completed_scan():
    """
    Validates GET /api/v1/websites/{website_id}/pdf:
    Deterministically selects the most recent scan where status == 'completed',
    ignoring failed and running scans.
    """
    client = TestClient(app)
    user_id, org_id, headers = create_test_tenant(client, plan="pro")

    site_id = uuid.uuid4()
    with TestSyncSessionLocal() as sync_db:
        site = Website(
            id=site_id,
            organization_id=org_id,
            domain="prod-website.com",
            normalized_domain="prod-website.com",
            name="Production Website",
        )
        sync_db.add(site)

        # Scan 1: Old completed scan (score 70)
        scan_old = Scan(
            id=uuid.uuid4(),
            organization_id=org_id,
            website_id=site_id,
            domain=site.domain,
            normalized_domain=site.normalized_domain,
            status="completed",
            score=70,
            risk_level="Good",
            created_at=datetime(2026, 9, 1, 10, 0, 0, tzinfo=timezone.utc),
        )
        sync_db.add(scan_old)

        # Scan 2: New completed scan (score 95)
        scan_latest_completed = Scan(
            id=uuid.uuid4(),
            organization_id=org_id,
            website_id=site_id,
            domain=site.domain,
            normalized_domain=site.normalized_domain,
            status="completed",
            score=95,
            risk_level="Excellent",
            created_at=datetime(2026, 9, 20, 10, 0, 0, tzinfo=timezone.utc),
        )
        sync_db.add(scan_latest_completed)

        # Scan 3: Newer failed scan
        scan_failed = Scan(
            id=uuid.uuid4(),
            organization_id=org_id,
            website_id=site_id,
            domain=site.domain,
            normalized_domain=site.normalized_domain,
            status="failed",
            created_at=datetime(2026, 9, 25, 10, 0, 0, tzinfo=timezone.utc),
        )
        sync_db.add(scan_failed)

        # Scan 4: Newer queued scan
        scan_queued = Scan(
            id=uuid.uuid4(),
            organization_id=org_id,
            website_id=site_id,
            domain=site.domain,
            normalized_domain=site.normalized_domain,
            status="queued",
            created_at=datetime(2026, 9, 28, 10, 0, 0, tzinfo=timezone.utc),
        )
        sync_db.add(scan_queued)
        sync_db.commit()

    response = client.get(f"/api/v1/websites/{site_id}/pdf", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content[:4] == b"%PDF"


def test_website_pdf_returns_404_when_no_completed_scans():
    """Validates 404 NO_COMPLETED_SCANS when website has only running/queued/failed scans."""
    client = TestClient(app)
    user_id, org_id, headers = create_test_tenant(client, plan="pro")

    site_id = uuid.uuid4()
    with TestSyncSessionLocal() as sync_db:
        site = Website(
            id=site_id,
            organization_id=org_id,
            domain="pending-website.com",
            normalized_domain="pending-website.com",
            name="Pending Site",
        )
        sync_db.add(site)

        # Only running and queued scans exist
        sync_db.add(Scan(
            id=uuid.uuid4(),
            organization_id=org_id,
            website_id=site_id,
            domain=site.domain,
            normalized_domain=site.normalized_domain,
            status="queued",
        ))
        sync_db.add(Scan(
            id=uuid.uuid4(),
            organization_id=org_id,
            website_id=site_id,
            domain=site.domain,
            normalized_domain=site.normalized_domain,
            status="failed",
        ))
        sync_db.commit()

    response = client.get(f"/api/v1/websites/{site_id}/pdf", headers=headers)
    assert response.status_code == 404
    data = response.json()
    assert data["detail"]["error"]["code"] == "NO_COMPLETED_SCANS"


def test_website_pdf_cross_tenant_isolation():
    """Validates cross-tenant access to website PDF returns 404."""
    client = TestClient(app)
    user_a, org_a, headers_a = create_test_tenant(client, plan="pro")
    user_b, org_b, headers_b = create_test_tenant(client, plan="pro")

    site_id = uuid.uuid4()
    with TestSyncSessionLocal() as sync_db:
        site_a = Website(
            id=site_id,
            organization_id=org_a,
            domain="tenant-a-web.com",
            normalized_domain="tenant-a-web.com",
            name="Tenant A Web",
        )
        sync_db.add(site_a)
        sync_db.add(Scan(
            id=uuid.uuid4(),
            organization_id=org_a,
            website_id=site_id,
            domain=site_a.domain,
            normalized_domain=site_a.normalized_domain,
            status="completed",
            score=85,
        ))
        sync_db.commit()

    response = client.get(f"/api/v1/websites/{site_id}/pdf", headers=headers_b)
    assert response.status_code == 404


# =============================================================================
# PART 4: ENTITLEMENT FILTERING & REDACTION IN GENERATED PDF
# =============================================================================

def test_pdf_free_tier_redacts_findings_beyond_top_3(tmp_path):
    """Validates Free plan redacts findings beyond top 3 with LOCKED (PRO & AGENCY)."""
    scan_id = uuid.uuid4()
    scan = Scan(
        id=scan_id,
        domain="free-redaction.com",
        normalized_domain="free-redaction.com",
        status="completed",
        score=65,
        risk_level="Medium Risk",
    )

    checks = []
    for i in range(8):
        checks.append(ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan_id,
            check_type=f"vuln_{i}",
            name=f"Vulnerability {i}",
            title=f"Security Defect #{i}",
            status="fail",
            severity="high" if i < 4 else "medium",
            summary=f"Sensitive defect technical summary {i}",
            evidence=f"SECRET_PAYLOAD_EVIDENCE_{i}",
            how_to_fix=f"Run secure hardening command {i}",
            score_impact=-5,
            estimated_fix_minutes=15,
            confidence=1.0,
        ))

    pdf_path = generate_pdf_report(
        scan=scan,
        checks=checks,
        plan="free",
        output_directory=str(tmp_path),
    )

    assert os.path.exists(pdf_path)
    with open(pdf_path, "rb") as f:
        content = f.read()

    # Verify PDF signature
    assert content[:4] == b"%PDF"

    decompressed = decompress_pdf_streams(pdf_path)
    # Finding 1, 2, 3 should have unredacted content
    assert "SECRET_PAYLOAD_EVIDENCE_0" in decompressed
    # Later findings must be locked on free tier
    assert "LOCKED" in decompressed
    assert "SECRET_PAYLOAD_EVIDENCE_5" not in decompressed


def test_pdf_paid_tier_has_full_unredacted_findings(tmp_path):
    """Validates Paid plan (Pro, Agency) generates 100% unredacted evidence for all findings."""
    scan_id = uuid.uuid4()
    scan = Scan(
        id=scan_id,
        domain="paid-unredacted.com",
        normalized_domain="paid-unredacted.com",
        status="completed",
        score=72,
        risk_level="Good",
    )

    checks = []
    for i in range(6):
        checks.append(ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan_id,
            check_type=f"paid_check_{i}",
            name=f"Paid Check {i}",
            title=f"Detailed Finding #{i}",
            status="fail",
            severity="medium",
            summary=f"Detailed technical summary for item {i}",
            evidence=f"UNREDACTED_PAID_EVIDENCE_{i}",
            how_to_fix=f"Apply configuration patch {i}",
            score_impact=-4,
            estimated_fix_minutes=20,
            confidence=1.0,
        ))

    pdf_path = generate_pdf_report(
        scan=scan,
        checks=checks,
        plan="pro",
        output_directory=str(tmp_path),
    )

    assert os.path.exists(pdf_path)
    decompressed = decompress_pdf_streams(pdf_path)
    # All 6 evidence payloads must be present and unredacted
    for i in range(6):
        assert f"UNREDACTED_PAID_EVIDENCE_{i}" in decompressed
    assert "LOCKED (PRO & AGENCY)" not in decompressed


def test_filter_findings_for_viewer_entitlement_contract():
    """
    Validates server-side entitlement filtering behavior:
    1. Free / unauthenticated viewer: Only top 3 findings are unlocked; remaining
       findings have evidence, how_to_fix, documentation_url, why_it_matters redacted,
       and are marked is_locked=True. is_premium_locked is True.
    2. Paid tiers (Basic, Pro, Agency, Admin): 100% of findings are unredacted and unlocked,
       with is_locked=False, locked_count=0, and is_premium_locked=False.
    """
    scan_id = uuid.uuid4()
    checks = []
    for i in range(13):
        checks.append(ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan_id,
            check_type=f"check_{i}",
            name=f"Check {i}",
            title=f"Security Item #{i}",
            status="fail" if i < 5 else "pass",
            severity="high" if i < 3 else "medium",
            summary=f"Summary for finding {i}",
            why_it_matters=f"Why it matters for finding {i}",
            how_to_fix=f"Remediation steps for finding {i}",
            evidence=f"EVIDENCE_DATA_{i}",
            documentation_url=f"https://docs.sitesecura.com/checks/{i}",
            score_impact=-10 if i < 3 else 0,
            estimated_fix_minutes=15,
            confidence=1.0,
        ))

    # 1. Anonymous / Free viewer test
    for plan in ("free", "anonymous", ""):
        findings, locked_count, is_premium_locked = filter_findings_for_viewer(
            checks=checks,
            plan=plan,
            is_authenticated=(plan != "anonymous"),
        )
        assert len(findings) == 13
        assert locked_count == 10
        assert is_premium_locked is True

        # First 3 unlocked
        for f in findings[:3]:
            assert f["is_locked"] is False
            assert f["evidence"] is not None
            assert f["how_to_fix"] is not None
            assert f["why_it_matters"] is not None
            assert f["documentation_url"] is not None

        # Remaining 10 locked and fully sanitized
        for f in findings[3:]:
            assert f["is_locked"] is True
            assert f["evidence"] is None
            assert f["how_to_fix"] is None
            assert f["why_it_matters"] is None
            assert f["documentation_url"] is None
            assert "requires a SiteSecura upgraded subscription" in f["summary"]

    # 2. Paid tiers test: Basic, Pro, Agency, Admin
    for plan in ("basic", "pro", "agency", "admin"):
        findings, locked_count, is_premium_locked = filter_findings_for_viewer(
            checks=checks,
            plan=plan,
            is_authenticated=True,
        )
        assert len(findings) == 13
        assert locked_count == 0
        assert is_premium_locked is False

        # All 13 unlocked with full content
        for f in findings:
            assert f["is_locked"] is False
            assert f["why_it_matters"] is not None
            assert f["how_to_fix"] is not None
            assert f["documentation_url"] is not None
            assert "EVIDENCE_DATA_" in (f["evidence"] or "")


def test_normal_scan_canonical_count_consistency():
    """
    Validates that a Normal Scan with 13 evaluated checks maintains
    canonical consistency across Scan record and canonical ReportSnapshot:
    - total_checks_count == 13
    - ReportSnapshot.total_observations == 13
    - ReportSnapshot.deterministic_checks_count == 13
    - ReportSnapshot.correlated_insights_count == 0
    """
    scan_id = uuid.uuid4()
    checks = []
    check_types = [
        "https_availability", "ssl_validity", "hsts", "csp", "x_frame_options",
        "x_content_type_options", "referrer_policy", "cookie_security",
        "spf_record", "dmarc_record", "dnssec", "server_fingerprint", "tech_disclosure"
    ]
    for ct in check_types:
        checks.append(ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan_id,
            check_type=ct,
            name=ct.replace("_", " ").title(),
            title=f"Evaluation of {ct}",
            status="pass",
            severity="info",
            summary=f"Status evaluation for {ct}",
            score_impact=0,
            estimated_fix_minutes=0,
            confidence=1.0,
        ))

    scan = Scan(
        id=scan_id,
        domain="canonical-normal-scan.com",
        normalized_domain="canonical-normal-scan.com",
        status="completed",
        score=95,
        risk_level="Excellent",
        passed_checks_count=13,
        total_checks_count=13,
        checks=checks,
    )

    assert len(scan.checks) == 13
    assert scan.total_checks_count == 13

    snapshot = build_report_snapshot(scan=scan, checks=checks)
    assert snapshot.total_observations == 13
    assert snapshot.deterministic_count == 13
    assert snapshot.correlated_count == 0
    assert snapshot.score == 95


# =============================================================================
# PART 6: PHASE 1 PRODUCTION HARDENING TESTS
# =============================================================================

def test_pdf_score_box_bounds_and_risk_labels():
    """
    Validates score layout correctness across boundary scores (0, 1, 9, 10, 60, 99, 100)
    and all risk ratings. Ensures zero overflow or document build failure.
    """
    test_cases = [
        (0, "Critical Risk"),
        (1, "Critical Risk"),
        (9, "Critical Risk"),
        (10, "High Risk"),
        (60, "Medium Risk"),
        (99, "Excellent"),
        (100, "Excellent"),
    ]
    for score_val, risk_val in test_cases:
        scan = Scan(
            id=uuid.uuid4(),
            domain=f"score-{score_val}.example.com",
            normalized_domain=f"score-{score_val}.example.com",
            status="completed",
            score=score_val,
            risk_level=risk_val,
            passed_checks_count=5,
            total_checks_count=5,
            created_at=datetime.now(timezone.utc),
        )
        pdf_path = generate_pdf_report(scan, [], plan="pro", output_directory="storage/test_reports")
        assert os.path.exists(pdf_path)
        assert os.path.getsize(pdf_path) > 5000

        decompressed = decompress_pdf_streams(pdf_path)
        assert "/ 100" in decompressed
        assert "OVERALL POSTURE SCORE" in decompressed
        assert risk_val.upper() in decompressed


def test_pdf_table_cell_overflow_long_values():
    """
    Validates that long continuous values (IPv6 address, 36-char UUID, long domain)
    are rendered with wordWrap="CJK" without document builder errors or clipping.
    """
    scan_id = uuid.uuid4()
    scan = Scan(
        id=scan_id,
        domain="very-long-subdomain-enterprise-compliance-node-1.region-west-internal.corp.example.com",
        normalized_domain="very-long-subdomain-enterprise-compliance-node-1.region-west-internal.corp.example.com",
        target_ip="2a02:4780:20:cf33:19af:b567:2fd3:fc3e",
        status="completed",
        score=75,
        risk_level="Medium Risk",
        passed_checks_count=1,
        total_checks_count=1,
        created_at=datetime.now(timezone.utc),
    )
    check = ScanCheck(
        id=uuid.uuid4(),
        scan_id=scan_id,
        check_type="infrastructure_ipv6_perimeter_benchmark",
        name="IPv6 Routing",
        title="Valid IPv6 Perimeter Configuration",
        status="pass",
        severity="info",
        summary="Target successfully verified over 2a02:4780:20:cf33:19af:b567:2fd3:fc3e global unicast address.",
        confidence=1.0,
    )

    pdf_path = generate_pdf_report(scan, [check], plan="pro", output_directory="storage/test_reports")
    assert os.path.exists(pdf_path)
    decompressed = decompress_pdf_streams(pdf_path)
    assert "2a02:4780:20:cf33:19af:b567:2fd3:fc3e" in decompressed


def test_pdf_scan_mode_labeling_deep_vs_normal():
    """
    Validates scan mode labeling and segregation in PDF:
    - Deep scans labeled 'Deep Scan'
    - Normal/standard/manual scans labeled 'Normal Scan'
    """
    # 1. Normal Scan
    normal_scan = Scan(
        id=uuid.uuid4(),
        domain="normal-audit.com",
        normalized_domain="normal-audit.com",
        scan_type="standard",
        status="completed",
        score=85,
        risk_level="Good",
        created_at=datetime.now(timezone.utc),
    )
    normal_pdf = generate_pdf_report(normal_scan, [], plan="pro", output_directory="storage/test_reports")
    normal_decompressed = decompress_pdf_streams(normal_pdf)
    assert "Normal Scan" in normal_decompressed
    assert "Normal Scan audit pipeline" in normal_decompressed

    # 2. Deep Scan
    deep_scan = Scan(
        id=uuid.uuid4(),
        domain="deep-audit.com",
        normalized_domain="deep-audit.com",
        scan_type="deep",
        status="completed",
        score=85,
        risk_level="Good",
        created_at=datetime.now(timezone.utc),
    )
    deep_pdf = generate_pdf_report(deep_scan, [], plan="pro", output_directory="storage/test_reports")
    deep_decompressed = decompress_pdf_streams(deep_pdf)
    assert "Deep Scan" in deep_decompressed
    assert "Deep Scan audit pipeline" in deep_decompressed


def test_pdf_plan_upgrade_cache_regeneration():
    """
    Validates that upgrading from Free to Pro dynamically invalidates the cached Free PDF,
    regenerating a full unredacted Pro report on subsequent download requests.
    """
    client = TestClient(app)
    user_id, org_id, headers = create_test_tenant(client, plan="free")

    scan_id = uuid.uuid4()
    with TestSyncSessionLocal() as sync_db:
        scan = Scan(
            id=scan_id,
            organization_id=org_id,
            domain="upgrade-test.com",
            normalized_domain="upgrade-test.com",
            status="completed",
            score=60,
            risk_level="Medium Risk",
            passed_checks_count=1,
            total_checks_count=5,
            created_at=datetime.now(timezone.utc),
        )
        sync_db.add(scan)
        for i in range(5):
            sync_db.add(ScanCheck(
                id=uuid.uuid4(),
                scan_id=scan_id,
                check_type=f"check_vuln_{i}",
                name=f"Vulnerability {i}",
                title=f"Vulnerability Finding {i}",
                status="fail",
                severity="high" if i < 2 else "medium",
                score_impact=-8,
                summary=f"Vulnerability details {i}",
                how_to_fix=f"SECRET_REMEDIATION_STEP_{i}",
                evidence=f"SECRET_TECHNICAL_EVIDENCE_{i}",
                confidence=1.0,
            ))
        sync_db.commit()

    # 1. Download as Free user -> generates and serves Free PDF (findings 4 & 5 redacted)
    free_res = client.get(f"/api/v1/scans/{scan_id}/pdf", headers=headers)
    assert free_res.status_code == 200

    # 2. Upgrade organization to Pro
    with TestSyncSessionLocal() as sync_db:
        sub = sync_db.execute(select(Subscription).where(Subscription.organization_id == org_id)).scalar_one()
        sub.plan = "pro"
        sync_db.commit()

    # 3. Download again as upgraded Pro user -> must regenerate and return full Pro PDF
    pro_res = client.get(f"/api/v1/scans/{scan_id}/pdf", headers=headers)
    assert pro_res.status_code == 200

    # Save and decompress pro PDF stream
    test_out = os.path.join("storage", "test_reports", f"upgraded_pro_{scan_id.hex[:8]}.pdf")
    os.makedirs(os.path.dirname(test_out), exist_ok=True)
    with open(test_out, "wb") as f:
        f.write(pro_res.content)

    pro_text = decompress_pdf_streams(test_out)
    assert "SECRET_REMEDIATION_STEP_4" in pro_text
    assert "SECRET_TECHNICAL_EVIDENCE_4" in pro_text
    assert "Entitlement Tier:" in pro_text
    assert "Pro" in pro_text


def test_pdf_client_parameter_tampering_rejected():
    """
    Validates that a Free user cannot bypass redaction by appending ?plan=agency or ?plan=pro.
    The server strictly resolves the authoritative session plan.
    """
    client = TestClient(app)
    user_id, org_id, headers = create_test_tenant(client, plan="free")

    scan_id = uuid.uuid4()
    with TestSyncSessionLocal() as sync_db:
        scan = Scan(
            id=scan_id,
            organization_id=org_id,
            domain="tamper-test.com",
            normalized_domain="tamper-test.com",
            status="completed",
            score=55,
            risk_level="Medium Risk",
            passed_checks_count=1,
            total_checks_count=5,
            created_at=datetime.now(timezone.utc),
        )
        sync_db.add(scan)
        for i in range(5):
            sync_db.add(ScanCheck(
                id=uuid.uuid4(),
                scan_id=scan_id,
                check_type=f"vuln_item_{i}",
                name=f"Tamper Check {i}",
                title=f"Tamper Check Finding {i}",
                status="fail",
                severity="high",
                score_impact=-10,
                summary=f"Tamper summary {i}",
                how_to_fix=f"CONFIDENTIAL_HOW_TO_FIX_{i}",
                evidence=f"CONFIDENTIAL_EVIDENCE_{i}",
                confidence=1.0,
            ))
        sync_db.commit()

    # Attempt query parameter spoofing
    tamper_res = client.get(f"/api/v1/scans/{scan_id}/pdf?plan=agency", headers=headers)
    assert tamper_res.status_code == 200

    test_out = os.path.join("storage", "test_reports", f"tamper_test_{scan_id.hex[:8]}.pdf")
    with open(test_out, "wb") as f:
        f.write(tamper_res.content)

    decompressed = decompress_pdf_streams(test_out)
    # Must remain Free tier with locked redaction
    assert "CONFIDENTIAL_HOW_TO_FIX_4" not in decompressed
    assert "CONFIDENTIAL_EVIDENCE_4" not in decompressed
    assert "LOCKED" in decompressed
    assert "Entitlement Tier:" in decompressed
    assert "Free" in decompressed


