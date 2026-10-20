# SITESECURA — PHASE 7.1 FINDINGS AND CODE DEFECT FIXES

**Audit Date:** October 2026  
**Auditor:** Principal DevSecOps & Application Security Engineer  
**Scope:** Pre-Launch Defect Correction across Backend, Automation Scripts, Configuration, and Runbooks  
**Status:** **ALL CODE DEFECTS RESOLVED & VERIFIED**

---

## 1. EXECUTIVE SUMMARY

During the Phase 7 production launch review, an exhaustive audit was performed against the entire SiteSecura platform codebase, Docker infrastructure, backup scripts, and operations runbooks. While Phases 1–6 established an outstanding baseline of 129 passing automated regression tests, the Phase 7 audit uncovered six discrete implementation, operational, and documentation defects that required targeted remediation prior to public launch:

1. **AI Generation Endpoints Global Toggle Gap:** AI generation endpoints checked `AI_ENABLED` only in `/status`, meaning that when globally disabled, requests still attempted rate-limiting, tenant quota reservation, and provider invocation.
2. **Deployment Automation Sequencing Defect:** `scripts/deploy.sh` executed pre-deployment backups and Alembic database migrations prior to ensuring PostgreSQL was started and accepting connections, causing immediate failure on fresh server deployments.
3. **Backup Checksum & Verification Integrity Defect:** `scripts/backup_postgres.sh` omitted cryptographic SHA-256 checksum generation, and `scripts/test_restore.sh` did not verify checksums or record drill timing.
4. **Historical Scan Retention Policy Non-Enforcement:** `PLAN_CAPABILITIES` defined retention limits (Free: 7 days, Basic: 30 days, Pro: 90 days, Agency: 365 days), but `GET /api/v1/websites/{id}/scans` did not enforce the plan cutoff timestamp.
5. **Deferred Payment Provider HTTP Status Semantics:** Unconfigured payment gateways in production returned HTTP 500 (Internal Server Error) rather than HTTP 503 (Service Unavailable) with structured error envelopes.
6. **Docker Compose Environment File Hardcoding:** Services in `docker-compose.prod.yml` hardcoded `env_file: - .env.production`, preventing validation when specifying alternative configuration files.
7. **Operational Runbook Database Connection Remediation:** Playbook B in `PHASE7_OPERATIONS_AND_INCIDENT_RUNBOOK.md` recommended terminating idle PostgreSQL backends, which risks dropping active client-side SQLAlchemy/asyncpg connection pool sockets.

All seven defects have been corrected and verified with 138/138 automated regression tests passing.

---

## 2. DETAILED DEFECT REMEDIATION MATRIX

### Defect 1: AI Advisor Global Feature Toggle Fail-Fast
- **Component:** `apps/api/app/api/v1/ai.py`
- **Issue:** When `AI_ENABLED` was set to `False` in environment/settings, endpoints `explain_finding`, `fix_guide`, `security_summary`, `security_plan`, and `chat` still checked user rate limits, reserved monthly AI quota in the database, and initiated failover provider dispatch.
- **Root Cause:** Missing early gate function in generation handlers.
- **Remediation:**
  - Implemented `_check_ai_enabled()` helper function that raises `HTTPException(status_code=503, detail={"error": {"code": "AI_FEATURE_DISABLED", "message": "AI Security Advisor is currently disabled."}})`.
  - Added `_check_ai_enabled()` at the entry point of all five generation endpoints prior to rate-limit checks or quota reservation.
- **Verification:** Verified via `tests/test_phase7_1_readiness.py::test_p7_1_ai_disabled_fails_fast_with_503` and `test_p7_1_ai_enabled_proceeds`. All 12 existing tests in `test_ai_advisor.py` pass without regression.

---

### Defect 2: Deployment Script Startup & Migration Sequencing
- **Component:** `scripts/deploy.sh`
- **Issue:** 
  - Step 4 executed `bash scripts/backup_postgres.sh` before `postgres` was started or verified. On fresh deployments, this aborted immediately because the container was absent.
  - Step 6 ran `docker compose run --rm --no-deps api alembic upgrade head` before `postgres` was started or healthy.
- **Root Cause:** Sequential top-down script design assuming long-running preexisting database containers.
- **Remediation:**
  - Re-ordered deployment sequence:
    1. Start PostgreSQL & Redis services: `docker compose -f ${COMPOSE_FILE} up -d postgres redis`.
    2. Polling loop with `pg_isready` verifying database health within 30 seconds.
    3. Conditional pre-deployment backup: queries `information_schema.tables` for existing tables. If tables exist, executes `backup_postgres.sh`. If clean database, logs notice and skips backup.
    4. Image build: `docker compose -f ${COMPOSE_FILE} build`.
    5. Database migration: `docker compose -f ${COMPOSE_FILE} run --rm --no-deps api alembic upgrade head` with PostgreSQL running and healthy.
    6. Application startup: `docker compose -f ${COMPOSE_FILE} up -d api worker beat web nginx`.
    7. Post-deployment health verification.
- **Verification:** Validated via `tests/test_phase7_1_readiness.py::test_p7_1_deploy_script_sequencing`.

---

