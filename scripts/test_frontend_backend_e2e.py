"""
Comprehensive End-to-End Verification: Frontend + FastAPI + Celery
"""
import time
import httpx
import sys
import os

NEXT_URL = "http://localhost:3000"
API_BASE = "http://127.0.0.1:8000/api/v1"


def run_e2e_verification():
    print("==================================================")
    print("SCANLY E2E INTEGRATION VERIFICATION")
    print("==================================================")

    # 1. Test Next.js Landing Page Availability
    print("\n[STEP 1] Testing Next.js Landing Page...")
    res = httpx.get(f"{NEXT_URL}/", timeout=15)
    print(f"Landing page response status: {res.status_code}")
    assert res.status_code == 200, f"Expected 200 from Next.js, got {res.status_code}"
    assert "Scan Free" in res.text, "Scan Free button text not found on landing page"
    print("Landing page is up and serving HTML correctly.")

    # 2. Test CORS Preflight and Origin Validation
    print("\n[STEP 2] Testing CORS configuration on FastAPI...")
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
    }
    cors_res = httpx.options(f"{API_BASE}/scans", headers=headers, timeout=10)
    print(f"CORS preflight status: {cors_res.status_code}")
    allow_origin = cors_res.headers.get("access-control-allow-origin")
    allow_creds = cors_res.headers.get("access-control-allow-credentials")
    print(f"access-control-allow-origin: {allow_origin}")
    print(f"access-control-allow-credentials: {allow_creds}")
    assert allow_origin == "http://localhost:3000"
    assert allow_creds == "true"
    print("CORS properly allows http://localhost:3000 with credentials.")

    # 3. Simulate Public Scan Submission (example.com)
    print("\n[STEP 3] Submitting Free Scan for example.com...")
    scan_req_headers = {
        "Origin": "http://localhost:3000",
        "Content-Type": "application/json",
    }
    scan_res = httpx.post(f"{API_BASE}/scans", json={"domain": "example.com"}, headers=scan_req_headers, timeout=20)
    print(f"POST /api/v1/scans status: {scan_res.status_code}")
    assert scan_res.status_code == 201, f"Expected 201, got {scan_res.status_code}: {scan_res.text}"
    scan_json = scan_res.json()
    scan_id = scan_json.get("id")
    print(f"Returned Scan ID: {scan_id}")
    print(f"Initial Status: {scan_json.get('status')}")
    assert scan_id is not None
    assert scan_json.get("domain") == "example.com"

    # 4. Verify Next.js Scan Results Route Serves the Page for this ID
    print(f"\n[STEP 4] Accessing Next.js route /scan/{scan_id}...")
    page_res = httpx.get(f"{NEXT_URL}/scan/{scan_id}", timeout=15)
    print(f"GET /scan/{scan_id} HTTP Status: {page_res.status_code}")
    assert page_res.status_code == 200
    print("Scan results page route rendered successfully.")

    # 5. Poll Status Endpoint
    print("\n[STEP 5] Polling status endpoint until Celery completes scan...")
    terminal = False
    final_status = None
    for attempt in range(1, 25):
        time.sleep(1)
        st_res = httpx.get(f"{API_BASE}/scans/{scan_id}/status", headers={"Origin": "http://localhost:3000"}, timeout=10)
        assert st_res.status_code == 200
        st_data = st_res.json()
        status_val = st_data.get("status")
        print(f"[{attempt}s] Status: {status_val} | Score: {st_data.get('score')} | Risk: {st_data.get('risk_level')}")
        if status_val in ("completed", "failed"):
            terminal = True
            final_status = status_val
            break

    assert terminal, "Scan did not complete in 25 seconds."
    assert final_status == "completed", f"Scan ended in status {final_status}"
    print("Celery background task executed and status reached 'completed'.")

    # 6. Verify Full Scan Details and Checks
    print("\n[STEP 6] Fetching completed scan details and check results...")
    det_res = httpx.get(f"{API_BASE}/scans/{scan_id}", headers={"Origin": "http://localhost:3000"}, timeout=10)
    assert det_res.status_code == 200
    det = det_res.json()
    print(f"Target: https://{det.get('normalized_domain')}")
    print(f"Score: {det.get('score')}/100")
    print(f"Risk Level: {det.get('risk_level')}")
    print(f"Total Checks: {det.get('total_checks_count')}")
    print(f"Passed Checks: {det.get('passed_checks_count')}")
    checks = det.get("checks", [])
    print(f"Serialized Checks Count: {len(checks)}")
    assert len(checks) >= 10, "Expected at least 10 scan checks"

    # 7. Verify Public Results Endpoint
    print("\n[STEP 7] Fetching public gated scan results...")
    pub_res = httpx.get(f"{API_BASE}/scans/{scan_id}/results", headers={"Origin": "http://localhost:3000"}, timeout=10)
    assert pub_res.status_code == 200
    pub = pub_res.json()
    print(f"Unlocked findings count: {len(pub.get('unlocked_findings', []))}")
    print(f"Locked findings count: {pub.get('locked_findings_count')}")
    print(f"Is premium locked: {pub.get('is_premium_locked')}")
    assert len(pub.get("unlocked_findings", [])) == 3
    assert pub.get("is_premium_locked") is True

    # 8. Test Invalid Domain / SSRF Rejection Error Handling
    print("\n[STEP 8] Testing Invalid Domain rejection (e.g. localhost)...")
    inv_res = httpx.post(f"{API_BASE}/scans", json={"domain": "localhost"}, headers=scan_req_headers, timeout=10)
    print(f"POST /api/v1/scans with invalid domain status: {inv_res.status_code}")
    assert inv_res.status_code == 400
    inv_err = inv_res.json()
    print(f"Error payload: {inv_err}")
    assert "INVALID_DOMAIN" in str(inv_err) or "restricted" in str(inv_err) or "Invalid" in str(inv_err)
    print("Invalid domain properly rejected with clean HTTP 400.")

    print("\n==================================================")
    print("[SUCCESS] ALL END-TO-END INTEGRATION TESTS PASSED!")
    print("==================================================")


if __name__ == "__main__":
    run_e2e_verification()
