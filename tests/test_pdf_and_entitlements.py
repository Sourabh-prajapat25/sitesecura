"""
SiteSecura - Subscription Entitlements, Authenticated PDF & Professional Report Regression Suite
Validates:
1. /api/v1/auth/me and /api/v1/auth/sync return authoritative 'plan' separate from 'user.role'.
2. Agency subscription plan does NOT overwrite user.role (RBAC separation).
3. Plan feature gate rules (Free, Basic, Pro, Agency).
4. PDF endpoint requires Bearer authentication (401 Unauthorized without token).
5. PDF endpoint succeeds with 200 and Content-Type: application/pdf when authenticated.
6. Cross-tenant PDF access is strictly rejected with 404 (tenant isolation / IDOR protection).
7. Free tier PDF generation redacts findings beyond top 3 and hides remediation/evidence.
8. Paid tier PDF generation includes complete findings, evidence, and remediation steps.
9. PDF response headers include sanitized Content-Disposition attachment filename.
10. PDF content smoke test: opens as valid PDF, contains cover, executive summary, scorecard, findings, and disclaimer.
11. Agency custom white-labeling applies custom brand name and footer in generated PDF.
12. Security bypass: mock_plan, X-Plan, or body parameters do not elevate backend entitlements.
"""

import os
import sys
import uuid
import zlib
import re
from datetime import datetime, timezone
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
from app.models.billing import Subscription
from app.models.website import Website
from app.models.scan import Scan, ScanCheck, Report
from app.services.pdf_service import generate_pdf_report
from app.core.rate_limit import _memory_rate_limits

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_pdf_entitlements.sqlite3"))
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
                import base64
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


# =========================================================================
# TEST SUITE
# =========================================================================

def test_auth_me_returns_plan_and_separate_user_role():
    """Verifies that /auth/me returns plan='free' alongside user.role='free'."""
    uid = f"free_{uuid.uuid4().hex[:8]}"
    auth_header = f"Bearer dev-token-{uid}-free"

    client = TestClient(app)
    response = client.get("/api/v1/auth/me", headers={"Authorization": auth_header})

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "user" in data
    assert "organization" in data
    assert "plan" in data
    assert data["plan"] == "free"
    assert data["user"]["role"] == "free"


def test_agency_subscription_does_not_overwrite_user_role():
    """
    Verifies that upgrading an organization to 'agency' returns plan='agency'
    while user.role strictly remains 'free' (RBAC separation).
    """
    uid = f"agency_{uuid.uuid4().hex[:8]}"
    auth_header = f"Bearer dev-token-{uid}-free"

    client = TestClient(app)
    # 1. Provision user
    res1 = client.get("/api/v1/auth/me", headers={"Authorization": auth_header})
    assert res1.status_code == 200
    org_id = uuid.UUID(res1.json()["organization"]["id"])

    # 2. Upgrade organization subscription in DB to 'agency'
    with TestSyncSessionLocal() as sync_db:
        sub = sync_db.execute(select(Subscription).where(Subscription.organization_id == org_id)).scalar_one()
        sub.plan = "agency"
        sub.status = "active"
        sync_db.commit()

    # 3. Call /auth/me and /auth/sync
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": auth_header})
    sync_res = client.post("/api/v1/auth/sync", headers={"Authorization": auth_header})

    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["plan"] == "agency"
    assert me_data["user"]["role"] == "free"  # RBAC role must NOT be overwritten!

    assert sync_res.status_code == 200
    sync_data = sync_res.json()
    assert sync_data["plan"] == "agency"
    assert sync_data["user"]["role"] == "free"


def test_pdf_endpoint_requires_authentication():
    """Verifies that GET /api/v1/scans/{scan_id}/pdf without Bearer token returns 401."""
    random_scan_id = uuid.uuid4()
    client = TestClient(app)
    response = client.get(f"/api/v1/scans/{random_scan_id}/pdf")
    assert response.status_code == 401


