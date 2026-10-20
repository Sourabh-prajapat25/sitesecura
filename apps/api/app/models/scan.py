"""
Scanly API - Scan, Check, Recommendation & Report Database Models
"""
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, DateTime, Text, Index, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class Scan(Base, TimestampMixin):
    __tablename__ = "scans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    website_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("websites.id", ondelete="SET NULL"), nullable=True, index=True)
    requested_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    domain: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    target_ip: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="queued", nullable=False, index=True)  # queued, running, completed, failed, cancelled
    scan_type: Mapped[str] = mapped_column(String(50), default="public", nullable=False)  # public, manual, monitoring
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    risk_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    score_breakdown: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    passed_checks_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_checks_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    scan_duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scan_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Relationships
    website: Mapped[Optional["Website"]] = relationship("Website", back_populates="scans")
    checks: Mapped[List["ScanCheck"]] = relationship("ScanCheck", back_populates="scan", cascade="all, delete-orphan", lazy="selectin")
    reports: Mapped[List["Report"]] = relationship("Report", back_populates="scan", cascade="all, delete-orphan", lazy="selectin")
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="scan", cascade="all, delete-orphan", lazy="selectin")
    security_verifications: Mapped[List["SecurityVerification"]] = relationship("SecurityVerification", back_populates="scan", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_scans_domain_created", "normalized_domain", "created_at"),
        Index("ix_scans_status_created", "status", "created_at"),
    )


class ScanCheck(Base, TimestampMixin):
    __tablename__ = "scan_checks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True)
    check_type: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # pass, info, warning, high, critical, unknown, not_applicable
    severity: Mapped[str] = mapped_column(String(50), default="info", nullable=False)
    score_impact: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    why_it_matters: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    how_to_fix: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estimated_fix_minutes: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    documentation_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    technical_details: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    evidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)

    # Relationships
    scan: Mapped["Scan"] = relationship("Scan", back_populates="checks")


class Recommendation(Base, TimestampMixin):
    __tablename__ = "recommendations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    check_type: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    why_it_matters: Mapped[str] = mapped_column(Text, nullable=False)
    how_to_fix: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_fix_minutes: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    documentation_url: Mapped[str] = mapped_column(String(500), nullable=False)
    severity: Mapped[str] = mapped_column(String(50), default="info", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Report(Base, TimestampMixin):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    scan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True)
    website_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("websites.id", ondelete="CASCADE"), nullable=True, index=True)
    report_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    pdf_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationships
    scan: Mapped["Scan"] = relationship("Scan", back_populates="reports")
    website: Mapped[Optional["Website"]] = relationship("Website", back_populates="reports")
