"""
Scanly API - Websites Endpoints
Provides multi-tenant website management, manual scans, historical comparisons, and CSV bulk import.
"""
import os
import re
import uuid
import csv
import io
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db, get_sync_db
from app.core.security import get_current_user_token
from app.core.permissions import require_feature, get_plan_config
from app.core.config import settings
from app.core.rate_limit import check_rate_limit
from app.models.website import Website, Monitoring
from app.models.scan import Scan, ScanCheck, Report
from app.services.pdf_service import generate_pdf_report, sanitize_report_filename
from app.schemas.website import (
    WebsiteCreateRequest,
    WebsiteUpdateRequest,
    WebsiteResponse,
    MonitoringEnableRequest,
    MonitoringUpdateRequest,
    MonitoringResponse,
    BulkImportResponse,
    BulkImportRowResult,
)
from app.schemas.scan import ScanResponse, ScanCheckResponse
from app.services.auth_service import get_or_create_user
from app.services.scan_service import execute_scan_job, execute_deep_scan_job
from app.tasks.worker import scan_website_task, deep_scan_website_task
from scanner.domain import normalize_domain, SSRFValidationError

import logging

from app.core.authorization import (
    AuthContext,
    get_current_auth_context,
    get_tenant_website,
    require_org_role,
)
from app.services.entitlement_service import (
    check_and_reserve_website_quota,
    check_and_reserve_scan_quota,
    refund_scan_quota,
    filter_findings_for_viewer,
)
from app.services.audit_service import record_audit_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/websites", tags=["Websites"])


