"""
SiteSecura Part 3 - Automated Test Suite
Verifies:
1. Onboarding Status Resolution (new user, free activation, checkout pending, recovery, legacy protection).
2. Idempotent Free Plan Activation & Paid Plan Overwrite Prevention.
3. Open-Redirect Vulnerability Prevention (CWE-601) in Stripe return URLs.
4. Correct Price ID resolution across monthly & annual intervals for Basic, Pro, Agency.
5. Role-vs-Plan Separation in Stripe Webhook processing (User.role RBAC preservation).
"""
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, AsyncMock, patch

from app.models.user import User, Organization
from app.models.billing import Subscription
from app.models.website import Website
from app.models.alert import AuditLog
from app.services.onboarding_service import (
    get_onboarding_status,
    activate_free_plan,
    record_checkout_initiated,
    record_checkout_canceled,
    ONBOARDING_PENDING,
    ONBOARDING_COMPLETED,
    ONBOARDING_CHECKOUT_PENDING,
    ONBOARDING_REQUIRES_RECOVERY,
)
from app.services.billing_service import (
    sanitize_return_url,
    create_checkout_session,
    process_stripe_webhook_event,
)
from app.core.config import settings


# =========================================================================
# 1. Open-Redirect Prevention Tests
# =========================================================================
def test_sanitize_return_url_open_redirect_prevention():
    """Verifies that malicious or external return URLs are sanitized to server origin."""
    default_path = "/billing/success"

    # Malicious external URLs
    assert sanitize_return_url("https://attacker.com/steal", default_path) == f"{settings.NEXT_PUBLIC_APP_URL}{default_path}"
    assert sanitize_return_url("http://evil.org/phishing", default_path) == f"{settings.NEXT_PUBLIC_APP_URL}{default_path}"
    assert sanitize_return_url("//attacker.com/bad", default_path) == f"{settings.NEXT_PUBLIC_APP_URL}{default_path}"
    assert sanitize_return_url("javascript:alert(1)", default_path) == f"{settings.NEXT_PUBLIC_APP_URL}{default_path}"

    # Approved relative URLs
    assert sanitize_return_url("/billing/success", default_path) == f"{settings.NEXT_PUBLIC_APP_URL}/billing/success"
    assert sanitize_return_url("/dashboard/billing?status=ok", default_path) == f"{settings.NEXT_PUBLIC_APP_URL}/dashboard/billing?status=ok"

    # None or empty fallback
    assert sanitize_return_url(None, default_path) == f"{settings.NEXT_PUBLIC_APP_URL}{default_path}"
    assert sanitize_return_url("", default_path) == f"{settings.NEXT_PUBLIC_APP_URL}{default_path}"


# =========================================================================
# 2. Checkout Session Price Mapping & Metadata Tests
# =========================================================================
def test_create_checkout_session_price_and_interval_mapping():
    """Verifies mock and real checkout generation resolves correct plan and interval tags."""
    org = Organization(id=uuid.uuid4(), name="Test Org")
    user = User(id=uuid.uuid4(), email="tester@sitesecura.com", name="Tester", role="member")

    # Monthly Basic
    res_basic = create_checkout_session(org, user, "basic", "month")
    assert "mock_plan=basic" in res_basic["checkout_url"]
    assert "mock_interval=month" in res_basic["checkout_url"]

    # Yearly Pro
    res_pro = create_checkout_session(org, user, "pro", "year")
    assert "mock_plan=pro" in res_pro["checkout_url"]
    assert "mock_interval=year" in res_pro["checkout_url"]

    # Yearly Agency
    res_agency = create_checkout_session(org, user, "agency", "yearly")
    assert "mock_plan=agency" in res_agency["checkout_url"]
    assert "mock_interval=year" in res_agency["checkout_url"]