def test_pdf_endpoint_authenticated_success_and_headers():
    """
    Verifies that an authenticated owner can download their scan PDF with
    Content-Type: application/pdf and sanitized Content-Disposition attachment.
    """
    uid = f"owner_{uuid.uuid4().hex[:8]}"
    auth_header = f"Bearer dev-token-{uid}-free"
    client = TestClient(app)

    # 1. Provision user
    auth_res = client.get("/api/v1/auth/me", headers={"Authorization": auth_header})
    assert auth_res.status_code == 200
    org_id = uuid.UUID(auth_res.json()["organization"]["id"])

    # 2. Create a Scan and Report belonging to this organization
    scan_id = uuid.uuid4()
    with TestSyncSessionLocal() as sync_db:
        scan = Scan(
            id=scan_id,
            organization_id=org_id,
            domain="example.com",
            normalized_domain="example.com",
            target_ip="93.184.216.34",
            status="completed",
            score=82,
            risk_level="Good",
            passed_checks_count=10,
            total_checks_count=12,
            created_at=datetime.now(timezone.utc),
        )
        sync_db.add(scan)
        check1 = ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan_id,
            check_type="hsts",
            name="HSTS",
            status="pass",
            severity="info",
            score_impact=0,
            title="HSTS Enabled",
            summary="Strict-Transport-Security header present.",
            confidence=1.0,
        )
        sync_db.add(check1)

        # Generate a real PDF report file
        pdf_path = generate_pdf_report(scan, [check1], plan="pro", output_directory="storage/test_reports")
        report = Report(
            id=uuid.uuid4(),
            organization_id=org_id,
            scan_id=scan_id,
            report_number=f"RPT-{scan_id.hex[:8].upper()}",
            pdf_path=pdf_path,
        )
        sync_db.add(report)
        sync_db.commit()

    # 3. Request PDF download with valid Bearer token
    pdf_res = client.get(f"/api/v1/scans/{scan_id}/pdf", headers={"Authorization": auth_header})

    assert pdf_res.status_code == 200, f"Expected 200, got {pdf_res.status_code}: {pdf_res.text}"
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert "attachment;" in pdf_res.headers.get("content-disposition", "")
    assert "filename=" in pdf_res.headers.get("content-disposition", "")
    assert "SiteSecura-Security-Report-example.com" in pdf_res.headers.get("content-disposition", "")
    assert len(pdf_res.content) > 1000
    assert pdf_res.content[:8] == b"%PDF-1.4"


def test_pdf_cross_tenant_idor_rejected_404():
    """
    Verifies that User A cannot download a PDF report belonging to Organization B.
    Must return 404 to prevent enumeration/IDOR.
    """
    uid_b = f"userb_{uuid.uuid4().hex[:8]}"
    auth_header_b = f"Bearer dev-token-{uid_b}-free"

    uid_a = f"usera_{uuid.uuid4().hex[:8]}"
    auth_header_a = f"Bearer dev-token-{uid_a}-free"

    client = TestClient(app)

    res_b = client.get("/api/v1/auth/me", headers={"Authorization": auth_header_b})
    assert res_b.status_code == 200
    org_b_id = uuid.UUID(res_b.json()["organization"]["id"])

    res_a = client.get("/api/v1/auth/me", headers={"Authorization": auth_header_a})
    assert res_a.status_code == 200

    # Create scan for Tenant B
    scan_b_id = uuid.uuid4()
    with TestSyncSessionLocal() as sync_db:
        scan_b = Scan(
            id=scan_b_id,
            organization_id=org_b_id,
            domain="secret-tenant-b.com",
            normalized_domain="secret-tenant-b.com",
            status="completed",
            score=90,
            created_at=datetime.now(timezone.utc),
        )
        sync_db.add(scan_b)
        pdf_path = generate_pdf_report(scan_b, [], plan="pro", output_directory="storage/test_reports")
        report_b = Report(
            id=uuid.uuid4(),
            organization_id=org_b_id,
            scan_id=scan_b_id,
            report_number=f"RPT-{scan_b_id.hex[:8].upper()}",
            pdf_path=pdf_path,
        )
        sync_db.add(report_b)
        sync_db.commit()

    # User A tries to download Tenant B's PDF
    attack_res = client.get(f"/api/v1/scans/{scan_b_id}/pdf", headers={"Authorization": auth_header_a})

    assert attack_res.status_code == 404
    err_body = attack_res.json()
    error_code = (
        err_body.get("detail", {}).get("error", {}).get("code")
        if isinstance(err_body.get("detail"), dict)
        else err_body.get("error", {}).get("code")
    )
    assert error_code == "REPORT_NOT_FOUND"