@router.get("", response_model=List[WebsiteResponse])
async def list_websites(
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Lists all websites belonging strictly to the user's organization."""
    stmt = (
        select(Website)
        .options(selectinload(Website.monitoring))
        .where(Website.organization_id == auth.organization.id)
        .order_by(Website.created_at.desc())
    )
    result = await db.execute(stmt)
    websites = result.scalars().all()

    resp: List[WebsiteResponse] = []
    for w in websites:
        item = WebsiteResponse.model_validate(w)
        if w.monitoring:
            item.monitoring = MonitoringResponse.model_validate(w.monitoring)
        if w.last_scan_id:
            s_stmt = select(Scan.score, Scan.risk_level).where(Scan.id == w.last_scan_id)
            s_res = await db.execute(s_stmt)
            s_row = s_res.first()
            if s_row:
                item.last_scan_score = s_row.score
                item.last_scan_risk = s_row.risk_level
        resp.append(item)

    return resp


@router.post("", response_model=WebsiteResponse, status_code=status.HTTP_201_CREATED)
async def create_website(
    site_in: WebsiteCreateRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Adds a new website under the organization, enforcing plan website quotas atomically."""
    # 1. Enforce viewer cannot create
    if auth.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Viewers cannot create websites."}},
        )

    # 2. Atomically check and lock website quota
    await check_and_reserve_website_quota(db, auth.organization.id, auth.plan)

    # 3. Normalize domain
    try:
        norm_domain = normalize_domain(site_in.domain)
    except SSRFValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "INVALID_DOMAIN", "message": str(e)}},
        )

    # 4. Check uniqueness within org
    existing_stmt = select(Website).where(
        Website.organization_id == auth.organization.id,
        Website.normalized_domain == norm_domain,
    )
    existing_res = await db.execute(existing_stmt)
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "DUPLICATE_DOMAIN", "message": f"Domain {norm_domain} is already added in this organization."}},
        )

    # 5. Create website and optional monitoring
    plan_cfg = get_plan_config(auth.plan)
    new_site = Website(
        id=uuid.uuid4(),
        organization_id=auth.organization.id,
        name=site_in.name or norm_domain,
        domain=site_in.domain,
        normalized_domain=norm_domain,
        monitoring_enabled=site_in.monitoring_enabled if plan_cfg["monitoring_allowed"] else False,
        monitoring_frequency=site_in.monitoring_frequency if plan_cfg["monitoring_allowed"] else "weekly",
    )
    db.add(new_site)

    if site_in.monitoring_enabled and plan_cfg["monitoring_allowed"]:
        mon = Monitoring(
            website_id=new_site.id,
            enabled=True,
            frequency=site_in.monitoring_frequency,
        )
        db.add(mon)

    await db.commit()
    await db.refresh(new_site)

    # Record audit event
    await record_audit_event(
        db=db,
        action="WEBSITE_CREATED",
        entity_type="WEBSITE",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=str(new_site.id),
        metadata={"domain": norm_domain, "name": new_site.name},
    )

    return WebsiteResponse.model_validate(new_site)


@router.get("/{website_id}", response_model=WebsiteResponse)
async def get_website(
    website_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves a single website with organization ownership enforcement (404 on cross-tenant access)."""
    site = await get_tenant_website(website_id, auth, db)

    item = WebsiteResponse.model_validate(site)
    m_stmt = select(Monitoring).where(Monitoring.website_id == site.id)
    m_res = await db.execute(m_stmt)
    mon = m_res.scalar_one_or_none()
    if mon:
        item.monitoring = MonitoringResponse.model_validate(mon)

    if site.last_scan_id:
        s_stmt = select(Scan.score, Scan.risk_level).where(Scan.id == site.last_scan_id)
        s_res = await db.execute(s_stmt)
        s_row = s_res.first()
        if s_row:
            item.last_scan_score = s_row.score
            item.last_scan_risk = s_row.risk_level
    return item


@router.patch("/{website_id}", response_model=WebsiteResponse)
async def update_website(
    website_id: uuid.UUID,
    site_update: WebsiteUpdateRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Updates website name or monitoring preferences."""
    if auth.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Viewers cannot update websites."}},
        )

    site = await get_tenant_website(website_id, auth, db)

    if site_update.name is not None:
        site.name = site_update.name
    if site_update.monitoring_enabled is not None:
        if site_update.monitoring_enabled:
            require_feature(auth.plan, "monitoring_allowed")
        site.monitoring_enabled = site_update.monitoring_enabled
    if site_update.monitoring_frequency is not None:
        site.monitoring_frequency = site_update.monitoring_frequency

    await db.commit()
    await db.refresh(site)

    await record_audit_event(
        db=db,
        action="WEBSITE_UPDATED",
        entity_type="WEBSITE",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=str(site.id),
        metadata={"name": site.name, "monitoring_enabled": site.monitoring_enabled},
    )

    return WebsiteResponse.model_validate(site)


@router.delete("/{website_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_website(
    website_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Deletes website and cascading scan data (restricted to owners and admins)."""
    if auth.role not in ("owner", "admin") and not auth.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Only organization owners and admins can delete websites."}},
        )

    site = await get_tenant_website(website_id, auth, db)

    await record_audit_event(
        db=db,
        action="WEBSITE_DELETED",
        entity_type="WEBSITE",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=str(site.id),
        metadata={"domain": site.domain},
    )

    await db.delete(site)
    await db.commit()
    return None


@router.post("/{website_id}/scan", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
async def trigger_website_scan(
    website_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Triggers an on-demand scan for a registered website, enforcing scan quota."""
    if auth.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Viewers cannot trigger scans."}},
        )

    site = await get_tenant_website(website_id, auth, db)

    # Atomically reserve monthly scan quota
    await check_and_reserve_scan_quota(db, auth.organization.id, auth.plan)

    scan_id = uuid.uuid4()
    new_scan = Scan(
        id=scan_id,
        organization_id=auth.organization.id,
        website_id=site.id,
        requested_by_user_id=auth.user.id,
        domain=site.domain,
        normalized_domain=site.normalized_domain,
        status="queued",
        scan_type="manual",
    )
    db.add(new_scan)
    await db.commit()
    await db.refresh(new_scan)

    await record_audit_event(
        db=db,
        action="SCAN_CREATED",
        entity_type="SCAN",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=str(scan_id),
        metadata={"domain": site.domain, "website_id": str(site.id)},
    )

    # Enqueue task or execute directly
    is_production = settings.ENVIRONMENT.lower() in ("production", "prod")
    enqueued = False
    try:
        scan_website_task.delay(str(scan_id))
        enqueued = True
    except Exception as celery_err:
        if is_production:
            logger.error(
                f"Celery enqueue failed in production for scan {scan_id}: {celery_err}. "
                "Synchronous scan execution in web worker is disabled in production."
            )
        else:
            logger.warning(f"Celery enqueue failed for scan {scan_id}: {celery_err}. Attempting worker fallback...")
            try:
                sync_db = get_sync_db()
                try:
                    execute_scan_job(scan_id, sync_db)
                    enqueued = True
                finally:
                    sync_db.close()
            except Exception as exec_err:
                logger.error(f"Fallback scan execution failed for scan {scan_id}: {exec_err}")

    if not enqueued:
        await refund_scan_quota(db, auth.organization.id, scan=new_scan)
        new_scan.status = "failed"
        new_scan.error_message = (
            "Scan queue unavailable. Please try again later."
            if is_production
            else "Scan dispatching failed. Quota slot has been refunded."
        )

        await record_audit_event(
            db=db,
            action="SCAN_FAILED",
            entity_type="SCAN",
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            entity_id=str(scan_id),
            metadata={"reason": "Enqueue and fallback execution both failed; quota refunded"},
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "SCAN_DISPATCH_FAILED",
                    "message": "Scan execution failed. Your scan quota slot has been refunded.",
                }
            },
        )

    res = await db.execute(select(Scan).options(selectinload(Scan.checks)).where(Scan.id == scan_id))
    refreshed_scan = res.scalar_one()

    # Server-side finding filtering for viewer's plan
    checks_filtered, locked_count, is_locked = filter_findings_for_viewer(
        refreshed_scan.checks,
        plan=auth.plan,
        is_authenticated=True,
    )
    resp = ScanResponse.model_validate(refreshed_scan)
    resp.checks = [ScanCheckResponse.model_validate(c) for c in checks_filtered]
    resp.locked_findings_count = locked_count
    resp.is_premium_locked = is_locked
    return resp


@router.post("/{website_id}/deep-scan", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
async def trigger_website_deep_scan(
    website_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Triggers an on-demand Deep Website Security Scan for a registered website.
    - Restricted to Pro, Agency, and Admin plans.
    - Shares the same monthly scan quota as normal scans.
    - Prevents concurrent active deep scans on the same website.
    - Enqueues deep crawler task in Celery (with sync fallback and quota refund on hard dispatch failure).
    """
    # 1. Enforce viewer cannot trigger scans
    if auth.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Viewers cannot trigger scans."}},
        )

    # 2. Strict plan entitlement gate: Pro, Agency, Admin only
    require_feature(auth.plan, "deep_scan")

    # 3. Organization ownership verification
    site = await get_tenant_website(website_id, auth, db)

    # 4. Concurrency check: prevent overlapping deep scans for same website
    running_stmt = (
        select(Scan.id)
        .where(
            Scan.website_id == site.id,
            Scan.scan_type == "deep",
            Scan.status.in_(["queued", "running"]),
        )
    )
    running_res = await db.execute(running_stmt)
    active_deep_id = running_res.scalar_one_or_none()
    if active_deep_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "CONCURRENT_SCAN_IN_PROGRESS",
                    "message": "A Deep Scan is already in progress for this website.",
                    "scan_id": str(active_deep_id),
                }
            },
        )

    # 5. Atomically reserve 1 monthly scan slot (shares identical quota as normal scans)
    await check_and_reserve_scan_quota(db, auth.organization.id, auth.plan)

    scan_id = uuid.uuid4()
    new_scan = Scan(
        id=scan_id,
        organization_id=auth.organization.id,
        website_id=site.id,
        requested_by_user_id=auth.user.id,
        domain=site.domain,
        normalized_domain=site.normalized_domain,
        status="queued",
        scan_type="deep",
    )
    db.add(new_scan)
    await db.commit()
    await db.refresh(new_scan)

    await record_audit_event(
        db=db,
        action="DEEP_SCAN_CREATED",
        entity_type="SCAN",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=str(scan_id),
        metadata={"domain": site.domain, "website_id": str(site.id), "scan_type": "deep"},
    )

    # 6. Enqueue task in Celery worker or run in sync fallback
    is_production = settings.ENVIRONMENT.lower() in ("production", "prod")
    enqueued = False
    try:
        deep_scan_website_task.delay(str(scan_id))
        enqueued = True
    except Exception as celery_err:
        if is_production:
            logger.error(
                f"Celery enqueue failed in production for deep scan {scan_id}: {celery_err}. "
                "Synchronous deep scan execution in web worker is disabled in production."
            )
        else:
            logger.warning(f"Celery enqueue failed for deep scan {scan_id}: {celery_err}. Attempting sync fallback...")
            try:
                sync_db = get_sync_db()
                try:
                    execute_deep_scan_job(scan_id, sync_db)
                    enqueued = True
                finally:
                    sync_db.close()
            except Exception as exec_err:
                logger.error(f"Fallback deep scan execution failed for {scan_id}: {exec_err}")

    if not enqueued:
        await refund_scan_quota(db, auth.organization.id, scan=new_scan)
        new_scan.status = "failed"
        new_scan.error_message = (
            "Deep scan queue unavailable. Please try again later."
            if is_production
            else "Deep scan dispatching failed. Quota slot has been refunded."
        )

        await record_audit_event(
            db=db,
            action="DEEP_SCAN_FAILED",
            entity_type="SCAN",
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            entity_id=str(scan_id),
            metadata={"reason": "Dispatch failed; quota refunded"},
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "SCAN_DISPATCH_FAILED",
                    "message": "Deep scan execution failed. Your scan quota slot has been refunded.",
                }
            },
        )

    res = await db.execute(select(Scan).options(selectinload(Scan.checks)).where(Scan.id == scan_id))
    refreshed_scan = res.scalar_one()

    checks_filtered, locked_count, is_locked = filter_findings_for_viewer(
        refreshed_scan.checks,
        plan=auth.plan,
        is_authenticated=True,
    )
    resp = ScanResponse.model_validate(refreshed_scan)
    resp.checks = [ScanCheckResponse.model_validate(c) for c in checks_filtered]
    resp.locked_findings_count = locked_count
    resp.is_premium_locked = is_locked
    return resp