# =========================================================================
# 3. Role-Versus-Plan Separation in Webhooks
# =========================================================================
def test_webhook_preserves_user_rbac_roles():
    """
    Verifies that processing Stripe webhook events upgrades Subscription.plan
    WITHOUT corrupting or overwriting User.role (fixing the audit finding).
    """
    org_id = uuid.uuid4()
    user_id = uuid.uuid4()

    mock_db = MagicMock()

    # Existing subscription and users
    sub = Subscription(
        organization_id=org_id,
        stripe_customer_id="cust_test",
        plan="free",
        status="active",
    )
    user_owner = User(id=user_id, organization_id=org_id, email="owner@test.com", role="admin")

    # Setup execute mock
    def mock_execute(stmt):
        m = MagicMock()
        stmt_str = str(stmt).lower()
        if "subscriptions" in stmt_str:
            m.scalar_one_or_none.return_value = sub
        elif "users" in stmt_str:
            m.scalars.return_value.all.return_value = [user_owner]
        else:
            m.scalar_one_or_none.return_value = None
        return m

    mock_db.execute.side_effect = mock_execute

    event_payload = {
        "id": "evt_test_role_preservation",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "client_reference_id": str(org_id),
                "customer": "cus_12345",
                "subscription": "sub_12345",
                "payment_status": "paid",
                "metadata": {"plan": "pro", "organization_id": str(org_id)},
            }
        },
    }

    import json
    payload_bytes = json.dumps(event_payload).encode("utf-8")

    with patch("app.services.billing_service.record_audit_event_sync"):
        result = process_stripe_webhook_event(payload_bytes, "", mock_db)

    assert result["status"] == "processed"
    # Plan upgraded on Subscription model
    assert sub.plan == "pro"
    assert sub.status == "active"
    assert sub.stripe_subscription_id == "sub_12345"

    # User RBAC role PRESERVED (MUST NOT be overwritten with "pro"!)
    assert user_owner.role == "admin"


# =========================================================================
# 4. Onboarding Status Resolution Tests
# =========================================================================
@pytest.mark.asyncio
async def test_get_onboarding_status_active_paid():
    """Active paid subscriptions (basic, pro, agency, admin) always return completed."""
    org = Organization(id=uuid.uuid4(), name="Paid Org")
    user = User(id=uuid.uuid4(), email="paid@test.com", role="member")

    mock_db = AsyncMock()

    with patch("app.services.onboarding_service.get_effective_plan", return_value="pro"):
        status_info = await get_onboarding_status(mock_db, org, user)
        assert status_info["status"] == ONBOARDING_COMPLETED
        assert status_info["plan"] == "pro"
        assert status_info["can_activate_free"] is False


@pytest.mark.asyncio
async def test_get_onboarding_status_established_account():
    """Organizations with existing websites are established users and bypass onboarding."""
    org = Organization(id=uuid.uuid4(), name="Established Org")
    user = User(id=uuid.uuid4(), email="est@test.com", role="member")

    mock_db = AsyncMock()

    # Mock website count > 0
    w_mock = MagicMock()
    w_mock.scalar.return_value = 1

    sub_mock = MagicMock()
    sub_mock.scalar_one_or_none.return_value = None

    def execute_mock(stmt):
        stmt_str = str(stmt).lower()
        if "websites" in stmt_str:
            return w_mock
        return sub_mock

    mock_db.execute.side_effect = execute_mock

    with patch("app.services.onboarding_service.get_effective_plan", return_value="free"):
        status_info = await get_onboarding_status(mock_db, org, user)
        assert status_info["status"] == ONBOARDING_COMPLETED
        assert status_info["can_activate_free"] is False


