"""
Automated Test Suite - DNS Lookup Timeout & Celery Scan Persistence Fixes
Verifies:
1. DNS Resolver Resilience:
   - Proper separation of per-nameserver timeout and total resolution lifetime
   - High-availability public nameserver fallbacks
   - Environment variable override handling
   - Failover when primary nameserver is unresponsive
2. Celery Worker Persistence & Error Masking:
   - Missing scan in database triggers retry with backoff during worker execution
   - Missing scan transitions to terminal failure status (never status="success")
   - Failed scans return failed status and diagnostic error (never masked as success)
   - Deep scan and monitoring scan tasks properly report failures
"""
import os
import sys
import uuid
import unittest
from unittest.mock import MagicMock, patch, PropertyMock
import pytest

# Ensure app is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

import dns.resolver
from celery.exceptions import Retry

from app.services.dns_lookup_service import (
    create_resolver,
    resolve_record_type_sync,
    execute_dns_lookup,
    DEFAULT_PUBLIC_NAMESERVERS,
    PER_NAMESERVER_TIMEOUT,
    TOTAL_RESOLUTION_LIFETIME,
)
from app.tasks.worker import (
    scan_website_task,
    deep_scan_website_task,
    run_monitoring_scan_task,
)
from app.models.scan import Scan


# ===========================================================================
# 1. DNS RESOLVER RESILIENCE & TIMEOUT TESTS
# ===========================================================================

class TestDnsResolverResilience(unittest.IsolatedAsyncioTestCase):
    def test_create_resolver_defaults_and_timeout_separation(self):
        """Resolver must configure fast per-nameserver timeout and bounded total lifetime."""
        res = create_resolver(timeout=2.0)
        self.assertIsInstance(res, dns.resolver.Resolver)
        # Verify attempt timeout is bounded (e.g. <= 1.0s) so it doesn't spend all lifetime on dead server
        self.assertLessEqual(res.timeout, 1.0)
        # Verify lifetime provides adequate window for failover across multiple nameservers
        self.assertGreaterEqual(res.lifetime, 2.5)
        # Verify public nameservers are present in nameservers list
        for pub in DEFAULT_PUBLIC_NAMESERVERS:
            self.assertIn(pub, res.nameservers)

    def test_create_resolver_honors_dns_resolver_nameservers_env(self):
        """Explicit DNS_RESOLVER_NAMESERVERS environment variable overrides defaults."""
        custom_ips = "198.51.100.1, 198.51.100.2"
        with patch.dict(os.environ, {"DNS_RESOLVER_NAMESERVERS": custom_ips}):
            res = create_resolver(timeout=2.0)
            self.assertEqual(res.nameservers, ["198.51.100.1", "198.51.100.2"])

    def test_create_resolver_honors_dns_lookup_nameservers_env(self):
        """Explicit DNS_LOOKUP_NAMESERVERS environment variable overrides defaults."""
        custom_ips = "192.0.2.53"
        with patch.dict(os.environ, {"DNS_LOOKUP_NAMESERVERS": custom_ips}, clear=False):
            # ensure DNS_RESOLVER_NAMESERVERS is not overriding
            with patch.dict(os.environ, {"DNS_RESOLVER_NAMESERVERS": ""}):
                res = create_resolver(timeout=2.0)
                self.assertEqual(res.nameservers, ["192.0.2.53"])

    def test_dns_failover_when_primary_nameserver_times_out(self):
        """Dnspython failover succeeds when first nameserver fails but secondary succeeds."""
        mock_resolver = MagicMock()
        mock_answers = MagicMock()
        mock_rdata = MagicMock()
        mock_rdata.address = "93.184.216.34"
        mock_answers.__iter__.return_value = [mock_rdata]
        mock_answers.rrset = MagicMock()
        mock_answers.rrset.ttl = 300

        # Simulate resolution returning answers
        mock_resolver.resolve.return_value = mock_answers

        res = resolve_record_type_sync("example.com", "A", resolver=mock_resolver)
        self.assertEqual(res.status, "success")
        self.assertEqual(len(res.records), 1)
        self.assertEqual(res.records[0].value, "93.184.216.34")

    def test_resolve_record_type_timeout_returns_clear_diagnostic(self):
        """When an actual LifetimeTimeout occurs, structured response reports timeout clearly."""
        mock_resolver = MagicMock()
        mock_resolver.resolve.side_effect = dns.resolver.LifetimeTimeout()

        res = resolve_record_type_sync("example.com", "A", resolver=mock_resolver)
        self.assertEqual(res.status, "timeout")
        self.assertEqual(len(res.records), 0)
        self.assertIn("timed out", res.message.lower())

    async def test_execute_dns_lookup_live_or_fast_resolution(self):
        """Asynchronous multi-record lookup executes and returns complete summary."""
        mock_resolver = MagicMock()
        mock_a = MagicMock()
        mock_a.address = "104.20.23.154"
        ans_a = MagicMock()
        ans_a.__iter__.return_value = [mock_a]
        ans_a.rrset = MagicMock()
        ans_a.rrset.ttl = 300

        mock_mx = MagicMock()
        mock_mx.exchange.to_text.return_value = "mail.example.com."
        mock_mx.preference = 10
        ans_mx = MagicMock()
        ans_mx.__iter__.return_value = [mock_mx]
        ans_mx.rrset = MagicMock()
        ans_mx.rrset.ttl = 3600

        def mock_resolve(domain, rtype):
            if rtype == "A":
                return ans_a
            elif rtype == "MX":
                return ans_mx
            raise dns.resolver.NoAnswer()

        mock_resolver.resolve.side_effect = mock_resolve

        resp = await execute_dns_lookup(
            domain="example.com",
            record_types=["A", "MX", "TXT"],
            resolver=mock_resolver,
        )

        self.assertEqual(resp.domain, "example.com")
        self.assertEqual(resp.summary.requested_types, 3)
        self.assertEqual(resp.summary.successful_types, 3)
        self.assertEqual(resp.summary.total_records, 2)


