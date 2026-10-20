# SiteSecura — Multi-Gateway Architecture & Razorpay Integration Guide

## 1. Architectural Overview

SiteSecura implements a **provider-independent dual-gateway billing architecture**. It allows the platform to launch in India using **Razorpay** (leveraging recurring e-mandates with fixed INR pricing) while fully maintaining an isolated, backward-compatible **Stripe** integration for global/USD billing.

```
Client (Web / Mobile)
        │
        ▼
POST /api/v1/billing/checkout
        │
        ▼
Provider Abstraction Layer (get_payment_provider)
   ├─── Currency == "inr" / Provider == "razorpay" ──► RazorpayPaymentProvider
   └─── Currency == "usd" / Provider == "stripe"   ──► StripePaymentProvider
        │
        ▼
Payment Gateway Session Generation
        │
        ▼
Client Authorization (Razorpay Checkout.js / Stripe Hosted Checkout)
        │
   ┌────┴───────────────────────────┐
   ▼                                ▼
Callback Verification          Webhook Listener
POST /billing/verify-payment   POST /billing/webhooks/razorpay
   │                                │
   └────────────────┬───────────────┘
                    ▼
          Normalized Event Pipeline
                    │
         Idempotency & Replay Guard (AuditLog)
                    │
     PostgreSQL Subscription & Ledger Update
                    │
           Preserve RBAC Roles
                    │
     Entitlement Engine & Frontend Access
```

---

## 2. Server-Side Single Source of Truth

SiteSecura strictly prevents client-tampered pricing or gateway plan identifiers. The client sends only:
- `plan` (`basic`, `pro`, `agency`)
- `interval` (`month`, `year`)
- `currency` (`inr` or `usd`)

The backend authoritatively resolves amounts and provider plan identifiers from server configuration (`apps/api/app/core/pricing.py`).

### INR Launch Pricing Matrix (Paise: ₹1 = 100 paise)

| Plan | Monthly (INR) | Yearly (INR) | Equivalent Monthly | Savings | Razorpay Plan ID (Env) |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Free** | ₹0 | ₹0 | ₹0 | — | N/A |
| **Basic** | ₹799 (`79900`) | ₹7,990 (`799000`) | ₹665.83 | 16.7% (2 Mo Free) | `RAZORPAY_PLAN_BASIC_MONTHLY` / `YEARLY` |
| **Pro** | ₹3,999 (`399900`) | ₹39,990 (`3999000`) | ₹3,332.50 | 16.7% (2 Mo Free) | `RAZORPAY_PLAN_PRO_MONTHLY` / `YEARLY` |
| **Agency** | ₹7,999 (`799900`) | ₹79,990 (`7999000`) | ₹6,665.83 | 16.7% (2 Mo Free) | `RAZORPAY_PLAN_AGENCY_MONTHLY` / `YEARLY` |

---

## 3. Cryptographic Verification & Webhook Handling

### 3.1 Payment Callback Verification
When Razorpay Checkout JS completes on the frontend, the handler receives:
- `razorpay_payment_id`
- `razorpay_subscription_id`
- `razorpay_signature`

The backend verifies the signature using HMAC-SHA256:
```python
message = f"{payment_id}|{subscription_id}".encode("utf-8")
expected_sig = hmac.new(settings.RAZORPAY_KEY_SECRET.encode("utf-8"), message, hashlib.sha256).hexdigest()
is_valid = hmac.compare_digest(expected_sig, signature)
```
Upon successful verification, the subscription is immediately activated and a ledger record is created in `payment_transactions`.

### 3.2 Webhook Signature & Idempotency
- **Endpoint**: `POST /api/v1/billing/webhooks/razorpay`
- **Header**: `X-Razorpay-Signature`
- **Verification**: HMAC-SHA256 of the raw body payload with `RAZORPAY_WEBHOOK_SECRET`.
- **Replay Protection**: Every event ID is logged in `AuditLog` under action `RAZORPAY_WEBHOOK_PROCESSED`. Duplicate webhooks return `{"status": "ignored", "reason": "duplicate"}`.

### 3.3 Supported Razorpay Webhook Events
1. `subscription.authenticated`: Initial mandate registration.
2. `subscription.activated`: Upgrades organization tier, preserves user RBAC roles.
3. `subscription.charged`: Recurring debit succeeded; records transaction ledger entry.
4. `subscription.halted`: Bank debit failed repeatedly; subscription marked `past_due`.
5. `subscription.cancelled`: Subscription cancelled; downgrades organization to `free`.
6. `payment.failed`: Invoice failure recorded with gateway error description.

---

## 4. In-App Subscription Management & Cancellation

Because Razorpay does not offer an external hosted billing portal, SiteSecura provides full in-app management:
- Route: `/dashboard/billing`
- Users can view renewal dates, currency, and provider details.
- Organization owners/admins can initiate in-app cancellation via `POST /api/v1/billing/cancel`.
- Supports canceling at cycle end (`cancel_at_cycle_end=1`) or immediate downgrade.

---

## 5. Environment Variables & Setup

Add the following to your `.env` or deployment secrets:

```env
# Multi-Gateway Configuration
DEFAULT_PAYMENT_PROVIDER=razorpay
ENABLE_STRIPE=true
ENABLE_RAZORPAY=true

# Razorpay API Credentials
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxx

# Razorpay Plan IDs (Created in Razorpay Dashboard)
RAZORPAY_PLAN_BASIC_MONTHLY=plan_basic_monthly_inr
RAZORPAY_PLAN_BASIC_YEARLY=plan_basic_yearly_inr
RAZORPAY_PLAN_PRO_MONTHLY=plan_pro_monthly_inr
RAZORPAY_PLAN_PRO_YEARLY=plan_pro_yearly_inr
RAZORPAY_PLAN_AGENCY_MONTHLY=plan_agency_monthly_inr
RAZORPAY_PLAN_AGENCY_YEARLY=plan_agency_yearly_inr
```

---

## 6. Celery Reconciliation Worker

A periodic Celery Beat task runs daily at 03:00 UTC (`daily-subscription-reconciler`) to query Razorpay and Stripe APIs directly:
- Detects any silent bank mandate cancellations or halts missed due to network drops.
- Synchronizes status with zero manual intervention.
