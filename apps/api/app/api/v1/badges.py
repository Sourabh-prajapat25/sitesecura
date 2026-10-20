"""
Scanly API - Verified Badge Endpoints (VB-3 & VB-4 & VB-7 & VB-8)
Provides customer badge lifecycle operations (eligibility, issuance, status, revocation)
and public verification endpoints (data-minimized details and dynamic SVG badges).
Hardened with rate limiting, input sanitization, CORS headers, and adaptive cache controls.
"""
import uuid
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, Response, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.rate_limit import check_rate_limit, get_client_ip
from app.core.authorization import (
    AuthContext,
    get_current_auth_context,
    get_tenant_website,
)
from app.schemas.verification import (
    BadgeEligibilityResult,
    SecurityVerificationResponse,
    WebsiteBadgeStatusResponse,
    BadgeRevocationResponse,
    PublicVerificationResponse,
)
from app.services.badge_eligibility_service import BadgeEligibilityService
from app.services.badge_verification_service import BadgeVerificationService
from app.services.public_verification_service import PublicVerificationService
from app.services.badge_renderer_service import render_badge_svg
from app.services.audit_service import record_audit_event

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Verified Badges"])


async def serve_badge_svg_response(
    public_token: str,
    style: str,
    db: AsyncSession,
    request: Optional[Request] = None,
) -> Response:
    """
    Helper to serve the dynamic SVG badge with appropriate cache headers,
    rate limiting, CORS headers, and safe sanitization.
    """
    # 1. Rate limiting on SVG embeds (generous: 300 req/min/IP)
    if request:
        client_ip = get_client_ip(request)
        await check_rate_limit(f"ratelimit:badge_svg:{client_ip}", max_requests=300, window_seconds=60)

    # 2. Token format validation: reject invalid tokens without querying database
    clean_token = (public_token or "").strip()
    if (
        len(clean_token) < 8
        or len(clean_token) > 128
        or not clean_token.replace("-", "").replace("_", "").isalnum()
    ):
        eff_status = "not_found"
    else:
        try:
            ver = await PublicVerificationService.get_public_verification(db, public_token=clean_token)
            eff_status = ver.status
        except Exception:
            eff_status = "not_found"

    # 3. Dynamic SVG generation
    svg_content = render_badge_svg(status=eff_status, style=style)

    # 4. Adaptive Cache-Control (shorter cache for not_found so newly created badges propagate quickly)
    if eff_status in ("verified", "expired", "revoked"):
        cache_control = "public, max-age=300, s-maxage=300, stale-while-revalidate=60"
    else:
        cache_control = "public, max-age=30, s-maxage=30"

    return Response(
        content=svg_content,
        media_type="image/svg+xml",
        headers={
            "Cache-Control": cache_control,
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
            "X-Content-Type-Options": "nosniff",
            "Access-Control-Allow-Origin": "*",
        },
    )


# ============================================================================
# Authenticated Customer Endpoints (VB-3 & VB-7 & VB-8)
# ============================================================================

