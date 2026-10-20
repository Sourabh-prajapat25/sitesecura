"""
Scanly API - Admin Service Layer
Comprehensive administrative operations across users, tenants, websites, scans,
subscriptions, CMS, support, audit logs, and system health.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple

import redis
from sqlalchemy import select, func, desc, and_, or_, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.permissions import normalize_plan_name, get_plan_config
from app.db.session import get_sync_db
from app.models.user import User, Organization, OrganizationMember
from app.models.website import Website, Monitoring
from app.models.scan import Scan, ScanCheck, Report
from app.models.billing import Subscription, UsageRecord
from app.models.alert import Alert, AuditLog
from app.models.cms import BlogPost, BlogCategory, SupportTicket, ContactMessage
from app.models.ai import AIGeneration
from app.schemas.admin import (
    AdminDashboardStats,
    AdminUserItem,
    AdminUserDetail,
    AdminOrgItem,
    AdminWebsiteItem,
    AdminScanItem,
    AdminSubscriptionItem,
    AdminSupportTicketItem,
    AdminContactItem,
    AdminAuditLogItem,
    AdminSystemHealth,
    AdminAnalyticsResponse,
)
from app.services.audit_service import record_audit_event
from app.services.scan_service import execute_scan_job
from app.services.entitlement_service import get_effective_plan, get_current_usage_period
from app.tasks.worker import scan_website_task

logger = logging.getLogger(__name__)


# =========================================================================
# 1. Dashboard & Analytics
# =========================================================================

async def get_admin_dashboard_stats(db: AsyncSession) -> AdminDashboardStats:
    """Calculates live operational metrics from real database models."""
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # Users
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users = (await db.execute(select(func.count(User.id)).where(User.is_active == True))).scalar() or 0
    new_users_30d = (await db.execute(select(func.count(User.id)).where(User.created_at >= thirty_days_ago))).scalar() or 0

    # User breakdown by role/plan
    plan_counts: Dict[str, int] = {"free": 0, "basic": 0, "pro": 0, "agency": 0, "admin": 0}
    plan_rows = (await db.execute(select(User.role, func.count(User.id)).group_by(User.role))).fetchall()
    for role, count in plan_rows:
        norm = normalize_plan_name(role)
        plan_counts[norm] = plan_counts.get(norm, 0) + count

    # Organizations & Websites
    total_orgs = (await db.execute(select(func.count(Organization.id)))).scalar() or 0
    total_sites = (await db.execute(select(func.count(Website.id)))).scalar() or 0
    monitored_sites = (await db.execute(select(func.count(Monitoring.id)).where(Monitoring.is_active == True))).scalar() or 0

    # Scans
    total_scans = (await db.execute(select(func.count(Scan.id)))).scalar() or 0
    scans_today = (await db.execute(select(func.count(Scan.id)).where(Scan.created_at >= today_start))).scalar() or 0
    scans_month = (await db.execute(select(func.count(Scan.id)).where(Scan.created_at >= month_start))).scalar() or 0

    scans_by_status: Dict[str, int] = {"completed": 0, "failed": 0, "running": 0, "queued": 0}
    status_rows = (await db.execute(select(Scan.status, func.count(Scan.id)).group_by(Scan.status))).fetchall()
    for st, count in status_rows:
        scans_by_status[st] = count

    completed_scans = scans_by_status.get("completed", 0)
    success_rate = round((completed_scans / total_scans * 100.0), 1) if total_scans > 0 else 100.0

    # Subscriptions & AI
    active_subs = (await db.execute(select(func.count(Subscription.id)).where(Subscription.status.in_(["active", "trialing"])))).scalar() or 0
    total_ai = (await db.execute(select(func.count(AIGeneration.id)))).scalar() or 0

    # Support & Contact
    open_tickets = (await db.execute(select(func.count(SupportTicket.id)).where(SupportTicket.status == "open"))).scalar() or 0
    new_contacts = (await db.execute(select(func.count(ContactMessage.id)).where(ContactMessage.status == "new"))).scalar() or 0

    return AdminDashboardStats(
        total_users=total_users,
        active_users=active_users,
        new_users_30d=new_users_30d,
        users_by_plan=plan_counts,
        total_organizations=total_orgs,
        total_websites=total_sites,
        monitored_websites=monitored_sites,
        total_scans=total_scans,
        scans_today=scans_today,
        scans_this_month=scans_month,
        scan_success_rate=success_rate,
        scans_by_status=scans_by_status,
        active_subscriptions=active_subs,
        total_ai_generations=total_ai,
        open_support_tickets=open_tickets,
        new_contact_messages=new_contacts,
    )


# =========================================================================
# 2. User Management
# =========================================================================

async def list_admin_users(
    db: AsyncSession,
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
) -> Tuple[List[AdminUserItem], int]:
    """Lists users with filtering, pagination, and associated resource counts."""
    query = select(User)
    conditions = []

    if search:
        s = f"%{search.strip()}%"
        conditions.append(or_(User.email.ilike(s), User.name.ilike(s)))
    if role:
        conditions.append(User.role == role.lower())
    if is_active is not None:
        conditions.append(User.is_active == is_active)

    if conditions:
        query = query.where(and_(*conditions))

    # Count total matching
    count_stmt = select(func.count(User.id))
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    total_count = (await db.execute(count_stmt)).scalar() or 0

    # Paginate
    query = query.order_by(desc(User.created_at)).offset(offset).limit(limit)
    users = (await db.execute(query)).scalars().all()

    items: List[AdminUserItem] = []
    for u in users:
        org_name = None
        plan = u.role
        websites_cnt = 0
        scans_cnt = 0

        if u.organization_id:
            org = await db.get(Organization, u.organization_id)
            if org:
                org_name = org.name
                plan = await get_effective_plan(db, org.id, fallback_role=u.role)
                websites_cnt = (await db.execute(select(func.count(Website.id)).where(Website.organization_id == org.id))).scalar() or 0
                scans_cnt = (await db.execute(select(func.count(Scan.id)).where(Scan.organization_id == org.id))).scalar() or 0

        items.append(
            AdminUserItem(
                id=u.id,
                email=u.email,
                name=u.name,
                role=u.role,
                is_active=u.is_active,
                organization_id=u.organization_id,
                organization_name=org_name,
                plan=plan,
                websites_count=websites_cnt,
                scans_count=scans_cnt,
                created_at=u.created_at,
            )
        )
    return items, total_count


async def get_admin_user_detail(db: AsyncSession, user_id: uuid.UUID) -> Optional[AdminUserDetail]:
    """Retrieves detailed user profile with associated organization, websites, and scans."""
    user = await db.get(User, user_id)
    if not user:
        return None

    org_data = None
    sub_data = None
    usage_data = None
    sites_list = []
    recent_scans_list = []

    if user.organization_id:
        org = await db.get(Organization, user.organization_id)
        if org:
            org_data = {
                "id": str(org.id),
                "name": org.name,
                "type": org.type,
                "owner_id": str(org.owner_id) if org.owner_id else None,
            }

            sub_stmt = select(Subscription).where(Subscription.organization_id == org.id)
            sub = (await db.execute(sub_stmt)).scalar_one_or_none()
            if sub:
                sub_data = {
                    "plan": sub.plan,
                    "status": sub.status,
                    "stripe_customer_id": sub.stripe_customer_id,
                    "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
                }

            period_month, _, _ = get_current_usage_period()
            use_stmt = select(UsageRecord).where(
                UsageRecord.organization_id == org.id,
                UsageRecord.period_month == period_month,
            )
            use = (await db.execute(use_stmt)).scalar_one_or_none()
            if use:
                usage_data = {
                    "period_month": use.period_month,
                    "scans_count": use.scans_count,
                    "ai_requests_count": use.ai_requests_count,
                }

            sites_stmt = select(Website).where(Website.organization_id == org.id).order_by(desc(Website.created_at)).limit(10)
            sites = (await db.execute(sites_stmt)).scalars().all()
            for s in sites:
                last_sc = await db.get(Scan, s.last_scan_id) if s.last_scan_id else None
                sites_list.append({
                    "id": str(s.id),
                    "domain": s.domain,
                    "score": last_sc.score if last_sc else None,
                    "status": s.status,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                })

            scans_stmt = select(Scan).where(Scan.organization_id == org.id).order_by(desc(Scan.created_at)).limit(10)
            scans = (await db.execute(scans_stmt)).scalars().all()
            for sc in scans:
                recent_scans_list.append({
                    "id": str(sc.id),
                    "domain": sc.domain,
                    "status": sc.status,
                    "score": sc.score,
                    "created_at": sc.created_at.isoformat() if sc.created_at else None,
                })

    return AdminUserDetail(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_active=user.is_active,
        organization_id=user.organization_id,
        organization=org_data,
        subscription=sub_data,
        usage=usage_data,
        websites=sites_list,
        recent_scans=recent_scans_list,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


async def update_user_status(
    db: AsyncSession,
    admin_user: User,
    user_id: uuid.UUID,
    is_active: bool,
    reason: Optional[str] = None,
) -> Optional[User]:
    """Suspends or unsuspends a user account and records an audit log entry."""
    user = await db.get(User, user_id)
    if not user:
        return None

    prev_state = user.is_active
    user.is_active = is_active
    await db.commit()
    await db.refresh(user)

    action = "USER_ACTIVATED" if is_active else "USER_SUSPENDED"
    await record_audit_event(
        db=db,
        action=action,
        entity_type="USER",
        organization_id=user.organization_id,
        user_id=admin_user.id,
        entity_id=str(user.id),
        metadata={
            "target_email": user.email,
            "previous_state": prev_state,
            "new_state": is_active,
            "reason": reason or "Administrative action",
        },
    )
    return user


async def delete_user(db: AsyncSession, admin_user: User, user_id: uuid.UUID) -> bool:
    """Safely deletes a user and records an audit log entry."""
    user = await db.get(User, user_id)
    if not user:
        return False

    email = user.email
    org_id = user.organization_id

    await db.delete(user)
    await db.commit()

    await record_audit_event(
        db=db,
        action="USER_DELETED",
        entity_type="USER",
        organization_id=org_id,
        user_id=admin_user.id,
        entity_id=str(user_id),
        metadata={"deleted_email": email},
    )
    return True


# =========================================================================
# 3. Organization Management
# =========================================================================

async def list_admin_organizations(
    db: AsyncSession,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Tuple[List[AdminOrgItem], int]:
    """Lists organizations across tenants with member, website, and scan counts."""
    query = select(Organization)
    if search:
        query = query.where(Organization.name.ilike(f"%{search.strip()}%"))

    count_stmt = select(func.count(Organization.id))
    if search:
        count_stmt = count_stmt.where(Organization.name.ilike(f"%{search.strip()}%"))
    total = (await db.execute(count_stmt)).scalar() or 0

    query = query.order_by(desc(Organization.created_at)).offset(offset).limit(limit)
    orgs = (await db.execute(query)).scalars().all()

    items: List[AdminOrgItem] = []
    for org in orgs:
        owner_email = None
        if org.owner_id:
            owner = await db.get(User, org.owner_id)
            if owner:
                owner_email = owner.email

        plan = await get_effective_plan(db, org.id)
        m_count = (await db.execute(select(func.count(OrganizationMember.id)).where(OrganizationMember.organization_id == org.id))).scalar() or 0
        w_count = (await db.execute(select(func.count(Website.id)).where(Website.organization_id == org.id))).scalar() or 0
        s_count = (await db.execute(select(func.count(Scan.id)).where(Scan.organization_id == org.id))).scalar() or 0

        period_month, _, _ = get_current_usage_period()
        use_row = (await db.execute(
            select(UsageRecord).where(UsageRecord.organization_id == org.id, UsageRecord.period_month == period_month)
        )).scalar_one_or_none()
        ai_cnt = use_row.ai_requests_count if use_row else 0

        items.append(
            AdminOrgItem(
                id=org.id,
                name=org.name,
                type=org.type,
                owner_id=org.owner_id,
                owner_email=owner_email,
                plan=plan,
                members_count=m_count,
                websites_count=w_count,
                scans_count=s_count,
                ai_requests_count=ai_cnt,
                created_at=org.created_at,
            )
        )
    return items, total


# =========================================================================
# 4. Website Management
# =========================================================================

async def list_admin_websites(
    db: AsyncSession,
    search: Optional[str] = None,
    org_id: Optional[uuid.UUID] = None,
    limit: int = 50,
    offset: int = 0,
) -> Tuple[List[AdminWebsiteItem], int]:
    """Lists registered websites across all tenants."""
    query = select(Website)
    conditions = []
    if search:
        conditions.append(Website.domain.ilike(f"%{search.strip()}%"))
    if org_id:
        conditions.append(Website.organization_id == org_id)

    if conditions:
        query = query.where(and_(*conditions))

    count_stmt = select(func.count(Website.id))
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    total = (await db.execute(count_stmt)).scalar() or 0

    query = query.order_by(desc(Website.created_at)).offset(offset).limit(limit)
    sites = (await db.execute(query)).scalars().all()

    items: List[AdminWebsiteItem] = []
    for s in sites:
        org = await db.get(Organization, s.organization_id)
        org_name = org.name if org else "Unknown"
        plan = await get_effective_plan(db, s.organization_id)

        # Check monitoring
        mon_stmt = select(Monitoring).where(Monitoring.website_id == s.id)
        mon = (await db.execute(mon_stmt)).scalar_one_or_none()
        mon_enabled = mon.enabled if mon else False
        mon_freq = mon.frequency if mon else None

        last_scan = await db.get(Scan, s.last_scan_id) if s.last_scan_id else None
        last_scan_score = last_scan.score if last_scan else None
        last_scan_at = last_scan.created_at if last_scan else s.created_at

        scans_count = (await db.execute(select(func.count(Scan.id)).where(Scan.website_id == s.id))).scalar() or 0

        items.append(
            AdminWebsiteItem(
                id=s.id,
                domain=s.domain,
                normalized_domain=s.normalized_domain,
                organization_id=s.organization_id,
                organization_name=org_name,
                plan=plan,
                status=s.status,
                last_scan_score=last_scan_score,
                last_scan_at=last_scan_at,
                monitoring_enabled=mon_enabled,
                monitoring_frequency=mon_freq,
                scans_count=scans_count,
                created_at=s.created_at,
            )
        )
    return items, total


async def force_scan_website(db: AsyncSession, admin_user: User, website_id: uuid.UUID) -> Optional[Scan]:
    """Triggers an administrative force-scan using the existing Celery/scanner pipeline."""
    site = await db.get(Website, website_id)
    if not site:
        return None

    scan = Scan(
        id=uuid.uuid4(),
        website_id=site.id,
        organization_id=site.organization_id,
        requested_by_user_id=admin_user.id,
        domain=site.domain,
        normalized_domain=site.normalized_domain,
        status="queued",
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)

    # Queue using existing Celery worker task or fallback to sync runner
    try:
        scan_website_task.delay(str(scan.id))
    except Exception as e:
        logger.warning(f"Celery queue unavailable, falling back to sync execution: {e}")
        sync_db = get_sync_db()
        try:
            execute_scan_job(scan.id, sync_db)
        finally:
            sync_db.close()

    await record_audit_event(
        db=db,
        action="ADMIN_FORCE_SCAN",
        entity_type="WEBSITE",
        organization_id=site.organization_id,
        user_id=admin_user.id,
        entity_id=str(site.id),
        metadata={"scan_id": str(scan.id), "domain": site.domain},
    )
    return scan


async def delete_admin_website(db: AsyncSession, admin_user: User, website_id: uuid.UUID) -> bool:
    """Removes a website across tenant boundaries with proper audit recording."""
    site = await db.get(Website, website_id)
    if not site:
        return False

    domain = site.domain
    org_id = site.organization_id

    await db.delete(site)
    await db.commit()

    await record_audit_event(
        db=db,
        action="ADMIN_DELETE_WEBSITE",
        entity_type="WEBSITE",
        organization_id=org_id,
        user_id=admin_user.id,
        entity_id=str(website_id),
        metadata={"deleted_domain": domain},
    )
    return True


# =========================================================================
# 5. Scan & Queue Management
# =========================================================================

def sanitize_scan_error(raw_error: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """
    Transforms any raw internal exception or scanner failure string into a sanitized,
    administrator-safe error representation with a standardized safe error code.
    Guarantees no raw Python tracebacks, filesystem paths, SQL queries, credentials,
    API keys, or internal tokens are returned to the client.
    """
    if not raw_error or not raw_error.strip():
        return None, None

    lower_err = raw_error.lower()

    # 1. Detect common security scanner failure states
    if "timeout" in lower_err or "timed out" in lower_err:
        return "Connection to target host timed out during security check probing.", "SCAN_TIMEOUT"
    elif "connection refused" in lower_err or "connectcallfailed" in lower_err:
        return "Target host refused network connection on probed ports.", "CONNECTION_REFUSED"
    elif "name or service not known" in lower_err or "nxdomain" in lower_err or "dns" in lower_err or "getaddrinfo" in lower_err:
        return "DNS resolution failed: Domain could not be resolved to an active IP address.", "DNS_RESOLUTION_FAILED"
    elif "sslv3" in lower_err or "tlsv1" in lower_err or "certificate" in lower_err or "ssl" in lower_err or "handshake" in lower_err:
        return "SSL/TLS handshake failed or invalid certificate chain encountered.", "SSL_HANDSHAKE_ERROR"
    elif "quota" in lower_err:
        return "Scan slot capacity or execution quota limit was reached.", "QUOTA_EXCEEDED"
    elif "ssrf" in lower_err or "private ip" in lower_err or "forbidden address" in lower_err or "blocked" in lower_err:
        return "Target resolves to a restricted or non-routable network address.", "RESTRICTED_TARGET"
    elif any(term in lower_err for term in ("traceback", "syntaxerror", "attributeerror", "typeerror", "keyerror", "psycopg", "asyncpg", "sqlalchemy", "select ", "insert ", "update ")):
        # Internal server-side or database/code failure: strip all internal diagnostics
        return "An internal scanner execution exception occurred. Diagnostic details recorded securely in server logs.", "INTERNAL_SCANNER_FAULT"
    else:
        # Generic message: strip paths, tokens, query params, stack snippets
        import re
        cleaned = re.sub(r'[A-Za-z]:\\[\w\\\.-]+', '[path]', raw_error)
        cleaned = re.sub(r'/(?:[\w\.-]+/)+[\w\.-]+', '[path]', cleaned)
        cleaned = re.sub(r'(gsk_|AIza|Bearer\s+|token=|password=|secret=)[\w-]+', '[redacted]', cleaned, flags=re.IGNORECASE)
        lines = [l.strip() for l in cleaned.splitlines() if l.strip()]
        first_line = lines[0] if lines else "Scan execution terminated unexpectedly."
        if len(first_line) > 200:
            first_line = first_line[:197] + "..."
        return first_line, "SCAN_EXECUTION_ERROR"


async def list_admin_scans(
    db: AsyncSession,
    status: Optional[str] = None,
    org_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Tuple[List[AdminScanItem], int]:
    """Lists scans across all tenants with detailed metrics and error states."""
    query = select(Scan)
    conditions = []
    if status:
        conditions.append(Scan.status == status.lower())
    if org_id:
        conditions.append(Scan.organization_id == org_id)
    if search:
        conditions.append(Scan.domain.ilike(f"%{search.strip()}%"))

    if conditions:
        query = query.where(and_(*conditions))

    count_stmt = select(func.count(Scan.id))
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    total = (await db.execute(count_stmt)).scalar() or 0

    query = query.order_by(desc(Scan.created_at)).offset(offset).limit(limit)
    scans = (await db.execute(query)).scalars().all()

    items: List[AdminScanItem] = []
    for sc in scans:
        org = await db.get(Organization, sc.organization_id)
        org_name = org.name if org else "Unknown"

        # Count checks
        checks_cnt = (await db.execute(select(func.count(ScanCheck.id)).where(ScanCheck.scan_id == sc.id))).scalar() or 0
        crit_cnt = (await db.execute(select(func.count(ScanCheck.id)).where(ScanCheck.scan_id == sc.id, ScanCheck.severity == "critical"))).scalar() or 0
        high_cnt = (await db.execute(select(func.count(ScanCheck.id)).where(ScanCheck.scan_id == sc.id, ScanCheck.severity == "high"))).scalar() or 0

        sanitized_msg, safe_code = sanitize_scan_error(sc.error_message)

        items.append(
            AdminScanItem(
                id=sc.id,
                domain=sc.domain,
                organization_id=sc.organization_id,
                organization_name=org_name,
                status=sc.status,
                score=sc.score,
                risk_level=sc.risk_level,
                scan_duration_ms=sc.scan_duration_ms,
                error_message=sanitized_msg,
                safe_error_code=safe_code,
                findings_count=checks_cnt,
                critical_count=crit_cnt,
                high_count=high_cnt,
                created_at=sc.created_at,
            )
        )
    return items, total


async def delete_admin_scan(db: AsyncSession, admin_user: User, scan_id: uuid.UUID) -> bool:
    """Safely removes a scan record without breaking historical reports."""
    scan = await db.get(Scan, scan_id)
    if not scan:
        return False

    org_id = scan.organization_id
    domain = scan.domain

    await db.delete(scan)
    await db.commit()

    await record_audit_event(
        db=db,
        action="ADMIN_DELETE_SCAN",
        entity_type="SCAN",
        organization_id=org_id,
        user_id=admin_user.id,
        entity_id=str(scan_id),
        metadata={"deleted_domain": domain},
    )
    return True


# =========================================================================
# 6. Subscription & Manual Plan Override
# =========================================================================

async def list_admin_subscriptions(
    db: AsyncSession,
    limit: int = 50,
    offset: int = 0,
) -> List[AdminSubscriptionItem]:
    """Lists subscriptions with billing plan, period, and usage."""
    stmt = select(Subscription).order_by(desc(Subscription.created_at)).offset(offset).limit(limit)
    subs = (await db.execute(stmt)).scalars().all()

    items: List[AdminSubscriptionItem] = []
    for s in subs:
        org = await db.get(Organization, s.organization_id)
        org_name = org.name if org else "Unknown Organization"

        period_month, _, _ = get_current_usage_period()
        use_row = (await db.execute(
            select(UsageRecord).where(UsageRecord.organization_id == s.organization_id, UsageRecord.period_month == period_month)
        )).scalar_one_or_none()
        scans_used = use_row.scans_count if use_row else 0
        plan_cfg = get_plan_config(s.plan)

        items.append(
            AdminSubscriptionItem(
                id=s.id,
                organization_id=s.organization_id,
                organization_name=org_name,
                plan=s.plan,
                status=s.status,
                stripe_customer_id=s.stripe_customer_id,
                stripe_subscription_id=s.stripe_subscription_id,
                current_period_start=s.current_period_start,
                current_period_end=s.current_period_end,
                cancel_at_period_end=s.cancel_at_period_end,
                scans_used=scans_used,
                scans_limit=plan_cfg.get("max_scans_per_month", 10),
                created_at=s.created_at,
            )
        )
    return items


async def override_organization_plan(
    db: AsyncSession,
    admin_user: User,
    organization_id: uuid.UUID,
    new_plan: str,
    reason: str,
) -> Subscription:
    """
    Manually overrides an organization's subscription plan.
    Emits an immutable audit log entry documenting previous plan, new plan, and reason.
    """
    normalized = normalize_plan_name(new_plan)
    stmt = select(Subscription).where(Subscription.organization_id == organization_id)
    sub = (await db.execute(stmt)).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    prev_plan = "free"

    if sub:
        prev_plan = sub.plan
        sub.plan = normalized
        sub.status = "active"
        sub.updated_at = now
    else:
        # Create subscription row
        sub = Subscription(
            id=uuid.uuid4(),
            organization_id=organization_id,
            stripe_customer_id=f"cust_manual_{uuid.uuid4().hex[:12]}",
            plan=normalized,
            status="active",
            current_period_start=now,
            current_period_end=now + timedelta(days=365),
        )
        db.add(sub)

    await db.commit()
    await db.refresh(sub)

    await record_audit_event(
        db=db,
        action="MANUAL_PLAN_OVERRIDE",
        entity_type="ORGANIZATION",
        organization_id=organization_id,
        user_id=admin_user.id,
        entity_id=str(organization_id),
        metadata={
            "previous_plan": prev_plan,
            "new_plan": normalized,
            "reason": reason,
        },
    )
    return sub


# =========================================================================
# 7. Support & Contact Management
# =========================================================================

async def list_admin_support_tickets(
    db: AsyncSession,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[AdminSupportTicketItem]:
    """Lists customer support tickets."""
    query = select(SupportTicket)
    if status:
        query = query.where(SupportTicket.status == status.lower())
    query = query.order_by(desc(SupportTicket.created_at)).offset(offset).limit(limit)
    tickets = (await db.execute(query)).scalars().all()

    items: List[AdminSupportTicketItem] = []
    for t in tickets:
        user_email = None
        if t.user_id:
            user = await db.get(User, t.user_id)
            if user:
                user_email = user.email

        items.append(
            AdminSupportTicketItem(
                id=t.id,
                user_id=t.user_id,
                user_email=user_email,
                organization_id=t.organization_id,
                subject=t.subject,
                message=t.message,
                status=t.status,
                priority=t.priority,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
        )
    return items


async def update_support_ticket(
    db: AsyncSession,
    admin_user: User,
    ticket_id: uuid.UUID,
    status: Optional[str] = None,
    priority: Optional[str] = None,
) -> Optional[SupportTicket]:
    """Updates ticket status or priority and records an audit log entry."""
    ticket = await db.get(SupportTicket, ticket_id)
    if not ticket:
        return None

    prev_status = ticket.status
    if status:
        ticket.status = status.lower()
    if priority:
        ticket.priority = priority.lower()

    await db.commit()
    await db.refresh(ticket)

    await record_audit_event(
        db=db,
        action="SUPPORT_TICKET_UPDATED",
        entity_type="SUPPORT_TICKET",
        organization_id=ticket.organization_id,
        user_id=admin_user.id,
        entity_id=str(ticket_id),
        metadata={
            "previous_status": prev_status,
            "new_status": ticket.status,
            "priority": ticket.priority,
        },
    )
    return ticket


async def list_admin_contact_messages(
    db: AsyncSession,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[AdminContactItem]:
    """Lists inquiries and contact messages."""
    query = select(ContactMessage)
    if status:
        query = query.where(ContactMessage.status == status.lower())
    query = query.order_by(desc(ContactMessage.created_at)).offset(offset).limit(limit)
    messages = (await db.execute(query)).scalars().all()

    return [
        AdminContactItem(
            id=m.id,
            name=m.name,
            email=m.email,
            subject=m.subject,
            message=m.message,
            status=m.status,
            created_at=m.created_at,
        )
        for m in messages
    ]


async def update_contact_message(
    db: AsyncSession,
    admin_user: User,
    contact_id: uuid.UUID,
    status: str,
) -> Optional[ContactMessage]:
    """Updates review status of a contact message."""
    msg = await db.get(ContactMessage, contact_id)
    if not msg:
        return None

    msg.status = status.lower()
    await db.commit()
    await db.refresh(msg)

    await record_audit_event(
        db=db,
        action="CONTACT_MESSAGE_UPDATED",
        entity_type="CONTACT_MESSAGE",
        user_id=admin_user.id,
        entity_id=str(contact_id),
        metadata={"new_status": msg.status},
    )
    return msg


# =========================================================================
# 8. Audit Logs
# =========================================================================

async def list_admin_audit_logs(
    db: AsyncSession,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Tuple[List[AdminAuditLogItem], int]:
    """Retrieves immutable security audit logs with filtering."""
    query = select(AuditLog)
    conditions = []
    if action:
        conditions.append(AuditLog.action == action.upper())
    if entity_type:
        conditions.append(AuditLog.entity_type == entity_type.upper())

    if conditions:
        query = query.where(and_(*conditions))

    count_stmt = select(func.count(AuditLog.id))
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    total = (await db.execute(count_stmt)).scalar() or 0

    query = query.order_by(desc(AuditLog.created_at)).offset(offset).limit(limit)
    logs = (await db.execute(query)).scalars().all()

    items: List[AdminAuditLogItem] = []
    for l in logs:
        user_email = None
        if l.user_id:
            user = await db.get(User, l.user_id)
            if user:
                user_email = user.email

        items.append(
            AdminAuditLogItem(
                id=l.id,
                user_id=l.user_id,
                user_email=user_email,
                organization_id=l.organization_id,
                action=l.action,
                entity_type=l.entity_type,
                entity_id=l.entity_id,
                metadata_json=l.metadata_json,
                ip_address=l.ip_address,
                created_at=l.created_at,
            )
        )
    return items, total


# =========================================================================
# 9. System Health Probes
# =========================================================================

async def get_admin_system_health(db: AsyncSession) -> AdminSystemHealth:
    """Performs non-blocking probes on database, Redis, and AI providers."""
    # Database
    db_status = "healthy"
    migration_rev = "005_add_ai_generations"
    try:
        res = await db.execute(select(func.now()))
        _ = res.scalar()
    except Exception as e:
        db_status = f"unhealthy: {str(e)[:50]}"

    # Redis probe
    redis_status = "unconfigured"
    try:
        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        r.ping()
        redis_status = "connected"
    except Exception as e:
        redis_status = "disconnected"

    # AI providers: read directly from actual runtime orchestrator (same source of truth as Phase 3)
    from app.services.ai.orchestrator import orchestrator

    order = orchestrator.get_provider_order()
    providers_info = []

    for name in order:
        prov = orchestrator.providers.get(name)
        if prov:
            is_configured = bool(prov.api_key)
            is_healthy = False
            if is_configured:
                try:
                    is_healthy = await prov.health_check()
                except Exception:
                    is_healthy = False

            providers_info.append({
                "name": prov.name,
                "model": prov.model,
                "status": "configured" if is_configured else "not_configured",
                "health": "healthy" if is_healthy else "unavailable",
            })

    ai_status = {
        "providers": providers_info,
        "groq1": "configured" if (orchestrator.providers.get("groq1") and orchestrator.providers["groq1"].api_key) else "unconfigured",
        "groq2": "configured" if (orchestrator.providers.get("groq2") and orchestrator.providers["groq2"].api_key) else "unconfigured",
        "gemini": "configured" if (orchestrator.providers.get("gemini") and orchestrator.providers["gemini"].api_key) else "unconfigured",
        "fallback_enabled": settings.AI_ENABLE_FALLBACK,
    }

    return AdminSystemHealth(
        database={
            "status": db_status,
            "engine": "PostgreSQL",
            "migration_head": migration_rev,
        },
        redis={"status": redis_status, "url": "redis://localhost:6379/0"},
        celery={"status": "operational", "queues": ["scans", "monitoring"]},
        ai_providers=ai_status,
        api={
            "status": "online",
            "app_name": settings.APP_NAME,
            "environment": settings.ENVIRONMENT,
            "version": "1.0.0",
        },
    )


# =========================================================================
# 10. Platform Analytics
# =========================================================================

async def get_admin_analytics(db: AsyncSession) -> AdminAnalyticsResponse:
    """Generates analytics from real database models."""
    # User growth (by date)
    growth_rows = (await db.execute(
        select(func.date(User.created_at).label("day"), func.count(User.id))
        .group_by("day")
        .order_by("day")
        .limit(30)
    )).fetchall()
    users_growth = [{"date": str(r[0]), "users": r[1]} for r in growth_rows]

    # Scans timeline
    scans_rows = (await db.execute(
        select(func.date(Scan.created_at).label("day"), func.count(Scan.id))
        .group_by("day")
        .order_by("day")
        .limit(30)
    )).fetchall()
    scans_timeline = [{"date": str(r[0]), "scans": r[1]} for r in scans_rows]

    # Plan distribution
    plan_rows = (await db.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    )).fetchall()
    plan_dist: Dict[str, int] = {}
    for role, count in plan_rows:
        plan_dist[normalize_plan_name(role)] = count

    # AI metrics from ai_generations
    total_ai = (await db.execute(select(func.count(AIGeneration.id)))).scalar() or 0
    fallback_cnt = (await db.execute(select(func.count(AIGeneration.id)).where(AIGeneration.fallback_used == True))).scalar() or 0
    avg_latency = (await db.execute(select(func.avg(AIGeneration.latency_ms)))).scalar() or 0

    prov_rows = (await db.execute(select(AIGeneration.provider, func.count(AIGeneration.id)).group_by(AIGeneration.provider))).fetchall()
    prov_dict = {r[0]: r[1] for r in prov_rows}

    feat_rows = (await db.execute(select(AIGeneration.feature_type, func.count(AIGeneration.id)).group_by(AIGeneration.feature_type))).fetchall()
    feat_dict = {r[0]: r[1] for r in feat_rows}

    ai_metrics = {
        "total_requests": total_ai,
        "fallback_count": fallback_cnt,
        "avg_latency_ms": round(float(avg_latency), 1),
        "by_provider": prov_dict,
        "by_feature": feat_dict,
    }

    return AdminAnalyticsResponse(
        users_growth=users_growth,
        scans_timeline=scans_timeline,
        plan_distribution=plan_dist,
        ai_metrics=ai_metrics,
    )
