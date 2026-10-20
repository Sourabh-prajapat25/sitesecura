#!/usr/bin/env bash
# ==============================================================================
# SITESECURA - PRODUCTION ROLLBACK SCRIPT
# Reverts the application codebase and containers to a known stable state.
# IMPORTANT: Casually downgrading database migrations is dangerous; if a schema
# migration was destructive or backward-incompatible, database restore from the
# pre-deployment backup is required rather than running alembic downgrade.
# ==============================================================================

set -euo pipefail

TARGET_REF="HEAD~1"
AUTO_CONFIRM=false
COMPOSE_FILE="docker-compose.prod.yml"

# Parse arguments
for arg in "$@"; do
    case "${arg}" in
        -y|--yes)
            AUTO_CONFIRM=true
            ;;
        *)
            TARGET_REF="${arg}"
            ;;
    esac
done

echo "=== SITESECURA PRODUCTION ROLLBACK: $(date -u) ==="
echo "Target Git Reference: ${TARGET_REF}"
echo "WARNING: Rollback reverts application code and container images."
echo "NOTE: Database schema is NOT automatically downgraded. If migrations were incompatible,"
echo "      you must restore the pre-deployment database backup using test_restore / pg_restore."

if [ "${AUTO_CONFIRM}" != "true" ]; then
    read -p "Are you sure you want to proceed with rollback to ${TARGET_REF}? [y/N] " -r CONFIRM
    if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
        echo "Rollback cancelled."
        exit 0
    fi
else
    echo "Proceeding with non-interactive rollback (-y specified)..."
fi

# 1. Checkout target reference
git checkout "${TARGET_REF}"

# 2. Rebuild and restart services
echo "Rebuilding images for ${TARGET_REF}..."
docker compose -f "${COMPOSE_FILE}" build

echo "Restarting services..."
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

echo "Verifying health..."
sleep 10
if [ -f "scripts/healthcheck.sh" ]; then
    bash scripts/healthcheck.sh || {
        echo "WARNING: Healthcheck failed after rollback. Investigate immediately." >&2
        exit 1
    }
fi

echo "=== ROLLBACK COMPLETED SUCCESSFULLY ==="
exit 0
