"""
Scanly API - Multi-Gateway Billing & Subscription Service (Razorpay & Stripe)
Handles checkout sessions, customer portal creation, payment verification, in-app cancellation,
and idempotent webhook processing for both Razorpay and Stripe.
Preserves strict open-redirect sanitization and RBAC user roles.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from urllib.parse import urlparse
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
import stripe

from app.core.config import settings
from app.core.pricing import resolve_trusted_pricing, resolve_provider_plan_id
from app.models.billing import Subscription, PaymentTransaction
from app.models.user import Organization, User
from app.models.alert import AuditLog
from app.services.audit_service import record_audit_event_sync
from app.services.payment_providers import (
    get_payment_provider,
    get_stripe_provider,
    get_razorpay_provider,
)

logger = logging.getLogger(__name__)

if settings.STRIPE_SECRET_KEY:
    stripe.api_key = settings.STRIPE_SECRET_KEY


def sanitize_return_url(raw_url: Optional[str], default_path: str) -> str:
    """
    Validates and sanitizes return URLs to prevent open redirect vulnerabilities (CWE-601).
    Ensures URLs strictly resolve to approved application origin or allowed CORS origins.
    """
    app_url = (settings.NEXT_PUBLIC_APP_URL or "http://localhost:3000").rstrip("/")
    if not raw_url:
        return f"{app_url}{default_path}"

    cleaned = raw_url.strip()

    # Relative paths like '/billing/success' or '/dashboard/billing' are safe
    if cleaned.startswith("/") and not cleaned.startswith("//"):
        return f"{app_url}{cleaned}"

    try:
        parsed = urlparse(cleaned)
        allowed_hosts = {"localhost", "127.0.0.1", "sitesecura.com", "app.sitesecura.com", "scanly.io", "app.scanly.io"}
        if app_url:
            parsed_app = urlparse(app_url)
            if parsed_app.hostname:
                allowed_hosts.add(parsed_app.hostname)

        for origin in settings.CORS_ORIGINS:
            p_origin = urlparse(origin)
            if p_origin.hostname:
                allowed_hosts.add(p_origin.hostname)

        if parsed.hostname in allowed_hosts:
            return cleaned
    except Exception as e:
        logger.warning(f"Error parsing return URL '{raw_url}': {e}")

    logger.warning(f"Rejected open redirect attempt with unapproved URL '{raw_url}'. Using default '{default_path}'.")
    return f"{app_url}{default_path}"


def create_checkout_session(
    organization: Organization,
    user: User,
    plan_name: str,
    interval: str = "month",
    currency: Optional[str] = None,
    provider: Optional[str] = None,
    success_url: Optional[str] = None,
    cancel_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Creates a checkout or subscription session through the resolved payment provider (Stripe or Razorpay).
    Guarantees backward-compatibility for Stripe calls while supporting INR Razorpay checkouts.
    """
    # Prevent duplicate active paid subscriptions for the same plan
    sub = None
    try:
        from sqlalchemy.orm import attributes
        state = attributes.instance_state(organization)
        if "subscription" in state.dict:
            sub = state.dict["subscription"]
        elif hasattr(organization, "subscription") and not hasattr(organization, "_sa_instance_state"):
            sub = organization.subscription
    except Exception:
        pass

    if sub and getattr(sub, "status", None) in ("active", "trialing") and getattr(sub, "plan", "").lower() == plan_name.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "ACTIVE_SUBSCRIPTION_EXISTS", "message": f"Organization is already subscribed to the {plan_name} plan."}},
        )

    # Resolution: If provider/currency is omitted (like legacy tests), default to Stripe for USD backward compatibility
    if provider is None and currency is None:
        target_provider = get_stripe_provider()
        target_currency = "usd"
    else:
        target_currency = currency or ("inr" if settings.DEFAULT_PAYMENT_PROVIDER == "razorpay" else "usd")
        target_provider = get_payment_provider(provider_name=provider, currency=target_currency)

    result = target_provider.create_checkout_session(
        organization=organization,
        user=user,
        plan_name=plan_name,
        interval=interval,
        currency=target_currency,
        success_url=success_url,
        cancel_url=cancel_url,
    )

    return {
        "checkout_url": result.checkout_url or "",
        "session_id": result.session_id or result.subscription_id or "",
        "provider": result.provider,
        "subscription_id": result.subscription_id,
        "key_id": result.key_id,
        "amount": result.amount,
        "currency": result.currency,
        "plan": result.plan,
        "interval": result.interval,
    }


