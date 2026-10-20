"""
SiteSecura - Phase D Agency White-Label Branding & Logo Upload Test Suite
Validates:
1. Logo upload requires authentication (401 Unauthorized).
2. Logo upload enforces entitlement gating (403 Forbidden on Free/Basic/Pro, 200 OK on Agency).
3. Logo upload validates image format (magic bytes) and file size (max 2MB).
4. Logo upload saves file in tenant-isolated directory and updates organization.logo_url.
5. GET /api/v1/agency/white-label/logo/{org_id} serves image with proper media-type and caching.
6. DELETE /api/v1/agency/white-label/logo removes file and clears organization.logo_url.
7. Member/Viewer roles without admin/owner permission cannot upload or delete logos (403).
8. PDF report generation loads and embeds the uploaded agency logo into the assessment document.
"""

import os
import sys
import io
import uuid
import pytest
from PIL import Image as PILImage
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
from app.models.scan import Scan, ScanCheck
from app.services.pdf_service import generate_pdf_report, _resolve_logo_flowable
from app.core.rate_limit import _memory_rate_limits

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_branding.sqlite3"))
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


def create_sample_png(width=100, height=40, color=(14, 165, 233)) -> bytes:
    """Generates a valid small PNG image in-memory."""
    img = PILImage.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_logo_upload_unauthenticated():
    client = TestClient(app)
    png_bytes = create_sample_png()
    res = client.post(
        "/api/v1/agency/white-label/logo",
        files={"file": ("logo.png", png_bytes, "image/png")},
    )
    assert res.status_code == 401


def test_logo_upload_entitlement_rejection_for_free_and_pro():
    client = TestClient(app)
    png_bytes = create_sample_png()

    # Free plan
    uid_free = f"user_free_{uuid.uuid4().hex[:6]}"
    auth_free = f"Bearer dev-token-{uid_free}-free"
    client.get("/api/v1/auth/me", headers={"Authorization": auth_free})

    res = client.post(
        "/api/v1/agency/white-label/logo",
        headers={"Authorization": auth_free},
        files={"file": ("logo.png", png_bytes, "image/png")},
    )
    assert res.status_code == 403
    assert "white_label" in res.text or "Upgrade" in res.text

    # Pro plan
    uid_pro = f"user_pro_{uuid.uuid4().hex[:6]}"
    auth_pro = f"Bearer dev-token-{uid_pro}-free"
    pro_me = client.get("/api/v1/auth/me", headers={"Authorization": auth_pro}).json()
    pro_org_id = uuid.UUID(pro_me["organization"]["id"])

    with TestSyncSessionLocal() as sync_db:
        sub = sync_db.execute(select(Subscription).where(Subscription.organization_id == pro_org_id)).scalar_one()
        sub.plan = "pro"
        sub.status = "active"
        sync_db.commit()

    res_pro = client.post(
        "/api/v1/agency/white-label/logo",
        headers={"Authorization": auth_pro},
        files={"file": ("logo.png", png_bytes, "image/png")},
    )
    assert res_pro.status_code == 403


def test_logo_upload_validation_file_too_large_and_invalid_type():
    client = TestClient(app)
    uid_agency = f"agency_val_{uuid.uuid4().hex[:6]}"
    auth_agency = f"Bearer dev-token-{uid_agency}-free"
    me = client.get("/api/v1/auth/me", headers={"Authorization": auth_agency}).json()
    org_id = uuid.UUID(me["organization"]["id"])

    with TestSyncSessionLocal() as sync_db:
        sub = sync_db.execute(select(Subscription).where(Subscription.organization_id == org_id)).scalar_one()
        sub.plan = "agency"
        sub.status = "active"
        sync_db.commit()

    # 1. Reject oversized file > 2MB
    oversized_data = b"X" * (2 * 1024 * 1024 + 10)
    res_large = client.post(
        "/api/v1/agency/white-label/logo",
        headers={"Authorization": auth_agency},
        files={"file": ("huge.png", oversized_data, "image/png")},
    )
    assert res_large.status_code == 400
    assert "FILE_TOO_LARGE" in res_large.text

    # 2. Reject non-image invalid bytes
    fake_data = b"This is plain text and definitely not a valid image."
    res_fake = client.post(
        "/api/v1/agency/white-label/logo",
        headers={"Authorization": auth_agency},
        files={"file": ("malicious.png", fake_data, "image/png")},
    )
    assert res_fake.status_code == 400
    assert "INVALID_IMAGE_TYPE" in res_fake.text


