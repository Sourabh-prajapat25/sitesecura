"""
Scanly API - Alert & Audit Log Database Models
"""
import uuid
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Text, Index, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class Alert(Base, TimestampMixin):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    website_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("websites.id", ondelete="CASCADE"), nullable=True, index=True)
    scan_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("scans.id", ondelete="SET NULL"), nullable=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # ssl_expiry, score_drop, dns_change, header_change, scan_failure
    severity: Mapped[str] = mapped_column(String(50), default="warning", nullable=False)  # info, warning, high, critical
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="unread", nullable=False)  # unread, read, dismissed
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    fingerprint: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="alerts")
    website: Mapped[Optional["Website"]] = relationship("Website", back_populates="alerts")
    scan: Mapped[Optional["Scan"]] = relationship("Scan", back_populates="alerts")

    __table_args__ = (
        Index("ix_alerts_org_created", "organization_id", "created_at"),
        Index("ix_alerts_org_fingerprint_status", "organization_id", "fingerprint", "status"),
    )


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
