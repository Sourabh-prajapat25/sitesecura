"""
SiteSecura - Email Providers Package
Exports normalized interfaces and the Resend email provider with testing doubles.
Production strictly uses Resend transactional delivery.
"""
import logging
from typing import Optional
from app.services.email_providers.base import EmailProvider, EmailMessage, EmailDeliveryResult
from app.services.email_providers.resend import ResendEmailProvider
from app.services.email_providers.fake import FakeEmailProvider
from app.core.config import settings

logger = logging.getLogger(__name__)

_active_provider: Optional[EmailProvider] = None


def get_email_provider(force_provider: Optional[str] = None) -> EmailProvider:
    """
    Returns the active EmailProvider.
    In production and standard runtime, this is always ResendEmailProvider.
    Automated test suites can inject test doubles via set_email_provider().
    """
    global _active_provider
    if _active_provider is not None and not force_provider:
        return _active_provider

    if force_provider == "fake":
        return FakeEmailProvider()

    # Production delivery: Resend-only
    provider = ResendEmailProvider()

    if not force_provider:
        _active_provider = provider
    return provider


def set_email_provider(provider: Optional[EmailProvider]):
    """Testing hook to explicitly inject an in-memory email provider double during tests."""
    global _active_provider
    _active_provider = provider


__all__ = [
    "EmailProvider",
    "EmailMessage",
    "EmailDeliveryResult",
    "ResendEmailProvider",
    "FakeEmailProvider",
    "get_email_provider",
    "set_email_provider",
]
