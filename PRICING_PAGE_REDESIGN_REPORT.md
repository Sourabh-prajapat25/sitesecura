# SiteSecura Complete Pricing Page Redesign & Stripe Integration Report

**Date:** October 1, 2026  
**Project:** SiteSecura SaaS Platform  
**Scope:** Production-Ready `/pricing` Page Redesign, Monthly & Yearly Billing, Stripe Integration, Entitlement Consistency Audit  
**Status:** Complete & Fully Verified  

---

## 1. Summary of Changes
- **Complete `/pricing` Redesign**: Redesigned the `/pricing` route from an 83-line placeholder into a full-scale, conversion-focused cybersecurity SaaS pricing experience.
- **Architectural Separation for SEO**: Built `apps/web/src/app/pricing/page.tsx` as a Server Component providing metadata, canonical links, OpenGraph tags, and JSON-LD structured data (`SoftwareApplication` with `AggregateOffer` and `FAQPage`). Interactive elements are encapsulated in the client component `apps/web/src/components/pricing/PricingContent.tsx`.
- **Monthly & Yearly Billing Toggle**: Added a centered segmented control with real-time price switching without layout shifts. Annual billing calculates an upfront yearly price reflecting **2 months free (16.7% annual discount)**:
  - Basic: ~~$19~~ **$9/month** (Annual: **$90/year**, equivalent to $7.50/month, save $18/year)
  - Pro: ~~$69~~ **$49/month** (Annual: **$490/year**, equivalent to ~$40.83/month, save $98/year)
  - Agency: ~~$129~~ **$99/month** (Annual: **$990/year**, equivalent to $82.50/month, save $198/year)
  - Free: $0 forever (no annual billing)
