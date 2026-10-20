# SiteSecura Verified Badge System (Backend Foundation & Eligibility Engine)

## 1. Purpose

The Verified Badge system establishes a verifiable trust mechanism for websites assessed by SiteSecura. It allows website owners to demonstrate that their public web surface has been audited against automated defensive security benchmarks and meets defined security hygiene criteria.

This phase implements:
- **VB-1 — Verified Badge Database Foundation**
- **VB-2 — Verified Badge Eligibility Engine**

---

## 2. What "SiteSecura Verified" Means

"SiteSecura Verified" (or "Security Check Verified") indicates that:
- The website is actively managed within an authenticated SiteSecura account/organization.
- The website has undergone a defensive security assessment executed by the SiteSecura automated scanner engine.
- The most recent qualifying completed scan satisfies the active SiteSecura verification policy (minimum score threshold, recency window, and absence of disqualifying vulnerabilities).
- The evaluation was conducted at a specific point in time and verified against authoritative backend records.

---

## 3. What It Does NOT Mean (Crucial Legal & Technical Boundaries)

> [!WARNING]
> **The badge is NOT a security certification.**
>
> SiteSecura strictly forbids claims such as:
> - "Certified Secure"
> - "100% Secure"
> - "Hacker Proof"
> - "Guaranteed Secure"
> - "SiteSecura Certified"

Verification represents a point-in-time configuration and defensive posture check. It does **NOT**:
1. Guarantee immunity against cyber attacks, exploits, or zero-day vulnerabilities.
2. Replace manual penetration testing, code review, or adversary simulation.
3. Validate backend database configurations, internal network security, or physical operational security.
4. Certify compliance with SOC 2, ISO 27001, PCI-DSS, or HIPAA.

Approved terminology:
- **SiteSecura Verified**
- **Verified by SiteSecura**
- **Security Check Verified**

---

## 4. Eligibility Policy Architecture

Badge eligibility is governed by configurable policies represented in the `security_badge_policies` table rather than hardcoded logic.

The policy defines:
- `minimum_score`: Minimum numerical security score (0–100) required.
- `maximum_scan_age_days`: How recent the completed scan must be (scan age).
- `verification_validity_days`: Duration the verification remains valid once issued.
- `disallow_critical_findings`: Disqualifies websites if any CRITICAL finding is detected.
- `disallow_high_findings`: Disqualifies websites if any HIGH finding is detected (configurable).
- `require_successful_scan`: Requires scan status to be `completed`.
- `require_authorized_website`: Requires website ownership verification within SiteSecura.
- `require_monitoring`: Whether active monitoring is a prerequisite (future-facing).

### Scan Age vs. Verification Validity
- **Scan Age (`maximum_scan_age_days`)**: Governs whether a candidate scan is fresh enough to grant verification.
- **Verification Validity (`verification_validity_days`)**: Governs how long an issued verification remains valid before requiring re-evaluation.

---

## 5. Default Active Policy

The default policy seeded during database migration `012_verified_badge_foundation`:

| Policy Parameter | Default Value | Notes |
| :--- | :--- | :--- |
| `minimum_score` | `70` | Out of 100 |
| `maximum_scan_age_days` | `30` | Scans older than 30 days are ineligible |
| `verification_validity_days` | `30` | Valid for 30 days upon issuance |
| `disallow_critical_findings` | `true` | Any CRITICAL finding disqualifies |
| `disallow_high_findings` | `false` | High findings allowed under initial policy |
| `require_successful_scan` | `true` | Status must be `completed` |
| `require_authorized_website` | `true` | Organization ownership required |
| `require_monitoring` | `false` | Not required initially |
| `is_active` | `true` | Exactly one active policy enforced |

---

## 6. Database Entities

### 6.1 `security_badge_policies` Table
Defines policy configuration thresholds and rule toggles.

