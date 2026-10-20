"""
Scanly API - Authoritative Pricing Catalog & Server-Side Plan Resolver
Acts as the single backend source of truth for SiteSecura pricing.
Guarantees the client can never manipulate charge amounts, currency, or gateway plan IDs.
"""
from dataclasses import dataclass
from typing import Dict, Any, Optional, Tuple
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.permissions import normalize_plan_name


SUPPORTED_PLANS = ("free", "basic", "pro", "agency")
SUPPORTED_INTERVALS = ("month", "year")
SUPPORTED_CURRENCIES = ("inr", "usd")


@dataclass(frozen=True)
class PricingDetails:
    plan: str
    interval: str
    currency: str
    amount_subunits: int  # in paise for INR, cents for USD
    display_amount: float
    currency_symbol: str
    savings_percentage: float


def normalize_interval(interval: Optional[str]) -> str:
    """Normalizes billing interval to 'month' or 'year'."""
    if not interval:
        return "month"
    norm = str(interval).strip().lower()
    if norm in ("year", "yearly", "annual", "annually"):
        return "year"
    return "month"


def normalize_currency(currency: Optional[str]) -> str:
    """Normalizes currency code to lowercase ISO ('inr' or 'usd')."""
    if not currency:
        return "inr"  # Default to INR for India-first launch
    norm = str(currency).strip().lower()
    if norm in ("usd", "$"):
        return "usd"
    return "inr"


def resolve_trusted_pricing(plan: str, interval: str = "month", currency: str = "inr") -> PricingDetails:
    """
    Authoritatively resolves trusted charge amounts from server configuration.
    Strictly prevents client-tampered amounts or prices.
    """
    plan_raw = str(plan).strip().lower() if plan else ""
    if plan_raw not in SUPPORTED_PLANS or plan_raw == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "INVALID_PLAN", "message": f"Plan '{plan}' is not a valid subscription plan."}},
        )
    plan_norm = plan_raw
    int_norm = normalize_interval(interval)
    curr_norm = normalize_currency(currency)

    if plan_norm == "free":
        return PricingDetails(
            plan="free",
            interval="forever",
            currency=curr_norm,
            amount_subunits=0,
            display_amount=0.0,
            currency_symbol="₹" if curr_norm == "inr" else "$",
            savings_percentage=0.0,
        )

    if curr_norm == "inr":
        # INR Pricing Catalog (Amounts in Paise: ₹1 = 100 paise)
        if plan_norm == "basic":
            if int_norm == "year":
                amount = settings.PRICE_INR_BASIC_YEARLY  # ₹7,990
                return PricingDetails("basic", "year", "inr", amount, amount / 100, "₹", 16.7)
            else:
                amount = settings.PRICE_INR_BASIC_MONTHLY  # ₹799
                return PricingDetails("basic", "month", "inr", amount, amount / 100, "₹", 0.0)
        elif plan_norm == "pro":
            if int_norm == "year":
                amount = settings.PRICE_INR_PRO_YEARLY  # ₹39,990
                return PricingDetails("pro", "year", "inr", amount, amount / 100, "₹", 16.7)
            else:
                amount = settings.PRICE_INR_PRO_MONTHLY  # ₹3,999
                return PricingDetails("pro", "month", "inr", amount, amount / 100, "₹", 0.0)
        elif plan_norm == "agency":
            if int_norm == "year":
                amount = settings.PRICE_INR_AGENCY_YEARLY  # ₹79,990
                return PricingDetails("agency", "year", "inr", amount, amount / 100, "₹", 16.7)
            else:
                amount = settings.PRICE_INR_AGENCY_MONTHLY  # ₹7,999
                return PricingDetails("agency", "month", "inr", amount, amount / 100, "₹", 0.0)
    else:
        # USD Pricing Catalog (Amounts in Cents: $1 = 100 cents)
        if plan_norm == "basic":
            if int_norm == "year":
                return PricingDetails("basic", "year", "usd", 9000, 90.0, "$", 16.7)
            else:
                return PricingDetails("basic", "month", "usd", 900, 9.0, "$", 0.0)
        elif plan_norm == "pro":
            if int_norm == "year":
                return PricingDetails("pro", "year", "usd", 49000, 490.0, "$", 16.7)
            else:
                return PricingDetails("pro", "month", "usd", 4900, 49.0, "$", 0.0)
        elif plan_norm == "agency":
            if int_norm == "year":
                return PricingDetails("agency", "year", "usd", 99000, 990.0, "$", 16.7)
            else:
                return PricingDetails("agency", "month", "usd", 9900, 99.0, "$", 0.0)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"error": {"code": "PRICING_NOT_CONFIGURED", "message": f"Pricing for {plan_norm} ({int_norm}, {curr_norm}) is not configured."}},
    )


def resolve_provider_plan_id(plan: str, interval: str, currency: str, provider: str) -> str:
    """
    Maps (plan, interval, currency, provider) directly to trusted server-side Gateway Plan IDs.
    The client can NEVER supply or overwrite the provider plan identifier.
    """
    plan_norm = normalize_plan_name(plan)
    int_norm = normalize_interval(interval)
    prov_norm = str(provider).strip().lower()

    if prov_norm == "razorpay":
        # Razorpay Plan ID resolution
        mapping = {
            ("basic", "month"): settings.RAZORPAY_PLAN_BASIC_MONTHLY,
            ("basic", "year"): settings.RAZORPAY_PLAN_BASIC_YEARLY,
            ("pro", "month"): settings.RAZORPAY_PLAN_PRO_MONTHLY,
            ("pro", "year"): settings.RAZORPAY_PLAN_PRO_YEARLY,
            ("agency", "month"): settings.RAZORPAY_PLAN_AGENCY_MONTHLY,
            ("agency", "year"): settings.RAZORPAY_PLAN_AGENCY_YEARLY,
        }
        plan_id = mapping.get((plan_norm, int_norm))
        if not plan_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": {"code": "RAZORPAY_PLAN_NOT_CONFIGURED", "message": f"Razorpay Plan ID not configured for {plan_norm} {int_norm}."}},
            )
        return plan_id

    elif prov_norm == "stripe":
        # Stripe Price ID resolution
        if int_norm == "year":
            price_map = {
                "basic": settings.STRIPE_PRICE_BASIC_YEARLY or settings.STRIPE_BASIC_YEARLY_PRICE_ID,
                "pro": settings.STRIPE_PRICE_PRO_YEARLY or settings.STRIPE_PRO_YEARLY_PRICE_ID,
                "agency": settings.STRIPE_PRICE_AGENCY_YEARLY or settings.STRIPE_AGENCY_YEARLY_PRICE_ID,
            }
        else:
            price_map = {
                "basic": settings.STRIPE_PRICE_BASIC_MONTHLY or settings.STRIPE_BASIC_PRICE_ID,
                "pro": settings.STRIPE_PRICE_PRO_MONTHLY or settings.STRIPE_PRO_PRICE_ID,
                "agency": settings.STRIPE_PRICE_AGENCY_MONTHLY or settings.STRIPE_AGENCY_PRICE_ID,
            }
        price_id = price_map.get(plan_norm)
        if not price_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": {"code": "STRIPE_PRICE_NOT_CONFIGURED", "message": f"Stripe Price ID not configured for {plan_norm} {int_norm}."}},
            )
        return price_id

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"error": {"code": "UNSUPPORTED_PROVIDER", "message": f"Provider '{provider}' is not supported."}},
    )