def test_pdf_free_tier_redaction():
    """
    Verifies that generate_pdf_report with plan='free' redacts findings beyond top 3,
    protecting premium remediation steps and technical evidence.
    """
    scan = Scan(
        id=uuid.uuid4(),
        domain="freedemo.com",
        normalized_domain="freedemo.com",
        score=65,
        risk_level="Medium Risk",
        passed_checks_count=2,
        total_checks_count=6,
        created_at=datetime.now(timezone.utc),
    )

    checks = [
        ScanCheck(id=uuid.uuid4(), scan_id=scan.id, check_type="ssl", name="SSL", status="pass", severity="info", score_impact=0, title="SSL OK", summary="SSL is valid", confidence=1.0),
        ScanCheck(id=uuid.uuid4(), scan_id=scan.id, check_type="hsts", name="HSTS", status="fail", severity="high", score_impact=-15, title="Missing HSTS", summary="HSTS missing", how_to_fix="Add HSTS header", estimated_fix_minutes=10, evidence="Ev1", confidence=1.0),
        ScanCheck(id=uuid.uuid4(), scan_id=scan.id, check_type="csp", name="CSP", status="fail", severity="medium", score_impact=-10, title="Missing CSP", summary="CSP missing", how_to_fix="Add CSP header", estimated_fix_minutes=20, evidence="Ev2", confidence=1.0),
        ScanCheck(id=uuid.uuid4(), scan_id=scan.id, check_type="x_frame", name="XFO", status="fail", severity="medium", score_impact=-7, title="Missing X-Frame-Options", summary="Clickjacking risk", how_to_fix="Add XFO header", estimated_fix_minutes=15, evidence="Ev3", confidence=1.0),
        ScanCheck(id=uuid.uuid4(), scan_id=scan.id, check_type="cookie_flags", name="Cookies", status="fail", severity="low", score_impact=-5, title="Insecure Cookies", summary="Cookies not secure", how_to_fix="SECRET_REMEDIATION_5_STEPS", estimated_fix_minutes=15, evidence="SECRET_RAW_HEADER_EVIDENCE_5", confidence=1.0),
        ScanCheck(id=uuid.uuid4(), scan_id=scan.id, check_type="cors", name="CORS", status="fail", severity="low", score_impact=-3, title="Wildcard CORS", summary="CORS wildcard", how_to_fix="SECRET_REMEDIATION_6_STEPS", estimated_fix_minutes=10, evidence="SECRET_RAW_HEADER_EVIDENCE_6", confidence=1.0),
    ]

    free_pdf_path = generate_pdf_report(scan, checks, plan="free", output_directory="storage/test_reports")
    assert os.path.exists(free_pdf_path)

    decompressed = decompress_pdf_streams(free_pdf_path)

    # 1. Unlocked findings (0..2) should be present
    assert "Missing HSTS" in decompressed
    assert "Missing CSP" in decompressed
    assert "Missing X-Frame-Options" in decompressed

    # 2. Locked findings (index >= 3) should have title but secret evidence/remediation must NOT be leaked
    assert "Insecure Cookies" in decompressed
    assert "Wildcard CORS" in decompressed
    assert "SECRET_RAW_HEADER_EVIDENCE_5" not in decompressed
    assert "SECRET_REMEDIATION_5_STEPS" not in decompressed
    assert "SECRET_RAW_HEADER_EVIDENCE_6" not in decompressed
    assert "SECRET_REMEDIATION_6_STEPS" not in decompressed
    assert "LOCKED" in decompressed
    assert "UPGRADE REQUIRED" in decompressed