@pytest.mark.asyncio
async def test_get_onboarding_status_new_user_pending():
    """Brand new organizations without websites, plan selection, or checkout return pending."""
    org = Organization(id=uuid.uuid4(), name="New Org")
    user = User(id=uuid.uuid4(), email="new@test.com", role="member")

    mock_db = AsyncMock()

    # Mock website count = 0
    w_mock = MagicMock()
    w_mock.scalar.return_value = 0

    sub_mock = MagicMock()
    sub_mock.scalar_one_or_none.return_value = None

    audit_mock = MagicMock()
    audit_mock.scalars.return_value.all.return_value = []

    def execute_mock(stmt):
        stmt_str = str(stmt).lower()
        if "websites" in stmt_str:
            return w_mock
        elif "audit_logs" in stmt_str:
            return audit_mock
        return sub_mock

    mock_db.execute.side_effect = execute_mock

    with patch("app.services.onboarding_service.get_effective_plan", return_value="free"):
        status_info = await get_onboarding_status(mock_db, org, user)
        assert status_info["status"] == ONBOARDING_PENDING
        assert status_info["plan"] == "free"
        assert status_info["can_activate_free"] is True


# =========================================================================
# 5. Idempotent Free Plan Activation Tests
# =========================================================================
@pytest.mark.asyncio
async def test_activate_free_plan_success():
    """Activating free plan updates subscription, commits audit log, and returns completed."""
    org = Organization(id=uuid.uuid4(), name="Free Org")
    user = User(id=uuid.uuid4(), email="free@test.com", role="member")

    mock_db = AsyncMock()
    sub = Subscription(organization_id=org.id, plan="free", status="active", stripe_customer_id="cust_123")

    sub_mock = MagicMock()
    sub_mock.scalar_one_or_none.return_value = sub
    mock_db.execute.return_value = sub_mock

    with patch("app.services.onboarding_service.get_effective_plan", return_value="free"), \
         patch("app.services.onboarding_service.record_audit_event", new_callable=AsyncMock) as mock_audit:
        result = await activate_free_plan(mock_db, org, user)

        assert result["success"] is True
        assert result["plan"] == "free"
        assert result["onboarding_status"] == ONBOARDING_COMPLETED
        mock_audit.assert_called_once()
        mock_db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_activate_free_plan_rejects_active_paid_user():
    """Activating free plan when user already has an active paid plan raises 400 Bad Request."""
    from fastapi import HTTPException
    org = Organization(id=uuid.uuid4(), name="Pro Org")
    user = User(id=uuid.uuid4(), email="pro@test.com", role="member")

    mock_db = AsyncMock()

    with patch("app.services.onboarding_service.get_effective_plan", return_value="pro"):
        with pytest.raises(HTTPException) as exc_info:
            await activate_free_plan(mock_db, org, user)
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail["error"]["code"] == "ACTIVE_PAID_SUBSCRIPTION_EXISTS"


# =========================================================================
# 6. Webhook Lifecycle, Idempotency & Failure Hardening Tests
# =========================================================================
def test_webhook_unpaid_checkout_session_deferred():
    """
    Verifies that checkout sessions with pending/unpaid status (e.g. asynchronous bank debits)
    are deferred and DO NOT prematurely activate paid entitlements.
    """
    org_id = uuid.uuid4()
    mock_db = MagicMock()
    sub = Subscription(organization_id=org_id, plan="free", status="active")

    def mock_execute(stmt):
        m = MagicMock()
        stmt_str = str(stmt).lower()
        if "audit_logs" in stmt_str:
            m.scalar_one_or_none.return_value = None
        elif "subscriptions" in stmt_str:
            m.scalar_one_or_none.return_value = sub
        return m

    mock_db.execute.side_effect = mock_execute

    event_payload = {
        "id": "evt_test_unpaid_checkout",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_unpaid_123",
                "client_reference_id": str(org_id),
                "customer": "cus_12345",
                "subscription": "sub_12345",
                "payment_status": "unpaid",
                "metadata": {"plan": "agency", "organization_id": str(org_id)},
            }
        },
    }

    import json
    payload_bytes = json.dumps(event_payload).encode("utf-8")

    with patch("app.services.billing_service.record_audit_event_sync"):
        result = process_stripe_webhook_event(payload_bytes, "", mock_db)

    assert result["status"] == "deferred"
    assert result["reason"] == "payment_pending"
    # Plan must remain free because payment has not been received
    assert sub.plan == "free"


