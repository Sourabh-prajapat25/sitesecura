"""
SiteSecura - Phase 2 Production Hardening: Security, Authorization & Multi-Tenant Isolation
Comprehensive verification suite testing:
1. Authentication verification (missing tokens, malformed headers, invalid tokens)
2. Multi-tenant data isolation (Org A vs Org B read separation via 404 strategy)
3. Multi-tenant mutation isolation (Org A vs Org B write/update/delete/scan separation)
4. Plan entitlement gating and client parameter tampering resistance (query, headers, body)
5. Outbound SSRF defense (loopback, RFC 1918, cloud metadata 169.254.169.254, CGNAT, IPv6, scheme validation, DNS rebinding)
6. Rate limiting and abuse prevention (anonymous 3-per-day quota, authenticated burst limit)
7. Admin route protection and privilege escalation prevention (require_admin, non-admin 403, audit trail)
8. Path traversal and storage security (media path traversal, report path validation)
"""

import os
import sys
import uuid
import pytest
from unittest.mock import MagicMock, patch
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
from app.models.website import Website, Monitoring
from app.models.scan import Scan, ScanCheck, Report
from app.models.alert import Alert, AuditLog
from app.core.rate_limit import _memory_rate_limits
from scanner.network.safety import is_safe_ip, validate_hostname, validate_url_target
from scanner.network.resolver import SafeResolver
from scanner.domain import normalize_domain, SSRFValidationError

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_phase2_security.sqlite3"))
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
def setup_phase2_test_db():
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
def mock_background_and_clear_ratelimits(monkeypatch):
    mock_task = MagicMock()
    monkeypatch.setattr("app.api.v1.scans.scan_website_task", mock_task)
    monkeypatch.setattr("app.api.v1.scans.execute_scan_job", MagicMock())
    monkeypatch.setattr("app.api.v1.websites.scan_website_task", mock_task)
    monkeypatch.setattr("app.api.v1.websites.deep_scan_website_task", mock_task)
    monkeypatch.setattr("app.api.v1.websites.execute_deep_scan_job", MagicMock())

    async def _mock_get_redis():
        raise ConnectionError("Redis disabled in test environment")

    monkeypatch.setattr("app.core.rate_limit.get_redis_client", _mock_get_redis)
    _memory_rate_limits.clear()


# =========================================================================
# HELPER SEED FIXTURES
# =========================================================================

def create_test_tenant(client: TestClient, plan: str = "free", role: str = "owner"):
    """Provisions a test tenant via standard auth sync, ensuring valid DB records."""
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

        if role == "admin":
            user = sync_db.query(User).filter(User.id == user_id).first()
            if user:
                user.role = "admin"

        sync_db.commit()

    return user_id, org_id, {"Authorization": auth_header}


