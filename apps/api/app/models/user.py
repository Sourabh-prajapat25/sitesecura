"""
Scanly API - User & Organization Database Models
"""
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, ForeignKey, DateTime, Index, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="personal", nullable=False)  # personal, agency
    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

    # White Labeling Fields (Agency Plan)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    brand_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    primary_color: Mapped[Optional[str]] = mapped_column(String(50), default="#0ea5e9", nullable=True)
    footer_text: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relationships
    members: Mapped[List["OrganizationMember"]] = relationship("OrganizationMember", back_populates="organization", cascade="all, delete-orphan")
    websites: Mapped[List["Website"]] = relationship("Website", back_populates="organization", cascade="all, delete-orphan")
    subscription: Mapped[Optional["Subscription"]] = relationship("Subscription", back_populates="organization", uselist=False)
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="organization", cascade="all, delete-orphan")


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(50), default="free", nullable=False)  # free, basic, pro, agency, admin
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notification_preferences: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True,
        default=lambda: {
            "email_alerts": True,
            "weekly_digest": True,
            "ssl_expiry": True,
            "score_drop": True,
            "critical_finding": True,
        },
    )

    # Relationships
    memberships: Mapped[List["OrganizationMember"]] = relationship("OrganizationMember", back_populates="user", cascade="all, delete-orphan")


class OrganizationMember(Base, TimestampMixin):
    __tablename__ = "organization_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="member", nullable=False)  # owner, admin, member, viewer

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="members")
    user: Mapped["User"] = relationship("User", back_populates="memberships")

    __table_args__ = (
        Index("ix_org_member_org_user", "organization_id", "user_id", unique=True),
    )
