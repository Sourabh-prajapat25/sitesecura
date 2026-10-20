"""
Scanly Phase 2 Live Backend Integration Verification Script
Performs live end-to-end tests against running FastAPI, Celery, PostgreSQL, and Next.js services.
"""
import time
import httpx
import uuid
import sys

API_BASE = "http://127.0.0.1:8000/api/v1"
NEXT_URL = "http://localhost:3000"


def run_phase2_live_verification():
    print("==================================================")
    print("SCANLY FIREBASE AUTHENTICATION PHASE 2 LIVE VERIFICATION")
    print("==================================================")

    # 1. Test missing Authorization header on /auth/me
    print("\n[STEP 1] Testing unauthenticated /auth/me...")
    res = httpx.get(f"{API_BASE}/auth/me")
    print(f"GET /auth/me status: {res.status_code}")
    assert res.status_code == 401
    err_data = res.json()
    assert err_data["detail"]["error"]["code"] == "AUTHENTICATION_REQUIRED"
    print("Missing token properly rejected with HTTP 401 (AUTHENTICATION_REQUIRED).")

    # 2. Test invalid Bearer token
    print("\n[STEP 2] Testing invalid Bearer token...")
    res = httpx.get(f"{API_BASE}/auth/me", headers={"Authorization": "Bearer invalid_malformed_token"})
    print(f"GET /auth/me (invalid token) status: {res.status_code}")
    assert res.status_code == 401
    assert res.json()["detail"]["error"]["code"] == "INVALID_AUTH_TOKEN"
    print("Invalid token properly rejected with HTTP 401 (INVALID_AUTH_TOKEN).")

    # 3. Test /auth/sync for newly registered user
    unique_name = f"user_{uuid.uuid4().hex[:6]}"
    auth_headers = {"Authorization": f"Bearer dev-token-{unique_name}-free"}
    print(f"\n[STEP 3] Testing /auth/sync for new user '{unique_name}'...")
    sync_res = httpx.post(f"{API_BASE}/auth/sync", headers=auth_headers)
    print(f"POST /auth/sync status: {sync_res.status_code}")
    assert sync_res.status_code == 200
    sync_data = sync_res.json()
    assert sync_data["status"] == "synced"
    user_id = sync_data["user"]["id"]
    org_id = sync_data["organization"]["id"]
    assert sync_data["user"]["email"] == f"{unique_name}@example.com"
    assert f"User {unique_name}'s Workspace" in sync_data["organization"]["name"]
    print(f"New user successfully synced into PostgreSQL: User ID: {user_id}, Org ID: {org_id}")

    # 4. Test /auth/sync idempotency
    print("\n[STEP 4] Testing /auth/sync idempotency (second & third calls)...")
    sync_res_2 = httpx.post(f"{API_BASE}/auth/sync", headers=auth_headers)
    assert sync_res_2.status_code == 200
    sync_data_2 = sync_res_2.json()
    assert sync_data_2["user"]["id"] == user_id
    assert sync_data_2["organization"]["id"] == org_id

    me_res = httpx.get(f"{API_BASE}/auth/me", headers=auth_headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["user"]["id"] == user_id
    assert me_data["organization"]["id"] == org_id
    print("Idempotency verified: repeated sync calls returned identical user and organization without duplicates.")

    # 5. Test Organization Data Isolation
    print("\n[STEP 5] Testing Organization Data Isolation...")
    user_b_headers = {"Authorization": "Bearer dev-token-userb_test-pro"}
    # User A creates a website
    create_site_res = httpx.post(
        f"{API_BASE}/websites",
        headers=auth_headers,
        json={"domain": f"{unique_name}-app.com", "name": f"{unique_name} App"},
    )
    assert create_site_res.status_code == 201
    site_id = create_site_res.json()["id"]

    # User A can access website
    get_site_a = httpx.get(f"{API_BASE}/websites/{site_id}", headers=auth_headers)
    assert get_site_a.status_code == 200

    # User B CANNOT access User A's website (must return 404)
    get_site_b = httpx.get(f"{API_BASE}/websites/{site_id}", headers=user_b_headers)
    assert get_site_b.status_code == 404
    print(f"Organization data isolation verified: User B attempting to access site {site_id} received HTTP 404.")

    # 6. Test Admin Role Gating
    print("\n[STEP 6] Testing Admin Role Gating...")
    admin_res_regular = httpx.get(f"{API_BASE}/admin/metrics", headers=auth_headers)
    assert admin_res_regular.status_code == 403
    assert admin_res_regular.json()["detail"]["error"]["code"] == "ADMIN_ACCESS_REQUIRED"

    admin_headers = {"Authorization": "Bearer dev-token-adminuser-admin"}
    admin_res = httpx.get(f"{API_BASE}/admin/metrics", headers=admin_headers)
    assert admin_res.status_code == 200
    assert "total_users" in admin_res.json()
    print("Admin authorization verified: regular user got 403, admin got 200.")

    # 7. Test Public Anonymous Scanner (Unchanged & Working)
    print("\n[STEP 7] Verifying Public Anonymous Scan...")
    pub_scan_res = httpx.post(f"{API_BASE}/scans", json={"domain": "example.com"})
    assert pub_scan_res.status_code == 201
    pub_scan_id = pub_scan_res.json()["id"]
    assert pub_scan_res.json()["scan_type"] == "public"

    # Poll status until completed by Celery
    for _ in range(25):
        time.sleep(1)
        st = httpx.get(f"{API_BASE}/scans/{pub_scan_id}/status").json()
        if st.get("status") in ("completed", "failed"):
            print(f"Public scan finished with status: {st.get('status')}, score: {st.get('score')}")
            break
    assert st.get("status") == "completed"
    print("Public anonymous scanner successfully ran via Celery and persisted to DB.")

    # 8. Test Authenticated Scan
    print("\n[STEP 8] Verifying Authenticated User Scan...")
    auth_scan_res = httpx.post(
        f"{API_BASE}/scans",
        headers=auth_headers,
        json={"domain": f"{unique_name}-app.com", "website_id": site_id},
    )
    assert auth_scan_res.status_code == 201
    auth_scan_data = auth_scan_res.json()
    assert auth_scan_data["scan_type"] == "manual"
    assert auth_scan_data["website_id"] == site_id
    print("Authenticated scan verified and associated with user's website.")

    print("\n==================================================")
    print("[SUCCESS] ALL PHASE 2 LIVE INTEGRATION CHECKS PASSED!")
    print("==================================================")


if __name__ == "__main__":
    run_phase2_live_verification()
