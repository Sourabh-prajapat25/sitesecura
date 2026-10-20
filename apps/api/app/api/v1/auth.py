"""
Scanly API - Authentication & Profile Endpoints
"""

from typing import Dict, Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_current_user_token
from app.services.auth_service import get_or_create_user
from app.services.entitlement_service import get_effective_plan
from app.services.onboarding_service import get_onboarding_status
from app.schemas.shared import UserResponse, OrganizationResponse, NotificationPreferencesUpdate

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/me")
async def get_current_user_profile(
    token_data: Dict[str, Any] = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the authenticated user's profile, active organization,
    authoritative subscription plan, and onboarding status.

    Important:
    - user.role remains the application/RBAC role.
    - plan comes from the organization's active subscription.
    - onboarding_status determines plan selection eligibility.
    """
    user, org = await get_or_create_user(db, token_data)

    plan = await get_effective_plan(
        db,
        org.id,
        fallback_role=user.role,
    )

    onboarding_info = await get_onboarding_status(
        db,
        organization=org,
        user=user,
    )

    return {
        "user": UserResponse.model_validate(user),
        "organization": OrganizationResponse.model_validate(org),
        "plan": plan,
        "onboarding_status": onboarding_info["status"],
    }


@router.post("/sync")
async def sync_firebase_user(
    token_data: Dict[str, Any] = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Syncs Firebase authenticated user with PostgreSQL database on login/register.

    Returns the authoritative organization subscription plan and onboarding status
    separately from the user's RBAC role.
    """
    user, org = await get_or_create_user(db, token_data)

    plan = await get_effective_plan(
        db,
        org.id,
        fallback_role=user.role,
    )

    onboarding_info = await get_onboarding_status(
        db,
        organization=org,
        user=user,
    )

    return {
        "status": "synced",
        "user": UserResponse.model_validate(user),
        "organization": OrganizationResponse.model_validate(org),
        "plan": plan,
        "onboarding_status": onboarding_info["status"],
    }


@router.get("/preferences")
async def get_notification_preferences(
    token_data: Dict[str, Any] = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves current user's email notification preferences."""
    user, _ = await get_or_create_user(db, token_data)
    defaults = {
        "email_alerts": True,
        "weekly_digest": True,
        "ssl_expiry": True,
        "score_drop": True,
        "critical_finding": True,
    }
    current_prefs = dict(defaults)
    if user.notification_preferences:
        current_prefs.update(user.notification_preferences)
    return {"preferences": current_prefs}


@router.patch("/preferences")
async def update_notification_preferences(
    prefs_in: NotificationPreferencesUpdate,
    token_data: Dict[str, Any] = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Updates user's email notification preferences."""
    user, _ = await get_or_create_user(db, token_data)
    current = dict(user.notification_preferences or {
        "email_alerts": True,
        "weekly_digest": True,
        "ssl_expiry": True,
        "score_drop": True,
        "critical_finding": True,
    })

    updates = prefs_in.model_dump(exclude_unset=True)
    allowed_keys = {"email_alerts", "weekly_digest", "ssl_expiry", "score_drop", "critical_finding"}
    sanitized_updates = {k: v for k, v in updates.items() if k in allowed_keys and isinstance(v, bool)}
    current.update(sanitized_updates)
    user.notification_preferences = current
    await db.commit()
    return {"status": "updated", "preferences": current}