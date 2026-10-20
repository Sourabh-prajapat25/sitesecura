"""
Scanly API - Agency & Team Management Endpoints
"""
import os
import glob
import uuid
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.authorization import AuthContext, get_current_auth_context
from app.core.permissions import require_feature, get_plan_config
from app.models.user import User, Organization, OrganizationMember
from app.schemas.shared import (
    TeamInviteRequest,
    TeamMemberResponse,
    WhiteLabelSettingsUpdate,
    OrganizationResponse,
)
from app.services.audit_service import record_audit_event

router = APIRouter(prefix="/agency", tags=["Agency & Teams"])


@router.get("/members", response_model=List[TeamMemberResponse])
async def list_team_members(
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Lists team members in the user's organization."""
    require_feature(auth.plan, "team_members_allowed")

    stmt = (
        select(OrganizationMember, User)
        .join(User, User.id == OrganizationMember.user_id)
        .where(OrganizationMember.organization_id == auth.organization.id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    resp: List[TeamMemberResponse] = []
    for member, u in rows:
        resp.append(
            TeamMemberResponse(
                id=member.id,
                user_id=u.id,
                email=u.email,
                name=u.name,
                role=member.role,
                created_at=member.created_at,
            )
        )
    return resp


@router.post("/invite", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
async def invite_team_member(
    invite_in: TeamInviteRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Invites a new member to the organization (restricted to owners and admins)."""
    if auth.role not in ("owner", "admin") and not auth.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Only organization owners and admins can invite team members."}},
        )

    require_feature(auth.plan, "team_members_allowed")

    # Check team members limit
    plan_cfg = get_plan_config(auth.plan)
    max_members = plan_cfg.get("max_team_members", 0)

    count_res = await db.execute(
        select(OrganizationMember).where(OrganizationMember.organization_id == auth.organization.id)
    )
    current_members_count = len(count_res.scalars().all())
    # Owner counts as 1, so additional invites must not exceed max_members + 1
    if current_members_count > max_members:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "TEAM_LIMIT_REACHED", "message": f"Team member limit ({max_members}) reached for plan '{auth.plan}'."}},
        )

    # Find or provision user placeholder
    u_stmt = select(User).where(User.email == invite_in.email)
    u_res = await db.execute(u_stmt)
    invited_user = u_res.scalar_one_or_none()

    if not invited_user:
        invited_user = User(
            id=uuid.uuid4(),
            firebase_uid=f"invited_{uuid.uuid4().hex[:12]}",
            email=invite_in.email,
            name=invite_in.email.split("@")[0],
            role=auth.plan,
            organization_id=auth.organization.id,
        )
        db.add(invited_user)
        await db.flush()

    # Check if already member
    m_stmt = select(OrganizationMember).where(
        OrganizationMember.organization_id == auth.organization.id,
        OrganizationMember.user_id == invited_user.id,
    )
    m_res = await db.execute(m_stmt)
    if m_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member of this team.")

    new_member = OrganizationMember(
        id=uuid.uuid4(),
        organization_id=auth.organization.id,
        user_id=invited_user.id,
        role=invite_in.role,
    )
    db.add(new_member)

    await record_audit_event(
        db=db,
        action="MEMBER_ADDED",
        entity_type="ORGANIZATION_MEMBER",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=str(new_member.id),
        metadata={"invited_email": invite_in.email, "role": invite_in.role},
    )

    await db.commit()

    return TeamMemberResponse(
        id=new_member.id,
        user_id=invited_user.id,
        email=invited_user.email,
        name=invited_user.name,
        role=new_member.role,
        created_at=new_member.created_at,
    )


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_team_member(
    member_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Removes a member from the organization (restricted to owners and admins)."""
    if auth.role not in ("owner", "admin") and not auth.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Only organization owners and admins can remove team members."}},
        )

    stmt = select(OrganizationMember).where(
        OrganizationMember.id == member_id,
        OrganizationMember.organization_id == auth.organization.id,
    )
    res = await db.execute(stmt)
    member = res.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found.")

    if member.user_id == auth.organization.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove organization owner.")

    await record_audit_event(
        db=db,
        action="MEMBER_REMOVED",
        entity_type="ORGANIZATION_MEMBER",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=str(member.id),
        metadata={"removed_user_id": str(member.user_id), "role": member.role},
    )

    await db.delete(member)
    await db.commit()
    return None


@router.patch("/members/{member_id}/role", response_model=TeamMemberResponse)
async def change_member_role(
    member_id: uuid.UUID,
    role_in: Dict[str, str],
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Updates a team member's role within the organization."""
    if auth.role not in ("owner", "admin") and not auth.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Only organization owners and admins can change member roles."}},
        )

    new_role = role_in.get("role")
    if new_role not in ("admin", "member", "viewer"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role specified.")

    stmt = (
        select(OrganizationMember, User)
        .join(User, User.id == OrganizationMember.user_id)
        .where(
            OrganizationMember.id == member_id,
            OrganizationMember.organization_id == auth.organization.id,
        )
    )
    res = await db.execute(stmt)
    row = res.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found.")

    member, u = row
    old_role = member.role
    member.role = new_role

    await record_audit_event(
        db=db,
        action="ROLE_CHANGED",
        entity_type="ORGANIZATION_MEMBER",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=str(member.id),
        metadata={"target_user_id": str(member.user_id), "old_role": old_role, "new_role": new_role},
    )

    await db.commit()
    return TeamMemberResponse(
        id=member.id,
        user_id=u.id,
        email=u.email,
        name=u.name,
        role=member.role,
        created_at=member.created_at,
    )


@router.get("/white-label", response_model=OrganizationResponse)
async def get_white_label_settings(
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves custom branding & white-label settings."""
    return OrganizationResponse.model_validate(auth.organization)


@router.patch("/white-label", response_model=OrganizationResponse)
async def update_white_label_settings(
    settings_in: WhiteLabelSettingsUpdate,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Updates custom agency branding for PDF reports and dashboard (Agency Plan)."""
    if auth.role not in ("owner", "admin") and not auth.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Only organization owners and admins can update branding."}},
        )

    require_feature(auth.plan, "white_label")

    org = auth.organization
    if settings_in.brand_name is not None:
        org.brand_name = settings_in.brand_name
    if settings_in.logo_url is not None:
        org.logo_url = settings_in.logo_url
    if settings_in.primary_color is not None:
        org.primary_color = settings_in.primary_color
    if settings_in.footer_text is not None:
        org.footer_text = settings_in.footer_text

    await record_audit_event(
        db=db,
        action="BRANDING_UPDATED",
        entity_type="ORGANIZATION",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=str(org.id),
        metadata={"brand_name": org.brand_name},
    )

    await db.commit()
    await db.refresh(org)
    return OrganizationResponse.model_validate(org)


MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2 MB


def _get_branding_dir(org_id: uuid.UUID) -> str:
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..", "storage", "branding", str(org_id)))
    os.makedirs(base_dir, exist_ok=True)
    return base_dir


def _validate_image_bytes(content: bytes, filename: str) -> str:
    """
    Validates that the uploaded content is a legitimate image (PNG, JPEG, WebP, or SVG).
    Returns the normalized extension (e.g. '.png', '.jpg', '.webp', '.svg').
    """
    if len(content) > MAX_LOGO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "FILE_TOO_LARGE", "message": "Logo file size must not exceed 2MB."}},
        )

    # Magic byte checks
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    elif content.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    elif content.startswith(b"RIFF") and b"WEBP" in content[:16]:
        return ".webp"
    elif b"<svg" in content[:512].lower() or b"<?xml" in content[:128].lower():
        if b"<svg" in content.lower():
            return ".svg"

    # Fallback to extension check if magic bytes start with common signatures
    ext = os.path.splitext(filename)[1].lower()
    if ext in (".png", ".jpg", ".jpeg") and (content.startswith(b"\x89PNG") or content.startswith(b"\xff\xd8")):
        return ".jpg" if ext in (".jpg", ".jpeg") else ".png"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"error": {"code": "INVALID_IMAGE_TYPE", "message": "Invalid image format. Supported formats: PNG, JPG/JPEG, WEBP, SVG."}},
    )


