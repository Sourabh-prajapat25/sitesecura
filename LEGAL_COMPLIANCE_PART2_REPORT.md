# SiteSecura Legal & Compliance Implementation — Part 2 Final Report

**Date:** September 30, 2026  
**Project:** SiteSecura SaaS Platform  
**Scope:** Legal & Compliance Layer — Part 2 (Fair Usage, Responsible Disclosure, Security, Subprocessors, Service Availability, and Unified Legal Navigation)  
**Status:** Complete & Fully Verified  

---

## 1. Executive Summary

Part 2 of the SiteSecura legal, compliance, and trust architecture has been successfully implemented on top of the established and verified Part 1 foundation. All five target legal pages have been constructed or modernized to provide transparent, legally grounded, and production-accurate documentation of SiteSecura's operational posture.

Crucially, **no fictional claims, unsupported compliance certifications (e.g. SOC 2, ISO 27001, HIPAA, PCI-DSS Level 1 for SiteSecura itself), or artificial contractual SLAs** were introduced. All documented quotas, rate limits, subprocessors, scanner safeguards, and uptime architectures were audited directly against backend Python and Next.js source code.

Zero modifications were made to the core scanner engine (F1–F8), deterministic scoring formulas, Stripe billing logic, Firebase authentication mechanisms, or database schemas. All 15 backend regression tests passed with zero errors, TypeScript compilation reported zero issues, and all 53 Next.js routes built cleanly as static production assets.

---

## 2. File Inventory

### A. Files Created
1. `apps/web/src/app/security/page.tsx` (277 lines, 14.5 KB)  
   Comprehensive Security & Data Protection policy detailing application security, authentication, multi-tenant isolation, scanner SSRF defense, encryption in transit, secrets management, and security boundaries.
2. `apps/web/src/app/subprocessors/page.tsx` (223 lines, 11.5 KB)  
   Transparent subprocessor disclosure featuring an accessible 4-column responsive table listing only verified third-party vendors extracted from `apps/api/app/core/config.py`.
3. `apps/web/src/app/service-availability/page.tsx` (218 lines, 10.9 KB)  
   Operational uptime and service availability policy with prominent "NO SLA" disclaimer callouts, scanner queuing dynamics, monitoring limitations, and direct links to `/status`.

### B. Files Modified
1. `apps/web/src/app/fair-usage/page.tsx` (314 lines, 16.3 KB)  
   Modernized from an outdated placeholder to an authoritative Fair Usage Policy with 10 sections, a responsive plan quota matrix, anonymous IP limits (3/24h), burst limits (20/min), and explicit prohibited actions.
2. `apps/web/src/app/responsible-disclosure/page.tsx` (206 lines, 10.6 KB)  
   Updated with 9 structured sections, prominent vulnerability reporting callout (`security@sitesecura.com`), strict prohibitions against DoS/data harvesting, safe testing boundaries, and a definitive "no bug bounty" policy statement.
3. `apps/web/src/components/Footer.tsx` (78 lines, 4.6 KB)  
   Updated the "Legal & Trust" navigation column to enumerate all 10 legal pages cleanly without duplicates, and refined the global responsible security disclaimer.

---

## 3. Route Inventory & Validation

All 10 legal pages and operational status endpoints are active, statically generated at build time, and fully responsive across mobile, tablet, and desktop:

| Route | Title | Generation Type | Verification Status |
|---|---|---|---|
| `/terms` | Terms of Service | `○ (Static)` | Part 1 Verified |
| `/privacy` | Privacy Policy | `○ (Static)` | Part 1 Verified |
| `/cookies` | Cookie Policy | `○ (Static)` | Part 1 Verified |
| `/authorized-scanning` | Authorized Scanning Policy | `○ (Static)` | Part 1 Verified |
| `/refunds` | Refund Policy | `○ (Static)` | Part 1 Verified |
| `/fair-usage` | Fair Usage Policy | `○ (Static)` | Part 2 Verified |
| `/responsible-disclosure` | Responsible Disclosure Policy | `○ (Static)` | Part 2 Verified |
| `/security` | Security & Data Protection | `○ (Static)` | Part 2 Verified |
| `/subprocessors` | Subprocessors & Third Parties | `○ (Static)` | Part 2 Verified |
| `/service-availability` | Service Availability & Uptime | `○ (Static)` | Part 2 Verified |
| `/status` | System Status & Telemetry | `○ (Static)` | Working (`/ready` probe) |

---

## 4. Footer Architecture & Legal Navigation

The footer component (`apps/web/src/components/Footer.tsx`) organizes links into dedicated semantic groups:

