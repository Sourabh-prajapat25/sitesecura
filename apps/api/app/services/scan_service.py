"""
Scanly API - Scan Service
Orchestrates scan execution, database persistence, recommendation mapping, and report generation.
"""
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select, desc, delete
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.scan import Scan, ScanCheck, Report
from app.models.website import Website
from app.models.user import Organization, User
from app.models.billing import Subscription
from app.core.permissions import normalize_plan_name
from app.services.pdf_service import generate_pdf_report
from scanner.runner import run_security_scan
from scanner.models import ScanResult, CheckStatus
from scanner.network import SafeNetworkConfig

logger = logging.getLogger(__name__)


def execute_scan_job(scan_id: uuid.UUID, sync_db: Session) -> Scan:
    """
    Synchronous worker job executed by Celery worker:
    1. Loads scan from DB
    2. Runs defensive security scanner
    3. Persists check findings and score
    4. Updates website last_scan_id and score if linked
    5. Generates PDF report
    """
    stmt = select(Scan).where(Scan.id == scan_id)
    scan = sync_db.execute(stmt).scalar_one_or_none()

    if not scan:
        logger.error(f"Scan {scan_id} not found in database.")
        return None

    # State transition guard: Never re-run a completed scan
    if scan.status == "completed":
        logger.info(f"Scan {scan_id} is already completed. Skipping redundant execution.")
        return scan

    # State transition guard: Never re-run a terminal failed scan
    if scan.status == "failed" and scan.completed_at is not None:
        logger.info(f"Scan {scan_id} is already in terminal failed state. Skipping.")
        return scan

    scan.status = "running"
    if not scan.started_at:
        scan.started_at = datetime.now(timezone.utc)
    sync_db.commit()

    try:
        # Build safe network configuration from application settings
        net_config = SafeNetworkConfig(
            max_redirects=settings.SCANNER_MAX_REDIRECTS,
            max_response_bytes=settings.SCANNER_MAX_RESPONSE_BYTES,
            connect_timeout=settings.SCANNER_CONNECT_TIMEOUT,
            read_timeout=settings.SCANNER_READ_TIMEOUT,
            write_timeout=settings.SCANNER_WRITE_TIMEOUT,
            pool_timeout=settings.SCANNER_POOL_TIMEOUT,
            total_timeout=settings.SCANNER_TIMEOUT_SECONDS,
        )
        # Run real scanner engine with safe network configuration
        scan_res: ScanResult = run_security_scan(
            scan.domain,
            timeout_seconds=settings.SCANNER_TIMEOUT_SECONDS,
            config=net_config,
        )

        scan.status = "completed"
        scan.normalized_domain = scan_res.normalized_domain
        scan.target_ip = scan_res.target_ip
        scan.score = scan_res.score
        scan.risk_level = scan_res.risk_level.value if hasattr(scan_res.risk_level, "value") else str(scan_res.risk_level)
        scan.score_breakdown = scan_res.score_breakdown
        scan.passed_checks_count = scan_res.passed_checks_count
        scan.total_checks_count = scan_res.total_checks_count
        scan.scan_duration_ms = scan_res.scan_duration_ms
        scan.completed_at = scan_res.completed_at
        scan.error_message = scan_res.error_message

        # Idempotency guard: Purge any partial/existing checks for this scan_id to prevent duplicates on retry
        sync_db.execute(delete(ScanCheck).where(ScanCheck.scan_id == scan.id))

        # Persist individual scan checks
        check_models: List[ScanCheck] = []
        for finding in scan_res.findings:
            check = ScanCheck(
                id=uuid.uuid4(),
                scan_id=scan.id,
                check_type=finding.check_type,
                name=finding.name,
                status=finding.status.value if hasattr(finding.status, "value") else str(finding.status),
                severity=finding.severity.value if hasattr(finding.severity, "value") else str(finding.severity),
                score_impact=finding.score_impact,
                title=finding.title,
                summary=finding.summary,
                why_it_matters=finding.why_it_matters,
                how_to_fix=finding.how_to_fix,
                estimated_fix_minutes=finding.estimated_fix_minutes,
                documentation_url=finding.documentation_url,
                technical_details=finding.technical_details,
                evidence=finding.evidence,
                confidence=finding.confidence,
            )
            sync_db.add(check)
            check_models.append(check)

        sync_db.flush()

        # Resolve organization and subscription plan
        org = None
        plan = "free"
        target_org_id = scan.organization_id

        if scan.website_id:
            w_stmt = select(Website).where(Website.id == scan.website_id)
            website = sync_db.execute(w_stmt).scalar_one_or_none()
            if website:
                website.last_scan_id = scan.id
                if website.organization_id:
                    target_org_id = website.organization_id

        if target_org_id:
            o_stmt = select(Organization).where(Organization.id == target_org_id)
            org = sync_db.execute(o_stmt).scalar_one_or_none()
            sub_stmt = select(Subscription).where(Subscription.organization_id == target_org_id)
            sub = sync_db.execute(sub_stmt).scalar_one_or_none()
            if sub and sub.status in ("active", "trialing"):
                plan = normalize_plan_name(sub.plan)

        # Generate PDF report safely with single-report idempotency guard
        try:
            storage_dir = os.path.abspath(settings.STORAGE_PATH)
            pdf_path = generate_pdf_report(scan, check_models, org=org, plan=plan, output_directory=storage_dir)
            rep_stmt = select(Report).where(Report.scan_id == scan.id)
            existing_report = sync_db.execute(rep_stmt).scalar_one_or_none()
            if existing_report:
                existing_report.pdf_path = pdf_path
            else:
                report = Report(
                    id=uuid.uuid4(),
                    organization_id=scan.organization_id or target_org_id,
                    scan_id=scan.id,
                    website_id=scan.website_id,
                    report_number=f"RPT-{scan.created_at.strftime('%Y%m%d')}-{scan.id.hex[:6].upper()}",
                    pdf_path=pdf_path,
                )
                sync_db.add(report)
        except Exception as e:
            logger.error(f"PDF generation failed for scan {scan.id}: {e}")

        sync_db.commit()
        logger.info(f"Scan {scan.id} for {scan.domain} completed successfully with score {scan.score}.")
        return scan

    except Exception as e:
        logger.exception(f"Scan execution failed for scan {scan_id}: {e}")
        if scan and scan.status != "completed":
            scan.status = "failed"
            scan.error_message = str(e)
            scan.completed_at = datetime.now(timezone.utc)
            if scan.organization_id:
                try:
                    from app.services.entitlement_service import refund_scan_quota_sync
                    refund_scan_quota_sync(sync_db, scan.organization_id, scan=scan)
                except Exception as q_err:
                    logger.warning(f"Could not refund quota for failed scan {scan_id}: {q_err}")
            sync_db.commit()
        return scan