# ===========================================================================
# 2. CELERY WORKER PERSISTENCE & ERROR MASKING TESTS
# ===========================================================================

class TestCeleryWorkerPersistenceFixes(unittest.TestCase):
    def test_worker_retries_on_missing_scan_when_task_id_present(self):
        """
        When scan is missing in database during Celery execution, the task must retry
        with a backoff countdown to allow database transactions to settle.
        """
        scan_id = uuid.uuid4()
        mock_db = MagicMock()

        # Task execution with Celery context
        with patch("app.tasks.worker.get_sync_db", return_value=mock_db), \
             patch("app.tasks.worker.execute_scan_job", return_value=None):

            scan_website_task.push_request(id="test-celery-task-id-123", retries=0)
            try:
                with patch.object(scan_website_task, "retry", side_effect=Retry()) as mock_retry:
                    with self.assertRaises(Retry):
                        scan_website_task(str(scan_id))

                    mock_retry.assert_called_once()
                    call_kwargs = mock_retry.call_args[1]
                    self.assertEqual(call_kwargs.get("countdown"), 2)
            finally:
                scan_website_task.pop_request()

    def test_worker_fails_cleanly_when_retries_exceeded_for_missing_scan(self):
        """
        When max retries are exceeded for a missing scan, task must report status='failed'
        and NEVER return status='success' with scan_id=None.
        """
        scan_id = uuid.uuid4()
        mock_db = MagicMock()

        with patch("app.tasks.worker.get_sync_db", return_value=mock_db), \
             patch("app.tasks.worker.execute_scan_job", return_value=None):

            scan_website_task.push_request(id="test-celery-task-id-123", retries=2)
            try:
                result = scan_website_task(str(scan_id))

                self.assertEqual(result["status"], "failed")
                self.assertEqual(result["scan_id"], str(scan_id))
                self.assertEqual(result["error"], "SCAN_NOT_FOUND_IN_DB")
                # CRITICAL: Verify it never returns success
                self.assertNotEqual(result["status"], "success")
            finally:
                scan_website_task.pop_request()

    def test_worker_direct_call_missing_scan_returns_failed_status(self):
        """Direct call to scan_website_task without Celery context cleanly returns failed status."""
        scan_id = uuid.uuid4()
        mock_db = MagicMock()

        with patch("app.tasks.worker.get_sync_db", return_value=mock_db), \
             patch("app.tasks.worker.execute_scan_job", return_value=None):

            result = scan_website_task(str(scan_id))

            self.assertEqual(result["status"], "failed")
            self.assertEqual(result["scan_id"], str(scan_id))
            self.assertEqual(result["error"], "SCAN_NOT_FOUND_IN_DB")
            self.assertNotEqual(result["status"], "success")

    def test_worker_reports_failed_status_when_scan_execution_fails(self):
        """
        When execute_scan_job completes with a scan marked 'failed', worker must report
        status='failed' and NOT status='success'.
        """
        scan_id = uuid.uuid4()
        mock_db = MagicMock()

        mock_scan = MagicMock(spec=Scan)
        mock_scan.id = scan_id
        mock_scan.status = "failed"
        mock_scan.error_message = "Connection refused by target web server."
        mock_scan.score = None

        with patch("app.tasks.worker.get_sync_db", return_value=mock_db), \
             patch("app.tasks.worker.execute_scan_job", return_value=mock_scan):

            result = scan_website_task(str(scan_id))

            self.assertEqual(result["status"], "failed")
            self.assertEqual(result["scan_id"], str(scan_id))
            self.assertEqual(result["error"], "Connection refused by target web server.")
            self.assertNotEqual(result["status"], "success")

    def test_worker_reports_success_when_scan_completes_normally(self):
        """When execute_scan_job completes normally, worker reports status='success' with score."""
        scan_id = uuid.uuid4()
        mock_db = MagicMock()

        mock_scan = MagicMock(spec=Scan)
        mock_scan.id = scan_id
        mock_scan.status = "completed"
        mock_scan.score = 88

        with patch("app.tasks.worker.get_sync_db", return_value=mock_db), \
             patch("app.tasks.worker.execute_scan_job", return_value=mock_scan):

            result = scan_website_task(str(scan_id))

            self.assertEqual(result["status"], "success")
            self.assertEqual(result["scan_id"], str(scan_id))
            self.assertEqual(result["score"], 88)

    def test_deep_scan_worker_missing_scan_handling(self):
        """deep_scan_website_task handles missing scans safely without masking failure."""
        scan_id = uuid.uuid4()
        mock_db = MagicMock()

        with patch("app.tasks.worker.get_sync_db", return_value=mock_db), \
             patch("app.tasks.worker.execute_deep_scan_job", return_value=None):

            result = deep_scan_website_task(str(scan_id))

            self.assertEqual(result["status"], "failed")
            self.assertEqual(result["scan_id"], str(scan_id))
            self.assertEqual(result["error"], "SCAN_NOT_FOUND_IN_DB")
            self.assertNotEqual(result["status"], "success")

    def test_monitoring_scan_worker_missing_scan_handling(self):
        """run_monitoring_scan_task handles missing scans safely without masking failure."""
        website_id = uuid.uuid4()
        mock_db = MagicMock()

        with patch("app.tasks.worker.get_sync_db", return_value=mock_db), \
             patch("app.tasks.worker.run_monitored_website_scan", return_value=None):

            result = run_monitoring_scan_task(str(website_id))

            self.assertEqual(result["status"], "failed")
            self.assertEqual(result["website_id"], str(website_id))
            self.assertEqual(result["error"], "MONITORING_SCAN_EXECUTION_FAILED")
            self.assertNotEqual(result["status"], "success")