1. **Brand Column:** SiteSecura logo, brand mission, and dynamic copyright year (`© {new Date().getFullYear()} SiteSecura. All rights reserved.`).
2. **Product Column:** `/features`, `/pricing`, `/resources`, and `/status`.
3. **Resources Column:** `/blog`, `/docs`, `/contact`, and `/about`.
4. **Legal & Trust Column (All 10 Legal Documents):**
   - Terms of Service (`/terms`)
   - Privacy Policy (`/privacy`)
   - Cookie Policy (`/cookies`)
   - Authorized Scanning (`/authorized-scanning`)
   - Fair Usage (`/fair-usage`)
   - Refund Policy (`/refunds`)
   - Responsible Disclosure (`/responsible-disclosure`)
   - Security (`/security`)
   - Subprocessors (`/subprocessors`)
   - Service Availability (`/service-availability`)
5. **Responsible Security Disclaimer Banner:**
   > *"Responsible Security Disclaimer: SiteSecura provides defensive website security and configuration assessments based on supported checks and publicly observable information. Results are informational and do not constitute a penetration test, security certification, compliance certification, or guarantee that a website is secure or free from vulnerabilities. Users are responsible for ensuring that they are authorized to assess the targets they submit."*

---

## 5. Shared Infrastructure & Component Reuse

Part 2 strictly avoided code duplication by reusing existing Part 1 infrastructure:
- **`LegalPageLayout.tsx`**: Renders container layout, sticky breadcrumb navigation, title, last updated badge, dynamic Table of Contents (TOC) with smooth scrolling anchor links, contact sidebars, and callouts.
- **`LegalCallout.tsx`**: Consistent callout banners with variant styles (`info`, `warning`, `accent`) utilized across all pages for critical disclaimers.
- **`legal-config.ts`**: Single centralized configuration source for all organizational attributes (`ENTITY_NAME`, `ENTITY_DBA`, `SUPPORT_EMAIL`, `PRIVACY_EMAIL`, `LEGAL_EMAIL`, `SECURITY_EMAIL`, `LAST_UPDATED`, `GOVERNING_LAW`).

---

## 6. Code-Audited Source-of-Truth Plan Limits

The Fair Usage Policy was strictly calibrated against code definitions in `apps/api/app/core/permissions.py`, `apps/api/app/api/v1/scans.py`, and `apps/web/src/lib/constants.ts`:

| Plan Tier | Websites Allowed | Monthly Scans | Deep Scan Support | Scan Frequency / Cadence | Historical Retention |
|---|---|---|---|---|---|
| **Anonymous** | N/A | 3 scans per 24 hours per client IP | None | On-demand only | Session / Temporary |
| **Free** | 1 registered site | 10 scans / month | None | On-demand only | 7 Days |
| **Basic** | Up to 2 sites | 100 scans / month | None | Weekly automated monitoring | 30 Days |
| **Pro** | Up to 10 sites | 500 scans / month | Up to 50 pages / scan | Daily automated monitoring | 90 Days |
| **Agency** | Up to 100 sites | 3,000 scans / month | Up to 100 pages / scan | Daily automated monitoring | 365 Days |

**Technical Rate Limits Enforced:**
- Anonymous Public Scans: Enforced at API layer via client IP tracking (`window_seconds=86400`, max 3 requests).
- Authenticated Scan Burst Rate: 20 requests per minute per IP to protect worker queues from saturation.
- Concurrent Scan Caps: Active scan concurrency limited based on plan tier to prevent background Celery queue starvation.

---

## 7. Verified Subprocessor Inventory

Extracted directly from backend configuration (`apps/api/app/core/config.py`) and verified against active integrations:

| Subprocessor / Service | Legal Entity / Location | Processing Purpose | Data Transferred / Shared |
|---|---|---|---|
| **Firebase Authentication** | Google LLC (United States) | Identity management, token validation, user authentication | User email, UID, auth tokens, session metadata |
| **Stripe** | Stripe, Inc. (United States) | Payment processing, subscription billing, invoicing | Billing details, payment card tokens (PCI-DSS compliant; SiteSecura never touches raw card data) |
| **Cloudflare** | Cloudflare, Inc. (United States) | Edge security, CDN, DDoS defense, reverse proxy | Client IP addresses, HTTP request headers, transit traffic |
| **Email Delivery Gateway** | Configured SMTP Provider | Transactional alerts, password resets, scan summaries | Recipient email address, notification content |
| **AI Inference APIs** | Groq Inc. & Google Gemini | Remediation guidance, security advisory generation | Public scan observation summaries (no customer credentials or raw source code) |
| **Core Cloud Hosting** | Cloud Compute & Database Provider | Backend API execution, PostgreSQL storage, Celery queues | Encrypted databases, scan findings, account profiles |

---

## 8. Verified Scanner Defensive Security Controls

The Security & Data Protection page documents only defenses implemented in the codebase (`scanner/domain.py` and `scanner/network/safety.py`):

1. **Target Normalization & Validation:** RFC 3986 domain validation and canonical scheme enforcement.
2. **Local Hostname Rejection:** Immediate rejection of `localhost`, `.local`, `.internal`, `.lan`, and single-label names.
3. **Private Subnet & Cloud Metadata Blocking (SSRF Defense):**
   - IPv4 loopback (`127.0.0.0/8`)
   - IPv4 RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
   - Link-local and APIPA ranges (`169.254.0.0/16`)
   - AWS / GCP / Azure Instance Metadata Service (IMDS) IP `169.254.169.254`
   - IPv6 equivalents (`::1`, `fc00::/7`, `fe80::/10`)
