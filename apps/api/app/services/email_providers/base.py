"""
SiteSecura - Configurable Email Service Provider Interface & Models
Defines normalized email messages, delivery results, and the EmailProvider protocol.
"""
import re
import html
import uuid
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator


class EmailMessage(BaseModel):
    """Normalized email message payload accepted by all delivery providers."""
    to: str
    subject: str
    text_body: str
    html_body: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    reply_to: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    metadata: Optional[Dict[str, Any]] = None
    idempotency_key: Optional[str] = None
    template_id: Optional[str] = None

    @field_validator("to")
    @classmethod
    def validate_recipient(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if not v:
            raise ValueError("Recipient email address cannot be empty.")
        # Strict defensive validation
        email_regex = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
        if not email_regex.match(v) or len(v) > 254:
            raise ValueError(f"Invalid recipient email format: '{v}'")
        return v

    @field_validator("subject")
    @classmethod
    def validate_subject(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Email subject cannot be empty.")
        # Prevent CRLF header injection
        if "\r" in v or "\n" in v:
            raise ValueError("Email subject contains prohibited newline or carriage return characters.")
        return v


class EmailDeliveryResult(BaseModel):
    """Normalized outcome returned by email providers."""
    success: bool
    provider: str
    provider_message_id: Optional[str] = None
    status: str = Field(..., description="queued | provider_accepted | delivered | bounced | failed | dropped | captured")
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    is_transient: bool = False
    attempts: int = 1
    latency_ms: Optional[int] = None
    idempotency_key: Optional[str] = None


class EmailProvider(ABC):
    """Abstract base protocol for all email delivery adapters."""

    @abstractmethod
    def send(self, message: EmailMessage) -> EmailDeliveryResult:
        """Synchronously deliver, queue, or capture an email message."""
        pass

    @abstractmethod
    def health_check(self) -> Dict[str, Any]:
        """Perform a provider configuration and readiness check."""
        pass
