"""
Scanly API - Stripe Payment Provider Implementation
Implements PaymentProvider interface for Stripe billing, portal sessions, and webhook processing.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
import stripe

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

if settings.STRIPE_SECRET_KEY:
    stripe.api_key = settings.STRIPE_SECRET_KEY


class StripePaymentProvider(PaymentProvider):
    """Stripe implementation of PaymentProvider."""

    def get_provider_name(self) -> str:
        return "stripe"

    def create_checkout_session(
        self,
        organization: Organization,
        user: User,
        plan_name: str,
        interval: str = "month",
        currency: str = "usd",
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
    ) -> CheckoutSessionResult:
        from app.services.billing_service import sanitize_return_url

        succ_url = sanitize_return_url(
            success_url,
            "/billing/success?session_id={CHECKOUT_SESSION_ID}&provider=stripe"
        )
        canc_url = sanitize_return_url(
            cancel_url,
            "/billing/cancel?provider=stripe"
        )

        pricing = resolve_trusted_pricing(plan_name, interval, "usd")
        price_id = resolve_provider_plan_id(plan_name, interval, "usd", "stripe")

        is_mock = not settings.STRIPE_SECRET_KEY or settings.STRIPE_SECRET_KEY.startswith("sk_test_placeholder")

        if is_mock:
            if settings.ENVIRONMENT.lower() in ("production", "prod"):
                logger.error("Stripe keys are unconfigured in production.")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail={"error": {"code": "PAYMENT_NOT_CONFIGURED", "message": "Live payment processing via Stripe is currently deferred and unconfigured."}},
                )

            mock_session_id = f"cs_mock_{uuid.uuid4().hex[:12]}"
            mock_url = f"{succ_url.replace('{CHECKOUT_SESSION_ID}', mock_session_id)}&mock_plan={plan_name}&mock_interval={pricing.interval}"
            return CheckoutSessionResult(
                provider="stripe",
                plan=pricing.plan,
                interval=pricing.interval,
                currency="usd",
                amount=pricing.amount_subunits,
                checkout_url=mock_url,
                session_id=mock_session_id,
                notes={
                    "organization_id": str(organization.id),
                    "user_id": str(user.id),
                    "plan": plan_name,
                    "interval": pricing.interval,
                },
            )

        try:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                mode="subscription",
                customer_email=user.email,
                client_reference_id=str(organization.id),
                metadata={
                    "organization_id": str(organization.id),
                    "plan": plan_name,
                    "interval": pricing.interval,
                    "user_id": str(user.id),
                    "provider": "stripe",
                },
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=succ_url,
                cancel_url=canc_url,
                allow_promotion_codes=True,
            )
            return CheckoutSessionResult(
                provider="stripe",
                plan=pricing.plan,
                interval=pricing.interval,
                currency="usd",
                amount=pricing.amount_subunits,
                checkout_url=session.url,
                session_id=session.id,
                notes={
                    "organization_id": str(organization.id),
                    "user_id": str(user.id),
                    "plan": plan_name,
                    "interval": pricing.interval,
                },
            )
        except Exception as e:
            logger.error(f"Stripe Checkout Session creation failed: {e}")
            raise

    def create_customer_portal_session(
        self,
        organization: Organization,
        return_url: Optional[str] = None,
        subscription: Optional[Subscription] = None,
    ) -> str:
        from app.services.billing_service import sanitize_return_url
        ret_url = sanitize_return_url(return_url, "/dashboard/billing")

        if not settings.STRIPE_SECRET_KEY or settings.STRIPE_SECRET_KEY.startswith("sk_test_placeholder"):
            return f"{ret_url}?portal=mock_active"

        try:
            cust_id = None
            sub = subscription
            if sub is None:
                try:
                    from sqlalchemy.orm import attributes
                    state = attributes.instance_state(organization)
                    if "subscription" in state.dict:
                        sub = state.dict["subscription"]
                except Exception:
                    pass
            if sub is None and hasattr(organization, "subscription") and not hasattr(organization, "_sa_instance_state"):
                sub = organization.subscription

            if sub:
                cust_id = sub.stripe_customer_id or sub.provider_customer_id

            session = stripe.billing_portal.Session.create(
                customer=cust_id,
                return_url=ret_url,
            )
            return session.url
        except Exception as e:
            logger.error(f"Stripe Customer Portal creation failed: {e}")
            return ret_url

    def cancel_subscription(
        self,
        subscription: Subscription,
        cancel_at_period_end: bool = True,
    ) -> bool:
        sub_id = subscription.stripe_subscription_id or subscription.provider_subscription_id
        if not sub_id:
            logger.warning(f"No Stripe subscription ID for subscription {subscription.id}")
            return False

        if not settings.STRIPE_SECRET_KEY or settings.STRIPE_SECRET_KEY.startswith("sk_test_placeholder"):
            subscription.cancel_at_period_end = cancel_at_period_end
            if not cancel_at_period_end:
                subscription.status = "canceled"
                subscription.plan = "free"
            return True

        try:
            if cancel_at_period_end:
                stripe.Subscription.modify(sub_id, cancel_at_period_end=True)
                subscription.cancel_at_period_end = True
            else:
                stripe.Subscription.delete(sub_id)
                subscription.cancel_at_period_end = False
                subscription.status = "canceled"
                subscription.plan = "free"
            return True
        except Exception as e:
            logger.error(f"Failed to cancel Stripe subscription {sub_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": {"code": "STRIPE_CANCELLATION_FAILED", "message": f"Could not cancel Stripe subscription: {str(e)}"}},
            )

    def verify_webhook_signature(self, payload: bytes, signature_header: str) -> Dict[str, Any]:
        if settings.STRIPE_WEBHOOK_SECRET and not settings.STRIPE_WEBHOOK_SECRET.startswith("whsec_placeholder"):
            return stripe.Webhook.construct_event(payload, signature_header, settings.STRIPE_WEBHOOK_SECRET)
        else:
            if settings.ENVIRONMENT.lower() in ("production", "prod"):
                logger.error("STRIPE_WEBHOOK_SECRET is unconfigured in production. Rejecting unverified webhook.")
                raise ValueError("Stripe webhook secret is unconfigured in production.")
            import json
            return json.loads(payload.decode("utf-8"))

    def normalize_webhook_event(self, raw_event: Dict[str, Any], sync_db: Session) -> NormalizedSubscriptionEvent:
        event_type = raw_event.get("type", "")
        event_id = raw_event.get("id")
        data_object = raw_event.get("data", {}).get("object", {})

        # Extract common fields
        org_id_str = data_object.get("client_reference_id") or data_object.get("metadata", {}).get("organization_id")
        plan = data_object.get("metadata", {}).get("plan")
        interval = data_object.get("metadata", {}).get("interval", "month")
        customer_id = data_object.get("customer")
        subscription_id = data_object.get("subscription") or data_object.get("id") if event_type.startswith("customer.subscription") else data_object.get("subscription")

        org_uuid = None
        if org_id_str:
            try:
                org_uuid = uuid.UUID(org_id_str)
            except Exception:
                pass

        if not org_uuid and subscription_id:
            sub = sync_db.execute(
                select(Subscription).where(
                    (Subscription.stripe_subscription_id == subscription_id) |
                    (Subscription.provider_subscription_id == subscription_id)
                )
            ).scalar_one_or_none()
            if sub:
                org_uuid = sub.organization_id
                if not plan:
                    plan = sub.plan

        # Parse period timestamps if present
        period_start = None
        period_end = None
        if data_object.get("current_period_start"):
            try:
                period_start = datetime.fromtimestamp(data_object["current_period_start"], tz=timezone.utc)
            except Exception:
                pass
        if data_object.get("current_period_end"):
            try:
                period_end = datetime.fromtimestamp(data_object["current_period_end"], tz=timezone.utc)
            except Exception:
                pass

        # Map to normalized event types
        if event_type == "checkout.session.completed":
            payment_status = data_object.get("payment_status")
            status_val = "active" if payment_status in ("paid", "no_payment_required") else "pending"
            normalized_type = "subscription_activated" if status_val == "active" else "payment_pending"
            return NormalizedSubscriptionEvent(
                provider="stripe",
                event_type=normalized_type,
                provider_event_id=event_id,
                organization_id=org_uuid,
                provider_customer_id=customer_id,
                provider_subscription_id=subscription_id,
                plan=plan or "basic",
                interval=interval,
                currency="usd",
                amount=data_object.get("amount_total"),
                status=status_val,
                metadata=data_object.get("metadata", {}),
            )

        elif event_type == "checkout.session.async_payment_succeeded":
            return NormalizedSubscriptionEvent(
                provider="stripe",
                event_type="subscription_activated",
                provider_event_id=event_id,
                organization_id=org_uuid,
                provider_customer_id=customer_id,
                provider_subscription_id=subscription_id,
                plan=plan or "basic",
                interval=interval,
                currency="usd",
                amount=data_object.get("amount_total"),
                status="active",
                metadata=data_object.get("metadata", {}),
            )

        elif event_type == "checkout.session.async_payment_failed":
            return NormalizedSubscriptionEvent(
                provider="stripe",
                event_type="payment_failed",
                provider_event_id=event_id,
                organization_id=org_uuid,
                provider_customer_id=customer_id,
                provider_subscription_id=subscription_id,
                plan=plan,
                status="incomplete_expired",
                metadata={"reason": "async_payment_failed"},
            )

        elif event_type == "customer.subscription.created":
            return NormalizedSubscriptionEvent(
                provider="stripe",
                event_type="subscription_created",
                provider_event_id=event_id,
                organization_id=org_uuid,
                provider_customer_id=customer_id,
                provider_subscription_id=data_object.get("id"),
                plan=plan,
                status=data_object.get("status", "active"),
                current_period_start=period_start,
                current_period_end=period_end,
                cancel_at_period_end=data_object.get("cancel_at_period_end", False),
            )

        elif event_type == "customer.subscription.updated":
            status_val = data_object.get("status", "active")
            cancel_at_end = data_object.get("cancel_at_period_end", False)
            return NormalizedSubscriptionEvent(
                provider="stripe",
                event_type="subscription_updated",
                provider_event_id=event_id,
                organization_id=org_uuid,
                provider_customer_id=customer_id,
                provider_subscription_id=data_object.get("id"),
                plan="free" if status_val in ("canceled", "unpaid") else plan,
                status=status_val,
                current_period_start=period_start,
                current_period_end=period_end,
                cancel_at_period_end=cancel_at_end,
            )

        elif event_type == "customer.subscription.deleted":
            return NormalizedSubscriptionEvent(
                provider="stripe",
                event_type="subscription_cancelled",
                provider_event_id=event_id,
                organization_id=org_uuid,
                provider_customer_id=customer_id,
                provider_subscription_id=data_object.get("id"),
                plan="free",
                status="canceled",
                cancel_at_period_end=False,
            )

        elif event_type == "invoice.paid":
            return NormalizedSubscriptionEvent(
                provider="stripe",
                event_type="subscription_charged",
                provider_event_id=event_id,
                organization_id=org_uuid,
                provider_customer_id=customer_id,
                provider_subscription_id=data_object.get("subscription"),
                provider_payment_id=data_object.get("payment_intent"),
                currency="usd",
                amount=data_object.get("amount_paid"),
                status="active",
                current_period_start=period_start,
                current_period_end=period_end,
            )

        elif event_type == "invoice.payment_failed":
            return NormalizedSubscriptionEvent(
                provider="stripe",
                event_type="payment_failed",
                provider_event_id=event_id,
                organization_id=org_uuid,
                provider_customer_id=customer_id,
                provider_subscription_id=data_object.get("subscription"),
                currency="usd",
                amount=data_object.get("amount_due"),
                status="past_due",
                metadata={"attempt_count": data_object.get("attempt_count", 1)},
            )

        return NormalizedSubscriptionEvent(
            provider="stripe",
            event_type=event_type,
            provider_event_id=event_id,
            organization_id=org_uuid,
            status="unknown",
            metadata=raw_event,
        )

    def verify_checkout_signature(self, payment_id: str, subscription_id: str, signature: str) -> bool:
        # Stripe does not use signature verification on checkout completion; return True
        return True
