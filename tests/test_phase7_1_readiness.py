"""
Phase 7.1 Pre-Launch Defect Correction & Release Evidence Test Suite
Validates specific implementation, deployment, recovery and security fixes:
1. AI feature toggle fail-fast behavior (HTTP 503 AI_FEATURE_DISABLED)
2. History retention policy filtering
3. Payment provider deferred 503 semantics in production
4. Deployment script ordering (postgres readiness before backup & migrations)
5. Backup SHA-256 checksumming & restore integrity verification
6. Rollback non-interactive mode and schema warnings
7. Docker compose flexible env_file configuration
"""
import os
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch
import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core.permissions import PLAN_CAPABILITIES, get_plan_config
from app.services.payment_providers.stripe_provider import StripePaymentProvider
from app.services.payment_providers.razorpay_provider import RazorpayPaymentProvider
from app.models.user import Organization, User
from app.api.v1.ai import _check_ai_enabled

ROOT_DIR = Path(__file__).resolve().parent.parent


def test_p7_1_ai_disabled_fails_fast_with_503():
    """Verify AI generation endpoints fail fast with 503 AI_FEATURE_DISABLED when toggled off."""
    with patch.object(settings, "AI_ENABLED", False):
        with pytest.raises(HTTPException) as exc_info:
            _check_ai_enabled()
        assert exc_info.value.status_code == 503
        assert exc_info.value.detail["error"]["code"] == "AI_FEATURE_DISABLED"


def test_p7_1_ai_enabled_proceeds():
    """Verify AI check succeeds without error when AI_ENABLED is True."""
    with patch.object(settings, "AI_ENABLED", True):
        # Should not raise any exception
        _check_ai_enabled()


def test_p7_1_plan_retention_capabilities():
    """Verify history retention matrix across all tiers."""
    assert PLAN_CAPABILITIES["free"]["history_retention_days"] == 7
    assert PLAN_CAPABILITIES["basic"]["history_retention_days"] == 30
    assert PLAN_CAPABILITIES["pro"]["history_retention_days"] == 90
    assert PLAN_CAPABILITIES["agency"]["history_retention_days"] == 365

    # Test cutoff calculation
    now = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
    free_cutoff = now - timedelta(days=PLAN_CAPABILITIES["free"]["history_retention_days"])
    assert free_cutoff == datetime(2026, 10, 2, 12, 0, 0, tzinfo=timezone.utc)


def test_p7_1_stripe_provider_deferred_503_in_prod():
    """Verify unconfigured Stripe provider raises 503 PAYMENT_NOT_CONFIGURED in production."""
    provider = StripePaymentProvider()
    org = Organization(id=uuid.uuid4(), name="P7 Org")
    user = User(id=uuid.uuid4(), email="p7@example.com")

    with patch.object(settings, "ENVIRONMENT", "production"):
        with patch.object(settings, "STRIPE_SECRET_KEY", "sk_test_placeholder"):
            with pytest.raises(HTTPException) as exc_info:
                provider.create_checkout_session(
                    organization=org,
                    user=user,
                    plan_name="pro",
                    interval="month",
                    currency="usd",
                )
            assert exc_info.value.status_code == 503
            assert exc_info.value.detail["error"]["code"] == "PAYMENT_NOT_CONFIGURED"


def test_p7_1_razorpay_provider_deferred_503_in_prod():
    """Verify unconfigured Razorpay provider raises 503 PAYMENT_NOT_CONFIGURED in production."""
    provider = RazorpayPaymentProvider()
    org = Organization(id=uuid.uuid4(), name="P7 Org")
    user = User(id=uuid.uuid4(), email="p7@example.com")

    with patch.object(settings, "ENVIRONMENT", "production"):
        with patch.object(settings, "RAZORPAY_KEY_ID", "rzp_test_placeholder"):
            with patch.object(settings, "RAZORPAY_KEY_SECRET", "secret_test_placeholder"):
                with pytest.raises(HTTPException) as exc_info:
                    provider.create_checkout_session(
                        organization=org,
                        user=user,
                        plan_name="pro",
                        interval="month",
                        currency="inr",
                    )
                assert exc_info.value.status_code == 503
                assert exc_info.value.detail["error"]["code"] == "PAYMENT_NOT_CONFIGURED"


def test_p7_1_docker_compose_env_file_variable():
    """Verify docker-compose.prod.yml supports ENV_FILE variable interpolation."""
    compose_path = ROOT_DIR / "docker-compose.prod.yml"
    assert compose_path.is_file()
    content = compose_path.read_text(encoding="utf-8")
    assert "${ENV_FILE:-.env.production}" in content
    # Ensure raw non-interpolated .env.production is not left under env_file
    for line in content.splitlines():
        if "- .env.production" in line:
            assert False, f"Hardcoded env_file found: {line}"


def test_p7_1_deploy_script_sequencing():
    """Verify deploy.sh verifies PostgreSQL health before backup and migrations."""
    deploy_path = ROOT_DIR / "scripts" / "deploy.sh"
    assert deploy_path.is_file()
    content = deploy_path.read_text(encoding="utf-8")

    # Order checks: postgres up must appear before alembic upgrade head
    up_idx = content.find("up -d postgres redis")
    pg_ready_idx = content.find("pg_isready")
    backup_idx = content.find("backup_postgres.sh")
    alembic_idx = content.find("alembic upgrade head")
    apps_up_idx = content.find("up -d api worker beat")

    assert up_idx != -1, "deploy.sh must start postgres and redis"
    assert pg_ready_idx != -1, "deploy.sh must check pg_isready"
    assert backup_idx != -1, "deploy.sh must include pre-deployment backup"
    assert alembic_idx != -1, "deploy.sh must run alembic upgrade head"
    assert apps_up_idx != -1, "deploy.sh must start apps"

    assert up_idx < pg_ready_idx < backup_idx < alembic_idx < apps_up_idx, (
        "Incorrect execution order in deploy.sh: "
        f"up={up_idx}, pg_ready={pg_ready_idx}, backup={backup_idx}, "
        f"alembic={alembic_idx}, apps_up={apps_up_idx}"
    )


def test_p7_1_backup_and_restore_checksum_integrity():
    """Verify backup script creates SHA-256 and restore drill verifies it."""
    backup_path = ROOT_DIR / "scripts" / "backup_postgres.sh"
    restore_path = ROOT_DIR / "scripts" / "test_restore.sh"

    backup_content = backup_path.read_text(encoding="utf-8")
    restore_content = restore_path.read_text(encoding="utf-8")

    assert "sha256sum" in backup_content, "backup_postgres.sh must generate sha256sum"
    assert ".sha256" in backup_content, "backup_postgres.sh must write .sha256 file"

    assert "sha256sum -c" in restore_content, "test_restore.sh must verify sha256sum -c"
    assert "DRILL_START_TIME" in restore_content, "test_restore.sh must record start time"
    assert "DRILL_DURATION" in restore_content, "test_restore.sh must report duration"


def test_p7_1_rollback_non_interactive_and_migration_warning():
    """Verify rollback.sh supports -y flag and includes schema migration warning."""
    rollback_path = ROOT_DIR / "scripts" / "rollback.sh"
    content = rollback_path.read_text(encoding="utf-8")

    assert "-y|--yes" in content, "rollback.sh must support -y/--yes argument"
    assert "Database schema is NOT automatically downgraded" in content, (
        "rollback.sh must explicitly warn about schema migration limits"
    )
