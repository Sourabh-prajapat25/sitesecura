#!/usr/bin/env bash
# ==============================================================================
# SITESECURA - PRODUCTION HEALTHCHECK MONITORING SCRIPT
# Validates system health across all operational layers:
# - Docker container statuses
# - Nginx reverse proxy responsiveness
# - FastAPI API /health and /ready endpoints
# - Celery worker responsiveness
# - Host disk space threshold (<85%)
# ==============================================================================

set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
API_URL="${API_URL:-http://localhost:8000}"
NGINX_URL="${NGINX_URL:-http://localhost:80/nginx-health}"

echo "=== SITESECURA PRODUCTION HEALTHCHECK: $(date -u) ==="

# 1. Check Container Health Status
echo "Checking Docker container statuses..."
UNHEALTHY=$(docker compose -f "${COMPOSE_FILE}" ps --format '{{.Service}} {{.Health}}' | grep -v 'healthy' || true)
if [ -n "${UNHEALTHY}" ]; then
    echo "WARNING: One or more containers are not reporting 'healthy':"
    echo "${UNHEALTHY}"
else
    echo "All monitored Docker services report 'healthy'."
fi

# 2. Check Nginx Health
echo "Checking Nginx reverse proxy..."
if curl -sf "${NGINX_URL}" >/dev/null; then
    echo "Nginx reverse proxy: OK"
else
    echo "WARNING: Nginx reverse proxy endpoint (${NGINX_URL}) failed!" >&2
fi

# 3. Check Backend API Liveness
echo "Checking API Liveness (/api/v1/health)..."
HEALTH_RES=$(docker compose -f "${COMPOSE_FILE}" exec -T api curl -sf http://localhost:8000/api/v1/health || echo "FAILED")
if echo "${HEALTH_RES}" | grep -q '"status":"ok"'; then
    echo "API Liveness: OK"
else
    echo "ERROR: API Liveness probe failed! Output: ${HEALTH_RES}" >&2
    exit 1
fi

# 4. Check Backend API Readiness (Database & Redis)
echo "Checking API Readiness (/api/v1/ready)..."
READY_RES=$(docker compose -f "${COMPOSE_FILE}" exec -T api curl -sf http://localhost:8000/api/v1/ready || echo "FAILED")
if echo "${READY_RES}" | grep -q '"status":"ready"'; then
    echo "API Readiness: OK (Database & Redis connected)"
else
    echo "WARNING: API Readiness probe reported degradation! Output: ${READY_RES}"
fi

# 5. Check Celery Worker Queue Responsiveness
echo "Checking Celery worker ping..."
WORKER_PING=$(docker compose -f "${COMPOSE_FILE}" exec -T worker celery -A app.tasks.celery_app.celery_app inspect ping --timeout=3 2>/dev/null || echo "FAILED")
if echo "${WORKER_PING}" | grep -q 'pong'; then
    echo "Celery worker: OK (responded to ping)"
else
    echo "WARNING: Celery worker did not respond to ping!"
fi

# 6. Check Host Disk Usage Threshold
echo "Checking Host Disk Space..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "${DISK_USAGE}" -gt 85 ]; then
    echo "CRITICAL: Host disk usage is above 85% (${DISK_USAGE}%)!" >&2
    exit 1
elif [ "${DISK_USAGE}" -gt 70 ]; then
    echo "WARNING: Host disk usage is above 70% (${DISK_USAGE}%)."
else
    echo "Host disk usage: OK (${DISK_USAGE}% utilized)."
fi

echo "=== HEALTHCHECK COMPLETED SUCCESSFULLY ==="
exit 0
