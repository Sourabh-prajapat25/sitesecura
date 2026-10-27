# SiteSecura SaaS — Final Platform-Wide Production Readiness Audit & Security Report

**Audit Date:** 2026-09-26  
**Auditor:** Antigravity Autonomous Security Engineer  
**Codebase:** SiteSecura (Scanly) SaaS Website Security Platform  
**Scope:** Complete platform-wide audit across Authentication, Authorization, Multi-Tenant Isolation, Ownership (Websites, Scans, Reports/PDFs), Plan Entitlements, Scan Quotas, Billing Consistency, Admin Security, API Security, Rate Limiting, SSRF Protections, Celery/Redis, Database/Alembic, Logging/Secrets, Error Handling, Frontend Security, AI Security, Deployment/Docker, Backup/Restore, Monitoring, and Full Regression (Normal Scan + Deep Scan F1–F8).

---

## 1. Executive Summary

SiteSecura was audited against strict production-grade security, isolation, and operational reliability standards. 
The platform combines a FastAPI asynchronous backend, a Next.js 14 frontend, a multi-stage security scanner (Normal Scan + Deep Scan F1–F8 intelligence pipeline), and Celery/Redis background task execution.

**Key Verdict:**
- **Core Security Controls:** **PASS**. The backend implements strict organization-level isolation using an anti-enumeration 404 strategy for unowned resources, atomic row-level locking (`with_for_update()`) on scan and website quotas, server-side finding redaction for Free/unauthenticated users, strictly bounded SSRF protections (`SafeHttpClient`, `SafeResolver`), and role-gated admin endpoints.
- **Deep Scan Integrity:** **PASS**. Deep Scan F1–F8 intelligence pipeline passes 100% of regression tests (259/259), correctly consumes exactly 1 scan credit (preserving the unified credit model), and enforces irreversible redaction of sensitive credentials.
- **Frontend Build Integrity:** **PASS**. Next.js production build passes with zero TypeScript errors across all 44 routes.
- **Operational Gaps Documented:** Automated PostgreSQL backup pipelines and production Stripe webhook keys require production host configuration and are classified as **OPERATIONAL GAP / NOT_VERIFIABLE** rather than assumed.

---

## 2. Architecture Audited

```text
                                 [ Internet / User ]
                                         │
                                         ▼
                            [ Nginx Reverse Proxy (:80) ]
                            ┌────────────┴────────────┐
                            ▼                         ▼
             [ Next.js 14 Web App (:3000) ]   [ FastAPI Backend (:8000) ]
                            │                         │
                            │                         ├── AuthContext (Firebase JWT)
                            │                         ├── Plan Matrix & Quotas
                            │                         ├── Rate Limiter (Redis/Memory)
                            │                         └── Anti-IDOR 404 Isolation
                            │                                 │
                            │                ┌────────────────┴────────────────┐
                            │                ▼                                 ▼
                            │        [ PostgreSQL 16 ]                 [ Redis 7 Broker ]
                            │        (Row-Locked Quotas)                       │
                            │                                                  ▼
                            │                                      [ Celery Worker Pool ]
                            │                                                  │
                            │                                         [ Deep Scanner ]
                            │                                       (F1→F2→F3→F4→F5→F6→F7→F8)
                            │                                                  │
                            │                                         [ SafeHttpClient ]
                            │                                         (SSRF Validation)
                            │                                                  │
                            └──────────────────────────────────────────────────┴──► [ Target Website ]
```

---

## 3. Authentication Security

**Status:** `PASS`

### Controls & Code Inspection:
1. **Token Validation (`apps/api/app/core/security.py`):**
   - In production (`settings.ENVIRONMENT == "production"`), development tokens (`dev-token-*`) are strictly rejected.
   - Every incoming `Authorization: Bearer <token>` is cryptographically verified against Google Firebase public keys via `firebase_admin_service.verify_firebase_token_payload(clean_token)`.
   - Missing or expired tokens raise HTTP 401 with standard `{"error": {"code": "AUTHENTICATION_REQUIRED"}}` or `INVALID_AUTH_TOKEN`.