@router.get(
    "/websites/{website_id}/badge/eligibility",
    response_model=BadgeEligibilityResult,
    summary="Evaluate Website Badge Eligibility",
)
async def get_badge_eligibility(
    website_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Evaluates whether the website satisfies the active Verified Badge policy
    based on its most recent completed security assessment.
    Rate limited to 30 requests per minute per user.
    """
    await check_rate_limit(f"ratelimit:badge_eligibility:{auth.user.id}", max_requests=30, window_seconds=60)

    website = await get_tenant_website(website_id=website_id, auth=auth, db=db)

    result = await BadgeEligibilityService.evaluate_eligibility(
        db=db,
        website_id=website.id,
        auth_organization_id=auth.organization.id,
    )

    await record_audit_event(
        db=db,
        action="BADGE_ELIGIBILITY_CHECKED",
        entity_type="WEBSITE",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=str(website.id),
        metadata={
            "domain": website.domain,
            "eligible": result.eligible,
            "reasons": result.reasons,
        },
    )

    return result


@router.post(
    "/websites/{website_id}/badge/verify",
    response_model=SecurityVerificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Issue or Refresh SiteSecura Verification Badge",
)
async def verify_website_badge(
    website_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Issues a new Verified Badge snapshot if eligible, or returns the existing
    active verification if one already exists for this scan and policy (idempotent).
    Rate limited to 10 requests per minute per user.
    """
    await check_rate_limit(f"ratelimit:badge_verify:{auth.user.id}", max_requests=10, window_seconds=60)

    website = await get_tenant_website(website_id=website_id, auth=auth, db=db)

    verification_resp = await BadgeVerificationService.issue_verification(
        db=db,
        website=website,
        auth_user_id=auth.user.id,
        auth_org_id=auth.organization.id,
    )

    await db.commit()
    return verification_resp


@router.get(
    "/websites/{website_id}/badge",
    response_model=WebsiteBadgeStatusResponse,
    summary="Get Website Badge Status & Embed Codes",
)
async def get_website_badge_status(
    website_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves current verification badge status, public tokens, URLs, and embed snippets.
    """
    website = await get_tenant_website(website_id=website_id, auth=auth, db=db)

    badge_status = await BadgeVerificationService.get_badge_status(
        db=db,
        website=website,
        auth_org_id=auth.organization.id,
    )
    return badge_status


@router.delete(
    "/websites/{website_id}/badge",
    response_model=BadgeRevocationResponse,
    summary="Revoke Website Verification Badge",
)
async def revoke_website_badge(
    website_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Revokes the active SiteSecura Verified badge for the website.
    The dynamic badge SVG will immediately reflect the 'REVOKED' state.
    Rate limited to 10 requests per minute per user.
    """
    await check_rate_limit(f"ratelimit:badge_revoke:{auth.user.id}", max_requests=10, window_seconds=60)

    website = await get_tenant_website(website_id=website_id, auth=auth, db=db)

    revocation_resp = await BadgeVerificationService.revoke_verification(
        db=db,
        website=website,
        auth_user_id=auth.user.id,
        auth_org_id=auth.organization.id,
    )

    await db.commit()
    return revocation_resp


# ============================================================================
# Public Verification Endpoints (VB-4 & VB-8)
# ============================================================================

@router.get(
    "/public/verified/{public_token}",
    response_model=PublicVerificationResponse,
    summary="Public Verification Page Data",
)
async def get_public_verification_data(
    public_token: str,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Public lookup for verification status.
    Strictly data-minimized: reveals domain, status, and verification validity dates.
    Zero internal IDs, scan data, or vulnerability details exposed.
    Rate limited to 60 requests per minute per IP to prevent token brute-forcing.
    """
    clean_token = (public_token or "").strip()
    if (
        len(clean_token) < 8
        or len(clean_token) > 128
        or not clean_token.replace("-", "").replace("_", "").isalnum()
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "VERIFICATION_NOT_FOUND",
                    "message": "No verification record found for the provided token.",
                }
            },
        )

    client_ip = get_client_ip(request)
    await check_rate_limit(f"ratelimit:public_verified:{client_ip}", max_requests=60, window_seconds=60)

    response.headers["Access-Control-Allow-Origin"] = "*"
    return await PublicVerificationService.get_public_verification(
        db=db,
        public_token=clean_token,
    )


@router.get(
    "/public/badges/{public_token}.svg",
    summary="Dynamic SiteSecura Badge SVG",
    response_class=Response,
)
async def get_public_badge_svg(
    public_token: str,
    request: Request,
    style: str = Query("standard", description="Badge style: 'standard' or 'compact'"),
    db: AsyncSession = Depends(get_db),
):
    """
    Publicly serves dynamic vector SVG badge.
    Status automatically transitions between VERIFIED, EXPIRED, REVOKED, and UNVERIFIED.
    """
    return await serve_badge_svg_response(
        public_token=public_token,
        style=style,
        db=db,
        request=request,
    )
