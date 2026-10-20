"""
Scanly API - Scans Endpoints
Handles public anonymous scans, authenticated scans, status polling, report retrieval, and PDF downloads.
"""
import os
import re
import uuid
import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import FileResponse
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.db.session import get_db, get_sync_db
from app.models.scan import Scan, ScanCheck, Report
from app.models.website import Website
from app.schemas.scan import (
    ScanCreateRequest,
    ScanResponse,
    ScanCheckResponse,
    PublicScanResultResponse,
)
from app.services.scan_service import execute_scan_job
from app.services.pdf_service import generate_pdf_report, sanitize_report_filename
from app.tasks.worker import scan_website_task
from scanner.domain import normalize_domain, SSRFValidationError
from app.core.rate_limit import get_client_ip, check_rate_limit
from app.core.authorization import (
    AuthContext,
    get_current_auth_context,
    get_optional_auth_context,
    get_tenant_website,
)
from app.services.entitlement_service import (
    check_and_reserve_scan_quota,
    refund_scan_quota,
    filter_findings_for_viewer,
)
from app.services.audit_service import record_audit_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scans", tags=["Scans"])


@router.post("", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
async def create_scan(
    request: Request,
    scan_in: ScanCreateRequest,
    opt_auth: Optional[AuthContext] = Depends(get_optional_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Starts a new security scan.
    - If user is anonymous, enforces IP rate limits (3/day) and marks scan_type as public.
    - If user is authenticated, validates and atomically consumes scan quota under organization.
    - Verified tenant association: website_id must belong strictly to active organization.
    """
    client_ip = get_client_ip(request)

    # 1. Normalize domain & defensive validation
    try:
        norm_domain = normalize_domain(scan_in.domain)
    except SSRFValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "INVALID_DOMAIN", "message": str(e)}},
        )

    scan_id = uuid.uuid4()
    org_id: Optional[uuid.UUID] = None
    user_id: Optional[uuid.UUID] = None
    website_id: Optional[uuid.UUID] = None
    scan_type = "public"
    plan = "free"

    if opt_auth:
        # Authenticated flow:
        # 1. Burst rate limiting per user
        try:
            await check_rate_limit(f"ratelimit:user_scan:{opt_auth.user.id}", max_requests=20, window_seconds=60)
        except HTTPException as e:
            if e.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                await record_audit_event(
                    db=db,
                    action="SCAN_REJECTED_RATE_LIMIT",
                    entity_type="SCAN",
                    organization_id=opt_auth.organization.id,
                    user_id=opt_auth.user.id,
                    metadata={"limit": 20, "window": 60, "reason": "user_burst_limit_exceeded"},
                    ip_address=client_ip,
                )
            raise

        # 2. Enforce role: viewer cannot start scans
        if opt_auth.role == "viewer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "INSUFFICIENT_PERMISSIONS", "message": "Viewers cannot trigger scans."}},
            )

        # 3. Verify website belongs to organization if provided
        if scan_in.website_id:
            site = await get_tenant_website(scan_in.website_id, opt_auth, db)
            website_id = site.id

        # 4. Atomically check and reserve monthly scan quota
        await check_and_reserve_scan_quota(db, opt_auth.organization.id, opt_auth.plan)

        org_id = opt_auth.organization.id
        user_id = opt_auth.user.id
        scan_type = "manual"
        plan = opt_auth.plan
    else:
        # Anonymous user: website_id not permitted
        if scan_in.website_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": {"code": "AUTHENTICATION_REQUIRED", "message": "Authentication required to associate scan with a registered website."}},
            )
        # Anonymous IP rate limit: strictly 3 scans per 24 hours (86400 seconds)
        try:
            await check_rate_limit(f"ratelimit:public_scan:{client_ip}", max_requests=3, window_seconds=86400)
        except HTTPException as e:
            if e.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                await record_audit_event(
                    db=db,
                    action="SCAN_REJECTED_RATE_LIMIT",
                    entity_type="SCAN",
                    metadata={"limit": 3, "window": 86400, "reason": "public_daily_limit_exceeded"},
                    ip_address=client_ip,
                )
            raise

    new_scan = Scan(
        id=scan_id,
        organization_id=org_id,
        website_id=website_id,
        requested_by_user_id=user_id,
        domain=scan_in.domain,
        normalized_domain=norm_domain,
        status="queued",
        scan_type=scan_type,
    )
    db.add(new_scan)
    await db.commit()
    await db.refresh(new_scan)

    if opt_auth:
        await record_audit_event(
            db=db,
            action="SCAN_CREATED",
            entity_type="SCAN",
            organization_id=org_id,
            user_id=user_id,
            entity_id=str(scan_id),
            metadata={"domain": norm_domain, "scan_type": scan_type},
            ip_address=client_ip,
        )

    # Enqueue in Celery or run in worker
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
        if org_id:
            await refund_scan_quota(db, org_id, scan=new_scan)
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
            organization_id=org_id,
            user_id=user_id,
            entity_id=str(scan_id),
            metadata={"reason": "Enqueue and fallback execution both failed; quota refunded"},
            ip_address=client_ip,
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "SCAN_DISPATCH_FAILED",
                    "message": "Scan worker execution failed. Your scan quota slot has been refunded.",
                }
            },
        )

    # Reload scan with checks loaded eagerly
    stmt = select(Scan).options(selectinload(Scan.checks)).where(Scan.id == scan_id)
    res = await db.execute(stmt)
    refreshed_scan = res.scalar_one()

    # Server-side finding redaction
    filtered_checks, locked_count, is_locked = filter_findings_for_viewer(
        refreshed_scan.checks,
        plan=plan,
        is_authenticated=bool(opt_auth),
    )
    resp = ScanResponse.model_validate(refreshed_scan)
    resp.checks = [ScanCheckResponse.model_validate(c) for c in filtered_checks]
    resp.locked_findings_count = locked_count
    resp.is_premium_locked = is_locked
    return resp


@router.get("/{scan_id}", response_model=ScanResponse)
async def get_scan_details(
    scan_id: uuid.UUID,
    opt_auth: Optional[AuthContext] = Depends(get_optional_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves full scan metadata and findings by ID.
    - Tenant isolation: If scan belongs to an organization, unauthorized viewers receive 404.
    - Server-side finding protection: Free users and public visitors receive redacted findings.
    """
    stmt = select(Scan).options(selectinload(Scan.checks)).where(Scan.id == scan_id)
    result = await db.execute(stmt)
    scan = result.scalar_one_or_none()

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SCAN_NOT_FOUND", "message": f"Scan {scan_id} not found."}},
        )

    # Enforce multi-tenant organization isolation (404 strategy)
    if scan.organization_id is not None:
        if not opt_auth or (opt_auth.organization.id != scan.organization_id and not opt_auth.is_admin):
            if opt_auth:
                await record_audit_event(
                    db=db,
                    action="PERMISSION_DENIED",
                    entity_type="SCAN",
                    organization_id=opt_auth.organization.id,
                    user_id=opt_auth.user.id,
                    entity_id=str(scan_id),
                    metadata={"reason": "Attempted cross-tenant scan access"},
                )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": {"code": "SCAN_NOT_FOUND", "message": f"Scan {scan_id} not found."}},
            )

    viewer_plan = opt_auth.plan if opt_auth else "free"
    filtered_checks, locked_count, is_locked = filter_findings_for_viewer(
        scan.checks,
        plan=viewer_plan,
        is_authenticated=bool(opt_auth),
    )

    if opt_auth:
        await record_audit_event(
            db=db,
            action="REPORT_VIEWED",
            entity_type="SCAN",
            organization_id=opt_auth.organization.id,
            user_id=opt_auth.user.id,
            entity_id=str(scan_id),
            metadata={"domain": scan.domain},
        )

    resp = ScanResponse.model_validate(scan)
    resp.checks = [ScanCheckResponse.model_validate(c) for c in filtered_checks]
    resp.locked_findings_count = locked_count
    resp.is_premium_locked = is_locked
    return resp


@router.get("/{scan_id}/status")
async def get_scan_status(
    scan_id: uuid.UUID,
    opt_auth: Optional[AuthContext] = Depends(get_optional_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Fast lightweight polling endpoint for scanning UI progress with tenant isolation."""
    stmt = select(Scan.id, Scan.organization_id, Scan.status, Scan.score, Scan.risk_level, Scan.error_message).where(Scan.id == scan_id)
    result = await db.execute(stmt)
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SCAN_NOT_FOUND", "message": f"Scan {scan_id} not found."}},
        )

    # Multi-tenant scoping
    if row.organization_id is not None:
        if not opt_auth or (opt_auth.organization.id != row.organization_id and not opt_auth.is_admin):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": {"code": "SCAN_NOT_FOUND", "message": f"Scan {scan_id} not found."}},
            )

    return {
        "id": scan_id,
        "status": row.status,
        "score": row.score,
        "risk_level": row.risk_level,
        "error_message": row.error_message,
    }


@router.get("/{scan_id}/results", response_model=PublicScanResultResponse)
async def get_public_scan_results(
    scan_id: uuid.UUID,
    opt_auth: Optional[AuthContext] = Depends(get_optional_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Public result view:
    - Tenant isolation enforced for private organization scans.
    - Server-side finding protection: Only unlocked findings returned.
    """
    stmt = select(Scan).options(selectinload(Scan.checks)).where(Scan.id == scan_id)
    result = await db.execute(stmt)
    scan = result.scalar_one_or_none()

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SCAN_NOT_FOUND", "message": f"Scan {scan_id} not found."}},
        )

    if scan.organization_id is not None:
        if not opt_auth or (opt_auth.organization.id != scan.organization_id and not opt_auth.is_admin):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": {"code": "SCAN_NOT_FOUND", "message": f"Scan {scan_id} not found."}},
            )

    viewer_plan = opt_auth.plan if opt_auth else "free"
    filtered_checks, locked_count, is_locked = filter_findings_for_viewer(
        scan.checks,
        plan=viewer_plan,
        is_authenticated=bool(opt_auth),
    )

    unlocked = [ScanCheckResponse.model_validate(c) for c in filtered_checks if not c.get("is_locked", False)]

    return PublicScanResultResponse(
        id=scan.id,
        domain=scan.domain,
        normalized_domain=scan.normalized_domain,
        status=scan.status,
        score=scan.score,
        risk_level=scan.risk_level,
        score_breakdown=scan.score_breakdown,
        passed_checks_count=scan.passed_checks_count,
        total_checks_count=scan.total_checks_count,
        scan_duration_ms=scan.scan_duration_ms,
        created_at=scan.created_at,
        unlocked_findings=unlocked,
        locked_findings_count=locked_count,
        is_premium_locked=is_locked,
    )


@router.get("/{scan_id}/pdf")
async def download_scan_pdf(
    scan_id: uuid.UUID,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Downloads generated PDF security audit report with strict tenant isolation and rate limits.
    Prevents cross-tenant IDOR/BOLA attacks.
    """
    # 1. Rate limit PDF downloads (5/minute per user)
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
                entity_id=str(scan_id),
                metadata={"reason": "Rate limit exceeded on PDF download"},
            )
        raise

    # 2. Look up scan and verify tenant ownership
    scan_stmt = select(Scan).where(Scan.id == scan_id).options(selectinload(Scan.checks))
    scan_obj = (await db.execute(scan_stmt)).scalar_one_or_none()
    if not scan_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SCAN_NOT_FOUND", "message": f"Scan {scan_id} not found."}},
        )

    # Multi-tenant scoping
    if scan_obj.organization_id is not None and scan_obj.organization_id != auth.organization.id and not auth.is_admin:
        await record_audit_event(
            db=db,
            action="PDF_DOWNLOAD_REJECTED",
            entity_type="REPORT_PDF",
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            entity_id=str(scan_id),
            metadata={"reason": "Attempted cross-tenant PDF download"},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "REPORT_NOT_FOUND", "message": f"Report for scan {scan_id} not found."}},
        )

    # 3. Status validation: reject uncompleted scans
    if scan_obj.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "SCAN_NOT_COMPLETED",
                    "message": f"PDF report cannot be generated for scan with status '{scan_obj.status}'. Only completed scans have PDF reports.",
                }
            },
        )

    # 4. Look up or generate report record
    rep_stmt = (
        select(Report)
        .where(
            Report.scan_id == scan_id,
            (Report.organization_id == auth.organization.id) | (Report.organization_id == None),
        )
    )
    report = (await db.execute(rep_stmt)).scalar_one_or_none()

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
            scan=scan_obj,
            checks=scan_obj.checks or [],
            org=auth.organization,
            plan=auth.plan,
            output_directory=storage_dir,
        )
        if not report:
            report_number = f"RPT-{scan_obj.created_at.strftime('%Y%m%d') if scan_obj.created_at else '00000000'}-{scan_obj.id.hex[:6].upper()}"
            report = Report(
                id=uuid.uuid4(),
                organization_id=scan_obj.organization_id or auth.organization.id,
                scan_id=scan_obj.id,
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

    # 5. Audit successful download
    await record_audit_event(
        db=db,
        action="REPORT_DOWNLOADED",
        entity_type="REPORT_PDF",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=str(report.id),
        metadata={"scan_id": str(scan_id), "report_number": report.report_number},
    )

    brand_name = auth.organization.brand_name if (auth.organization and auth.organization.brand_name) else "SiteSecura"
    date_str = scan_obj.created_at.strftime("%Y-%m-%d") if scan_obj.created_at else None
    download_filename = sanitize_report_filename(
        domain=scan_obj.normalized_domain or scan_obj.domain,
        date_str=date_str,
        brand=brand_name,
    )

    return FileResponse(
        report.pdf_path,
        media_type="application/pdf",
        filename=download_filename,
    )
