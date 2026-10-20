"""
Scanly API - Celery Application & Periodic Task Schedules
"""
import os
import sys
import uuid

# Ensure project root and apps/api directory are on python path
current_dir = os.path.dirname(os.path.abspath(__file__))
api_root = os.path.abspath(os.path.join(current_dir, "..", ".."))
project_root = os.path.abspath(os.path.join(api_root, "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
if api_root not in sys.path:
    sys.path.insert(0, api_root)

from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "scanly_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.worker", "app.tasks.email_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=180,       # Max 3 mins per task
    task_soft_time_limit=120,
)

# Celery Beat Scheduled Tasks
celery_app.conf.beat_schedule = {
    "periodic-monitoring-scheduler": {
        "task": "app.tasks.worker.schedule_monitored_scans_task",
        "schedule": crontab(minute="*/15"),  # Run every 15 minutes to process due monitoring records
    },
    "weekly-ssl-expiry-checker": {
        "task": "app.tasks.worker.check_ssl_expiries_task",
        "schedule": crontab(hour=6, minute=0, day_of_week=1),  # Monday 06:00 UTC
    },
    "weekly-security-digest": {
        "task": "app.tasks.email_tasks.send_weekly_security_digest_task",
        "schedule": crontab(hour=8, minute=0, day_of_week=1),  # Monday 08:00 UTC
    },
    "daily-subscription-reconciler": {
        "task": "app.tasks.worker.reconcile_active_subscriptions_task",
        "schedule": crontab(hour=3, minute=0),  # Daily 03:00 UTC
    },
    "stale-scan-watchdog": {
        "task": "app.tasks.worker.recover_stale_scans_task",
        "schedule": crontab(minute="*/10"),  # Run every 10 minutes to recover any orphaned or hung scans
    },
}

