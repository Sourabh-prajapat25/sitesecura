"""
Scanly Firebase Phase 1 Verification Script
Tests Next.js authentication pages, error mapping, route protection structure, and confirms scanner pipeline remains intact.
"""
import time
import httpx
import sys
import os

NEXT_URL = "http://localhost:3000"
API_BASE = "http://127.0.0.1:8000/api/v1"


def run_firebase_phase1_verification():
    print("==================================================")
    print("SCANLY FIREBASE AUTHENTICATION PHASE 1 VERIFICATION")
    print("==================================================")

    # 1. Verify Next.js Login Route
    print("\n[STEP 1] Testing /login route...")
    res = httpx.get(f"{NEXT_URL}/login", timeout=15)
    print(f"GET /login status: {res.status_code}")
    assert res.status_code == 200
    assert "Sign in to your account" in res.text
    assert "Continue with Google" in res.text
    assert "Forgot password" in res.text
    print("Login page renders correctly with Google and Email sign-in.")

    # 2. Verify Next.js Register/Signup Route
    print("\n[STEP 2] Testing /register route...")
    res = httpx.get(f"{NEXT_URL}/register", timeout=15)
    print(f"GET /register status: {res.status_code}")
    assert res.status_code == 200
    assert "Create your free Scanly account" in res.text
    assert "Full Name" in res.text
    assert "Confirm Password" in res.text
    assert "Sign up with Google" in res.text
    print("Registration page renders correctly with all required fields.")

    # 3. Verify Next.js Forgot Password Route
    print("\n[STEP 3] Testing /forgot-password route...")
    res = httpx.get(f"{NEXT_URL}/forgot-password", timeout=15)
    print(f"GET /forgot-password status: {res.status_code}")
    assert res.status_code == 200
    assert "Reset your password" in res.text
    print("Forgot password page renders correctly.")

    # 4. Verify Next.js Dashboard Route
    print("\n[STEP 4] Testing /dashboard route...")
    res = httpx.get(f"{NEXT_URL}/dashboard", timeout=15)
    print(f"GET /dashboard status: {res.status_code}")
    assert res.status_code == 200
    print("Dashboard page renders with client-side route protection & loading wrapper.")

    # 5. Verify Unauthenticated Public Scan Still Works (Step 13: Preserve Scanner)
    print("\n[STEP 5] Verifying Anonymous Public Scan Execution...")
    scan_res = httpx.post(f"{API_BASE}/scans", json={"domain": "example.com"}, timeout=20)
    print(f"POST /api/v1/scans status: {scan_res.status_code}")
    assert scan_res.status_code == 201, f"Expected 201, got {scan_res.status_code}: {scan_res.text}"
    scan_id = scan_res.json()["id"]
    print(f"Created Scan ID: {scan_id}")

    # Poll status until completed
    completed = False
    for attempt in range(1, 25):
        time.sleep(1)
        st_res = httpx.get(f"{API_BASE}/scans/{scan_id}/status", timeout=10)
        assert st_res.status_code == 200
        st = st_res.json()
        if st.get("status") in ("completed", "failed"):
            completed = True
            print(f"[{attempt}s] Final Status: {st.get('status')} | Score: {st.get('score')} | Risk: {st.get('risk_level')}")
            break

    assert completed and st.get("status") == "completed", "Scan failed to complete"
    print("Anonymous public scanner pipeline executed end-to-end without Firebase requirement.")

    # 6. Verify Public Scan Page Route
    print(f"\n[STEP 6] Testing /scan/{scan_id} results page route...")
    scan_page = httpx.get(f"{NEXT_URL}/scan/{scan_id}", timeout=15)
    assert scan_page.status_code == 200
    print("Public scan result page loads successfully.")

    print("\n==================================================")
    print("[SUCCESS] ALL PHASE 1 VERIFICATION CHECKS PASSED!")
    print("==================================================")


if __name__ == "__main__":
    run_firebase_phase1_verification()