```sql
CREATE TABLE security_badge_policies (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL DEFAULT 'default',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    minimum_score INTEGER NOT NULL DEFAULT 70,
    maximum_scan_age_days INTEGER NOT NULL DEFAULT 30,
    verification_validity_days INTEGER NOT NULL DEFAULT 30,
    disallow_critical_findings BOOLEAN NOT NULL DEFAULT true,
    disallow_high_findings BOOLEAN NOT NULL DEFAULT false,
    require_successful_scan BOOLEAN NOT NULL DEFAULT true,
    require_authorized_website BOOLEAN NOT NULL DEFAULT true,
    require_monitoring BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.2 `security_verifications` Table
Represents historical and active verification records tied to websites and scans.

```sql
CREATE TABLE security_verifications (
    id UUID PRIMARY KEY,
    website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    policy_id UUID REFERENCES security_badge_policies(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'eligible',
    public_token VARCHAR(64) NOT NULL UNIQUE,
    score INTEGER NOT NULL,
    risk_level VARCHAR(50),
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    eligibility_reason JSON,
    monitoring_enabled BOOLEAN NOT NULL DEFAULT false,
    badge_settings JSON,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.3 Public Verification Token
- Cryptographically random (`secrets.token_urlsafe(32)`).
- 256 bits of entropy.
- URL-safe and non-sequential.
- Internal database IDs (UUIDs) are never exposed on public badge verification pages.

---

## 7. Machine-Readable Reason Codes

The eligibility engine returns stable, machine-readable reason codes:

| Reason Code | Meaning |
| :--- | :--- |
| `ELIGIBLE` | All policy criteria met |
| `WEBSITE_NOT_FOUND` | Website does not exist |
| `UNAUTHORIZED_WEBSITE` | Requester lacks ownership of website |
| `SCAN_NOT_FOUND` | No candidate scan found for website |
| `SCAN_NOT_COMPLETED` | Scan status is not `completed` (e.g. queued, running, failed) |
| `SCAN_TOO_OLD` | Scan `completed_at` exceeds `maximum_scan_age_days` |
| `SCAN_COMPLETION_TIME_UNAVAILABLE` | Scan `completed_at` is null |
| `SCORE_UNAVAILABLE` | Scan score is null |
| `SCORE_BELOW_THRESHOLD` | Scan score < `policy.minimum_score` |
| `CRITICAL_FINDING_PRESENT` | Disqualifying CRITICAL severity check detected |
| `HIGH_FINDING_PRESENT` | Disqualifying HIGH severity check detected (when policy enabled) |
| `SCAN_WEBSITE_MISMATCH` | Candidate scan does not belong to target website |
| `DOMAIN_MISMATCH` | Normalized domain of scan differs from website domain |
| `POLICY_NOT_FOUND` | No active badge policy exists or multiple active policies exist |
| `INVALID_SCAN_DATA` | Scan score out of bounds (< 0 or > 100) |
| `MONITORING_REQUIRED` | Policy requires active monitoring, but website has it disabled |

---

## 8. How `BadgeEligibilityService` Works

The service provides deterministic, pure evaluation without side effects:
- Does not modify scores.
- Does not modify scan records.
- Does not commit transactions unexpectedly.
- Collects **all** failing reasons to provide transparent user feedback.
- Supports both async (`evaluate_eligibility`) and sync (`evaluate_eligibility_sync`).

### Example Invocation
```python
from app.services.badge_eligibility_service import BadgeEligibilityService

# Async evaluation
result = await BadgeEligibilityService.evaluate_eligibility(
    db=async_session,
    website_id=website.id,
    candidate_scan_id=scan.id,
    auth_organization_id=auth.organization.id,
)

if result.eligible:
    print(f"Website is eligible! Score: {result.score}")
else:
    print(f"Not eligible. Reasons: {result.reasons}")
```

---

## 9. Verification API & Verification Lifecycle (VB-3)

### 9.1 Lifecycle State Machine

The verification badge transitions through well-defined lifecycle states:

```
                  ┌──────────────────────┐
                  │    NOT_CONFIGURED    │
                  └──────────┬───────────┘
                             │ Scan completed
                             ▼
                  ┌──────────────────────┐
          ┌───────┤   ELIGIBILITY EVAL   ├───────┐
          │       └──────────────────────┘       │
          │ Ineligible               Eligible    │
          ▼                                      ▼
┌──────────────────┐                   ┌──────────────────┐
│    INELIGIBLE    │                   │     ELIGIBLE     │
└──────────────────┘                   └─────────┬────────┘
                                                 │ POST /verify
                                                 ▼
                                       ┌──────────────────┐
                                       │     VERIFIED     │◄──────┐ (Idempotent)
                                       └────┬────────┬────┘───────┘
                                            │        │
                             expires_at <=  │        │ DELETE /badge
                             now()          │        │
                                            ▼        ▼
                                       ┌─────────┐ ┌─────────┐
                                       │ EXPIRED │ │ REVOKED │
                                       └─────────┘ └─────────┘
```

### 9.2 Real-Time Effective Status Resolver
SiteSecura calculates expiration dynamically upon request:
- If `status == "revoked"` -> **`revoked`**
- If `status == "verified"` and `expires_at <= now()` -> **`expired`**
- If `status == "verified"` and `expires_at > now()` -> **`verified`**
- Does **not** require a batch background cron job to reflect expired status accurately in real time.

### 9.3 Authenticated Endpoints

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/websites/{id}/badge/eligibility` | Bearer Token (Tenant) | Evaluates active policy eligibility; records `BADGE_ELIGIBILITY_CHECKED` |
| `POST` | `/api/v1/websites/{id}/badge/verify` | Bearer Token (Tenant) | Issues or retrieves active snapshot (strictly idempotent); records `BADGE_VERIFIED` |
| `GET` | `/api/v1/websites/{id}/badge` | Bearer Token (Tenant) | Returns current status, verification URL, badge URL, and embed snippets |
| `DELETE` | `/api/v1/websites/{id}/badge` | Bearer Token (Tenant) | Revokes active badge immediately; records `BADGE_REVOKED` |

### 9.4 Embed Code Generation

The API generates ready-to-use snippets returned by `GET /api/v1/websites/{id}/badge`:

#### HTML Snippet
```html
<a href="https://sitesecura.com/verified/{public_token}" target="_blank" rel="noopener noreferrer">
  <img src="https://sitesecura.com/badges/{public_token}.svg" alt="SiteSecura Verified" width="200" height="34" />
</a>
```

#### Markdown Snippet
```markdown
[![SiteSecura Verified](https://sitesecura.com/badges/{public_token}.svg)](https://sitesecura.com/verified/{public_token})
```

---

## 10. Public Verification & Dynamic SVG Badges (VB-4)

### 10.1 Public Verification Endpoint (`GET /api/v1/public/verified/{public_token}`)
- Open, unauthenticated endpoint for public trust verification.
- **Strict Data Minimization**:
  - Exposes **only**: `domain`, `status`, `verified_at`, `expires_at`, `verification_tier`, `badge_url`, `verification_url`, `disclaimer`.
  - **Zero Leakage**: Internal UUIDs (`id`, `website_id`, `scan_id`, `policy_id`), raw scores, vulnerability findings, scan check summaries, technology fingerprints, and server infrastructure details are strictly stripped.

### 10.2 Dynamic Vector SVG Badges (`GET /badges/{token}.svg`)
Dynamic SVG vector badges served directly from the root path or `/api/v1/public/badges/{token}.svg`:
- **States**:
  - `VERIFIED`: High-contrast Emerald Green (`#059669` / `#10B981`) with shield checkmark icon.
  - `EXPIRED`: Amber (`#D97706` / `#F59E0B`) with clock icon.
  - `REVOKED`: Red (`#DC2626` / `#EF4444`) with warning cross icon.
  - `UNVERIFIED` / `NOT_FOUND`: Slate Gray (`#4B5563` / `#6B7280`).
- **Styles**:
  - `standard`: Dual-pill vector (200x34) with brand side and status pill.
  - `compact`: Single-pill vector (130x28).
- **HTTP Caching & Defensive Security Headers**:
  - `Content-Type: image/svg+xml`
  - `Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=60`
  - `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`
  - `X-Content-Type-Options: nosniff`
- **Zero Script Injection**: All dynamic labels sanitized with strict XML character escaping.

### 10.3 Public Verification Web Page (`/verified/[token]`)
Located in `apps/web/src/app/verified/[token]/page.tsx`:
- Rendered in Next.js with responsible cybersecurity design.
- `robots: { index: false, follow: false }` to prevent scraper spam.
- Dynamic status display (Active, Expired, Revoked, Not Found).
- Assessment date and expiration date breakdown.
- Scope of assessment transparency (HTTPS, DNS, Security Headers, Cookie flags).
- **Responsible Security Notice & Limitation**: Prominently clarifies that point-in-time verification is not a guarantee of 100% immunity or a replacement for continuous defense.
- Free security scanner CTA linking to `/`.

---

## 11. Security Considerations

1. **Multi-Tenant Scoping**: All tenant endpoints enforce `get_tenant_website()` 404 isolation to prevent IDOR/BOLA attacks.
2. **Public Identifier Isolation**: `public_token` (256-bit cryptographically secure token) permanently decouples public badges from internal database UUIDs.
3. **Strict Data Minimization**: Public verification data intentionally omits vulnerability counts, raw scores, and technical fingerprints to prevent reconnaissance.
4. **Idempotent Issuance**: Repeated verification requests for the same scan return the existing snapshot rather than generating duplicate tokens.
5. **XML Sanitization**: Dynamic SVG generation sanitizes all dynamic text inputs to guarantee zero SVG XSS/script injection vectors.

