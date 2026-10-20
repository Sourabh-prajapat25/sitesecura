"""
SiteSecura - Auth / Audit Log Transaction & Foreign Key Regression Suite
Validates:
1. Strict foreign key enforcement on audit_logs.user_id -> users.id (PRAGMA foreign_keys=ON).
2. Atomic first-login user & personal organization provisioning.
3. Authenticated endpoints (/api/v1/auth/me, /api/v1/websites, /api/v1/alerts) succeed with HTTP 200.
4. Re-authentication idempotency: no duplicate users, organizations, or audit logs.
5. Savepoint isolation: audit logging failures never poison session with PendingRollbackError.
6. Concurrent first-login race conditions: exactly 1 user, 1 org, and 1 owner membership created.
"""
import os
import sys
import uuid
import asyncio
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, func, event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

# Ensure apps/api and root are in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from apps.api.main import app
from app.db.base import Base
from app.db.session import get_db, get_sync_db
import app.db.session as session_module
from app.models.user import User, Organization, OrganizationMember
from app.models.billing import Subscription
from app.models.alert import AuditLog
from app.services.auth_service import get_or_create_user
from app.services.audit_service import record_audit_event
from app.core.rate_limit import _memory_rate_limits

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_auth_audit.sqlite3"))
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"
TEST_SYNC_DB_URL = f"sqlite:///{TEST_DB_FILE}"

# Build async engine with strict SQLite foreign keys enabled
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
    class_=Session,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


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


app.dependency_overrides[get_db] = override_get_db
session_module.get_sync_db = override_get_sync_db


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
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
        except Exception:
            pass


@pytest.fixture(autouse=True)
def clean_state(monkeypatch):
    app.dependency_overrides[get_db] = override_get_db
    session_module.get_sync_db = override_get_sync_db
    mock_task = MagicMock()
    monkeypatch.setattr("app.api.v1.scans.scan_website_task", mock_task)
    monkeypatch.setattr("app.api.v1.scans.execute_scan_job", MagicMock())
    monkeypatch.setattr("app.api.v1.websites.scan_website_task", mock_task)
    _memory_rate_limits.clear()
    yield
    app.dependency_overrides.pop(get_db, None)


client = TestClient(app)


# ==============================================================================
# 1. NEW USER FIRST REQUEST (/api/v1/auth/me) -> 200, ZERO FK ERROR
# ==============================================================================

def test_new_user_first_request_creates_entities_and_audit_log_without_fk_error():
    """
    Test 1 & 5: New user authenticates for the first time:
    - User, Organization, OrganizationMember, and Subscription are created.
    - AuditLog row is created referencing valid user_id and organization_id.
    - Zero ForeignKeyViolationError or PendingRollbackError occurs.
    """
    token = "Bearer dev-token-firsttimeuser-free"
    res = client.get("/api/v1/auth/me", headers={"Authorization": token})
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"

    data = res.json()
    assert "user" in data
    assert "organization" in data
    assert data["user"]["email"] == "firsttimeuser@example.com"
    assert data["user"]["role"] == "free"
    assert "Workspace" in data["organization"]["name"]

    user_id = uuid.UUID(data["user"]["id"])
    org_id = uuid.UUID(data["organization"]["id"])

    # Verify directly in database with strict FKs active
    sync_db = TestSyncSessionLocal()
    try:
        user_row = sync_db.query(User).filter_by(id=user_id).first()
        assert user_row is not None
        assert user_row.organization_id == org_id

        org_row = sync_db.query(Organization).filter_by(id=org_id).first()
        assert org_row is not None
        assert org_row.owner_id == user_id

        member_row = sync_db.query(OrganizationMember).filter_by(organization_id=org_id, user_id=user_id).first()
        assert member_row is not None
        assert member_row.role == "owner"

        sub_row = sync_db.query(Subscription).filter_by(organization_id=org_id).first()
        assert sub_row is not None
        assert sub_row.plan == "free"
        assert sub_row.status == "active"

        # Verify audit log row
        audit_row = sync_db.query(AuditLog).filter_by(
            action="ORGANIZATION_CREATED",
            organization_id=org_id,
            user_id=user_id,
        ).first()
        assert audit_row is not None
        assert audit_row.user_id == user_id
        assert audit_row.organization_id == org_id
        assert audit_row.entity_type == "ORGANIZATION"
    finally:
        sync_db.close()


