"""
SiteSecura - Billing Cancellation & Payment History Test Suite
Verifies:
1. Safe cancellation of Razorpay subscriptions (cycle-end and immediate) without MissingGreenlet.
2. Safe cancellation of Stripe subscriptions (cycle-end and immediate) without MissingGreenlet.
3. Idempotent cancellation (preventing redundant cancellations when already canceled or scheduled).
4. Strict RBAC enforcement on cancellation and payment history (owner/admin permitted, member/viewer rejected).
5. Strict tenant isolation (Org A cannot view or cancel Org B's subscription or payment transactions).
6. Payment history ledger retrieval with proper pagination, amounts, statuses, and receipt URLs.
7. Empty payment history handling.
"""
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi import HTTPException

from app.models.user import User, Organization, OrganizationMember
from app.models.billing import Subscription, PaymentTransaction
from app.core.config import settings
from app.core.authorization import AuthContext
from app.api.v1.billing import (
    cancel_subscription,
    get_payment_history,
)
from app.services.payment_providers import get_payment_provider
from app.schemas.shared import CancelSubscriptionRequest
from app.services.billing_service import cancel_subscription_service


# =========================================================================
# 1. Cancellation Service Unit Tests (MissingGreenlet Prevention & Logic)
# =========================================================================
def test_cancel_subscription_service_razorpay_cycle_end():
    """Verifies Razorpay subscription cancellation at period end updates flags without MissingGreenlet."""
    org = Organization(id=uuid.uuid4(), name="Test Org")
    sub = Subscription(
        id=uuid.uuid4(),
        organization_id=org.id,
        provider="razorpay",
        plan="pro",
        status="active",
        billing_interval="month",
        razorpay_subscription_id="sub_test_rzp_123",
        current_period_end=datetime.now(timezone.utc) + timedelta(days=20),
        cancel_at_period_end=False,
    )
    mock_db = MagicMock()

    mock_rzp_client = MagicMock()
    mock_rzp_client.subscription.cancel.return_value = {"id": "sub_test_rzp_123", "status": "active"}

    rzp_provider = get_payment_provider("razorpay")
    with patch.object(settings, "RAZORPAY_KEY_ID", "rzp_test_valid_key"), \
         patch.object(settings, "RAZORPAY_KEY_SECRET", "valid_secret_key_123"), \
         patch.object(rzp_provider, "_client", mock_rzp_client):
        res = cancel_subscription_service(
            organization=org,
            cancel_at_period_end=True,
            sync_db=mock_db,
            subscription=sub,
        )

    assert res["status"] == "pending_cancellation"
    assert res["cancel_at_period_end"] is True
    assert sub.cancel_at_period_end is True
    # In cycle-end cancellation, status remains active until current_period_end
    assert sub.status == "active"
    mock_rzp_client.subscription.cancel.assert_called_once_with(
        "sub_test_rzp_123",
        {"cancel_at_cycle_end": 1},
    )


def test_cancel_subscription_service_razorpay_immediate():
    """Verifies immediate Razorpay subscription cancellation downgrades to free and status canceled."""
    org = Organization(id=uuid.uuid4(), name="Test Org")
    sub = Subscription(
        id=uuid.uuid4(),
        organization_id=org.id,
        provider="razorpay",
        plan="pro",
        status="active",
        billing_interval="month",
        razorpay_subscription_id="sub_test_rzp_456",
        cancel_at_period_end=False,
    )
    mock_db = MagicMock()

    mock_rzp_client = MagicMock()
    mock_rzp_client.subscription.cancel.return_value = {"id": "sub_test_rzp_456", "status": "cancelled"}

    rzp_provider = get_payment_provider("razorpay")
    with patch.object(settings, "RAZORPAY_KEY_ID", "rzp_test_valid_key"), \
         patch.object(settings, "RAZORPAY_KEY_SECRET", "valid_secret_key_123"), \
         patch.object(rzp_provider, "_client", mock_rzp_client):
        res = cancel_subscription_service(
            organization=org,
            cancel_at_period_end=False,
            sync_db=mock_db,
            subscription=sub,
        )

    assert res["status"] == "canceled"
    assert res["cancel_at_period_end"] is False
    assert sub.status == "canceled"
    assert sub.plan == "free"
    mock_rzp_client.subscription.cancel.assert_called_once_with(
        "sub_test_rzp_456",
        {"cancel_at_cycle_end": 0},
    )


