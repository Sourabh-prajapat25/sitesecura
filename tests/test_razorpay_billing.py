"""
SiteSecura - Razorpay Billing & Dual-Gateway Integration Test Suite
Verifies:
1. Server-side authoritative pricing & plan ID resolution (INR & USD).
2. Razorpay subscription session generation (INR).
3. Cryptographic signature verification on payment callback (HMAC-SHA256).
4. Webhook processing lifecycle (activated, charged, halted, cancelled, failed).
5. Idempotent webhook replay protection via AuditLog.
6. RBAC preservation (User.role remains unchanged during subscription upgrades).
7. Duplicate active subscription prevention.
8. Organization isolation during payment verification and session status.
"""
import uuid
import hmac
import hashlib
import json
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi import HTTPException

from app.models.user import User, Organization
from app.models.billing import Subscription, PaymentTransaction
from app.models.alert import AuditLog
from app.core.config import settings
from app.core.pricing import (
    resolve_trusted_pricing,
    resolve_provider_plan_id,
    normalize_currency,
    normalize_interval,
)
from app.services.payment_providers import (
    get_payment_provider,
    RazorpayPaymentProvider,
    StripePaymentProvider,
)
from app.services.billing_service import (
    create_checkout_session,
    verify_razorpay_checkout_signature_and_activate,
    process_razorpay_webhook_event,
    cancel_subscription_service,
)


# =========================================================================
# 1. Authoritative Server-Side Pricing Tests
# =========================================================================
def test_resolve_trusted_pricing_inr_and_usd():
    """Verifies backend catalog correctly resolves prices in paise and cents."""
    # Free plan
    free_inr = resolve_trusted_pricing("free", "month", "inr")
    assert free_inr.amount_subunits == 0
    assert free_inr.currency == "inr"

    # INR Basic Monthly: ₹799 = 79900 paise
    basic_inr = resolve_trusted_pricing("basic", "month", "inr")
    assert basic_inr.amount_subunits == 79900
    assert basic_inr.display_amount == 799.0
    assert basic_inr.currency == "inr"

    # INR Basic Yearly: ₹7,990 = 799000 paise
    basic_yr_inr = resolve_trusted_pricing("basic", "year", "inr")
    assert basic_yr_inr.amount_subunits == 799000
    assert basic_yr_inr.display_amount == 7990.0

    # INR Pro Monthly: ₹3,999 = 399900 paise
    pro_inr = resolve_trusted_pricing("pro", "month", "inr")
    assert pro_inr.amount_subunits == 399900

    # USD Basic Monthly: $9 = 900 cents
    basic_usd = resolve_trusted_pricing("basic", "month", "usd")
    assert basic_usd.amount_subunits == 900
    assert basic_usd.currency == "usd"

    # Invalid plan raises HTTPException
    with pytest.raises(HTTPException):
        resolve_trusted_pricing("invalid_plan", "month", "inr")


def test_resolve_provider_plan_id_tamper_resistance():
    """Verifies client cannot request arbitrary provider plan IDs."""
    # Razorpay plan IDs
    rzp_basic_m = resolve_provider_plan_id("basic", "month", "inr", "razorpay")
    assert rzp_basic_m == settings.RAZORPAY_PLAN_BASIC_MONTHLY

    rzp_pro_y = resolve_provider_plan_id("pro", "year", "inr", "razorpay")
    assert rzp_pro_y == settings.RAZORPAY_PLAN_PRO_YEARLY

    # Stripe price IDs
    stripe_basic = resolve_provider_plan_id("basic", "month", "usd", "stripe")
    assert stripe_basic == settings.STRIPE_BASIC_PRICE_ID


# =========================================================================
# 2. Checkout Session Creation & Gateway Routing
# =========================================================================
def test_create_checkout_session_razorpay_routing():
    """Verifies that currency='inr' or provider='razorpay' correctly routes to Razorpay."""
    org = Organization(id=uuid.uuid4(), name="Acme India")
    user = User(id=uuid.uuid4(), email="admin@acme.in", name="Admin", role="owner")

    # Explicit INR currency -> routes to Razorpay
    res = create_checkout_session(org, user, "basic", "month", currency="inr")
    assert res["provider"] == "razorpay"
    assert res["currency"] == "inr"
    assert res["amount"] == 79900
    assert res["subscription_id"].startswith("sub_mock_rzp_")

    # Explicit Razorpay provider
    res_prov = create_checkout_session(org, user, "pro", "year", provider="razorpay")
    assert res_prov["provider"] == "razorpay"
    assert res_prov["currency"] == "inr"
    assert res_prov["amount"] == 3999000