@router.post("/white-label/logo", response_model=OrganizationResponse)
async def upload_white_label_logo(
    file: UploadFile = File(...),
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Uploads custom agency branding logo for PDF reports and dashboard (Agency Plan)."""
    if auth.role not in ("owner", "admin") and not auth.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Only organization owners and admins can upload branding logo."}},
        )

    require_feature(auth.plan, "white_label")

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "EMPTY_FILE", "message": "Uploaded file is empty."}},
        )

    ext = _validate_image_bytes(content, file.filename or "")
    branding_dir = _get_branding_dir(auth.organization.id)

    # Remove any existing logo files
    for old_file in glob.glob(os.path.join(branding_dir, "logo.*")):
        try:
            os.remove(old_file)
        except OSError:
            pass

    target_path = os.path.join(branding_dir, f"logo{ext}")
    with open(target_path, "wb") as f:
        f.write(content)

    org = auth.organization
    org.logo_url = f"/api/v1/agency/white-label/logo/{org.id}"

    await record_audit_event(
        db=db,
        action="AGENCY_LOGO_UPLOADED",
        entity_type="ORGANIZATION",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=str(org.id),
        metadata={"filename": file.filename, "file_ext": ext, "file_size": len(content)},
    )

    await db.commit()
    await db.refresh(org)
    return OrganizationResponse.model_validate(org)


@router.delete("/white-label/logo", response_model=OrganizationResponse)
async def delete_white_label_logo(
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Removes custom agency logo (Agency Plan)."""
    if auth.role not in ("owner", "admin") and not auth.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Only organization owners and admins can remove branding logo."}},
        )

    require_feature(auth.plan, "white_label")

    branding_dir = _get_branding_dir(auth.organization.id)
    for old_file in glob.glob(os.path.join(branding_dir, "logo.*")):
        try:
            os.remove(old_file)
        except OSError:
            pass

    org = auth.organization
    org.logo_url = None

    await record_audit_event(
        db=db,
        action="AGENCY_LOGO_DELETED",
        entity_type="ORGANIZATION",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=str(org.id),
        metadata={},
    )

    await db.commit()
    await db.refresh(org)
    return OrganizationResponse.model_validate(org)


@router.get("/white-label/logo/{org_id}")
async def get_white_label_logo(org_id: uuid.UUID):
    """Serves the uploaded custom agency logo."""
    branding_dir = _get_branding_dir(org_id)
    matching_files = glob.glob(os.path.join(branding_dir, "logo.*"))
    if not matching_files:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logo not found.")

    file_path = matching_files[0]
    ext = os.path.splitext(file_path)[1].lower()
    media_type_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
    }
    media_type = media_type_map.get(ext, "application/octet-stream")
    return FileResponse(
        file_path,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )

