"""
Scanly API - Verified Badge Policy Management Service (VB-7)
Enforces administrative policy governance, multi-policy safety,
defensive validation, audit logging, and historical verification immutability.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.verification import SecurityBadgePolicy, SecurityVerification
from app.schemas.verification import BadgePolicyUpdate, BadgePolicyResponse
from app.core.config import settings
from app.services.audit_service import record_audit_event

logger = logging.getLogger(__name__)


class BadgePolicyService:
    """Service handling governance and lifecycle of SecurityBadgePolicy records."""

    @classmethod
    async def get_or_create_default_policy(cls, db: AsyncSession) -> SecurityBadgePolicy:
        """
        Retrieves the active policy or creates the default policy if none exists.
        Guarantees idempotency and system boot safety.
        """
        stmt = select(SecurityBadgePolicy).where(SecurityBadgePolicy.is_active == True)
        res = await db.execute(stmt)
        policies = res.scalars().all()

        if len(policies) == 1:
            return policies[0]

        if len(policies) > 1:
            logger.warning(
                f"Multiple active policies detected ({len(policies)}). Preserving first policy and deactivating others."
            )
            primary = policies[0]
            for p in policies[1:]:
                p.is_active = False
            await db.flush()
            return primary

        # If any policy exists, activate the first one
        any_stmt = select(SecurityBadgePolicy).order_by(SecurityBadgePolicy.created_at.asc())
        any_res = await db.execute(any_stmt)
        existing = any_res.scalars().all()
        if existing:
            existing[0].is_active = True
            await db.flush()
            return existing[0]

        # Create fresh default policy
        default_policy = SecurityBadgePolicy(
            id=uuid.uuid4(),
            name="default",
            description="Default platform-wide SiteSecura Verified Badge eligibility policy.",
            is_active=True,
            minimum_score=getattr(settings, "SECURITY_BADGE_MINIMUM_SCORE", 70),
            maximum_scan_age_days=30,
            verification_validity_days=30,
            disallow_critical_findings=True,
            disallow_high_findings=False,
            require_successful_scan=True,
            require_authorized_website=True,
            require_monitoring=False,
        )
        db.add(default_policy)
        await db.flush()
        return default_policy

    @classmethod
    async def get_active_policy(cls, db: AsyncSession) -> SecurityBadgePolicy:
        """Retrieves the single authoritative active badge policy."""
        return await cls.get_or_create_default_policy(db)

    @classmethod
    async def list_policies(cls, db: AsyncSession) -> List[SecurityBadgePolicy]:
        """Lists all configured badge policies ordered by created_at."""
        stmt = select(SecurityBadgePolicy).order_by(SecurityBadgePolicy.created_at.asc())
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @classmethod
    async def update_policy(
        cls,
        db: AsyncSession,
        policy_id: uuid.UUID,
        updates: BadgePolicyUpdate,
        admin_user_id: uuid.UUID,
        admin_org_id: Optional[uuid.UUID] = None,
    ) -> SecurityBadgePolicy:
        """
        Updates an existing badge policy with strict validation, multi-policy safety,
        and audit logging.
        
        CRITICAL GOVERNANCE RULES:
        - Historical verifications MUST NOT be mutated or recalculated.
        - Future eligibility evaluations will use the updated policy values.
        - At most ONE policy may have is_active == True.
        """
        stmt = select(SecurityBadgePolicy).where(SecurityBadgePolicy.id == policy_id)
        res = await db.execute(stmt)
        policy = res.scalar_one_or_none()

        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "POLICY_NOT_FOUND",
                        "message": f"Security badge policy with ID {policy_id} does not exist.",
                    }
                },
            )

        update_dict = updates.model_dump(exclude_unset=True)

        if not update_dict:
            return policy

        # Defensive runtime validations
        if "minimum_score" in update_dict:
            score = update_dict["minimum_score"]
            if not isinstance(score, int) or score < 0 or score > 100:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={"error": {"code": "INVALID_MINIMUM_SCORE", "message": "minimum_score must be an integer between 0 and 100."}},
                )

        if "maximum_scan_age_days" in update_dict:
            age = update_dict["maximum_scan_age_days"]
            if not isinstance(age, int) or age <= 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={"error": {"code": "INVALID_SCAN_AGE", "message": "maximum_scan_age_days must be a positive integer > 0."}},
                )

        if "verification_validity_days" in update_dict:
            val = update_dict["verification_validity_days"]
            if not isinstance(val, int) or val <= 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={"error": {"code": "INVALID_VALIDITY_DAYS", "message": "verification_validity_days must be a positive integer > 0."}},
                )

        # Multi-policy activation safety (VB-7F)
        if update_dict.get("is_active") is True:
            # Deactivate all other policies
            deact_stmt = (
                update(SecurityBadgePolicy)
                .where(SecurityBadgePolicy.id != policy.id)
                .values(is_active=False)
            )
            await db.execute(deact_stmt)

        # Track changes for audit log
        changes: Dict[str, Dict[str, Any]] = {}
        for key, new_val in update_dict.items():
            old_val = getattr(policy, key)
            if old_val != new_val:
                changes[key] = {"old": old_val, "new": new_val}
                setattr(policy, key, new_val)

        policy.updated_at = datetime.now(timezone.utc)
        await db.flush()

        # Audit log (VB-7G)
        if changes:
            await record_audit_event(
                db=db,
                action="BADGE_POLICY_UPDATED",
                entity_type="SECURITY_BADGE_POLICY",
                organization_id=admin_org_id,
                user_id=admin_user_id,
                entity_id=str(policy.id),
                metadata={
                    "policy_name": policy.name,
                    "changes": changes,
                },
            )

        return policy