@pytest.fixture
def test_setup():
    """Seeds two isolated tenant organizations (Org A, Org B) plus an Admin user."""
    client = TestClient(app)
    user_a_id, org_a_id, headers_a = create_test_tenant(client, plan="free")
    user_b_id, org_b_id, headers_b = create_test_tenant(client, plan="pro")
    user_admin_id, org_admin_id, headers_admin = create_test_tenant(client, plan="agency", role="admin")

    with TestSyncSessionLocal() as sync_db:
        # Website for Org A
        site_a = Website(
            id=uuid.uuid4(),
            organization_id=org_a_id,
            domain="https://alpha-site.com",
            normalized_domain="alpha-site.com",
            name="Alpha Site",
        )
        sync_db.add(site_a)

        # Scan for Org A
        scan_a = Scan(
            id=uuid.uuid4(),
            organization_id=org_a_id,
            website_id=site_a.id,
            requested_by_user_id=user_a_id,
            domain="https://alpha-site.com",
            normalized_domain="alpha-site.com",
            status="completed",
            score=88,
            risk_level="low",
            scan_type="manual",
        )
        sync_db.add(scan_a)

        check_a = ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan_a.id,
            check_type="headers",
            name="Strict-Transport-Security",
            title="HSTS Missing",
            summary="HSTS header is missing.",
            severity="medium",
            status="failed",
        )
        sync_db.add(check_a)

        alert_a = Alert(
            id=uuid.uuid4(),
            organization_id=org_a_id,
            website_id=site_a.id,
            scan_id=scan_a.id,
            type="header_change",
            title="HSTS missing on Alpha Site",
            message="Strict-Transport-Security header was not detected.",
            severity="medium",
            status="unread",
        )
        sync_db.add(alert_a)

        audit_a = AuditLog(
            id=uuid.uuid4(),
            organization_id=org_a_id,
            user_id=user_a_id,
            action="WEBSITE_CREATED",
            entity_type="WEBSITE",
            entity_id=str(site_a.id),
        )
        sync_db.add(audit_a)

        # Website for Org B
        site_b = Website(
            id=uuid.uuid4(),
            organization_id=org_b_id,
            domain="https://beta-site.org",
            normalized_domain="beta-site.org",
            name="Beta Site",
        )
        sync_db.add(site_b)

        scan_b = Scan(
            id=uuid.uuid4(),
            organization_id=org_b_id,
            website_id=site_b.id,
            requested_by_user_id=user_b_id,
            domain="https://beta-site.org",
            normalized_domain="beta-site.org",
            status="completed",
            score=95,
            risk_level="low",
            scan_type="manual",
        )
        sync_db.add(scan_b)

        sync_db.commit()

        return {
            "org_a_id": org_a_id,
            "user_a_id": user_a_id,
            "site_a_id": site_a.id,
            "scan_a_id": scan_a.id,
            "check_a_id": check_a.id,
            "alert_a_id": alert_a.id,
            "audit_a_id": audit_a.id,
            "org_b_id": org_b_id,
            "user_b_id": user_b_id,
            "site_b_id": site_b.id,
            "scan_b_id": scan_b.id,
            "token_a": headers_a["Authorization"],
            "token_b": headers_b["Authorization"],
            "token_admin": headers_admin["Authorization"],
            "headers_a": headers_a,
            "headers_b": headers_b,
            "headers_admin": headers_admin,
        }


# =========================================================================
# 1. AUTHENTICATION ENFORCEMENT TESTS
# =========================================================================

def test_unauthenticated_requests_strictly_rejected():
    """Verifies that protected API endpoints return HTTP 401 when no token is supplied."""
    client = TestClient(app)

    protected_endpoints = [
        ("GET", "/api/v1/auth/me"),
        ("GET", "/api/v1/websites"),
        ("POST", "/api/v1/websites"),
        ("GET", "/api/v1/alerts"),
        ("GET", "/api/v1/agency/members"),
        ("POST", "/api/v1/ai/explain-finding"),
    ]

    for method, path in protected_endpoints:
        if method == "GET":
            resp = client.get(path)
        else:
            resp = client.post(path, json={})
        assert resp.status_code == 401, f"Expected 401 for {method} {path}, got {resp.status_code}"
        assert resp.json().get("detail", {}).get("error", {}).get("code") == "AUTHENTICATION_REQUIRED"


def test_malformed_and_invalid_auth_headers_rejected():
    """Verifies that non-Bearer, empty, or invalid tokens return HTTP 401."""
    client = TestClient(app)

    invalid_headers = [
        {"Authorization": "Basic dXNlcjpwYXNz"},
        {"Authorization": "Token invalid_token"},
        {"Authorization": "Bearer "},
        {"Authorization": "Bearer bogus_jwt_payload_12345"},
    ]

    for headers in invalid_headers:
        resp = client.get("/api/v1/auth/me", headers=headers)
        assert resp.status_code == 401, f"Expected 401 for header {headers}, got {resp.status_code}"


# =========================================================================
# 2. MULTI-TENANT READ ISOLATION (404 STRATEGY)
# =========================================================================

def test_cross_tenant_website_read_returns_404(test_setup):
    """Tenant B attempting to read Tenant A's website receives HTTP 404."""
    client = TestClient(app)
    site_a_id = test_setup["site_a_id"]
    headers_b = {"Authorization": test_setup["token_b"]}

    resp = client.get(f"/api/v1/websites/{site_a_id}", headers=headers_b)
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
    assert resp.json().get("detail", {}).get("error", {}).get("code") == "WEBSITE_NOT_FOUND"


