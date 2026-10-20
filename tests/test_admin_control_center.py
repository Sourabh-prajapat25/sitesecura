"""
SiteSecura - Phase 4 Admin Control Center Comprehensive Test Suite
Covers:
1. Authorization Gating: Non-admin roles (Free, Basic, Pro, Agency) rejected with 403 (ADMIN_ACCESS_REQUIRED); Admin accepted (200).
2. Admin Dashboard & Metrics (/api/v1/admin/dashboard, /api/v1/admin/metrics).
3. User Management: Search, pagination, details, suspend/unsuspend, delete.
4. Organization Visibility: Cross-tenant organization listing.
5. Website Management: Cross-tenant website listing, force scan, delete.
6. Scan Management: List, filter, failure inspection, retry, delete.
7. Subscription Management: List, manual plan override with required audit justification.
8. Blog CMS: List, create, update/publish toggle, delete.
9. Support & Contact: List tickets, update status, list contacts, update status.
10. System Health & Platform Analytics: Live probes (DB, Redis, Celery, AI providers without secrets) & analytics.
11. Audit Logs Security: Query logs, verify secrets are redacted, verify non-admin blocked from reading audit logs.
"""
import os
import sys
import uuid
import asyncio
from typing import Tuple, Dict, Any, Optional, List
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
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
from app.models.website import Website, Monitoring
from app.models.scan import Scan, ScanCheck
from app.models.billing import Subscription, UsageRecord
from app.models.alert import Alert, AuditLog
from app.models.cms import BlogPost, BlogCategory, SupportTicket, ContactMessage
from app.models.ai import AIGeneration
from app.core.config import settings
from app.core.rate_limit import _memory_rate_limits

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_admin.sqlite3"))
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
    mock_task = MagicMock()
    monkeypatch.setattr("app.tasks.worker.scan_website_task", mock_task)
    monkeypatch.setattr("app.api.v1.admin.scan_website_task", mock_task)
    monkeypatch.setattr("app.services.admin_service.scan_website_task", mock_task)
    _memory_rate_limits.clear()
    yield
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_sync_db, None)


@pytest.fixture
def client():
    return TestClient(app)


async def create_user_fixture(
    email: str,
    role: str,
    plan: str = "free",
    org_name: str = "Test Org",
    is_active: bool = True,
    uid: Optional[str] = None,
) -> Tuple[User, Organization]:
    async with TestingAsyncSessionLocal() as session:
        org_id = uuid.uuid4()
        user_id = uuid.uuid4()
        firebase_uid = uid or f"firebase_{user_id.hex[:8]}"

        org = Organization(
            id=org_id,
            name=org_name,
            type="personal",
            owner_id=user_id,
        )
        session.add(org)

        user = User(
            id=user_id,
            firebase_uid=firebase_uid,
            email=email,
            name=f"User {role}",
            role=role,
            organization_id=org_id,
            is_active=is_active,
        )
        session.add(user)

        member = OrganizationMember(
            id=uuid.uuid4(),
            organization_id=org_id,
            user_id=user_id,
            role="owner" if role != "admin" else "admin",
        )
        session.add(member)

        sub = Subscription(
            id=uuid.uuid4(),
            organization_id=org_id,
            stripe_customer_id=f"cus_{user_id.hex[:8]}",
            plan=plan,
            status="active",
        )
        session.add(sub)

        await session.commit()
        return user, org


