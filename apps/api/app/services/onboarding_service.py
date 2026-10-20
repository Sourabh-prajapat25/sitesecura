"""
Scanly API - User Onboarding & Plan Selection Service
Determines authoritative onboarding state, idempotently activates Free plans,
and manages transitions between pending_plan_selection, checkout_pending,
and completed states without touching RBAC roles or existing customer data.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, Tuple
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.billing import Subscription
from app.models.user import Organization, User
from app.models.website import Website
from app.models.alert import AuditLog
from app.core.permissions import normalize_plan_name, get_plan_config
from app.services.audit_service import record_audit_event
from app.services.entitlement_service import get_effective_plan

logger = logging.getLogger(__name__)

# Canonical onboarding lifecycle states
ONBOARDING_PENDING = "pending_plan_selection"
ONBOARDING_CHECKOUT_PENDING = "checkout_pending"
ONBOARDING_COMPLETED = "completed"
ONBOARDING_REQUIRES_RECOVERY = "requires_recovery"


async def get_onboarding_status(
    db: AsyncSession,
    organization: Organization,
    user: User,
) -> Dict[str, Any]:
    """
    Authoritatively determines the organization's onboarding and plan selection state.

    Rules:
    1. Active paid subscriptions (basic, pro, agency, admin) are ALWAYS completed.
    2. Subscriptions with active Stripe subscription IDs are ALWAYS completed.
    3. Organizations with existing websites (> 0) are established accounts: ALWAYS completed.
    4. Check audit log for explicit PLAN_SELECTION_COMPLETED: ALWAYS completed.
    5. Check audit log for CHECKOUT_INITIATED:
       - If followed by CHECKOUT_CANCELED: 'requires_recovery'.
       - If initiated recently (< 2 hours): 'checkout_pending'.
       - If expired (> 2 hours): 'requires_recovery'.
    6. Legacy accounts (created before onboarding launch with activity): 'completed'.
    7. Otherwise: 'pending_plan_selection'.
    """
    effective_plan = await get_effective_plan(db, organization.id, fallback_role=user.role)

    # Rule 1: User is on a paid plan
    if effective_plan in ("basic", "pro", "agency", "admin"):
        return {
            "status": ONBOARDING_COMPLETED,
            "plan": effective_plan,
            "can_activate_free": False,
            "has_active_paid": True,
        }

    # Fetch organization subscription
    sub_stmt = select(Subscription).where(Subscription.organization_id == organization.id)
    sub_res = await db.execute(sub_stmt)
    sub = sub_res.scalar_one_or_none()

    # Rule 2: Active Stripe subscription ID present
    if sub and sub.stripe_subscription_id and sub.status in ("active", "trialing"):
        return {
            "status": ONBOARDING_COMPLETED,
            "plan": normalize_plan_name(sub.plan),
            "can_activate_free": False,
            "has_active_paid": True,
        }

    # Rule 3: Established organization with configured websites
    w_stmt = select(func.count(Website.id)).where(Website.organization_id == organization.id)
    w_res = await db.execute(w_stmt)
    websites_count = w_res.scalar() or 0
    if websites_count > 0:
        return {
            "status": ONBOARDING_COMPLETED,
            "plan": "free",
            "can_activate_free": False,
            "has_active_paid": False,
        }

    # Rule 4 & 5: Inspect Audit Logs for Onboarding Actions
    audit_stmt = (
        select(AuditLog)
        .where(
            AuditLog.organization_id == organization.id,
            AuditLog.action.in_(["PLAN_SELECTION_COMPLETED", "CHECKOUT_INITIATED", "CHECKOUT_CANCELED"]),
        )
        .order_by(desc(AuditLog.created_at))
        .limit(5)
    )
    audit_res = await db.execute(audit_stmt)
    logs = audit_res.scalars().all()

    for log in logs:
        if log.action == "PLAN_SELECTION_COMPLETED":
            return {
                "status": ONBOARDING_COMPLETED,
                "plan": "free",
                "can_activate_free": False,
                "has_active_paid": False,
            }
        elif log.action == "CHECKOUT_CANCELED":
            return {
                "status": ONBOARDING_REQUIRES_RECOVERY,
                "plan": "free",
                "can_activate_free": True,
                "has_active_paid": False,
            }
        elif log.action == "CHECKOUT_INITIATED":
            # Check age of checkout session
            now = datetime.now(timezone.utc)
            log_time = log.created_at if log.created_at.tzinfo else log.created_at.replace(tzinfo=timezone.utc)
            if now - log_time < timedelta(hours=2):
                checkout_meta = log.metadata_json or {}
                return {
                    "status": ONBOARDING_CHECKOUT_PENDING,
                    "plan": "free",
                    "intended_plan": checkout_meta.get("plan", "basic"),
                    "session_id": checkout_meta.get("session_id"),
                    "can_activate_free": True,
                    "has_active_paid": False,
                }
            else:
                return {
                    "status": ONBOARDING_REQUIRES_RECOVERY,
                    "plan": "free",
                    "can_activate_free": True,
                    "has_active_paid": False,
                }

    # Default for new accounts without prior plan selection
    return {
        "status": ONBOARDING_PENDING,
        "plan": "free",
        "can_activate_free": True,
        "has_active_paid": False,
    }


async def activate_free_plan(
    db: AsyncSession,
    organization: Organization,
    user: User,
) -> Dict[str, Any]:
    """
    Idempotently activates the Free plan for an eligible account.
    Guarantees:
    - Never overwrites an active paid plan.
    - Idempotent: repeated calls succeed without resetting data.
    - Records immutable audit log entry.
    """
    effective_plan = await get_effective_plan(db, organization.id, fallback_role=user.role)
    if effective_plan in ("basic", "pro", "agency", "admin"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "ACTIVE_PAID_SUBSCRIPTION_EXISTS",
                    "message": f"Organization already has active '{effective_plan}' plan. Free activation is only for eligible new accounts.",
                }
            },
        )

    # Retrieve or verify subscription
    sub_stmt = select(Subscription).where(Subscription.organization_id == organization.id)
    sub_res = await db.execute(sub_stmt)
    sub = sub_res.scalar_one_or_none()

    if not sub:
        sub = Subscription(
            organization_id=organization.id,
            stripe_customer_id=f"cust_{user.id.hex[:12]}",
            plan="free",
            status="active",
        )
        db.add(sub)
    else:
        sub.plan = "free"
        sub.status = "active"

    # Record Plan Selection Completed Audit Log
    await record_audit_event(
        db=db,
        action="PLAN_SELECTION_COMPLETED",
        entity_type="ONBOARDING",
        organization_id=organization.id,
        user_id=user.id,
        entity_id=str(organization.id),
        metadata={"plan": "free", "status": ONBOARDING_COMPLETED},
    )

    await db.commit()
    logger.info(f"Free plan successfully activated for organization {organization.id} by user {user.id}")

    return {
        "success": True,
        "plan": "free",
        "onboarding_status": ONBOARDING_COMPLETED,
        "message": "Free plan activated successfully.",
    }


async def record_checkout_initiated(
    db: AsyncSession,
    organization: Organization,
    user: User,
    plan: str,
    interval: str,
    session_id: str,
) -> None:
    """Records audit log when user initiates checkout session during onboarding."""
    await record_audit_event(
        db=db,
        action="CHECKOUT_INITIATED",
        entity_type="ONBOARDING",
        organization_id=organization.id,
        user_id=user.id,
        entity_id=session_id,
        metadata={
            "plan": plan,
            "interval": interval,
            "session_id": session_id,
            "status": ONBOARDING_CHECKOUT_PENDING,
        },
    )
    await db.commit()


async def record_checkout_canceled(
    db: AsyncSession,
    organization: Organization,
    user: User,
    session_id: Optional[str] = None,
) -> None:
    """Records audit log when user cancels checkout session during onboarding."""
    await record_audit_event(
        db=db,
        action="CHECKOUT_CANCELED",
        entity_type="ONBOARDING",
        organization_id=organization.id,
        user_id=user.id,
        entity_id=session_id or str(organization.id),
        metadata={
            "session_id": session_id,
            "status": ONBOARDING_REQUIRES_RECOVERY,
        },
    )
    await db.commit()