def test_cross_tenant_scan_details_returns_404(test_setup):
    """Tenant B attempting to view Tenant A's scan details receives HTTP 404."""
    client = TestClient(app)
    scan_a_id = test_setup["scan_a_id"]
    headers_b = {"Authorization": test_setup["token_b"]}

    resp = client.get(f"/api/v1/scans/{scan_a_id}", headers=headers_b)
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
    assert resp.json().get("detail", {}).get("error", {}).get("code") == "SCAN_NOT_FOUND"


def test_cross_tenant_scan_status_and_results_return_404(test_setup):
    """Tenant B polling status or public results for Tenant A's private scan receives HTTP 404."""
    client = TestClient(app)
    scan_a_id = test_setup["scan_a_id"]
    headers_b = {"Authorization": test_setup["token_b"]}

    resp_status = client.get(f"/api/v1/scans/{scan_a_id}/status", headers=headers_b)
    assert resp_status.status_code == 404, f"Expected 404, got {resp_status.status_code}"

    resp_results = client.get(f"/api/v1/scans/{scan_a_id}/results", headers=headers_b)
    assert resp_results.status_code == 404, f"Expected 404, got {resp_results.status_code}"


def test_cross_tenant_pdf_report_returns_404(test_setup):
    """Tenant B downloading PDF report for Tenant A's scan receives HTTP 404."""
    client = TestClient(app)
    scan_a_id = test_setup["scan_a_id"]
    headers_b = {"Authorization": test_setup["token_b"]}

    resp = client.get(f"/api/v1/scans/{scan_a_id}/pdf", headers=headers_b)
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
    assert resp.json().get("detail", {}).get("error", {}).get("code") in ("REPORT_NOT_FOUND", "SCAN_NOT_FOUND")


def test_cross_tenant_alerts_and_audit_logs_isolated(test_setup):
    """Tenant B listing alerts or audit logs never sees Tenant A's data."""
    client = TestClient(app)
    headers_b = {"Authorization": test_setup["token_b"]}

    resp_alerts = client.get("/api/v1/alerts", headers=headers_b)
    assert resp_alerts.status_code == 200
    alert_ids = [a["id"] for a in resp_alerts.json()]
    assert str(test_setup["alert_a_id"]) not in alert_ids

    resp_audit = client.get("/api/v1/alerts/audit-logs", headers=headers_b)
    assert resp_audit.status_code == 200
    log_ids = [l["id"] for l in resp_audit.json()]
    assert str(test_setup["audit_a_id"]) not in log_ids


# =========================================================================
# 3. MULTI-TENANT MUTATION ISOLATION (WRITE/DELETE/SCAN)
# =========================================================================

def test_cross_tenant_website_update_rejected_with_404(test_setup):
    """Tenant B attempting to modify Tenant A's website receives HTTP 404."""
    client = TestClient(app)
    site_a_id = test_setup["site_a_id"]
    headers_b = {"Authorization": test_setup["token_b"]}

    resp = client.patch(
        f"/api/v1/websites/{site_a_id}",
        json={"name": "Hacked Name"},
        headers=headers_b,
    )
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"


def test_cross_tenant_website_delete_rejected_with_404(test_setup):
    """Tenant B attempting to delete Tenant A's website receives HTTP 404."""
    client = TestClient(app)
    site_a_id = test_setup["site_a_id"]
    headers_b = {"Authorization": test_setup["token_b"]}

    resp = client.delete(f"/api/v1/websites/{site_a_id}", headers=headers_b)
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"


def test_cross_tenant_scan_trigger_with_foreign_website_id_rejected_with_404(test_setup):
    """Tenant B attempting to trigger a scan using Tenant A's website_id receives HTTP 404."""
    client = TestClient(app)
    site_a_id = test_setup["site_a_id"]
    headers_b = {"Authorization": test_setup["token_b"]}

    resp = client.post(
        "/api/v1/scans",
        json={"domain": "https://beta-site.org", "website_id": str(site_a_id)},
        headers=headers_b,
    )
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
    assert resp.json().get("detail", {}).get("error", {}).get("code") == "WEBSITE_NOT_FOUND"


