#!/usr/bin/env bash
# ==============================================================================
# SITESECURA - PRODUCTION DEPLOYMENT AUTOMATION SCRIPT
# Executes safe, ordered production deployment with:
# - Deployment mutex lock
# - Pre-flight validation
# - Data-tier startup and readiness verification
# - Automated database backup prior to migration (conditional on existing schema)
# - Container builds
# - Alembic database migrations (with running, healthy PostgreSQL)
# - Ordered application service restarts
# - Post-deployment health verification
# ==============================================================================

set -euo pipefail

LOCK_FILE="/tmp/sitesecura_deploy.lock"
COMPOSE_FILE="docker-compose.prod.yml"

echo "=== SITESECURA PRODUCTION DEPLOYMENT START: $(date -u) ==="

# 1. Acquire Deployment Mutex Lock
exec 200>"${LOCK_FILE}"
if ! flock -n 200; then
    echo "ERROR: Another deployment is currently in progress. Aborting." >&2
    exit 1
fi

# 2. Pre-flight checks
if [ ! -f "${COMPOSE_FILE}" ]; then
    echo "ERROR: Production compose file '${COMPOSE_FILE}' not found!" >&2
    exit 1
fi

if [ ! -f ".env.production" ]; then
    echo "ERROR: '.env.production' configuration file missing!" >&2
    exit 1
fi

# Load database credentials for health checking
source .env.production || true

# 3. Pull latest git changes (if git tracked)
if [ -d ".git" ]; then
    echo "Pulling latest git changes..."
    git pull --ff-only || {
        echo "WARNING: Git pull failed or fast-forward not possible. Continuing with current checkout."
    }
fi

# 4. Start and verify core data tier (PostgreSQL & Redis)
echo "Ensuring database and broker dependencies are running..."
docker compose -f "${COMPOSE_FILE}" up -d postgres redis

echo "Waiting for PostgreSQL to be healthy and accept connections..."
DB_READY=false
for i in $(seq 1 30); do
    if docker compose -f "${COMPOSE_FILE}" exec -T postgres \
        pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scanly}" >/dev/null 2>&1; then
        DB_READY=true
        echo "PostgreSQL is ready and healthy."
        break
    fi
    sleep 1
done

if [ "${DB_READY}" != "true" ]; then
    echo "CRITICAL: PostgreSQL failed to become ready within 30 seconds! Halting deployment." >&2
    exit 1
fi

# 5. Conditional Pre-Deployment Database Backup
# Checks if the database has existing schema/tables before backing up
TABLE_COUNT=$(docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-scanly}" -t -A -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")

if [ "${TABLE_COUNT}" -gt "0" ]; then
    echo "Existing schema detected (${TABLE_COUNT} tables). Taking pre-deployment database backup..."
    if [ -f "scripts/backup_postgres.sh" ]; then
        bash scripts/backup_postgres.sh || {
            echo "CRITICAL: Pre-deployment backup failed! Aborting deployment to protect data." >&2
            exit 1
        }
    fi
else
    echo "Fresh database detected (0 public tables). Skipping pre-deployment backup."
fi

# 6. Build production container images
echo "Building production container images..."
docker compose -f "${COMPOSE_FILE}" build

# 7. Apply Database Migrations (PostgreSQL is running and healthy)
echo "Running Alembic migrations (upgrade head)..."
docker compose -f "${COMPOSE_FILE}" run --rm --no-deps api \
    alembic upgrade head || {
        echo "CRITICAL: Database migration failed! Halting deployment." >&2
        exit 1
    }

# 8. Ordered Application Service Restart
echo "Starting backend API, workers, and scheduler..."
docker compose -f "${COMPOSE_FILE}" up -d api worker beat

echo "Starting frontend and edge reverse proxy..."
docker compose -f "${COMPOSE_FILE}" up -d web nginx

# 9. Post-deployment Health Check
echo "Waiting for services to report healthy..."
sleep 10

if [ -f "scripts/healthcheck.sh" ]; then
    bash scripts/healthcheck.sh || {
        echo "WARNING: Post-deployment health checks reported degradation. Please review logs." >&2
        exit 1
    }
fi

echo "=== SITESECURA PRODUCTION DEPLOYMENT COMPLETED SUCCESSFULLY: $(date -u) ==="
exit 0
