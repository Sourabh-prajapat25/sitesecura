"""
SiteSecura - Celery Background Email & Weekly Digest Tasks
Executes asynchronous transactional email delivery with exponential backoff and weekly digest aggregation.
"""
import logging
import random
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from celery.exceptions import MaxRetriesExceededError, Retry
from sqlalchemy import select, and_, or_, desc

from app.tasks.celery_app import celery_app
from app.db.session import get_sync_db
from app.services.email_service import default_email_service
from app.services.email_providers.base import EmailMessage
from app.models.user import User, Organization, OrganizationMember
from app.models.website import Website, Monitoring
from app.models.scan import Scan
from app.core.config import settings
import redis

logger = logging.getLogger(__name__)

_sync_redis_client: Optional[redis.Redis] = None


def get_sync_redis() -> Optional[redis.Redis]:
    global _sync_redis_client
    if _sync_redis_client is None and getattr(settings, "REDIS_URL", None):
        try:
            _sync_redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        except Exception as e:
            logger.warning(f"Could not initialize sync redis client: {e}")
            _sync_redis_client = None
    return _sync_redis_client


_processed_idempotency_keys: set = set()


def clear_idempotency_cache():
    """Testing hook to clear in-memory and redis idempotency cache."""
    global _processed_idempotency_keys
    _processed_idempotency_keys.clear()
    r = get_sync_redis()
    if r:
        try:
            keys = r.keys("email_idem:*")
            if keys:
                r.delete(*keys)
        except Exception:
            pass


@celery_app.task(
    name="app.tasks.email_tasks.send_email_task",
    bind=True,
    max_retries=3,
    default_retry_delay=2,
)
def send_email_task(
    self,
    to_email: str,
    subject: str,
    text_content: str,
    html_content: Optional[str] = None,
    template_id: Optional[str] = None,
    template_context: Optional[Dict[str, Any]] = None,
    idempotency_key: Optional[str] = None,
    reply_to: Optional[str] = None,
):
    """
    Asynchronous Celery worker task for non-blocking email delivery.
    Applies bounded retries with exponential backoff and jitter strictly to transient errors.
    Permanent failures (e.g. 401 auth, 422 invalid email) are not retried.
    Protects against duplicate task execution if an idempotency_key is provided.
    """
    try:
        # Check idempotency deduplication before sending
        if idempotency_key:
            if idempotency_key in _processed_idempotency_keys:
                logger.info(f"[Email Task Deduplication] Skipping duplicate execution for key '{idempotency_key}' (in-memory)")
                return {
                    "status": "dropped",
                    "reason": "duplicate_idempotency_key",
                    "idempotency_key": idempotency_key,
                }

            r = get_sync_redis()
            if r:
                try:
                    if r.get(f"email_idem:{idempotency_key}"):
                        _processed_idempotency_keys.add(idempotency_key)
                        logger.info(f"[Email Task Deduplication] Skipping duplicate execution for key '{idempotency_key}' (redis)")
                        return {
                            "status": "dropped",
                            "reason": "duplicate_idempotency_key",
                            "idempotency_key": idempotency_key,
                        }
                except Exception as r_err:
                    logger.debug(f"[Email Task] Redis idempotency check error: {r_err}")

        if template_id:
            result = default_email_service.send_template_email(
                to_email=to_email,
                template_id=template_id,
                template_context=template_context or {},
                reply_to=reply_to,
                idempotency_key=idempotency_key,
            )
        else:
            msg = EmailMessage(
                to=to_email,
                subject=subject,
                text_body=text_content,
                html_body=html_content,
                reply_to=reply_to,
                idempotency_key=idempotency_key,
            )
            result = default_email_service.send_message(msg)

        if result.success:
            if idempotency_key:
                r = get_sync_redis()
                if r:
                    try:
                        r.set(f"email_idem:{idempotency_key}", "1", ex=86400)
                    except Exception:
                        pass
                _processed_idempotency_keys.add(idempotency_key)

            return {
                "status": result.status,
                "provider": result.provider,
                "message_id": result.provider_message_id,
                "attempts": self.request.retries + 1,
            }

        # Check if error is transient and retryable
        if result.is_transient:
            retries = getattr(self.request, "retries", 0)
            max_retries = getattr(self, "max_retries", 3)
            if retries < max_retries:
                # Exponential backoff with jitter: 2s, 4s, 8s +/- 20%
                backoff_base = settings.EMAIL_RETRY_BACKOFF_SECONDS * (2 ** retries)
                jitter = random.uniform(0.8, 1.2)
                countdown = max(1.0, backoff_base * jitter)

                logger.warning(
                    f"[Email Task Transient Error] Attempt {retries + 1}/{max_retries + 1} "
                    f"failed for '{to_email}' ({result.error_code}): {result.error_message}. "
                    f"Retrying in {countdown:.1f}s..."
                )
                raise self.retry(countdown=countdown, exc=Exception(result.error_message))

        logger.error(
            f"[Email Task Permanent Error] Failed to deliver to '{to_email}' "
            f"({result.error_code}): {result.error_message}. Not retrying."
        )
        return {
            "status": "failed",
            "provider": result.provider,
            "error_code": result.error_code,
            "error": result.error_message,
            "is_transient": result.is_transient,
            "attempts": self.request.retries + 1,
        }

    except Retry:
        raise
    except MaxRetriesExceededError:
        logger.critical(f"[Email Task Max Retries Exceeded] Permanent failure after max attempts for '{to_email}'.")
        return {"status": "failed", "error": "MAX_RETRIES_EXCEEDED"}
    except Exception as exc:
        logger.error(f"[Email Task Unhandled Exception] {type(exc).__name__}: {exc}")
        return {"status": "failed", "error": str(exc)[:120]}