# ==============================================================================
# 2. IMMEDIATELY CALL GET /api/v1/websites -> 200
# ==============================================================================

def test_authenticated_get_websites_immediately_succeeds():
    """
    Test 2: Calling GET /api/v1/websites immediately after user creation returns 200 empty list.
    """
    token = "Bearer dev-token-firsttimeuser-free"
    res = client.get("/api/v1/websites", headers={"Authorization": token})
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    websites = res.json()
    assert isinstance(websites, list)
    assert len(websites) == 0


# ==============================================================================
# 3. IMMEDIATELY CALL GET /api/v1/alerts -> 200
# ==============================================================================

def test_authenticated_get_alerts_immediately_succeeds():
    """
    Test 3: Calling GET /api/v1/alerts immediately after user creation returns 200 empty list.
    """
    token = "Bearer dev-token-firsttimeuser-free"
    res = client.get("/api/v1/alerts", headers={"Authorization": token})
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    alerts = res.json()
    assert isinstance(alerts, list)
    assert len(alerts) == 0


# ==============================================================================
# 4. EXISTING USER RE-AUTHENTICATES -> NO DUPLICATES
# ==============================================================================

def test_existing_user_reauthentication_is_idempotent():
    """
    Test 4: Subsequent requests by an existing user:
    - Return HTTP 200 with the exact same user and organization.
    - Do NOT duplicate User, Organization, or Membership.
    - Do NOT generate additional duplicate ORGANIZATION_CREATED audit logs.
    """
    token = "Bearer dev-token-firsttimeuser-free"

    # Call /api/v1/auth/me two more times
    res2 = client.get("/api/v1/auth/me", headers={"Authorization": token})
    assert res2.status_code == 200
    res3 = client.get("/api/v1/auth/me", headers={"Authorization": token})
    assert res3.status_code == 200

    sync_db = TestSyncSessionLocal()
    try:
        user_count = sync_db.query(func.count(User.id)).filter_by(firebase_uid="firsttimeuser").scalar()
        assert user_count == 1, "Expected exactly 1 user row"

        user_row = sync_db.query(User).filter_by(firebase_uid="firsttimeuser").first()
        org_count = sync_db.query(func.count(Organization.id)).filter_by(id=user_row.organization_id).scalar()
        assert org_count == 1, "Expected exactly 1 organization row"

        audit_count = sync_db.query(func.count(AuditLog.id)).filter_by(
            action="ORGANIZATION_CREATED",
            user_id=user_row.id,
        ).scalar()
        assert audit_count == 1, "Expected exactly 1 ORGANIZATION_CREATED audit entry"
    finally:
        sync_db.close()


# ==============================================================================
# 5. VERIFY AUDIT_LOGS.USER_ID MATCHES VALID USERS.ID
# ==============================================================================

def test_audit_logs_user_id_matches_valid_user_fk():
    """
    Test 5: Explicitly asserts that all audit log entries created during onboarding:
    - Have a non-null user_id and non-null organization_id.
    - Exactly reference existing, committed users.id and organizations.id primary keys.
    - Satisfy database foreign key constraints without orphans.
    """
    sync_db = TestSyncSessionLocal()
    try:
        logs = sync_db.query(AuditLog).filter_by(action="ORGANIZATION_CREATED").all()
        assert len(logs) >= 1
        for entry in logs:
            assert entry.user_id is not None
            assert entry.organization_id is not None

            # Join / lookup against users and organizations
            matched_user = sync_db.query(User).filter_by(id=entry.user_id).first()
            assert matched_user is not None, f"Audit log {entry.id} orphaned! user_id {entry.user_id} not in users"

            matched_org = sync_db.query(Organization).filter_by(id=entry.organization_id).first()
            assert matched_org is not None, f"Audit log {entry.id} orphaned! org_id {entry.organization_id} not in organizations"
    finally:
        sync_db.close()


