"""
SITESECURA - PHASE 5 PRODUCTION INFRASTRUCTURE & DEPLOYMENT TEST SUITE
Validates Docker Compose topology, port isolation, Nginx reverse proxy configuration,
Cloudflare real-IP extraction, Celery schedules, health probes, backup scripts, and runbooks.
"""

import os
import re
import pytest
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(ROOT_DIR / "apps" / "api") not in sys.path:
    sys.path.insert(0, str(ROOT_DIR / "apps" / "api"))

from fastapi.testclient import TestClient

from apps.api.main import app
from app.tasks.celery_app import celery_app
from app.core.config import settings

client = TestClient(app)


# ==============================================================================
# 1. API HEALTH & READINESS ENDPOINT TESTS
# ==============================================================================

def test_api_health_endpoint():
    """Verify /api/v1/health returns ok status and environment metadata."""
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "Scanly API" in data["service"] or "SiteSecura" in data["service"]
    assert "environment" in data


def test_api_readiness_endpoint_structure():
    """Verify /api/v1/ready checks database and redis connectivity and sanitizes errors."""
    res = client.get("/api/v1/ready")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert "database" in data
    assert "redis" in data
    assert "environment" in data
    # Ensure no credentials or tracebacks leak into response body
    raw_text = res.text.lower()
    assert "password" not in raw_text
    assert "traceback" not in raw_text
    assert "secret" not in raw_text


# ==============================================================================
# 2. DOCKER COMPOSE PRODUCTION TOPOLOGY TESTS
# ==============================================================================

def test_production_compose_file_exists():
    """Verify docker-compose.prod.yml exists in repository root."""
    compose_path = ROOT_DIR / "docker-compose.prod.yml"
    assert compose_path.is_file(), "docker-compose.prod.yml must exist"


def test_production_compose_port_isolation():
    """
    CRITICAL: Verify port isolation in docker-compose.prod.yml.
    ONLY Nginx may bind ports 80 and 443 to host.
    Postgres, Redis, API, Web, Worker, Beat must NEVER bind public host ports.
    """
    compose_path = ROOT_DIR / "docker-compose.prod.yml"
    content = compose_path.read_text(encoding="utf-8")

    # Check Nginx binds 80:80 and 443:443
    assert '"80:80"' in content or "'80:80'" in content or "- 80:80" in content
    assert '"443:443"' in content or "'443:443'" in content or "- 443:443" in content

    # Check Postgres does NOT bind 5432:5432
    assert "5432:5432" not in content, "Postgres port 5432 must not be bound to host in production!"

    # Check Redis does NOT bind 6379:6379
    assert "6379:6379" not in content, "Redis port 6379 must not be bound to host in production!"

    # Check API does NOT bind 8000:8000
    assert "8000:8000" not in content, "API port 8000 must not be bound to host in production!"

    # Check Web does NOT bind 3000:3000
    assert "3000:3000" not in content, "Web port 3000 must not be bound to host in production!"


def test_production_compose_service_inventory():
    """Verify all 7 required logical services are defined in docker-compose.prod.yml."""
    compose_path = ROOT_DIR / "docker-compose.prod.yml"
    content = compose_path.read_text(encoding="utf-8")

    required_services = ["postgres", "redis", "api", "worker", "beat", "web", "nginx"]
    for service in required_services:
        pattern = rf"^\s+{service}:"
        assert re.search(pattern, content, re.MULTILINE), f"Service '{service}' missing from production compose!"


def test_production_compose_persistent_volumes():
    """Verify persistent volumes are declared for postgres, redis, and reports."""
    compose_path = ROOT_DIR / "docker-compose.prod.yml"
    content = compose_path.read_text(encoding="utf-8")

    assert "postgres_data:" in content
    assert "redis_data:" in content
    assert "storage_reports:" in content


def test_production_compose_healthchecks_and_restart():
    """Verify healthchecks and restart policies are defined for critical services."""
    compose_path = ROOT_DIR / "docker-compose.prod.yml"
    content = compose_path.read_text(encoding="utf-8")

    assert "pg_isready" in content
    assert "redis-cli" in content
    assert "restart: unless-stopped" in content


def test_production_compose_log_rotation():
    """Verify Docker log rotation options are configured to prevent disk exhaustion."""
    compose_path = ROOT_DIR / "docker-compose.prod.yml"
    content = compose_path.read_text(encoding="utf-8")

    assert "json-file" in content
    assert "max-size" in content
    assert "max-file" in content


