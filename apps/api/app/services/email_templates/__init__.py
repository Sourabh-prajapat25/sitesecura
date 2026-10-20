"""
SiteSecura - Email Templates Package
"""
from app.services.email_templates.base import render_email_envelope, html_to_plain_text, escape
from app.services.email_templates.templates import (
    render_welcome_email,
    render_ssl_expiry_alert,
    render_score_drop_alert,
    render_critical_finding_alert,
    render_downtime_alert,
    render_scan_completed_notification,
    render_weekly_digest,
)

__all__ = [
    "render_email_envelope",
    "html_to_plain_text",
    "escape",
    "render_welcome_email",
    "render_ssl_expiry_alert",
    "render_score_drop_alert",
    "render_critical_finding_alert",
    "render_downtime_alert",
    "render_scan_completed_notification",
    "render_weekly_digest",
]