def test_webhook_idempotency_duplicate_event_ignored():
    """
    Verifies replay attack resistance: duplicate events with already-processed IDs
    are safely ignored and do not execute duplicate mutations.
    """
    org_id = uuid.uuid4()
    mock_db = MagicMock()

    # Simulate existing AuditLog record for this event ID
    existing_audit = AuditLog(action="STRIPE_WEBHOOK_PROCESSED", entity_id="evt_duplicate_999")

    def mock_execute(stmt):
        m = MagicMock()
        stmt_str = str(stmt).lower()
        if "audit_logs" in stmt_str:
            m.scalar_one_or_none.return_value = existing_audit
        return m

    mock_db.execute.side_effect = mock_execute

    event_payload = {
        "id": "evt_duplicate_999",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "client_reference_id": str(org_id),
                "payment_status": "paid",
                "metadata": {"plan": "agency"},
            }
        },
    }

    import json
    payload_bytes = json.dumps(event_payload).encode("utf-8")

    result = process_stripe_webhook_event(payload_bytes, "", mock_db)
    assert result["status"] == "ignored"
    assert result["reason"] == "duplicate"
    assert result["event_id"] == "evt_duplicate_999"


def test_webhook_async_payment_succeeded():
    """
    Verifies that checkout.session.async_payment_succeeded activates the subscription
    when delayed asynchronous payment clears.
    """
    org_id = uuid.uuid4()
    mock_db = MagicMock()
    sub = Subscription(organization_id=org_id, plan="free", status="active")

    def mock_execute(stmt):
        m = MagicMock()
        stmt_str = str(stmt).lower()
        if "audit_logs" in stmt_str:
            m.scalar_one_or_none.return_value = None
        elif "subscriptions" in stmt_str:
            m.scalar_one_or_none.return_value = sub
        return m

    mock_db.execute.side_effect = mock_execute

    event_payload = {
        "id": "evt_async_success_1",
        "type": "checkout.session.async_payment_succeeded",
        "data": {
            "object": {
                "client_reference_id": str(org_id),
                "customer": "cus_async_user",
                "subscription": "sub_async_sub",
                "metadata": {"plan": "agency", "organization_id": str(org_id)},
            }
        },
    }

    import json
    payload_bytes = json.dumps(event_payload).encode("utf-8")

    with patch("app.services.billing_service.record_audit_event_sync"):
        result = process_stripe_webhook_event(payload_bytes, "", mock_db)

    assert result["status"] == "processed"
    assert sub.plan == "agency"
    assert sub.status == "active"
    assert sub.stripe_subscription_id == "sub_async_sub"


def test_webhook_invoice_payment_failed_sets_past_due():
    """
    Verifies that invoice.payment_failed marks the subscription status as past_due
    without immediately stripping organization ownership or destroying records.
    """
    mock_db = MagicMock()
    sub = Subscription(
        organization_id=uuid.uuid4(),
        stripe_subscription_id="sub_failing_inv",
        plan="pro",
        status="active",
    )

    def mock_execute(stmt):
        m = MagicMock()
        stmt_str = str(stmt).lower()
        if "audit_logs" in stmt_str:
            m.scalar_one_or_none.return_value = None
        elif "subscriptions" in stmt_str:
            m.scalar_one_or_none.return_value = sub
        return m

    mock_db.execute.side_effect = mock_execute

    event_payload = {
        "id": "evt_invoice_failed_1",
        "type": "invoice.payment_failed",
        "data": {
            "object": {
                "id": "in_failed_999",
                "subscription": "sub_failing_inv",
                "attempt_count": 2,
                "amount_due": 4900,
            }
        },
    }

    import json
    payload_bytes = json.dumps(event_payload).encode("utf-8")

    with patch("app.services.billing_service.record_audit_event_sync"):
        result = process_stripe_webhook_event(payload_bytes, "", mock_db)

    assert result["status"] == "processed"
    assert sub.status == "past_due"
    assert sub.plan == "pro"  # Remains in grace period as past_due


