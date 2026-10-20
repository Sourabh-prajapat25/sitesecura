# SITESECURA — PHASE 6 PRODUCTION LAUNCH CHECKLIST

**Product:** SiteSecura  
**Target Environment:** Ubuntu 22.04 LTS VPS / Docker Compose / Cloudflare Edge  
**Current Status:** **PASS WITH BLOCKED DEPLOYMENT VERIFICATION**

---

## 1. STATUS TAXONOMY

- **PASS (Locally Verified):** Fully verified and passing automated regression and security tests in the local environment.
- **BLOCKED (Requires Live Infra):** Cannot be verified until the live VPS, Cloudflare DNS, or external provider credentials are provisioned.
- **DEFERRED:** Explicitly scheduled for post-launch activation per project guidelines (e.g., live payment processing).
- **NOT RUN:** Non-essential or manual exploratory tests not scheduled for this phase.

---

## 2. LAUNCH READINESS SCORECARD

| Gate | Category | Local Status | Deployment Status | Overall Verdict |
|---|---|---|---|---|
| **Gate 1** | Code Quality & Type Safety | PASS | PASS | READY |
| **Gate 2** | Security & Multi-Tenant Isolation | PASS | BLOCKED (Cloudflare WAF) | READY (Code verified) |
| **Gate 3** | Scanner, Queue & Self-Healing | PASS | BLOCKED (Live Workers) | READY (Code verified) |
| **Gate 4** | Production Config & Port Isolation | PASS | BLOCKED (Live VPS Ports) | READY (Config verified) |
| **Gate 5** | Database Backups & Restore Drill | PASS | BLOCKED (Offsite S3 sync) | READY (Scripts verified) |
| **Gate 6** | Billing Gateway & Live Payments | DEFERRED | DEFERRED | DEFERRED (Safe) |

---

## 3. DETAILED LAUNCH CHECKLIST BY GATE

### Gate 1: Code Quality & Type Safety
- [x] **PASS** — Next.js TypeScript static analysis (`npx tsc --noEmit`) passes with 0 errors across 58 application routes.
- [x] **PASS** — Next.js production build (`npm run build`) compiles cleanly and generates all static/dynamic routes.
- [x] **PASS** — Python unit and integration regression suite executes 129/129 tests without failure.
- [x] **PASS** — No deprecated test dependency overrides or leaky SQLite fixtures remaining.

### Gate 2: Security, SSRF & Multi-Tenant Isolation
- [x] **PASS** — SafeResolver blocks loopback (`127.0.0.1`), RFC 1918 private subnets, cloud metadata (`169.254.169.254`), and IPv6 equivalents.
- [x] **PASS** — Domain normalization eliminates protocols, credentials, port overrides, and path traversals before resolving.
- [x] **PASS** — Multi-tenant data isolation verified: cross-organization access to scans, websites, and reports returns HTTP 404 (IDOR-safe).
- [x] **PASS** — Disabled accounts (`is_active=False`) blocked across all endpoints with HTTP 403 `ACCOUNT_DISABLED`.
- [x] **PASS** — Self-promotion during signup blocked: user role is strictly forced to `'free'` in production.
- [x] **PASS** — Admin endpoints (`/api/v1/admin/*`) strictly enforce admin RBAC and reject standard users.
- [x] **PASS** — Security headers enforced: HSTS (`max-age=31536000`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
- [ ] **BLOCKED** — Verification of live Cloudflare WAF rules, DDoS mitigation, and edge TLS handshake on public domain.

### Gate 3: Application Health, Scanning & Queue Reliability
- [x] **PASS** — Health probe (`/api/v1/health`) and readiness probe (`/api/v1/ready`) operational and sanitize connection errors.
- [x] **PASS** — Celery task timeouts bounded (`task_time_limit=300s`, `task_soft_time_limit=240s`).
- [x] **PASS** — Celery Beat schedule contains `stale-scan-watchdog` (10m) and `periodic-monitoring-scheduler` (15m).
- [x] **PASS** — Watchdog automatically recovers hung scans and executes idempotent quota compensation.
- [x] **PASS** — Normal scan (F1-F8 core checks) generates scores (0-100) and structured findings.
- [x] **PASS** — Deep scan engine enforces Pro/Agency entitlements and bounded timeouts per check.
- [ ] **BLOCKED** — Real-time Celery worker concurrency and memory profiling under 100+ concurrent live internet scans.

### Gate 4: Production Configuration & Infrastructure
- [x] **PASS** — `docker-compose.prod.yml` validated via `docker compose config`.
- [x] **PASS** — Strict port isolation: only Nginx exposes ports `80` and `443` to the host. PostgreSQL, Redis, API, and Next.js are unexposed.
- [x] **PASS** — Docker non-root users configured in `Dockerfile.api` and `Dockerfile.web`.
- [x] **PASS** — Production settings validator enforces non-default `SECRET_KEY`, strong DB passwords, and non-localhost `FRONTEND_URL`.
- [x] **PASS** — Nginx configured with official Cloudflare IP ranges for `CF-Connecting-IP` real IP restoration.
- [ ] **BLOCKED** — Deployment to live Ubuntu VPS (`ssh user@vps`), physical firewall verification (`ufw status`), and public SSL verification.

### Gate 5: Disaster Recovery & Runbooks
- [x] **PASS** — `scripts/backup_postgres.sh` creates gzip-compressed, SHA-256 verified database dumps.
- [x] **PASS** — `scripts/backup_reports.sh` archives PDF report storage directory with timestamping.
- [x] **PASS** — `scripts/test_restore.sh` performs automated dry-run restore into temporary test database.
- [x] **PASS** — `scripts/deploy.sh`, `scripts/healthcheck.sh`, and `scripts/rollback.sh` verified with `set -euo pipefail`.
- [ ] **BLOCKED** — Live off-site upload of backup archives to AWS S3 / Cloudflare R2 bucket (`aws s3 sync`).

### Gate 6: Billing Gateway & Live Payments
- [x] **PASS** — Live payment processing remains safely **DEFERRED**.
- [x] **PASS** — In production, mock checkout sessions are strictly rejected with HTTP 500/503 `PAYMENT_NOT_CONFIGURED`.
- [x] **PASS** — Stripe webhook signature verification rejects unsigned or spoofed events.
- [ ] **DEFERRED** — Connecting live Stripe production secret keys and enabling live credit card payments.

---

## 4. GO / NO-GO LAUNCH PROTOCOL

### Go Criteria (All Must Be True)
1. Automated test suite passes 100% (Completed: 129/129 tests passed).
2. TypeScript and frontend build compile cleanly (Completed: 0 errors).
3. Production configuration fails fast if default secrets are detected (Completed).
4. VPS provisioned and Cloudflare DNS configured (Pending operational provisioning).
5. Live health check returns HTTP 200 `{"status": "ok"}` on public domain (Pending deploy).

### No-Go Triggers (Halt Launch Immediately)
- Any internal port (`5432`, `6379`, `8000`, `3000`) is accessible from the public internet.
- Celery worker crashes repeatedly without recovering hung scans.
- Production environment launches with default `dev-secret-key-change-in-production`.
- Cloudflare Real-IP is not restored, causing rate limits to misclassify all visitors as Cloudflare edge IPs.
- Live database restore drill fails to restore schema or records.
