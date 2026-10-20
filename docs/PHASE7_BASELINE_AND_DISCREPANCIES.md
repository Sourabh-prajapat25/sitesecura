# SITESECURA — PHASE 7: REPOSITORY AUDIT & PHASE 1–6 DISCREPANCY RECONCILIATION

**Auditor:** Principal DevSecOps Engineer & SaaS Production Architect  
**Audit Target:** SiteSecura Full-Stack SaaS Repository  
**Audit Date:** October 2026  
**Status:** **RECONCILED & VERIFIED**

---

## 1. EXECUTIVE SUMMARY

Before evaluating the final production launch gate, an independent code-level reconciliation was conducted between the documentation reports from Phases 1 through 6 and the actual code, configuration, and test suites in the repository.

This audit uncovered multiple critical documentation inaccuracies in earlier reports regarding test counts, Celery timeouts, PDF engines, domain routing, and plan quotas. Crucially, the **actual code implementation is superior, more robust, and more coherent** than the descriptions in the earlier reports.

Every discrepancy has been identified, investigated against the ground truth of the codebase, and reconciled below.

---

## 2. RECONCILIATION OF DISCREPANCIES

### Discrepancy 1: Phase 5 Test Counts & Test Breakdown
- **Previous Report Claim (Phase 6):** Stated the 129 regression test total consisted of: Phase 2 (23), Phase 3 (20), Phase 4 (21), Phase 5 (24), and Phase 6 (21). *(Note: 23 + 20 + 21 + 24 + 21 = 109, which contradicted the reported 129 total).*
- **Actual Code Truth (Collected via `pytest --collect-only`):**
  - `tests/test_phase2_security_hardening.py`: **40 tests**
  - `tests/test_phase3_scanner_reliability.py`: **19 tests**
  - `tests/test_phase4_production_configuration.py`: **21 tests**
  - `tests/test_phase5_production_infrastructure.py`: **28 tests**
  - `tests/test_phase6_e2e_security_validation.py`: **21 tests**
  - **Exact Sum:** 40 + 19 + 21 + 28 + 21 = **129 tests**.
- **Explanation:** The earlier report table contained inaccurate per-file breakdown rows that failed basic arithmetic. In reality, `tests/test_phase5_production_infrastructure.py` contains exactly **28 tests** (as originally reported in Phase 5), and Phase 2 contains **40 tests**. All 129 tests pass with a 100% success rate.

---

### Discrepancy 2: Monolithic Test Failures & Isolation Root Causes
- **Previous Report Claim:** Documented 11 "legacy test failures" when running `pytest` monolithically across all 43 test modules, claiming they were pre-existing bugs.
- **Actual Code Truth:** All tests pass 100% when run in isolation. The failures were caused by two architectural issues in test fixtures:
  1. **Fixture Teardown Pollution:** Modules like `test_phase4_production_configuration.py` called `app.dependency_overrides.clear()` in teardown fixtures, erasing dependency overrides that subsequent test modules had registered during module import.
  2. **Asymmetric App Module Import:** `test_phase5_production_infrastructure.py` imported `from main import app` while all other 42 files imported `from apps.api.main import app`. In Python's module registry, this loaded `main.py` twice, creating duplicate FastAPI app instances.
  3. **Missing `ROOT_DIR` in `test_phase5`:** `test_phase5` omitted adding `ROOT_DIR` to `sys.path`, causing a `ModuleNotFoundError: No module named 'apps'` when run standalone without previous files populating `sys.path`.
- **Resolution:**
  - Standardized `test_phase5_production_infrastructure.py` import to `from apps.api.main import app` and added proper `sys.path` bootstrapping.
  - Implemented `pytest.fixture(autouse=True)` in `test_phase6_e2e_security_validation.py` to ensure dependency overrides are re-bound cleanly before every test execution.
  - No real application logic was modified; only the test harness isolation was corrected.

---

### Discrepancy 3: Scope of Testing (Browser E2E vs API / Static Checks)
- **Previous Report Claim:** Described "browser-level end-to-end verification" across user journeys.
- **Actual Code Truth:** `apps/web/package.json` contains no browser automation framework (no Playwright, Cypress, Puppeteer, Selenium, or Jest).
- **Explanation:**
  - **Frontend Verification:** Consists of TypeScript AST type-checking (`npx tsc --noEmit`) and Next.js production build (`npm run build`), which statically verifies all 58 routes and JSX components.
  - **Backend Verification:** Consists of FastAPI `TestClient` HTTP requests, SQLAlchemy queries, and Celery configuration assertions.
  - **Audit Standard:** We clearly distinguish API-level and static validation from true browser automation.

---

### Discrepancy 4: Production Domain Routing Architecture
- **Previous Report Claim:** Phase 6 instructions advised pointing DNS `A` records to both `sitesecura.com` and `api.sitesecura.com`.
- **Actual Code Truth:**
  - `docker-compose.prod.yml` (line 194): `NEXT_PUBLIC_API_URL: /api/v1`
  - `infra/nginx.prod.conf` (line 152): `location /api/ { proxy_pass http://api_upstream; ... }`
  - `infra/nginx.prod.conf` (line 175): `location / { proxy_pass http://web_upstream; ... }`