def test_cross_tenant_alert_status_update_rejected_with_404(test_setup):
    """Tenant B attempting to dismiss or update Tenant A's alert receives HTTP 404."""
    client = TestClient(app)
    alert_a_id = test_setup["alert_a_id"]
    headers_b = {"Authorization": test_setup["token_b"]}

    resp = client.patch(
        f"/api/v1/alerts/{alert_a_id}",
        json={"status": "dismissed"},
        headers=headers_b,
    )
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"


# =========================================================================
# 4. SERVER-SIDE PLAN ENTITLEMENT GATING & ANTI-TAMPERING
# =========================================================================

def test_deep_scan_entitlement_gating_and_parameter_tampering(test_setup):
    """
    Verifies:
    1. Free user attempting deep scan is rejected with HTTP 403.
    2. Manipulating ?plan=agency query parameter does NOT bypass gating.
    3. Manipulating X-Plan: agency header does NOT bypass gating.
    4. Manipulating body {"plan": "agency"} does NOT bypass gating.
    """
    client = TestClient(app)
    site_a_id = test_setup["site_a_id"]
    headers_a = {"Authorization": test_setup["token_a"]}

    # 1. Base attempt without tampering
    resp = client.post(f"/api/v1/websites/{site_a_id}/deep-scan", headers=headers_a)
    assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
    assert resp.json().get("detail", {}).get("error", {}).get("code") in ("FEATURE_NOT_PERMITTED", "FEATURE_UPGRADE_REQUIRED", "DEEP_SCAN_FEATURE_REQUIRED")

    # 2. Query param tampering: ?plan=agency
    resp_query = client.post(f"/api/v1/websites/{site_a_id}/deep-scan?plan=agency", headers=headers_a)
    assert resp_query.status_code == 403, "Query parameter tampering succeeded!"
    assert resp_query.json().get("detail", {}).get("error", {}).get("code") in ("FEATURE_NOT_PERMITTED", "FEATURE_UPGRADE_REQUIRED", "DEEP_SCAN_FEATURE_REQUIRED")

    # 3. Header tampering: X-Plan: agency
    headers_tampered = dict(headers_a)
    headers_tampered["X-Plan"] = "agency"
    headers_tampered["X-Subscription-Plan"] = "agency"
    resp_header = client.post(f"/api/v1/websites/{site_a_id}/deep-scan", headers=headers_tampered)
    assert resp_header.status_code == 403, "Header tampering succeeded!"
    assert resp_header.json().get("detail", {}).get("error", {}).get("code") in ("FEATURE_NOT_PERMITTED", "FEATURE_UPGRADE_REQUIRED", "DEEP_SCAN_FEATURE_REQUIRED")

    # 4. Body tampering: {"plan": "agency"}
    resp_body = client.post(
        f"/api/v1/websites/{site_a_id}/deep-scan",
        json={"plan": "agency", "override_plan": "agency"},
        headers=headers_a,
    )
    assert resp_body.status_code == 403, "Body tampering succeeded!"


def test_ai_advisor_entitlement_gating_and_anti_tampering(test_setup):
    """Free user cannot access AI Security Advisor endpoints even with spoofed plan params."""
    client = TestClient(app)
    scan_a_id = test_setup["scan_a_id"]
    headers_a = {"Authorization": test_setup["token_a"], "X-Plan": "agency"}

    payload = {
        "scan_id": str(scan_a_id),
        "check_id": str(uuid.uuid4()),
        "mode": "plain_english",
    }
    resp = client.post("/api/v1/ai/explain-finding?plan=agency", json=payload, headers=headers_a)
    assert resp.status_code == 403
    assert resp.json().get("detail", {}).get("error", {}).get("code") in ("FEATURE_NOT_PERMITTED", "FEATURE_UPGRADE_REQUIRED", "AI_FEATURE_REQUIRED")


def test_white_label_branding_entitlement_gating(test_setup):
    """Free and Pro users cannot configure Agency White-Label branding."""
    client = TestClient(app)
    headers_a = {"Authorization": test_setup["token_a"]}
    headers_b = {"Authorization": test_setup["token_b"]}

    branding_payload = {"brand_name": "My Custom Security", "primary_color": "#ff0000"}

    # Free user rejected
    resp_a = client.patch("/api/v1/agency/white-label", json=branding_payload, headers=headers_a)
    assert resp_a.status_code == 403

    # Pro user also rejected (white-label is Agency only)
    resp_b = client.patch("/api/v1/agency/white-label", json=branding_payload, headers=headers_b)
    assert resp_b.status_code == 403
    assert resp_b.json().get("detail", {}).get("error", {}).get("code") in ("FEATURE_NOT_PERMITTED", "FEATURE_UPGRADE_REQUIRED")


