"""
SiteSecura API - Monitoring Orchestration & Change Detection Service
Manages recurring scheduled website scans, integrates the existing secure scanner pipeline,
compares results with previous completed scans, deduplicates alerts by fingerprint,
and dispatches email notifications.
"""
import uuid
import logging
import hashlib
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.website import Website, Monitoring
from app.models.scan import Scan, ScanCheck
from app.models.alert import Alert
from app.models.user import Organization, User, OrganizationMember
from app.models.billing import Subscription
from app.core.permissions import get_plan_config, normalize_plan_name
from app.services.scan_service import execute_scan_job
from app.services.comparison_service import compare_scans
from app.services.email_service import (
    send_email,
    send_ssl_expiry_alert,
    send_score_drop_alert,
    send_critical_finding_alert,
)
from app.services.audit_service import record_audit_event_sync
from app.services.entitlement_service import check_and_reserve_scan_quota_sync

logger = logging.getLogger(__name__)


def generate_alert_fingerprint(alert_type: str, website_id: uuid.UUID, change_token: str) -> str:
    """Generates a stable, deterministic SHA256 hex string for an alert condition."""
    raw = f"{alert_type}:{str(website_id)}:{change_token}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def create_alert_if_not_duplicate(
    db: Session,
    organization_id: uuid.UUID,
    website_id: uuid.UUID,
    alert_type: str,
    change_token: str,
    severity: str,
    title: str,
    message: str,
    scan_id: Optional[uuid.UUID] = None,
    fingerprint: Optional[str] = None,
) -> Tuple[Optional[Alert], bool]:
    """
    Atomically checks for an existing unread alert with matching fingerprint in this organization.
    If none exists, creates the alert, writes an audit record, and returns (Alert, True).
    If an unread duplicate exists, returns (None, False).
    """
    if not fingerprint:
        fingerprint = generate_alert_fingerprint(alert_type, website_id, change_token)

    dup_stmt = select(Alert).where(
        Alert.organization_id == organization_id,
        Alert.website_id == website_id,
        Alert.fingerprint == fingerprint,
        Alert.status == "unread",
    )
    existing = db.execute(dup_stmt).scalar_one_or_none()
    if existing:
        logger.info(f"Deduplicated alert '{fingerprint}' for website {website_id}; existing unread alert present.")
        return None, False

    alert = Alert(
        id=uuid.uuid4(),
        organization_id=organization_id,
        website_id=website_id,
        scan_id=scan_id,
        type=alert_type,
        severity=severity,
        title=title,
        message=message,
        status="unread",
        fingerprint=fingerprint,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(alert)
    db.commit()

    record_audit_event_sync(
        db=db,
        action="MONITORING_ALERT_CREATED",
        entity_type="ALERT",
        organization_id=organization_id,
        entity_id=str(alert.id),
        metadata={"type": alert_type, "severity": severity, "fingerprint": fingerprint},
    )
    return alert, True


def run_monitored_website_scan(website_id: uuid.UUID, sync_db: Optional[Session] = None) -> Optional[Scan]:
    """
    Executes a scheduled monitoring scan for a website:
    1. Validates website and active monitoring configuration.
    2. Re-verifies organization subscription entitlement (Pro/Agency/Basic).
    3. Atomically checks and consumes monthly scan quota.
    4. Finds previous completed scan for comparison.
    5. Queues and runs real scanner engine via execute_scan_job.
    6. Updates Monitoring schedule (last_run_at, next_run_at, last_success_at).
    7. Runs comparison engine and dispatches deduplicated alerts & emails.
    """
    stmt = select(Website).where(Website.id == website_id)
    website = sync_db.execute(stmt).scalar_one_or_none()

    if not website or not website.monitoring_enabled:
        logger.info(f"Skipping monitoring scan for {website_id}: website not found or monitoring disabled.")
        return None

    # Load Monitoring record
    mon_stmt = select(Monitoring).where(Monitoring.website_id == website.id)
    mon = sync_db.execute(mon_stmt).scalar_one_or_none()
    if not mon or not mon.enabled:
        logger.info(f"Skipping monitoring scan for {website_id}: monitoring configuration inactive.")
        return None

    # Re-verify organization subscription plan entitlement
    sub_stmt = select(Subscription).where(Subscription.organization_id == website.organization_id)
    sub = sync_db.execute(sub_stmt).scalar_one_or_none()
    effective_plan = normalize_plan_name(sub.plan) if (sub and sub.status in ("active", "trialing")) else "free"
    plan_cfg = get_plan_config(effective_plan)

    if not plan_cfg.get("monitoring_allowed", False):
        logger.warning(
            f"Organization {website.organization_id} has plan '{effective_plan}' which is not entitled to monitoring. "
            f"Pausing scheduled execution."
        )
        mon.status = "paused"
        sync_db.commit()
        record_audit_event_sync(
            db=sync_db,
            action="MONITORING_PAUSED_UNENTITLED",
            entity_type="MONITORING",
            organization_id=website.organization_id,
            entity_id=str(mon.id),
            metadata={"plan": effective_plan, "reason": "Subscription plan not entitled to monitoring"},
        )
        return None

    # Check and reserve scan quota slot
    usage = check_and_reserve_scan_quota_sync(sync_db, website.organization_id, effective_plan)
    if not usage:
        logger.warning(
            f"Organization {website.organization_id} exceeded monthly scan quota. Postponing monitoring scan for {website.domain}."
        )
        # Postpone next_run_at by 24 hours without corrupting state
        mon.next_run_at = datetime.now(timezone.utc) + timedelta(days=1)
        sync_db.commit()
        record_audit_event_sync(
            db=sync_db,
            action="MONITORING_SKIPPED_QUOTA",
            entity_type="MONITORING",
            organization_id=website.organization_id,
            entity_id=str(mon.id),
            metadata={"plan": effective_plan, "reason": "Monthly scan quota exceeded"},
        )
        return None

    # Find previous completed scan for comparison
    prev_stmt = (
        select(Scan)
        .where(
            Scan.website_id == website.id,
            Scan.status == "completed",
            Scan.organization_id == website.organization_id,
        )
        .order_by(desc(Scan.completed_at))
        .limit(1)
    )
    prev_scan = sync_db.execute(prev_stmt).scalar_one_or_none()

    # Create new monitoring scan record
    new_scan = Scan(
        id=uuid.uuid4(),
        organization_id=website.organization_id,
        website_id=website.id,
        domain=website.domain,
        normalized_domain=website.normalized_domain,
        status="queued",
        scan_type="monitoring",
    )
    sync_db.add(new_scan)
    sync_db.commit()

    record_audit_event_sync(
        db=sync_db,
        action="MONITORING_SCAN_STARTED",
        entity_type="SCAN",
        organization_id=website.organization_id,
        entity_id=str(new_scan.id),
        metadata={"domain": website.domain, "website_id": str(website.id)},
    )

    # Execute scan using existing real scanner engine
    completed_scan = execute_scan_job(new_scan.id, sync_db)

    now = datetime.now(timezone.utc)
    interval_days = 1 if mon.frequency == "daily" else 7

    if completed_scan and completed_scan.status == "completed":
        mon.last_run_at = now
        mon.last_success_at = now
        mon.last_scan_id = completed_scan.id
        mon.next_run_at = now + timedelta(days=interval_days)
        mon.last_error = None
        mon.status = "active"
        sync_db.commit()

        record_audit_event_sync(
            db=sync_db,
            action="MONITORING_SCAN_COMPLETED",
            entity_type="SCAN",
            organization_id=website.organization_id,
            entity_id=str(completed_scan.id),
            metadata={"score": completed_scan.score, "domain": website.domain},
        )

        # Run comparison and dispatch alerts
        try:
            check_and_dispatch_alerts(website, prev_scan, completed_scan, sync_db)
        except Exception as alert_err:
            logger.error(f"Error dispatching monitoring alerts for {website.domain}: {alert_err}", exc_info=True)
    else:
        mon.last_run_at = now
        mon.last_failure_at = now
        mon.last_error = completed_scan.error_message if completed_scan else "Scan execution failed"
        mon.status = "error"
        # Retry in 6 hours on error
        mon.next_run_at = now + timedelta(hours=6)
        sync_db.commit()

        record_audit_event_sync(
            db=sync_db,
            action="MONITORING_SCAN_FAILED",
            entity_type="SCAN",
            organization_id=website.organization_id,
            entity_id=str(new_scan.id),
            metadata={"error": mon.last_error, "domain": website.domain},
        )

    return completed_scan


def check_and_dispatch_alerts(
    website: Website,
    prev_scan: Optional[Scan],
    current_scan: Scan,
    sync_db: Session,
):
    """
    Compares previous scan and current scan using comparison_service:
    - Score drop >= 5 points
    - New high/critical findings
    - DNS record changes (A, MX, SPF, DMARC, DNSSEC)
    - Security header removals (HSTS, CSP, etc.)
    - SSL certificate expiration (< 30d, < 14d, < 7d, expired)
    Applies atomic fingerprint deduplication before creating alerts and sending email notifications.
    """
    comparison = compare_scans(prev_scan, current_scan)

    if comparison["is_baseline"]:
        logger.info(f"Baseline scan established for {website.domain}. No change alerts generated.")
        return

    # Fetch notification recipient emails (active owners and admins respecting preferences)
    owner_stmt = (
        select(User.email, User.is_active, User.notification_preferences)
        .join(OrganizationMember, OrganizationMember.user_id == User.id)
        .where(
            OrganizationMember.organization_id == website.organization_id,
            OrganizationMember.role.in_(["owner", "admin"]),
        )
    )
    recipients = []
    for row in sync_db.execute(owner_stmt).all():
        email = row[0]
        is_active = row[1]
        prefs = row[2] or {}
        if is_active and email and prefs.get("email_alerts", True) is not False:
            recipients.append(email)

    # 1. Score Drop Alert
    if comparison["score"]["is_drop"]:
        delta = comparison["score"]["delta"]
        prev_s = comparison["score"]["previous"]
        curr_s = comparison["score"]["current"]
        title = f"Security Score Dropped by {abs(delta)} Points ({prev_s} → {curr_s})"
        msg = f"Security score for {website.domain} dropped from {prev_s}/100 to {curr_s}/100."
        sev = "critical" if delta <= -15 else "high" if delta <= -10 else "warning"

        alert, created = create_alert_if_not_duplicate(
            db=sync_db,
            organization_id=website.organization_id,
            website_id=website.id,
            alert_type="score_drop",
            change_token=f"drop_{curr_s}",
            severity=sev,
            title=title,
            message=msg,
            scan_id=current_scan.id,
        )
        if created and alert:
            for email in recipients:
                send_score_drop_alert(email, website.domain, prev_s, curr_s, website_id=str(website.id))

    # 2. New Findings Alerts
    for finding in comparison["new_findings"]:
        sev = (finding.get("severity") or "warning").lower()
        if sev in ("critical", "high", "medium"):
            ctype = finding["check_type"]
            title = f"New Security Issue: {finding['title']}"
            msg = f"New {sev.upper()} severity issue identified on {website.domain}: {finding['summary']}"
            alert, created = create_alert_if_not_duplicate(
                db=sync_db,
                organization_id=website.organization_id,
                website_id=website.id,
                alert_type="new_finding",
                change_token=ctype,
                severity=sev,
                title=title,
                message=msg,
                scan_id=current_scan.id,
            )
            if created and alert and sev in ("critical", "high"):
                for email in recipients:
                    send_critical_finding_alert(
                        to_email=email,
                        domain=website.domain,
                        finding_title=finding["title"],
                        severity=sev,
                        summary=finding["summary"],
                        scan_id=str(current_scan.id),
                    )

    # 3. DNS Changes Alerts
    for dns_change in comparison["dns_changes"]:
        rtype = dns_change["record_type"]
        title = f"DNS Configuration Changed: {rtype} Record"
        msg = dns_change["description"]
        alert, created = create_alert_if_not_duplicate(
            db=sync_db,
            organization_id=website.organization_id,
            website_id=website.id,
            alert_type="dns_change",
            change_token=f"{rtype}:{dns_change.get('current')}",
            severity="warning",
            title=title,
            message=msg,
            scan_id=current_scan.id,
        )
        if created and alert:
            subject = f"⚠️ SiteSecura Alert: DNS {rtype} records changed for {website.domain}"
            body = (
                f"Hello,\n\n"
                f"SiteSecura automated monitoring detected a DNS record modification for {website.domain}.\n\n"
                f"{msg}\n\n"
                f"View details: {settings.NEXT_PUBLIC_APP_URL}/dashboard/websites/{website.id}\n\n"
                f"— The SiteSecura Security Team"
            )
            for email in recipients:
                send_email(email, subject, body)

    # 4. Security Header Removals Alerts
    for h_change in comparison["header_changes"]:
        if h_change["change"] == "removed":
            htype = h_change["header_type"]
            title = f"Security Header Removed: {h_change['name']}"
            msg = h_change["description"]
            alert, created = create_alert_if_not_duplicate(
                db=sync_db,
                organization_id=website.organization_id,
                website_id=website.id,
                alert_type="header_removed",
                change_token=f"removed_{htype}",
                severity=h_change["severity"],
                title=title,
                message=msg,
                scan_id=current_scan.id,
            )
            if created and alert:
                subject = f"🚨 SiteSecura Alert: Security header removed on {website.domain}"
                body = (
                    f"Hello,\n\n"
                    f"SiteSecura monitoring detected that the security header '{h_change['name']}' was removed or disabled on {website.domain}.\n\n"
                    f"Removing security headers exposes your application to clickjacking, protocol downgrade, or content injection attacks.\n\n"
                    f"View fix guide: {settings.NEXT_PUBLIC_APP_URL}/dashboard/websites/{website.id}\n\n"
                    f"— The SiteSecura Security Team"
                )
                for email in recipients:
                    send_email(email, subject, body)

    # 5. SSL Expiry Alerts
    for ssl_change in comparison["ssl_changes"]:
        bucket = ssl_change.get("bucket")
        if bucket in ("30_days", "14_days", "7_days", "expired"):
            title = f"SSL Certificate Expiry Warning" if bucket != "expired" else "SSL Certificate Expired"
            msg = ssl_change["description"]
            alert, created = create_alert_if_not_duplicate(
                db=sync_db,
                organization_id=website.organization_id,
                website_id=website.id,
                alert_type="ssl_expiring",
                change_token=f"ssl_{bucket}",
                severity=ssl_change["severity"],
                title=title,
                message=msg,
                scan_id=current_scan.id,
            )
            if created and alert:
                days = max(0, ssl_change["days_remaining"])
                for email in recipients:
                    send_ssl_expiry_alert(email, website.domain, days_remaining=days)


# Alias for backward compatibility / tests
run_monitored_scan_for_website = run_monitored_website_scan