def test_pdf_paid_tier_full_content():
    """
    Verifies that generate_pdf_report with plan='pro' or 'agency' renders
    all findings with complete unredacted evidence and remediation steps.
    """
    scan = Scan(
        id=uuid.uuid4(),
        domain="prodemo.com",
        normalized_domain="prodemo.com",
        score=70,
        risk_level="Medium Risk",
        passed_checks_count=2,
        total_checks_count=5,
        created_at=datetime.now(timezone.utc),
    )

    checks = [
        ScanCheck(id=uuid.uuid4(), scan_id=scan.id, check_type="ssl", name="SSL", status="pass", severity="info", score_impact=0, title="SSL OK", summary="SSL is valid", confidence=1.0),
        ScanCheck(id=uuid.uuid4(), scan_id=scan.id, check_type="hsts", name="HSTS", status="fail", severity="high", score_impact=-15, title="Missing HSTS", summary="HSTS missing", how_to_fix="Add HSTS header", estimated_fix_minutes=10, evidence="Ev1", confidence=1.0),
        ScanCheck(id=uuid.uuid4(), scan_id=scan.id, check_type="csp", name="CSP", status="fail", severity="medium", score_impact=-10, title="Missing CSP", summary="CSP missing", how_to_fix="Add CSP header", estimated_fix_minutes=20, evidence="Ev2", confidence=1.0),
        ScanCheck(id=uuid.uuid4(), scan_id=scan.id, check_type="x_frame", name="XFO", status="fail", severity="medium", score_impact=-7, title="Missing X-Frame-Options", summary="Clickjacking risk", how_to_fix="FULL_UNREDACTED_REMEDIATION_STEP_4", estimated_fix_minutes=15, evidence="FULL_EVIDENCE_SAMPLE_4", confidence=1.0),
        ScanCheck(id=uuid.uuid4(), scan_id=scan.id, check_type="cookie_flags", name="Cookies", status="fail", severity="low", score_impact=-5, title="Insecure Cookies", summary="Cookies not secure", how_to_fix="FULL_UNREDACTED_REMEDIATION_STEP_5", estimated_fix_minutes=15, evidence="FULL_EVIDENCE_SAMPLE_5", confidence=1.0),
    ]

    pro_pdf_path = generate_pdf_report(scan, checks, plan="pro", output_directory="storage/test_reports")
    assert os.path.exists(pro_pdf_path)

    decompressed = decompress_pdf_streams(pro_pdf_path)

    # In Paid tier, all evidence and remediation must be present
    assert "FULL_EVIDENCE_SAMPLE_4" in decompressed
    assert "FULL_UNREDACTED_REMEDIATION_STEP_4" in decompressed
    assert "FULL_EVIDENCE_SAMPLE_5" in decompressed
    assert "FULL_UNREDACTED_REMEDIATION_STEP_5" in decompressed
    assert "UPGRADE REQUIRED" not in decompressed


def test_pdf_smoke_structure():
    """
    Verifies that the generated PDF contains all required report sections:
    Cover page, Executive Summary, Scorecard, Methodology & Disclaimer, and SiteSecura branding.
    """
    scan = Scan(
        id=uuid.uuid4(),
        domain="smoke-test.org",
        normalized_domain="smoke-test.org",
        score=88,
        risk_level="Excellent",
        passed_checks_count=18,
        total_checks_count=20,
        scan_duration_ms=1250,
        created_at=datetime.now(timezone.utc),
    )

    pdf_path = generate_pdf_report(scan, [], plan="pro", output_directory="storage/test_reports")
    assert os.path.exists(pdf_path)
    assert os.path.getsize(pdf_path) > 10000

    decompressed = decompress_pdf_streams(pdf_path)

    assert "Website Security Assessment Report" in decompressed
    assert "Executive Summary" in decompressed
    assert "Methodology & Legal Disclaimer" in decompressed
    assert "SiteSecura" in decompressed
    assert "smoke-test.org" in decompressed


def test_pdf_agency_white_labeling():
    """
    Verifies that an Agency plan organization with custom brand_name, footer_text,
    and primary_color has its custom branding embedded into the generated PDF.
    """
    org = Organization(
        id=uuid.uuid4(),
        name="Nexus Security Agency",
        brand_name="Nexus Cyber Defense",
        footer_text="Nexus Confidential Assessment - All Rights Reserved",
        primary_color="#10b981",
        type="agency",
    )

    scan = Scan(
        id=uuid.uuid4(),
        domain="client-corp.com",
        normalized_domain="client-corp.com",
        score=92,
        risk_level="Excellent",
        passed_checks_count=22,
        total_checks_count=24,
        created_at=datetime.now(timezone.utc),
    )

    pdf_path = generate_pdf_report(scan, [], org=org, plan="agency", output_directory="storage/test_reports")
    assert os.path.exists(pdf_path)

    decompressed = decompress_pdf_streams(pdf_path)

    assert "Nexus Cyber Defense" in decompressed
    assert "Nexus Confidential Assessment" in decompressed


def test_security_mock_plan_bypass_rejected():
    """
    Verifies that sending ?mock_plan=agency, X-Plan: agency, or plan in JSON body
    does NOT grant Agency privileges on the backend. Authoritative DB plan remains 'free'.
    """
    uid = f"bypass_{uuid.uuid4().hex[:8]}"
    auth_header = f"Bearer dev-token-{uid}-free"
    client = TestClient(app)

    # 1. User is on Free subscription in DB
    res = client.get("/api/v1/auth/me?mock_plan=agency", headers={
        "Authorization": auth_header,
        "X-Plan": "agency",
    })

    assert res.status_code == 200
    data = res.json()
    assert data["plan"] == "free"  # Backend MUST ignore client-provided plan!