# =========================================================================
# 5. OUTBOUND SSRF DEFENSE TESTS
# =========================================================================

@pytest.mark.parametrize(
    "forbidden_target",
    [
        "http://127.0.0.1",
        "http://127.0.0.1:8080",
        "http://localhost",
        "http://localhost:3000",
        "http://169.254.169.254",            # Cloud instance metadata (AWS, GCP, Azure)
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1",                   # RFC 1918 Class A private
        "http://10.255.255.255",
        "http://172.16.0.1",                 # RFC 1918 Class B private
        "http://172.31.255.255",
        "http://192.168.1.1",                # RFC 1918 Class C private
        "http://192.168.0.254",
        "http://0.0.0.0",                    # Unspecified / zero address
        "http://100.64.0.1",                 # Carrier-Grade NAT (RFC 6598)
        "http://[::1]",                      # IPv6 loopback
        "ftp://example.com",                 # Forbidden scheme (FTP)
        "file:///etc/passwd",                # Forbidden scheme (FILE)
        "gopher://127.0.0.1:70",             # Forbidden scheme (GOPHER)
    ],
)
def test_scan_creation_rejects_ssrf_targets(forbidden_target):
    """Verifies that scan targets targeting internal IPs or schemes are rejected with HTTP 400."""
    client = TestClient(app)
    resp = client.post("/api/v1/scans", json={"domain": forbidden_target})
    assert resp.status_code == 400, f"Expected 400 for SSRF target '{forbidden_target}', got {resp.status_code}"
    error_code = resp.json().get("detail", {}).get("error", {}).get("code")
    assert error_code == "INVALID_DOMAIN"


def test_is_safe_ip_unit_checks():
    """Validates low-level IP safety checker against IPv4 and IPv6 network blocks."""
    # Forbidden IPs return (False, reason)
    assert not is_safe_ip("127.0.0.1")[0]
    assert not is_safe_ip("127.0.0.2")[0]
    assert not is_safe_ip("10.0.0.1")[0]
    assert not is_safe_ip("172.16.0.1")[0]
    assert not is_safe_ip("192.168.1.1")[0]
    assert not is_safe_ip("169.254.169.254")[0]
    assert not is_safe_ip("100.64.0.1")[0]
    assert not is_safe_ip("0.0.0.0")[0]
    assert not is_safe_ip("::1")[0]
    assert not is_safe_ip("fe80::1")[0]
    assert not is_safe_ip("fc00::1")[0]

    # Safe public IPs return (True, "")
    assert is_safe_ip("8.8.8.8")[0]
    assert is_safe_ip("1.1.1.1")[0]
    assert is_safe_ip("93.184.216.34")[0]       # example.com
    assert is_safe_ip("2606:4700:4700::1111")[0] # Cloudflare public DNS IPv6


def test_safe_resolver_dns_rebinding_defense():
    """Validates that SafeResolver detects and raises SSRFValidationError when DNS returns private IP."""
    resolver = SafeResolver()

    # Mock getaddrinfo returning private IP (simulating DNS rebinding attack)
    with patch("socket.getaddrinfo") as mock_dns:
        mock_dns.return_value = [
            (2, 1, 6, "", ("127.0.0.1", 443)),
        ]
        with pytest.raises(SSRFValidationError, match="resolved to prohibited IP address"):
            resolver.resolve("attacker-rebind.domain.internal")


# =========================================================================
# 6. RATE LIMITING & ABUSE PREVENTION
# =========================================================================

