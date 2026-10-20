"""
Scanly API - Entitlement & Quota Service
Authoritatively derives subscription plans, enforces atomic website and scan quotas,
and scrubs premium findings server-side according to plan entitlements.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.permissions import (
    normalize_plan_name,
    get_plan_config,
    can_view_full_findings,
    PLAN_CAPABILITIES,
)
from app.models.billing import Subscription, UsageRecord
from app.models.user import Organization
from app.models.website import Website
from app.models.scan import ScanCheck, Scan
from app.services.audit_service import record_audit_event, record_audit_event_sync

logger = logging.getLogger(__name__)


def get_current_usage_period() -> Tuple[str, datetime, datetime]:
    """
    Returns (period_month, period_start, period_end) in UTC.
    Example: ("2026-09", datetime(2026, 9, 1), datetime(2026, 10, 1))
    """
    now = datetime.now(timezone.utc)
    period_month = now.strftime("%Y-%m")
    period_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    if now.month == 12:
        period_end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        period_end = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
    return period_month, period_start, period_end


async def get_effective_plan(
    db: AsyncSession,
    organization_id: uuid.UUID,
    fallback_role: Optional[str] = None,
) -> str:
    """
    Authoritative plan resolution:
    1. Looks up active Subscription record in database.
    2. If subscription is active or trialing, returns normalized subscription plan.
    3. If user has platform admin role, preserves admin entitlement.
    4. Otherwise, strictly defaults to 'free'.
    """
    if fallback_role and fallback_role.lower() == "admin":
        return "admin"

    stmt = select(Subscription).where(Subscription.organization_id == organization_id)
    res = await db.execute(stmt)
    sub = res.scalar_one_or_none()

    if sub and sub.status in ("active", "trialing"):
        return normalize_plan_name(sub.plan)

    # If subscription is past_due or canceled, fallback to free
    return "free"


async def check_and_reserve_website_quota(
    db: AsyncSession,
    organization_id: uuid.UUID,
    plan: str,
) -> None:
    """
    Atomically checks and enforces website quotas for an organization.
    Uses row-level locking on Organization to prevent concurrent race conditions.
    """
    cfg = get_plan_config(plan)
    max_websites = cfg.get("max_websites", 1)

    # 1. Row-lock organization to serialize concurrent website creation requests
    lock_stmt = (
        select(Organization.id)
        .where(Organization.id == organization_id)
        .with_for_update()
    )
    await db.execute(lock_stmt)

    # 2. Count current active websites
    count_stmt = select(func.count(Website.id)).where(Website.organization_id == organization_id)
    count_res = await db.execute(count_stmt)
    current_count = count_res.scalar() or 0

    if current_count >= max_websites:
        await record_audit_event(
            db=db,
            action="WEBSITE_REJECTED_QUOTA",
            entity_type="WEBSITE_QUOTA",
            organization_id=organization_id,
            metadata={"plan": plan, "limit": max_websites, "used": current_count},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "PLAN_LIMIT_REACHED",
                    "message": f"Website limit reached ({max_websites}) for plan '{plan}'. Please upgrade your subscription to add more websites.",
                    "limit": max_websites,
                    "used": current_count,
                }
            },
        )


async def check_and_reserve_scan_quota(
    db: AsyncSession,
    organization_id: uuid.UUID,
    plan: str,
) -> UsageRecord:
    """
    Atomically reserves a scan quota slot for the current billing month.
    Uses row-level locking on UsageRecord to eliminate concurrent race conditions.
    Raises HTTP 403 if the quota is exhausted.
    """
    cfg = get_plan_config(plan)
    max_scans = cfg.get("max_scans_per_month", 10)
    period_month, _, period_end = get_current_usage_period()

    # 1. Fetch or create UsageRecord with row lock
    stmt = (
        select(UsageRecord)
        .where(
            UsageRecord.organization_id == organization_id,
            UsageRecord.period_month == period_month,
        )
        .with_for_update()
    )
    res = await db.execute(stmt)
    usage = res.scalar_one_or_none()

    if not usage:
        usage = UsageRecord(
            id=uuid.uuid4(),
            organization_id=organization_id,
            period_month=period_month,
            scans_count=0,
            monitored_sites_count=0,
            pdf_reports_count=0,
        )
        db.add(usage)
        await db.flush()

    # 2. Verify quota limit
    if usage.scans_count >= max_scans:
        reset_iso = period_end.isoformat()
        await record_audit_event(
            db=db,
            action="SCAN_REJECTED_QUOTA",
            entity_type="SCAN_QUOTA",
            organization_id=organization_id,
            metadata={"plan": plan, "limit": max_scans, "used": usage.scans_count},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "SCAN_QUOTA_EXCEEDED",
                    "message": f"Monthly scan quota ({max_scans} scans) exceeded for plan '{plan}'. Please upgrade your subscription or wait until {reset_iso}.",
                    "used": usage.scans_count,
                    "limit": max_scans,
                    "reset_at": reset_iso,
                }
            },
        )

    # 3. Atomically consume 1 scan slot
    usage.scans_count += 1
    await db.flush()
    return usage


async def refund_scan_quota(
    db: AsyncSession,
    organization_id: uuid.UUID,
    scan: Optional[Scan] = None,
    scan_id: Optional[uuid.UUID] = None,
) -> bool:
    """
    Compensates/refunds 1 consumed scan quota slot if scan enqueue/creation failed.
    Prevents silent quota consumption when a scan could not be dispatched or accepted.
    Guarantees idempotency: duplicate calls for the same scan are safely rejected.
    """
    if scan is None and scan_id is not None:
        scan_res = await db.execute(select(Scan).where(Scan.id == scan_id))
        scan = scan_res.scalar_one_or_none()

    if scan is not None:
        meta = scan.scan_metadata or {}
        if meta.get("quota_refunded"):
            logger.info(f"Scan {scan.id} quota already refunded. Skipping duplicate refund.")
            return False

    period_month, _, _ = get_current_usage_period()
    stmt = (
        select(UsageRecord)
        .where(
            UsageRecord.organization_id == organization_id,
            UsageRecord.period_month == period_month,
        )
        .with_for_update()
    )
    res = await db.execute(stmt)
    usage = res.scalar_one_or_none()
    if usage and usage.scans_count > 0:
        usage.scans_count -= 1

    if scan is not None:
        new_meta = dict(scan.scan_metadata or {})
        new_meta["quota_refunded"] = True
        new_meta["refunded_at"] = datetime.now(timezone.utc).isoformat()
        scan.scan_metadata = new_meta

    await db.flush()
    return True


async def check_and_reserve_ai_quota(
    db: AsyncSession,
    organization_id: uuid.UUID,
    plan: str,
) -> UsageRecord:
    """
    Atomically checks and reserves an AI generation quota slot for the current billing month.
    Only Pro and Agency (+ Admin) plans are eligible.
    Enforces configurable limits: AI_MONTHLY_LIMIT_PRO (default 100), AI_MONTHLY_LIMIT_AGENCY (default 500).
    Uses row-level locking on UsageRecord.
    Raises HTTP 403 AI_QUOTA_EXCEEDED if limit is reached.
    """
    from app.core.config import settings
    norm_plan = normalize_plan_name(plan)
    if norm_plan in ("free", "basic"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "AI_FEATURE_REQUIRED",
                    "message": "AI Security Advisor is available exclusively on Pro and Agency plans. Upgrade your subscription to access AI explanations, remediation guides, and security analysis.",
                }
            },
        )

    if norm_plan == "admin":
        max_ai = 99999
    elif norm_plan == "agency":
        max_ai = getattr(settings, "AI_MONTHLY_LIMIT_AGENCY", 500)
    else:  # pro
        max_ai = getattr(settings, "AI_MONTHLY_LIMIT_PRO", 100)

    period_month, _, period_end = get_current_usage_period()

    stmt = (
        select(UsageRecord)
        .where(
            UsageRecord.organization_id == organization_id,
            UsageRecord.period_month == period_month,
        )
        .with_for_update()
    )
    res = await db.execute(stmt)
    usage = res.scalar_one_or_none()

    if not usage:
        usage = UsageRecord(
            id=uuid.uuid4(),
            organization_id=organization_id,
            period_month=period_month,
            scans_count=0,
            monitored_sites_count=0,
            pdf_reports_count=0,
            ai_requests_count=0,
        )
        db.add(usage)
        await db.flush()

    current_count = getattr(usage, "ai_requests_count", 0) or 0
    if current_count >= max_ai:
        reset_iso = period_end.isoformat()
        await record_audit_event(
            db=db,
            action="AI_REJECTED_QUOTA",
            entity_type="AI_QUOTA",
            organization_id=organization_id,
            metadata={"plan": norm_plan, "limit": max_ai, "used": current_count},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "AI_QUOTA_EXCEEDED",
                    "message": f"Monthly AI generation quota ({max_ai} requests) exceeded for plan '{norm_plan}'. Please upgrade your subscription or wait until {reset_iso}.",
                    "used": current_count,
                    "limit": max_ai,
                    "reset_at": reset_iso,
                }
            },
        )

    usage.ai_requests_count = current_count + 1
    await db.flush()
    return usage


async def refund_ai_quota(
    db: AsyncSession,
    organization_id: uuid.UUID,
) -> None:
    """
    Compensates/refunds 1 consumed AI generation quota slot if an AI generation operation fails across all providers.
    """
    period_month, _, _ = get_current_usage_period()
    stmt = (
        select(UsageRecord)
        .where(
            UsageRecord.organization_id == organization_id,
            UsageRecord.period_month == period_month,
        )
        .with_for_update()
    )
    res = await db.execute(stmt)
    usage = res.scalar_one_or_none()
    if usage and getattr(usage, "ai_requests_count", 0) > 0:
        usage.ai_requests_count -= 1
        await db.flush()


def check_and_reserve_scan_quota_sync(
    db: Session,
    organization_id: uuid.UUID,
    plan: str,
) -> Optional[UsageRecord]:
    """
    Synchronous scan quota reservation helper for Celery workers and background tasks.
    Returns UsageRecord if quota is available and consumed, or None if quota is exhausted.
    """
    cfg = get_plan_config(plan)
    max_scans = cfg.get("max_scans_per_month", 10)
    period_month, _, period_end = get_current_usage_period()

    stmt = (
        select(UsageRecord)
        .where(
            UsageRecord.organization_id == organization_id,
            UsageRecord.period_month == period_month,
        )
        .with_for_update()
    )
    res = db.execute(stmt)
    usage = res.scalar_one_or_none()

    if not usage:
        usage = UsageRecord(
            id=uuid.uuid4(),
            organization_id=organization_id,
            period_month=period_month,
            scans_count=0,
            monitored_sites_count=0,
            pdf_reports_count=0,
        )
        db.add(usage)
        db.flush()

    if usage.scans_count >= max_scans:
        record_audit_event_sync(
            db=db,
            action="SCAN_REJECTED_QUOTA",
            entity_type="SCAN_QUOTA",
            organization_id=organization_id,
            metadata={"plan": plan, "limit": max_scans, "used": usage.scans_count},
        )
        return None

    usage.scans_count += 1
    db.flush()
    return usage


def refund_scan_quota_sync(
    db: Session,
    organization_id: uuid.UUID,
    scan: Optional[Scan] = None,
    scan_id: Optional[uuid.UUID] = None,
) -> bool:
    """
    Synchronous quota refund helper for background workers, task retries, and watchdog recovery.
    Compensates/refunds 1 consumed scan quota slot when a scan fails or times out.
    Guarantees idempotency: duplicate calls for the same scan are safely rejected.
    """
    if scan is None and scan_id is not None:
        scan = db.execute(select(Scan).where(Scan.id == scan_id)).scalar_one_or_none()

    if scan is not None:
        meta = scan.scan_metadata or {}
        if meta.get("quota_refunded"):
            logger.info(f"Scan {scan.id} quota already refunded. Skipping duplicate refund.")
            return False

    period_month, _, _ = get_current_usage_period()
    stmt = (
        select(UsageRecord)
        .where(
            UsageRecord.organization_id == organization_id,
            UsageRecord.period_month == period_month,
        )
        .with_for_update()
    )
    res = db.execute(stmt)
    usage = res.scalar_one_or_none()
    if usage and usage.scans_count > 0:
        usage.scans_count -= 1

    if scan is not None:
        new_meta = dict(scan.scan_metadata or {})
        new_meta["quota_refunded"] = True
        new_meta["refunded_at"] = datetime.now(timezone.utc).isoformat()
        scan.scan_metadata = new_meta

    db.flush()
    return True


def filter_findings_for_viewer(
    checks: List[ScanCheck],
    plan: str,
    is_authenticated: bool = True,
) -> Tuple[List[Dict[str, Any]], int, bool]:
    """
    Applies server-side entitlement filtering on scan check findings:
    - Paid plans (Basic, Pro, Agency, Admin): Receives 100% full findings.
    - Free plan / Anonymous visitor: Top 3 findings unlocked; remaining findings
      are sanitized server-side, redacting all technical details, remediation,
      evidence, and URLs to prevent client-side DevTools data leakage.
    Returns: (findings_list, locked_count, is_premium_locked)
    """
    has_full_entitlement = can_view_full_findings(plan)
    sorted_checks = sorted(checks, key=lambda c: c.score_impact)

    if has_full_entitlement:
        out = []
        for c in sorted_checks:
            out.append({
                "id": str(c.id),
                "check_type": c.check_type,
                "name": c.name,
                "status": c.status,
                "severity": c.severity,
                "score_impact": c.score_impact,
                "title": c.title,
                "summary": c.summary,
                "why_it_matters": c.why_it_matters,
                "how_to_fix": c.how_to_fix,
                "estimated_fix_minutes": c.estimated_fix_minutes,
                "documentation_url": c.documentation_url,
                "evidence": c.evidence,
                "confidence": c.confidence,
                "is_locked": False,
            })
        return out, 0, False

    # Free plan or unauthenticated visitor: unlock top 3, redact remainder server-side
    out = []
    locked_count = 0
    for idx, c in enumerate(sorted_checks):
        if idx < 3:
            out.append({
                "id": str(c.id),
                "check_type": c.check_type,
                "name": c.name,
                "status": c.status,
                "severity": c.severity,
                "score_impact": c.score_impact,
                "title": c.title,
                "summary": c.summary,
                "why_it_matters": c.why_it_matters,
                "how_to_fix": c.how_to_fix,
                "estimated_fix_minutes": c.estimated_fix_minutes,
                "documentation_url": c.documentation_url,
                "evidence": c.evidence,
                "confidence": c.confidence,
                "is_locked": False,
            })
        else:
            locked_count += 1
            # Redacted representation: ZERO technical detail or remediation leakage
            out.append({
                "id": str(c.id),
                "check_type": c.check_type,
                "name": f"Security Finding #{idx + 1}",
                "status": "locked",
                "severity": c.severity,
                "score_impact": 0,
                "title": f"Security Assessment Finding #{idx + 1}",
                "summary": "This finding requires a SiteSecura upgraded subscription to view technical evidence and remediation steps.",
                "why_it_matters": None,
                "how_to_fix": None,
                "estimated_fix_minutes": 0,
                "documentation_url": None,
                "evidence": None,
                "confidence": 1.0,
                "is_locked": True,
            })

    return out, locked_count, (locked_count > 0)
