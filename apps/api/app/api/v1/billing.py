"""
Scanly API - Billing, Multi-Provider Checkout & Webhook Endpoints
Supports Razorpay & Stripe checkouts, signature verification, in-app cancellation, and idempotent webhooks.
"""
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db, get_sync_db
from app.core.config import settings
from app.core.security import get_current_user_token
from app.core.permissions import get_plan_config
from app.models.billing import Subscription, UsageRecord
from app.models.website import Website
from app.models.alert import AuditLog
from app.schemas.shared import (
    CreateCheckoutRequest,
    CheckoutResponse,
    CustomerPortalResponse,
    SubscriptionResponse,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
    CancelSubscriptionRequest,
    CancelSubscriptionResponse,
)
from app.services.auth_service import get_or_create_user
from app.services.billing_service import (
    create_checkout_session,
    create_customer_portal_session,
    cancel_subscription_service,
    verify_razorpay_checkout_signature_and_activate,
    process_razorpay_webhook_event,
    process_stripe_webhook_event,
)
from app.services.onboarding_service import record_checkout_initiated
from app.core.authorization import AuthContext, get_current_auth_context
from app.services.entitlement_service import get_current_usage_period

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.get("", response_model=SubscriptionResponse)
async def get_billing_status(
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves current organization subscription tier, limits, provider details, and usage counts."""
    stmt = select(Subscription).where(Subscription.organization_id == auth.organization.id)
    result = await db.execute(stmt)
    sub = result.scalar_one_or_none()

    plan_name = auth.plan
    plan_cfg = get_plan_config(plan_name)

    # Count used websites
    w_stmt = select(func.count(Website.id)).where(Website.organization_id == auth.organization.id)
    w_res = await db.execute(w_stmt)
    used_websites = w_res.scalar() or 0

    # Count used scans for current period
    period_month, period_start, period_end = get_current_usage_period()
    u_stmt = select(UsageRecord).where(
        UsageRecord.organization_id == auth.organization.id,
        UsageRecord.period_month == period_month,
    )
    u_res = await db.execute(u_stmt)
    usage = u_res.scalar_one_or_none()
    used_scans = usage.scans_count if usage else 0

    return SubscriptionResponse(
        plan=plan_name,
        status=sub.status if sub else "active",
        current_period_start=sub.current_period_start if (sub and sub.current_period_start) else period_start,
        current_period_end=sub.current_period_end if (sub and sub.current_period_end) else period_end,
        cancel_at_period_end=sub.cancel_at_period_end if sub else False,
        max_websites=plan_cfg["max_websites"],
        max_scans_per_month=plan_cfg["max_scans_per_month"],
        used_websites=used_websites,
        used_scans=used_scans,
        provider=sub.provider if sub else "stripe",
        currency=sub.currency if sub else "usd",
        amount_cents=sub.amount_cents if sub else None,
        billing_interval=sub.billing_interval if sub else "month",
        razorpay_subscription_id=sub.razorpay_subscription_id if sub else None,
        stripe_subscription_id=sub.stripe_subscription_id if sub else None,
    )


@router.get("/session-status")
async def get_session_status(
    session_id: str = Query(..., description="Stripe Checkout Session ID or Razorpay Subscription ID"),
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves authoritative payment & subscription activation status for a checkout session.
    Verifies that the session belongs to the authenticated organization.
    Supports development mock checkout auto-completion and active subscription lookups.
    """
    stmt = select(Subscription).where(Subscription.organization_id == auth.organization.id)
    res = await db.execute(stmt)
    sub = res.scalar_one_or_none()

    # Development Mock Checkout Auto-Confirmation (Stripe & Razorpay mocks)
    if session_id.startswith("cs_mock_") or session_id.startswith("sub_mock_"):
        if settings.ENVIRONMENT.lower() in ("production", "prod"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": {"code": "INVALID_CHECKOUT_SESSION", "message": "Mock checkout sessions are prohibited in production."}},
            )

        # Verify that this mock session was legitimately initiated by THIS organization
        audit_stmt = (
            select(AuditLog)
            .where(
                AuditLog.organization_id == auth.organization.id,
                AuditLog.action == "CHECKOUT_INITIATED",
                AuditLog.entity_id == session_id,
            )
            .limit(1)
        )
        audit_res = await db.execute(audit_stmt)
        audit_log = audit_res.scalar_one_or_none()
        if not audit_log:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": {"code": "SESSION_NOT_FOUND", "message": "Checkout session was not found for this organization."}},
            )

        intended_plan = (audit_log.metadata_json or {}).get("plan", "basic")
        intended_interval = (audit_log.metadata_json or {}).get("interval", "month")
        is_razorpay = session_id.startswith("sub_mock_rzp_")

        if sub and sub.plan != intended_plan:
            sub.plan = intended_plan
            sub.status = "active"
            if is_razorpay:
                sub.provider = "razorpay"
                sub.currency = "inr"
                sub.razorpay_subscription_id = session_id
                sub.provider_subscription_id = session_id
            else:
                sub.provider = "stripe"
                sub.currency = "usd"
                sub.stripe_subscription_id = f"sub_mock_{auth.organization.id.hex[:8]}"
                sub.provider_subscription_id = sub.stripe_subscription_id
            sub.billing_interval = intended_interval
            await db.commit()

        return {
            "session_id": session_id,
            "status": "complete",
            "plan": sub.plan if sub else intended_plan,
            "is_active": True,
            "provider": sub.provider if sub else ("razorpay" if is_razorpay else "stripe"),
        }

    # Production verification: Check if subscription has already been activated via webhook or verification endpoint
    if sub and sub.status in ("active", "trialing") and sub.plan != "free":
        # Check if session matches subscription IDs
        if (
            sub.stripe_subscription_id == session_id
            or sub.razorpay_subscription_id == session_id
            or sub.provider_subscription_id == session_id
        ):
            return {
                "session_id": session_id,
                "status": "complete",
                "plan": sub.plan,
                "is_active": True,
                "provider": sub.provider,
            }

    # Fallback: Query Stripe API directly if Stripe secret is configured and webhook is delayed
    if settings.STRIPE_SECRET_KEY and not settings.STRIPE_SECRET_KEY.startswith("sk_test_placeholder") and session_id.startswith("cs_"):
        try:
            import stripe
            session = stripe.checkout.Session.retrieve(session_id)
            client_ref = session.client_reference_id
            meta_org = (session.metadata or {}).get("organization_id")
            if client_ref == str(auth.organization.id) or meta_org == str(auth.organization.id):
                if session.payment_status == "paid" or session.status == "complete":
                    plan = (session.metadata or {}).get("plan", "basic")
                    if sub:
                        sub.plan = plan
                        sub.status = "active"
                        sub.provider = "stripe"
                        sub.currency = "usd"
                        if session.customer:
                            sub.stripe_customer_id = session.customer
                            sub.provider_customer_id = session.customer
                        if session.subscription:
                            sub.stripe_subscription_id = session.subscription
                            sub.provider_subscription_id = session.subscription
                        await db.commit()
                    return {
                        "session_id": session_id,
                        "status": "complete",
                        "plan": plan,
                        "is_active": True,
                        "provider": "stripe",
                    }
        except Exception as e:
            logger.warning(f"Error checking Stripe session directly: {e}")

    # Fallback: Query Razorpay API directly if Razorpay secret is configured and webhook is delayed
    if (
        settings.RAZORPAY_KEY_ID
        and settings.RAZORPAY_KEY_SECRET
        and not settings.RAZORPAY_KEY_SECRET.startswith("rzp_test_placeholder")
        and session_id.startswith("sub_")
        and not session_id.startswith("sub_mock_")
    ):
        try:
            import razorpay
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            remote = client.subscription.fetch(session_id)
            meta_notes = remote.get("notes") or {}
            meta_org = meta_notes.get("organization_id")
            if meta_org == str(auth.organization.id):
                remote_status = remote.get("status")
                if remote_status in ("active", "authenticated"):
                    plan = meta_notes.get("plan", "basic")
                    interval = meta_notes.get("interval", "month")
                    if sub:
                        sub.plan = plan
                        sub.status = "active"
                        sub.provider = "razorpay"
                        sub.currency = "inr"
                        sub.billing_interval = interval
                        sub.razorpay_subscription_id = session_id
                        sub.provider_subscription_id = session_id
                        if remote.get("customer_id"):
                            sub.razorpay_customer_id = remote.get("customer_id")
                            sub.provider_customer_id = remote.get("customer_id")
                        await db.commit()
                    return {
                        "session_id": session_id,
                        "status": "complete",
                        "plan": plan,
                        "is_active": True,
                        "provider": "razorpay",
                    }
        except Exception as e:
            logger.warning(f"Error checking Razorpay subscription directly: {e}")

    # Still pending
    return {
        "session_id": session_id,
        "status": "pending",
        "plan": sub.plan if sub else "free",
        "is_active": False,
        "provider": sub.provider if sub else "razorpay",
    }


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    checkout_in: CreateCheckoutRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Generates a checkout session for upgrading subscription tier.
    Routes to Razorpay (INR) or Stripe (USD) with authoritative server-side plan pricing.
    """
    if auth.role not in ("owner", "admin") and not auth.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Only organization owners and admins can manage subscriptions."}},
        )

    res = create_checkout_session(
        organization=auth.organization,
        user=auth.user,
        plan_name=checkout_in.plan,
        interval=checkout_in.interval,
        currency=checkout_in.currency,
        provider=checkout_in.provider,
        success_url=checkout_in.success_url,
        cancel_url=checkout_in.cancel_url,
    )

    identifier = res.get("session_id") or res.get("subscription_id")

    await record_checkout_initiated(
        db=db,
        organization=auth.organization,
        user=auth.user,
        plan=checkout_in.plan,
        interval=checkout_in.interval,
        session_id=identifier,
    )

    return CheckoutResponse(
        checkout_url=res.get("checkout_url"),
        session_id=identifier,
        provider=res.get("provider", "razorpay"),
        subscription_id=res.get("subscription_id"),
        key_id=res.get("key_id"),
        amount=res.get("amount"),
        currency=res.get("currency"),
        plan=res.get("plan"),
        interval=res.get("interval"),
    )


@router.post("/verify-payment", response_model=VerifyPaymentResponse)
async def verify_payment(
    verify_in: VerifyPaymentRequest,
    auth: AuthContext = Depends(get_current_auth_context),
):
    """
    Verifies Razorpay payment signature from client-side checkout callback and
    activates subscription immediately without waiting for webhook latency.
    """
    if auth.role not in ("owner", "admin") and not auth.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Only organization owners and admins can manage subscriptions."}},
        )

    sync_db = get_sync_db()
    try:
        result = verify_razorpay_checkout_signature_and_activate(
            organization_id=auth.organization.id,
            payment_id=verify_in.razorpay_payment_id,
            subscription_id=verify_in.razorpay_subscription_id,
            signature=verify_in.razorpay_signature,
            sync_db=sync_db,
        )
        return VerifyPaymentResponse(
            status=result["status"],
            plan=result["plan"],
            is_active=result["is_active"],
            subscription_id=result["subscription_id"],
        )
    finally:
        sync_db.close()


@router.post("/cancel", response_model=CancelSubscriptionResponse)
async def cancel_subscription(
    cancel_in: CancelSubscriptionRequest = CancelSubscriptionRequest(),
    auth: AuthContext = Depends(get_current_auth_context),
):
    """
    Cancels organization subscription through the active provider (Razorpay or Stripe).
    """
    if auth.role not in ("owner", "admin") and not auth.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Only organization owners and admins can manage subscriptions."}},
        )

    sync_db = get_sync_db()
    try:
        res = cancel_subscription_service(
            organization=auth.organization,
            cancel_at_period_end=cancel_in.cancel_at_period_end,
            sync_db=sync_db,
        )
        return CancelSubscriptionResponse(
            status=res["status"],
            message=res["message"],
            cancel_at_period_end=res["cancel_at_period_end"],
        )
    finally:
        sync_db.close()


@router.post("/portal", response_model=CustomerPortalResponse)
async def create_customer_portal(
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Generates customer billing management portal session."""
    if auth.role not in ("owner", "admin") and not auth.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Only organization owners and admins can manage subscriptions."}},
        )
    portal_url = create_customer_portal_session(organization=auth.organization)
    return CustomerPortalResponse(portal_url=portal_url)


