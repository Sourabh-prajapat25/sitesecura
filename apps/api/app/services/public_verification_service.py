"""
Scanly API - Public Verification Service (VB-4)
Provides strictly data-minimized verification lookups for public consumers.
Guarantees zero internal ID, finding detail, raw score, or infrastructure leakage.
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.verification import SecurityVerification, VerificationStatus
from app.schemas.verification import PublicVerificationResponse

PUBLIC_DISCLAIMER_TEXT = (
    "SiteSecura Verified confirms that this website met defined security configuration "
    "standards at the time of its latest completed assessment. This verification does "
    "not guarantee absolute security, immunity from cyber threats, or absence of "
    "undetected vulnerabilities."
)


def resolve_effective_status(
    verification: Optional[SecurityVerification],
    evaluation_time: Optional[datetime] = None,
) -> str:
    """
    Computes real-time effective status without depending on background expiry jobs.
    - 'revoked' if status is revoked
    - 'expired' if status is verified and expires_at <= evaluation_time
    - 'verified' if status is verified and expires_at > evaluation_time
    - otherwise original record status or 'not_found'
    """
    if not verification:
        return "not_found"

    if verification.status == VerificationStatus.REVOKED.value:
        return "revoked"

    now = evaluation_time or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    if verification.status == VerificationStatus.VERIFIED.value:
        if verification.expires_at:
            exp = verification.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp <= now:
                return "expired"
        return "verified"

    return verification.status


class PublicVerificationService:
    """Public lookup service strictly enforcing data minimization."""

    @classmethod
    async def get_public_verification(
        cls,
        db: AsyncSession,
        public_token: str,
        evaluation_time: Optional[datetime] = None,
    ) -> PublicVerificationResponse:
        """
        Asynchronously retrieves public verification details by token.
        Raises HTTP 404 if token does not exist.
        Exposes strictly minimized fields.
        """
        stmt = (
            select(SecurityVerification)
            .options(selectinload(SecurityVerification.website))
            .where(SecurityVerification.public_token == public_token)
        )
        res = await db.execute(stmt)
        verification = res.scalar_one_or_none()

        if not verification or not verification.website:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "VERIFICATION_NOT_FOUND",
                        "message": "No verification record found for the provided token.",
                    }
                },
            )

        effective_status = resolve_effective_status(verification, evaluation_time=evaluation_time)
        base_app_url = settings.NEXT_PUBLIC_APP_URL.rstrip("/")

        return PublicVerificationResponse(
            domain=verification.website.domain,
            status=effective_status,
            verified_at=verification.verified_at,
            expires_at=verification.expires_at,
            verification_tier="Security Check Verified",
            badge_url=f"{base_app_url}/badges/{public_token}.svg",
            verification_url=f"{base_app_url}/verified/{public_token}",
            disclaimer=PUBLIC_DISCLAIMER_TEXT,
        )

    @classmethod
    def get_public_verification_sync(
        cls,
        db: Session,
        public_token: str,
        evaluation_time: Optional[datetime] = None,
    ) -> PublicVerificationResponse:
        """
        Synchronously retrieves public verification details by token.
        Raises HTTP 404 if token does not exist.
        """
        stmt = (
            select(SecurityVerification)
            .options(selectinload(SecurityVerification.website))
            .where(SecurityVerification.public_token == public_token)
        )
        verification = db.execute(stmt).scalar_one_or_none()

        if not verification or not verification.website:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "VERIFICATION_NOT_FOUND",
                        "message": "No verification record found for the provided token.",
                    }
                },
            )

        effective_status = resolve_effective_status(verification, evaluation_time=evaluation_time)
        base_app_url = settings.NEXT_PUBLIC_APP_URL.rstrip("/")

        return PublicVerificationResponse(
            domain=verification.website.domain,
            status=effective_status,
            verified_at=verification.verified_at,
            expires_at=verification.expires_at,
            verification_tier="Security Check Verified",
            badge_url=f"{base_app_url}/badges/{public_token}.svg",
            verification_url=f"{base_app_url}/verified/{public_token}",
            disclaimer=PUBLIC_DISCLAIMER_TEXT,
        )
