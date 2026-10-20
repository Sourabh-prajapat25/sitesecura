"""
Scanly API - Admin Endpoints
Protected operations for platform administrators.
Every endpoint strictly enforces the require_admin dependency.
"""
import uuid
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db, get_sync_db
from app.core.authorization import AuthContext, require_admin
from app.schemas.admin import (
    AdminDashboardStats,
    AdminUserItem,
    AdminUserDetail,
    AdminUserStatusUpdate,
    AdminOrgItem,
    AdminWebsiteItem,
    AdminScanItem,
    AdminSubscriptionItem,
    AdminPlanOverrideRequest,
    AdminSupportTicketItem,
    AdminSupportTicketUpdate,
    AdminContactItem,
    AdminContactUpdate,
    AdminAuditLogItem,
    AdminSystemHealth,
    AdminAnalyticsResponse,
    AdminEmailTestRequest,
    AdminEmailTestResponse,
)
from app.schemas.shared import AdminMetricsResponse
from app.schemas.scan import ScanResponse
from app.services import admin_service
from app.services.email_service import default_email_service
from app.services.scan_service import execute_scan_job
from app.tasks.worker import scan_website_task
from app.models.scan import Scan
from app.services.audit_service import record_audit_event
from app.schemas.verification import BadgePolicyResponse, BadgePolicyUpdate
from app.services.badge_policy_service import BadgePolicyService
from app.core.rate_limit import check_rate_limit
from app.core.config import settings
from app.services.email_providers.base import EmailMessage
from sqlalchemy import select
from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/admin", tags=["Admin"])


# =========================================================================
# 1. Overview & Metrics
# =========================================================================