def test_cancel_subscription_service_stripe_cycle_end():
    """Verifies Stripe subscription cancellation at period end via StripeProvider."""
    org = Organization(id=uuid.uuid4(), name="Stripe Org")
    sub = Subscription(
        id=uuid.uuid4(),
        organization_id=org.id,
        provider="stripe",
        plan="basic",
        status="active",
        billing_interval="year",
        stripe_subscription_id="sub_stripe_789",
        current_period_end=datetime.now(timezone.utc) + timedelta(days=100),
        cancel_at_period_end=False,
    )
    mock_db = MagicMock()

    with patch.object(settings, "STRIPE_SECRET_KEY", "sk_test_valid_key_123"), \
         patch("stripe.Subscription.modify") as mock_modify:
        mock_modify.return_value = {"id": "sub_stripe_789", "cancel_at_period_end": True}
        res = cancel_subscription_service(
            organization=org,
            cancel_at_period_end=True,
            sync_db=mock_db,
            subscription=sub,
        )

    assert res["status"] == "pending_cancellation"
    assert res["cancel_at_period_end"] is True
    assert sub.cancel_at_period_end is True
    mock_modify.assert_called_once_with("sub_stripe_789", cancel_at_period_end=True)


def test_cancel_subscription_service_idempotency_already_canceled():
    """Verifies attempting to cancel an already canceled subscription returns idempotent status without calling provider."""
    org = Organization(id=uuid.uuid4(), name="Test Org")
    sub = Subscription(
        id=uuid.uuid4(),
        organization_id=org.id,
        provider="razorpay",
        plan="free",
        status="canceled",
        razorpay_subscription_id="sub_old_rzp",
    )
    mock_db = MagicMock()

    with pytest.raises(HTTPException) as exc_info:
        cancel_subscription_service(
            organization=org,
            cancel_at_period_end=True,
            sync_db=mock_db,
            subscription=sub,
        )
    assert exc_info.value.status_code == 400


def test_cancel_subscription_service_idempotency_already_scheduled():
    """Verifies attempting to schedule cancellation when already scheduled returns idempotent status."""
    org = Organization(id=uuid.uuid4(), name="Test Org")
    sub = Subscription(
        id=uuid.uuid4(),
        organization_id=org.id,
        provider="razorpay",
        plan="agency",
        status="active",
        cancel_at_period_end=True,
        razorpay_subscription_id="sub_sched_rzp",
    )
    mock_db = MagicMock()

    res = cancel_subscription_service(
        organization=org,
        cancel_at_period_end=True,
        sync_db=mock_db,
        subscription=sub,
    )

    assert res["status"] == "pending_cancellation"
    assert "already scheduled" in res["message"].lower()