### Defect 3: Backup Checksumming & Restore Drill Verification
- **Component:** `scripts/backup_postgres.sh` and `scripts/test_restore.sh`
- **Issue:** Backups lacked cryptographic checksum verification, meaning corrupt or truncated archives could not be detected prior to an incident. Restore drill did not record duration or verify checksums.
- **Remediation:**
  - In `scripts/backup_postgres.sh`: Added `sha256sum "$(basename "${BACKUP_FILE}")" > "$(basename "${BACKUP_FILE}").sha256"` with `chmod 600`. Updated retention policy cleanup to prune both `.sql.gz` and `.sha256` files.
  - In `scripts/test_restore.sh`: Added automated SHA-256 validation via `sha256sum -c` prior to container decompression. Added duration timer measuring total drill execution time.
- **Verification:** Validated via `tests/test_phase7_1_readiness.py::test_p7_1_backup_and_restore_checksum_integrity`.

---

### Defect 4: Historical Scan Retention Policy Enforcement
- **Component:** `apps/api/app/api/v1/websites.py`
- **Issue:** `get_website_scan_history` (`GET /websites/{id}/scans`) retrieved scans without applying the plan-tier retention window defined in `PLAN_CAPABILITIES` (Free: 7 days, Basic: 30 days, Pro: 90 days, Agency: 365 days).
- **Remediation:**
  - In `get_website_scan_history`:
    ```python
    plan_cfg = get_plan_config(auth.plan)
    retention_days = plan_cfg.get("history_retention_days")
    if retention_days and isinstance(retention_days, int):
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        stmt = stmt.where(Scan.created_at >= cutoff)
    ```
- **Verification:** Validated via `tests/test_phase7_1_readiness.py::test_p7_1_plan_retention_capabilities`. Existing scan history tests continue to pass.

---

### Defect 5: Deferred Payment Provider Status Semantics
- **Component:** `apps/api/app/services/payment_providers/stripe_provider.py` and `razorpay_provider.py`
- **Issue:** When payment secrets were missing or placeholders in production, checkout endpoints raised HTTP 500, indicating an application fault rather than a deferred/unconfigured external integration.
- **Remediation:**
  - Changed HTTP exception code to `status.HTTP_503_SERVICE_UNAVAILABLE` with clear diagnostic code `PAYMENT_NOT_CONFIGURED` and explicit message stating that live payment processing is deferred and unconfigured.
- **Verification:** Validated via `tests/test_phase7_1_readiness.py::test_p7_1_stripe_provider_deferred_503_in_prod` and `test_p7_1_razorpay_provider_deferred_503_in_prod`.

---

### Defect 6: Docker Compose Env-File Variable Flexibility
- **Component:** `docker-compose.prod.yml`
- **Issue:** Hardcoded `env_file: - .env.production` prevented validation or alternative configurations using `ENV_FILE`.
- **Remediation:**
  - Updated `api`, `worker`, and `beat` services to specify `env_file: - ${ENV_FILE:-.env.production}`.
- **Verification:** Validated via `docker compose --env-file .env.production.example -f docker-compose.prod.yml config` and `tests/test_phase7_1_readiness.py::test_p7_1_docker_compose_env_file_variable`.

---

### Defect 7: Operations Runbook Database Connection Handling
- **Component:** `docs/PHASE7_OPERATIONS_AND_INCIDENT_RUNBOOK.md`
- **Issue:** Playbook B recommended killing idle PostgreSQL connections with `pg_terminate_backend`, which risks dropping active client-side SQLAlchemy/asyncpg pool sockets and triggering client-side connection resets. Additionally, a section heading claimed zero-downtime deployment during single-instance restart.
- **Remediation:**
  - Clarified that idle pool connections should not be terminated directly with `pg_terminate_backend`.
  - Added targeted queries to terminate stuck `active` or `idle in transaction` queries exceeding 5 minutes.
  - Recommended clean `api` container restart to reset pools if connection leakage occurs.
  - Updated restart phrasing to reflect brief sub-second container reload behind Nginx proxy retry.
- **Verification:** Manual review and confirmation against SQLAlchemy 2.0 and asyncpg connection pooling best practices.

---

## 3. SUMMARY OF MODIFIED FILES

| File | Nature of Modification | Status |
| :--- | :--- | :--- |
| `apps/api/app/api/v1/ai.py` | Added `_check_ai_enabled()` fail-fast 503 guard on all 5 generation endpoints | **VERIFIED** |
| `apps/api/app/api/v1/websites.py` | Added plan retention cutoff filter to `get_website_scan_history` | **VERIFIED** |
| `apps/api/app/services/payment_providers/stripe_provider.py` | Updated unconfigured production status to 503 `PAYMENT_NOT_CONFIGURED` | **VERIFIED** |
| `apps/api/app/services/payment_providers/razorpay_provider.py` | Updated unconfigured production status to 503 `PAYMENT_NOT_CONFIGURED` | **VERIFIED** |
| `docker-compose.prod.yml` | Updated `env_file` to `${ENV_FILE:-.env.production}` across backend services | **VERIFIED** |
| `scripts/deploy.sh` | Restructured startup sequence, added PostgreSQL health wait and conditional backup | **VERIFIED** |
| `scripts/backup_postgres.sh` | Added SHA-256 checksum generation and retention pruning for checksum files | **VERIFIED** |
| `scripts/test_restore.sh` | Added SHA-256 checksum verification and execution duration timer | **VERIFIED** |
| `scripts/rollback.sh` | Added `-y` non-interactive support and schema migration warning | **VERIFIED** |
| `docs/PHASE7_OPERATIONS_AND_INCIDENT_RUNBOOK.md` | Hardened DB connection troubleshooting and corrected restart downtime claims | **VERIFIED** |
| `tests/test_phase7_1_readiness.py` | Created comprehensive Phase 7.1 automated test suite (9 tests) | **VERIFIED** |
