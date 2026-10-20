"""
SiteSecura - Console Email Provider
Logs formatted transactional email messages to logger/stdout without network calls.
"""
import time
import logging
from typing import Dict, Any
from app.services.email_providers.base import EmailProvider, EmailMessage, EmailDeliveryResult
from app.core.config import settings

logger = logging.getLogger(__name__)


class ConsoleEmailProvider(EmailProvider):
    """Local development email provider that prints formatted messages to the console."""

    def __init__(self, from_email: str = settings.EMAIL_FROM):
        self.from_email = from_email

    def send(self, message: EmailMessage) -> EmailDeliveryResult:
        start_t = time.perf_counter()
        sender = message.from_email or self.from_email

        logger.info(
            f"\n"
            f"==================== [SITESECURA TRANSACTIONAL EMAIL] ====================\n"
            f"PROVIDER:    CONSOLE (Local Development Mode)\n"
            f"TO:          {message.to}\n"
            f"FROM:        {sender}\n"
            f"REPLY-TO:    {message.reply_to or 'None'}\n"
            f"SUBJECT:     {message.subject}\n"
            f"TEMPLATE:    {message.template_id or 'None'}\n"
            f"IDEMPOTENCY: {message.idempotency_key or 'None'}\n"
            f"-------------------------- [PLAIN TEXT BODY] --------------------------\n"
            f"{message.text_body}\n"
            f"=========================================================================="
        )

        latency = int((time.perf_counter() - start_t) * 1000)
        return EmailDeliveryResult(
            success=True,
            provider="console",
            provider_message_id=f"console_{int(time.time()*1000)}",
            status="captured",
            latency_ms=latency,
            idempotency_key=message.idempotency_key,
        )

    def health_check(self) -> Dict[str, Any]:
        return {
            "provider": "console",
            "status": "healthy",
            "mode": "development",
            "from_email": self.from_email,
        }