# ==============================================================================
# 6. AUDIT LOG FAILURE SIMULATION VIA SAVEPOINT -> NO SESSION CONTAMINATION
# ==============================================================================

@pytest.mark.asyncio
async def test_audit_failure_savepoint_rollback_does_not_corrupt_session():
    """
    Test 6: When record_audit_event encounters a failure (e.g. forced invalid foreign key),
    the savepoint (begin_nested) is rolled back cleanly.
    The outer transaction is NOT aborted and the session does NOT raise PendingRollbackError.
    """
    async with TestAsyncSessionLocal() as session:
        # Create a valid user
        user_id = uuid.uuid4()
        org_id = uuid.uuid4()
        org = Organization(id=org_id, name="Savepoint Org", type="personal", owner_id=user_id)
        session.add(org)
        user = User(
            id=user_id,
            firebase_uid=f"savepoint_{uuid.uuid4().hex[:8]}",
            email=f"savepoint_{uuid.uuid4().hex[:8]}@example.com",
            name="Savepoint User",
            role="free",
            organization_id=org_id,
            is_active=True,
        )
        session.add(user)
        await session.flush()

        # Simulate audit log failure by passing invalid/unregistered FKs inside record_audit_event
        bogus_user_id = uuid.uuid4()
        bogus_org_id = uuid.uuid4()
        failed_entry = await record_audit_event(
            db=session,
            action="SHOULD_FAIL",
            entity_type="TEST",
            organization_id=bogus_org_id,
            user_id=bogus_user_id,
            entity_id=str(bogus_org_id),
        )
        assert failed_entry is None, "Expected audit event to fail safely and return None"

        # Prove session is completely healthy and unpolluted: normal commit succeeds!
        await session.commit()
        await session.refresh(user)
        assert user.id == user_id


# ==============================================================================
# 6. CONCURRENT FIRST-LOGIN REQUESTS -> EXACTLY 1 USER, 1 ORG, 1 MEMBERSHIP
# ==============================================================================

@pytest.mark.asyncio
async def test_concurrent_first_login_creates_exactly_one_user_and_org():
    """
    Test 7: Concurrent first logins for the same Firebase identity:
    - Both calls resolve without crashing or raising unhandled exceptions.
    - Exactly 1 user, 1 organization, and 1 owner membership exist in the database.
    """
    unique_uid = f"concurrent_user_{uuid.uuid4().hex[:8]}"
    token_data = {
        "uid": unique_uid,
        "email": f"{unique_uid}@scanly.io",
        "name": "Concurrent Test User",
        "role": "free",
    }

    async def attempt_login():
        async with TestAsyncSessionLocal() as session:
            return await get_or_create_user(session, token_data)

    # Dispatch concurrent attempts
    result1, result2 = await asyncio.gather(
        attempt_login(),
        attempt_login(),
        return_exceptions=True,
    )

    assert not isinstance(result1, Exception), f"Attempt 1 raised: {result1}"
    assert not isinstance(result2, Exception), f"Attempt 2 raised: {result2}"

    user1, org1 = result1
    user2, org2 = result2

    assert user1.id == user2.id, "Expected identical User.id across concurrent attempts"
    assert org1.id == org2.id, "Expected identical Organization.id across concurrent attempts"

    # Verify counts in database
    async with TestAsyncSessionLocal() as session:
        user_count = await session.scalar(select(func.count(User.id)).where(User.firebase_uid == unique_uid))
        assert user_count == 1, f"Expected 1 user, got {user_count}"

        member_count = await session.scalar(
            select(func.count(OrganizationMember.id)).where(OrganizationMember.user_id == user1.id)
        )
        assert member_count == 1, f"Expected 1 member, got {member_count}"

        sub_count = await session.scalar(
            select(func.count(Subscription.id)).where(Subscription.organization_id == org1.id)
        )
        assert sub_count == 1, f"Expected 1 subscription, got {sub_count}"