def test_anonymous_scan_quota_strictly_enforced_at_3_per_day():
    """
    Anonymous scan quota:
    - 3 scans within 24 hours allowed
    - 4th scan returns HTTP 429 Too Many Requests
    """
    client = TestClient(app)
    _memory_rate_limits.clear()

    # Requests 1 to 3: accepted
    for i in range(3):
        resp = client.post("/api/v1/scans", json={"domain": f"https://public-test-{i}.com"})
        assert resp.status_code == 201, f"Request {i+1} got unexpected {resp.status_code}: {resp.text}"

    # Request 4: must be rejected with 429 Too Many Requests
    resp_4th = client.post("/api/v1/scans", json={"domain": "https://public-test-4.com"})
    assert resp_4th.status_code == 429, f"Expected 429 on 4th scan, got {resp_4th.status_code}"
    data = resp_4th.json()
    assert data.get("detail", {}).get("error", {}).get("code") == "RATE_LIMITED"


def test_authenticated_scan_burst_limit(test_setup):
    """Authenticated scans enforce 20 requests per 60 seconds burst limit."""
    client = TestClient(app)
    headers_b = {"Authorization": test_setup["token_b"]}
    _memory_rate_limits.clear()

    # Send 20 requests rapidly
    for i in range(20):
        resp = client.post(
            "/api/v1/scans",
            json={"domain": f"https://auth-burst-{i}.org"},
            headers=headers_b,
        )
        assert resp.status_code == 201, f"Scan {i+1} failed: {resp.text}"

    # 21st request must trigger 429
    resp_21st = client.post(
        "/api/v1/scans",
        json={"domain": "https://auth-burst-overflow.org"},
        headers=headers_b,
    )
    assert resp_21st.status_code == 429
    assert resp_21st.json().get("detail", {}).get("error", {}).get("code") == "RATE_LIMITED"


# =========================================================================
# 7. ADMIN ROUTE PROTECTION & PRIVILEGE ESCALATION
# =========================================================================

def test_non_admin_users_forbidden_from_admin_endpoints(test_setup):
    """
    Verifies that regular authenticated users (even Pro owners) receive HTTP 403
    with ADMIN_ACCESS_REQUIRED when attempting to access /api/v1/admin/* endpoints.
    """
    client = TestClient(app)
    headers_b = {"Authorization": test_setup["token_b"]}

    admin_endpoints = [
        ("GET", "/api/v1/admin/dashboard"),
        ("GET", "/api/v1/admin/users"),
        ("GET", "/api/v1/admin/subscriptions"),
        ("GET", "/api/v1/admin/audit-logs"),
        ("POST", "/api/v1/admin/blog/tags"),
        ("POST", "/api/v1/admin/blog/categories"),
    ]

    for method, path in admin_endpoints:
        if method == "GET":
            resp = client.get(path, headers=headers_b)
        else:
            resp = client.post(path, json={"name": "test"}, headers=headers_b)
        assert resp.status_code == 403, f"Expected 403 for {method} {path}, got {resp.status_code}: {resp.text}"
        detail = resp.json().get("detail", {})
        assert detail.get("error", {}).get("code") == "ADMIN_ACCESS_REQUIRED"


def test_admin_user_permitted_on_admin_endpoints(test_setup):
    """Platform administrator with role='admin' successfully accesses /api/v1/admin/dashboard."""
    client = TestClient(app)
    headers_admin = {"Authorization": test_setup["token_admin"]}

    resp = client.get("/api/v1/admin/dashboard", headers=headers_admin)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "users_count" in data or "total_users" in data or "websites_count" in data or "total_websites" in data


# =========================================================================
# 8. PATH TRAVERSAL & STORAGE SECURITY
# =========================================================================

def test_public_media_path_traversal_blocked():
    """Attempts to traverse directories via media endpoint return HTTP 404."""
    client = TestClient(app)

    traversal_paths = [
        "/api/v1/cms/media/../../etc/passwd",
        "/api/v1/cms/media/..%2f..%2fetc%2fpasswd",
        "/api/v1/cms/media/%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        "/api/v1/cms/media/windows\\system32\\cmd.exe",
    ]

    for p in traversal_paths:
        resp = client.get(p)
        assert resp.status_code == 404, f"Expected 404 for traversal path '{p}', got {resp.status_code}"


def test_white_label_logo_traversal_blocked():
    """Passing directory traversal strings in white-label logo org ID returns 422 validation error."""
    client = TestClient(app)

    # UUID typing prevents path traversal
    resp = client.get("/api/v1/agency/white-label/logo/../../etc/passwd")
    assert resp.status_code in (404, 422), f"Expected 404 or 422, got {resp.status_code}"