# ==============================================================================
# 3. NGINX PRODUCTION CONFIGURATION TESTS
# ==============================================================================

def test_nginx_production_config_exists():
    """Verify infra/nginx.prod.conf exists."""
    nginx_path = ROOT_DIR / "infra" / "nginx.prod.conf"
    assert nginx_path.is_file(), "infra/nginx.prod.conf must exist"


def test_nginx_cloudflare_real_ip_configuration():
    """Verify Nginx restores visitor client IP from Cloudflare CF-Connecting-IP."""
    nginx_path = ROOT_DIR / "infra" / "nginx.prod.conf"
    content = nginx_path.read_text(encoding="utf-8")

    assert "set_real_ip_from" in content
    assert "real_ip_header CF-Connecting-IP;" in content


def test_nginx_http_to_https_redirect():
    """Verify port 80 redirects to HTTPS."""
    nginx_path = ROOT_DIR / "infra" / "nginx.prod.conf"
    content = nginx_path.read_text(encoding="utf-8")

    assert "listen 80" in content
    assert "return 301 https://$host$request_uri;" in content


def test_nginx_tls_and_security_headers():
    """Verify TLS protocols and critical security headers are configured."""
    nginx_path = ROOT_DIR / "infra" / "nginx.prod.conf"
    content = nginx_path.read_text(encoding="utf-8")

    assert "TLSv1.2 TLSv1.3" in content
    assert "Strict-Transport-Security" in content
    assert "X-Content-Type-Options" in content
    assert "X-Frame-Options" in content
    assert "Referrer-Policy" in content


def test_nginx_storage_access_blocked():
    """Verify direct static access to /storage/ is forbidden in Nginx."""
    nginx_path = ROOT_DIR / "infra" / "nginx.prod.conf"
    content = nginx_path.read_text(encoding="utf-8")

    assert "location ~* ^/storage/ {" in content
    assert "return 403;" in content


def test_nginx_request_id_correlation():
    """Verify Nginx injects X-Request-ID into upstream proxy requests."""
    nginx_path = ROOT_DIR / "infra" / "nginx.prod.conf"
    content = nginx_path.read_text(encoding="utf-8")

    assert "proxy_set_header X-Request-ID $request_id;" in content


# ==============================================================================
# 4. CELERY BEAT SCHEDULE & WORKER CONCURRENCY TESTS
# ==============================================================================

def test_celery_beat_schedule_registered():
    """Verify Celery Beat has stale scan recovery watchdog and monitoring tasks scheduled."""
    schedule = celery_app.conf.beat_schedule
    assert "stale-scan-watchdog" in schedule
    assert schedule["stale-scan-watchdog"]["task"] == "app.tasks.worker.recover_stale_scans_task"

    assert "periodic-monitoring-scheduler" in schedule
    assert schedule["periodic-monitoring-scheduler"]["task"] == "app.tasks.worker.schedule_monitored_scans_task"


def test_celery_task_timeouts_configured():
    """Verify Celery tasks have hard and soft time limits configured."""
    conf = celery_app.conf
    assert conf.task_time_limit is not None
    assert conf.task_time_limit <= 300  # <= 5 minutes
    assert conf.task_soft_time_limit is not None
    assert conf.task_soft_time_limit < conf.task_time_limit


def test_dockerfile_worker_linux_concurrency():
    """Verify Dockerfile.worker uses standard Linux Celery worker concurrency without Windows --pool=solo."""
    worker_dockerfile = ROOT_DIR / "infra" / "Dockerfile.worker"
    content = worker_dockerfile.read_text(encoding="utf-8")

    assert "--pool=solo" not in content, "Windows --pool=solo must NOT be in production Dockerfile.worker!"
    assert "worker" in content
    assert "USER scanly" in content


def test_dockerfile_api_non_root():
    """Verify Dockerfile.api runs as non-root user scanly."""
    api_dockerfile = ROOT_DIR / "infra" / "Dockerfile.api"
    content = api_dockerfile.read_text(encoding="utf-8")

    assert "USER scanly" in content
    assert "HEALTHCHECK" in content


def test_dockerfile_web_non_root():
    """Verify Dockerfile.web uses multi-stage build and runs as non-root user nextjs."""
    web_dockerfile = ROOT_DIR / "infra" / "Dockerfile.web"
    content = web_dockerfile.read_text(encoding="utf-8")

    assert "AS builder" in content
    assert "AS runner" in content
    assert "USER nextjs" in content