- **Promotional Offer Banner**: Added a top launch banner above the hero featuring coupon code **`SITESECURA20`** (20% off first eligible billing period), one-click copy feedback, dismiss state, and an "Explore Plans" jump link.
- **Four Standardized Pricing Cards**: Standardized card layout across Free, Basic, Pro, and Agency with website and scan quotas, differentiating features, audience labels, and contextual CTA behavior (unauthenticated -> registration with preselected plan/interval, authenticated -> direct Stripe checkout initiation or "Current Plan" lock).
- **Trust & Value Proposition Strip**: Added a compact 5-pillar security guarantee strip (Clear Findings, Practical Remediation, Transparent Limits, Secure Stripe Payments, Self-Service Portal).
- **Comprehensive Plan Comparison Matrix**: Implemented an extensive, categorized comparison table spanning 25+ parameters across 5 groups (Core Usage & Limits, Defensive Security Scanning, Automated Monitoring & Alerts, Reporting & White-Labeling, Agency & Collaboration) with responsive horizontal scrolling and interactive feature explanation tooltips.
- **Plan Differences & Persona Section**: Added visual persona breakdowns for Free, Basic, Pro, and Agency highlighting optimal use cases.
- **Security, Billing & Transparency Section**: Added a 5-card transparency section detailing payment security (no raw card storage), usage limits, and subscription management.
- **12 Canonical Pricing FAQs**: Implemented accessible accordions answering all 12 key commercial, scanning, refund, and downgrade questions with direct link to `/refunds`.
- **Final Conversion CTA**: Added a closing conversion block directing users to the free scanner or back to the comparison table.
- **Backend Stripe & Checkout Support**:
  - Extended `apps/api/app/core/config.py` with yearly price ID defaults and standard environment variable overrides (`STRIPE_PRICE_BASIC_MONTHLY`, `STRIPE_PRICE_BASIC_YEARLY`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_AGENCY_MONTHLY`, `STRIPE_PRICE_AGENCY_YEARLY`).
  - Updated `CreateCheckoutRequest` schema in `apps/api/app/schemas/shared.py` to validate both `"month"`, `"year"`, `"monthly"`, and `"yearly"`.
  - Updated `create_checkout_session` in `apps/api/app/services/billing_service.py` to route to yearly price IDs when annual billing is requested, pass `allow_promotion_codes=True` to Stripe, and embed the interval in metadata.
- **Automated Regression Tests**: Added unit tests in `tests/test_api_endpoints.py` verifying monthly checkout, yearly checkout, invalid plan rejection (422), and invalid interval rejection (422).

---

## 2. Files Created
1. `apps/web/src/components/pricing/PricingContent.tsx`
   - Interactive client component containing promotional banner, hero, billing toggle, 4 pricing cards, trust strip, comparison table with tooltips, persona differences, transparency section, accessible FAQ accordions, and checkout handler.

---

## 3. Files Modified
1. `apps/web/src/app/pricing/page.tsx`
   - Converted to Server Component with rich SEO metadata, OpenGraph, Twitter cards, JSON-LD structured data (`SoftwareApplication`, `AggregateOffer`, `FAQPage`), and embedded `PricingContent`.
2. `apps/web/src/lib/constants.ts`
   - Extended `PRICING_PLANS` with reference prices, monthly prices, yearly totals, equivalent monthly costs, savings amounts, audiences, quotas, and backward-compatible fields.
   - Added `PRICING_COMPARISON_CATEGORIES`, `PLAN_DIFFERENCES`, `SECURITY_TRANSPARENCY_ITEMS`, and `PRICING_PAGE_FAQS`.
3. `apps/api/app/core/config.py`
   - Added yearly Stripe price IDs and standard environment variable overrides.
4. `apps/api/app/schemas/shared.py`
   - Updated `CreateCheckoutRequest.interval` validation pattern to accept `^(month|year|monthly|yearly)$`.
5. `apps/api/app/services/billing_service.py`
   - Updated `create_checkout_session` to select correct price IDs based on interval, enable `allow_promotion_codes=True`, and include interval in metadata and development mock URLs.
6. `tests/test_api_endpoints.py`
   - Added `test_create_checkout_monthly_and_yearly` testing monthly, yearly, invalid plan, and invalid interval handling.

---

## 4. Components Reused
- `apps/web/src/components/Navbar.tsx`: Global sticky header and navigation.
- `apps/web/src/components/Footer.tsx`: Global footer with verified legal links (`/terms`, `/privacy`, `/cookies`, `/authorized-scanning`, `/refunds`).
- `apps/web/src/components/auth/AuthProvider.tsx`: `useAuth()` hook for user state and plan detection.
- `apps/web/src/lib/api.ts`: `api.createCheckoutSession` for initiating Stripe checkouts.
- Lucide React icons: `Check`, `CheckCircle2`, `X`, `Shield`, `ShieldCheck`, `ArrowRight`, `Sparkles`, `Copy`, `ChevronDown`, `Info`, `Lock`, `RefreshCw`, `HelpCircle`, `Zap`, `Users`, `FileText`, `Layers`, `CreditCard`.

---

## 5. Pricing and Annual Billing Configuration

| Plan | Reference Regular Price | Actual Monthly Price | Actual Annual Payment | Effective Monthly Equivalent | Annual Savings | Quotas (Sites / Scans) |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Free** | $0 | **$0** | N/A | $0 | $0 | 1 website / 10 scans |
| **Basic** | ~~$19~~ | **$9/month** | **$90/year** | $7.50/month | $18/year (16.7%) | 2 websites / 100 scans |
| **Pro** | ~~$69~~ | **$49/month** | **$490/year** | $40.83/month | $98/year (16.7%) | 10 websites / 500 scans |
| **Agency** | ~~$129~~ | **$99/month** | **$990/year** | $82.50/month | $198/year (16.7%) | 100 websites / 3,000 scans |

---

## 6. Stripe Integration Details
- **Checkout Session API**:
  - Request: `POST /api/v1/billing/checkout` with `{ "plan": "pro", "interval": "year" }`.
  - Backend maps plan + interval to configured price IDs:
    - Monthly: `STRIPE_PRICE_BASIC_MONTHLY`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_AGENCY_MONTHLY`
    - Yearly: `STRIPE_PRICE_BASIC_YEARLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_AGENCY_YEARLY`
  - In development (when `STRIPE_SECRET_KEY` is not provided), generates a simulated session URL:
    `/dashboard/billing?session_id=cs_mock_...&status=success&mock_plan=pro&mock_interval=year`
  - In production / live test mode (when `STRIPE_SECRET_KEY` is set), invokes `stripe.checkout.Session.create(...)` with:
    - `mode="subscription"`
    - `line_items=[{"price": price_id, "quantity": 1}]`
    - `allow_promotion_codes=True` (activates Stripe's native promo code redemption UI)
    - `metadata={"organization_id": "...", "plan": plan_name, "interval": interval, "user_id": "..."}`
- **Webhooks**:
  - `checkout.session.completed`: Idempotently creates or updates `Subscription`, links `stripe_customer_id` and `stripe_subscription_id`, upgrades user role, and logs an audit log event.
  - `customer.subscription.updated` / `customer.subscription.deleted`: Synchronizes status, handles cancellations by downgrading to `free`.
- **Customer Portal**:
  - `POST /api/v1/billing/portal` invokes `stripe.billing_portal.Session.create(...)` for self-service payment method updates, invoice history, and cancellation.

---

## 7. Promotion Code Status
- **Code**: `SITESECURA20` (20% off first eligible billing period).
- **Client Side**: Displayed in the launch announcement banner with one-click copy and instant visual feedback ("Copied!").
- **Stripe Side**: Checkout sessions are created with `allow_promotion_codes=True`. To enable users to redeem `SITESECURA20` during checkout in Stripe, the promo code must be created in the Stripe Dashboard under **Product catalog → Coupons / Promotion codes** with:
  - Code: `SITESECURA20`
  - Percent off: `20%`
  - Duration: `once` (or `repeating` as desired by business policy).

---

## 8. Entitlement Mismatches Identified
We audited `apps/api/app/core/permissions.py` (`PLAN_CAPABILITIES`), `apps/web/src/lib/entitlements.ts`, and database models against the advertised pricing page features:
1. **Websites and Monthly Scans**:
   - Free: 1 site / 10 scans (Backend: 1 / 10) — **Exact Match**
   - Basic: 2 sites / 100 scans (Backend: 2 / 100) — **Exact Match**
   - Pro: 10 sites / 500 scans (Backend: 10 / 500) — **Exact Match**
   - Agency: 100 sites / 3,000 scans (Backend: 100 / 3,000) — **Exact Match**
2. **Monitoring Frequency**:
   - Free: None (Backend: `monitoring_allowed: False`) — **Exact Match**
   - Basic: Weekly (Backend: `weekly`) — **Exact Match**
   - Pro: Daily (Backend: `daily`) — **Exact Match**
   - Agency: Daily (Backend: `daily`) — **Exact Match**
3. **Scan Retention**:
   - Free: 7 days | Basic: 30 days | Pro: 90 days | Agency: 365 days — **Exact Match**
4. **Team Seats**:
   - Free: 1 | Basic: 1 | Pro: 3 | Agency: 15 — **Exact Match**
5. **Deep Scan F1-F8**:
   - Pro: up to 50 pages | Agency: up to 100 pages — **Exact Match**
6. **White-Labeling**:
   - Agency only (`white_label: True`) — **Exact Match**

**Result:** Zero entitlement discrepancies. Advertised limits accurately reflect backend permission gates.

---

## 9. Features Advertised But Not Yet Implemented (Honest Transparency)
- **Client Portals / Separate Sub-dashboards**: Advertised in the comparison table as "Client grouping & portfolio folders" (organizing client websites in the dashboard), but SiteSecura does not currently offer isolated client login sub-dashboards. This is accurately clarified in the comparison table tooltip and FAQs.
- **Automated Fix Execution**: The comparison table and FAQs explicitly state that SiteSecura provides plain-English remediation guides and AI-assisted fix plans, but does not modify third-party web servers directly.
- **Intrusive Penetration Testing**: Explicitly disclaimed in FAQ #12 and FAQ #5: SiteSecura is strictly passive and defensive.

---

## 10. Tests Actually Executed
1. **Frontend Type Check**:
   ```bash
   cd apps/web && npx tsc --noEmit
   ```
2. **Next.js Production Build**:
   ```bash
   cd apps/web && npm run build
   ```
3. **Backend API & Checkout Suite**:
   ```bash
   pytest tests/test_api_endpoints.py -v
   ```
4. **Backend Results Consistency, Entitlements & PDF Suite**:
   ```bash
   pytest tests/test_results_consistency_and_pdf.py -v
   ```

---

## 11. Actual Test Results
- **TypeScript `npx tsc --noEmit`**: **Passed** with **0 errors**.
- **Next.js `npm run build`**: **Passed** with exit code 0.
  - Route `/pricing`: **7.33 kB (158 kB First Load JS)**, statically prerendered as static content (`○`).
  - Total routes compiled: **53/53**.
- **`pytest tests/test_api_endpoints.py`**: **8/8 passed** in 8.25s.
  - `test_health_endpoints` PASSED
  - `test_celery_task_registration` PASSED
  - `test_invalid_domain_rejected` PASSED
  - `test_create_scan_and_response_serialization` PASSED
  - `test_authenticated_endpoints_require_token` PASSED
  - `test_auth_me_with_dev_token` PASSED
  - `test_rbac_feature_gating` PASSED
  - `test_create_checkout_monthly_and_yearly` PASSED (verifies monthly mock checkout, yearly mock checkout, invalid plan 422, invalid interval 422).
- **`pytest tests/test_results_consistency_and_pdf.py`**: **15/15 passed** in 39.37s.
  - All 15 tests covering report snapshot metrics, PDF auth, tenant isolation, and viewer entitlement contracts passed.

---

## 12. Known Limitations
- When running in local development mode without real Stripe API credentials in `.env`, the backend generates simulated checkout URLs (`mock_session_id`). This permits seamless end-to-end development testing without requiring live Stripe keys.
- On mobile viewports under 400px, the 5-column comparison table is horizontally scrollable with clear affordances to ensure all feature text remains legible without truncation.

---

## 13. Required Manual Stripe Dashboard Configuration
When transitioning from development to live Stripe billing:
1. In the Stripe Dashboard (**Products**), create 3 Products:
   - **SiteSecura Basic**
   - **SiteSecura Pro**
   - **SiteSecura Agency**
2. For each Product, create two Recurring Prices:
   - Basic:
     - Monthly: `$9.00 USD / month`
     - Yearly: `$90.00 USD / year`
   - Pro:
     - Monthly: `$49.00 USD / month`
     - Yearly: `$490.00 USD / year`
   - Agency:
     - Monthly: `$99.00 USD / month`
     - Yearly: `$990.00 USD / year`
3. Add the resulting Price IDs to `apps/api/.env`:
   ```env
   STRIPE_PRICE_BASIC_MONTHLY=price_xxxx
   STRIPE_PRICE_BASIC_YEARLY=price_xxxx
   STRIPE_PRICE_PRO_MONTHLY=price_xxxx
   STRIPE_PRICE_PRO_YEARLY=price_xxxx
   STRIPE_PRICE_AGENCY_MONTHLY=price_xxxx
   STRIPE_PRICE_AGENCY_YEARLY=price_xxxx
   ```
4. Create the Coupon / Promotion Code:
   - Under **Product catalog → Coupons**, create coupon `SITESECURA20` with 20% discount.
5. In **Settings → Customer Portal**, enable invoice downloads, payment method updates, and plan switching.

---

## 14. Suggested Next Steps
- Verify webhook endpoint URL (`https://your-domain.com/api/v1/billing/webhooks/stripe`) in the Stripe Dashboard with events `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`.
- Monitor conversion rates and toggle engagement between monthly and annual plans on the redesigned `/pricing` route.