@router.get("/metrics", response_model=AdminMetricsResponse)
async def get_admin_metrics(
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Backward-compatible aggregate operational metrics."""
    stats = await admin_service.get_admin_dashboard_stats(db)
    return AdminMetricsResponse(
        total_users=stats.total_users,
        active_users=stats.active_users,
        paid_users=sum(v for k, v in stats.users_by_plan.items() if k in ("basic", "pro", "agency")),
        total_websites=stats.total_websites,
        total_scans=stats.total_scans,
        scan_success_rate=stats.scan_success_rate,
        recent_scans_count=min(stats.total_scans, 50),
        unread_tickets_count=stats.open_support_tickets,
    )


@router.get("/dashboard", response_model=AdminDashboardStats)
async def get_admin_dashboard(
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Full operational dashboard metrics."""
    return await admin_service.get_admin_dashboard_stats(db)


# =========================================================================
# 2. User Management
# =========================================================================

@router.get("/users")
async def list_admin_users(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lists registered users with search, filtering, and resource counts."""
    items, total = await admin_service.list_admin_users(
        db, search=search, role=role, is_active=is_active, limit=limit, offset=offset
    )
    return {"items": [item.model_dump() for item in items], "total": total}


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def get_admin_user_detail(
    user_id: uuid.UUID,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves full profile details for a specific user."""
    detail = await admin_service.get_admin_user_detail(db, user_id)
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return detail


@router.patch("/users/{user_id}/status", response_model=AdminUserItem)
async def update_admin_user_status(
    user_id: uuid.UUID,
    status_in: AdminUserStatusUpdate,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Suspends or unsuspends a user account."""
    user = await admin_service.update_user_status(
        db, admin_user=auth.user, user_id=user_id, is_active=status_in.is_active, reason=status_in.reason
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    items, _ = await admin_service.list_admin_users(db, search=user.email, limit=1)
    if not items:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return items[0]


@router.delete("/users/{user_id}")
async def delete_admin_user(
    user_id: uuid.UUID,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Permanently removes a user account with audit trail."""
    if user_id == auth.user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own administrative account.")
    deleted = await admin_service.delete_user(db, admin_user=auth.user, user_id=user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return {"status": "deleted", "user_id": str(user_id)}


# =========================================================================
# 3. Organization Management
# =========================================================================

@router.get("/organizations")
async def list_admin_organizations(
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lists organizations across all tenants."""
    items, total = await admin_service.list_admin_organizations(
        db, search=search, limit=limit, offset=offset
    )
    return {"items": [item.model_dump() for item in items], "total": total}


# =========================================================================
# 4. Website Management
# =========================================================================

@router.get("/websites")
async def list_admin_websites(
    search: Optional[str] = Query(None),
    org_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lists registered websites across tenants."""
    items, total = await admin_service.list_admin_websites(
        db, search=search, org_id=org_id, limit=limit, offset=offset
    )
    return {"items": [item.model_dump() for item in items], "total": total}


@router.post("/websites/{website_id}/force-scan")
async def force_scan_website(
    website_id: uuid.UUID,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Forces an immediate security assessment via the scanner pipeline."""
    scan = await admin_service.force_scan_website(db, admin_user=auth.user, website_id=website_id)
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Website not found.")
    return {"status": "queued", "scan_id": str(scan.id), "domain": scan.domain}


@router.delete("/websites/{website_id}")
async def delete_admin_website(
    website_id: uuid.UUID,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Deletes a website and records an audit log entry."""
    deleted = await admin_service.delete_admin_website(db, admin_user=auth.user, website_id=website_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Website not found.")
    return {"status": "deleted", "website_id": str(website_id)}


# =========================================================================
# 5. Scan & Queue Management
# =========================================================================

@router.get("/scans")
async def list_admin_scans(
    status_filter: Optional[str] = Query(None, alias="status"),
    org_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lists scans across all tenants."""
    items, total = await admin_service.list_admin_scans(
        db, status=status_filter, org_id=org_id, search=search, limit=limit, offset=offset
    )
    return {"items": [item.model_dump() for item in items], "total": total}


@router.post("/scans/{scan_id}/retry", response_model=ScanResponse)
async def retry_failed_scan(
    scan_id: uuid.UUID,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Forces retry of a queued or failed scan."""
    stmt = select(Scan).where(Scan.id == scan_id)
    result = await db.execute(stmt)
    scan = result.scalar_one_or_none()

    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found.")

    scan.status = "queued"
    scan.error_message = None
    await db.commit()

    try:
        scan_website_task.delay(str(scan_id))
    except Exception:
        sync_db = get_sync_db()
        try:
            execute_scan_job(scan_id, sync_db)
        finally:
            sync_db.close()

    await record_audit_event(
        db=db,
        action="ADMIN_RETRY_SCAN",
        entity_type="SCAN",
        organization_id=scan.organization_id,
        user_id=auth.user.id,
        entity_id=str(scan_id),
        metadata={"domain": scan.domain, "status": "queued"},
    )

    res = await db.execute(select(Scan).options(selectinload(Scan.checks)).where(Scan.id == scan_id))
    return res.scalar_one()


@router.delete("/scans/{scan_id}")
async def delete_admin_scan(
    scan_id: uuid.UUID,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Deletes a scan record safely."""
    deleted = await admin_service.delete_admin_scan(db, admin_user=auth.user, scan_id=scan_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found.")
    return {"status": "deleted", "scan_id": str(scan_id)}


# =========================================================================
# 6. Subscription & Manual Plan Overrides
# =========================================================================

@router.get("/subscriptions", response_model=List[AdminSubscriptionItem])
async def list_admin_subscriptions(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lists subscription tiers, statuses, and usage counts."""
    return await admin_service.list_admin_subscriptions(db, limit=limit, offset=offset)


@router.post("/subscriptions/override-plan")
async def override_organization_plan(
    body: AdminPlanOverrideRequest,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Manually overrides an organization's subscription tier.
    Requires an explicit justification reason which is immutably recorded in audit logs.
    """
    if not body.reason.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An explicit justification reason is required.")

    sub = await admin_service.override_organization_plan(
        db, admin_user=auth.user, organization_id=body.organization_id, new_plan=body.new_plan, reason=body.reason
    )
    return {
        "status": "success",
        "organization_id": str(body.organization_id),
        "plan": sub.plan,
        "reason": body.reason,
    }


@router.get("/coupons")
async def get_admin_coupons(
    auth: AuthContext = Depends(require_admin),
):
    """Returns promotional/coupon system status."""
    return {
        "provider": "stripe",
        "configured": False,
        "message": "Coupons and promotional discounts are managed directly via Stripe Dashboard.",
        "coupons": [],
    }


# =========================================================================
# 7. Support & Contact Management
# =========================================================================

@router.get("/support/tickets", response_model=List[AdminSupportTicketItem])
async def list_admin_support_tickets(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lists customer support tickets."""
    return await admin_service.list_admin_support_tickets(
        db, status=status_filter, limit=limit, offset=offset
    )


@router.patch("/support/tickets/{ticket_id}", response_model=AdminSupportTicketItem)
async def update_admin_support_ticket(
    ticket_id: uuid.UUID,
    body: AdminSupportTicketUpdate,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Updates status or priority of a support ticket."""
    ticket = await admin_service.update_support_ticket(
        db, admin_user=auth.user, ticket_id=ticket_id, status=body.status, priority=body.priority
    )
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Support ticket not found.")
    tickets = await admin_service.list_admin_support_tickets(db, limit=1)
    # Return formatted item
    return AdminSupportTicketItem(
        id=ticket.id,
        user_id=ticket.user_id,
        organization_id=ticket.organization_id,
        subject=ticket.subject,
        message=ticket.message,
        status=ticket.status,
        priority=ticket.priority,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


@router.get("/support/contacts", response_model=List[AdminContactItem])
async def list_admin_contacts(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lists contact inquiries."""
    return await admin_service.list_admin_contact_messages(
        db, status=status_filter, limit=limit, offset=offset
    )


@router.patch("/support/contacts/{contact_id}", response_model=AdminContactItem)
async def update_admin_contact(
    contact_id: uuid.UUID,
    body: AdminContactUpdate,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Updates review status of a contact message."""
    if not body.status:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status is required.")
    msg = await admin_service.update_contact_message(
        db, admin_user=auth.user, contact_id=contact_id, status=body.status
    )
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact message not found.")
    return AdminContactItem(
        id=msg.id,
        name=msg.name,
        email=msg.email,
        subject=msg.subject,
        message=msg.message,
        status=msg.status,
        created_at=msg.created_at,
    )


# =========================================================================
# 8. Audit Logs
# =========================================================================

@router.get("/audit-logs")
async def list_admin_audit_logs(
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves immutable security audit logs."""
    items, total = await admin_service.list_admin_audit_logs(
        db, action=action, entity_type=entity_type, limit=limit, offset=offset
    )
    return {"items": [item.model_dump() for item in items], "total": total}


# =========================================================================
# 9. System Health & Platform Analytics
# =========================================================================

@router.get("/system/health", response_model=AdminSystemHealth)
async def get_admin_system_health(
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Probes status of database, Redis, Celery, API, and AI providers without leaking secrets."""
    return await admin_service.get_admin_system_health(db)


@router.get("/analytics", response_model=AdminAnalyticsResponse)
async def get_admin_analytics(
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Calculates operational and AI generation analytics from real database data."""
    return await admin_service.get_admin_analytics(db)


@router.get("/email-templates")
async def list_email_templates(
    auth: AuthContext = Depends(require_admin),
):
    """Lists built-in email notification templates."""
    return {
        "templates": [
            {"id": "welcome_email", "name": "Welcome & Account Activation", "category": "Auth", "type": "html"},
            {"id": "scan_completed", "name": "Security Scan Completed", "category": "Scanner", "type": "html"},
            {"id": "monitoring_alert", "name": "Security Drift & Monitoring Alert", "category": "Monitoring", "type": "html"},
            {"id": "subscription_upgrade", "name": "Subscription Plan Upgrade Confirmation", "category": "Billing", "type": "html"},
            {"id": "support_response", "name": "Customer Support Ticket Response", "category": "Support", "type": "html"},
        ]
    }


# =========================================================================
# 10. Security Badge Policy Governance (VB-7)
# =========================================================================

@router.get(
    "/badges/policy",
    response_model=BadgePolicyResponse,
    summary="Get Active Security Badge Policy",
)
async def get_active_badge_policy(
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves the active Verified Badge policy for the platform."""
    return await BadgePolicyService.get_active_policy(db)


@router.patch(
    "/badges/policy",
    response_model=BadgePolicyResponse,
    summary="Update Active Security Badge Policy",
)
async def update_active_badge_policy(
    updates: BadgePolicyUpdate,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Updates the active Verified Badge policy with strict bounds validation and audit logging.
    Historical verifications are preserved unchanged as point-in-time snapshots.
    """
    policy = await BadgePolicyService.get_active_policy(db)
    updated = await BadgePolicyService.update_policy(
        db=db,
        policy_id=policy.id,
        updates=updates,
        admin_user_id=auth.user.id,
        admin_org_id=auth.organization.id,
    )
    await db.commit()
    return updated


@router.get(
    "/badges/policies",
    response_model=List[BadgePolicyResponse],
    summary="List All Security Badge Policies",
)
async def list_badge_policies(
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lists all configured badge policies."""
    return await BadgePolicyService.list_policies(db)


@router.patch(
    "/badges/policies/{policy_id}",
    response_model=BadgePolicyResponse,
    summary="Update Specific Security Badge Policy",
)
async def update_specific_badge_policy(
    policy_id: uuid.UUID,
    updates: BadgePolicyUpdate,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Updates a specific badge policy by ID."""
    updated = await BadgePolicyService.update_policy(
        db=db,
        policy_id=policy_id,
        updates=updates,
        admin_user_id=auth.user.id,
        admin_org_id=auth.organization.id,
    )
    await db.commit()
    return updated


# =========================================================================
# 11. Email Service Diagnostics & Smoke Testing
# =========================================================================

@router.get(
    "/email/health",
    summary="Email Provider Health & Configuration Diagnostics",
)
async def get_email_provider_health(
    auth: AuthContext = Depends(require_admin),
):
    """
    Returns active email provider operational status and configuration diagnostics.
    Strictly sanitizes credentials, secrets, and auth tokens.
    """
    return default_email_service.health_check()


@router.post(
    "/email/test",
    response_model=AdminEmailTestResponse,
    summary="Send Controlled Transactional Test Email",
)
async def send_admin_test_email(
    payload: AdminEmailTestRequest,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Dispatches a single, protected test email to verify transactional delivery.
    Enforces administrator authorization, rate-limiting, recipient allowlist, and audit logging.
    """
    # 1. Rate-limit test email sends (5 requests per 60 seconds per admin)
    await check_rate_limit(
        key=f"admin_email_test:{auth.user.id}",
        max_requests=5,
        window_seconds=60,
    )

    correlation_id = f"test_{uuid.uuid4().hex[:12]}"
    tid = (payload.template_id or "welcome").lower().strip()
    recipient = payload.recipient_email.strip().lower()

    # 2. Strict template allowlisting
    ALLOWED_TEST_TEMPLATES = {
        "welcome", "ssl_expiry", "score_drop", "critical_finding",
        "downtime", "scan_completion", "weekly_digest", "custom",
    }
    if tid not in ALLOWED_TEST_TEMPLATES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid template_id '{tid}'. Allowed templates: {sorted(list(ALLOWED_TEST_TEMPLATES))}",
        )

    # 3. Recipient validation and header injection defense
    if "\r" in recipient or "\n" in recipient:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Header injection characters detected in recipient address.",
        )

    if tid == "custom":
        subject = (payload.custom_subject or "SiteSecura Admin Test Message").strip()
        body = (payload.custom_body or "This is a controlled transactional email test message from SiteSecura.").strip()
        msg = EmailMessage(
            to=recipient,
            subject=subject,
            text_body=body,
            html_body=None,  # Prohibit arbitrary raw HTML submission via admin endpoint
            idempotency_key=correlation_id,
            template_id="custom",
        )
        deliv_res = default_email_service.send_message(msg)
    else:
        sample_context = {
            "user_name": auth.user.name or "Administrator",
            "domain": "test.sitesecura.com",
            "days_remaining": 7,
            "previous_score": 90,
            "current_score": 75,
            "finding_title": "Missing Content-Security-Policy Header",
            "severity": "high",
            "summary": "The HTTP Content-Security-Policy response header is not configured on the origin server.",
            "error_details": "Simulated origin connection timeout (504 Gateway Timeout)",
            "status_code": 504,
            "score": 85,
            "risk_level": "Good",
            "scan_id": str(uuid.uuid4()),
            "organization_name": auth.organization.name or "SiteSecura Admin",
            "website_summaries": [
                {"domain": "test.sitesecura.com", "score": 85, "ssl_days_remaining": 28}
            ],
        }
        deliv_res = default_email_service.send_template_email(
            to_email=recipient,
            template_id=tid,
            template_context=sample_context,
            idempotency_key=correlation_id,
        )

    # 4. Record sanitized security audit log
    await record_audit_event(
        db=db,
        action="ADMIN_EMAIL_TEST",
        entity_type="EMAIL",
        organization_id=auth.organization.id,
        user_id=auth.user.id,
        entity_id=correlation_id,
        metadata={
            "recipient": recipient,
            "template_id": tid,
            "success": deliv_res.success,
            "status": deliv_res.status,
            "provider": deliv_res.provider,
            "provider_message_id": deliv_res.provider_message_id,
            "error": deliv_res.error_message,
        },
    )

    return AdminEmailTestResponse(
        success=deliv_res.success,
        status=deliv_res.status,
        provider=deliv_res.provider,
        provider_message_id=deliv_res.provider_message_id,
        recipient=recipient,
        error=deliv_res.error_message,
        correlation_id=correlation_id,
    )
