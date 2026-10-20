"""
SiteSecura - Fake In-Memory Email Provider
Captures messages in-memory for zero-network automated unit and regression testing.
"""
import time
import uuid
from typing import List, Dict, Any, Optional
from app.services.email_providers.base import EmailProvider, EmailMessage, EmailDeliveryResult


class FakeEmailProvider(EmailProvider):
    """Zero-network, in-memory email provider tailored for deterministic unit testing."""

    def __init__(self):
        self.sent_messages: List[EmailMessage] = []
        self.deliveries: List[EmailDeliveryResult] = []
        self._simulate_failure: bool = False
        self._simulate_transient_error: bool = False
        self._failure_error_message: str = "Simulated provider error"

    def set_simulate_failure(self, fail: bool = True, transient: bool = False, message: str = "Simulated provider error"):
        self._simulate_failure = fail
        self._simulate_transient_error = transient
        self._failure_error_message = message

    def clear(self):
        self.sent_messages.clear()
        self.deliveries.clear()
        self._simulate_failure = False
        self._simulate_transient_error = False

    def send(self, message: EmailMessage) -> EmailDeliveryResult:
        if self._simulate_failure:
            result = EmailDeliveryResult(
                success=False,
                provider="fake",
                status="failed",
                error_message=self._failure_error_message,
                error_code="SIMULATED_FAILURE",
                is_transient=self._simulate_transient_error,
                attempts=1,
                idempotency_key=message.idempotency_key,
            )
            self.deliveries.append(result)
            return result

        msg_id = f"fake_msg_{uuid.uuid4().hex[:12]}"
        self.sent_messages.append(message)
        result = EmailDeliveryResult(
            success=True,
            provider="fake",
            provider_message_id=msg_id,
            status="captured",
            latency_ms=1,
            attempts=1,
            idempotency_key=message.idempotency_key,
        )
        self.deliveries.append(result)
        return result

    def get_last_message(self) -> Optional[EmailMessage]:
        return self.sent_messages[-1] if self.sent_messages else None

    def filter_by_recipient(self, to_email: str) -> List[EmailMessage]:
        clean = (to_email or "").strip().lower()
        return [m for m in self.sent_messages if m.to.lower() == clean]

    def filter_by_subject(self, fragment: str) -> List[EmailMessage]:
        return [m for m in self.sent_messages if fragment.lower() in m.subject.lower()]

    def health_check(self) -> Dict[str, Any]:
        return {
            "provider": "fake",
            "status": "healthy",
            "captured_count": len(self.sent_messages),
        }