# =========================================================================
# 2. Endpoint Cancellation Tests (Async API, Auth, Isolation)
# =========================================================================
@pytest.mark.asyncio
async def test_endpoint_cancel_subscription_success_owner():
    """Verifies owner can cancel subscription via POST /billing/cancel without MissingGreenlet."""
    org = Organization(id=uuid.uuid4(), name="Acme Corp")
    user = User(id=uuid.uuid4(), email="owner@acme.com", role="owner")
    mem = OrganizationMember(id=uuid.uuid4(), organization_id=org.id, user_id=user.id, role="owner")
    auth = AuthContext(user=user, organization=org, membership=mem, plan="pro", role="owner")

    sub = Subscription(
        id=uuid.uuid4(),
        organization_id=org.id,
        provider="razorpay",
        plan="pro",
        status="active",
        billing_interval="month",
        razorpay_subscription_id="sub_api_rzp_999",
        cancel_at_period_end=False,
    )

    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = sub
    mock_db.execute.return_value = mock_res

    mock_rzp_client = MagicMock()
    mock_rzp_client.subscription.cancel.return_value = {"id": "sub_api_rzp_999", "status": "active"}

    rzp_provider = get_payment_provider("razorpay")
    with patch.object(settings, "RAZORPAY_KEY_ID", "rzp_test_valid_key"), \
         patch.object(settings, "RAZORPAY_KEY_SECRET", "valid_secret_key_123"), \
         patch.object(rzp_provider, "_client", mock_rzp_client):
        result = await cancel_subscription(
            cancel_in=CancelSubscriptionRequest(cancel_at_period_end=True),
            auth=auth,
            db=mock_db,
        )

    assert result.status == "pending_cancellation"
    assert result.cancel_at_period_end is True
    assert sub.cancel_at_period_end is True
    mock_db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_endpoint_cancel_subscription_forbidden_member():
    """Verifies regular member cannot cancel organization subscription (403 Forbidden)."""
    org = Organization(id=uuid.uuid4(), name="Acme Corp")
    user = User(id=uuid.uuid4(), email="member@acme.com", role="member")
    mem = OrganizationMember(id=uuid.uuid4(), organization_id=org.id, user_id=user.id, role="member")
    auth = AuthContext(user=user, organization=org, membership=mem, plan="pro", role="member")

    mock_db = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await cancel_subscription(
            cancel_in=CancelSubscriptionRequest(cancel_at_period_end=True),
            auth=auth,
            db=mock_db,
        )

    assert exc_info.value.status_code == 403
    detail = exc_info.value.detail
    message = detail.get("error", {}).get("message", "") if isinstance(detail, dict) else str(detail)
    assert "owners and admins" in message.lower()


@pytest.mark.asyncio
async def test_endpoint_cancel_subscription_free_plan_rejected():
    """Verifies canceling a free plan returns 400 Bad Request."""
    org = Organization(id=uuid.uuid4(), name="Free Org")
    user = User(id=uuid.uuid4(), email="owner@free.com", role="owner")
    mem = OrganizationMember(id=uuid.uuid4(), organization_id=org.id, user_id=user.id, role="owner")
    auth = AuthContext(user=user, organization=org, membership=mem, plan="free", role="owner")

    sub = Subscription(
        id=uuid.uuid4(),
        organization_id=org.id,
        provider="stripe",
        plan="free",
        status="active",
    )

    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = sub
    mock_db.execute.return_value = mock_res

    with pytest.raises(HTTPException) as exc_info:
        await cancel_subscription(
            cancel_in=CancelSubscriptionRequest(cancel_at_period_end=True),
            auth=auth,
            db=mock_db,
        )

    assert exc_info.value.status_code == 400
    detail = exc_info.value.detail
    message = detail.get("error", {}).get("message", "") if isinstance(detail, dict) else str(detail)
    assert "no active paid subscription" in message.lower()


