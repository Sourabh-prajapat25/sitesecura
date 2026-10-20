"""
Scanly API - Verified Badge Verification Lifecycle Service (VB-3)
Manages verification issuance, deterministic idempotency, effective status resolution,
badge embed snippet generation, and badge revocation.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.website import Website
from app.models.scan import Scan
from app.models.verification import SecurityVerification, VerificationStatus, generate_public_token
from app.schemas.verification import (
    BadgeEmbedSnippets,
    SecurityVerificationResponse,
    WebsiteBadgeStatusResponse,
    BadgeRevocationResponse,
)
from app.services.badge_eligibility_service import BadgeEligibilityService
from app.services.public_verification_service import resolve_effective_status
from app.services.audit_service import record_audit_event, record_audit_event_sync

logger = logging.getLogger(__name__)


def build_badge_urls(public_token: str) -> Tuple[str, str, BadgeEmbedSnippets]:
    """
    Constructs public verification page URL, dynamic SVG badge URL, and ready-to-use embed snippets.
    """
    base_app_url = settings.NEXT_PUBLIC_APP_URL.rstrip("/")
    verification_url = f"{base_app_url}/verified/{public_token}"
    badge_url = f"{base_app_url}/badges/{public_token}.svg"

    html_snippet = (
        f'<a href="{verification_url}" target="_blank" rel="noopener noreferrer">\n'
        f'  <img src="{badge_url}" alt="SiteSecura Verified" width="200" height="34" />\n'
        f"</a>"
    )
    markdown_snippet = f"[![SiteSecura Verified]({badge_url})]({verification_url})"

    snippets = BadgeEmbedSnippets(
        html=html_snippet,
        markdown=markdown_snippet,
    )
    return verification_url, badge_url, snippets


class BadgeVerificationService:
    """Service handling verified badge lifecycle for authenticated tenants."""

    @classmethod
    async def get_candidate_scan(
        cls,
        db: AsyncSession,
        website: Website,
    ) -> Optional[Scan]:
        """Resolves the most recent completed scan for the given website."""
        if website.last_scan_id:
            stmt = select(Scan).where(Scan.id == website.last_scan_id)
            res = await db.execute(stmt)
            scan = res.scalar_one_or_none()
            if scan and scan.status in ("completed", "done"):
                return scan

        stmt = (
            select(Scan)
            .where(
                Scan.website_id == website.id,
                Scan.status.in_(["completed", "done"]),
            )
            .order_by(Scan.created_at.desc())
            .limit(1)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @classmethod
    async def get_badge_status(
        cls,
        db: AsyncSession,
        website: Website,
        auth_org_id: uuid.UUID,
    ) -> WebsiteBadgeStatusResponse:
        """
        Retrieves the authoritative current badge status for a website,
        including live effective status, URLs, and embed snippets.
        """
        # 1. Look for existing verification record (latest created)
        stmt = (
            select(SecurityVerification)
            .where(SecurityVerification.website_id == website.id)
            .order_by(SecurityVerification.created_at.desc())
            .limit(1)
        )
        res = await db.execute(stmt)
        latest_verification = res.scalar_one_or_none()

        if latest_verification:
            eff_status = resolve_effective_status(latest_verification)
            ver_url, bdg_url, snippets = build_badge_urls(latest_verification.public_token)
            return WebsiteBadgeStatusResponse(
                website_id=website.id,
                domain=website.domain,
                status=eff_status,
                public_token=latest_verification.public_token,
                verified_at=latest_verification.verified_at,
                expires_at=latest_verification.expires_at,
                verification_url=ver_url,
                badge_url=bdg_url,
                embed_snippets=snippets,
                last_scan_id=latest_verification.scan_id,
                score=latest_verification.score,
                risk_level=latest_verification.risk_level,
            )

        # 2. No verification record exists yet: evaluate candidate scan
        candidate_scan = await cls.get_candidate_scan(db, website)
        if not candidate_scan:
            return WebsiteBadgeStatusResponse(
                website_id=website.id,
                domain=website.domain,
                status="not_configured",
                public_token=None,
                verified_at=None,
                expires_at=None,
                verification_url=None,
                badge_url=None,
                embed_snippets=None,
                last_scan_id=None,
                score=None,
                risk_level=None,
            )

        # Evaluate eligibility
        eligibility = await BadgeEligibilityService.evaluate_eligibility(
            db=db,
            website_id=website.id,
            candidate_scan_id=candidate_scan.id,
            auth_organization_id=auth_org_id,
        )
        status_val = "eligible" if eligibility.eligible else "ineligible"

        return WebsiteBadgeStatusResponse(
            website_id=website.id,
            domain=website.domain,
            status=status_val,
            public_token=None,
            verified_at=None,
            expires_at=None,
            verification_url=None,
            badge_url=None,
            embed_snippets=None,
            last_scan_id=candidate_scan.id,
            score=candidate_scan.score,
            risk_level=candidate_scan.risk_level,
        )

    @classmethod
    async def issue_verification(
        cls,
        db: AsyncSession,
        website: Website,
        auth_user_id: uuid.UUID,
        auth_org_id: uuid.UUID,
    ) -> SecurityVerificationResponse:
        """
        Evaluates eligibility, enforces idempotent issuance, persists snapshot,
        records audit event, and returns verification response.
        """
        # 1. Authoritative evaluation
        eligibility = await BadgeEligibilityService.evaluate_eligibility(
            db=db,
            website_id=website.id,
            auth_organization_id=auth_org_id,
        )

        if not eligibility.eligible:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": {
                        "code": "ELIGIBILITY_REQUIREMENTS_NOT_MET",
                        "message": "Website does not satisfy the active Verified Badge eligibility criteria.",
                        "reasons": eligibility.reasons,
                        "checks": eligibility.checks.model_dump(),
                    }
                },
            )

        # 2. Resolve active policy
        policy = await BadgeEligibilityService.get_active_badge_policy(db)
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "error": {
                        "code": "ACTIVE_POLICY_UNAVAILABLE",
                        "message": "No active Verified Badge policy is currently configured.",
                    }
                },
            )

        # 3. Resolve candidate scan
        candidate_scan = None
        if eligibility.scan_id:
            s_stmt = select(Scan).where(Scan.id == eligibility.scan_id)
            s_res = await db.execute(s_stmt)
            candidate_scan = s_res.scalar_one_or_none()

        if not candidate_scan:
            candidate_scan = await cls.get_candidate_scan(db, website)

        if not candidate_scan or candidate_scan.score is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": {
                        "code": "CANDIDATE_SCAN_UNAVAILABLE",
                        "message": "A valid completed candidate scan is required for badge verification.",
                    }
                },
            )

        now = datetime.now(timezone.utc)

        # 4. Check for existing active verification for this scan & policy (Idempotency)
        existing_stmt = (
            select(SecurityVerification)
            .where(
                SecurityVerification.website_id == website.id,
                SecurityVerification.scan_id == candidate_scan.id,
                SecurityVerification.policy_id == policy.id,
                SecurityVerification.status == VerificationStatus.VERIFIED.value,
                SecurityVerification.expires_at > now,
            )
            .order_by(SecurityVerification.created_at.desc())
            .limit(1)
        )
        existing_res = await db.execute(existing_stmt)
        existing_verification = existing_res.scalar_one_or_none()

        if existing_verification:
            ver_url, bdg_url, snippets = build_badge_urls(existing_verification.public_token)
            resp = SecurityVerificationResponse.model_validate(existing_verification)
            resp.verification_url = ver_url
            resp.badge_url = bdg_url
            resp.embed_snippets = snippets
            return resp

        # 5. Create new verification record (with token collision protection & concurrency safety)
        expires_at = now + timedelta(days=policy.verification_validity_days)
        public_token = None
        for _ in range(5):
            candidate_tok = generate_public_token()
            tok_stmt = select(SecurityVerification.id).where(SecurityVerification.public_token == candidate_tok)
            tok_res = await db.execute(tok_stmt)
            if not tok_res.scalar_one_or_none():
                public_token = candidate_tok
                break
        if not public_token:
            public_token = generate_public_token()

        new_verification = SecurityVerification(
            id=uuid.uuid4(),
            website_id=website.id,
            scan_id=candidate_scan.id,
            policy_id=policy.id,
            status=VerificationStatus.VERIFIED.value,
            public_token=public_token,
            score=candidate_scan.score,
            risk_level=candidate_scan.risk_level,
            verified_at=now,
            expires_at=expires_at,
            eligibility_reason={
                "checks": eligibility.checks.model_dump(),
                "reasons": eligibility.reasons,
                "evaluated_at": eligibility.evaluated_at.isoformat(),
                "policy_name": policy.name,
            },
            monitoring_enabled=bool(getattr(website, "monitoring_enabled", False)),
            badge_settings={"style": "standard", "theme": "light"},
        )

        try:
            async with db.begin_nested():
                db.add(new_verification)
                await db.flush()
        except Exception as exc:
            # Handle race condition: check if another concurrent request already created the record
            recheck = await db.execute(existing_stmt)
            existing_v = recheck.scalar_one_or_none()
            if existing_v:
                ver_url, bdg_url, snippets = build_badge_urls(existing_v.public_token)
                resp = SecurityVerificationResponse.model_validate(existing_v)
                resp.verification_url = ver_url
                resp.badge_url = bdg_url
                resp.embed_snippets = snippets
                return resp
            logger.error(f"Failed to persist security verification: {exc}")
            raise

        # 6. Record audit event
        await record_audit_event(
            db=db,
            action="BADGE_VERIFIED",
            entity_type="SECURITY_VERIFICATION",
            organization_id=auth_org_id,
            user_id=auth_user_id,
            entity_id=str(new_verification.id),
            metadata={
                "website_id": str(website.id),
                "domain": website.domain,
                "scan_id": str(candidate_scan.id),
                "public_token": public_token,
                "score": candidate_scan.score,
                "expires_at": expires_at.isoformat(),
            },
        )

        ver_url, bdg_url, snippets = build_badge_urls(new_verification.public_token)
        resp = SecurityVerificationResponse.model_validate(new_verification)
        resp.verification_url = ver_url
        resp.badge_url = bdg_url
        resp.embed_snippets = snippets
        return resp

    @classmethod
    async def revoke_verification(
        cls,
        db: AsyncSession,
        website: Website,
        auth_user_id: uuid.UUID,
        auth_org_id: uuid.UUID,
    ) -> BadgeRevocationResponse:
        """
        Revokes all active verifications for a website, records audit event,
        and returns confirmation response.
        """
        now = datetime.now(timezone.utc)

        # 1. Query active verifications for this website
        stmt = select(SecurityVerification).where(
            SecurityVerification.website_id == website.id,
            SecurityVerification.status == VerificationStatus.VERIFIED.value,
        )
        res = await db.execute(stmt)
        active_verifications = res.scalars().all()

        if not active_verifications:
            # Check if any verification ever existed
            any_stmt = select(SecurityVerification).where(SecurityVerification.website_id == website.id).limit(1)
            any_res = await db.execute(any_stmt)
            if not any_res.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={
                        "error": {
                            "code": "WEBSITE_BADGE_NOT_FOUND",
                            "message": "No verification badge found for this website.",
                        }
                    },
                )
            # Already revoked / expired
            return BadgeRevocationResponse(
                message="Verification badge is already revoked or expired.",
                website_id=website.id,
                status="revoked",
                revoked_at=now,
            )

        # 2. Mark each active verification as revoked
        for v in active_verifications:
            v.status = VerificationStatus.REVOKED.value
            v.updated_at = now

        await db.flush()

        # 3. Record audit event
        await record_audit_event(
            db=db,
            action="BADGE_REVOKED",
            entity_type="SECURITY_VERIFICATION",
            organization_id=auth_org_id,
            user_id=auth_user_id,
            entity_id=str(active_verifications[0].id),
            metadata={
                "website_id": str(website.id),
                "domain": website.domain,
                "revoked_count": len(active_verifications),
            },
        )

        return BadgeRevocationResponse(
            message="Verification badge revoked successfully.",
            website_id=website.id,
            status="revoked",
            revoked_at=now,
        )
