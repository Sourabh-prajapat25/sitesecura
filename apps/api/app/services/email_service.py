"""
SiteSecura - Centralized Transactional Email Service
Provides unified application-facing email operations, template rendering, provider delegation,
and strict multi-provider error handling.
"""
import logging
from typing import Optional, Dict, Any, List

from app.services.email_providers.base import EmailMessage, EmailDeliveryResult, EmailProvider
from app.services.email_providers import get_email_provider
from app.services.email_templates import (
    render_welcome_email,
    render_ssl_expiry_alert,
    render_score_drop_alert,
    render_critical_finding_alert,
    render_downtime_alert,
    render_scan_completed_notification,
    render_weekly_digest,
)
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Centralized email application service encapsulating provider selection and template dispatch."""

    def __init__(self, provider: Optional[EmailProvider] = None):
        self._provider = provider

    @property
    def provider(self) -> EmailProvider:
        if self._provider is None:
            return get_email_provider()
        return self._provider

    def send_message(self, message: EmailMessage) -> EmailDeliveryResult:
        """Core delivery method delegating validated message to the configured provider."""
        try:
            return self.provider.send(message)
        except Exception as exc:
            logger.error(f"[EmailService Error] Delivery failed to '{message.to}': {exc}")
            return EmailDeliveryResult(
                success=False,
                provider="unknown",
                status="failed",
                error_code="DELIVERY_DISPATCH_EXCEPTION",
                error_message=str(exc)[:200],
                is_transient=False,
                attempts=1,
                idempotency_key=message.idempotency_key,
            )

    def send_email(
        self,
        to_email: str,
        subject: str,
        text_content: str,
        html_content: Optional[str] = None,
        reply_to: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        template_id: Optional[str] = None,
    ) -> bool:
        """
        Backward-compatible plain/HTML email dispatcher.
        Returns True on successful delivery or capture, False on error.
        """
        try:
            msg = EmailMessage(
                to=to_email,
                subject=subject,
                text_body=text_content,
                html_body=html_content,
                reply_to=reply_to,
                idempotency_key=idempotency_key,
                headers=headers,
                metadata=metadata,
                template_id=template_id,
            )
            result = self.send_message(msg)
            return result.success
        except Exception as exc:
            logger.error(f"[EmailService Error] Validation or dispatch error for {to_email}: {exc}")
            return False

    def send_template_email(
        self,
        to_email: str,
        template_id: str,
        template_context: Dict[str, Any],
        reply_to: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> EmailDeliveryResult:
        """Renders registered template and delivers via configured provider."""
        tid = (template_id or "").lower().strip()

        if tid == "welcome":
            subj, html, text = render_welcome_email(
                user_name=template_context.get("user_name")
            )
        elif tid == "ssl_expiry":
            subj, html, text = render_ssl_expiry_alert(
                domain=template_context.get("domain", "example.com"),
                days_remaining=int(template_context.get("days_remaining", 0)),
            )
        elif tid == "score_drop":
            subj, html, text = render_score_drop_alert(
                domain=template_context.get("domain", "example.com"),
                previous_score=int(template_context.get("previous_score", 100)),
                current_score=int(template_context.get("current_score", 0)),
                website_id=template_context.get("website_id"),
            )
        elif tid == "critical_finding":
            subj, html, text = render_critical_finding_alert(
                domain=template_context.get("domain", "example.com"),
                finding_title=template_context.get("finding_title", "Security Finding"),
                severity=template_context.get("severity", "critical"),
                summary=template_context.get("summary", ""),
                scan_id=template_context.get("scan_id"),
            )
        elif tid == "downtime":
            subj, html, text = render_downtime_alert(
                domain=template_context.get("domain", "example.com"),
                error_details=template_context.get("error_details", "Connection timeout"),
                status_code=template_context.get("status_code"),
            )
        elif tid == "scan_completion":
            subj, html, text = render_scan_completed_notification(
                domain=template_context.get("domain", "example.com"),
                score=int(template_context.get("score", 0)),
                risk_level=template_context.get("risk_level", "Medium Risk"),
                scan_id=str(template_context.get("scan_id", "")),
                passed_checks=int(template_context.get("passed_checks", 0)),
                total_checks=int(template_context.get("total_checks", 0)),
            )
        elif tid == "weekly_digest":
            subj, html, text = render_weekly_digest(
                organization_name=template_context.get("organization_name", "Organization"),
                website_summaries=template_context.get("website_summaries", []),
                period_label=template_context.get("period_label", "Last 7 Days"),
            )
        else:
            raise ValueError(f"Unknown email template identifier '{template_id}'")

        msg = EmailMessage(
            to=to_email,
            subject=subj,
            html_body=html,
            text_body=text,
            reply_to=reply_to,
            idempotency_key=idempotency_key,
            template_id=tid,
        )
        return self.send_message(msg)

    # -------------------------------------------------------------------------
    # High-level helper methods for event dispatch
    # -------------------------------------------------------------------------

    def send_ssl_expiry_alert(self, to_email: str, domain: str, days_remaining: int) -> bool:
        """Sends an SSL/TLS expiration notification."""
        result = self.send_template_email(
            to_email=to_email,
            template_id="ssl_expiry",
            template_context={"domain": domain, "days_remaining": days_remaining},
            idempotency_key=f"ssl_{domain}_{days_remaining}_{to_email}",
        )
        return result.success

    def send_score_drop_alert(
        self,
        to_email: str,
        domain: str,
        previous_score: int,
        current_score: int,
        website_id: Optional[str] = None,
    ) -> bool:
        """Sends a security score drop notification."""
        result = self.send_template_email(
            to_email=to_email,
            template_id="score_drop",
            template_context={
                "domain": domain,
                "previous_score": previous_score,
                "current_score": current_score,
                "website_id": website_id,
            },
            idempotency_key=f"score_drop_{domain}_{current_score}_{to_email}",
        )
        return result.success

    def send_critical_finding_alert(
        self,
        to_email: str,
        domain: str,
        finding_title: str,
        severity: str,
        summary: str,
        scan_id: Optional[str] = None,
    ) -> bool:
        """Sends a new critical or high-severity finding alert."""
        result = self.send_template_email(
            to_email=to_email,
            template_id="critical_finding",
            template_context={
                "domain": domain,
                "finding_title": finding_title,
                "severity": severity,
                "summary": summary,
                "scan_id": scan_id,
            },
            idempotency_key=f"finding_{domain}_{finding_title[:20]}_{to_email}",
        )
        return result.success

    def send_downtime_alert(
        self,
        to_email: str,
        domain: str,
        error_details: str,
        status_code: Optional[int] = None,
    ) -> bool:
        """Sends a website downtime / reachability failure alert."""
        result = self.send_template_email(
            to_email=to_email,
            template_id="downtime",
            template_context={
                "domain": domain,
                "error_details": error_details,
                "status_code": status_code,
            },
        )
        return result.success

    def send_scan_completed_notification(
        self,
        to_email: str,
        domain: str,
        score: int,
        risk_level: str,
        scan_id: str,
        passed_checks: int = 0,
        total_checks: int = 0,
    ) -> bool:
        """Sends a scan completion alert."""
        result = self.send_template_email(
            to_email=to_email,
            template_id="scan_completion",
            template_context={
                "domain": domain,
                "score": score,
                "risk_level": risk_level,
                "scan_id": scan_id,
                "passed_checks": passed_checks,
                "total_checks": total_checks,
            },
            idempotency_key=f"scan_done_{scan_id}_{to_email}",
        )
        return result.success

    def send_welcome_email(self, to_email: str, user_name: Optional[str] = None) -> bool:
        """Sends a new account welcome email."""
        result = self.send_template_email(
            to_email=to_email,
            template_id="welcome",
            template_context={"user_name": user_name},
            idempotency_key=f"welcome_{to_email}",
        )
        return result.success

    def send_weekly_digest(
        self,
        to_email: str,
        organization_name: str,
        website_summaries: List[Dict[str, Any]],
        period_label: str = "Last 7 Days",
    ) -> bool:
        """Sends a weekly security summary."""
        result = self.send_template_email(
            to_email=to_email,
            template_id="weekly_digest",
            template_context={
                "organization_name": organization_name,
                "website_summaries": website_summaries,
                "period_label": period_label,
            },
        )
        return result.success

    def health_check(self) -> Dict[str, Any]:
        """Performs a provider configuration and readiness diagnostic."""
        return self.provider.health_check()


# Default service instance
default_email_service = EmailService()

# Module-level convenience functions preserving existing signatures
send_email = default_email_service.send_email
send_ssl_expiry_alert = default_email_service.send_ssl_expiry_alert
send_score_drop_alert = default_email_service.send_score_drop_alert
send_critical_finding_alert = default_email_service.send_critical_finding_alert
send_downtime_alert = default_email_service.send_downtime_alert
send_scan_completed_notification = default_email_service.send_scan_completed_notification
send_welcome_email = default_email_service.send_welcome_email
send_weekly_digest = default_email_service.send_weekly_digest
health_check = default_email_service.health_check
