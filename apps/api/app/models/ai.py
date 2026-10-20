"""
Scanly API - AI Generation & Audit Database Models
Tracks LLM invocations, provider fallback paths, token metrics, and generated responses.
"""
import uuid
from typing import Optional, Dict, Any
from sqlalchemy import String, Integer, Boolean, ForeignKey, Text, Index, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class AIGeneration(Base, TimestampMixin):
    __tablename__ = "ai_generations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    website_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("websites.id", ondelete="CASCADE"), nullable=False, index=True)
    scan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, index=True)
    finding_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    feature_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # explain_finding, fix_guide, security_summary, security_plan, chat
    provider: Mapped[str] = mapped_column(String(32), nullable=False)  # groq1, groq2, gemini
    model: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(32), default="v1", nullable=False)
    request_status: Mapped[str] = mapped_column(String(32), default="success", nullable=False)  # success, fallback_success, failed
    response_content: Mapped[str] = mapped_column(Text, nullable=False)
    structured_response: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    tokens_input: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tokens_output: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fallback_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (
        Index("ix_ai_gen_org_created", "organization_id", "created_at"),
        Index("ix_ai_gen_scan_feature", "scan_id", "feature_type"),
        Index("ix_ai_gen_cache_lookup", "organization_id", "scan_id", "finding_id", "feature_type", "prompt_version"),
    )
