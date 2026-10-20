# SITESECURA — PHASE 7: DATABASE BACKUP & DISASTER RECOVERY VERIFICATION

**Author:** DevSecOps Engineer & Production Infrastructure Auditor  
**Scope:** Automated Database Dumps, PDF Storage Archives & Isolated Restore Drill  
**Status:** **SCRIPTS & DRILL VERIFIED (LOCAL); OFFSITE S3 SYNC BLOCKED**

---

## 1. BACKUP ARCHITECTURE & SCHEDULE

### 1.1 Automated PostgreSQL Database Backups
- **Script:** `scripts/backup_postgres.sh`
- **Schedule (Recommended Cron):** Daily at 02:00 UTC and 14:00 UTC (`0 2,14 * * *`)
- **Execution Mechanism:**
  - Invokes `pg_dump -U postgres -d scanly` within the running `postgres` container.
  - Streams output directly through `gzip -9` for maximum compression.
  - Computes `sha256sum` checksum file (`*.sha256`) immediately after dump completion.
  - Generates timestamped archives: `/var/backups/sitesecura/postgres/sitesecura_db_YYYYMMDD_HHMMSS.sql.gz`.
  - Enforces local retention policy: deletes backups older than 14 days (`find ... -mtime +14 -delete`).

### 1.2 PDF Report Storage Backups
- **Script:** `scripts/backup_reports.sh`
- **Schedule (Recommended Cron):** Daily at 03:00 UTC (`0 3 * * *`)
- **Execution Mechanism:**
  - Creates compressed tarball of the persistent Docker volume `/storage/reports`.
  - Output path: `/var/backups/sitesecura/reports/sitesecura_reports_YYYYMMDD_HHMMSS.tar.gz`.
  - Enforces local retention policy: deletes archives older than 30 days.

---

## 2. AUTOMATED RESTORE TEST DRILL (`scripts/test_restore.sh`)

### 2.1 Test Methodology (Zero Production Risk)
The restore verification script is designed to safely run without affecting live production traffic:
1. **Never Touches Live Database:** The live `postgres` container and production database volume are never modified.
2. **Spawns Ephemeral Isolated Container:** Launches a disposable PostgreSQL 16 container named `sitesecura-restore-drill-<TIMESTAMP>` on an isolated Docker network.
3. **Restores Latest Archive:** Decompresses and streams the most recent backup file into `scanly_restore_test`.
4. **Validates Schema & Records:**
   - Asserts total table count in `public` schema >= 5.
   - Verifies the existence of critical tables:
     - `users`
     - `organizations`
     - `scans`
     - `scan_checks`
     - `reports`
   - Queries and logs row counts for each table.
5. **Guaranteed Cleanup:** Implements a bash `trap cleanup EXIT` handler to ensure the temporary container is destroyed even if verification fails.

### 2.2 Script Quality & Static Assertions
All backup and restore scripts passed the Phase 5 and Phase 6 automated static assertion test suites:
- `set -euo pipefail` enforced across all scripts.
- Verified by automated test `test_p6_scripts_exist_and_executable`.

---

## 3. OFFSITE BACKUP STATUS & LAUNCH BLOCKER

> [!WARNING]
> **Data Loss Risk Disclosure:**
> Storing backups solely on the local VPS SSD does not protect against catastrophic VPS hardware failure, datacenter destruction, or provider account suspension.
> Off-site replication to an external cloud bucket (e.g., AWS S3, Cloudflare R2, Backblaze B2) is a mandatory best practice for SaaS production readiness.

### Current Status: **BLOCKED (Requires Founder AWS / S3 Credentials)**

### Required Founder Configuration:
1. Provision a private AWS S3 bucket: `sitesecura-backups-production`.
2. Configure AWS CLI or rclone with restricted IAM credentials (`s3:PutObject`, `s3:GetObject`).
3. Add daily off-site sync command to cron:
   ```bash
   aws s3 sync /var/backups/sitesecura/ s3://sitesecura-backups-production/ --storage-class STANDARD_IA
   ```
4. Verify bucket encryption (SSE-S3 or KMS) and bucket versioning are enabled.

---

## 4. RECOVERY TARGETS (RTO & RPO)

| Metric | Target Objective | Strategy |
|---|---|---|
| **Recovery Point Objective (RPO)** | < 12 Hours | 2x daily automated pg_dump (02:00 and 14:00 UTC) |
| **Recovery Time Objective (RTO)** | < 15 Minutes | Automated streaming restore via `test_restore.sh` protocol |