2. **Identity Derivation (`apps/api/app/core/authorization.py`):**
   - The user identity is never accepted from request bodies, query strings, headers, or client cookies.
   - User identity is strictly resolved from verified `token_data["uid"]` and mapped via `get_or_create_user(db, token_data)`.
3. **Immutability of Privileges:**
   - Client tokens cannot self-assign `admin` or higher plan tiers in production; the authoritative subscription plan is calculated from active database `Subscription` records via `get_effective_plan()`.

**Evidence:** Verified via `tests/test_production_readiness_audit.py::test_unauthenticated_requests_rejected_with_401` and `test_malformed_token_rejected_with_401`.

---

## 4. Authorization & Organization Isolation

**Status:** `PASS`

### Controls & Code Inspection:
1. **Strict 404 Anti-Enumeration Strategy:**
   - To prevent resource enumeration and BOLA/IDOR attacks, accessing resources belonging to another tenant does not return HTTP 403 (which reveals the ID exists); it returns HTTP 404 `NOT_FOUND` while logging a `PERMISSION_DENIED` security audit event.
2. **Multi-Tenant Scoping:**
   - `get_tenant_website(website_id, auth, db)`: strictly scopes queries by `Website.organization_id == auth.organization.id`.
   - `get_tenant_scan(scan_id, auth, db)`: strictly scopes by `Scan.organization_id == auth.organization.id`.
   - `get_tenant_report(scan_id, auth, db)`: strictly scopes by `Report.organization_id == auth.organization.id`.
   - `Alert` and `AuditLog` queries strictly filter by `organization_id == auth.organization.id`.
3. **Cross-Tenant Mutation Defense:**
   - PATCH and DELETE operations on websites, scans, alerts, and team members enforce active organization ownership.

**Evidence:** Verified via `tests/test_production_readiness_audit.py::test_cross_tenant_website_access_returns_404` and `test_cross_tenant_scan_and_pdf_access_returns_404`.

---

## 5. Website Ownership

**Status:** `PASS`

### Controls & Code Inspection:
- Every website operation (`/websites/{id}`, `/websites/{id}/scan`, `/websites/{id}/deep-scan`, `/websites/{id}/monitoring`) resolves the target website through `get_tenant_website(website_id, auth, db)`.
- Passing a valid UUID of another organization's website returns HTTP 404.
- Website creation is atomically bound to the user's active organization ID with server-side normalized domain uniqueness.

**Evidence:** Verified via `test_cross_tenant_website_access_returns_404` and `test_tenant_website_isolation_and_idor_returns_404` in `tests/test_phase_b_security.py`.

---

## 6. Scan Ownership

**Status:** `PASS`

### Controls & Code Inspection:
- All scan retrieval routes (`GET /api/v1/scans/{id}`, `GET /api/v1/scans/{id}/status`, `GET /api/v1/scans/{id}/results`, `GET /api/v1/scans/{id}/pdf`) enforce organization isolation:
  - If `scan.organization_id` is set, only members of that organization (or platform admins) can view it; foreign callers receive HTTP 404.
  - Anonymous public scans have `organization_id = NULL` and only return redacted findings to non-paying users.
- A scan ID alone never grants unauthorized access.

**Evidence:** Verified via `tests/test_production_readiness_audit.py::test_cross_tenant_scan_and_pdf_access_returns_404`.

---

## 7. PDF Security & Generation

**Status:** `PASS`

### Controls & Code Inspection:
1. **Ownership & Access Control:**
   - PDF download route (`GET /api/v1/scans/{scan_id}/pdf`) verifies `Report.organization_id == auth.organization.id` and `Scan.organization_id == auth.organization.id`.
   - Foreign organization requests return HTTP 404 `REPORT_NOT_FOUND` and stream 0 PDF bytes.
2. **Entitlement Filtering:**
   - For Free users, PDF generation masks sensitive findings and evidence in line with `filter_findings_for_viewer`.
   - Rate limiting (5 downloads/minute per user) is enforced to prevent resource exhaustion attacks.