# ==============================================================================
# 5. BACKUP & DEPLOYMENT AUTOMATION SCRIPT TESTS
# ==============================================================================

def test_backup_postgres_script_integrity():
    """Verify scripts/backup_postgres.sh exists, has safe bash options, and pg_dump compression."""
    script_path = ROOT_DIR / "scripts" / "backup_postgres.sh"
    assert script_path.is_file()
    content = script_path.read_text(encoding="utf-8")

    assert "set -euo pipefail" in content
    assert "pg_dump" in content
    assert "gzip" in content
    assert "RETENTION_DAYS" in content


def test_backup_reports_script_integrity():
    """Verify scripts/backup_reports.sh exists and archives storage reports."""
    script_path = ROOT_DIR / "scripts" / "backup_reports.sh"
    assert script_path.is_file()
    content = script_path.read_text(encoding="utf-8")

    assert "set -euo pipefail" in content
    assert "tar -czf" in content
    assert "RETENTION_DAYS" in content


def test_restore_drill_script_integrity():
    """Verify scripts/test_restore.sh creates an isolated container and validates key tables."""
    script_path = ROOT_DIR / "scripts" / "test_restore.sh"
    assert script_path.is_file()
    content = script_path.read_text(encoding="utf-8")

    assert "set -euo pipefail" in content
    assert "postgres:16-alpine" in content
    for table in ["users", "organizations", "scans", "scan_checks", "reports"]:
        assert table in content, f"Table '{table}' must be verified during restore drill!"


def test_deploy_script_integrity():
    """Verify scripts/deploy.sh includes deployment mutex, pre-migration backup, and health checks."""
    script_path = ROOT_DIR / "scripts" / "deploy.sh"
    assert script_path.is_file()
    content = script_path.read_text(encoding="utf-8")

    assert "flock" in content
    assert "backup_postgres.sh" in content
    assert "alembic upgrade head" in content
    assert "healthcheck.sh" in content


def test_healthcheck_script_integrity():
    """Verify scripts/healthcheck.sh checks containers, API health/readiness, worker ping, and disk threshold."""
    script_path = ROOT_DIR / "scripts" / "healthcheck.sh"
    assert script_path.is_file()
    content = script_path.read_text(encoding="utf-8")

    assert "api/v1/health" in content
    assert "api/v1/ready" in content
    assert "celery" in content
    assert "df -h" in content


def test_rollback_script_integrity():
    """Verify scripts/rollback.sh exists and requires user confirmation."""
    script_path = ROOT_DIR / "scripts" / "rollback.sh"
    assert script_path.is_file()
    content = script_path.read_text(encoding="utf-8")

    assert "git checkout" in content
    assert "CONFIRM" in content


# ==============================================================================
# 6. REPOSITORY HYGIENE & PRODUCTION TEMPLATE TESTS
# ==============================================================================

def test_dockerignore_rules():
    """Verify .dockerignore excludes sensitive secrets, git, and build caches."""
    dockerignore_path = ROOT_DIR / ".dockerignore"
    assert dockerignore_path.is_file()
    content = dockerignore_path.read_text(encoding="utf-8")

    assert ".git" in content
    assert ".env" in content
    assert "node_modules" in content
    assert ".next" in content
    assert "__pycache__" in content


def test_env_production_example_template():
    """Verify .env.production.example contains all required production parameters without real secrets."""
    example_path = ROOT_DIR / ".env.production.example"
    assert example_path.is_file()
    content = example_path.read_text(encoding="utf-8")

    required_vars = [
        "ENVIRONMENT=production",
        "SECRET_KEY=",
        "DATABASE_URL=",
        "REDIS_URL=",
        "NEXT_PUBLIC_APP_URL=",
        "ALLOWED_ORIGINS=",
        "FIREBASE_PROJECT_ID=",
    ]
    for var in required_vars:
        assert var in content, f"Variable {var} missing from .env.production.example"


def test_production_documentation_suite():
    """Verify all three production operation documents exist."""
    assert (ROOT_DIR / "docs" / "PRODUCTION_DEPLOYMENT.md").is_file()
    assert (ROOT_DIR / "docs" / "PRODUCTION_RUNBOOK.md").is_file()
    assert (ROOT_DIR / "docs" / "PRODUCTION_ARCHITECTURE.md").is_file()
