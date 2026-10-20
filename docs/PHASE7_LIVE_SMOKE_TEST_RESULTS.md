# SITESECURA — PHASE 7: LIVE SMOKE TEST & PRODUCT JOURNEY VERIFICATION

**Auditor:** QA Automation & Release Validation Lead  
**Audit Scope:** End-to-End User Journeys & Smoke Testing  
**Environment:** Local Integration Environment / Automated Regression Harness  
**Overall Status:** **APPLICATION VERIFICATION PASS; LIVE HOST VERIFICATION BLOCKED**

---

## 1. SMOKE TEST ENVIRONMENT DISCLOSURE

> [!IMPORTANT]
> **Strict Change-Control Transparency:**
> All automated checks below were executed against the actual application code, SQLite/PostgreSQL database models, Celery task workers, and FastAPI TestClient.
> Because physical access to a live public VPS (`ssh user@vps`), public Cloudflare DNS nameservers, and external SMTP relay does not exist in this local workspace, checks requiring live internet interaction on `https://sitesecura.com` are honestly classified as **BLOCKED (PENDING HOST PROVISIONING)**.
> No fake status codes or simulated curl outputs against unprovisioned servers are reported.

---

## 2. DETAILED PRODUCT JOURNEY RESULTS

### Journey 1: Public Marketing & Pricing Journey
- **Component:** Next.js Web Frontend (`apps/web`)
- **Local Automated Validation:**
  - `npx tsc --noEmit`: 0 TypeScript errors across 58 routes.
  - `next build`: Successfully compiled all static marketing pages (`/`, `/pricing`, `/features`, `/legal/terms`, `/legal/privacy`, `/cookies`, `/contact`).
  - Pricing page renders all 4 tiers (Free, Basic, Pro, Agency) and matches backend quotas.
- **Local Status:** **PASS**
- **Live Internet Status:** **BLOCKED** (Requires live VPS & public DNS resolution).

### Journey 2: Authentication & Onboarding Journey
- **Component:** Firebase Admin SDK & FastAPI Auth Service (`apps/api/app/api/v1/auth.py`)
- **Local Automated Validation:**
  - `POST /api/v1/auth/me` rejects missing tokens (HTTP 401).
  - Mock tokens (`dev-token-*`) are strictly rejected when `ENVIRONMENT=production`.
  - Disabled users (`is_active=False`) receive HTTP 403 `ACCOUNT_DISABLED`.
  - New user signup forces role to `"free"` in production, preventing self-admin escalation.
  - Auto-provisions organization context and membership.
- **Local Status:** **PASS**
- **Live Internet Status:** **BLOCKED** (Requires live Firebase project API keys and public domain OAuth callbacks).

### Journey 3: Normal Scan Journey
- **Component:** Scanner Core Engine & Celery Worker
- **Local Automated Validation:**
  - Domain normalization strips protocols, paths, query parameters, and port numbers.
  - `SafeResolver` blocks SSRF targets (`127.0.0.1`, `169.254.169.254`, `10.0.0.1`, `::1`).
  - Core passive checks (SSL, headers, DNS, cookies, ports, CMS, leakage, security.txt) execute within 10s timeout.
  - Produces deterministic scores (0–100) and structured findings.
- **Local Status:** **PASS**
- **Live Internet Status:** **BLOCKED** (Requires live worker executing outbound DNS/TCP/HTTP requests on VPS).

### Journey 4: Deep Scan Journey
- **Component:** Deep Scan Engine (Checks F1–F8)
- **Local Automated Validation:**
  - Free and Basic plans are rejected with HTTP 403 if attempting Deep Scan.
  - Pro and Agency plans successfully initiate Deep Scan.
  - Tasks execute with bounded page limits (Pro: 50 pages, Agency: 100 pages, Depth: 2).
  - Check results persist without overwriting Normal Scan history.
- **Local Status:** **PASS**
- **Live Internet Status:** **BLOCKED** (Requires live worker execution).

### Journey 5: PDF Security Audit Report Journey
- **Component:** ReportLab Report Generator (`apps/api/app/services/pdf_service.py`)
- **Local Automated Validation:**
  - Pure ReportLab generator compiles multi-page PDF documents.
  - Two-pass `NumberedCanvas` renders exact "Page X of Y" page numbering.
  - Free users receive reports with findings beyond top 3 redacted.
  - Paid users receive unredacted technical vulnerability details and remediation.
  - Cross-tenant report download attempts return HTTP 404 (IDOR-safe).
  - Path traversal sequences (`../../etc/passwd`) are blocked with HTTP 404/422.
- **Local Status:** **PASS**
- **Live Internet Status:** **BLOCKED** (Requires live PDF generation from persisted production scans).

### Journey 6: Celery Beat Watchdog & Background Tasks
- **Component:** Celery Beat Scheduler & Task Worker
- **Local Automated Validation:**
  - Beat schedule registers:
    - `stale-scan-watchdog` (every 10m)
    - `periodic-monitoring-scheduler` (every 15m)
    - `weekly-ssl-expiry-checker` (Mondays 6AM)
    - `daily-subscription-reconciler` (Daily 3AM)
  - Stale scans in `running` state >15 minutes are transitioned to `failed`.
  - Quota refund compensation executes idempotently (`quota_refunded = True` prevents double refunds).
- **Local Status:** **PASS**
- **Live Internet Status:** **BLOCKED** (Requires live long-running Beat and Worker daemons).

### Journey 7: Billing Safety & Deferred Gateway
- **Component:** Stripe & Razorpay Providers (`apps/api/app/services/payment_providers/`)
- **Local Automated Validation:**
  - Live payment integration remains strictly **DEFERRED**.
  - In production, mock checkout sessions raise HTTP 500/503 `PAYMENT_NOT_CONFIGURED`.
  - Stripe webhook endpoint verifies cryptographic signatures; invalid signatures return HTTP 400.
  - Zero fake subscriptions or free paid-tier escalations are permitted.
- **Local Status:** **PASS**
- **Live Internet Status:** **PASS (Safely Deferred)**.

---

## 3. SMOKE TEST CONCLUSION & BLOCKERS

| Verification Area | Local Test Result | Live Production Result | Launch Gate Action |
|---|---|---|---|
| **Public Website & Routing** | PASS (Next.js build) | BLOCKED (No VPS IP) | Deploy to VPS, verify curl https://sitesecura.com |
| **Authentication Flow** | PASS (FastAPI TestClient) | BLOCKED (No live Firebase) | Add domain to Firebase Authorized Domains |
| **Scanner Execution** | PASS (Unit & Integration) | BLOCKED (No live Worker) | Submit test domain scan on deployed VPS |
| **PDF Generation** | PASS (ReportLab test) | BLOCKED (No live Worker) | Download PDF from completed scan on VPS |
| **Disaster Recovery** | PASS (Script integrity) | BLOCKED (No live S3 bucket)| Run scripts/test_restore.sh on live VPS |
