"""
SiteSecura - Resend Production Email Provider
Delivers transactional emails via official Resend Python SDK with idempotency,
structured error classification, and transient retry controls.
"""
import time
import logging
from typing import Dict, Any, Optional
import resend

from app.services.email_providers.base import EmailProvider, EmailMessage, EmailDeliveryResult
from app.core.config import settings

logger = logging.getLogger(__name__)


class ResendEmailProvider(EmailProvider):
    """
    Production-grade Resend transactional email adapter.
    Uses official Resend Python SDK with Bearer authentication, custom timeouts, and idempotency headers.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        from_email: str = settings.EMAIL_FROM,
        from_name: str = settings.EMAIL_FROM_NAME,
        reply_to: Optional[str] = settings.EMAIL_REPLY_TO,
    ):
        self.api_key = api_key or settings.RESEND_API_KEY
        self.from_email = from_email
        self.from_name = from_name
        self.reply_to = reply_to
        if self.api_key:
            resend.api_key = self.api_key

    def _format_sender(self, message: EmailMessage) -> str:
        """Constructs sender header, e.g. 'SiteSecura Security <alerts@sitesecura.com>'."""
        sender = message.from_email or self.from_email
        if "<" in sender:
            return sender
        name = message.from_name or self.from_name
        return f"{name} <{sender}>" if name else sender

    def send(self, message: EmailMessage) -> EmailDeliveryResult:
        start_t = time.perf_counter()

        if not self.api_key:
            return EmailDeliveryResult(
                success=False,
                provider="resend",
                status="failed",
                error_code="MISSING_CREDENTIALS",
                error_message="RESEND_API_KEY is not configured.",
                is_transient=False,
                attempts=1,
                idempotency_key=message.idempotency_key,
            )

        resend.api_key = self.api_key

        sender = self._format_sender(message)
        params: resend.Emails.SendParams = {
            "from": sender,
            "to": [message.to],
            "subject": message.subject,
            "text": message.text_body,
        }

        if message.html_body:
            params["html"] = message.html_body

        reply_to = message.reply_to or self.reply_to
        if reply_to:
            params["reply_to"] = reply_to

        headers: Dict[str, str] = {}
        if message.idempotency_key:
            headers["Idempotency-Key"] = message.idempotency_key
        if message.headers:
            headers.update(message.headers)

        if headers:
            params["headers"] = headers

        try:
            response = resend.Emails.send(params)
            latency = int((time.perf_counter() - start_t) * 1000)

            msg_id = None
            if isinstance(response, dict):
                msg_id = response.get("id")
            elif hasattr(response, "id"):
                msg_id = getattr(response, "id")

            logger.info(
                f"[Resend Success] Accepted email to '{message.to}' | "
                f"Subject: '{message.subject}' | Message ID: '{msg_id}' ({latency}ms)"
            )
            return EmailDeliveryResult(
                success=True,
                provider="resend",
                provider_message_id=msg_id,
                status="provider_accepted",
                latency_ms=latency,
                attempts=1,
                idempotency_key=message.idempotency_key,
            )

        except resend.exceptions.RateLimitError as exc:
            latency = int((time.perf_counter() - start_t) * 1000)
            logger.warning(f"[Resend Rate Limit] 429 Rate limit exceeded: {exc}")
            return EmailDeliveryResult(
                success=False,
                provider="resend",
                status="failed",
                error_code="RATE_LIMIT_EXCEEDED",
                error_message=str(exc)[:200],
                is_transient=True,
                attempts=1,
                latency_ms=latency,
                idempotency_key=message.idempotency_key,
            )
        except resend.exceptions.InvalidApiKeyError as exc:
            latency = int((time.perf_counter() - start_t) * 1000)
            logger.error(f"[Resend Auth Error] Invalid API key: {exc}")
            return EmailDeliveryResult(
                success=False,
                provider="resend",
                status="failed",
                error_code="AUTHENTICATION_ERROR",
                error_message="Authentication failed: invalid or expired Resend API key.",
                is_transient=False,
                attempts=1,
                latency_ms=latency,
                idempotency_key=message.idempotency_key,
            )
        except (resend.exceptions.ValidationError, resend.exceptions.MissingRequiredFieldsError) as exc:
            latency = int((time.perf_counter() - start_t) * 1000)
            logger.error(f"[Resend Validation Error] {exc}")
            return EmailDeliveryResult(
                success=False,
                provider="resend",
                status="failed",
                error_code="VALIDATION_ERROR",
                error_message=str(exc)[:200],
                is_transient=False,
                attempts=1,
                latency_ms=latency,
                idempotency_key=message.idempotency_key,
            )
        except resend.exceptions.ResendError as exc:
            latency = int((time.perf_counter() - start_t) * 1000)
            logger.error(f"[Resend API Error] {exc}")
            code = getattr(exc, "code", "RESEND_API_ERROR")
            is_transient = "5" in str(code) or "server" in str(exc).lower()
            return EmailDeliveryResult(
                success=False,
                provider="resend",
                status="failed",
                error_code=str(code) if code else "RESEND_API_ERROR",
                error_message=str(exc)[:200],
                is_transient=is_transient,
                attempts=1,
                latency_ms=latency,
                idempotency_key=message.idempotency_key,
            )
        except Exception as exc:
            latency = int((time.perf_counter() - start_t) * 1000)
            exc_str = str(exc).lower()
            is_timeout = "timeout" in exc_str or "timed out" in exc_str
            is_network = "connection" in exc_str or "network" in exc_str
            is_transient = is_timeout or is_network
            err_code = "TIMEOUT" if is_timeout else ("NETWORK_ERROR" if is_network else "UNEXPECTED_ERROR")
            logger.error(f"[Resend Exception] {type(exc).__name__}: {exc}")
            return EmailDeliveryResult(
                success=False,
                provider="resend",
                status="failed",
                error_code=err_code,
                error_message=str(exc)[:200],
                is_transient=is_transient,
                attempts=1,
                latency_ms=latency,
                idempotency_key=message.idempotency_key,
            )

    def health_check(self) -> Dict[str, Any]:
        has_key = bool(
            self.api_key
            and not self.api_key.startswith("re_test_placeholder")
            and not self.api_key.startswith("re_placeholder")
        )
        return {
            "provider": "resend",
            "status": "configured" if has_key else "missing_or_placeholder_key",
            "mode": "production",
            "api_key_configured": has_key,
            "from_email": self.from_email,
        }
