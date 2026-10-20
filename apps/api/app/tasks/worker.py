"""
Scanly API - Background Worker Tasks
Executes scans, scheduled monitoring, SSL expiration audits, and alerts.
"""
import os
import sys
import uuid
import logging
from datetime import datetime, timezone, timedelta

# Ensure project root and apps/api directory are on python path
current_dir = os.path.dirname(os.path.abspath(__file__))
api_root = os.path.abspath(os.path.join(current_dir, "..", ".."))
project_root = os.path.abspath(os.path.join(api_root, "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
if api_root not in sys.path:
    sys.path.insert(0, api_root)

from sqlalchemy import select, and_, or_
from celery.exceptions import SoftTimeLimitExceeded, MaxRetriesExceededError, Retry
from app.tasks.celery_app import celery_app
from app.db.session import get_sync_db
from app.services.scan_service import execute_scan_job, execute_deep_scan_job
from app.services.monitoring_service import run_monitored_website_scan
from app.models.scan import Scan
from app.models.website import Website, Monitoring
from app.models.billing import Subscription
from app.core.permissions import PLAN_CAPABILITIES, normalize_plan_name
from app.core.config import settings
from app.services.entitlement_service import refund_scan_quota_sync
from app.services.audit_service import record_audit_event_sync

logger = logging.getLogger(__name__)


def _mark_scan_failed_safe(db, scan_id: uuid.UUID, error_message: str):
    """
    Safely marks a scan failed in DB if not already completed, setting completed_at
    and refunding quota if applicable.
    """
    try:
        stmt = select(Scan).where(Scan.id == scan_id)
        scan = db.execute(stmt).scalar_one_or_none()
        if scan and scan.status != "completed":
            scan.status = "failed"
            scan.error_message = error_message
            scan.completed_at = datetime.now(timezone.utc)
            if scan.organization_id:
                try:
                    refund_scan_quota_sync(db, scan.organization_id, scan=scan)
                except Exception as q_err:
                    logger.warning(f"Could not refund quota for failed scan {scan_id}: {q_err}")
            db.commit()
    except Exception as db_err:
        logger.error(f"Failed to mark scan {scan_id} failed in DB: {db_err}")
        try:
            db.rollback()
        except Exception:
            pass


@celery_app.task(name="app.tasks.worker.scan_website_task", bind=True, max_retries=2, default_retry_delay=10)
def scan_website_task(self, scan_id_str: str):
    """Celery worker task to execute security scan."""
    scan_id = uuid.UUID(scan_id_str)
    db = get_sync_db()
    try:
        logger.info(f"Starting Celery scan task for scan_id: {scan_id}")
        scan = execute_scan_job(scan_id, db)
        if not scan:
            retries = getattr(self.request, "retries", 0)
            max_retries = getattr(self, "max_retries", 2)
            has_task_id = bool(getattr(self.request, "id", None))
            if retries < max_retries and has_task_id:
                logger.warning(
                    f"Scan {scan_id} not found in database on attempt {retries + 1}/{max_retries + 1}. "
                    "Retrying task after 2s countdown to accommodate database commit / replication lag..."
                )
                raise self.retry(countdown=2, exc=ValueError(f"Scan {scan_id} not yet visible in database"))
            else:
                logger.error(
                    f"Scan {scan_id} not found in database after {retries + 1} attempts. Task marked as failed."
                )
                return {"status": "failed", "scan_id": str(scan_id), "error": "SCAN_NOT_FOUND_IN_DB"}

        if scan.status == "failed":
            logger.error(f"Scan {scan_id} completed in failed state: {scan.error_message}")
            return {"status": "failed", "scan_id": str(scan.id), "error": scan.error_message or "SCAN_FAILED"}

        return {"status": "success", "scan_id": str(scan.id), "score": scan.score}
    except Retry:
        raise
    except SoftTimeLimitExceeded:
        logger.error(f"Task scan_website_task exceeded soft time limit (120s) for {scan_id}")
        _mark_scan_failed_safe(db, scan_id, "Scan timed out (exceeded worker soft time limit).")
        return {"status": "failed", "scan_id": str(scan_id), "error": "SOFT_TIME_LIMIT_EXCEEDED"}
    except MaxRetriesExceededError:
        logger.critical(f"Task scan_website_task max retries exceeded for {scan_id}")
        _mark_scan_failed_safe(db, scan_id, "Scan task failed after maximum retries.")
        raise
    except Exception as exc:
        logger.error(f"Task scan_website_task attempt {self.request.retries + 1}/{self.max_retries + 1} failed for {scan_id}: {exc}")
        try:
            raise self.retry(exc=exc)
        except MaxRetriesExceededError:
            _mark_scan_failed_safe(db, scan_id, f"Scan task failed after maximum retries: {exc}")
            raise
    finally:
        db.close()


@celery_app.task(name="app.tasks.worker.deep_scan_website_task", bind=True, max_retries=2, default_retry_delay=15)
def deep_scan_website_task(self, scan_id_str: str):
    """Celery worker task to execute deep website security scan."""
    scan_id = uuid.UUID(scan_id_str)
    db = get_sync_db()
    try:
        logger.info(f"Starting Celery deep scan task for scan_id: {scan_id}")
        scan = execute_deep_scan_job(scan_id, db)
        if not scan:
            retries = getattr(self.request, "retries", 0)
            max_retries = getattr(self, "max_retries", 2)
            has_task_id = bool(getattr(self.request, "id", None))
            if retries < max_retries and has_task_id:
                logger.warning(
                    f"Deep scan {scan_id} not found in database on attempt {retries + 1}/{max_retries + 1}. "
                    "Retrying task after 2s countdown to accommodate database commit / replication lag..."
                )
                raise self.retry(countdown=2, exc=ValueError(f"Deep scan {scan_id} not yet visible in database"))
            else:
                logger.error(
                    f"Deep scan {scan_id} not found in database after {retries + 1} attempts. Task marked as failed."
                )
                return {"status": "failed", "scan_id": str(scan_id), "error": "SCAN_NOT_FOUND_IN_DB"}

        if scan.status == "failed":
            logger.error(f"Deep scan {scan_id} completed in failed state: {scan.error_message}")
            return {"status": "failed", "scan_id": str(scan.id), "error": scan.error_message or "SCAN_FAILED"}

        return {"status": "success", "scan_id": str(scan.id), "score": scan.score}
    except Retry:
        raise
    except SoftTimeLimitExceeded:
        logger.error(f"Task deep_scan_website_task exceeded soft time limit (120s) for {scan_id}")
        _mark_scan_failed_safe(db, scan_id, "Deep scan timed out (exceeded worker soft time limit).")
        return {"status": "failed", "scan_id": str(scan_id), "error": "SOFT_TIME_LIMIT_EXCEEDED"}
    except MaxRetriesExceededError:
        logger.critical(f"Task deep_scan_website_task max retries exceeded for {scan_id}")
        _mark_scan_failed_safe(db, scan_id, "Deep scan task failed after maximum retries.")
        raise
    except Exception as exc:
        logger.error(f"Task deep_scan_website_task attempt {self.request.retries + 1}/{self.max_retries + 1} failed for {scan_id}: {exc}")
        try:
            raise self.retry(exc=exc)
        except MaxRetriesExceededError:
            _mark_scan_failed_safe(db, scan_id, f"Deep scan task failed after maximum retries: {exc}")
            raise
    finally:
        db.close()


@celery_app.task(name="app.tasks.worker.run_monitoring_scan_task", bind=True, max_retries=2, default_retry_delay=30)
def run_monitoring_scan_task(self, website_id_str: str):
    """Celery worker task to execute scheduled monitoring scan with retry safety."""
    website_id = uuid.UUID(website_id_str)
    db = get_sync_db()
    try:
        logger.info(f"Executing scheduled monitoring scan for website {website_id}")
        scan = run_monitored_website_scan(website_id, db)
        if not scan:
            return {"status": "failed", "website_id": str(website_id), "error": "MONITORING_SCAN_EXECUTION_FAILED"}
        if scan.status == "failed":
            return {"status": "failed", "website_id": str(website_id), "scan_id": str(scan.id), "error": scan.error_message or "SCAN_FAILED"}
        return {
            "status": "success",
            "website_id": str(website_id),
            "scan_id": str(scan.id),
            "score": scan.score,
        }
    except SoftTimeLimitExceeded:
        logger.error(f"Task run_monitoring_scan_task exceeded soft time limit (120s) for website {website_id}")
        return {"status": "failed", "website_id": str(website_id), "error": "SOFT_TIME_LIMIT_EXCEEDED"}
    except MaxRetriesExceededError:
        logger.critical(f"Task run_monitoring_scan_task max retries exceeded for website {website_id}")
        raise
    except Exception as exc:
        logger.error(f"Task run_monitoring_scan_task attempt {self.request.retries + 1}/{self.max_retries + 1} failed for {website_id}: {exc}")
        try:
            raise self.retry(exc=exc)
        except MaxRetriesExceededError:
            raise
    finally:
        db.close()


@celery_app.task(name="app.tasks.worker.schedule_monitored_scans_task")
def schedule_monitored_scans_task():
    """
    Periodic Celery Beat task: finds all active websites due for monitoring scan.
    Verifies:
    1. Website is active and monitoring is enabled.
    2. Monitoring config is active.
    3. Organization subscription is active and plan has monitoring entitlement.
    4. next_run_at <= now (or is null).
    Atomically advances next_run_at to prevent duplicate scheduling on subsequent ticks.
    """
    db = get_sync_db()
    try:
        now = datetime.now(timezone.utc)
        stmt = (
            select(Website, Monitoring, Subscription)
            .join(Monitoring, Monitoring.website_id == Website.id)
            .outerjoin(Subscription, Subscription.organization_id == Website.organization_id)
            .where(
                Website.status == "active",
                Website.monitoring_enabled == True,
                Monitoring.enabled == True,
                Monitoring.status != "paused",
                or_(Monitoring.next_run_at <= now, Monitoring.next_run_at == None),
            )
        )
        results = db.execute(stmt).all()
        logger.info(f"Found {len(results)} candidate monitoring records due for execution.")

        enqueued_count = 0
        for website, mon, sub in results:
            plan = normalize_plan_name(sub.plan) if (sub and sub.status in ("active", "trialing")) else "free"
            cfg = PLAN_CAPABILITIES.get(plan, PLAN_CAPABILITIES["free"])

            if not cfg.get("monitoring_allowed", False):
                logger.info(f"Skipping website {website.domain}: plan '{plan}' lacks monitoring entitlement.")
                continue

            # Atomically advance next_run_at to lock this schedule tick
            interval_days = 1 if mon.frequency == "daily" else 7
            mon.next_run_at = now + timedelta(days=interval_days)
            db.commit()

            # Enqueue worker task
            run_monitoring_scan_task.delay(str(website.id))
            enqueued_count += 1

        logger.info(f"Successfully enqueued {enqueued_count} monitoring scans.")
        return {"scheduled_count": enqueued_count}
    finally:
        db.close()


@celery_app.task(name="app.tasks.worker.check_ssl_expiries_task")
def check_ssl_expiries_task():
    """Periodic Celery Beat task: verifies certificates nearing expiration across active sites and dispatches alerts."""
    db = get_sync_db()
    try:
        from app.services.email_service import send_ssl_expiry_alert
        from app.models.user import User, OrganizationMember
        from sqlalchemy import desc

        # Find active websites
        sites_stmt = select(Website).where(Website.status == "active")
        active_sites = db.execute(sites_stmt).scalars().all()
        alerted_count = 0

        for site in active_sites:
            scan_stmt = (
                select(Scan)
                .where(Scan.website_id == site.id, Scan.status == "completed")
                .order_by(desc(Scan.completed_at))
                .limit(1)
            )
            latest_scan = db.execute(scan_stmt).scalar_one_or_none()
            if not latest_scan or not latest_scan.scan_metadata:
                continue

            ssl_data = latest_scan.scan_metadata.get("ssl", {})
            days_remaining = ssl_data.get("days_remaining")

            if days_remaining is not None and days_remaining <= 14:
                owner_stmt = (
                    select(User.email, User.is_active, User.notification_preferences)
                    .join(OrganizationMember, OrganizationMember.user_id == User.id)
                    .where(
                        OrganizationMember.organization_id == site.organization_id,
                        OrganizationMember.role.in_(["owner", "admin"]),
                    )
                )
                for row in db.execute(owner_stmt).all():
                    email = row[0]
                    is_active = row[1]
                    prefs = row[2] or {}
                    if is_active and email and prefs.get("email_alerts", True) is not False and prefs.get("ssl_expiry", True) is not False:
                        send_ssl_expiry_alert(email, site.domain, days_remaining=max(0, days_remaining))
                        alerted_count += 1

        logger.info(f"Executed weekly SSL audit across {len(active_sites)} websites ({alerted_count} alerts dispatched).")
        return {"status": "completed", "websites_audited": len(active_sites), "alerts_dispatched": alerted_count}
    finally:
        db.close()


@celery_app.task(name="app.tasks.worker.reconcile_active_subscriptions_task")
def reconcile_active_subscriptions_task():
    """
    Periodic Celery Beat task: Reconciles active subscriptions against Razorpay and Stripe gateways.
    Detects silent mandate cancellations or halts that were missed due to network drops.
    """
    db = get_sync_db()
    try:
        stmt = select(Subscription).where(
            Subscription.status.in_(["active", "trialing", "past_due"]),
            Subscription.plan != "free",
        )
        active_subs = db.execute(stmt).scalars().all()
        reconciled_count = 0

        for sub in active_subs:
            try:
                if sub.provider == "razorpay" and sub.razorpay_subscription_id:
                    if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET and not settings.RAZORPAY_KEY_ID.startswith("rzp_test_placeholder"):
                        import razorpay
                        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
                        remote = client.subscription.fetch(sub.razorpay_subscription_id)
                        remote_status = remote.get("status")
                        if remote_status == "halted" and sub.status != "past_due":
                            sub.status = "past_due"
                            db.commit()
                            reconciled_count += 1
                        elif remote_status in ("cancelled", "completed") and sub.status != "canceled":
                            sub.status = "canceled"
                            sub.plan = "free"
                            db.commit()
                            reconciled_count += 1

                elif sub.provider == "stripe" and sub.stripe_subscription_id:
                    if settings.STRIPE_SECRET_KEY and not settings.STRIPE_SECRET_KEY.startswith("sk_test_placeholder"):
                        import stripe
                        remote = stripe.Subscription.retrieve(sub.stripe_subscription_id)
                        remote_status = remote.get("status")
                        if remote_status in ("canceled", "unpaid") and sub.plan != "free":
                            sub.status = "canceled"
                            sub.plan = "free"
                            db.commit()
                            reconciled_count += 1
            except Exception as e:
                logger.warning(f"Subscription reconciliation error for sub {sub.id}: {e}")

        logger.info(f"Reconciliation completed across {len(active_subs)} subscriptions ({reconciled_count} updated).")
        return {"total_checked": len(active_subs), "reconciled_count": reconciled_count}
    finally:
        db.close()


@celery_app.task(name="app.tasks.worker.recover_stale_scans_task")
def recover_stale_scans_task(stale_threshold_minutes: int = 15):
    """
    Periodic Celery Beat watchdog task:
    Identifies scans stuck in 'queued' or 'running' status longer than stale_threshold_minutes (default 15m).
    Marks them as 'failed', records reason, sets completed_at, and safely refunds quota.
    """
    db = get_sync_db()
    try:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(minutes=stale_threshold_minutes)

        stmt = select(Scan).where(
            Scan.status.in_(["queued", "running"]),
            or_(
                and_(Scan.status == "running", or_(Scan.started_at <= cutoff, and_(Scan.started_at == None, Scan.created_at <= cutoff))),
                and_(Scan.status == "queued", Scan.created_at <= cutoff),
            ),
        )
        stale_scans = db.execute(stmt).scalars().all()
        recovered_count = 0

        for scan in stale_scans:
            logger.warning(
                f"Watchdog recovering stale scan {scan.id} (domain: {scan.domain}, status: {scan.status}, "
                f"created_at: {scan.created_at}, started_at: {scan.started_at})"
            )
            scan.status = "failed"
            scan.error_message = f"Scan timed out after {stale_threshold_minutes} minutes in worker queue (recovered by watchdog)."
            scan.completed_at = now
            if scan.organization_id:
                try:
                    refund_scan_quota_sync(db, scan.organization_id, scan=scan)
                except Exception as q_err:
                    logger.warning(f"Watchdog quota refund error for scan {scan.id}: {q_err}")

            record_audit_event_sync(
                db=db,
                action="SCAN_TIMEOUT_RECOVERED",
                entity_type="SCAN",
                organization_id=scan.organization_id,
                entity_id=str(scan.id),
                metadata={"domain": scan.domain, "recovered_by": "watchdog", "stale_minutes": stale_threshold_minutes},
            )
            recovered_count += 1

        db.commit()
        logger.info(f"Stale scan recovery watchdog completed: {recovered_count} scans recovered.")
        return {"recovered_count": recovered_count}
    finally:
        db.close()


