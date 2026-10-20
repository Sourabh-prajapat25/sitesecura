"""
Automated Test Suite - FastAPI Endpoints, Celery Registration & RBAC
Tests API routing, Celery task discovery, public scans, authenticated CRUD, and organization data isolation.
"""
import pytest
import asyncio
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
import sys
import os

# Add paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from apps.api.main import app
from app.db.base import Base
from app.db.session import get_db, get_sync_db
import app.db.session as session_module
from app.tasks.celery_app import celery_app

# Test SQLite Engines
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
test_async_engine = create_async_engine(TEST_DB_URL, echo=False)
TestAsyncSessionLocal = async_sessionmaker(bind=test_async_engine, class_=AsyncSession, expire_on_commit=False)

TEST_SYNC_DB_URL = "sqlite:///:memory:"
test_sync_engine = create_engine(TEST_SYNC_DB_URL, echo=False)
TestSyncSessionLocal = sessionmaker(bind=test_sync_engine, class_=Session, expire_on_commit=False)

# Override get_db dependency
async def override_get_db():
    async with TestAsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

def override_get_sync_db():
    return TestSyncSessionLocal()

app.dependency_overrides[get_db] = override_get_db
session_module.get_sync_db = override_get_sync_db


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    # Setup tables in sync engine for sync operations and async engine for async operations
    Base.metadata.create_all(bind=test_sync_engine)

    async def init_async():
        async with test_async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(init_async())
    yield


@pytest.fixture(autouse=True)
def mock_background_scan(monkeypatch):
    app.dependency_overrides[get_db] = override_get_db
    session_module.get_sync_db = override_get_sync_db
    from unittest.mock import MagicMock
    monkeypatch.setattr("app.api.v1.scans.scan_website_task.delay", MagicMock())
    monkeypatch.setattr("app.api.v1.scans.execute_scan_job", MagicMock())
    yield
    app.dependency_overrides.pop(get_db, None)


client = TestClient(app)


def test_health_endpoints():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_celery_task_registration():
    """Verify Celery registers all worker tasks."""
    registered = set(celery_app.tasks.keys())
    assert "app.tasks.worker.scan_website_task" in registered
    assert "app.tasks.worker.run_monitoring_scan_task" in registered
    assert "app.tasks.worker.schedule_monitored_scans_task" in registered
    assert "app.tasks.worker.check_ssl_expiries_task" in registered


def test_invalid_domain_rejected():
    response = client.post("/api/v1/scans", json={"domain": "localhost"})
    assert response.status_code == 400
    assert "error" in response.json() or "detail" in response.json()


def test_create_scan_and_response_serialization():
    """Verify POST /api/v1/scans creates a scan and serializes correctly without MissingGreenlet."""
    response = client.post("/api/v1/scans", json={"domain": "example.com"})
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["domain"] == "example.com"
    assert data["normalized_domain"] == "example.com"
    assert "status" in data
    assert "checks" in data
    assert isinstance(data["checks"], list)

    scan_id = data["id"]

    # Test status endpoint
    status_res = client.get(f"/api/v1/scans/{scan_id}/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["id"] == scan_id
    assert "status" in status_data

    # Test details endpoint
    details_res = client.get(f"/api/v1/scans/{scan_id}")
    assert details_res.status_code == 200
    details_data = details_res.json()
    assert details_data["id"] == scan_id
    assert details_data["domain"] == "example.com"
    assert isinstance(details_data["checks"], list)

    # Test results endpoint
    results_res = client.get(f"/api/v1/scans/{scan_id}/results")
    assert results_res.status_code == 200
    results_data = results_res.json()
    assert results_data["id"] == scan_id
    assert "unlocked_findings" in results_data


def test_authenticated_endpoints_require_token():
    response = client.get("/api/v1/websites")
    assert response.status_code == 401


def test_auth_me_with_dev_token():
    headers = {"Authorization": "Bearer dev-token-testuser-pro"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "user" in data
    assert "organization" in data
    assert data["user"]["email"] == "testuser@example.com"


def test_rbac_feature_gating():
    # Free user trying to access white-label settings
    headers = {"Authorization": "Bearer dev-token-freeuser-free"}
    response = client.patch(
        "/api/v1/agency/white-label",
        headers=headers,
        json={"brand_name": "My Agency"},
    )
    assert response.status_code == 403
    data = response.json()
    assert "FEATURE_UPGRADE_REQUIRED" in str(data)


def test_create_checkout_monthly_and_yearly():
    headers = {"Authorization": "Bearer dev-token-testuser-pro"}
    # Test monthly
    res_m = client.post(
        "/api/v1/billing/checkout",
        headers=headers,
        json={"plan": "pro", "interval": "month", "provider": "stripe"},
    )
    assert res_m.status_code == 200
    data_m = res_m.json()
    assert "checkout_url" in data_m
    assert "mock_interval=month" in data_m["checkout_url"]

    # Test yearly
    res_y = client.post(
        "/api/v1/billing/checkout",
        headers=headers,
        json={"plan": "pro", "interval": "year", "provider": "stripe"},
    )
    assert res_y.status_code == 200
    data_y = res_y.json()
    assert "checkout_url" in data_y
    assert "mock_interval=year" in data_y["checkout_url"]

    # Test invalid plan
    res_inv = client.post(
        "/api/v1/billing/checkout",
        headers=headers,
        json={"plan": "invalid_tier", "interval": "month"},
    )
    assert res_inv.status_code == 422

    # Test invalid interval
    res_inv_int = client.post(
        "/api/v1/billing/checkout",
        headers=headers,
        json={"plan": "pro", "interval": "decade"},
    )
    assert res_inv_int.status_code == 422

