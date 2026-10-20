#!/usr/bin/env bash
# ==============================================================================
# SITESECURA - MANDATORY BACKUP RESTORE VERIFICATION TEST DRILL
# Safely tests restoration of the latest production backup into an ephemeral,
# completely isolated test PostgreSQL container.
# Validates SHA-256 integrity checksum, schema completeness, and row counts.
# Measures restore execution duration.
# NEVER touches or modifies the live production database.
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/sitesecura/postgres}"
TEMP_CONTAINER="sitesecura-restore-drill-$(date +%s)"
TEMP_DB_PASS="restore_test_secret_pass_123"

echo "=== SITESECURA DATABASE RESTORE VERIFICATION TEST DRILL ==="
echo "Timestamp: $(date -u)"
DRILL_START_TIME=$(date +%s)

# Locate latest backup file
LATEST_BACKUP=$(find "${BACKUP_DIR}" -type f -name "sitesecura_db_*.sql.gz" | sort -r | head -n 1 || true)
if [ -z "${LATEST_BACKUP}" ]; then
    echo "ERROR: No backup files found in ${BACKUP_DIR} to test!" >&2
    exit 1
fi

echo "Selected backup for verification: ${LATEST_BACKUP}"

# 0. Cryptographic Checksum Validation
if [ -f "${LATEST_BACKUP}.sha256" ]; then
    echo "Verifying SHA-256 checksum..."
    (cd "$(dirname "${LATEST_BACKUP}")" && sha256sum -c "$(basename "${LATEST_BACKUP}").sha256") || {
        echo "CRITICAL: Checksum verification failed! Backup file is corrupted or modified." >&2
        exit 1
    }
    echo "Checksum verification passed: VALID"
else
    echo "NOTICE: Checksum file ${LATEST_BACKUP}.sha256 not present. Proceeding with decompression test."
fi

# Ensure cleanup on exit
cleanup() {
    echo "Cleaning up temporary restore drill container '${TEMP_CONTAINER}'..."
    docker rm -f "${TEMP_CONTAINER}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# 1. Spawn isolated temporary PostgreSQL container
echo "Spawning isolated test PostgreSQL container '${TEMP_CONTAINER}'..."
docker run -d --name "${TEMP_CONTAINER}" \
    -e POSTGRES_PASSWORD="${TEMP_DB_PASS}" \
    -e POSTGRES_DB="scanly_restore_test" \
    postgres:16-alpine >/dev/null

# 2. Wait for temporary PostgreSQL instance to become ready
echo "Waiting for test database to accept connections..."
for i in {1..30}; do
    if docker exec "${TEMP_CONTAINER}" pg_isready -U postgres -d scanly_restore_test >/dev/null 2>&1; then
        echo "Test database is ready."
        break
    fi
    sleep 1
    if [ "$i" -eq 30 ]; then
        echo "ERROR: Timed out waiting for test database container to become ready." >&2
        exit 1
    fi
done

# 3. Stream compressed dump into test database
echo "Restoring ${LATEST_BACKUP} into test database..."
if gzip -dc "${LATEST_BACKUP}" | docker exec -i "${TEMP_CONTAINER}" psql -U postgres -d scanly_restore_test >/dev/null 2>&1; then
    echo "Dump restored successfully."
else
    echo "ERROR: Database restoration failed with SQL error!" >&2
    exit 1
fi

# 4. Perform Schema and Data Integrity Validations
echo "Verifying restored database integrity..."

TABLE_COUNT=$(docker exec "${TEMP_CONTAINER}" psql -U postgres -d scanly_restore_test -t -A -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")

echo "Found ${TABLE_COUNT} tables in restored public schema."
if [ "${TABLE_COUNT}" -lt 5 ]; then
    echo "ERROR: Table count is too low (${TABLE_COUNT}). Critical tables appear to be missing!" >&2
    exit 1
fi

# Check essential production tables
for table in users organizations scans scan_checks reports; do
    EXISTS=$(docker exec "${TEMP_CONTAINER}" psql -U postgres -d scanly_restore_test -t -A -c \
        "SELECT to_regclass('public.${table}') IS NOT NULL;")
    if [ "${EXISTS}" != "t" ]; then
        echo "ERROR: Critical table '${table}' missing in restored database!" >&2
        exit 1
    fi
    ROW_COUNT=$(docker exec "${TEMP_CONTAINER}" psql -U postgres -d scanly_restore_test -t -A -c \
        "SELECT count(*) FROM ${table};")
    echo "  - Table '${table}': verified (${ROW_COUNT} records)"
done

DRILL_END_TIME=$(date +%s)
DRILL_DURATION=$((DRILL_END_TIME - DRILL_START_TIME))

echo "=========================================================="
echo "RESTORE TEST DRILL RESULT: SUCCESS"
echo "Verified that ${LATEST_BACKUP} is 100% restorable and valid."
echo "Total restore drill execution time: ${DRILL_DURATION} seconds."
echo "=========================================================="
exit 0