**Evidence:** Verified via `test_pdf_cross_tenant_access_returns_404_no_bytes_streamed` in `tests/test_phase_b_security.py` and `tests/test_pdf_and_entitlements.py`.

---

## 8. Plan Entitlements Matrix

**Status:** `PASS`

### Central Entitlements Enforcement Table:

| Feature / Limit | Free Tier | Basic Tier | Pro Tier | Agency Tier | Backend Enforced? | Frontend Enforced? | Tested? |
|---|---|---|---|---|:---:|:---:|:---:|
| **Max Registered Websites** | 1 | 2 | 10 | 100 | Yes (`check_and_reserve_website_quota`) | Yes (Buttons / Banner) | Yes |
| **Monthly Scan Quota** | 10 | 100 | 500 | 3,000 | Yes (`check_and_reserve_scan_quota`) | Yes (Usage Bar) | Yes |
| **Deep Scan (F1–F8)** | Locked (403) | Locked (403) | Enabled (50 pages) | Enabled (100 pages) | Yes (`require_feature("deep_scan")`) | Yes (Locked Card) | Yes |
| **Technical Finding Evidence** | Redacted (Top 3 only) | Full Unredacted | Full Unredacted | Full Unredacted | Yes (`filter_findings_for_viewer`) | Yes (Redacted JSON) | Yes |
| **AI Security Advisor** | Locked (403) | Locked (403) | Enabled (100 req/mo) | Enabled (500 req/mo) | Yes (`check_and_reserve_ai_quota`) | Yes (Locked Modal) | Yes |
| **Scheduled Monitoring** | No | Weekly | Daily | Daily | Yes (`require_feature("monitoring_allowed")`) | Yes (Toggle Disabled) | Yes |
| **White-Label Branding** | No | No | No | Custom Logo & Brand | Yes (`require_feature("white_label")`) | Yes (Restricted Route) | Yes |
| **Team Member Seats** | 0 | 0 | 3 | 15 | Yes (`require_feature("team_members_allowed")`) | Yes (Invite Guard) | Yes |

All entitlement limits are enforced **authoritatively on the backend**. Frontend states (buttons, dialogs) are UX conveniences only; bypassing them with direct HTTP requests triggers HTTP 403 on the API.

---

## 9. Scan Quota Integrity & Concurrency

**Status:** `PASS`

### Controls & Code Inspection:
1. **Atomic Quota Reservation:**
   - In `entitlement_service.py`, `check_and_reserve_scan_quota` uses `select(UsageRecord).where(...).with_for_update()` inside the database transaction. This serializes concurrent scan requests and completely eliminates TOCTOU race conditions.
2. **Unified Credit Model:**
   - Both Normal Scan and Deep Scan consume **exactly 1 monthly scan slot**. Deep Scan F1–F8 never consumes multiple credits.
3. **Dispatch Failure Compensation:**
   - If scan enqueueing or Celery dispatch fails, `refund_scan_quota(db, org_id)` automatically increments the available balance and marks the scan record as `failed`, ensuring no credits are lost.

**Evidence:** Verified via `tests/test_production_readiness_audit.py::test_pro_user_can_trigger_deep_scan_and_consumes_one_credit` and `test_scan_quota_reservation_failure_compensation` in `tests/test_phase_b_security.py`.

---

## 10. Billing Consistency & Stripe Architecture

**Status:** `PARTIAL` / `NOT_VERIFIABLE` (Operational)

### Code Inspection:
- Stripe Checkout session generation, Customer Portal creation, and webhook handling are implemented in `apps/api/app/services/billing_service.py`.
- In production, `stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)` strictly verifies cryptographic signatures.
- Webhook processing is idempotent: repeated delivery of `checkout.session.completed` or `customer.subscription.updated` updates the existing subscription without duplicating records.
- Payment credentials, secret keys, and card numbers are never logged.