- **Explanation:** The application is architected as a **unified single-domain application**:
  - `https://sitesecura.com/` serves the Next.js frontend.
  - `https://sitesecura.com/api/` serves the FastAPI backend.
  - There is **no separate `api.sitesecura.com` subdomain**. A single domain avoids CORS preflight overhead, eliminates cross-subdomain cookie issues, and requires only one SSL certificate.

---

### Discrepancy 5: Nginx Configuration File Path
- **Previous Report Claim:** Phase 6 referenced `docker/nginx/nginx.conf`.
- **Actual Code Truth:** The `docker/` directory does not exist in the repository root.
  - The actual production Nginx configuration resides at `infra/nginx.prod.conf`.
  - `docker-compose.prod.yml` line 226 mounts `./infra/nginx.prod.conf:/etc/nginx/nginx.conf:ro`.
- **Explanation:** Documented paths have been updated to reflect the canonical `infra/nginx.prod.conf`.

---

### Discrepancy 6: Celery Timeouts & Celery Beat Schedule
- **Previous Report Claim:** Reported `task_time_limit = 300s`, `task_soft_time_limit = 240s`, and 2 periodic tasks (watchdog and monitoring).
- **Actual Code Truth (`apps/api/app/tasks/celery_app.py` lines 35–57):**
  - `task_time_limit`: **180 seconds** (3 minutes hard limit)
  - `task_soft_time_limit`: **120 seconds** (2 minutes soft limit)
  - **Beat Schedule (4 Periodic Tasks):**
    1. `periodic-monitoring-scheduler`: `crontab(minute="*/15")` — Every 15 minutes.
    2. `weekly-ssl-expiry-checker`: `crontab(hour=6, minute=0, day_of_week=1)` — Monday 06:00 UTC.
    3. `daily-subscription-reconciler`: `crontab(hour=3, minute=0)` — Daily 03:00 UTC.
    4. `stale-scan-watchdog`: `crontab(minute="*/10")` — Every 10 minutes.
- **Explanation:** The actual timeouts are tighter and more defensive (180s hard limit prevents runaway scans). The Beat scheduler manages four automated tasks, providing comprehensive background maintenance.

---

### Discrepancy 7: PDF Generation Engine
- **Previous Report Claim:** Stated that PDF reports are generated using "WeasyPrint/ReportLab".
- **Actual Code Truth (`apps/api/app/services/pdf_service.py`):**
  - Generated exclusively via **ReportLab** (`reportlab.platypus`, `reportlab.pdfgen.canvas`, `reportlab.lib.styles`) using a custom two-pass `NumberedCanvas`.
  - WeasyPrint is not used and not installed.
- **Explanation:** ReportLab is a pure Python solution that does not depend on system Cairo or Pango C-libraries, ensuring high portability in lightweight Alpine Docker containers.

---

### Discrepancy 8: Plan Quota Alignment (Frontend vs. Backend)
- **Previous Report Claim:** Phase 6 report text stated: "Free plans: 10 scans; Pro plans: 100 scans; Agency plans: 500 scans."
- **Actual Code Truth:**
  - `apps/api/app/core/permissions.py` (`PLAN_CAPABILITIES`):
    - Free: 1 Website, 10 Scans/month, 7-day retention
    - Basic: 2 Websites, 100 Scans/month, 30-day retention
    - Pro: 10 Websites, 500 Scans/month, 3 team seats, Deep Scan, 90-day retention
    - Agency: 100 Websites, 3,000 Scans/month, 15 team seats, White-label, 365-day retention
  - `apps/web/src/lib/constants.ts` (`PRICING_PLANS`):
    - Exactly matches the backend: Free (10), Basic (100), Pro (500), Agency (3,000).
- **Explanation:** The previous report text had typos regarding Pro and Agency scan counts. The frontend and backend code are in 100% agreement.

---

## 3. SUMMARY OF CURRENT RECONCILED TEST BASELINE

| Test Module | Test Count | Current Status | Notes |
|---|---|---|---|
| `tests/test_phase2_security_hardening.py` | 40 | **PASS** | SSRF, authorization, tenant isolation, RBAC |
| `tests/test_phase3_scanner_reliability.py` | 19 | **PASS** | Celery tasks, watchdog recovery, quota compensation |
| `tests/test_phase4_production_configuration.py` | 21 | **PASS** | Settings validation, rate limits, deferred payments |
| `tests/test_phase5_production_infrastructure.py` | 28 | **PASS** | Docker Compose, Nginx, backups, scripts |
| `tests/test_phase6_e2e_security_validation.py` | 21 | **PASS** | E2E security, headers, tokens, port isolation |
| **Consolidated Total** | **129** | **PASS (100%)** | Zero failures |
| Next.js TypeScript (`npx tsc --noEmit`) | 58 routes | **PASS (0 errors)** | Full type safety |
| Next.js Production Build (`next build`) | 58 routes | **PASS** | Static + dynamic compilation |