def execute_deep_scan_job(scan_id: uuid.UUID, sync_db: Session) -> Optional[Scan]:
    """
    Synchronous worker job for Deep Website Security Scans:
    1. Loads scan record from database
    2. Resolves organization plan limits (max_pages: 50 Pro, 100 Agency)
    3. Executes modular deep crawler, discovery, and multi-page audits
    4. Persists check findings, score breakdown, and crawl metadata
    5. Updates website last_scan_id and score
    """
    from scanner.deep import run_deep_security_scan, DeepScanConfig

    stmt = select(Scan).where(Scan.id == scan_id)
    scan = sync_db.execute(stmt).scalar_one_or_none()

    if not scan:
        logger.error(f"Deep Scan {scan_id} not found in database.")
        return None

    # State transition guard: Never re-run a completed scan
    if scan.status == "completed":
        logger.info(f"Deep scan {scan_id} is already completed. Skipping redundant execution.")
        return scan

    # State transition guard: Never re-run a terminal failed scan
    if scan.status == "failed" and scan.completed_at is not None:
        logger.info(f"Deep scan {scan_id} is already in terminal failed state. Skipping.")
        return scan

    scan.status = "running"
    if not scan.started_at:
        scan.started_at = datetime.now(timezone.utc)
    sync_db.commit()

    try:
        # Resolve organization and subscription plan
        org = None
        plan = "pro"
        target_org_id = scan.organization_id

        if scan.website_id:
            w_stmt = select(Website).where(Website.id == scan.website_id)
            website = sync_db.execute(w_stmt).scalar_one_or_none()
            if website and website.organization_id:
                target_org_id = website.organization_id

        if target_org_id:
            o_stmt = select(Organization).where(Organization.id == target_org_id)
            org = sync_db.execute(o_stmt).scalar_one_or_none()
            sub_stmt = select(Subscription).where(Subscription.organization_id == target_org_id)
            sub = sync_db.execute(sub_stmt).scalar_one_or_none()
            if sub and sub.status in ("active", "trialing"):
                plan = normalize_plan_name(sub.plan)

        # Build deep scan configuration based on plan limits
        max_p = 100 if plan == "agency" else 50
        deep_config = DeepScanConfig(
            max_pages=max_p,
            max_depth=2,
            connect_timeout=settings.SCANNER_CONNECT_TIMEOUT,
            read_timeout=settings.SCANNER_READ_TIMEOUT,
            total_scan_timeout_seconds=settings.SCANNER_TIMEOUT_SECONDS * 3,
        )

        deep_res = run_deep_security_scan(
            target_domain=scan.domain,
            plan=plan,
            config=deep_config,
        )

        scan.status = "completed"
        scan.normalized_domain = deep_res.normalized_domain
        scan.target_ip = deep_res.target_ip
        scan.score = deep_res.score
        scan.risk_level = deep_res.risk_level.value if hasattr(deep_res.risk_level, "value") else str(deep_res.risk_level)
        scan.score_breakdown = deep_res.score_breakdown
        scan.passed_checks_count = deep_res.passed_checks_count
        scan.total_checks_count = deep_res.total_checks_count
        scan.scan_duration_ms = deep_res.scan_duration_ms
        scan.completed_at = deep_res.completed_at
        scan.error_message = deep_res.error_message
        scan.scan_metadata = deep_res.scan_metadata

        # Idempotency guard: Purge any partial/existing checks for this scan_id to prevent duplicates on retry
        sync_db.execute(delete(ScanCheck).where(ScanCheck.scan_id == scan.id))

        # Persist individual scan checks
        check_models: List[ScanCheck] = []
        for finding in deep_res.findings:
            check = ScanCheck(
                id=uuid.uuid4(),
                scan_id=scan.id,
                check_type=finding.check_type,
                name=finding.name,
                status=finding.status.value if hasattr(finding.status, "value") else str(finding.status),
                severity=finding.severity.value if hasattr(finding.severity, "value") else str(finding.severity),
                score_impact=finding.score_impact,
                title=finding.title,
                summary=finding.summary,
                why_it_matters=finding.why_it_matters,
                how_to_fix=finding.how_to_fix,
                estimated_fix_minutes=finding.estimated_fix_minutes,
                documentation_url=finding.documentation_url,
                technical_details=finding.technical_details,
                evidence=finding.evidence,
                confidence=finding.confidence,
            )
            sync_db.add(check)
            check_models.append(check)

        sync_db.flush()

        if scan.website_id:
            w_stmt = select(Website).where(Website.id == scan.website_id)
            website = sync_db.execute(w_stmt).scalar_one_or_none()
            if website:
                website.last_scan_id = scan.id

        # Generate PDF report safely with single-report idempotency guard
        try:
            storage_dir = os.path.abspath(settings.STORAGE_PATH)
            pdf_path = generate_pdf_report(scan, check_models, org=org, plan=plan, output_directory=storage_dir)
            rep_stmt = select(Report).where(Report.scan_id == scan.id)
            existing_report = sync_db.execute(rep_stmt).scalar_one_or_none()
            if existing_report:
                existing_report.pdf_path = pdf_path
            else:
                report = Report(
                    id=uuid.uuid4(),
                    organization_id=scan.organization_id or target_org_id,
                    scan_id=scan.id,
                    website_id=scan.website_id,
                    report_number=f"RPT-{scan.created_at.strftime('%Y%m%d')}-{scan.id.hex[:6].upper()}",
                    pdf_path=pdf_path,
                )
                sync_db.add(report)
        except Exception as e:
            logger.warning(f"Deep scan PDF generation skipped or failed: {e}")

        sync_db.commit()
        logger.info(f"Deep Scan {scan.id} for {scan.domain} completed successfully with score {scan.score}.")
        return scan

    except Exception as e:
        logger.exception(f"Deep scan execution failed for scan {scan_id}: {e}")
        if scan and scan.status != "completed":
            scan.status = "failed"
            scan.error_message = str(e)
            scan.completed_at = datetime.now(timezone.utc)
            if scan.organization_id:
                try:
                    from app.services.entitlement_service import refund_scan_quota_sync
                    refund_scan_quota_sync(sync_db, scan.organization_id, scan=scan)
                except Exception as q_err:
                    logger.warning(f"Could not refund quota for failed deep scan {scan_id}: {q_err}")
            sync_db.commit()
        return scan
