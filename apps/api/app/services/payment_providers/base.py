"""
Scanly API - Payment Provider Abstraction Layer
Defines provider-independent contracts, strongly typed event models,
and factory resolution for multi-gateway billing (Razorpay & Stripe).
"""
import uuid
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.user import Organization, User
from app.models.billing import Subscription

logger = logging.getLogger(__name__)


@dataclass
class CheckoutSessionResult:
    provider: str
    plan: str
    interval: str
    currency: str
    amount: int  # in smallest unit (paise/cents)
    checkout_url: Optional[str] = None  # Hosted checkout URL (Stripe)
    session_id: Optional[str] = None     # Stripe session ID
    subscription_id: Optional[str] = None  # Razorpay subscription ID
    key_id: Optional[str] = None         # Razorpay public key ID
    notes: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NormalizedSubscriptionEvent:
    provider: str
    event_type: str  # e.g., 'subscription_activated', 'subscription_charged', 'payment_failed', 'subscription_cancelled', 'subscription_halted'
    provider_event_id: Optional[str] = None
    organization_id: Optional[uuid.UUID] = None
    provider_customer_id: Optional[str] = None
    provider_subscription_id: Optional[str] = None
    provider_payment_id: Optional[str] = None
    plan: Optional[str] = None
    interval: Optional[str] = None
    currency: Optional[str] = None
    amount: Optional[int] = None
    status: str = "active"  # 'active', 'past_due', 'canceled', 'pending'
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


class PaymentProvider(ABC):
    """Abstract base class establishing required payment gateway capabilities."""

    @abstractmethod
    def get_provider_name(self) -> str:
        """Returns lowercase provider identifier: 'razorpay' or 'stripe'."""
        pass

    @abstractmethod
    def create_checkout_session(
        self,
        organization: Organization,
        user: User,
        plan_name: str,
        interval: str = "month",
        currency: str = "inr",
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
    ) -> CheckoutSessionResult:
        """Initiates a checkout or subscription session at the provider level."""
        pass

    @abstractmethod
    def create_customer_portal_session(
        self,
        organization: Organization,
        return_url: Optional[str] = None,
        subscription: Optional[Subscription] = None,
    ) -> str:
        """Returns URL to manage payment method / subscription."""
        pass

    @abstractmethod
    def cancel_subscription(
        self,
        subscription: Subscription,
        cancel_at_period_end: bool = True,
    ) -> bool:
        """Cancels a subscription at the payment gateway."""
        pass

    @abstractmethod
    def verify_webhook_signature(self, payload: bytes, signature_header: str) -> Dict[str, Any]:
        """Cryptographically verifies incoming webhook signature and returns parsed event payload."""
        pass

    @abstractmethod
    def normalize_webhook_event(self, raw_event: Dict[str, Any], sync_db: Session) -> NormalizedSubscriptionEvent:
        """Normalizes gateway-specific event payload into standard domain representation."""
        pass

    @abstractmethod
    def verify_checkout_signature(self, payment_id: str, subscription_id: str, signature: str) -> bool:
        """Cryptographically verifies checkout completion callback signature (Razorpay)."""
        pass