### Operational Gap:
- In local development and automated CI, live Stripe credentials (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) are placeholders (`sk_test_placeholder...`). Production readiness requires live Stripe API keys and webhook endpoint configuration in the production environment `.env`.

---

## 11. Admin Security

**Status:** `PASS`

### Controls & Code Inspection:
1. **Backend Privilege Enforcement:**
   - Every administrative route under `/api/v1/admin/*` depends strictly on `require_admin` (`apps/api/app/core/authorization.py`), which verifies `auth.user.role == "admin"`.
   - A regular user (whether Free, Basic, Pro, or Agency) calling any admin endpoint is denied with HTTP 403 `ADMIN_ACCESS_REQUIRED`.
2. **Tamper Prevention:**
   - Role assignment is not modifiable through `/auth/sync` or token claims in production. Organization ownership (`OrganizationMember.role == "owner"`) is strictly separated from system administrative privilege (`User.role == "admin"`).
3. **Frontend Guard:**
   - The `/admin` Next.js frontend route checks `user.role === 'admin'` and redirects unauthorized users to `/dashboard`.

**Evidence:** Verified via `tests/test_production_readiness_audit.py::test_admin_privilege_escalation_blocked` and `test_admin_user_can_access_admin_endpoints`.

---

## 12. API Security

**Status:** `PASS`

### Controls & Code Inspection:
1. **Routing Classification:**
   - **Public:** `/api/v1/health`, `/api/v1/ready`, `/api/v1/cms/posts` (published only), `/api/v1/cms/categories`.
   - **Hybrid Public/Authenticated:** `POST /api/v1/scans` (anonymous rate-limited to 3/day; authenticated uses org quota), `GET /api/v1/scans/{id}`.
   - **Authenticated Tenant:** `/api/v1/websites`, `/api/v1/alerts`, `/api/v1/billing`, `/api/v1/agency/*`, `/api/v1/ai/*`.
   - **Admin Only:** `/api/v1/admin/*`.
2. **Defensive Response Headers Added:**
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY` (API) / `SAMEORIGIN` (Web)
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: accelerometer=(), camera=(), geolocation=(), ...`
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (in production)

---

## 13. Rate Limiting & Abuse Protection

**Status:** `PASS`

### Controls & Code Inspection:
- Distributed rate limiting is implemented via `apps/api/app/core/rate_limit.py` using Redis with an automatic in-memory sliding-window fallback when Redis is temporarily offline.
- **Anonymous scans:** Strictly 3 scans per IP per 24 hours (`ratelimit:public_scan:{ip}`).
- **User scans:** Max 20 requests per minute (`ratelimit:user_scan:{user_id}`).
- **PDF generation:** Max 5 downloads per minute (`ratelimit:pdf:{user_id}`).
- **AI Advisor:** Max 20 requests per minute (`ratelimit:ai_user:{user_id}`).
- Rate limit violations trigger HTTP 429 `RATE_LIMITED` with standard `retry_after` values.

---

## 14. SSRF Regression Audit

**Status:** `PASS`

### Controls & Code Inspection:
- All outbound scanning calls route through `SafeHttpClient` and `SafeResolver` (`scanner/network/`).
- Outbound targets are pre-validated via `resolve_and_validate_target()` against private, loopback, multicast, link-local, and cloud metadata ranges (e.g., `127.0.0.1`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, IPv6 loopbacks, DNS rebinding).
- Redirect chains are pinned and re-validated at every hop. Max redirects = 5; max response bytes = 1 MB; connect/read timeouts = 5s.
- Codebase grep confirmed zero raw `requests.get` or un-intercepted `httpx` calls in scanner modules.

**Evidence:** Verified via `tests/test_production_readiness_audit.py::test_ssrf_domain_normalization_blocks_loopback_and_metadata` and `tests/test_ssrf.py`.

---

## 15. Celery & Redis Reliability

**Status:** `PASS`

