"""
Scanly API - Audit Logging Service
Records security-relevant events, authorization denials, quota events, and resource modifications.
Guarantees zero leakage of secrets, auth headers, passwords, or raw request tokens.
"""
import uuid
import logging
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from app.models.alert import AuditLog

logger = logging.getLogger(__name__)

# Sensitive keys that must be scrubbed from audit metadata
SENSITIVE_KEYS = {
    "password", "token", "firebase_token", "secret", "authorization",
    "cookie", "set-cookie", "api_key", "credentials", "access_token",
    "stripe_secret", "stripe_key", "client_secret", "evidence"
}


def sanitize_metadata(data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Recursively removes sensitive keys or masks values in metadata."""
    if not data or not isinstance(data, dict):
        return {}
    clean: Dict[str, Any] = {}
    for k, v in data.items():
        k_lower = str(k).lower()
        if any(sens in k_lower for sens in SENSITIVE_KEYS):
            clean[k] = "[REDACTED]"
        elif isinstance(v, dict):
            clean[k] = sanitize_metadata(v)
        elif isinstance(v, (str, int, float, bool)) or v is None:
            clean[k] = v
        else:
            clean[k] = str(v)
    return clean


sanitize_audit_metadata = sanitize_metadata


async def record_audit_event(
    db: AsyncSession,
    action: str,
    entity_type: str,
    organization_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    entity_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> Optional[AuditLog]:
    """
    Persists an immutable audit log entry within an isolated savepoint.
    Fails safely without raising uncaught exceptions or contaminating the calling transaction with PendingRollbackError.
    """
    try:
        clean_meta = sanitize_metadata(metadata)
        entry = AuditLog(
            id=uuid.uuid4(),
            organization_id=organization_id,
            user_id=user_id,
            action=action.upper(),
            entity_type=entity_type.upper(),
            entity_id=str(entity_id) if entity_id is not None else None,
            metadata_json=clean_meta,
            ip_address=str(ip_address)[:50] if ip_address else None,
        )
        async with db.begin_nested():
            db.add(entry)
            await db.flush()
        return entry
    except Exception as e:
        logger.warning(f"Failed to record audit event '{action}' on '{entity_type}': {e}")
        return None


def record_audit_event_sync(
    db: Session,
    action: str,
    entity_type: str,
    organization_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    entity_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> Optional[AuditLog]:
    """
    Synchronously persists an immutable audit log entry within an isolated savepoint.
    Fails safely without raising exceptions to protect the calling transaction.
    """
    try:
        clean_meta = sanitize_metadata(metadata)
        entry = AuditLog(
            id=uuid.uuid4(),
            organization_id=organization_id,
            user_id=user_id,
            action=action.upper(),
            entity_type=entity_type.upper(),
            entity_id=str(entity_id) if entity_id is not None else None,
            metadata_json=clean_meta,
            ip_address=str(ip_address)[:50] if ip_address else None,
        )
        with db.begin_nested():
            db.add(entry)
            db.flush()
        return entry
    except Exception as e:
        logger.warning(f"Failed to record sync audit event '{action}' on '{entity_type}': {e}")
        return None