@router.get("/{website_id}/deep-scans/{scan_id}", response_model=ScanResponse)
async def get_website_deep_scan(
    website_id: uuid.UUID,
    scan_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves full details and findings for a specific deep scan under the website."""
    site = await get_tenant_website(website_id, auth, db)

    stmt = (
        select(Scan)
        .options(selectinload(Scan.checks))
        .where(
            Scan.id == scan_id,
            Scan.website_id == site.id,
            Scan.organization_id == auth.organization.id,
        )
    )
    res = await db.execute(stmt)
    scan = res.scalar_one_or_none()

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SCAN_NOT_FOUND", "message": f"Deep scan {scan_id} not found."}},
        )

    checks_filtered, locked_count, is_locked = filter_findings_for_viewer(
        scan.checks,
        plan=auth.plan,
        is_authenticated=True,
    )
    resp = ScanResponse.model_validate(scan)
    resp.checks = [ScanCheckResponse.model_validate(c) for c in checks_filtered]
    resp.locked_findings_count = locked_count
    resp.is_premium_locked = is_locked
    return resp


@router.get("/{website_id}/scans", response_model=List[ScanResponse])
async def get_website_scan_history(
    website_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves past scans for the website strictly scoped to active organization."""
    # Enforce website belongs to this organization
    site = await get_tenant_website(website_id, auth, db)

    stmt = (
        select(Scan)
        .options(selectinload(Scan.checks))
        .where(
            Scan.website_id == site.id,
            Scan.organization_id == auth.organization.id,
        )
    )

    plan_cfg = get_plan_config(auth.plan)
    retention_days = plan_cfg.get("history_retention_days")
    if retention_days and isinstance(retention_days, int):
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        stmt = stmt.where(Scan.created_at >= cutoff)

    stmt = stmt.order_by(desc(Scan.created_at)).limit(30)
    result = await db.execute(stmt)
    scans = result.scalars().all()

    out_scans: List[ScanResponse] = []
    for s in scans:
        checks_filtered, locked_count, is_locked = filter_findings_for_viewer(
            s.checks,
            plan=auth.plan,
            is_authenticated=True,
        )
        resp_item = ScanResponse.model_validate(s)
        resp_item.checks = [ScanCheckResponse.model_validate(c) for c in checks_filtered]
        resp_item.locked_findings_count = locked_count
        resp_item.is_premium_locked = is_locked
        out_scans.append(resp_item)

    return out_scans


@router.get("/{website_id}/pdf")
async def download_latest_website_pdf(
    website_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Downloads the PDF report for the latest COMPLETED scan of the given website.
    - Strict multi-tenant isolation via get_tenant_website.
    - Deterministically selects the latest scan where status == 'completed'.
    - Returns HTTP 404 NO_COMPLETED_SCANS if no completed scans exist.
    """
    # 1. Rate limit check (5/minute per user)
    try:
        await check_rate_limit(f"ratelimit:pdf:{auth.user.id}", max_requests=5, window_seconds=60)
    except HTTPException as e:
        if e.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            await record_audit_event(
                db=db,
                action="PDF_DOWNLOAD_REJECTED",
                entity_type="REPORT_PDF",
                organization_id=auth.organization.id,
                user_id=auth.user.id,
                entity_id=str(website_id),
                metadata={"reason": "Rate limit exceeded on website PDF download"},
            )
        raise

    # 2. Enforce website tenant ownership
    site = await get_tenant_website(website_id, auth, db)

    # 3. Find latest completed scan
    scan_stmt = (
        select(Scan)
        .options(selectinload(Scan.checks))
        .where(
            Scan.website_id == site.id,
            Scan.organization_id == auth.organization.id,
            Scan.status == "completed",
        )
        .order_by(desc(Scan.created_at))
        .limit(1)
    )
    scan_res = await db.execute(scan_stmt)
    latest_completed = scan_res.scalar_one_or_none()

    if not latest_completed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "NO_COMPLETED_SCANS",
                    "message": "No completed scans found for this website.",
                }
            },
        )

    # 4. Generate or fetch PDF report
    rep_stmt = (
        select(Report)
        .where(
            Report.scan_id == latest_completed.id,
            (Report.organization_id == auth.organization.id) | (Report.organization_id == None),
        )
    )
    rep_res = await db.execute(rep_stmt)
    report = rep_res.scalar_one_or_none()

    storage_dir = os.path.abspath(settings.STORAGE_PATH)
    os.makedirs(storage_dir, exist_ok=True)

    current_plan_slug = (auth.plan or "free").strip().lower()

    # Re-generate if physical file missing or if user upgraded/changed plan tier
    needs_generation = (
        not report
        or not report.pdf_path
        or not os.path.exists(report.pdf_path)
        or not report.pdf_path.endswith(f"-{current_plan_slug}.pdf")
    )

    if needs_generation:
        new_pdf_path = generate_pdf_report(
            scan=latest_completed,
            checks=latest_completed.checks or [],
            org=auth.organization,
            plan=auth.plan,
            output_directory=storage_dir,
        )
        if not report:
            report_number = f"RPT-{latest_completed.created_at.strftime('%Y%m%d') if latest_completed.created_at else '00000000'}-{latest_completed.id.hex[:6].upper()}"
            report = Report(
                id=uuid.uuid4(),
                organization_id=latest_completed.organization_id or auth.organization.id,
                scan_id=latest_completed.id,
                report_number=report_number,
                pdf_path=new_pdf_path,
                file_size_bytes=os.path.getsize(new_pdf_path) if os.path.exists(new_pdf_path) else None,
            )
            db.add(report)
        else:
            report.pdf_path = new_pdf_path
            report.file_size_bytes = os.path.getsize(new_pdf_path) if os.path.exists(new_pdf_path) else None
        await db.commit()

    # Path traversal protection: Ensure target file resides inside authorized storage
    real_pdf_path = os.path.abspath(report.pdf_path)
    if not (real_pdf_path.startswith(storage_dir) or real_pdf_path.startswith(os.path.abspath("storage"))):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "ACCESS_DENIED", "message": "Invalid report storage path."}},
        )

    await record_audit_event(
        db=db,
        action="REPORT_DOWNLOADED",
        entity_type="REPORT_PDF",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=str(report.id),
        metadata={
            "website_id": str(site.id),
            "scan_id": str(latest_completed.id),
            "report_number": report.report_number,
        },
    )

    brand_name = auth.organization.brand_name if (auth.organization and auth.organization.brand_name) else "SiteSecura"
    date_str = latest_completed.created_at.strftime("%Y-%m-%d") if latest_completed.created_at else None
    download_filename = sanitize_report_filename(
        domain=latest_completed.normalized_domain or latest_completed.domain,
        date_str=date_str,
        brand=brand_name,
    )

    return FileResponse(
        report.pdf_path,
        media_type="application/pdf",
        filename=download_filename,
    )


@router.post("/bulk-import", response_model=BulkImportResponse)
async def bulk_import_websites(
    file: UploadFile = File(...),
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Agency feature: Bulk imports websites from CSV (format: domain,name)."""
    require_feature(auth.plan, "bulk_import")

    content = await file.read()
    decoded = content.decode("utf-8-sig", errors="ignore")
    reader = csv.reader(io.StringIO(decoded))

    results: List[BulkImportRowResult] = []
    imported_count = 0
    skipped_count = 0

    plan_cfg = get_plan_config(auth.plan)
    count_stmt = select(Website).where(Website.organization_id == auth.organization.id)
    count_res = await db.execute(count_stmt)
    current_count = len(count_res.scalars().all())

    for idx, row in enumerate(reader):
        if not row or idx == 0 and "domain" in row[0].lower():
            continue  # Skip header or empty

        domain_raw = row[0].strip()
        name_raw = row[1].strip() if len(row) > 1 else domain_raw

        try:
            norm = normalize_domain(domain_raw)
        except SSRFValidationError as e:
            results.append(BulkImportRowResult(domain=domain_raw, name=name_raw, status="invalid", reason=str(e)))
            skipped_count += 1
            continue

        if current_count >= plan_cfg["max_websites"]:
            results.append(BulkImportRowResult(domain=domain_raw, name=name_raw, status="limit_reached", reason="Plan website quota reached."))
            skipped_count += 1
            continue

        # Check duplicate
        dup_stmt = select(Website).where(Website.organization_id == auth.organization.id, Website.normalized_domain == norm)
        dup_res = await db.execute(dup_stmt)
        if dup_res.scalar_one_or_none():
            results.append(BulkImportRowResult(domain=domain_raw, name=name_raw, status="duplicate", reason="Domain already exists."))
            skipped_count += 1
            continue

        new_site = Website(
            id=uuid.uuid4(),
            organization_id=auth.organization.id,
            name=name_raw,
            domain=domain_raw,
            normalized_domain=norm,
        )
        db.add(new_site)
        current_count += 1
        imported_count += 1
        results.append(BulkImportRowResult(domain=domain_raw, name=name_raw, status="imported"))

    await db.commit()
    return BulkImportResponse(
        total_processed=len(results),
        imported_count=imported_count,
        skipped_count=skipped_count,
        results=results,
    )


# =========================================================================
# PHASE C: DEDICATED WEBSITE MONITORING ENDPOINTS
# =========================================================================

@router.post("/{website_id}/monitoring", response_model=MonitoringResponse, status_code=status.HTTP_201_CREATED)
async def enable_website_monitoring(
    website_id: uuid.UUID,
    req: MonitoringEnableRequest = MonitoringEnableRequest(),
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Enables scheduled automated monitoring for a website:
    1. Tenant isolation: returns 404 if website does not belong to user's organization.
    2. Server-side entitlement check: raises 403 FEATURE_UPGRADE_REQUIRED for Free plan.
    3. Prevents duplicate active monitoring records (idempotent update).
    4. Sets initial schedule (weekly or daily).
    5. Records MONITORING_ENABLED audit event.
    """
    if auth.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Viewers cannot enable monitoring."}},
        )

    site = await get_tenant_website(website_id, auth, db)
    require_feature(auth.plan, "monitoring_allowed")

    # Validate frequency against plan
    frequency = req.frequency
    if auth.plan == "basic" and frequency == "daily":
        frequency = "weekly"  # Basic plan is limited to weekly

    stmt = select(Monitoring).where(Monitoring.website_id == site.id)
    mon = (await db.execute(stmt)).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    interval_days = 1 if frequency == "daily" else 7

    if not mon:
        mon = Monitoring(
            id=uuid.uuid4(),
            website_id=site.id,
            organization_id=auth.organization.id,
            enabled=True,
            frequency=frequency,
            status="active",
            next_run_at=now + timedelta(days=interval_days),
        )
        db.add(mon)
    else:
        mon.enabled = True
        mon.organization_id = auth.organization.id
        mon.frequency = frequency
        mon.status = "active"
        if not mon.next_run_at or mon.next_run_at <= now:
            mon.next_run_at = now + timedelta(days=interval_days)

    site.monitoring_enabled = True
    site.monitoring_frequency = frequency
    await db.commit()
    await db.refresh(mon)

    await record_audit_event(
        db=db,
        action="MONITORING_ENABLED",
        entity_type="MONITORING",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=str(mon.id),
        metadata={"website_id": str(site.id), "domain": site.domain, "frequency": frequency},
    )

    return MonitoringResponse.model_validate(mon)


@router.get("/{website_id}/monitoring", response_model=MonitoringResponse)
async def get_website_monitoring(
    website_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves monitoring configuration with strict organization isolation."""
    site = await get_tenant_website(website_id, auth, db)

    stmt = select(Monitoring).where(Monitoring.website_id == site.id)
    mon = (await db.execute(stmt)).scalar_one_or_none()
    if not mon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "MONITORING_NOT_CONFIGURED", "message": "Monitoring is not configured for this website."}},
        )

    return MonitoringResponse.model_validate(mon)