def create_customer_portal_session(
    organization: Organization,
    return_url: Optional[str] = None,
    subscription: Optional[Subscription] = None,
) -> str:
    """
    Generates a billing management session.
    Routes Stripe customers to Stripe Billing Portal and Razorpay customers to in-app billing.
    Safely resolves subscription without triggering MissingGreenlet.
    """
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

    prov = "stripe"
    if sub and getattr(sub, "provider", None) == "razorpay":
        prov = "razorpay"

    provider_instance = get_payment_provider(prov)
    return provider_instance.create_customer_portal_session(organization, return_url, subscription=sub)


def cancel_subscription_service(
    organization: Organization,
    cancel_at_period_end: bool = True,
    sync_db: Optional[Session] = None,
    subscription: Optional[Subscription] = None,
) -> Dict[str, Any]:
    """
    Cancels the organization's subscription at the provider gateway and updates local record.
    Safely handles both async and sync execution contexts without triggering MissingGreenlet.
    """
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
        # Plain/mock Python object (e.g., in unit tests)
        sub = organization.subscription

    if sub is None and sync_db is not None:
        stmt = select(Subscription).where(Subscription.organization_id == organization.id)
        sub = sync_db.execute(stmt).scalar_one_or_none()

    if not sub or sub.plan == "free" or sub.status not in ("active", "trialing", "past_due"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "NO_ACTIVE_SUBSCRIPTION", "message": "Organization has no active paid subscription to cancel."}},
        )

    # Idempotency check: Already canceled or already scheduled
    if sub.status == "canceled":
        return {
            "status": "canceled",
            "cancel_at_period_end": False,
            "message": "Subscription is already canceled.",
        }
    if cancel_at_period_end and sub.cancel_at_period_end:
        return {
            "status": "pending_cancellation",
            "cancel_at_period_end": True,
            "message": "Subscription cancellation is already scheduled for the end of the billing period.",
        }

    provider_instance = get_payment_provider(sub.provider)
    provider_instance.cancel_subscription(sub, cancel_at_period_end)

    sub.cancel_at_period_end = cancel_at_period_end
    if not cancel_at_period_end:
        sub.status = "canceled"
        sub.plan = "free"

    if sync_db:
        record_audit_event_sync(
            db=sync_db,
            action="SUBSCRIPTION_CANCEL_REQUESTED",
            entity_type="SUBSCRIPTION",
            organization_id=organization.id,
            entity_id=str(sub.id),
            metadata={"provider": sub.provider, "cancel_at_period_end": cancel_at_period_end},
        )
        sync_db.commit()

    return {
        "status": "pending_cancellation" if cancel_at_period_end else "canceled",
        "cancel_at_period_end": cancel_at_period_end,
        "message": "Subscription cancellation scheduled successfully." if cancel_at_period_end else "Subscription canceled immediately.",
    }


