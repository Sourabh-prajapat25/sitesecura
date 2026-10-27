"""
Scanly API - Razorpay Payment Provider Implementation
Implements PaymentProvider interface for Razorpay Subscriptions, Checkout Signature Verification,
and Webhook Normalization.
"""
import hmac
import hashlib
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import razorpay

from app.core.config import settings
from app.core.pricing import resolve_trusted_pricing, resolve_provider_plan_id
from app.models.billing import Subscription
from app.models.user import Organization, User
from app.services.payment_providers.base import (
    PaymentProvider,
    CheckoutSessionResult,
    NormalizedSubscriptionEvent,
)

logger = logging.getLogger(__name__)


class RazorpayPaymentProvider(PaymentProvider):
    """Razorpay implementation of PaymentProvider."""

    def __init__(self):
        self._client = None
        if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
            try:
                self._client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            except Exception as e:
                logger.warning(f"Failed to initialize Razorpay Client: {e}")

    def get_provider_name(self) -> str:
        return "razorpay"

    def create_checkout_session(
        self,
        organization: Organization,
        user: User,
        plan_name: str,
        interval: str = "month",
        currency: str = "inr",
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
    ) -> CheckoutSessionResult:
        """
        Creates a Razorpay Subscription session.
        Uses authoritative server-side plan ID and price resolution.
        """
        pricing = resolve_trusted_pricing(plan_name, interval, "inr")
        plan_id = resolve_provider_plan_id(plan_name, interval, "inr", "razorpay")

        is_mock = (
            not settings.RAZORPAY_KEY_ID
            or not settings.RAZORPAY_KEY_SECRET
            or settings.RAZORPAY_KEY_ID.startswith("rzp_test_placeholder")
        )

        if is_mock:
            if settings.ENVIRONMENT.lower() in ("production", "prod"):
                logger.error("Razorpay keys are unconfigured in production.")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail={"error": {"code": "PAYMENT_NOT_CONFIGURED", "message": "Live payment processing via Razorpay is currently deferred and unconfigured."}},
                )

            mock_subscription_id = f"sub_mock_rzp_{uuid.uuid4().hex[:12]}"
            return CheckoutSessionResult(
                provider="razorpay",
                plan=pricing.plan,
                interval=pricing.interval,
                currency="inr",
                amount=pricing.amount_subunits,
                subscription_id=mock_subscription_id,
                key_id=settings.RAZORPAY_KEY_ID or "rzp_test_placeholder",
                notes={
                    "organization_id": str(organization.id),
                    "user_id": str(user.id),
                    "plan": plan_name,
                    "interval": pricing.interval,
                    "currency": "inr",
                },
            )

        try:
            total_count = 120 if pricing.interval == "month" else 10
            subscription_payload = {
                "plan_id": plan_id,
                "total_count": total_count,
                "quantity": 1,
                "customer_notify": 1,
                "notes": {
                    "organization_id": str(organization.id),
                    "user_id": str(user.id),
                    "plan": plan_name,
                    "interval": pricing.interval,
                    "currency": "inr",
                },
            }
            rzp_sub = self._client.subscription.create(data=subscription_payload)
            return CheckoutSessionResult(
                provider="razorpay",
                plan=pricing.plan,
                interval=pricing.interval,
                currency="inr",
                amount=pricing.amount_subunits,
                subscription_id=rzp_sub["id"],
                key_id=settings.RAZORPAY_KEY_ID,
                checkout_url=rzp_sub.get("short_url"),
                notes=subscription_payload["notes"],
            )
        except Exception as e:
            logger.error(f"Razorpay subscription creation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": {"code": "RAZORPAY_SESSION_FAILED", "message": f"Failed to initiate Razorpay subscription: {str(e)}"}},
            )

    def create_customer_portal_session(
        self,
        organization: Organization,
        return_url: Optional[str] = None,
        subscription: Optional[Subscription] = None,
    ) -> str:
        """
        Razorpay does not host an external billing portal.
        Redirects users to the in-app subscription and billing settings.
        """
        from app.services.billing_service import sanitize_return_url
        return sanitize_return_url(return_url, "/dashboard/billing?provider=razorpay")

    def cancel_subscription(
        self,
        subscription: Subscription,
        cancel_at_period_end: bool = True,
    ) -> bool:
        """
        Cancels a Razorpay subscription via API.
        """
        sub_id = subscription.razorpay_subscription_id or subscription.provider_subscription_id
        if not sub_id:
            logger.warning(f"No Razorpay subscription ID for subscription {subscription.id}")
            return False

        is_mock = (
            sub_id.startswith("sub_mock_")
            or not settings.RAZORPAY_KEY_SECRET
            or settings.RAZORPAY_KEY_SECRET.startswith("rzp_test_placeholder")
        )

        client = self._client
        if client is None and settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
            try:
                client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            except Exception as e:
                logger.warning(f"Failed to initialize Razorpay Client: {e}")
                client = None

        if is_mock or client is None:
            subscription.cancel_at_period_end = cancel_at_period_end
            if not cancel_at_period_end:
                subscription.status = "canceled"
                subscription.plan = "free"
            return True

        try:
            cancel_data = {"cancel_at_cycle_end": 1 if cancel_at_period_end else 0}
            client.subscription.cancel(sub_id, cancel_data)
            subscription.cancel_at_period_end = cancel_at_period_end
            if not cancel_at_period_end:
                subscription.status = "canceled"
                subscription.plan = "free"
            return True
        except Exception as e:
            logger.error(f"Failed to cancel Razorpay subscription {sub_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": {"code": "RAZORPAY_CANCELLATION_FAILED", "message": f"Could not cancel subscription: {str(e)}"}},
            )

    def verify_webhook_signature(self, payload: bytes, signature_header: str) -> Dict[str, Any]:
        """
        Cryptographically verifies Razorpay webhook signature with RAZORPAY_WEBHOOK_SECRET using HMAC-SHA256.
        Prevents timing attacks with hmac.compare_digest.
        """
        secret = settings.RAZORPAY_WEBHOOK_SECRET

        if not secret or secret.startswith("rzp_whsec_placeholder"):
            if settings.ENVIRONMENT.lower() in ("production", "prod"):
                logger.error("RAZORPAY_WEBHOOK_SECRET is unconfigured in production. Rejecting unverified webhook.")
                raise ValueError("Razorpay webhook secret is unconfigured in production.")
            # Development / test fallback
            try:
                return json.loads(payload.decode("utf-8"))
            except Exception as e:
                raise ValueError(f"Invalid JSON payload: {e}")

        if not signature_header:
            raise ValueError("Missing X-Razorpay-Signature header.")

        expected_sig = hmac.new(
            secret.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, signature_header.strip()):
            logger.error("Razorpay webhook HMAC signature verification failed.")
            raise ValueError("Invalid Razorpay webhook signature.")

        return json.loads(payload.decode("utf-8"))

    def verify_checkout_signature(self, payment_id: str, subscription_id: str, signature: str) -> bool:
        """
        Verifies Razorpay Checkout signature for subscription authorization.
        Formula: HMAC-SHA256(payment_id + "|" + subscription_id, RAZORPAY_KEY_SECRET)
        """
        if not payment_id or not subscription_id or not signature:
            return False

        # Support development mock checkout verification
        if subscription_id.startswith("sub_mock_") or signature.startswith("mock_sig_"):
            if settings.ENVIRONMENT.lower() in ("production", "prod"):
                return False
            return True

        secret = settings.RAZORPAY_KEY_SECRET
        if not secret or secret.startswith("rzp_test_placeholder"):
            if settings.ENVIRONMENT.lower() in ("production", "prod"):
                return False
            # In local dev without live secrets, accept mock signatures
            return True

        message = f"{payment_id}|{subscription_id}".encode("utf-8")
        expected_sig = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_sig, signature.strip())

    def normalize_webhook_event(self, raw_event: Dict[str, Any], sync_db: Session) -> NormalizedSubscriptionEvent:
        """
        Normalizes Razorpay webhook events into NormalizedSubscriptionEvent.
        Handled events:
        - subscription.authenticated
        - subscription.activated
        - subscription.charged
        - subscription.halted
        - subscription.cancelled
        - subscription.paused
        - subscription.resumed
        - payment.failed
        - payment.captured
        """
        event_name = raw_event.get("event", "")
        payload = raw_event.get("payload", {})
        sub_entity = payload.get("subscription", {}).get("entity", {})
        pay_entity = payload.get("payment", {}).get("entity", {})

        sub_id = sub_entity.get("id") or pay_entity.get("subscription_id")
        pay_id = pay_entity.get("id")
        customer_id = sub_entity.get("customer_id") or pay_entity.get("customer_id")
        notes = sub_entity.get("notes") or pay_entity.get("notes") or {}

        org_id_str = notes.get("organization_id")
        plan = notes.get("plan")
        interval = notes.get("interval", "month")
        amount = pay_entity.get("amount") or sub_entity.get("plan_id")

        created_at_ts = raw_event.get("created_at") or int(datetime.now(timezone.utc).timestamp())
        event_id = raw_event.get("id") or f"rzp_{event_name}_{pay_id or sub_id}_{created_at_ts}"

        org_uuid: Optional[uuid.UUID] = None
        if org_id_str:
            try:
                org_uuid = uuid.UUID(org_id_str)
            except Exception:
                pass

        # If org not found in payload notes, lookup active subscription record in database
        if not org_uuid and sub_id:
            sub = sync_db.execute(
                select(Subscription).where(
                    (Subscription.razorpay_subscription_id == sub_id)
                    | (Subscription.provider_subscription_id == sub_id)
                )
            ).scalar_one_or_none()
            if sub:
                org_uuid = sub.organization_id
                if not plan:
                    plan = sub.plan
                if not interval:
                    interval = sub.billing_interval

        # Extract period timestamps
        period_start = None
        period_end = None
        if sub_entity.get("current_start"):
            try:
                period_start = datetime.fromtimestamp(sub_entity["current_start"], tz=timezone.utc)
            except Exception:
                pass
        if sub_entity.get("current_end"):
            try:
                period_end = datetime.fromtimestamp(sub_entity["current_end"], tz=timezone.utc)
            except Exception:
                pass

        # Event type normalization
        if event_name in ("subscription.activated", "subscription.authenticated"):
            return NormalizedSubscriptionEvent(
                provider="razorpay",
                event_type="subscription_activated",
                provider_event_id=event_id,
                organization_id=org_uuid,
                provider_customer_id=customer_id,
                provider_subscription_id=sub_id,
                provider_payment_id=pay_id,
                plan=plan or "basic",
                interval=interval,
                currency="inr",
                amount=pay_entity.get("amount"),
                status="active",
                current_period_start=period_start,
                current_period_end=period_end,
                metadata=notes,
            )

        elif event_name == "subscription.charged":
            return NormalizedSubscriptionEvent(
                provider="razorpay",
                event_type="subscription_charged",
                provider_event_id=event_id,
                organization_id=org_uuid,
                provider_customer_id=customer_id,
                provider_subscription_id=sub_id,
                provider_payment_id=pay_id,
                plan=plan or "basic",
                interval=interval,
                currency="inr",
                amount=pay_entity.get("amount"),
                status="active",
                current_period_start=period_start,
                current_period_end=period_end,
                metadata=notes,
            )

        elif event_name == "subscription.halted":
            return NormalizedSubscriptionEvent(
                provider="razorpay",
                event_type="subscription_halted",
                provider_event_id=event_id,
                organization_id=org_uuid,
                provider_customer_id=customer_id,
                provider_subscription_id=sub_id,
                provider_payment_id=pay_id,
                plan=plan,
                interval=interval,
                currency="inr",
                status="past_due",
                metadata={"reason": "mandate_halted"},
            )

        elif event_name == "subscription.cancelled":
            return NormalizedSubscriptionEvent(
                provider="razorpay",
                event_type="subscription_cancelled",
                provider_event_id=event_id,
                organization_id=org_uuid,
                provider_customer_id=customer_id,
                provider_subscription_id=sub_id,
                plan="free",
                status="canceled",
                cancel_at_period_end=False,
            )

        elif event_name == "payment.failed":
            return NormalizedSubscriptionEvent(
                provider="razorpay",
                event_type="payment_failed",
                provider_event_id=event_id,
                organization_id=org_uuid,
                provider_customer_id=customer_id,
                provider_subscription_id=sub_id,
                provider_payment_id=pay_id,
                currency="inr",
                amount=pay_entity.get("amount"),
                status="past_due",
                metadata={
                    "error_code": pay_entity.get("error_code"),
                    "error_description": pay_entity.get("error_description"),
                },
            )

        return NormalizedSubscriptionEvent(
            provider="razorpay",
            event_type=event_name,
            provider_event_id=event_id,
            organization_id=org_uuid,
            provider_customer_id=customer_id,
            provider_subscription_id=sub_id,
            status="active" if "active" in event_name else "pending",
            metadata=raw_event,
        )
