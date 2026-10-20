"""
Scanly - Firebase Authentication Phase 2 Comprehensive Test Suite
Tests token verification, /auth/sync, /auth/me, idempotency, multi-tenant organization isolation, and RBAC.
"""
import pytest
import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from apps.api.main import app

client = TestClient(app)


def test_missing_authorization_returns_401():
    """1. Missing Authorization header produces 401 with clean error detail."""
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401
    data = res.json()
    assert "error" in data.get("detail", {})
    assert data["detail"]["error"]["code"] == "AUTHENTICATION_REQUIRED"


def test_invalid_bearer_token_returns_401():
    """2. Malformed or invalid Bearer token produces 401."""
    res = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer "})
    assert res.status_code == 401
    assert res.json()["detail"]["error"]["code"] == "AUTHENTICATION_REQUIRED"

    with patch("app.core.security.firebase_admin_service.verify_firebase_token_payload", side_effect=Exception("Invalid signature")):
        res2 = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.fake.token"})
        assert res2.status_code == 401
        assert res2.json()["detail"]["error"]["code"] == "INVALID_AUTH_TOKEN"


def test_expired_firebase_token_returns_401():
    """3. Expired Firebase token produces 401."""
    with patch("app.core.security.firebase_admin_service.verify_firebase_token_payload", side_effect=Exception("Token has expired")):
        res = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer expired.firebase.jwt"})
        assert res.status_code == 401
        assert res.json()["detail"]["error"]["code"] == "INVALID_AUTH_TOKEN"


def test_valid_firebase_token_verification():
    """4. Valid Firebase ID token is verified and returns authenticated user context."""
    mock_payload = {
        "uid": "fb_uid_test_101",
        "email": "sarah.connor@example.com",
        "name": "Sarah Connor",
        "email_verified": True,
        "iss": "https://securetoken.google.com/scanly-user",
        "aud": "scanly-user",
    }
    with patch("app.core.security.firebase_admin_service.verify_firebase_token_payload", return_value=mock_payload):
        res = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer mock.valid.firebase.token"})
        assert res.status_code == 200
        data = res.json()
        assert "user" in data
        assert "organization" in data
        assert "plan" in data
        assert data["plan"] == "free"
        assert data["user"]["email"] == "sarah.connor@example.com"
        assert data["user"]["name"] == "Sarah Connor"
        assert data["user"]["firebase_uid"] == "fb_uid_test_101"
        assert "Sarah Connor's Workspace" in data["organization"]["name"]


def test_auth_sync_idempotency():
    """5, 6, 7, 8. /auth/sync provisions user & org on first call and is strictly idempotent on repeated calls."""
    unique_uid = f"fb_sync_uid_{uuid.uuid4().hex[:8]}"
    mock_payload = {
        "uid": unique_uid,
        "email": f"{unique_uid}@domain.com",
        "name": "Alex Mercer",
        "email_verified": True,
    }

    with patch("app.core.security.firebase_admin_service.verify_firebase_token_payload", return_value=mock_payload):
        headers = {"Authorization": f"Bearer token_for_{unique_uid}"}

        # First sync call -> creates user and personal organization
        res1 = client.post("/api/v1/auth/sync", headers=headers)
        assert res1.status_code == 200
        data1 = res1.json()
        user_id_1 = data1["user"]["id"]
        org_id_1 = data1["organization"]["id"]
        assert data1["status"] == "synced"
        assert data1["plan"] == "free"
        assert data1["user"]["name"] == "Alex Mercer"

        # Second sync call -> must return exact same user and org (no duplicate creation)
        res2 = client.post("/api/v1/auth/sync", headers=headers)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["user"]["id"] == user_id_1
        assert data2["organization"]["id"] == org_id_1
        assert data2["plan"] == "free"

        # Third sync call -> idempotent check
        res3 = client.get("/api/v1/auth/me", headers=headers)
        assert res3.status_code == 200
        data3 = res3.json()
        assert data3["user"]["id"] == user_id_1
        assert data3["organization"]["id"] == org_id_1
        assert data3["plan"] == "free"


def test_organization_data_isolation():
    """10. User A cannot view, modify, or delete User B's websites or data."""
    headers_user_a = {"Authorization": "Bearer dev-token-usera-pro"}
    headers_user_b = {"Authorization": "Bearer dev-token-userb-pro"}

    # User A creates website
    create_res = client.post(
        "/api/v1/websites",
        headers=headers_user_a,
        json={"domain": "usera-secure-app.com", "name": "User A App"},
    )
    assert create_res.status_code == 201
    site_a_id = create_res.json()["id"]

    # User A can view website A
    get_res_a = client.get(f"/api/v1/websites/{site_a_id}", headers=headers_user_a)
    assert get_res_a.status_code == 200

    # User B CANNOT view website A -> 404
    get_res_b = client.get(f"/api/v1/websites/{site_a_id}", headers=headers_user_b)
    assert get_res_b.status_code == 404

    # User B CANNOT update website A -> 404
    patch_res_b = client.patch(
        f"/api/v1/websites/{site_a_id}",
        headers=headers_user_b,
        json={"name": "Hacked App"},
    )
    assert patch_res_b.status_code == 404

    # User B CANNOT delete website A -> 404
    del_res_b = client.delete(f"/api/v1/websites/{site_a_id}", headers=headers_user_b)
    assert del_res_b.status_code == 404


def test_admin_rbac_protection():
    """18. Non-admin users cannot access admin endpoints."""
    headers_regular = {"Authorization": "Bearer dev-token-regularuser-pro"}
    headers_admin = {"Authorization": "Bearer dev-token-superadmin-admin"}

    # Regular user receives 403 Forbidden
    res_regular = client.get("/api/v1/admin/metrics", headers=headers_regular)
    assert res_regular.status_code == 403
    assert "ADMIN_ACCESS_REQUIRED" in str(res_regular.json())

    # Admin user receives 200 OK
    res_admin = client.get("/api/v1/admin/metrics", headers=headers_admin)
    assert res_admin.status_code == 200
    assert "total_users" in res_admin.json()


def test_public_scan_remains_unauthenticated():
    """11. Public anonymous scan works with no Authorization header."""
    res = client.post("/api/v1/scans", json={"domain": "public-test-site.org"})
    assert res.status_code == 201
    data = res.json()
    assert data["domain"] == "public-test-site.org"
    assert data["scan_type"] == "public"


def test_authenticated_scan_associates_with_user():
    """12. Authenticated user scan associates with the user's account."""
    headers = {"Authorization": "Bearer dev-token-scanneruser-pro"}
    res = client.post("/api/v1/scans", headers=headers, json={"domain": "auth-test-site.org"})
    assert res.status_code == 201
    data = res.json()
    assert data["domain"] == "auth-test-site.org"
    assert data["scan_type"] == "manual"