def verify_razorpay_checkout_signature_and_activate(
    organization_id: uuid.UUID,
    payment_id: str,
    subscription_id: str,
    signature: str,
    sync_db: Session,
) -> Dict[str, Any]:
    """
    Cryptographically verifies the Razorpay payment callback signature and
    activates the subscription immediately for the organization.
    Idempotent and resilient to webhook ordering.
    """
    provider = get_razorpay_provider()
    is_valid = provider.verify_checkout_signature(
        payment_id=payment_id,
        subscription_id=subscription_id,
        signature=signature,
    )
    if not is_valid:
        logger.error(f"Invalid Razorpay payment signature for org {organization_id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "INVALID_PAYMENT_SIGNATURE", "message": "Razorpay payment signature verification failed."}},
        )

    stmt = select(Subscription).where(Subscription.organization_id == organization_id)
    sub = sync_db.execute(stmt).scalar_one_or_none()

    # Locate checkout audit log to determine intended plan and interval
    audit = sync_db.execute(
        select(AuditLog).where(
            AuditLog.organization_id == organization_id,
            AuditLog.action == "CHECKOUT_INITIATED",
            AuditLog.entity_id == subscription_id,
        ).order_by(AuditLog.created_at.desc()).limit(1)
    ).scalar_one_or_none()

    intended_plan = (audit.metadata_json or {}).get("plan", "basic") if audit else "basic"
    intended_interval = (audit.metadata_json or {}).get("interval", "month") if audit else "month"

    pricing = resolve_trusted_pricing(intended_plan, intended_interval, "inr")

    if not sub:
        sub = Subscription(
            organization_id=organization_id,
            provider="razorpay",
            provider_subscription_id=subscription_id,
            razorpay_subscription_id=subscription_id,
            currency="inr",
            billing_interval=intended_interval,
            amount_cents=pricing.amount_subunits,
            plan=intended_plan,
            status="active",
        )
        sync_db.add(sub)
    else:
        sub.provider = "razorpay"
        sub.provider_subscription_id = subscription_id
        sub.razorpay_subscription_id = subscription_id
        sub.currency = "inr"
        sub.billing_interval = intended_interval
        sub.amount_cents = pricing.amount_subunits
        sub.plan = intended_plan
        sub.status = "active"
        sub.cancel_at_period_end = False

    # Idempotent Transaction Ledger Entry
    existing_tx = sync_db.execute(
        select(PaymentTransaction).where(PaymentTransaction.provider_payment_id == payment_id).limit(1)
    ).scalar_one_or_none()

    if not existing_tx:
        tx = PaymentTransaction(
            organization_id=organization_id,
            provider="razorpay",
            provider_payment_id=payment_id,
            provider_subscription_id=subscription_id,
            amount=pricing.amount_subunits,
            currency="inr",
            status="succeeded",
            plan=intended_plan,
            billing_interval=intended_interval,
            metadata_json={"source": "checkout_callback_verification"},
        )
        sync_db.add(tx)

    # Check if this checkout was already verified to prevent duplicate audit events
    already_verified = sync_db.execute(
        select(AuditLog).where(
            AuditLog.organization_id == organization_id,
            AuditLog.action == "RAZORPAY_CHECKOUT_VERIFIED",
            AuditLog.entity_id == payment_id,
        ).limit(1)
    ).scalar_one_or_none()

    if not already_verified:
        record_audit_event_sync(
            db=sync_db,
            action="PLAN_CHANGED",
            entity_type="SUBSCRIPTION",
            organization_id=organization_id,
            entity_id=str(sub.id) if getattr(sub, "id", None) else str(organization_id),
            metadata={"new_plan": intended_plan, "source": "razorpay_checkout", "subscription_id": subscription_id},
        )
        record_audit_event_sync(
            db=sync_db,
            action="PLAN_SELECTION_COMPLETED",
            entity_type="ONBOARDING",
            organization_id=organization_id,
            entity_id=str(organization_id),
            metadata={"plan": intended_plan, "source": "razorpay_checkout"},
        )
        record_audit_event_sync(
            db=sync_db,
            action="RAZORPAY_CHECKOUT_VERIFIED",
            entity_type="PAYMENT",
            organization_id=organization_id,
            entity_id=payment_id,
            metadata={"subscription_id": subscription_id, "plan": intended_plan},
        )

    sync_db.commit()
    logger.info(f"Razorpay subscription verified & activated for org {organization_id}, plan {intended_plan}")
    return {
        "status": "complete",
        "plan": intended_plan,
        "is_active": True,
        "subscription_id": subscription_id,
    }


