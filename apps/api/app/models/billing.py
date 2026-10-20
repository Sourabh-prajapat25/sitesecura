"""
Scanly API - Subscription & Usage Database Models
"""
import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, ForeignKey, DateTime, Index, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class Subscription(Base, TimestampMixin):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    
    # Provider-independent core fields
    provider: Mapped[str] = mapped_column(String(50), default="stripe", nullable=False)  # "stripe" or "razorpay"
    provider_customer_id: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    provider_subscription_id: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="usd", nullable=False)  # "usd" or "inr"
    billing_interval: Mapped[str] = mapped_column(String(20), default="month", nullable=False)  # "month" or "year"
    amount_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # in smallest unit (cents/paise)

    # Stripe-specific identifiers (backward-compatible)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)

    # Razorpay-specific identifiers
    razorpay_customer_id: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    razorpay_subscription_id: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    razorpay_plan_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    plan: Mapped[str] = mapped_column(String(50), default="free", nullable=False)  # free, basic, pro, agency
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)  # active, trialing, past_due, canceled, unpaid, pending
    current_period_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="subscription")


class UsageRecord(Base, TimestampMixin):
    __tablename__ = "usage_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    period_month: Mapped[str] = mapped_column(String(7), nullable=False)  # Format: "2026-08"
    scans_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    monitored_sites_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pdf_reports_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ai_requests_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        Index("ix_usage_org_period", "organization_id", "period_month", unique=True),
    )


class PaymentTransaction(Base, TimestampMixin):
    """
    Immutable payment and transaction audit ledger.
    Tracks charges, renewals, refunds, and failures independently of gateway dashboards.
    """
    __tablename__ = "payment_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)  # "stripe" or "razorpay"
    provider_payment_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    provider_subscription_id: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    provider_event_id: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # in smallest unit (paise/cents)
    currency: Mapped[str] = mapped_column(String(10), default="inr", nullable=False)  # "inr" or "usd"
    status: Mapped[str] = mapped_column(String(50), default="succeeded", nullable=False)  # "succeeded", "failed", "refunded"
    plan: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    billing_interval: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    error_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    error_description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    refund_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    refund_amount: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