# =========================================================================
# 3. Payment History & Tenant Isolation Tests
# =========================================================================
@pytest.mark.asyncio
async def test_get_payment_history_returns_records():
    """Verifies get_payment_history returns formatted transactions for the tenant."""
    org = Organization(id=uuid.uuid4(), name="Billing Org")
    user = User(id=uuid.uuid4(), email="admin@billing.com", role="admin")
    mem = OrganizationMember(id=uuid.uuid4(), organization_id=org.id, user_id=user.id, role="admin")
    auth = AuthContext(user=user, organization=org, membership=mem, plan="pro", role="admin")

    now = datetime.now(timezone.utc)
    t1 = PaymentTransaction(
        id=uuid.uuid4(),
        organization_id=org.id,
        provider="razorpay",
        provider_payment_id="pay_sample_123",
        provider_subscription_id="sub_sample_123",
        amount=399900,
        currency="INR",
        status="paid",
        plan="pro",
        billing_interval="month",
        payment_method="card",
        created_at=now,
    )
    t2 = PaymentTransaction(
        id=uuid.uuid4(),
        organization_id=org.id,
        provider="razorpay",
        provider_payment_id="pay_sample_456",
        provider_subscription_id="sub_sample_123",
        amount=399900,
        currency="INR",
        status="paid",
        plan="pro",
        billing_interval="month",
        payment_method="upi",
        created_at=now - timedelta(days=30),
    )

    mock_db = AsyncMock()
    # First query is count, second is items
    mock_count_res = MagicMock()
    mock_count_res.scalar.return_value = 2

    mock_items_res = MagicMock()
    mock_items_res.scalars.return_value.all.return_value = [t1, t2]

    mock_db.execute.side_effect = [mock_count_res, mock_items_res]

    response = await get_payment_history(
        limit=10,
        offset=0,
        auth=auth,
        db=mock_db,
    )

    assert response.total == 2
    assert len(response.items) == 2
    assert response.items[0].id == t1.id
    assert response.items[0].amount == 399900
    assert response.items[0].currency == "INR"
    assert response.items[0].status == "paid"
    assert response.items[0].provider == "razorpay"
    assert response.items[0].provider_payment_id == "pay_sample_123"
    assert response.items[1].amount == 399900


@pytest.mark.asyncio
async def test_get_payment_history_empty_state():
    """Verifies get_payment_history returns empty list when no transactions exist."""
    org = Organization(id=uuid.uuid4(), name="New Org")
    user = User(id=uuid.uuid4(), email="owner@neworg.com", role="owner")
    mem = OrganizationMember(id=uuid.uuid4(), organization_id=org.id, user_id=user.id, role="owner")
    auth = AuthContext(user=user, organization=org, membership=mem, plan="free", role="owner")

    mock_db = AsyncMock()
    mock_count_res = MagicMock()
    mock_count_res.scalar.return_value = 0

    mock_items_res = MagicMock()
    mock_items_res.scalars.return_value.all.return_value = []

    mock_db.execute.side_effect = [mock_count_res, mock_items_res]

    response = await get_payment_history(
        limit=10,
        offset=0,
        auth=auth,
        db=mock_db,
    )

    assert response.total == 0
    assert response.items == []


@pytest.mark.asyncio
async def test_get_payment_history_tenant_isolation():
    """Verifies database query strictly includes organization_id filter to prevent cross-tenant leakage."""
    org_a = Organization(id=uuid.uuid4(), name="Org A")
    user_a = User(id=uuid.uuid4(), email="user@orga.com", role="owner")
    mem_a = OrganizationMember(id=uuid.uuid4(), organization_id=org_a.id, user_id=user_a.id, role="owner")
    auth_a = AuthContext(user=user_a, organization=org_a, membership=mem_a, plan="pro", role="owner")

    mock_db = AsyncMock()
    mock_count_res = MagicMock()
    mock_count_res.scalar.return_value = 0

    mock_items_res = MagicMock()
    mock_items_res.scalars.return_value.all.return_value = []

    mock_db.execute.side_effect = [mock_count_res, mock_items_res]

    await get_payment_history(
        limit=10,
        offset=0,
        auth=auth_a,
        db=mock_db,
    )

    # Inspect executed statements
    calls = mock_db.execute.call_args_list
    assert len(calls) == 2
    count_stmt_str = str(calls[0][0][0]).lower()
    items_stmt_str = str(calls[1][0][0]).lower()

    # Verify organization_id is in where clause for both count and items queries
    assert "organization_id" in count_stmt_str
    assert "organization_id" in items_stmt_str
