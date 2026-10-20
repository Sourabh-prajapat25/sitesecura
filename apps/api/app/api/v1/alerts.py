"""
Scanly API - Alerts Endpoints
"""
import uuid
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.authorization import AuthContext, get_current_auth_context
from app.models.alert import Alert, AuditLog
from app.schemas.shared import AlertResponse, AlertUpdateStatusRequest, AuditLogResponse
from app.services.audit_service import record_audit_event

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=List[AlertResponse])
async def list_alerts(
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves all in-app security alerts for the user's organization."""
    stmt = (
        select(Alert)
        .where(Alert.organization_id == auth.organization.id)
        .order_by(desc(Alert.created_at))
        .limit(50)
    )
    result = await db.execute(stmt)
    alerts = result.scalars().all()
    return [AlertResponse.model_validate(a) for a in alerts]


@router.patch("/{alert_id}", response_model=AlertResponse)
async def update_alert_status(
    alert_id: uuid.UUID,
    update_in: AlertUpdateStatusRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Updates alert status (read / dismissed) with strict tenant isolation."""
    stmt = select(Alert).where(Alert.id == alert_id, Alert.organization_id == auth.organization.id)
    result = await db.execute(stmt)
    alert = result.scalar_one_or_none()

    if not alert:
        await record_audit_event(
            db=db,
            action="PERMISSION_DENIED",
            entity_type="ALERT",
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            entity_id=str(alert_id),
            metadata={"reason": "Attempted cross-tenant alert modification"},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "ALERT_NOT_FOUND", "message": "Alert not found."}},
        )

    alert.status = update_in.status
    await db.commit()
    await db.refresh(alert)
    return AlertResponse.model_validate(alert)


@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def list_audit_logs(
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves immutable security audit trail strictly scoped to active organization."""
    from app.models.alert import AuditLog
    stmt = (
        select(AuditLog)
        .where(AuditLog.organization_id == auth.organization.id)
        .order_by(desc(AuditLog.created_at))
        .limit(100)
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return [AuditLogResponse.model_validate(l) for l in logs]