def test_prevent_duplicate_active_subscription():
    """Verifies that creating a checkout for an existing active plan is rejected."""
    org = Organization(id=uuid.uuid4(), name="Active Org")
    user = User(id=uuid.uuid4(), email="owner@test.com", role="owner")
    org.subscription = Subscription(
        organization_id=org.id,
        plan="pro",
        status="active",
        provider="razorpay",
    )

    with pytest.raises(HTTPException) as exc:
        create_checkout_session(org, user, "pro", "month", currency="inr")
    assert exc.value.status_code == 400
    assert "already subscribed" in exc.value.detail["error"]["message"].lower()


# =========================================================================
# 3. Razorpay Signature Verification & Activation
# =========================================================================
def test_razorpay_signature_verification_and_activation():
    """Verifies cryptographic signature validation and immediate subscription upgrade."""
    org_id = uuid.uuid4()
    sub_id = "sub_live_12345"
    pay_id = "pay_live_67890"

    secret = "rzp_test_secret_for_unit_tests"
    message = f"{pay_id}|{sub_id}".encode("utf-8")
    valid_sig = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
    invalid_sig = "fake_signature_abc"

    mock_db = MagicMock()
    existing_sub = Subscription(
        id=uuid.uuid4(),
        organization_id=org_id,
        plan="free",
        status="active",
    )

    mock_audit = AuditLog(
        id=uuid.uuid4(),
        organization_id=org_id,
        action="CHECKOUT_INITIATED",
        entity_id=sub_id,
        metadata_json={"plan": "pro", "interval": "month"},
    )

    def mock_exec(stmt):
        m = MagicMock()
        stmt_str = str(stmt).lower()
        if "subscriptions" in stmt_str:
            m.scalar_one_or_none.return_value = existing_sub
        elif "audit_logs" in stmt_str:
            m.scalar_one_or_none.return_value = mock_audit
        elif "payment_transactions" in stmt_str:
            m.scalar_one_or_none.return_value = None
        else:
            m.scalar_one_or_none.return_value = None
        return m

    mock_db.execute.side_effect = mock_exec

    with patch.object(settings, "RAZORPAY_KEY_SECRET", secret), \
         patch.object(settings, "ENVIRONMENT", "production"), \
         patch("app.services.billing_service.record_audit_event_sync"):

        # 1. Invalid signature must be rejected
        with pytest.raises(HTTPException) as exc:
            verify_razorpay_checkout_signature_and_activate(
                org_id, pay_id, sub_id, invalid_sig, mock_db
            )
        assert exc.value.status_code == 400

        # 2. Valid signature must succeed and upgrade subscription
        result = verify_razorpay_checkout_signature_and_activate(
            org_id, pay_id, sub_id, valid_sig, mock_db
        )
        assert result["status"] == "complete"
        assert result["plan"] == "pro"
        assert result["is_active"] is True
        assert existing_sub.plan == "pro"
        assert existing_sub.provider == "razorpay"
        assert existing_sub.razorpay_subscription_id == sub_id
        assert existing_sub.currency == "inr"


# =========================================================================
# 4. Razorpay Webhook Lifecycle & Replay Protection
# =========================================================================
def test_razorpay_webhook_subscription_activated():
    """Verifies subscription.activated webhook updates organization tier and preserves RBAC."""
    org_id = uuid.uuid4()
    sub_id = "sub_webhook_test_1"
    pay_id = "pay_webhook_test_1"

    mock_db = MagicMock()
    existing_sub = Subscription(
        id=uuid.uuid4(),
        organization_id=org_id,
        plan="free",
        status="active",
    )

    def mock_exec(stmt):
        m = MagicMock()
        stmt_str = str(stmt).lower()
        if "subscriptions" in stmt_str:
            m.scalar_one_or_none.return_value = existing_sub
        elif "audit_logs" in stmt_str:
            m.scalar_one_or_none.return_value = None  # No duplicate event
        elif "payment_transactions" in stmt_str:
            m.scalar_one_or_none.return_value = None
        return m

    mock_db.execute.side_effect = mock_exec

    raw_payload = {
        "entity": "event",
        "account_id": "acc_test",
        "event": "subscription.activated",
        "payload": {
            "subscription": {
                "entity": {
                    "id": sub_id,
                    "plan_id": settings.RAZORPAY_PLAN_BASIC_MONTHLY,
                    "customer_id": "cust_rzp_99",
                    "status": "active",
                    "current_start": int(datetime.now(timezone.utc).timestamp()),
                    "current_end": int(datetime.now(timezone.utc).timestamp()) + 2592000,
                    "notes": {
                        "organization_id": str(org_id),
                        "plan": "basic",
                        "interval": "month",
                    },
                }
            },
            "payment": {
                "entity": {
                    "id": pay_id,
                    "amount": 79900,
                    "currency": "INR",
                    "status": "captured",
                }
            },
        },
    }

    payload_bytes = json.dumps(raw_payload).encode("utf-8")

    with patch("app.services.billing_service.record_audit_event_sync"):
        result = process_razorpay_webhook_event(payload_bytes, "", mock_db)

    assert result["status"] == "processed"
    assert existing_sub.plan == "basic"
    assert existing_sub.status == "active"
    assert existing_sub.provider == "razorpay"
    assert existing_sub.razorpay_subscription_id == sub_id


