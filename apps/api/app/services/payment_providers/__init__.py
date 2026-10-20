"""
Scanly API - Payment Providers Factory & Module Exports
Provides runtime provider resolution based on explicit preference, currency, or platform defaults.
"""
from typing import Optional
from fastapi import HTTPException, status

from app.core.config import settings
from app.services.payment_providers.base import (
    PaymentProvider,
    CheckoutSessionResult,
    NormalizedSubscriptionEvent,
)
from app.services.payment_providers.stripe_provider import StripePaymentProvider
from app.services.payment_providers.razorpay_provider import RazorpayPaymentProvider

_stripe_instance: Optional[StripePaymentProvider] = None
_razorpay_instance: Optional[RazorpayPaymentProvider] = None


def get_stripe_provider() -> StripePaymentProvider:
    global _stripe_instance
    if _stripe_instance is None:
        _stripe_instance = StripePaymentProvider()
    return _stripe_instance


def get_razorpay_provider() -> RazorpayPaymentProvider:
    global _razorpay_instance
    if _razorpay_instance is None:
        _razorpay_instance = RazorpayPaymentProvider()
    return _razorpay_instance


def get_payment_provider(
    provider_name: Optional[str] = None,
    currency: Optional[str] = None,
) -> PaymentProvider:
    """
    Resolves the appropriate payment provider instance.
    Resolution priority:
    1. Explicit provider_name if provided ("razorpay" or "stripe").
    2. Currency matching ("inr" -> razorpay, "usd" -> stripe).
    3. Global system default from settings.DEFAULT_PAYMENT_PROVIDER.
    """
    target = None

    if provider_name:
        target = provider_name.strip().lower()
    elif currency:
        c = currency.strip().lower()
        if c == "inr":
            target = "razorpay"
        elif c == "usd":
            target = "stripe"

    if not target:
        target = settings.DEFAULT_PAYMENT_PROVIDER.strip().lower()

    if target == "razorpay":
        if not settings.ENABLE_RAZORPAY and settings.ENABLE_STRIPE:
            return get_stripe_provider()
        return get_razorpay_provider()

    elif target == "stripe":
        if not settings.ENABLE_STRIPE and settings.ENABLE_RAZORPAY:
            return get_razorpay_provider()
        return get_stripe_provider()

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"error": {"code": "UNKNOWN_PAYMENT_PROVIDER", "message": f"Payment provider '{target}' is not supported."}},
    )


__all__ = [
    "PaymentProvider",
    "CheckoutSessionResult",
    "NormalizedSubscriptionEvent",
    "StripePaymentProvider",
    "RazorpayPaymentProvider",
    "get_payment_provider",
    "get_stripe_provider",
    "get_razorpay_provider",
]
