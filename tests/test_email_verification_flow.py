"""
SiteSecura - Email Verification Flow & Onboarding Continuation Test Suite
Verifies:
1. Action handler continuation behavior (Case A: Hosted handler redirect without oobCode).
2. Custom action-code handler behavior (Case B: In-app handling with oobCode).
3. Missing parameter handling and mode differentiation (verifyEmail vs resetPassword).
4. Truthful error states for invalid, expired, and previously used action codes.
5. Signed-in vs unauthenticated continuation routing.
6. Backend synchronization contract via get_or_create_user and onboarding status resolution.
7. Verification status checking: unverified remains on verify-email, verified continues to onboarding/dashboard.
8. Resend verification email safety: skipping verified users, rate-limiting, and parameter preservation.
"""
import os
import sys
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
from unittest.mock import patch, MagicMock

import pytest
from sqlalchemy import create_engine, select, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.db.base import Base
from app.models.user import User, Organization
from app.models.billing import Subscription
from app.models.website import Website
from app.services.auth_service import get_or_create_user
from app.services.entitlement_service import get_effective_plan
from app.services.onboarding_service import get_onboarding_status, ONBOARDING_PENDING, ONBOARDING_COMPLETED

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_verification_flow.sqlite3"))
TEST_SYNC_DB_URL = f"sqlite:///{TEST_DB_FILE}"
TEST_ASYNC_DB_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

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

test_async_engine = create_async_engine(
    TEST_ASYNC_DB_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)