# =========================================================================
# TEST 1: Authorization Gating (Non-Admin Rejected with 403, Admin 200)
# =========================================================================
@pytest.mark.asyncio
async def test_admin_authorization_gating(client):
    # Setup test users across plan tiers
    await create_user_fixture("freeuser@example.com", role="free", plan="free", uid="freeuser")
    await create_user_fixture("basicuser@example.com", role="basic", plan="basic", uid="basicuser")
    await create_user_fixture("prouser@example.com", role="pro", plan="pro", uid="prouser")
    await create_user_fixture("agencyuser@example.com", role="agency", plan="agency", uid="agencyuser")
    await create_user_fixture("adminuser@example.com", role="admin", plan="admin", uid="adminuser")

    non_admin_tokens = [
        "dev-token-freeuser-free",
        "dev-token-basicuser-basic",
        "dev-token-prouser-pro",
        "dev-token-agencyuser-agency",
    ]

    # Every non-admin user must receive 403 Forbidden
    for token in non_admin_tokens:
        resp = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403, f"Expected 403 for {token}, got {resp.status_code}"
        assert resp.json()["detail"]["error"]["code"] == "ADMIN_ACCESS_REQUIRED"

        # Check /admin/users gating as well
        resp_users = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert resp_users.status_code == 403

    # Admin user must succeed with 200
    admin_resp = client.get("/api/v1/admin/dashboard", headers={"Authorization": "Bearer dev-token-adminuser-admin"})
    assert admin_resp.status_code == 200
    body = admin_resp.json()
    assert "total_users" in body
    assert "scan_success_rate" in body


# =========================================================================
# TEST 2: Admin Dashboard & Backward-Compatible Metrics
# =========================================================================
@pytest.mark.asyncio
async def test_admin_dashboard_metrics(client):
    headers = {"Authorization": "Bearer dev-token-adminuser-admin"}

    # Full dashboard
    dash_resp = client.get("/api/v1/admin/dashboard", headers=headers)
    assert dash_resp.status_code == 200
    d_body = dash_resp.json()
    assert d_body["total_users"] >= 5
    assert d_body["active_users"] >= 5
    assert "completed" in d_body["scans_by_status"]

    # Backward-compatible metrics
    metrics_resp = client.get("/api/v1/admin/metrics", headers=headers)
    assert metrics_resp.status_code == 200
    m_body = metrics_resp.json()
    assert "total_users" in m_body
    assert "paid_users" in m_body
    assert "scan_success_rate" in m_body