def process_razorpay_webhook_event(payload: bytes, sig_header: str, sync_db: Session) -> Dict[str, Any]:
    """
    Verifies Razorpay webhook signature, checks idempotency via AuditLog, and processes
    subscription activations, recurring renewals, halting, and cancellations.
    Preserves RBAC roles.
    """
    provider = get_razorpay_provider()
    raw_event = provider.verify_webhook_signature(payload, sig_header)
    event = provider.normalize_webhook_event(raw_event, sync_db)

    logger.info(f"Processing normalized Razorpay webhook: {event.event_type} (event_id: {event.provider_event_id})")

    # Idempotency / replay protection check
    if event.provider_event_id:
        existing_evt = sync_db.execute(
            select(AuditLog).where(
                AuditLog.action == "RAZORPAY_WEBHOOK_PROCESSED",
                AuditLog.entity_id == str(event.provider_event_id),
            ).limit(1)
        ).scalar_one_or_none()
        if existing_evt:
            logger.info(f"Duplicate Razorpay webhook event ignored: {event.provider_event_id}")
            return {"status": "ignored", "reason": "duplicate", "event": event.event_type, "event_id": event.provider_event_id}

    target_org_id = event.organization_id

    if event.event_type in ("subscription_activated", "subscription_charged"):
        if target_org_id:
            sub = _get_or_create_sub(
                sync_db=sync_db,
                org_id=target_org_id,
                customer_id=event.provider_customer_id,
                subscription_id=event.provider_subscription_id,
                plan=event.plan or "basic",
                provider="razorpay",
                currency="inr",
            )
            sub.provider = "razorpay"
            if event.plan:
                sub.plan = event.plan
            sub.status = "active"
            sub.currency = "inr"
            if event.provider_subscription_id:
                sub.razorpay_subscription_id = event.provider_subscription_id
                sub.provider_subscription_id = event.provider_subscription_id
            if event.current_period_start:
                sub.current_period_start = event.current_period_start
            if event.current_period_end:
                sub.current_period_end = event.current_period_end
            if event.amount:
                sub.amount_cents = event.amount

            # Record transaction in ledger
            if event.provider_payment_id:
                existing_tx = sync_db.execute(
                    select(PaymentTransaction).where(PaymentTransaction.provider_payment_id == event.provider_payment_id).limit(1)
                ).scalar_one_or_none()
                if not existing_tx:
                    tx = PaymentTransaction(
                        organization_id=target_org_id,
                        provider="razorpay",
                        provider_payment_id=event.provider_payment_id,
                        provider_subscription_id=event.provider_subscription_id,
                        provider_event_id=event.provider_event_id,
                        amount=event.amount or (sub.amount_cents or 0),
                        currency="inr",
                        status="succeeded",
                        plan=sub.plan,
                        billing_interval=sub.billing_interval,
                        metadata_json=event.metadata,
                    )
                    sync_db.add(tx)
                elif not existing_tx.provider_event_id and event.provider_event_id:
                    existing_tx.provider_event_id = event.provider_event_id

            record_audit_event_sync(
                db=sync_db,
                action="PLAN_CHANGED",
                entity_type="SUBSCRIPTION",
                organization_id=target_org_id,
                entity_id=str(sub.id) if getattr(sub, "id", None) else str(target_org_id),
                metadata={"new_plan": sub.plan, "source": f"razorpay_{event.event_type}", "subscription_id": event.provider_subscription_id},
            )
            record_audit_event_sync(
                db=sync_db,
                action="PLAN_SELECTION_COMPLETED",
                entity_type="ONBOARDING",
                organization_id=target_org_id,
                entity_id=str(target_org_id),
                metadata={"plan": sub.plan, "source": "razorpay_webhook"},
            )
            logger.info(f"Razorpay webhook: upgraded org {target_org_id} to plan {sub.plan}")

    elif event.event_type == "subscription_halted":
        if target_org_id:
            sub = sync_db.execute(select(Subscription).where(Subscription.organization_id == target_org_id)).scalar_one_or_none()
            if sub:
                sub.status = "past_due"
                record_audit_event_sync(
                    db=sync_db,
                    action="SUBSCRIPTION_HALTED",
                    entity_type="SUBSCRIPTION",
                    organization_id=target_org_id,
                    entity_id=str(sub.id),
                    metadata={"provider": "razorpay", "subscription_id": event.provider_subscription_id},
                )
                logger.warning(f"Razorpay subscription halted for org {target_org_id}")

    elif event.event_type == "subscription_cancelled":
        if target_org_id:
            sub = sync_db.execute(select(Subscription).where(Subscription.organization_id == target_org_id)).scalar_one_or_none()
            if sub:
                old_plan = sub.plan
                sub.status = "canceled"
                sub.plan = "free"
                sub.cancel_at_period_end = False
                record_audit_event_sync(
                    db=sync_db,
                    action="SUBSCRIPTION_DELETED",
                    entity_type="SUBSCRIPTION",
                    organization_id=target_org_id,
                    entity_id=str(sub.id),
                    metadata={"old_plan": old_plan, "new_plan": "free", "provider": "razorpay"},
                )
                logger.info(f"Razorpay subscription canceled, org {target_org_id} downgraded to free")

    elif event.event_type == "payment_failed":
        if target_org_id:
            sub = sync_db.execute(select(Subscription).where(Subscription.organization_id == target_org_id)).scalar_one_or_none()
            if sub:
                sub.status = "past_due"
                record_audit_event_sync(
                    db=sync_db,
                    action="INVOICE_PAYMENT_FAILED",
                    entity_type="PAYMENT",
                    organization_id=target_org_id,
                    entity_id=event.provider_payment_id or str(target_org_id),
                    metadata=event.metadata,
                )
            if event.provider_payment_id:
                existing_tx = sync_db.execute(
                    select(PaymentTransaction).where(PaymentTransaction.provider_payment_id == event.provider_payment_id).limit(1)
                ).scalar_one_or_none()
                if not existing_tx:
                    tx = PaymentTransaction(
                        organization_id=target_org_id,
                        provider="razorpay",
                        provider_payment_id=event.provider_payment_id,
                        provider_subscription_id=event.provider_subscription_id,
                        provider_event_id=event.provider_event_id,
                        amount=event.amount or 0,
                        currency="inr",
                        status="failed",
                        plan=sub.plan if sub else None,
                        error_code=event.metadata.get("error_code"),
                        error_description=event.metadata.get("error_description"),
                        metadata_json=event.metadata,
                    )
                    sync_db.add(tx)

    # Persist processed audit log for deduplication
    if event.provider_event_id:
        record_audit_event_sync(
            db=sync_db,
            action="RAZORPAY_WEBHOOK_PROCESSED",
            entity_type="RAZORPAY_EVENT",
            organization_id=target_org_id,
            entity_id=str(event.provider_event_id),
            metadata={"event_type": event.event_type},
        )

    sync_db.commit()
    return {"status": "processed", "event": event.event_type, "event_id": event.provider_event_id}