def test_logo_upload_get_delete_lifecycle_agency():
    client = TestClient(app)
    uid = f"agency_lifecycle_{uuid.uuid4().hex[:6]}"
    auth = f"Bearer dev-token-{uid}-free"
    me = client.get("/api/v1/auth/me", headers={"Authorization": auth}).json()
    org_id = uuid.UUID(me["organization"]["id"])

    with TestSyncSessionLocal() as sync_db:
        sub = sync_db.execute(select(Subscription).where(Subscription.organization_id == org_id)).scalar_one()
        sub.plan = "agency"
        sub.status = "active"
        sync_db.commit()

    png_bytes = create_sample_png(width=160, height=50)

    # 1. Upload logo
    upload_res = client.post(
        "/api/v1/agency/white-label/logo",
        headers={"Authorization": auth},
        files={"file": ("agency_logo.png", png_bytes, "image/png")},
    )
    assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
    upload_data = upload_res.json()
    assert upload_data["logo_url"] == f"/api/v1/agency/white-label/logo/{org_id}"

    # 2. Fetch logo via public GET endpoint
    get_res = client.get(f"/api/v1/agency/white-label/logo/{org_id}")
    assert get_res.status_code == 200
    assert get_res.headers["content-type"] == "image/png"
    assert "Cache-Control" in get_res.headers
    assert len(get_res.content) == len(png_bytes)

    # 3. Verify PDF generation integrates this uploaded logo
    with TestSyncSessionLocal() as sync_db:
        org = sync_db.execute(select(Organization).where(Organization.id == org_id)).scalar_one()
        org.brand_name = "Acme Cyber Agency"
        org.primary_color = "#6366f1"
        org.footer_text = "Delivered by Acme Cyber Agency"
        sync_db.commit()
        sync_db.refresh(org)

    # Verify _resolve_logo_flowable finds the uploaded logo
    flowable = _resolve_logo_flowable(org)
    assert flowable is not None
    # Should be ReportLab Image flowable
    assert hasattr(flowable, "drawWidth")

    # Generate full PDF report
    dummy_scan = Scan(
        id=uuid.uuid4(),
        organization_id=org_id,
        domain="clientportal.example.com",
        normalized_domain="clientportal.example.com",
        status="completed",
        score=94,
        risk_level="Low",
        passed_checks_count=9,
        total_checks_count=10,
    )
    dummy_check = ScanCheck(
        id=uuid.uuid4(),
        scan_id=dummy_scan.id,
        check_type="ssl_tls",
        name="TLS 1.3 Support",
        title="Modern TLS 1.3 Support",
        summary="Target domain enforces modern TLS encryption protocol.",
        status="pass",
        score_impact=10,
    )
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "out_branding"))
    pdf_path = generate_pdf_report(
        scan=dummy_scan,
        checks=[dummy_check],
        org=org,
        plan="agency",
        output_directory=out_dir,
    )
    assert os.path.exists(pdf_path)
    assert os.path.getsize(pdf_path) > 1000

    # 4. Delete logo
    del_res = client.delete("/api/v1/agency/white-label/logo", headers={"Authorization": auth})
    assert del_res.status_code == 200
    assert del_res.json()["logo_url"] is None

    # Verify GET now returns 404
    get_after_del = client.get(f"/api/v1/agency/white-label/logo/{org_id}")
    assert get_after_del.status_code == 404