@celery_app.task(name="app.tasks.email_tasks.send_weekly_security_digest_task")
def send_weekly_security_digest_task():
    """
    Periodic Celery Beat task (Mondays 08:00 UTC):
    Aggregates stored scan history and posture data for active organizations and emails weekly summaries.
    Does NOT trigger new scans. Respects user notification preferences.
    """
    db = get_sync_db()
    try:
        now = datetime.now(timezone.utc)
        period_start = now - timedelta(days=7)

        # 1. Query all active organizations
        stmt = select(Organization).join(Website, Website.organization_id == Organization.id).distinct()
        orgs = db.execute(stmt).scalars().all()

        delivered_count = 0
        skipped_count = 0

        for org in orgs:
            # 2. Get active websites for this org
            site_stmt = select(Website).where(
                Website.organization_id == org.id,
                Website.status == "active",
            )
            websites = db.execute(site_stmt).scalars().all()
            if not websites:
                continue

            website_summaries = []
            for ws in websites:
                # Get latest completed scan
                scan_stmt = (
                    select(Scan)
                    .where(Scan.website_id == ws.id, Scan.status == "completed")
                    .order_by(desc(Scan.completed_at))
                    .limit(1)
                )
                latest_scan = db.execute(scan_stmt).scalar_one_or_none()

                ssl_days = None
                if latest_scan and latest_scan.scan_metadata:
                    ssl_info = latest_scan.scan_metadata.get("ssl", {})
                    ssl_days = ssl_info.get("days_remaining")

                website_summaries.append({
                    "domain": ws.domain,
                    "score": latest_scan.score if latest_scan else None,
                    "risk_level": latest_scan.risk_level if latest_scan else "Unscanned",
                    "ssl_days_remaining": ssl_days,
                })

            # 3. Query active owners/admins
            user_stmt = (
                select(User)
                .join(OrganizationMember, OrganizationMember.user_id == User.id)
                .where(
                    OrganizationMember.organization_id == org.id,
                    OrganizationMember.role.in_(["owner", "admin"]),
                    User.is_active == True,
                )
            )
            recipients = db.execute(user_stmt).scalars().all()

            for u in recipients:
                # Check user notification preferences
                prefs = u.notification_preferences or {}
                # Defaults to True if not explicitly disabled
                if prefs.get("weekly_digest", True) is False:
                    skipped_count += 1
                    continue

                send_email_task.delay(
                    to_email=u.email,
                    subject=f"SiteSecura Weekly Security Digest — {org.name}",
                    text_content="Your weekly security digest is ready.",
                    template_id="weekly_digest",
                    template_context={
                        "organization_name": org.name,
                        "website_summaries": website_summaries,
                        "period_label": f"{period_start.strftime('%b %d')} - {now.strftime('%b %d, %Y')}",
                    },
                    idempotency_key=f"weekly_{org.id}_{now.strftime('%Y_W%W')}_{u.id}",
                )
                delivered_count += 1

        logger.info(
            f"[Weekly Digest Task] Dispatched {delivered_count} digest tasks "
            f"across {len(orgs)} organizations ({skipped_count} skipped by preference)."
        )
        return {"dispatched": delivered_count, "skipped": skipped_count}

    finally:
        db.close()
