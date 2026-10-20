"""
Scanly API - Security Verification & Badge Policy Database Models
"""
import uuid
import secrets
from enum import Enum
from typing import List, Optional, Dict, Any, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, ForeignKey, DateTime, Text, Index, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.website import Website
    from app.models.scan import Scan


def generate_public_token() -> str:
    """
    Generates a cryptographically secure, non-sequential, URL-safe public verification token.
    32 bytes of randomness = 256 bits of entropy encoded as 43 URL-safe chars.
    """
    return secrets.token_urlsafe(32)


class VerificationStatus(str, Enum):
    ELIGIBLE = "eligible"
    VERIFIED = "verified"
    INELIGIBLE = "ineligible"
    EXPIRED = "expired"
    REVOKED = "revoked"


class SecurityBadgePolicy(Base, TimestampMixin):
    __tablename__ = "security_badge_policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), default="default", nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    minimum_score: Mapped[int] = mapped_column(Integer, default=70, nullable=False)
    maximum_scan_age_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    verification_validity_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    disallow_critical_findings: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    disallow_high_findings: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    require_successful_scan: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    require_authorized_website: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    require_monitoring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    verifications: Mapped[List["SecurityVerification"]] = relationship(
        "SecurityVerification", back_populates="policy"
    )


class SecurityVerification(Base, TimestampMixin):
    __tablename__ = "security_verifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    website_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("websites.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    policy_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("security_badge_policies.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(50), default=VerificationStatus.ELIGIBLE.value, nullable=False, index=True)
    public_token: Mapped[str] = mapped_column(String(64), default=generate_public_token, unique=True, index=True, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    risk_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    eligibility_reason: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    monitoring_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    badge_settings: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Relationships
    website: Mapped["Website"] = relationship("Website", back_populates="security_verifications")
    scan: Mapped["Scan"] = relationship("Scan", back_populates="security_verifications")
    policy: Mapped[Optional["SecurityBadgePolicy"]] = relationship("SecurityBadgePolicy", back_populates="verifications")

    __table_args__ = (
        Index("ix_verifications_website_status", "website_id", "status"),
    )
