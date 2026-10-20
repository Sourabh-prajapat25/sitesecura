#!/usr/bin/env bash
# ==============================================================================
# SITESECURA - PRODUCTION REPORT ARTIFACTS BACKUP SCRIPT
# Archives persistent PDF security reports into timestamped compressed tarballs.
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/sitesecura/reports}"
REPORT_VOLUME="${REPORT_VOLUME:-scanly_storage_reports}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
ARCHIVE_FILE="${BACKUP_DIR}/sitesecura_reports_${TIMESTAMP}.tar.gz"

echo "=== Starting Reports Archive Backup at $(date -u) ==="
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

# Archive volume contents safely using a transient helper container
echo "Archiving volume ${REPORT_VOLUME} into ${ARCHIVE_FILE}..."
if docker run --rm \
    -v "${REPORT_VOLUME}:/source:ro" \
    -v "${BACKUP_DIR}:/backup" \
    alpine:3.19 \
    tar -czf "/backup/sitesecura_reports_${TIMESTAMP}.tar.gz" -C /source .; then

    echo "SUCCESS: Reports archive created successfully."
    chmod 600 "${ARCHIVE_FILE}"
else
    echo "ERROR: Report archive process failed!" >&2
    exit 1
fi

# Prune old archives
echo "Pruning report archives older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "sitesecura_reports_*.tar.gz" -mtime +"${RETENTION_DAYS}" -exec rm -f {} +

echo "=== Reports Archive Backup Completed Successfully at $(date -u) ==="
exit 0