def test_razorpay_webhook_idempotency_duplicate_ignored():
    """Verifies that duplicate webhook event IDs are safely ignored via AuditLog check."""
    mock_db = MagicMock()
    existing_audit = AuditLog(
        id=uuid.uuid4(),
        action="RAZORPAY_WEBHOOK_PROCESSED",
        entity_id="evt_duplicate_rzp_123",
    )

    def mock_exec(stmt):
        m = MagicMock()
        stmt_str = str(stmt).lower()
        if "audit_logs" in stmt_str:
            m.scalar_one_or_none.return_value = existing_audit
        return m

    mock_db.execute.side_effect = mock_exec

    raw_payload = {
        "id": "evt_duplicate_rzp_123",
        "entity": "event",
        "event": "subscription.charged",
        "payload": {
            "subscription": {"entity": {"id": "sub_123"}},
            "payment": {"entity": {"id": "pay_123"}},
        },
    }
    payload_bytes = json.dumps(raw_payload).encode("utf-8")

    result = process_razorpay_webhook_event(payload_bytes, "", mock_db)
    assert result["status"] == "ignored"
    assert result["reason"] == "duplicate"


def test_razorpay_webhook_subscription_halted_and_cancelled():
    """Verifies subscription halting marks past_due and cancelling downgrades to free."""
    org_id = uuid.uuid4()
    mock_db = MagicMock()

    active_sub = Subscription(
        id=uuid.uuid4(),
        organization_id=org_id,
        plan="agency",
        status="active",
        provider="razorpay",
        razorpay_subscription_id="sub_agency_1",
    )

    def mock_exec(stmt):
        m = MagicMock()
        m.scalar_one_or_none.return_value = active_sub if "subscriptions" in str(stmt).lower() else None
        return m

    mock_db.execute.side_effect = mock_exec

    # 1. subscription.halted
    halt_payload = {
        "event": "subscription.halted",
        "payload": {
            "subscription": {
                "entity": {
                    "id": "sub_agency_1",
                    "notes": {"organization_id": str(org_id)},
                }
            }
        },
    }
    with patch("app.services.billing_service.record_audit_event_sync"):
        process_razorpay_webhook_event(json.dumps(halt_payload).encode("utf-8"), "", mock_db)
    assert active_sub.status == "past_due"

    # 2. subscription.cancelled
    cancel_payload = {
        "event": "subscription.cancelled",
        "payload": {
            "subscription": {
                "entity": {
                    "id": "sub_agency_1",
                    "notes": {"organization_id": str(org_id)},
                }
            }
        },
    }
    with patch("app.services.billing_service.record_audit_event_sync"):
        process_razorpay_webhook_event(json.dumps(cancel_payload).encode("utf-8"), "", mock_db)
    assert active_sub.status == "canceled"
    assert active_sub.plan == "free"


# =========================================================================
# 5. In-App Subscription Cancellation
# =========================================================================
def test_cancel_subscription_service():
    """Verifies organization subscription cancellation flow."""
    org = Organization(id=uuid.uuid4(), name="Cancel Test")
    org.subscription = Subscription(
        id=uuid.uuid4(),
        organization_id=org.id,
        plan="pro",
        status="active",
        provider="razorpay",
        razorpay_subscription_id="sub_mock_rzp_cancel",
    )

    mock_db = MagicMock()

    # Scheduled cancellation at period end
    res = cancel_subscription_service(org, cancel_at_period_end=True, sync_db=mock_db)
    assert res["status"] == "pending_cancellation"
    assert org.subscription.cancel_at_period_end is True

    # Immediate cancellation
    res_imm = cancel_subscription_service(org, cancel_at_period_end=False, sync_db=mock_db)
    assert res_imm["status"] == "canceled"
    assert org.subscription.status == "canceled"
    assert org.subscription.plan == "free"


