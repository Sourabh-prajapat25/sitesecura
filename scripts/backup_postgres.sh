#!/usr/bin/env bash
# ==============================================================================
# SITESECURA - PRODUCTION POSTGRESQL BACKUP SCRIPT
# Creates a compressed, timestamped pg_dump of the production database.
# Generates SHA-256 checksum for tamper and corruption detection.
# Applies retention cleanup and verifies non-zero dump size.
# ==============================================================================

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/sitesecura/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
CONTAINER_NAME="${CONTAINER_NAME:-scanly-prod-postgres}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-scanly}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_FILE="${BACKUP_DIR}/sitesecura_db_${TIMESTAMP}.sql.gz"

echo "=== Starting PostgreSQL Backup at $(date -u) ==="
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

# Verify container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: PostgreSQL container '${CONTAINER_NAME}' is not running!" >&2
    exit 1
fi

# Execute dump directly via container without password exposure in CLI history
echo "Streaming compressed dump to ${BACKUP_FILE}..."
if docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:-}" "${CONTAINER_NAME}" \
    pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists --no-owner --no-privileges \
    | gzip -9 > "${BACKUP_FILE}"; then
    
    # Verify file is non-empty
    FILE_SIZE=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}" 2>/dev/null || echo "0")
    if [ "${FILE_SIZE}" -lt 500 ]; then
        echo "ERROR: Backup file ${BACKUP_FILE} is suspiciously small (${FILE_SIZE} bytes). Dump may have failed!" >&2
        rm -f "${BACKUP_FILE}"
        exit 1
    fi

    echo "SUCCESS: Backup completed successfully (${FILE_SIZE} bytes)."
    chmod 600 "${BACKUP_FILE}"

    # Generate cryptographic SHA-256 checksum
    echo "Generating SHA-256 checksum..."
    (cd "${BACKUP_DIR}" && sha256sum "$(basename "${BACKUP_FILE}")" > "$(basename "${BACKUP_FILE}").sha256")
    chmod 600 "${BACKUP_FILE}.sha256"
    echo "Checksum recorded: $(cat "${BACKUP_FILE}.sha256")"
else
    echo "ERROR: pg_dump execution failed!" >&2
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# Enforce local retention policy (prune backups and checksums older than RETENTION_DAYS)
echo "Pruning backups and checksums older than ${RETENTION_DAYS} days in ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -type f \( -name "sitesecura_db_*.sql.gz" -o -name "sitesecura_db_*.sql.gz.sha256" \) -mtime +"${RETENTION_DAYS}" -exec rm -f {} +

echo "=== Backup Process Completed Successfully at $(date -u) ==="
exit 0