# =========================================================================
# TEST 3: User Management (Search, Detail, Suspend/Unsuspend, Delete)
# =========================================================================
@pytest.mark.asyncio
async def test_admin_user_management(client):
    headers = {"Authorization": "Bearer dev-token-adminuser-admin"}

    # 1. Search users
    res = client.get("/api/v1/admin/users?search=prouser", headers=headers)
    assert res.status_code == 200
    users = res.json()["items"]
    assert len(users) >= 1
    pro_user = users[0]
    assert pro_user["email"] == "prouser@example.com"
    target_id = pro_user["id"]

    # 2. Get User Detail
    det_res = client.get(f"/api/v1/admin/users/{target_id}", headers=headers)
    assert det_res.status_code == 200
    detail = det_res.json()
    assert detail["email"] == "prouser@example.com"
    assert detail["is_active"] is True

    # 3. Suspend user (is_active = False)
    suspend_res = client.patch(
        f"/api/v1/admin/users/{target_id}/status",
        headers=headers,
        json={"is_active": False, "reason": "Security review flag"},
    )
    assert suspend_res.status_code == 200
    assert suspend_res.json()["is_active"] is False

    # 4. Verify Audit Log recorded USER_SUSPENDED
    audit_res = client.get("/api/v1/admin/audit-logs?action=USER_SUSPENDED", headers=headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()["items"]
    assert any(l["action"] == "USER_SUSPENDED" and l["entity_id"] == target_id for l in logs)

    # 5. Unsuspend user (is_active = True)
    unsuspend_res = client.patch(
        f"/api/v1/admin/users/{target_id}/status",
        headers=headers,
        json={"is_active": True, "reason": "Verification completed"},
    )
    assert unsuspend_res.status_code == 200
    assert unsuspend_res.json()["is_active"] is True

    # 6. Delete User safely
    del_user, _ = await create_user_fixture("temp_to_delete@example.com", role="free")
    del_res = client.delete(f"/api/v1/admin/users/{del_user.id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"


# =========================================================================
# TEST 4: Organization Management Across Tenants
# =========================================================================
@pytest.mark.asyncio
async def test_admin_organizations_list(client):
    headers = {"Authorization": "Bearer dev-token-adminuser-admin"}
    res = client.get("/api/v1/admin/organizations", headers=headers)
    assert res.status_code == 200
    orgs = res.json()["items"]
    assert len(orgs) >= 4
    first = orgs[0]
    assert "name" in first
    assert "plan" in first
    assert "members_count" in first


# =========================================================================
# TEST 5: Website Management & Force Scan Pipeline
# =========================================================================
@pytest.mark.asyncio
async def test_admin_website_management(client):
    headers = {"Authorization": "Bearer dev-token-adminuser-admin"}

    # Seed a website
    async with TestingAsyncSessionLocal() as session:
        u_res = await session.execute(select(User).where(User.role == "pro"))
        pro_user = u_res.scalar_one()

        site = Website(
            id=uuid.uuid4(),
            organization_id=pro_user.organization_id,
            name="Target Portal",
            domain="https://target-portal.com",
            normalized_domain="target-portal.com",
            status="active",
        )
        session.add(site)
        await session.commit()
        site_id = site.id

    # 1. List websites
    list_res = client.get("/api/v1/admin/websites?search=target-portal.com", headers=headers)
    assert list_res.status_code == 200
    sites = list_res.json()["items"]
    assert len(sites) == 1
    assert sites[0]["domain"] == "https://target-portal.com"

    # 2. Force Scan
    with patch("app.services.admin_service.scan_website_task.delay") as mock_delay:
        force_res = client.post(f"/api/v1/admin/websites/{site_id}/force-scan", headers=headers)
        assert force_res.status_code == 200
        assert force_res.json()["status"] == "queued"
        mock_delay.assert_called_once()

    # 3. Check Audit Log for ADMIN_FORCE_SCAN
    audit_res = client.get("/api/v1/admin/audit-logs?action=ADMIN_FORCE_SCAN", headers=headers)
    assert audit_res.status_code == 200
    assert any(l["action"] == "ADMIN_FORCE_SCAN" for l in audit_res.json()["items"])

    # 4. Delete Website
    del_res = client.delete(f"/api/v1/admin/websites/{site_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"


# =========================================================================
# TEST 6: Scan Operations (List, Retry, Delete)
# =========================================================================
@pytest.mark.asyncio
async def test_admin_scan_operations(client):
    headers = {"Authorization": "Bearer dev-token-adminuser-admin"}

    async with TestingAsyncSessionLocal() as session:
        u_res = await session.execute(select(User).where(User.role == "pro"))
        pro_user = u_res.scalar_one()

        scan = Scan(
            id=uuid.uuid4(),
            organization_id=pro_user.organization_id,
            requested_by_user_id=pro_user.id,
            domain="https://scantest.com",
            normalized_domain="scantest.com",
            status="failed",
            error_message="Connection timed out after 10000ms",
        )
        session.add(scan)
        await session.commit()
        scan_id = scan.id

    # 1. List scans with failed filter
    scans_res = client.get("/api/v1/admin/scans?status=failed", headers=headers)
    assert scans_res.status_code == 200
    items = scans_res.json()["items"]
    match = [s for s in items if s["id"] == str(scan_id)]
    assert len(match) == 1
    assert match[0]["error_message"] == "Connection to target host timed out during security check probing."
    assert match[0]["safe_error_code"] == "SCAN_TIMEOUT"

    # 2. Retry scan
    with patch("app.api.v1.admin.scan_website_task.delay") as mock_delay:
        retry_res = client.post(f"/api/v1/admin/scans/{scan_id}/retry", headers=headers)
        assert retry_res.status_code == 200
        assert retry_res.json()["status"] == "queued"
        mock_delay.assert_called_once()

    # 3. Delete scan
    del_res = client.delete(f"/api/v1/admin/scans/{scan_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"


# =========================================================================
# TEST 7: Subscriptions & Manual Plan Override with Mandatory Audit Reason
# =========================================================================
@pytest.mark.asyncio
async def test_admin_subscription_override(client):
    headers = {"Authorization": "Bearer dev-token-adminuser-admin"}

    # Create target organization on free tier
    _, target_org = await create_user_fixture("override_target@example.com", role="free", plan="free")

    # 1. View subscriptions
    subs_res = client.get("/api/v1/admin/subscriptions", headers=headers)
    assert subs_res.status_code == 200
    assert len(subs_res.json()) >= 1

    # 2. Override plan without reason -> Rejected with 400
    fail_res = client.post(
        "/api/v1/admin/subscriptions/override-plan",
        headers=headers,
        json={"organization_id": str(target_org.id), "new_plan": "agency", "reason": "   "},
    )
    assert fail_res.status_code == 400

    # 3. Override plan with justification reason -> Success (200)
    override_res = client.post(
        "/api/v1/admin/subscriptions/override-plan",
        headers=headers,
        json={
            "organization_id": str(target_org.id),
            "new_plan": "agency",
            "reason": "Enterprise custom partnership agreement",
        },
    )
    assert override_res.status_code == 200
    assert override_res.json()["plan"] == "agency"

    # 4. Verify immutable audit log was created
    audit_res = client.get("/api/v1/admin/audit-logs?action=MANUAL_PLAN_OVERRIDE", headers=headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()["items"]
    override_log = [l for l in logs if l["entity_id"] == str(target_org.id)]
    assert len(override_log) == 1
    assert override_log[0]["metadata_json"]["previous_plan"] == "free"
    assert override_log[0]["metadata_json"]["new_plan"] == "agency"
    assert override_log[0]["metadata_json"]["reason"] == "Enterprise custom partnership agreement"


# =========================================================================
# TEST 8: Blog CMS Management (List, Create, Publish/Draft, Delete)
# =========================================================================
@pytest.mark.asyncio
async def test_admin_blog_cms(client):
    headers = {"Authorization": "Bearer dev-token-adminuser-admin"}

    # 1. Create Post
    create_res = client.post(
        "/api/v1/admin/blog/posts",
        headers=headers,
        json={
            "title": "Securing TLS 1.3 Configurations",
            "slug": "securing-tls-1-3-configurations",
            "excerpt": "A deep dive into modern cipher suites and protocol hardening.",
            "content": "# TLS 1.3 Guide\nHardening instructions here.",
            "status": "draft",
        },
    )
    assert create_res.status_code == 201
    post = create_res.json()
    post_id = post["id"]
    assert post["status"] == "draft"

    # 2. List all posts (including drafts)
    list_res = client.get("/api/v1/admin/blog/posts", headers=headers)
    assert list_res.status_code == 200
    assert any(p["id"] == post_id for p in list_res.json())

    # 3. Publish Post
    patch_res = client.patch(
        f"/api/v1/admin/blog/posts/{post_id}",
        headers=headers,
        json={"status": "published"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "published"
    assert patch_res.json()["published_at"] is not None

    # 4. Delete Post
    del_res = client.delete(f"/api/v1/admin/blog/posts/{post_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"


# =========================================================================
# TEST 9: Support Tickets & Contact Messages
# =========================================================================
@pytest.mark.asyncio
async def test_admin_support_and_contact(client):
    headers = {"Authorization": "Bearer dev-token-adminuser-admin"}

    # 1. Seed support ticket
    async with TestingAsyncSessionLocal() as session:
        ticket = SupportTicket(
            id=uuid.uuid4(),
            subject="Question regarding custom DKIM verification",
            message="We updated our selector records but scan check is still observing UNKNOWN.",
            status="open",
            priority="normal",
        )
        session.add(ticket)

        contact = ContactMessage(
            id=uuid.uuid4(),
            name="Alice Vance",
            email="alice@vance.io",
            subject="Enterprise Sales Inquiry",
            message="Interested in 100+ domain continuous posture monitoring.",
            status="new",
        )
        session.add(contact)
        await session.commit()
        ticket_id = ticket.id
        contact_id = contact.id

    # 2. List support tickets
    t_res = client.get("/api/v1/admin/support/tickets?status=open", headers=headers)
    assert t_res.status_code == 200
    assert any(t["id"] == str(ticket_id) for t in t_res.json())

    # 3. Update ticket status
    t_patch = client.patch(
        f"/api/v1/admin/support/tickets/{ticket_id}",
        headers=headers,
        json={"status": "closed", "priority": "high"},
    )
    assert t_patch.status_code == 200
    assert t_patch.json()["status"] == "closed"

    # 4. List contacts
    c_res = client.get("/api/v1/admin/support/contacts?status=new", headers=headers)
    assert c_res.status_code == 200
    assert any(c["id"] == str(contact_id) for c in c_res.json())

    # 5. Update contact status
    c_patch = client.patch(
        f"/api/v1/admin/support/contacts/{contact_id}",
        headers=headers,
        json={"status": "resolved"},
    )
    assert c_patch.status_code == 200
    assert c_patch.json()["status"] == "resolved"


# =========================================================================
# TEST 10: System Health & Analytics Probes (Zero Secret Exposure)
# =========================================================================
@pytest.mark.asyncio
async def test_admin_system_health_and_analytics(client):
    headers = {"Authorization": "Bearer dev-token-adminuser-admin"}

    # System Health
    health_res = client.get("/api/v1/admin/system/health", headers=headers)
    assert health_res.status_code == 200
    h_body = health_res.json()
    assert "database" in h_body
    assert "redis" in h_body
    assert "ai_providers" in h_body
    # Ensure zero secrets are present in response body
    body_str = str(h_body)
    assert "gsk_" not in body_str
    assert "AIza" not in body_str
    assert "password" not in body_str

    # Analytics
    analytics_res = client.get("/api/v1/admin/analytics", headers=headers)
    assert analytics_res.status_code == 200
    a_body = analytics_res.json()
    assert "users_growth" in a_body
    assert "scans_timeline" in a_body
    assert "plan_distribution" in a_body
    assert "ai_metrics" in a_body


# =========================================================================
# TEST 11: Audit Logs Access & Secret Redaction
# =========================================================================
@pytest.mark.asyncio
async def test_admin_audit_logs_security(client):
    # Non-admin cannot access audit logs
    non_admin_res = client.get("/api/v1/admin/audit-logs", headers={"Authorization": "Bearer dev-token-prouser-pro"})
    assert non_admin_res.status_code == 403

    # Admin access
    admin_res = client.get("/api/v1/admin/audit-logs", headers={"Authorization": "Bearer dev-token-adminuser-admin"})
    assert admin_res.status_code == 200
    body = admin_res.json()
    assert "items" in body
    assert "total" in body
    for log in body["items"]:
        # Verify metadata does not leak sensitive keys
        if log.get("metadata_json"):
            meta_str = str(log["metadata_json"]).lower()
            assert "api_key" not in meta_str or "[redacted]" in meta_str
            assert "token" not in meta_str or "[redacted]" in meta_str


# =========================================================================
# TEST 12: Sanitized Scan Failure Diagnostics (Zero Traceback Exposure)
# =========================================================================
@pytest.mark.asyncio
async def test_admin_sanitized_scan_errors(client):
    headers = {"Authorization": "Bearer dev-token-adminuser-admin"}

    # Seed a scan with a dangerous raw Python traceback containing file paths & SQL details
    async with TestingAsyncSessionLocal() as session:
        u_res = await session.execute(select(User).where(User.role == "pro"))
        pro_user = u_res.scalar_one()

        raw_traceback = (
            "Traceback (most recent call last):\n"
            "  File \"C:\\Sitesecura\\scanner\\engine.py\", line 145, in execute_scan\n"
            "psycopg2.OperationalError: password authentication failed for user 'postgres'\n"
            "SELECT * FROM scans WHERE secret_token='gsk_supersecretkey123'"
        )

        scan = Scan(
            id=uuid.uuid4(),
            organization_id=pro_user.organization_id,
            requested_by_user_id=pro_user.id,
            domain="https://raw-error-exposure-test.com",
            normalized_domain="raw-error-exposure-test.com",
            status="failed",
            error_message=raw_traceback,
        )
        session.add(scan)
        await session.commit()

    res = client.get("/api/v1/admin/scans?search=raw-error-exposure-test.com", headers=headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    inspected = items[0]

    # Verify zero traceback, zero filesystem paths, zero credentials, zero SQL queries exposed
    err_msg = inspected["error_message"]
    assert "Traceback" not in err_msg
    assert "C:\\Sitesecura" not in err_msg
    assert "postgres" not in err_msg
    assert "password" not in err_msg
    assert "SELECT *" not in err_msg
    assert "gsk_" not in err_msg
    # Verify safe error code
    assert inspected["safe_error_code"] == "INTERNAL_SCANNER_FAULT"
    assert "internal scanner execution exception" in err_msg.lower()


# =========================================================================
# TEST 13: AI Provider Health Config Comes From Actual Runtime Config
# =========================================================================
@pytest.mark.asyncio
async def test_admin_ai_provider_runtime_config(client):
    from app.services.ai.orchestrator import orchestrator

    headers = {"Authorization": "Bearer dev-token-adminuser-admin"}
    res = client.get("/api/v1/admin/system/health", headers=headers)
    assert res.status_code == 200
    body = res.json()

    ai_data = body["ai_providers"]
    assert "providers" in ai_data
    providers = ai_data["providers"]
    assert len(providers) >= 3

    # Verify each provider matches the actual runtime orchestrator models (not hardcoded)
    for prov_entry in providers:
        p_name = prov_entry["name"]
        assert p_name in orchestrator.providers
        actual_runtime_provider = orchestrator.providers[p_name]
        # Must match runtime model ID
        assert prov_entry["model"] == actual_runtime_provider.model
        assert prov_entry["status"] in ("configured", "not_configured")
        assert prov_entry["health"] in ("healthy", "unavailable")

    # Verify zero API keys leaked in any field
    full_str = str(ai_data)
    assert "gsk_" not in full_str
    assert "AIza" not in full_str


# =========================================================================
# TEST 14: Effective Plan & Entitlements Lifecycle After Admin Override
# =========================================================================
@pytest.mark.asyncio
async def test_admin_plan_override_entitlements_lifecycle(client):
    admin_headers = {"Authorization": "Bearer dev-token-adminuser-admin"}
    target_uid = "overridecust"
    target_token = f"dev-token-{target_uid}-free"
    target_headers = {"Authorization": f"Bearer {target_token}"}

    # 1. Customer initiates profile on Free plan
    me_free = client.get("/api/v1/auth/me", headers=target_headers)
    assert me_free.status_code == 200
    free_data = me_free.json()
    assert free_data["plan"] == "free"
    org_id = free_data["organization"]["id"]

    # 2. Admin overrides Free -> Basic
    up_basic = client.post(
        "/api/v1/admin/subscriptions/override-plan",
        headers=admin_headers,
        json={"organization_id": org_id, "new_plan": "basic", "reason": "Customer requested Basic trial"},
    )
    assert up_basic.status_code == 200
    assert up_basic.json()["plan"] == "basic"

    # Verify /api/v1/auth/me immediately reflects basic
    me_basic = client.get("/api/v1/auth/me", headers=target_headers)
    assert me_basic.status_code == 200
    assert me_basic.json()["plan"] == "basic"

    # 3. Admin overrides Basic -> Pro
    up_pro = client.post(
        "/api/v1/admin/subscriptions/override-plan",
        headers=admin_headers,
        json={"organization_id": org_id, "new_plan": "pro", "reason": "Upgraded to Pro tier"},
    )
    assert up_pro.status_code == 200
    assert up_pro.json()["plan"] == "pro"

    # Verify /api/v1/auth/me immediately reflects pro
    me_pro = client.get("/api/v1/auth/me", headers=target_headers)
    assert me_pro.status_code == 200
    assert me_pro.json()["plan"] == "pro"

    # 4. Admin overrides Pro -> Agency
    up_agency = client.post(
        "/api/v1/admin/subscriptions/override-plan",
        headers=admin_headers,
        json={"organization_id": org_id, "new_plan": "agency", "reason": "Enterprise Agency upgrade"},
    )
    assert up_agency.status_code == 200
    assert up_agency.json()["plan"] == "agency"

    # Verify /api/v1/auth/me immediately reflects agency
    me_agency = client.get("/api/v1/auth/me", headers=target_headers)
    assert me_agency.status_code == 200
    assert me_agency.json()["plan"] == "agency"


# =========================================================================
# TEST 15: Comprehensive Audit Log Creation & Secret Safety
# =========================================================================
@pytest.mark.asyncio
async def test_admin_audit_logs_comprehensive_mutations(client):
    headers = {"Authorization": "Bearer dev-token-adminuser-admin"}

    # Verify that each required mutation creates an audit log
    required_actions = [
        "USER_SUSPENDED",
        "USER_ACTIVATED",
        "USER_DELETED",
        "ADMIN_FORCE_SCAN",
        "ADMIN_DELETE_WEBSITE",
        "ADMIN_RETRY_SCAN",
        "ADMIN_DELETE_SCAN",
        "MANUAL_PLAN_OVERRIDE",
        "BLOG_POST_CREATED",
        "BLOG_POST_UPDATED",
        "BLOG_POST_DELETED",
        "SUPPORT_TICKET_UPDATED",
        "CONTACT_MESSAGE_UPDATED",
    ]

    logs_res = client.get("/api/v1/admin/audit-logs?limit=100", headers=headers)
    assert logs_res.status_code == 200
    all_logs = logs_res.json()["items"]
    recorded_action_set = {log["action"] for log in all_logs}

    for action in required_actions:
        assert action in recorded_action_set, f"Action {action} was not recorded in audit logs!"

    # Verify zero secrets in metadata across all logs
    for log in all_logs:
        meta = log.get("metadata_json")
        if meta:
            meta_str = str(meta)
            assert "gsk_" not in meta_str
            assert "AIza" not in meta_str
            assert "password" not in meta_str.lower() or "[redacted]" in meta_str


# =========================================================================
# TEST 16: Audit Logs Cannot Be Deleted (Strictly Immutable)
# =========================================================================
@pytest.mark.asyncio
async def test_admin_audit_logs_immutable_cannot_delete(client):
    admin_headers = {"Authorization": "Bearer dev-token-adminuser-admin"}
    non_admin_headers = {"Authorization": "Bearer dev-token-prouser-pro"}

    # Admin attempts DELETE on collection
    del_collection = client.delete("/api/v1/admin/audit-logs", headers=admin_headers)
    assert del_collection.status_code in (404, 405)

    # Admin attempts DELETE on individual log item
    del_item = client.delete(f"/api/v1/admin/audit-logs/{uuid.uuid4()}", headers=admin_headers)
    assert del_item.status_code in (404, 405)

    # Non-admin attempts DELETE
    del_non_admin = client.delete("/api/v1/admin/audit-logs", headers=non_admin_headers)
    assert del_non_admin.status_code in (403, 404, 405)