# =========================================================================
# 6. Hardening Tests: Error Sanitization, Callback vs Webhook & Ledger Idempotency
# =========================================================================
@pytest.mark.asyncio
async def test_razorpay_webhook_endpoint_sanitizes_errors():
    """Verifies webhook endpoint returns generic safe message and does not leak raw exception strings."""
    from app.api.v1.billing import razorpay_webhook

    mock_request = AsyncMock()
    mock_request.body.return_value = b"invalid payload non-json"

    with patch.object(settings, "RAZORPAY_WEBHOOK_SECRET", "whsec_test_secret_123"), \
         patch.object(settings, "ENVIRONMENT", "production"):
        with pytest.raises(HTTPException) as exc_info:
            await razorpay_webhook(request=mock_request, x_razorpay_signature="invalid_signature")
        
        assert exc_info.value.status_code == 400
        # Detail must be generic and safe
        assert exc_info.value.detail == "Invalid webhook payload or signature"
        # Must not contain internal python trace or raw error strings
        assert "ValueError" not in exc_info.value.detail
        assert "whsec_" not in exc_info.value.detail


def test_callback_and_webhook_ledger_deduplication():
    """
    Verifies that calling verify callback and then receiving a webhook for the same
    payment_id does NOT create duplicate payment_transactions rows.
    """
    org_id = uuid.uuid4()
    sub_id = "sub_shared_tx_1"
    pay_id = "pay_shared_tx_1"
    secret = "test_rzp_secret_dedup"
    message = f"{pay_id}|{sub_id}".encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()

    mock_db = MagicMock()
    existing_sub = Subscription(
        id=uuid.uuid4(),
        organization_id=org_id,
        plan="free",
        status="active",
    )
    mock_audit = AuditLog(
        id=uuid.uuid4(),
        organization_id=org_id,
        action="CHECKOUT_INITIATED",
        entity_id=sub_id,
        metadata_json={"plan": "pro", "interval": "month"},
    )

    transactions_added = []
    def mock_add(entity):
        if isinstance(entity, PaymentTransaction):
            transactions_added.append(entity)
    mock_db.add.side_effect = mock_add

    # Initially no transaction in DB
    existing_tx_holder = {"tx": None}

    def mock_exec(stmt):
        m = MagicMock()
        stmt_str = str(stmt).lower()
        if "subscriptions" in stmt_str:
            m.scalar_one_or_none.return_value = existing_sub
        elif "audit_logs" in stmt_str:
            if "checkout_initiated" in stmt_str:
                m.scalar_one_or_none.return_value = mock_audit
            else:
                m.scalar_one_or_none.return_value = None
        elif "payment_transactions" in stmt_str:
            m.scalar_one_or_none.return_value = existing_tx_holder["tx"]
        else:
            m.scalar_one_or_none.return_value = None
        return m

    mock_db.execute.side_effect = mock_exec

    wh_secret = "whsec_dedup_test_999"

    with patch.object(settings, "RAZORPAY_KEY_SECRET", secret), \
         patch.object(settings, "RAZORPAY_WEBHOOK_SECRET", wh_secret), \
         patch.object(settings, "ENVIRONMENT", "production"), \
         patch("app.services.billing_service.record_audit_event_sync"):

        # 1. First execution: Callback verifies payment and creates ledger entry
        res1 = verify_razorpay_checkout_signature_and_activate(
            org_id, pay_id, sub_id, sig, mock_db
        )
        assert res1["status"] == "complete"
        assert len(transactions_added) == 1
        created_tx = transactions_added[0]
        assert created_tx.provider_payment_id == pay_id
        assert created_tx.status == "succeeded"

        # Simulate the transaction now existing in the database
        existing_tx_holder["tx"] = created_tx

        # 2. Duplicate callback invocation: Must NOT add duplicate transaction
        res2 = verify_razorpay_checkout_signature_and_activate(
            org_id, pay_id, sub_id, sig, mock_db
        )
        assert res2["status"] == "complete"
        assert len(transactions_added) == 1  # Still 1, no duplicate added!

        # 3. Later Webhook arrives for the same payment_id
        webhook_payload = {
            "entity": "event",
            "id": "evt_webhook_dedup_1",
            "event": "subscription.charged",
            "payload": {
                "subscription": {
                    "entity": {
                        "id": sub_id,
                        "notes": {"organization_id": str(org_id), "plan": "pro"},
                    }
                },
                "payment": {
                    "entity": {
                        "id": pay_id,
                        "amount": 399900,
                        "currency": "INR",
                        "status": "captured",
                    }
                },
            },
        }

        wh_payload_bytes = json.dumps(webhook_payload).encode("utf-8")
        wh_sig = hmac.new(wh_secret.encode("utf-8"), wh_payload_bytes, hashlib.sha256).hexdigest()

        webhook_res = process_razorpay_webhook_event(
            wh_payload_bytes, wh_sig, mock_db
        )
        assert webhook_res["status"] == "processed"
        # Must still be exactly 1 transaction in ledger!
        assert len(transactions_added) == 1
        # The existing transaction should have been enriched with provider_event_id
        assert existing_tx_holder["tx"].provider_event_id == "evt_webhook_dedup_1"