### Controls & Code Inspection:
- Task registration in `apps/api/app/tasks/worker.py`: `scan_website_task`, `deep_scan_website_task`.
- If Celery or Redis is unreachable when triggering a scan:
  1. The API intercepts the failure cleanly.
  2. Executes synchronous fallback (`execute_scan_job` / `execute_deep_scan_job`).
  3. If both Celery and sync fallback fail, `refund_scan_quota()` restores the user's scan credit, sets scan status to `failed`, and returns HTTP 500 with a clean error message. Scans never remain permanently stuck in "queued".

---

## 16. Database Integrity & Alembic Migrations

**Status:** `PASS`

### Controls & Code Inspection:
- Complete migration chain in `apps/api/alembic/versions`:
  - `001_initial_schema` -> `002_add_missing_indexes` -> `003_phase_b_ownership_and_quotas` -> `004_phase_c_monitoring` -> `005_add_ai_generations` -> `006_blog_posts_publishing_index` -> `007_add_media_assets` -> `008_add_blog_faqs_and_redirects` -> `009_add_blog_taxonomy_e5` -> `010_add_blog_ecosystem_e7` -> `011_add_scan_metadata (head)`.
- Running `alembic heads` confirms a single unified head (`011_add_scan_metadata (head)`).
- Zero duplicate heads, zero destructive migrations, zero table drops.

---

## 17. Sensitive Data Protection & Logging

**Status:** `PASS`

### Controls & Code Inspection:
- Passwords, API keys, Firebase private keys, and Stripe secrets are loaded from environment variables and never logged.
- `sanitize_audit_metadata` redacts tokens, authorization headers, passwords, and secrets from `AuditLog.metadata`.
- Phase F7 and F8 irreversible masking remains strictly intact: raw credentials, JWT secrets, and AWS keys discovered during scans are masked with SHA-256 hashes or `[REDACTED]`.

---

## 18. Error Handling & Information Leakage

**Status:** `PASS`

### Controls & Fix Applied:
- **FastAPI Global Exception Handler (`apps/api/main.py`):** Catches unhandled exceptions and returns a generic JSON response:
  ```json
  {"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected server error occurred. Please try again later."}}
  ```
  Internal Python stack traces and SQL queries are logged to server error logs and never exposed in the response.
- **Surgical Fix in `apps/api/app/api/v1/health.py`:** Sanitized database probe exception in `/ready` endpoint so database connection strings, internal IP addresses, and user names are not exposed in HTTP responses.

---

## 19. Frontend Security & Build Integrity

**Status:** `PASS`

### Controls & Code Inspection:
- `apps/web` built with Next.js 14 App Router.
- Zero secret keys are exposed under `NEXT_PUBLIC_*`. Only `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_APP_URL` are exported to the client.
- No unsafe `dangerouslySetInnerHTML` rendering without sanitization.
- Verification commands:
  - `npx tsc --noEmit` -> 0 errors.
  - `npm run build` -> 44/44 routes successfully compiled into optimized production bundles.

---

## 20. Normal Scan Regression

**Status:** `PASS`

- Executed complete normal scan test suite (`tests/test_scanner_modules.py`, `tests/test_scoring.py`, `tests/test_scanner_fixtures.py`, `tests/test_safe_network.py`, `tests/test_ssrf.py`, `tests/test_cookie_parser.py`, `tests/test_pdf_and_entitlements.py`).
- **102 tests passed** (100% success rate). Scoring formulas, weights, and vulnerability detections remain identical.

---

## 21. Deep Scan F1–F8 Regression

**Status:** `PASS`

- Executed full Deep Scan test suite:
  - `test_deep_scan.py` (F1 Surface Discovery)
  - `test_deep_scan_f2.py` (F2 TLS / DNS / Transport)
  - `test_deep_scan_f3.py` (F3 Frontend & Client-Side Exposure)
  - `test_deep_scan_f4.py` (F4 HTTP / API / Security)
  - `test_deep_scan_f5.py` (F5 Identity & Authorization)
  - `test_deep_scan_f6.py` (F6 Infrastructure & Cloud Exposure)
  - `test_deep_scan_f7.py` (F7 Sensitive Data & Privacy Exposure)
  - `test_deep_scan_f8.py` (F8 Security Correlation, Attack Graph & Executive Posture)