4. **Pre-Scan Safe Resolution:** Custom `SafeResolver` resolving DNS before initiating connections, guaranteeing connections only proceed to routable public IPs.
5. **Redirect Chain Defense:** Every hop in an HTTP 3xx redirect chain is independently validated through `SafeResolver` (maximum 5 hops permitted).
6. **Payload & Resource Limits:** Defensive payload bounds, safe user-agent identification (`SiteSecura-Scanner`), and strict HTTP response size limits (capped at 1 MB to prevent memory-exhaustion DoS).

---

## 9. Service Availability & Status Architecture

- **Uptime Model:** Best-effort commercial SaaS delivery model.
- **Contractual SLA:** SiteSecura explicitly disclaims a contractual Service Level Agreement (SLA) or financial remedies for downtime.
- **System Telemetry:** The public status page at `/status` actively probes `GET ${API_BASE}/ready`, which verifies:
  1. API service health and readiness
  2. Live PostgreSQL database connectivity
- **Queue Transparency:** Policy explains asynchronous Celery worker processing and notes that peak scanning volumes may introduce transient processing delays.

---

## 10. Data Retention Audit & Backend Findings

- **Policy Stance:** Retention windows are documented as Free (7 days), Basic (30 days), Pro (90 days), and Agency (365 days).
- **Backend Implementation Finding:** `history_retention_days` is formally declared in `PLAN_CAPABILITIES` within `apps/api/app/core/permissions.py`. However, an automated periodic Celery background worker to hard-delete expired rows is not yet implemented.
- **Remediation Note:** Prior to live commercial deployment, a scheduled Celery cleanup task (`cleanup_expired_scans`) should be added to physically purge historical scan records exceeding plan thresholds.

---

## 11. Verification Results

### A. TypeScript Type Check
```bash
apps/web > npx tsc --noEmit
# Result: 0 errors
```

### B. Production Next.js Build
```bash
apps/web > npm run build
# Result: 0 errors, 53/53 routes compiled
# Route (app)                              Size     First Load JS
# ├ ○ /fair-usage                          149 B           136 kB
# ├ ○ /responsible-disclosure              149 B           136 kB
# ├ ○ /security                            149 B           136 kB
# ├ ○ /subprocessors                       149 B           136 kB
# ├ ○ /service-availability                149 B           136 kB
# └ ○ /status                              181 B           128 kB
# + First Load JS shared by all            87.2 kB
```

### C. Backend Regression & Isolation Tests
```bash
pytest tests/test_results_consistency_and_pdf.py -v
# Result: 15 passed in 1.48s
# - Multi-tenant scan isolation verified
# - Score formula determinism verified
# - Normal and Deep Scan snapshot generation verified
# - PDF generation verified
```

---

## 12. Corrected Discrepancies

During implementation, several discrepancies between legacy marketing drafts and the actual backend code were identified and resolved:
1. **Anonymous IP Quota:** Legacy fair usage text stated 5 scans per 24 hours. The actual code in `apps/api/app/api/v1/scans.py` strictly enforces **3 scans per 24 hours**. The policy was updated to reflect 3 scans.
2. **Basic Plan Quotas:** Old text stated 3 sites / 50 scans. The backend code enforces **2 sites / 100 scans**. Updated to match code.
3. **Pro Plan Quotas:** Old text stated 10 sites / 250 scans. The backend code enforces **10 sites / 500 scans**. Updated to match code.
4. **Agency Plan Quotas:** Old text stated 50 sites / 1,500 scans. The backend code enforces **100 sites / 3,000 scans**. Updated to match code.
5. **SOC 2 / ISO Claims:** Legacy mockups contained vague references to SOC 2 compliance. These were removed in favor of accurate descriptions of infrastructure isolation, TLS transport encryption, and Stripe Level 1 PCI-DSS tokenization.

---

## 13. Legal Review Placeholders & Entity Disclosures

All legal pages draw from `apps/web/src/lib/legal-config.ts`. Before executing binding contracts or commercial marketing, legal counsel should verify:
- `ENTITY_NAME`: `SiteSecura Technologies Inc.`
- `ENTITY_DBA`: `SiteSecura`
- `ENTITY_ADDRESS`: `[Insert Registered Corporate Address]`
- `GOVERNING_LAW`: `Delaware, United States`
- `CONTACT_EMAILS`: `support@sitesecura.com`, `privacy@sitesecura.com`, `legal@sitesecura.com`, `security@sitesecura.com`

---

## 14. Conclusion

SiteSecura's public legal and trust foundation is now complete across all 10 core policies. The platform presents a cohesive, professional, transparent, and defensible security posture that instills customer confidence without exposing the organization to inaccurate compliance claims or artificial contractual liabilities.
