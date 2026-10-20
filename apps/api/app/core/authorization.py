"""
Scanly API - Multi-Tenant Authorization & IDOR/BOLA Guard
Provides structured AuthContext, role enforcement, and tenant-scoped resource loaders.
Guarantees strict 404 isolation strategy across organizations to prevent resource enumeration.
"""
import uuid
from dataclasses import dataclass
from typing import Optional, Dict, Any, List, Callable
from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.security import get_current_user_token, get_optional_user_token
from app.core.permissions import OrgRole, normalize_plan_name
from app.models.user import User, Organization, OrganizationMember
from app.models.website import Website
from app.models.scan import Scan, Report
from app.services.auth_service import get_or_create_user
from app.services.entitlement_service import get_effective_plan
from app.services.audit_service import record_audit_event


@dataclass
class AuthContext:
    user: User
    organization: Organization
    membership: OrganizationMember
    plan: str
    role: str

    @property
    def is_admin(self) -> bool:
        return self.user.role == "admin"

    @property
    def is_owner(self) -> bool:
        return self.role == "owner" or self.is_admin


async def get_current_auth_context(
    token_data: Dict[str, Any] = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
) -> AuthContext:
    """
    FastAPI Dependency: Establishes complete, verified multi-tenant context:
    1. Authenticates Firebase token
    2. Resolves User & Organization
    3. Resolves OrganizationMember role
    4. Authoritatively calculates subscription plan tier
    """
    user, org = await get_or_create_user(db, token_data)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "ACCOUNT_DISABLED", "message": "This user account has been disabled."}},
        )

    # Resolve active membership
    mem_stmt = select(OrganizationMember).where(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == user.id,
    )
    mem_res = await db.execute(mem_stmt)
    membership = mem_res.scalar_one_or_none()

    if not membership:
        # Auto-provision owner membership for organization owner
        membership = OrganizationMember(
            id=uuid.uuid4(),
            organization_id=org.id,
            user_id=user.id,
            role="owner" if org.owner_id == user.id else "member",
        )
        db.add(membership)
        await db.flush()

    # Authoritatively derive effective subscription plan tier
    plan = await get_effective_plan(db, org.id, fallback_role=user.role)

    return AuthContext(
        user=user,
        organization=org,
        membership=membership,
        plan=plan,
        role=membership.role,
    )


async def get_optional_auth_context(
    token_data: Optional[Dict[str, Any]] = Depends(get_optional_user_token),
    db: AsyncSession = Depends(get_db),
) -> Optional[AuthContext]:
    """Optional Auth Context dependency for hybrid public/authenticated routes."""
    if not token_data:
        return None
    try:
        return await get_current_auth_context(token_data=token_data, db=db)
    except HTTPException:
        return None


def require_org_role(allowed_roles: List[str]) -> Callable:
    """Dependency factory checking that active organization role is in allowed_roles."""
    async def role_checker(auth: AuthContext = Depends(get_current_auth_context)) -> AuthContext:
        if auth.is_admin or auth.role in allowed_roles:
            return auth
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "INSUFFICIENT_ROLE_PERMISSIONS",
                    "message": f"This action requires one of the following organization roles: {', '.join(allowed_roles)}.",
                }
            },
        )
    return role_checker


async def require_admin(
    auth: AuthContext = Depends(get_current_auth_context),
) -> AuthContext:
    """
    Dependency checking that the authenticated user possesses the 'admin' system role.
    Raises HTTP 403 Forbidden with ADMIN_ACCESS_REQUIRED error code for non-admin users.
    """
    if not auth.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "ADMIN_ACCESS_REQUIRED",
                    "message": "Platform administrative privileges are required to perform this action.",
                }
            },
        )
    return auth



# =========================================================================
# Multi-Tenant Resource Loaders (Strict 404 Isolation Strategy)
# =========================================================================

async def get_tenant_website(
    website_id: uuid.UUID,
    auth: AuthContext,
    db: AsyncSession,
) -> Website:
    """
    Retrieves website strictly scoped by active organization_id.
    Returns 404 if website does not exist or belongs to another organization.
    """
    stmt = (
        select(Website)
        .where(
            Website.id == website_id,
            Website.organization_id == auth.organization.id,
        )
    )
    res = await db.execute(stmt)
    site = res.scalar_one_or_none()

    if not site:
        # Audit permission denial without leaking existence of foreign tenant's record
        await record_audit_event(
            db=db,
            action="PERMISSION_DENIED",
            entity_type="WEBSITE",
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            entity_id=str(website_id),
            metadata={"reason": "Resource does not exist or belongs to another organization"},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "WEBSITE_NOT_FOUND", "message": f"Website {website_id} not found."}},
        )
    return site


async def get_tenant_scan(
    scan_id: uuid.UUID,
    auth: AuthContext,
    db: AsyncSession,
) -> Scan:
    """
    Retrieves scan strictly scoped by active organization_id.
    Returns 404 if scan does not exist or belongs to another organization.
    """
    stmt = (
        select(Scan)
        .options(selectinload(Scan.checks))
        .where(
            Scan.id == scan_id,
            Scan.organization_id == auth.organization.id,
        )
    )
    res = await db.execute(stmt)
    scan = res.scalar_one_or_none()

    if not scan:
        await record_audit_event(
            db=db,
            action="PERMISSION_DENIED",
            entity_type="SCAN",
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            entity_id=str(scan_id),
            metadata={"reason": "Resource does not exist or belongs to another organization"},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SCAN_NOT_FOUND", "message": f"Scan {scan_id} not found."}},
        )
    return scan


async def get_tenant_report(
    scan_id: uuid.UUID,
    auth: AuthContext,
    db: AsyncSession,
) -> Report:
    """
    Retrieves report by scan_id, strictly scoped by active organization_id.
    Returns 404 if report does not exist or belongs to another organization.
    """
    stmt = (
        select(Report)
        .where(
            Report.scan_id == scan_id,
            Report.organization_id == auth.organization.id,
        )
    )
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()

    if not report:
        await record_audit_event(
            db=db,
            action="PERMISSION_DENIED",
            entity_type="REPORT",
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            entity_id=str(scan_id),
            metadata={"reason": "Report does not exist or belongs to another organization"},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "REPORT_NOT_FOUND", "message": f"Report for scan {scan_id} not found."}},
        )
    return report