- **259 tests passed** (100% success rate).

---

## 22. AI Advisor Security

**Status:** `PASS`

- AI Security Advisor strictly acts in an advisory capacity.
- Prompt injection fencing prevents untrusted scanner input from overriding system instructions.
- Quotas are strictly enforced: Pro = 100 req/mo, Agency = 500 req/mo. Free/Basic access returns 403 `AI_FEATURE_REQUIRED`.
- Fallback chain works seamlessly: Groq 1 -> Groq 2 -> Gemini. If all fail, quota is refunded.

---

## 23. Docker & Deployment Readiness

**Status:** `PASS`

- Docker Compose configuration in `docker-compose.yml`:
  - Services: `postgres`, `redis`, `api`, `worker`, `beat`, `web`, `nginx`.
  - Persistent named volumes for Postgres (`postgres_data`), Redis (`redis_data`), and report files (`storage_reports`).
  - Container healthchecks configured on Postgres (`pg_isready`).
  - Nginx reverse proxy routes traffic between Next.js frontend and FastAPI backend.

---

## 24. Backup & Restore Readiness

**Status:** `NOT_VERIFIABLE / OPERATIONAL GAP`

### Findings:
- Database data volume is persisted via Docker named volume `postgres_data`.
- However, there is no automated backup cron job (e.g. daily `pg_dump` or WAL-G snapshot) committed in the repository.

### Actionable Operational Recommendation:
1. Configure an off-host automated backup script on the VPS host:
   ```bash
   docker exec scanly-postgres pg_dump -U postgres scanly | gzip > /backups/scanly_$(date +%Y%m%d_%H%M%S).sql.gz
   ```
2. Replicate backups to secure off-site object storage (e.g. AWS S3 with Object Lock or Cloudflare R2).

---

## 25. Monitoring & Alerting

**Status:** `PASS` (Platform) / `NOT_VERIFIABLE` (External APM)

- Platform-level monitoring includes continuous website check intervals (weekly for Basic, daily for Pro/Agency), alert deduplication, and an in-app audit trail.
- `/api/v1/health` and `/api/v1/ready` provide container liveness and database readiness probes for uptime monitors.
- External APM integration (e.g., Sentry / Datadog) is not bundled in code and must be configured at the operational infrastructure level.

---

## 26. Remaining Operational Risks

1. **Stripe Production Secrets:** Must be set in production `.env` before enabling paid checkouts.
2. **Firebase Admin Private Key:** Must be provided as an authorized service account JSON in production.
3. **Database Automated Backups:** Host-level backup cron must be enabled on the production VPS.
4. **Rate Limiting Persistence:** Requires Redis running in production (in-memory fallback will reset across worker restarts if Redis is absent).

---

## 27. Production Go-Live Checklist

- [x] Backend authentication validated (Firebase ID tokens cryptographically verified).
- [x] Multi-tenant organization isolation verified (404 anti-enumeration strategy).
- [x] Website, Scan, and PDF ownership strictly validated on server-side.
- [x] Plan entitlements matrix enforced server-side (Free vs Basic vs Pro vs Agency).
- [x] Monthly scan quotas atomically checked and row-locked (`with_for_update`).
- [x] Deep Scan F1–F8 intelligence pipeline verified (259/259 tests passing).
- [x] Normal Scan regression passed (102/102 tests passing).
- [x] SSRF protections verified against loopback, metadata, and private IP ranges.
- [x] Defensive HTTP security headers added (nosniff, DENY, strict-origin).
- [x] Error responses sanitized (no stack traces or DB connection strings exposed).
- [x] Frontend TypeScript passed (`npx tsc --noEmit` -> 0 errors).
- [x] Frontend production build passed (`npm run build` -> 44/44 routes compiled).
- [x] Linear Alembic migrations confirmed (`alembic heads` -> single head).
- [ ] Configure production `.env` with live Firebase, Stripe, and SMTP credentials.
- [ ] Configure host-level automated PostgreSQL backup cron job.
- [ ] Execute manual verification checklist (`MANUAL_SITE_VERIFICATION_CHECKLIST.md`).

