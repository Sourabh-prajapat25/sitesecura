# SiteSecura — Legal & Compliance Content Layer (Part 1) Delivery Report

**Date:** September 30, 2026  
**Status:** Complete & Fully Verified  
**Scope:** Part 1 Legal Pages, Legal Configuration, Registration Consent, Scanner Authorization Checkbox, PDF Disclaimer, and Public Footer Updates.

---

## 1. Executive Summary

Part 1 of the SiteSecura legal and compliance layer has been implemented. Five core legal pages have been developed or updated using the existing SiteSecura design language (clean white/slate backgrounds, dark navy typography, sky/blue accents, subtle borders, rounded cards, and sticky navigation).

All requirements were met strictly at the frontend and presentation layer without any database schema changes, migrations, backend scanner alterations, or changes to authentication and Stripe billing logic.

---

## 2. Routes Created / Updated

| Route | Page Title | Status | Description |
|:---|:---|:---:|:---|
| [`/terms`](file:///d:/Sitesecura/scanly/apps/web/src/app/terms/page.tsx) | Terms of Service | **Updated** | Comprehensive 29-section terms governing automated defensive security assessments, user authorization, no-guarantee disclaimers, score indicators, AI content limitations, prohibited activities, and liability caps. |
| [`/privacy`](file:///d:/Sitesecura/scanly/apps/web/src/app/privacy/page.tsx) | Privacy Policy | **Updated** | 13-section privacy policy detailing data categories collected (account info, domain targets, scan findings, billing status), third-party processors (Firebase, Stripe, Cloudflare), data retention tiers (7d/30d/90d/365d), and user privacy rights. |
| [`/cookies`](file:///d:/Sitesecura/scanly/apps/web/src/app/cookies/page.tsx) | Cookie Policy | **Updated** | 8-section policy explaining essential authentication cookies (Firebase tokens), preference storage, privacy-first aggregate analytics, third-party technologies, and browser management controls. |
| [`/authorized-scanning`](file:///d:/Sitesecura/scanly/apps/web/src/app/authorized-scanning/page.tsx) | Authorized Scanning Policy | **Created** | 8-section policy establishing strict scanning boundaries: authorized targets, prohibited targets (unrelated 3rd parties, internal RFC 1918 IPs, localhost, cloud metadata), defensive scope, and abuse enforcement. Includes prominent mandatory warning callout. |
| [`/refunds`](file:///d:/Sitesecura/scanly/apps/web/src/app/refunds/page.tsx) | Refund & Cancellation Policy | **Created** | 8-section policy explaining self-serve cancellation through dashboard/Stripe portal, access continuation through paid cycle, general non-refundable policy with statutory protection, and billing error resolution. |

---

## 3. Central Legal Configuration & Review Placeholders

A dedicated configuration file was created at [`apps/web/src/lib/legal-config.ts`](file:///d:/Sitesecura/scanly/apps/web/src/lib/legal-config.ts) containing clearly marked legal review placeholders so that no unverified legal facts or corporate entities are invented.

```typescript
export const LEGAL_CONFIG = {
  COMPANY_NAME: "[SiteSecura]",
  ENTITY_DBA: "[SiteSecura PVT Ltd], doing business as SiteSecura",
  BRAND_NAME: "SiteSecura",
  BUSINESS_ADDRESS: "[Indore, Madhya Pradesh]",
  CONTACT_EMAIL: "legal@sitesecura.com",
  CONTACT_EMAIL_PLACEHOLDER: "[legal@sitesecura.com]",
  SECURITY_EMAIL: "security@sitesecura.com",
  SECURITY_EMAIL_PLACEHOLDER: "[security@sitesecura.com]",
  SUPPORT_EMAIL: "support@sitesecura.com",
  EFFECTIVE_DATE: "September 30, 2026",
  LAST_UPDATED: "September 30, 2026",
  JURISDICTION: "[Indore]",
  LIABILITY_PERIOD: "[3/6/12] months",
  LIABILITY_MINIMUM_AMOUNT: "[A SPECIFIED MINIMUM AMOUNT]",
  DISPUTE_RESOLUTION_CLAUSE: "[GOVERNING LAW AND DISPUTE-RESOLUTION TERMS TO BE COMPLETED AFTER LEGAL REVIEW.]",
};
```

---

## 4. Reusable Legal Page Layout (`LegalPageLayout.tsx`)

Created at [`apps/web/src/components/legal/LegalPageLayout.tsx`](file:///d:/Sitesecura/scanly/apps/web/src/components/legal/LegalPageLayout.tsx):
- **Hero Banner**: Small uppercase `LEGAL & TRUST` pill badge, large title, subtitle, and `Last Updated: [configured date]`.
- **Navigation**: Uses the existing sticky [`Navbar`](file:///d:/Sitesecura/scanly/apps/web/src/components/Navbar.tsx) and updated [`Footer`](file:///d:/Sitesecura/scanly/apps/web/src/components/Footer.tsx).
- **Desktop Sidebar**: Sticky `On this page` table of contents with smooth anchor links.
- **Mobile Accordion**: Collapsible dropdown table of contents that does not obstruct the reading experience.
- **Content Container**: Clean white card container with max-width ~900–1000px (`max-w-4xl`), readable typography, comfortable line-height, and numbered sections.
- **Callout System**: Standardized `<LegalCallout>` component supporting `info`, `warning`, and `alert` variants.

---

## 5. Account Registration Consent

Updated [`apps/web/src/app/register/page.tsx`](file:///d:/Sitesecura/scanly/apps/web/src/app/register/page.tsx):
- Added a required checkbox immediately preceding the `Create Account` button.
- **Text:**
  > *"I agree to the SiteSecura [Terms of Service](/terms) and acknowledge the [Privacy Policy](/privacy). I confirm that I am authorized to use SiteSecura and to submit the websites/domains I scan. I understand that SiteSecura provides automated security assessments for informational and defensive purposes and does not guarantee that a website is secure or free from vulnerabilities."*
- **Validation**: Enforced on both standard email submission and Google Sign-Up. Registration is blocked and displays a clear error alert until the box is checked.
- **Persistence**: Minimal safe frontend state enforcement; no database schema or migration required.

---

## 6. Scanner Authorization Checkbox

Updated [`apps/web/src/app/page.tsx`](file:///d:/Sitesecura/scanly/apps/web/src/app/page.tsx):
- Added a required checkbox in the hero website scan form:
  > ☐ **I confirm that I own this target or have explicit authorization from its owner to perform this security assessment.**  
  > *SiteSecura performs defensive, automated checks. Unauthorized scanning is prohibited. [Authorized Scanning Policy](/authorized-scanning)*
- **Enforcement**: Submitting the scan form without ticking the box prevents scan initiation and displays:
  > *"Please confirm that you own or are authorized to scan this target before proceeding."*
- Does not bypass existing backend rate-limiting or SSRF security protections.

---

## 7. PDF Report Disclaimer

Updated [`apps/api/app/services/pdf_service.py`](file:///d:/Sitesecura/scanly/apps/api/app/services/pdf_service.py):
- Added the concise disclaimer to Section 5 (*Methodology & Legal Disclaimer*) of all generated PDF audit reports:
  > **Security Assessment Disclaimer:** This report was automatically generated by SiteSecura based on security checks performed against the specified target at the stated time.  
  > The assessment represents a limited technical security posture assessment and does not constitute a penetration test, vulnerability assessment, security certification, compliance certification, code review, or guarantee of security.  
  > Security conditions may change after the assessment. SiteSecura cannot guarantee that all vulnerabilities, weaknesses, misconfigurations, or security risks have been identified.  
  > Findings and recommendations should be independently reviewed before implementation.  
  > The recipient is responsible for ensuring that they are authorized to assess and use information relating to the target.
- Preserved existing deterministic scoring, white-label branding, findings redaction on Free tier, and PDF layout structure.

---

## 8. Footer Updates

Updated [`apps/web/src/components/Footer.tsx`](file:///d:/Sitesecura/scanly/apps/web/src/components/Footer.tsx):
- Copyright brand updated from legacy `"Scanly Security Inc."` to `"© 2026 SiteSecura. All rights reserved."`
- **Legal & Trust** column updated to include all Part 1 pages while preserving existing Part 2 / operational links:
  - Terms of Service (`/terms`)
  - Privacy Policy (`/privacy`)
  - Cookie Policy (`/cookies`)
  - Authorized Scanning (`/authorized-scanning`)
  - Refund Policy (`/refunds`)
  - Fair Usage Policy (`/fair-usage`)
  - Responsible Disclosure (`/responsible-disclosure`)

---

## 9. SEO & Metadata Verification

All 5 legal routes include clean metadata:
- Standard `robots: { index: true, follow: true }`.
- Descriptive page titles and descriptions aligned with the specification.
- No misleading microdata or schemas.

---

## 10. Verification & Test Suite Results

| Test Layer | Command / Action | Result | Notes |
|:---|:---|:---:|:---|
| **TypeScript Typecheck** | `npx tsc --noEmit` in `apps/web` | **PASS (0 errors)** | 100% type safety across legal pages and layouts. |
| **Next.js Production Build** | `npm run build` in `apps/web` | **PASS (0 errors)** | **50/50 static & dynamic routes compiled successfully**. All 5 legal routes compiled as static (`○`). |
| **Backend Integration Suite** | `pytest tests/test_results_consistency_and_pdf.py -v` | **PASS (15/15)** | Confirmed PDF disclaimer addition does not break report generation, multi-tenant isolation, or scoring. |

---

## 11. Legal Placeholders Requiring Final Company Review

Before final commercial launch, the legal team must review and supply values for the following placeholders in [`apps/web/src/lib/legal-config.ts`](file:///d:/Sitesecura/scanly/apps/web/src/lib/legal-config.ts):

1. `LEGAL_COMPANY_NAME`: Official legal entity name (e.g. registered corporation or LLC).
2. `LEGAL_BUSINESS_ADDRESS`: Registered physical business address.
3. `LEGAL_CONTACT_EMAIL` / `LEGAL_SECURITY_EMAIL`: Official monitoring inboxes.
4. `JURISDICTION`: Governing law state/country for Section 28 of Terms.
5. `LIABILITY_PERIOD`: Multi-month cap duration (`3`, `6`, or `12` months) for Section 24 of Terms.
6. `LIABILITY_MINIMUM_AMOUNT`: Minimum liability monetary cap (e.g., `$100 USD`).
7. `DISPUTE_RESOLUTION_CLAUSE`: Binding arbitration or court venue clause.

---

## 12. Backend Consistency Confirmation

- **Defensive Posture:** All legal documents accurately represent the scanner as a non-intrusive, read-only defensive tool rather than a penetration testing service.
- **Informational Scores:** Documents clearly state that security scores are indicators, not certifications or guarantees.
- **Retention Tiers:** The Privacy Policy reflects the exact production retention schedule: Free (7 days), Basic (30 days), Pro (90 days), Agency (365 days).
- **Payment Processing:** Accurately states that credit cards are handled directly by Stripe and never stored in the application database.
- **Zero Breaking Changes:** Scanner engines, Celery queues, Redis, and database models remain untouched.