@router.patch("/{website_id}/monitoring", response_model=MonitoringResponse)
async def update_website_monitoring(
    website_id: uuid.UUID,
    update_in: MonitoringUpdateRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Updates monitoring configuration (frequency / enabled) with tenant isolation."""
    if auth.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Viewers cannot update monitoring."}},
        )

    site = await get_tenant_website(website_id, auth, db)

    new_enabled = update_in.enabled if update_in.enabled is not None else update_in.is_active
    if new_enabled:
        require_feature(auth.plan, "monitoring_allowed")

    stmt = select(Monitoring).where(Monitoring.website_id == site.id)
    mon = (await db.execute(stmt)).scalar_one_or_none()
    if not mon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "MONITORING_NOT_CONFIGURED", "message": "Monitoring is not configured for this website."}},
        )

    if new_enabled is not None:
        mon.enabled = new_enabled
        site.monitoring_enabled = new_enabled
        mon.status = "active" if new_enabled else "paused"

    if update_in.frequency is not None:
        freq = update_in.frequency
        if auth.plan == "basic" and freq == "daily":
            freq = "weekly"
        mon.frequency = freq
        site.monitoring_frequency = freq

    await db.commit()
    await db.refresh(mon)

    await record_audit_event(
        db=db,
        action="MONITORING_UPDATED",
        entity_type="MONITORING",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=str(mon.id),
        metadata={"website_id": str(site.id), "enabled": mon.enabled, "frequency": mon.frequency},
    )

    return MonitoringResponse.model_validate(mon)


@router.delete("/{website_id}/monitoring", status_code=status.HTTP_204_NO_CONTENT)
async def disable_website_monitoring(
    website_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Deactivates monitoring for the website:
    - Sets enabled=False and status='paused' to stop future scheduled scans.
    - Preserves all historical scans, reports, and alerts.
    - Records MONITORING_DISABLED audit event.
    """
    if auth.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Viewers cannot disable monitoring."}},
        )

    site = await get_tenant_website(website_id, auth, db)

    stmt = select(Monitoring).where(Monitoring.website_id == site.id)
    mon = (await db.execute(stmt)).scalar_one_or_none()
    if mon:
        mon.enabled = False
        mon.status = "paused"
        site.monitoring_enabled = False
        await db.commit()

        await record_audit_event(
            db=db,
            action="MONITORING_DISABLED",
            entity_type="MONITORING",
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            entity_id=str(mon.id),
            metadata={"website_id": str(site.id), "domain": site.domain},
        )

    return None

