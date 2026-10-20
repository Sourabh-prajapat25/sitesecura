"""
Scanly API - User Onboarding & Plan Selection Endpoints
Provides authenticated endpoints for checking onboarding status, activating
the Free plan idempotently, and handling checkout initiation and recovery.
"""
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.authorization import AuthContext, get_current_auth_context
from app.schemas.shared import CreateCheckoutRequest, CheckoutResponse
from app.services.billing_service import create_checkout_session
from app.services.onboarding_service import (
    get_onboarding_status,
    activate_free_plan,
    record_checkout_initiated,
    record_checkout_canceled,
    ONBOARDING_COMPLETED,
    ONBOARDING_PENDING,
)

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


@router.get("/status")
async def get_user_onboarding_status(
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Authoritatively checks the authenticated user's organization onboarding state.
    Returns current onboarding lifecycle state, effective plan, and activation eligibility.
    """
    onboarding_info = await get_onboarding_status(
        db=db,
        organization=auth.organization,
        user=auth.user,
    )

    return {
        "organization_id": str(auth.organization.id),
        "user_id": str(auth.user.id),
        "onboarding_status": onboarding_info["status"],
        "plan": onboarding_info["plan"],
        "can_activate_free": onboarding_info["can_activate_free"],
        "has_active_paid": onboarding_info["has_active_paid"],
        "intended_plan": onboarding_info.get("intended_plan"),
        "session_id": onboarding_info.get("session_id"),
    }


@router.post("/activate-free")
async def activate_free(
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Idempotently activates the Free tier plan during onboarding.
    Fails safely if organization already has an active paid subscription.
    """
    if auth.role not in ("owner", "admin") and not auth.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "INSUFFICIENT_PERMISSIONS",
                    "message": "Only organization owners and admins can complete onboarding plan selection.",
                }
            },
        )

    res = await activate_free_plan(
        db=db,
        organization=auth.organization,
        user=auth.user,
    )
    return res


@router.post("/checkout", response_model=CheckoutResponse)
async def create_onboarding_checkout(
    checkout_in: CreateCheckoutRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a Stripe Checkout Session for onboarding plan selection (Basic, Pro, Agency).
    Records audit log to track checkout_pending lifecycle state.
    """
    if auth.role not in ("owner", "admin") and not auth.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "INSUFFICIENT_PERMISSIONS",
                    "message": "Only organization owners and admins can manage subscriptions.",
                }
            },
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


@router.post("/cancel-checkout")
async def cancel_onboarding_checkout(
    session_id: Optional[str] = Query(None, description="Checkout Session ID if known"),
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Records checkout cancellation so that onboarding enters a safe recoverable state.
    Does not cancel or overwrite any existing subscription.
    """
    await record_checkout_canceled(
        db=db,
        organization=auth.organization,
        user=auth.user,
        session_id=session_id,
    )
    return {
        "status": "recorded",
        "onboarding_status": "requires_recovery",
        "message": "Checkout canceled. You may choose another plan or retry.",
    }
