"""
Scanly API - Authentication & User Context Service
Maps Firebase identity to PostgreSQL User, Organization, and Org Memberships with strict idempotency.
"""
import uuid
import logging
from typing import Dict, Any, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from app.core.config import settings
from app.models.user import User, Organization, OrganizationMember
from app.models.billing import Subscription
from app.services.audit_service import record_audit_event

logger = logging.getLogger(__name__)


async def get_or_create_user(db: AsyncSession, token_data: Dict[str, Any]) -> Tuple[User, Organization]:
    """
    Retrieves existing user by firebase_uid (or email fallback) or provisions a new User,
    default personal Organization, owner membership, and active Free subscription.
    Guaranteed idempotent: multiple concurrent or sequential calls never create duplicate entities.
    """
    firebase_uid = token_data.get("uid")
    if not firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "AUTHENTICATION_REQUIRED", "message": "Invalid token: missing uid claim."}},
        )

    email = (token_data.get("email") or f"{firebase_uid}@scanly.io").lower().strip()
    name = (token_data.get("name") or email.split("@")[0]).strip()
    token_role = token_data.get("role", "free")

    # 1. Lookup existing user by firebase_uid
    stmt = select(User).where(User.firebase_uid == firebase_uid)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    # 2. Fallback: Lookup by email if firebase_uid was not yet recorded
    if not user and email:
        stmt_email = select(User).where(User.email == email)
        res_email = await db.execute(stmt_email)
        user = res_email.scalar_one_or_none()
        if user:
            user.firebase_uid = firebase_uid
            if name and not user.name:
                user.name = name
            await db.flush()

    # If existing user found, resolve organization context
    if user:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "ACCOUNT_DISABLED", "message": "This user account has been disabled."}},
            )

        # Update name if provided and changed
        if name and user.name != name and name != email.split("@")[0]:
            user.name = name

        org: Organization | None = None
        if user.organization_id:
            org_stmt = select(Organization).where(Organization.id == user.organization_id)
            org_res = await db.execute(org_stmt)
            org = org_res.scalar_one_or_none()

        if not org:
            # Check if user has membership in any organization
            mem_stmt = select(OrganizationMember).where(OrganizationMember.user_id == user.id)
            mem_res = await db.execute(mem_stmt)
            member = mem_res.scalar_one_or_none()
            if member:
                org_stmt = select(Organization).where(Organization.id == member.organization_id)
                org_res = await db.execute(org_stmt)
                org = org_res.scalar_one_or_none()
                if org:
                    user.organization_id = org.id

        # If user still has no organization, create a personal workspace
        if not org:
            org_id = uuid.uuid4()
            org = Organization(
                id=org_id,
                name=f"{user.name or name}'s Workspace",
                type="personal",
                owner_id=user.id,
            )
            db.add(org)
            user.organization_id = org_id

            member = OrganizationMember(
                organization_id=org_id,
                user_id=user.id,
                role="owner",
            )
            db.add(member)

            sub = Subscription(
                organization_id=org_id,
                stripe_customer_id=f"cust_{user.id.hex[:12]}",
                plan=user.role or "free",
                status="active",
            )
            db.add(sub)

            try:
                # Flush pending models to physical database in FK order
                await db.flush()

                await record_audit_event(
                    db=db,
                    action="ORGANIZATION_CREATED",
                    entity_type="ORGANIZATION",
                    organization_id=org_id,
                    user_id=user.id,
                    entity_id=str(org_id),
                    metadata={"name": org.name, "type": org.type, "owner_email": user.email},
                )

                await db.commit()
                await db.refresh(user)
                await db.refresh(org)
                return user, org
            except IntegrityError:
                await db.rollback()
                # Re-fetch user & org in case of concurrent workspace creation
                stmt = select(User).where(User.id == user.id)
                res = await db.execute(stmt)
                refreshed_user = res.scalar_one_or_none()
                if refreshed_user and refreshed_user.organization_id:
                    org_stmt = select(Organization).where(Organization.id == refreshed_user.organization_id)
                    res_org = await db.execute(org_stmt)
                    refreshed_org = res_org.scalar_one_or_none()
                    if refreshed_org:
                        return refreshed_user, refreshed_org
                raise

        await db.commit()
        await db.refresh(user)
        await db.refresh(org)
        return user, org

    # 3. New User Registration Flow: Create User, Personal Organization, Membership & Subscription
    user_id = uuid.uuid4()
    org_id = uuid.uuid4()

    new_org = Organization(
        id=org_id,
        name=f"{name}'s Workspace",
        type="personal",
        owner_id=user_id,
    )
    db.add(new_org)

    if settings.ENVIRONMENT.lower() in ("production", "prod"):
        role_val = "free"
    else:
        role_val = token_role if token_role in ("free", "basic", "pro", "agency", "admin") else "free"
    new_user = User(
        id=user_id,
        firebase_uid=firebase_uid,
        email=email,
        name=name,
        role=role_val,
        organization_id=org_id,
        is_active=True,
    )
    db.add(new_user)

    member = OrganizationMember(
        organization_id=org_id,
        user_id=user_id,
        role="owner",
    )
    db.add(member)

    sub = Subscription(
        organization_id=org_id,
        stripe_customer_id=f"cust_{user_id.hex[:12]}",
        plan=role_val,
        status="active",
    )
    db.add(sub)

    try:
        # Step A: Flush new organization, user, membership, and subscription
        # so physical rows exist in the DB and satisfy FK constraints before audit logging
        await db.flush()

        # Step B: Record audit event safely inside isolated savepoint
        await record_audit_event(
            db=db,
            action="ORGANIZATION_CREATED",
            entity_type="ORGANIZATION",
            organization_id=org_id,
            user_id=user_id,
            entity_id=str(org_id),
            metadata={"name": new_org.name, "type": new_org.type, "owner_email": email},
        )

        # Step C: Finalize transaction commit
        await db.commit()
        await db.refresh(new_user)
        await db.refresh(new_org)

        logger.info(f"Synchronized new Firebase user '{email}' (UID: {firebase_uid}) with personal org '{new_org.name}'.")
        return new_user, new_org
    except IntegrityError as ie:
        await db.rollback()
        logger.info(f"Concurrent registration detected for {firebase_uid} ({email}): {ie}. Recovering existing record.")
        stmt = select(User).where(User.firebase_uid == firebase_uid)
        res = await db.execute(stmt)
        existing_user = res.scalar_one_or_none()
        if not existing_user and email:
            stmt_email = select(User).where(User.email == email)
            res_email = await db.execute(stmt_email)
            existing_user = res_email.scalar_one_or_none()

        if existing_user:
            org_to_return = None
            if existing_user.organization_id:
                org_stmt = select(Organization).where(Organization.id == existing_user.organization_id)
                res_org = await db.execute(org_stmt)
                org_to_return = res_org.scalar_one_or_none()
            if not org_to_return:
                mem_stmt = select(OrganizationMember).where(OrganizationMember.user_id == existing_user.id)
                mem_res = await db.execute(mem_stmt)
                mem = mem_res.scalar_one_or_none()
                if mem:
                    org_stmt = select(Organization).where(Organization.id == mem.organization_id)
                    res_org = await db.execute(org_stmt)
                    org_to_return = res_org.scalar_one_or_none()
            if org_to_return:
                return existing_user, org_to_return
        raise