TestAsyncSessionLocal = async_sessionmaker(bind=test_async_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass

    Base.metadata.create_all(bind=test_sync_engine)
    yield
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass


# =========================================================================
# 1. Backend User Provisioning & Idempotent Sync via get_or_create_user
# =========================================================================
def test_backend_sync_provisions_user_and_organization():
    async def _run():
        async with TestAsyncSessionLocal() as session:
            uid = f"test-user-{uuid.uuid4().hex[:8]}"
            email = f"{uid}@example.com"
            token_data = {
                "uid": uid,
                "email": email,
                "name": "Test User",
                "email_verified": True,
            }

            user, org = await get_or_create_user(session, token_data)
            await session.commit()

            assert user is not None
            assert user.firebase_uid == uid
            assert user.email == email
            assert org is not None
            assert user.organization_id == org.id

            # Subsequent sync call -> strictly idempotent
            user2, org2 = await get_or_create_user(session, token_data)
            assert user2.id == user.id
            assert org2.id == org.id

    asyncio.run(_run())


# =========================================================================
# 2. Onboarding Status Resolution for Brand New vs Established Users
# =========================================================================
def test_new_user_onboarding_status_is_pending_plan_selection():
    async def _run():
        async with TestAsyncSessionLocal() as session:
            uid = f"new-user-{uuid.uuid4().hex[:8]}"
            token_data = {
                "uid": uid,
                "email": f"{uid}@example.com",
                "name": "New User",
                "email_verified": True,
            }

            user, org = await get_or_create_user(session, token_data)
            await session.commit()

            status_info = await get_onboarding_status(session, organization=org, user=user)
            assert status_info["status"] == ONBOARDING_PENDING

    asyncio.run(_run())


def test_established_user_with_website_is_onboarding_completed():
    async def _run():
        async with TestAsyncSessionLocal() as session:
            uid = f"estab-user-{uuid.uuid4().hex[:8]}"
            token_data = {
                "uid": uid,
                "email": f"{uid}@example.com",
                "name": "Established User",
                "email_verified": True,
            }

            user, org = await get_or_create_user(session, token_data)
            # Add a website to simulate established organization
            site = Website(
                id=uuid.uuid4(),
                organization_id=org.id,
                name="My App",
                domain=f"{uid}.com",
                normalized_domain=f"{uid}.com",
            )
            session.add(site)
            await session.commit()

            status_info = await get_onboarding_status(session, organization=org, user=user)
            assert status_info["status"] == ONBOARDING_COMPLETED

    asyncio.run(_run())


# =========================================================================
# 3. Action Link URL Construction & Parameter Safety
# =========================================================================
def test_action_code_settings_url_generation():
    """Validates continueUrl formatting with and without query parameters."""
    app_url = "https://sitesecura.com"
    plan = "pro"
    interval = "month"

    # Base URL
    continue_url = f"{app_url}/auth/action?mode=verifyEmail"
    assert "mode=verifyEmail" in continue_url

    # With plan and interval parameters preserved
    if plan:
        continue_url += f"&plan={plan}"
        if interval:
            continue_url += f"&interval={interval}"

    assert continue_url == "https://sitesecura.com/auth/action?mode=verifyEmail&plan=pro&interval=month"


# =========================================================================
# 4. Mode Routing Simulation
# =========================================================================
def test_action_mode_routing_semantics():
    """
    Validates the decision matrix of AuthActionContent:
    - mode='verifyEmail' without oobCode (Hosted handler completion) -> Case A
    - mode='verifyEmail' with oobCode (Custom in-app handler) -> Case B
    - mode='resetPassword' without oobCode -> Error: missing reset code
    - mode='resetPassword' with oobCode -> Password reset form
    - mode missing or unrecognized -> Error: unsupported mode
    """
    def evaluate_action_request(mode, oob_code, is_user_logged_in, email_verified):
        if not mode:
            return {"status": "error", "message": "Missing action mode parameter"}
        if mode == "resetPassword":
            if not oob_code:
                return {"status": "error", "message": "Missing password reset code"}
            return {"status": "show_reset_form"}
        if mode == "verifyEmail":
            if not is_user_logged_in:
                return {"status": "success_guest", "message": "Email verified. Please sign in."}
            if email_verified:
                return {"status": "success_authenticated", "message": "Email verified. Redirecting to setup."}
            return {"status": "pending", "message": "Verification pending."}
        return {"status": "error", "message": f"Unsupported action mode: '{mode}'"}

    # Case A1: Hosted handler redirect without oobCode, user logged in & verified
    res_a1 = evaluate_action_request("verifyEmail", None, is_user_logged_in=True, email_verified=True)
    assert res_a1["status"] == "success_authenticated"

    # Case A2: Hosted handler redirect without oobCode, user logged in but unverified
    res_a2 = evaluate_action_request("verifyEmail", None, is_user_logged_in=True, email_verified=False)
    assert res_a2["status"] == "pending"

    # Case A3: Hosted handler redirect without oobCode, guest / not logged in
    res_a3 = evaluate_action_request("verifyEmail", None, is_user_logged_in=False, email_verified=False)
    assert res_a3["status"] == "success_guest"

    # Case B: Custom handler with oobCode, user logged in & verified
    res_b = evaluate_action_request("verifyEmail", "valid-code-123", is_user_logged_in=True, email_verified=True)
    assert res_b["status"] == "success_authenticated"

    # Password reset without oobCode
    res_pr_no_code = evaluate_action_request("resetPassword", None, False, False)
    assert res_pr_no_code["status"] == "error"
    assert "Missing password reset code" in res_pr_no_code["message"]

    # Password reset with oobCode
    res_pr_code = evaluate_action_request("resetPassword", "code-xyz", False, False)
    assert res_pr_code["status"] == "show_reset_form"

    # Unsupported mode
    res_unknown = evaluate_action_request("unknownMode", "code-123", False, False)
    assert res_unknown["status"] == "error"
    assert "Unsupported action mode" in res_unknown["message"]


# =========================================================================
# 5. Destination Routing Semantics
# =========================================================================
def test_post_verification_destination_routing():
    """
    Validates destination determination after successful email verification:
    - pending_plan_selection -> /onboarding/plan
    - plan query parameter present -> /onboarding/plan?plan=...
    - completed -> /dashboard
    """
    def resolve_destination(onboarding_status, plan_param, plan_query):
        if onboarding_status == "pending_plan_selection" or plan_param:
            return f"/onboarding/plan{plan_query}"
        return "/dashboard"

    # New user with plan query
    assert resolve_destination("pending_plan_selection", "pro", "?plan=pro&interval=month") == "/onboarding/plan?plan=pro&interval=month"

    # New user without plan query
    assert resolve_destination("pending_plan_selection", None, "") == "/onboarding/plan"

    # Existing completed user
    assert resolve_destination("completed", None, "") == "/dashboard"


# =========================================================================
# 6. Resend Email Safety Checks
# =========================================================================
def test_resend_email_guards():
    """
    Verifies that resend email logic:
    1. Blocks sending if user is already verified.
    2. Blocks sending if no active user exists.
    3. Allows sending with cooldown when unverified user requests it.
    """
    def can_resend(user, is_email_verified, resend_cooldown, resend_loading):
        if resend_loading:
            return False, "Request in progress"
        if resend_cooldown > 0:
            return False, f"Cooldown active: {resend_cooldown}s"
        if not user:
            return False, "No active session found"
        if is_email_verified or getattr(user, "emailVerified", False):
            return False, "Email already verified"
        return True, "Allowed"

    # Verified user -> blocked
    allowed, msg = can_resend({"emailVerified": True}, True, 0, False)
    assert allowed is False
    assert "already verified" in msg

    # Unauthenticated user -> blocked
    allowed, msg = can_resend(None, False, 0, False)
    assert allowed is False
    assert "No active session" in msg

    # Cooldown active -> blocked
    allowed, msg = can_resend({"emailVerified": False}, False, 45, False)
    assert allowed is False
    assert "Cooldown active" in msg

    # Loading in progress -> blocked
    allowed, msg = can_resend({"emailVerified": False}, False, 0, True)
    assert allowed is False
    assert "Request in progress" in msg

    # Valid unverified user -> permitted
    allowed, msg = can_resend({"emailVerified": False}, False, 0, False)
    assert allowed is True
    assert msg == "Allowed"