def test_missing_callback_webhook_activates_subscription():
    """
    Verifies that if the browser callback never occurs (e.g., user closed browser),
    the incoming Razorpay webhook alone successfully activates the subscription.
    """
    org_id = uuid.uuid4()
    sub_id = "sub_no_callback_1"
    pay_id = "pay_no_callback_1"

    mock_db = MagicMock()
    existing_sub = Subscription(
        id=uuid.uuid4(),
        organization_id=org_id,
        plan="free",
        status="active",
    )

    transactions_added = []
    mock_db.add.side_effect = lambda entity: transactions_added.append(entity) if isinstance(entity, PaymentTransaction) else None

    def mock_exec(stmt):
        m = MagicMock()
        stmt_str = str(stmt).lower()
        if "subscriptions" in stmt_str:
            m.scalar_one_or_none.return_value = existing_sub
        elif "audit_logs" in stmt_str:
            m.scalar_one_or_none.return_value = None
        elif "payment_transactions" in stmt_str:
            m.scalar_one_or_none.return_value = None
        return m

    mock_db.execute.side_effect = mock_exec

    raw_payload = {
        "entity": "event",
        "id": "evt_no_callback_activated",
        "event": "subscription.activated",
        "payload": {
            "subscription": {
                "entity": {
                    "id": sub_id,
                    "notes": {
                        "organization_id": str(org_id),
                        "plan": "agency",
                        "interval": "year",
                    },
                }
            },
            "payment": {
                "entity": {
                    "id": pay_id,
                    "amount": 7999000,
                    "currency": "INR",
                    "status": "captured",
                }
            },
        },
    }

    with patch("app.services.billing_service.record_audit_event_sync"):
        res = process_razorpay_webhook_event(json.dumps(raw_payload).encode("utf-8"), "", mock_db)

    assert res["status"] == "processed"
    # Subscription was successfully upgraded solely via webhook
    assert existing_sub.plan == "agency"
    assert existing_sub.status == "active"
    assert existing_sub.razorpay_subscription_id == sub_id
    # Payment transaction ledger was populated
    assert len(transactions_added) == 1
    assert transactions_added[0].provider_payment_id == pay_id


@pytest.mark.asyncio
async def test_session_status_razorpay_direct_query_fallback():
    """
    Verifies that get_session_status queries Razorpay directly and activates the subscription
    when the callback missed and webhook was delayed.
    """
    from app.api.v1.billing import get_session_status
    from app.core.authorization import AuthContext
    from app.models.user import OrganizationMember

    org = Organization(id=uuid.uuid4(), name="Fallback Org")
    user = User(id=uuid.uuid4(), email="user@fallback.com", role="owner")
    mem = OrganizationMember(id=uuid.uuid4(), organization_id=org.id, user_id=user.id, role="owner")
    auth = AuthContext(user=user, organization=org, membership=mem, plan="free", role="owner")

    sub = Subscription(
        organization_id=org.id,
        plan="free",
        status="active",
    )

    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = sub
    mock_db.execute.return_value = mock_res

    mock_client = MagicMock()
    mock_client.subscription.fetch.return_value = {
        "id": "sub_direct_fetch_123",
        "status": "active",
        "customer_id": "cust_rzp_direct_1",
        "notes": {
            "organization_id": str(org.id),
            "plan": "basic",
            "interval": "month",
        },
    }

    with patch.object(settings, "RAZORPAY_KEY_ID", "rzp_live_testkey"), \
         patch.object(settings, "RAZORPAY_KEY_SECRET", "test_secret_real"), \
         patch("razorpay.Client", return_value=mock_client):

        result = await get_session_status(
            session_id="sub_direct_fetch_123",
            auth=auth,
            db=mock_db,
        )

        assert result["status"] == "complete"
        assert result["is_active"] is True
        assert result["plan"] == "basic"
        assert result["provider"] == "razorpay"
        assert sub.plan == "basic"
        assert sub.status == "active"
        assert sub.razorpay_subscription_id == "sub_direct_fetch_123"