def _get_or_create_sub(
    sync_db: Session,
    org_id: uuid.UUID,
    customer_id: Optional[str],
    subscription_id: Optional[str],
    plan: str,
    provider: str = "stripe",
    currency: str = "usd",
) -> Subscription:
    """Helper to retrieve or initialize an organization's subscription record."""
    stmt = select(Subscription).where(Subscription.organization_id == org_id)
    sub = sync_db.execute(stmt).scalar_one_or_none()
    if not sub:
        sub = Subscription(
            organization_id=org_id,
            provider=provider,
            provider_customer_id=customer_id,
            provider_subscription_id=subscription_id,
            currency=currency,
            stripe_customer_id=customer_id if provider == "stripe" else None,
            stripe_subscription_id=subscription_id if provider == "stripe" else None,
            razorpay_customer_id=customer_id if provider == "razorpay" else None,
            razorpay_subscription_id=subscription_id if provider == "razorpay" else None,
            plan=plan,
            status="active",
        )
        sync_db.add(sub)
    return sub


def process_stripe_webhook_event(payload: bytes, sig_header: str, sync_db: Session) -> Dict[str, Any]:
    """
    Verifies Stripe signature, deduplicates replays via AuditLog, and idempotently
    processes the complete 8-event subscription lifecycle:
    - checkout.session.completed
    - checkout.session.async_payment_succeeded
    - checkout.session.async_payment_failed
    - customer.subscription.created
    - customer.subscription.updated
    - customer.subscription.deleted
    - invoice.paid
    - invoice.payment_failed

    Guarantees:
    1. Unpaid or pending checkout sessions never prematurely activate paid tiers.
    2. RBAC roles (User.role and OrganizationMember.role) are strictly preserved.
    3. Replay attacks and duplicate events are safely ignored.
    """
    event = None
    if settings.STRIPE_WEBHOOK_SECRET and not settings.STRIPE_WEBHOOK_SECRET.startswith("whsec_placeholder"):
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
        except Exception as e:
            logger.error(f"Stripe webhook signature verification failed: {e}")
            raise
    else:
        if settings.ENVIRONMENT.lower() in ("production", "prod"):
            logger.error("STRIPE_WEBHOOK_SECRET is unconfigured in production. Rejecting unverified webhook.")
            raise ValueError("Stripe webhook secret is unconfigured in production.")
        import json
        event = json.loads(payload.decode("utf-8"))

    event_id = event.get("id")
    event_type = event.get("type")
    data_object = event.get("data", {}).get("object", {})

    logger.info(f"Received Stripe webhook event: {event_type} (id: {event_id})")

    # Idempotency / replay protection check
    if event_id:
        existing_evt = sync_db.execute(
            select(AuditLog).where(
                AuditLog.action == "STRIPE_WEBHOOK_PROCESSED",
                AuditLog.entity_id == str(event_id),
            ).limit(1)
        ).scalar_one_or_none()
        if existing_evt:
            logger.info(f"Duplicate Stripe webhook event ignored: {event_id} ({event_type})")
            return {"status": "ignored", "reason": "duplicate", "event": event_type, "event_id": event_id}

    target_org_id: Optional[uuid.UUID] = None

    # 1. checkout.session.completed
    if event_type == "checkout.session.completed":
        org_id_str = data_object.get("client_reference_id") or data_object.get("metadata", {}).get("organization_id")
        plan = data_object.get("metadata", {}).get("plan", "basic")
        customer_id = data_object.get("customer")
        subscription_id = data_object.get("subscription")
        payment_status = data_object.get("payment_status")

        # Guard: Unpaid or deferred checkout sessions must not prematurely activate entitlements
        if payment_status not in ("paid", "no_payment_required"):
            logger.info(
                f"Checkout session {data_object.get('id')} completed with unpaid status '{payment_status}'. Awaiting payment."
            )
            if org_id_str:
                try:
                    target_org_id = uuid.UUID(org_id_str)
                    record_audit_event_sync(
                        db=sync_db,
                        action="CHECKOUT_PAYMENT_PENDING",
                        entity_type="CHECKOUT",
                        organization_id=target_org_id,
                        entity_id=str(data_object.get("id")),
                        metadata={"payment_status": payment_status, "plan": plan},
                    )
                except Exception:
                    pass
            if event_id:
                record_audit_event_sync(
                    db=sync_db,
                    action="STRIPE_WEBHOOK_PROCESSED",
                    entity_type="STRIPE_EVENT",
                    organization_id=target_org_id,
                    entity_id=str(event_id),
                    metadata={"event_type": event_type, "status": "deferred_payment_pending"},
                )
            sync_db.commit()
            return {"status": "deferred", "reason": "payment_pending", "event": event_type, "event_id": event_id}

        if org_id_str:
            try:
                target_org_id = uuid.UUID(org_id_str)
                sub = _get_or_create_sub(sync_db, target_org_id, customer_id, subscription_id, plan, provider="stripe", currency="usd")
                sub.provider = "stripe"
                sub.plan = plan
                sub.status = "active"
                sub.currency = "usd"
                if customer_id:
                    sub.stripe_customer_id = customer_id
                    sub.provider_customer_id = customer_id
                if subscription_id:
                    sub.stripe_subscription_id = subscription_id
                    sub.provider_subscription_id = subscription_id

                record_audit_event_sync(
                    db=sync_db,
                    action="PLAN_CHANGED",
                    entity_type="SUBSCRIPTION",
                    organization_id=target_org_id,
                    entity_id=str(sub.id) if getattr(sub, "id", None) else str(target_org_id),
                    metadata={"new_plan": plan, "source": "stripe_checkout", "subscription_id": subscription_id},
                )
                record_audit_event_sync(
                    db=sync_db,
                    action="PLAN_SELECTION_COMPLETED",
                    entity_type="ONBOARDING",
                    organization_id=target_org_id,
                    entity_id=str(target_org_id),
                    metadata={"plan": plan, "source": "stripe_checkout"},
                )
                logger.info(f"Upgraded organization {target_org_id} to plan {plan} (RBAC role preserved)")
            except Exception as e:
                logger.error(f"Failed to process checkout.session.completed for {org_id_str}: {e}")

    # 2. checkout.session.async_payment_succeeded
    elif event_type == "checkout.session.async_payment_succeeded":
        org_id_str = data_object.get("client_reference_id") or data_object.get("metadata", {}).get("organization_id")
        plan = data_object.get("metadata", {}).get("plan", "basic")
        customer_id = data_object.get("customer")
        subscription_id = data_object.get("subscription")

        if org_id_str:
            try:
                target_org_id = uuid.UUID(org_id_str)
                sub = _get_or_create_sub(sync_db, target_org_id, customer_id, subscription_id, plan, provider="stripe", currency="usd")
                sub.provider = "stripe"
                sub.plan = plan
                sub.status = "active"
                if customer_id:
                    sub.stripe_customer_id = customer_id
                    sub.provider_customer_id = customer_id
                if subscription_id:
                    sub.stripe_subscription_id = subscription_id
                    sub.provider_subscription_id = subscription_id

                record_audit_event_sync(
                    db=sync_db,
                    action="ASYNC_PAYMENT_SUCCEEDED",
                    entity_type="SUBSCRIPTION",
                    organization_id=target_org_id,
                    entity_id=str(sub.id) if getattr(sub, "id", None) else str(target_org_id),
                    metadata={"new_plan": plan, "subscription_id": subscription_id},
                )
                record_audit_event_sync(
                    db=sync_db,
                    action="PLAN_CHANGED",
                    entity_type="SUBSCRIPTION",
                    organization_id=target_org_id,
                    entity_id=str(sub.id) if getattr(sub, "id", None) else str(target_org_id),
                    metadata={"new_plan": plan, "source": "async_payment_succeeded", "subscription_id": subscription_id},
                )
                record_audit_event_sync(
                    db=sync_db,
                    action="PLAN_SELECTION_COMPLETED",
                    entity_type="ONBOARDING",
                    organization_id=target_org_id,
                    entity_id=str(target_org_id),
                    metadata={"plan": plan, "source": "async_payment"},
                )
                logger.info(f"Async payment succeeded for org {target_org_id}, plan {plan} activated")
            except Exception as e:
                logger.error(f"Failed to process async_payment_succeeded for {org_id_str}: {e}")

    # 3. checkout.session.async_payment_failed
    elif event_type == "checkout.session.async_payment_failed":
        org_id_str = data_object.get("client_reference_id") or data_object.get("metadata", {}).get("organization_id")
        plan = data_object.get("metadata", {}).get("plan", "basic")
        if org_id_str:
            try:
                target_org_id = uuid.UUID(org_id_str)
                stmt = select(Subscription).where(Subscription.organization_id == target_org_id)
                sub = sync_db.execute(stmt).scalar_one_or_none()
                if sub and sub.plan != "free" and sub.status != "active":
                    sub.status = "incomplete_expired"
                    sub.plan = "free"

                record_audit_event_sync(
                    db=sync_db,
                    action="ASYNC_PAYMENT_FAILED",
                    entity_type="CHECKOUT",
                    organization_id=target_org_id,
                    entity_id=str(data_object.get("id")),
                    metadata={"reason": "async_payment_failed", "plan": plan},
                )
                logger.warning(f"Async payment failed for organization {target_org_id}")
            except Exception as e:
                logger.error(f"Failed to process async_payment_failed for {org_id_str}: {e}")

    # 4. customer.subscription.created
    elif event_type == "customer.subscription.created":
        sub_id = data_object.get("id")
        customer_id = data_object.get("customer")
        status_val = data_object.get("status", "active")
        meta_org = data_object.get("metadata", {}).get("organization_id")

        sub = None
        if sub_id:
            sub = sync_db.execute(select(Subscription).where(Subscription.stripe_subscription_id == sub_id)).scalar_one_or_none()
        if not sub and customer_id:
            sub = sync_db.execute(select(Subscription).where(Subscription.stripe_customer_id == customer_id)).scalar_one_or_none()
        if not sub and meta_org:
            try:
                sub = sync_db.execute(select(Subscription).where(Subscription.organization_id == uuid.UUID(meta_org))).scalar_one_or_none()
            except Exception:
                pass

        if sub:
            target_org_id = sub.organization_id
            sub.stripe_subscription_id = sub_id
            sub.provider_subscription_id = sub_id
            if customer_id:
                sub.stripe_customer_id = customer_id
                sub.provider_customer_id = customer_id
            sub.status = status_val
            record_audit_event_sync(
                db=sync_db,
                action="SUBSCRIPTION_CREATED",
                entity_type="SUBSCRIPTION",
                organization_id=sub.organization_id,
                entity_id=str(sub.id),
                metadata={"stripe_subscription_id": sub_id, "status": status_val},
            )
            logger.info(f"Subscription {sub_id} linked to org {sub.organization_id} with status {status_val}")

    # 5. customer.subscription.updated
    elif event_type == "customer.subscription.updated":
        sub_id = data_object.get("id")
        status_val = data_object.get("status")
        cancel_at_end = data_object.get("cancel_at_period_end", False)

        stmt = select(Subscription).where(Subscription.stripe_subscription_id == sub_id)
        sub = sync_db.execute(stmt).scalar_one_or_none()
        if sub:
            target_org_id = sub.organization_id
            old_plan = sub.plan
            sub.status = status_val
            sub.cancel_at_period_end = cancel_at_end
            if status_val in ("canceled", "unpaid"):
                sub.plan = "free"

            record_audit_event_sync(
                db=sync_db,
                action="SUBSCRIPTION_UPDATED",
                entity_type="SUBSCRIPTION",
                organization_id=sub.organization_id,
                entity_id=str(sub.id),
                metadata={"old_plan": old_plan, "new_plan": sub.plan, "status": status_val, "cancel_at_period_end": cancel_at_end},
            )
            logger.info(f"Subscription {sub_id} updated: status={status_val}, plan={sub.plan} (RBAC role preserved)")

    # 6. customer.subscription.deleted
    elif event_type == "customer.subscription.deleted":
        sub_id = data_object.get("id")
        stmt = select(Subscription).where(Subscription.stripe_subscription_id == sub_id)
        sub = sync_db.execute(stmt).scalar_one_or_none()
        if sub:
            target_org_id = sub.organization_id
            old_plan = sub.plan
            sub.status = "canceled"
            sub.plan = "free"
            sub.cancel_at_period_end = False

            record_audit_event_sync(
                db=sync_db,
                action="SUBSCRIPTION_DELETED",
                entity_type="SUBSCRIPTION",
                organization_id=sub.organization_id,
                entity_id=str(sub.id),
                metadata={"old_plan": old_plan, "new_plan": "free", "status": "canceled"},
            )
            logger.info(f"Subscription {sub_id} canceled and downgraded to free for org {sub.organization_id}")

    # 7. invoice.paid
    elif event_type == "invoice.paid":
        sub_id = data_object.get("subscription")
        if sub_id:
            stmt = select(Subscription).where(Subscription.stripe_subscription_id == sub_id)
            sub = sync_db.execute(stmt).scalar_one_or_none()
            if sub:
                target_org_id = sub.organization_id
                sub.status = "active"

                payment_intent = data_object.get("payment_intent")
                if payment_intent:
                    existing_tx = sync_db.execute(
                        select(PaymentTransaction).where(PaymentTransaction.provider_payment_id == payment_intent).limit(1)
                    ).scalar_one_or_none()
                    if not existing_tx:
                        tx = PaymentTransaction(
                            organization_id=target_org_id,
                            provider="stripe",
                            provider_payment_id=payment_intent,
                            provider_subscription_id=sub_id,
                            amount=data_object.get("amount_paid", 0),
                            currency="usd",
                            status="succeeded",
                            plan=sub.plan,
                            billing_interval=sub.billing_interval,
                            metadata_json={"invoice_id": data_object.get("id")},
                        )
                        sync_db.add(tx)

                record_audit_event_sync(
                    db=sync_db,
                    action="INVOICE_PAID",
                    entity_type="INVOICE",
                    organization_id=sub.organization_id,
                    entity_id=str(data_object.get("id")),
                    metadata={"amount_paid": data_object.get("amount_paid"), "subscription_id": sub_id},
                )
                logger.info(f"Invoice paid for org {sub.organization_id}, subscription {sub_id} active")

    # 8. invoice.payment_failed
    elif event_type == "invoice.payment_failed":
        sub_id = data_object.get("subscription")
        if sub_id:
            stmt = select(Subscription).where(Subscription.stripe_subscription_id == sub_id)
            sub = sync_db.execute(stmt).scalar_one_or_none()
            if sub:
                target_org_id = sub.organization_id
                sub.status = "past_due"
                attempt_count = data_object.get("attempt_count", 1)
                record_audit_event_sync(
                    db=sync_db,
                    action="INVOICE_PAYMENT_FAILED",
                    entity_type="INVOICE",
                    organization_id=sub.organization_id,
                    entity_id=str(data_object.get("id")),
                    metadata={
                        "attempt_count": attempt_count,
                        "amount_due": data_object.get("amount_due"),
                        "subscription_id": sub_id,
                    },
                )
                logger.warning(
                    f"Invoice payment failed for org {sub.organization_id}, marked past_due (attempt {attempt_count})"
                )

    # Persist processed event ID for deduplication / idempotency
    if event_id:
        record_audit_event_sync(
            db=sync_db,
            action="STRIPE_WEBHOOK_PROCESSED",
            entity_type="STRIPE_EVENT",
            organization_id=target_org_id,
            entity_id=str(event_id),
            metadata={"event_type": event_type},
        )

    sync_db.commit()
    return {"status": "processed", "event": event_type, "event_id": event_id}