---

## 28. Final Scorecard

| Domain | Status | Evidence | Remaining Risk |
|---|:---:|---|---|
| **Authentication** | `PASS` | Token signature verification, 401 on missing/expired tokens in `test_production_readiness_audit.py` | Requires valid Firebase service account in production `.env` |
| **Authorization** | `PASS` | RBAC role gates and AuthContext dependency in `authorization.py` | None |
| **Organization Isolation** | `PASS` | 404 anti-enumeration strategy verified on websites, scans, and PDFs in `test_phase_b_security.py` | None |
| **Ownership** | `PASS` | Scoped DB loaders `get_tenant_website`, `get_tenant_scan`, `get_tenant_report` | None |
| **Entitlements** | `PASS` | Authoritative server-side feature gates in `permissions.py` and `entitlement_service.py` | None |
| **Quota** | `PASS` | Atomic row-locking (`with_for_update`), 1-credit Deep Scan model, failure compensation refunding | None |
| **Billing** | `NOT_VERIFIABLE` | Code implementation complete; live Stripe keys and webhook signature require live setup | Production keys must be set in `.env` |
| **Admin** | `PASS` | Admin endpoints protected by `require_admin`, regular users rejected with 403 `ADMIN_ACCESS_REQUIRED` | None |
| **API** | `PASS` | Pydantic schema validation, standardized error models, 0 stack traces leaked | None |
| **SSRF** | `PASS` | `SafeHttpClient` and `SafeResolver` pin IPs, block loopback and cloud metadata ranges | None |
| **Rate Limiting** | `PASS` | Redis sliding window with memory fallback; IP and user rate limits verified | None |
| **Celery** | `PASS` | Task definitions, sync fallback on worker failure, automatic quota refund | Worker processes must be managed by supervisord/compose |
| **Redis** | `PASS` | Used for task broker and rate limiting; fallback handlers in place | None |
| **Database** | `PASS` | Foreign keys, unique constraints, and indexes validated across all SQLAlchemy models | None |
| **Migrations** | `PASS` | `alembic heads` confirms single linear head `011_add_scan_metadata`, 0 branches | None |
| **Secrets** | `PASS` | No secrets committed; loaded via pydantic `Settings`; masked in audit logs | Ensure production `.env` has restricted permissions (chmod 600) |
| **Logging** | `PASS` | Error logging sanitized; F7/F8 credentials masked with SHA-256 or `[REDACTED]` | None |
| **Frontend** | `PASS` | Next.js 14 build succeeds (44 routes); zero TypeScript errors; no secret exposure | None |
| **AI Advisor** | `PASS` | Multi-provider failover (Groq1 -> Groq2 -> Gemini), quota gating, prompt injection fencing | Requires live Groq/Gemini API keys |
| **PDF** | `PASS` | Strict org scoping, rate limiting (5/min), masked for Free tier | None |
| **Normal Scan** | `PASS` | 102/102 normal scan tests passing; scoring and check integrity intact | None |
| **Deep Scan** | `PASS` | 259/259 Deep Scan F1–F8 tests passing; correlated risk graph and posture intact | None |
| **Deployment** | `PASS` | Complete `docker-compose.yml`, Dockerfiles for API, Worker, Web, Nginx reverse proxy | None |
| **Backup** | `NOT_VERIFIABLE` | Volume persistence exists; automated snapshot cron is an operational gap | Host-level cron must be configured |
| **Monitoring** | `PASS` | Liveness and readiness endpoints `/health` and `/ready`; continuous scan scheduler | External APM tool recommended |

---

**Audit Conclusion:**  
The SiteSecura codebase is **technically sound, hardened, and ready for staging and manual user acceptance testing**. All core security controls, isolation barriers, scan quotas, and scanner regressions have passed verification.
