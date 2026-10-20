"""
Scanly API - Website & Monitoring Database Models
"""
import uuid
from typing import List, Optional
from datetime import datetime
from sqlalchemy import String, Boolean, ForeignKey, DateTime, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class Website(Base, TimestampMixin):
    __tablename__ = "websites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    last_scan_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    monitoring_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    monitoring_frequency: Mapped[Optional[str]] = mapped_column(String(50), default="weekly", nullable=True)  # weekly, daily

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="websites")
    scans: Mapped[List["Scan"]] = relationship("Scan", back_populates="website", cascade="all, delete-orphan")
    monitoring: Mapped[Optional["Monitoring"]] = relationship("Monitoring", back_populates="website", uselist=False, cascade="all, delete-orphan", lazy="selectin")
    reports: Mapped[List["Report"]] = relationship("Report", back_populates="website", cascade="all, delete-orphan")
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="website", cascade="all, delete-orphan")
    security_verifications: Mapped[List["SecurityVerification"]] = relationship("SecurityVerification", back_populates="website", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_websites_org_domain", "organization_id", "normalized_domain", unique=True),
    )


class Monitoring(Base, TimestampMixin):
    __tablename__ = "monitoring"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    website_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("websites.id", ondelete="CASCADE"), unique=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    frequency: Mapped[str] = mapped_column(String(50), default="weekly", nullable=False)  # weekly, daily
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)  # active, paused, error
    last_scan_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_success_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_failure_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    @property
    def is_active(self) -> bool:
        return self.enabled

    @is_active.setter
    def is_active(self, value: bool) -> None:
        self.enabled = value

    # Relationships
    website: Mapped["Website"] = relationship("Website", back_populates="monitoring")
    organization: Mapped[Optional["Organization"]] = relationship("Organization")
