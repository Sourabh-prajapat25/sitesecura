"""
Live End-to-End Integration Verification Script
Tests POST /api/v1/scans, Celery background execution, status polling, and database persistence.
"""
import time
import httpx
import sys
import os

# Add paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.db.session import get_sync_db
from app.models.scan import Scan, ScanCheck

API_BASE = "http://127.0.0.1:8000/api/v1"


def test_live_scan_workflow():
    print("=== STEP 1: Creating Scan via POST /api/v1/scans ===")
    create_res = httpx.post(f"{API_BASE}/scans", json={"domain": "example.com"}, timeout=30)
    print(f"POST /api/v1/scans HTTP Status: {create_res.status_code}")
    assert create_res.status_code == 201, f"Expected 201, got {create_res.status_code}: {create_res.text}"

    scan_data = create_res.json()
    scan_id = scan_data["id"]
    print(f"Created Scan ID: {scan_id}")
    print(f"Initial Status: {scan_data.get('status')}")
    print(f"Checks field serialized: {type(scan_data.get('checks'))} (len: {len(scan_data.get('checks', []))})")

    print("\n=== STEP 2: Polling Scan Status via GET /api/v1/scans/{id}/status ===")
    completed = False
    for attempt in range(1, 30):
        time.sleep(1)
        status_res = httpx.get(f"{API_BASE}/scans/{scan_id}/status", timeout=10)
        assert status_res.status_code == 200
        st = status_res.json()
        current_status = st.get("status")
        print(f"[{attempt}s] Scan Status: {current_status} | Score: {st.get('score')} | Risk: {st.get('risk_level')}")
        if current_status in ("completed", "failed"):
            completed = True
            break

    assert completed, "Scan did not reach terminal status in 30 seconds"
    assert current_status == "completed", f"Scan ended in status {current_status}"

    print("\n=== STEP 3: Fetching Full Scan Details via GET /api/v1/scans/{id} ===")
    details_res = httpx.get(f"{API_BASE}/scans/{scan_id}", timeout=10)
    assert details_res.status_code == 200
    details = details_res.json()
    print(f"Score: {details.get('score')}/100")
    print(f"Risk Level: {details.get('risk_level')}")
    print(f"Total Checks Count: {details.get('total_checks_count')}")
    print(f"Passed Checks Count: {details.get('passed_checks_count')}")
    print(f"Serialized Checks in Response: {len(details.get('checks', []))}")
    assert len(details.get("checks", [])) > 0, "Expected checks to be populated"

    print("\n=== STEP 4: Fetching Public Results via GET /api/v1/scans/{id}/results ===")
    results_res = httpx.get(f"{API_BASE}/scans/{scan_id}/results", timeout=10)
    assert results_res.status_code == 200
    results = results_res.json()
    print(f"Unlocked Findings: {len(results.get('unlocked_findings', []))}")
    print(f"Locked Findings Count: {results.get('locked_findings_count')}")
    print(f"Is Premium Locked: {results.get('is_premium_locked')}")

    print("\n=== STEP 5: Verifying Persistence in PostgreSQL Database ===")
    sync_db = get_sync_db()
    try:
        from uuid import UUID
        db_scan = sync_db.query(Scan).filter_by(id=UUID(scan_id)).first()
        assert db_scan is not None, "Scan not found in PostgreSQL"
        print(f"PostgreSQL Scan Row: id={db_scan.id}, status={db_scan.status}, score={db_scan.score}")

        db_checks = sync_db.query(ScanCheck).filter_by(scan_id=UUID(scan_id)).all()
        print(f"PostgreSQL Scan Checks Count: {len(db_checks)}")
        assert len(db_checks) > 0, "No scan checks found in database"
        for c in db_checks[:3]:
            print(f"  - [{c.status.upper()}] {c.name} (score impact: {c.score_impact})")
    finally:
        sync_db.close()

    print("\n[SUCCESS] ALL STEPS PASSED VERIFICATION!")


if __name__ == "__main__":
    test_live_scan_workflow()