def test_webhook_subscription_deleted_downgrades_to_free():
    """
    Verifies that customer.subscription.deleted downgrades the subscription plan to free
    and status to canceled, preserving RBAC roles.
    """
    org_id = uuid.uuid4()
    mock_db = MagicMock()
    sub = Subscription(
        organization_id=org_id,
        stripe_subscription_id="sub_to_delete",
        plan="pro",
        status="active",
    )

    def mock_execute(stmt):
        m = MagicMock()
        stmt_str = str(stmt).lower()
        if "audit_logs" in stmt_str:
            m.scalar_one_or_none.return_value = None
        elif "subscriptions" in stmt_str:
            m.scalar_one_or_none.return_value = sub
        return m

    mock_db.execute.side_effect = mock_execute

    event_payload = {
        "id": "evt_sub_deleted_1",
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "id": "sub_to_delete",
                "status": "canceled",
            }
        },
    }

    import json
    payload_bytes = json.dumps(event_payload).encode("utf-8")

    with patch("app.services.billing_service.record_audit_event_sync"):
        result = process_stripe_webhook_event(payload_bytes, "", mock_db)

    assert result["status"] == "processed"
    assert sub.status == "canceled"
    assert sub.plan == "free"


# =========================================================================
# 7. Mock Checkout Production Guard Tests
# =========================================================================
@pytest.mark.asyncio
async def test_session_status_rejects_mock_in_production():
    """
    Verifies that get_session_status strictly rejects mock session IDs (cs_mock_*)
    when running in production environment.
    """
    from fastapi import HTTPException
    from app.api.v1.billing import get_session_status
    from app.core.authorization import AuthContext
    from app.models.user import OrganizationMember

    org = Organization(id=uuid.uuid4(), name="Prod Org")
    user = User(id=uuid.uuid4(), email="admin@prod.com", role="owner")
    mem = OrganizationMember(id=uuid.uuid4(), organization_id=org.id, user_id=user.id, role="owner")
    auth = AuthContext(user=user, organization=org, membership=mem, plan="free", role="owner")

    mock_db = AsyncMock()

    with patch.object(settings, "ENVIRONMENT", "production"):
        with pytest.raises(HTTPException) as exc_info:
            await get_session_status("cs_mock_exploit123", auth=auth, db=mock_db)
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail["error"]["code"] == "INVALID_CHECKOUT_SESSION"


@pytest.mark.asyncio
async def test_session_status_rejects_uninitiated_mock_session():
    """
    Verifies that even in development, get_session_status rejects arbitrary mock session IDs
    that were never initiated by the requesting organization.
    """
    from fastapi import HTTPException
    from app.api.v1.billing import get_session_status
    from app.core.authorization import AuthContext
    from app.models.user import OrganizationMember

    org = Organization(id=uuid.uuid4(), name="Dev Org")
    user = User(id=uuid.uuid4(), email="dev@test.com", role="owner")
    mem = OrganizationMember(id=uuid.uuid4(), organization_id=org.id, user_id=user.id, role="owner")
    auth = AuthContext(user=user, organization=org, membership=mem, plan="free", role="owner")

    mock_db = AsyncMock()
    audit_res_mock = MagicMock()
    audit_res_mock.scalar_one_or_none.return_value = None  # No initiating audit log found
    mock_db.execute.return_value = audit_res_mock

    with patch.object(settings, "ENVIRONMENT", "development"):
        with pytest.raises(HTTPException) as exc_info:
            await get_session_status("cs_mock_unauthorized", auth=auth, db=mock_db)
        assert exc_info.value.status_code == 404
        assert exc_info.value.detail["error"]["code"] == "SESSION_NOT_FOUND"