@router.post("/webhooks/razorpay")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None, alias="X-Razorpay-Signature"),
):
    """Handles incoming Razorpay subscription webhook events idempotently with signature verification."""
    payload = await request.body()
    sync_db = get_sync_db()
    try:
        res = process_razorpay_webhook_event(payload, x_razorpay_signature or "", sync_db)
        return res
    except (ValueError, Exception) as e:
        if isinstance(e, ValueError):
            logger.error(f"Razorpay webhook verification error: {type(e).__name__} - {str(e)[:120]}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid webhook payload or signature",
            )
        logger.error(f"Razorpay webhook processing error: {type(e).__name__} - {str(e)[:120]}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook processing error",
        )
    finally:
        sync_db.close()


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
):
    """Handles incoming Stripe subscription webhook events idempotently with signature verification."""
    payload = await request.body()
    sync_db = get_sync_db()
    try:
        res = process_stripe_webhook_event(payload, stripe_signature or "", sync_db)
        return res
    except (ValueError, Exception) as e:
        import stripe
        if isinstance(e, (stripe.error.SignatureVerificationError, ValueError)):
            logger.error(f"Stripe webhook verification error: {type(e).__name__} - {str(e)[:120]}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid webhook payload or signature",
            )
        logger.error(f"Stripe webhook processing error: {type(e).__name__} - {str(e)[:120]}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook processing error",
        )
    finally:
        sync_db.close()
