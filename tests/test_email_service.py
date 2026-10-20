"""
SiteSecura - Configurable Email Service & Resend Production Test Suite
Comprehensive validation covering:
1. Resend-only provider selection and fail-closed production validation.
2. Email message validation and CRLF injection prevention.
3. Fake in-memory provider capture and deterministic inspection for tests.
4. Resend official SDK delivery, params, idempotency, and structured error classification.
5. Email templates rendering, SiteSecura branding, and HTML escaping.
6. Celery background task retry behavior for transient vs permanent failures and idempotency deduplication.
7. User notification preferences and Firebase Auth boundary preservation.
8. Provider health diagnostics and credential secret sanitization.
9. Admin test endpoint recipient acceptance without allowlist, format validation, and CRLF protection.
10. Authentication, Swagger UI HTTPBearer security scheme, and duplicate 'Bearer Bearer' prefix normalization.
"""
import uuid
import re
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.security import HTTPAuthorizationCredentials
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.config import Settings, settings
from app.core.security import get_current_user_token, get_optional_user_token
from app.core.authorization import AuthContext, require_admin
from app.models.user import User, Organization, OrganizationMember
from app.services.email_providers.base import EmailMessage, EmailDeliveryResult
from app.services.email_providers.fake import FakeEmailProvider
from app.services.email_providers.resend import ResendEmailProvider
from app.services.email_providers import get_email_provider, set_email_provider
from app.schemas.admin import AdminEmailTestRequest, AdminEmailTestResponse
from app.services.email_service import EmailService, default_email_service
from app.services.email_templates import (
    render_welcome_email,
    render_ssl_expiry_alert,
    render_score_drop_alert,
    render_critical_finding_alert,
    render_downtime_alert,
    render_scan_completed_notification,
    render_weekly_digest,
    html_to_plain_text,
    escape,
)
from app.tasks.email_tasks import send_email_task
from app.api.v1.admin import send_admin_test_email, get_email_provider_health
import resend


# =========================================================================
# 1. Provider Selection & Production Fail-Closed Tests
# =========================================================================

def test_provider_factory_resolution():
    """Verifies that get_email_provider resolves ResendEmailProvider and FakeEmailProvider."""
    set_email_provider(None)
    # Default is ResendEmailProvider
    provider = get_email_provider()
    assert isinstance(provider, ResendEmailProvider)

    # Test double injection
    fake_provider = get_email_provider("fake")
    assert isinstance(fake_provider, FakeEmailProvider)
    set_email_provider(None)


def test_production_fails_closed_on_missing_resend_key():
    """Production must refuse to start if RESEND_API_KEY is missing or placeholder."""
    cfg_resend_missing = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="a" * 32,
        NEXT_PUBLIC_APP_URL="https://sitesecura.com",
        RESEND_API_KEY=None,
    )
    with pytest.raises(ValueError) as exc:
        cfg_resend_missing.validate_production_configuration()
    assert "RESEND_API_KEY must be configured" in str(exc.value)

    cfg_resend_placeholder = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="a" * 32,
        NEXT_PUBLIC_APP_URL="https://sitesecura.com",
        RESEND_API_KEY="re_test_placeholder_123",
    )
    with pytest.raises(ValueError) as exc:
        cfg_resend_placeholder.validate_production_configuration()
    assert "RESEND_API_KEY must be configured" in str(exc.value)


def test_production_fails_closed_on_unsafe_sender():
    """Production must refuse to start if EMAIL_FROM is empty or uses development placeholder domain."""
    cfg_unsafe_sender = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="a" * 32,
        NEXT_PUBLIC_APP_URL="https://sitesecura.com",
        RESEND_API_KEY="re_live_valid_production_key_12345",
        EMAIL_FROM="SiteSecura <alerts@example.com>",
    )
    with pytest.raises(ValueError) as exc:
        cfg_unsafe_sender.validate_production_configuration()
    assert "EMAIL_FROM cannot use development placeholder domain" in str(exc.value)

    cfg_empty_sender = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="a" * 32,
        NEXT_PUBLIC_APP_URL="https://sitesecura.com",
        RESEND_API_KEY="re_live_valid_production_key_12345",
        EMAIL_FROM="",
    )
    with pytest.raises(ValueError) as exc:
        cfg_empty_sender.validate_production_configuration()
    assert "EMAIL_FROM must be configured with a valid sender email address" in str(exc.value)


# =========================================================================
# 2. EmailMessage Validation & Security Tests
# =========================================================================

def test_email_message_validation():
    """Verifies that recipient email and subject are strictly validated."""
    # Valid message
    msg = EmailMessage(
        to="sec_team@example.com",
        subject="Valid Security Alert",
        text_body="Perimeter audit clean.",
    )
    assert msg.to == "sec_team@example.com"
    assert msg.subject == "Valid Security Alert"

    # Invalid recipient email
    with pytest.raises(ValueError, match="Invalid recipient email"):
        EmailMessage(
            to="invalid-email-format",
            subject="Alert",
            text_body="Test",
        )

    # Empty recipient
    with pytest.raises(ValueError, match="cannot be empty"):
        EmailMessage(
            to="",
            subject="Alert",
            text_body="Test",
        )

    # Header CRLF injection in subject
    with pytest.raises(ValueError, match="prohibited newline"):
        EmailMessage(
            to="test@example.com",
            subject="Alert\r\nBcc: evil@attacker.com",
            text_body="Test",
        )


# =========================================================================
# 3. Fake In-Memory Provider Tests
# =========================================================================

def test_fake_email_provider_capture():
    """Verifies FakeEmailProvider records messages and supports filtering."""
    fake = FakeEmailProvider()
    service = EmailService(provider=fake)

    # Send 2 emails
    res1 = service.send_email(
        to_email="dev@sitesecura.com",
        subject="Test 1",
        text_content="Body 1",
    )
    res2 = service.send_email(
        to_email="qa@sitesecura.com",
        subject="Test 2: Security Alert",
        text_content="Body 2",
    )

    assert res1 is True
    assert res2 is True
    assert len(fake.sent_messages) == 2

    # Filter
    qa_msgs = fake.filter_by_recipient("qa@sitesecura.com")
    assert len(qa_msgs) == 1
    assert qa_msgs[0].subject == "Test 2: Security Alert"

    alert_msgs = fake.filter_by_subject("Security Alert")
    assert len(alert_msgs) == 1

    # Simulated failure
    fake.set_simulate_failure(fail=True, transient=True, message="Simulated connection error")
    res_fail = service.send_email(
        to_email="dev@sitesecura.com",
        subject="Test 3",
        text_content="Body 3",
    )
    assert res_fail is False
    assert fake.deliveries[-1].is_transient is True
    assert fake.deliveries[-1].error_message == "Simulated connection error"


# =========================================================================
# 4. Resend Provider Official SDK Delivery & Error Classification Tests
# =========================================================================

def test_resend_provider_success_sdk_mock():
    """Verifies Resend provider correctly formats request and calls official resend.Emails.send."""
    provider = ResendEmailProvider(
        api_key="re_live_test_key_abc123",
        from_email="alerts@sitesecura.com",
        from_name="SiteSecura Security",
        reply_to="support@sitesecura.com",
    )

    msg = EmailMessage(
        to="admin@client.com",
        subject="Perimeter Security Alert",
        text_body="Score dropped 10 points",
        html_body="<p>Score dropped 10 points</p>",
        idempotency_key="idem_12345",
    )

    with patch.object(resend.Emails, "send") as mock_send:
        mock_send.return_value = {"id": "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794"}

        result = provider.send(msg)

        assert result.success is True
        assert result.status == "provider_accepted"
        assert result.provider == "resend"
        assert result.provider_message_id == "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794"
        assert result.idempotency_key == "idem_12345"

        mock_send.assert_called_once()
        params = mock_send.call_args[0][0]
        assert params["to"] == ["admin@client.com"]
        assert params["from"] == "SiteSecura Security <alerts@sitesecura.com>"
        assert params["subject"] == "Perimeter Security Alert"
        assert params["text"] == "Score dropped 10 points"
        assert params["html"] == "<p>Score dropped 10 points</p>"
        assert params["reply_to"] == "support@sitesecura.com"
        assert params["headers"]["Idempotency-Key"] == "idem_12345"


def test_resend_provider_error_classification():
    """Verifies Resend classifies transient errors vs permanent errors correctly."""
    provider = ResendEmailProvider(api_key="re_key_123")
    msg = EmailMessage(to="user@example.com", subject="Test", text_body="Body")

    # 1. InvalidApiKeyError -> Permanent (AUTHENTICATION_ERROR)
    with patch.object(resend.Emails, "send", side_effect=resend.exceptions.InvalidApiKeyError("Invalid API key", "invalid_api_key", 401)):
        res = provider.send(msg)
        assert res.success is False
        assert res.error_code == "AUTHENTICATION_ERROR"
        assert res.is_transient is False

    # 2. ValidationError -> Permanent (VALIDATION_ERROR)
    with patch.object(resend.Emails, "send", side_effect=resend.exceptions.ValidationError("Domain unverified", "validation_error", 422)):
        res = provider.send(msg)
        assert res.success is False
        assert res.error_code == "VALIDATION_ERROR"
        assert res.is_transient is False

    # 3. RateLimitError -> Transient (retryable)
    with patch.object(resend.Emails, "send", side_effect=resend.exceptions.RateLimitError("Rate limit exceeded", "rate_limit_exceeded", 429)):
        res = provider.send(msg)
        assert res.success is False
        assert res.error_code == "RATE_LIMIT_EXCEEDED"
        assert res.is_transient is True

    # 4. ResendError with 500 status -> Transient (retryable)
    server_error = resend.exceptions.ResendError(500, "server_error", "Internal Server Error", "Retry later")
    with patch.object(resend.Emails, "send", side_effect=server_error):
        res = provider.send(msg)
        assert res.success is False
        assert res.is_transient is True

    # 5. Network / Timeout Exception -> Transient (retryable)
    with patch.object(resend.Emails, "send", side_effect=Exception("Connection timed out")):
        res = provider.send(msg)
        assert res.success is False
        assert res.error_code == "TIMEOUT"
        assert res.is_transient is True


def test_resend_provider_missing_key_runtime():
    """Resend provider with missing key safely fails closed without unhandled crash."""
    provider = ResendEmailProvider(api_key="")
    msg = EmailMessage(to="user@example.com", subject="Test", text_body="Body")
    result = provider.send(msg)
    assert result.success is False
    assert result.error_code == "MISSING_CREDENTIALS"
    assert "RESEND_API_KEY is not configured" in result.error_message


# =========================================================================
# 5. Template Rendering & XSS Escaping Tests
# =========================================================================

def test_template_rendering_all_types():
    """Verifies that all 7 registered templates render valid HTML and plain-text fallbacks."""
    # 1. Welcome
    s1, h1, t1 = render_welcome_email(user_name="Alice Smith")
    assert "Welcome to SiteSecura" in s1
    assert "Alice Smith" in h1
    assert "Dashboard" in t1

    # 2. SSL Expiry
    s2, h2, t2 = render_ssl_expiry_alert(domain="app.sitesecura.com", days_remaining=10)
    assert "expires in 10 days" in s2
    assert "app.sitesecura.com" in h2
    assert "Let's Encrypt" in t2

    # 3. Score Drop
    s3, h3, t3 = render_score_drop_alert(domain="client.com", previous_score=95, current_score=80)
    assert "dropped by 15 pts" in s3
    assert "95 / 100" in h3
    assert "80 / 100" in t3

    # 4. Critical Finding
    s4, h4, t4 = render_critical_finding_alert(
        domain="portal.com",
        finding_title="Missing Content-Security-Policy",
        severity="critical",
        summary="CSP header missing.",
    )
    assert "CRITICAL Security Issue" in s4
    assert "Missing Content-Security-Policy" in h4
    assert "CSP header missing." in t4

    # 5. Downtime
    s5, h5, t5 = render_downtime_alert(domain="shop.com", error_details="502 Bad Gateway", status_code=502)
    assert "Down Alert: shop.com" in s5
    assert "502 Bad Gateway" in h5

    # 6. Scan Completion
    s6, h6, t6 = render_scan_completed_notification(
        domain="fintech.com",
        score=92,
        risk_level="Excellent",
        scan_id="scan_abc123",
        passed_checks=18,
        total_checks=20,
    )
    assert "Score: 92/100" in s6
    assert "Excellent" in h6
    assert "18" in h6 and "20" in h6
    assert "18 of 20" in t6

    # 7. Weekly Digest
    s7, h7, t7 = render_weekly_digest(
        organization_name="Acme Corp",
        website_summaries=[
            {"domain": "acme.com", "score": 88, "ssl_days_remaining": 45},
            {"domain": "api.acme.com", "score": 95, "ssl_days_remaining": 120},
        ],
    )
    assert "Weekly Security Digest" in s7
    assert "Acme Corp" in h7
    assert "acme.com" in t7
    assert "api.acme.com" in t7


def test_html_injection_prevention():
    """Verifies that malicious user inputs are safely escaped in rendered HTML."""
    malicious_domain = "evil.com<script>alert('xss')</script>"
    malicious_user = 'Admin"><img src=x onerror=alert(1)>'
    malicious_finding = "Vulnerability <iframe src='http://attacker.com'></iframe>"

    # Test in Welcome
    _, h_welcome, _ = render_welcome_email(user_name=malicious_user)
    assert "<script>" not in h_welcome
    assert "<img" not in h_welcome
    assert "&lt;img" in h_welcome

    # Test in SSL Expiry
    _, h_ssl, _ = render_ssl_expiry_alert(domain=malicious_domain, days_remaining=5)
    assert "<script>alert('xss')</script>" not in h_ssl
    assert "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;" in h_ssl

    # Test in Finding
    _, h_finding, _ = render_critical_finding_alert(
        domain="test.com",
        finding_title=malicious_finding,
        severity="critical",
        summary="Safe summary",
    )
    assert "<iframe" not in h_finding
    assert "&lt;iframe src=&#x27;http://attacker.com&#x27;&gt;&lt;/iframe&gt;" in h_finding


# =========================================================================
# 6. Celery Task Retry & Backoff Behavior Tests
# =========================================================================

def test_celery_send_email_task_transient_retry():
    """Verifies Celery send_email_task calls self.retry only on transient failures."""
    from celery.exceptions import Retry

    fake = FakeEmailProvider()
    set_email_provider(fake)

    # 1. Transient error -> Triggers retry
    fake.set_simulate_failure(fail=True, transient=True, message="Network timeout")

    with patch.object(send_email_task, "retry", side_effect=Retry("Retrying...")) as mock_retry:
        with pytest.raises(Retry, match="Retrying..."):
            send_email_task.run(
                to_email="test@sitesecura.com",
                subject="Alert",
                text_content="Body",
            )
        mock_retry.assert_called_once()
        call_kwargs = mock_retry.call_args[1]
        assert call_kwargs["countdown"] > 0

    # 2. Permanent error -> Does NOT trigger retry
    fake.set_simulate_failure(fail=True, transient=False, message="Invalid Recipient")

    with patch.object(send_email_task, "retry") as mock_retry:
        result = send_email_task.run(
            to_email="test@sitesecura.com",
            subject="Alert",
            text_content="Body",
        )

        assert result["status"] == "failed"
        assert result["is_transient"] is False
        mock_retry.assert_not_called()

    # Reset provider
    set_email_provider(None)


def test_celery_task_idempotency_deduplication():
    """Verifies duplicate task executions with identical idempotency_key are dropped."""
    from app.tasks.email_tasks import clear_idempotency_cache

    clear_idempotency_cache()
    fake = FakeEmailProvider()
    set_email_provider(fake)

    unique_idem_key = f"unique_task_key_{uuid.uuid4().hex}"

    # First dispatch
    res1 = send_email_task.run(
        to_email="test@sitesecura.com",
        subject="Alert Once",
        text_content="Body",
        idempotency_key=unique_idem_key,
    )
    assert res1["status"] == "captured"
    assert len(fake.sent_messages) == 1

    # Second duplicate dispatch with same idempotency_key
    res2 = send_email_task.run(
        to_email="test@sitesecura.com",
        subject="Alert Once",
        text_content="Body",
        idempotency_key=unique_idem_key,
    )
    assert res2["status"] == "dropped"
    assert res2["reason"] == "duplicate_idempotency_key"
    assert len(fake.sent_messages) == 1

    clear_idempotency_cache()
    set_email_provider(None)


# =========================================================================
# 7. Firebase Authentication Boundary Verification
# =========================================================================

def test_firebase_auth_boundary_preservation():
    """Verifies that EmailService does not override or send auth verification/reset emails."""
    service = EmailService(provider=FakeEmailProvider())

    # Verify no custom password reset or verification send methods exist on EmailService
    assert not hasattr(service, "send_password_reset_email")
    assert not hasattr(service, "send_verification_email")

    # Verify attempting to use an auth template raises ValueError
    with pytest.raises(ValueError, match="Unknown email template identifier"):
        service.send_template_email(
            to_email="user@sitesecura.com",
            template_id="password_reset",
            template_context={"token": "secret"},
        )


# =========================================================================
# 8. Provider Health Diagnostics & Secret Sanitization
# =========================================================================

def test_provider_health_check_sanitization():
    """Verifies health_check outputs across Resend provider never expose credentials."""
    # 1. Configured Resend
    resend_provider = ResendEmailProvider(api_key="re_secret_super_key_123456789")
    h_resend = resend_provider.health_check()
    assert h_resend["provider"] == "resend"
    assert h_resend["status"] == "configured"
    assert h_resend["api_key_configured"] is True
    assert "re_secret" not in str(h_resend)

    # 2. Missing / Placeholder key
    resend_placeholder = ResendEmailProvider(api_key="re_test_placeholder_xyz")
    h_ph = resend_placeholder.health_check()
    assert h_ph["status"] == "missing_or_placeholder_key"
    assert h_ph["api_key_configured"] is False
    assert "re_test_placeholder" not in str(h_ph)


# =========================================================================
# 9. Admin Endpoint: Recipient Acceptance Without Allowlist & Injection Defense
# =========================================================================

@pytest.mark.asyncio
async def test_admin_test_email_accepts_any_valid_recipient():
    """Verifies that send_admin_test_email accepts any valid email recipient without allowlist."""
    admin_user = User(id=uuid.uuid4(), email="admin@sitesecura.com", role="admin")
    org = Organization(id=uuid.uuid4(), name="SiteSecura Security")
    mem = OrganizationMember(id=uuid.uuid4(), organization_id=org.id, user_id=admin_user.id, role="admin")
    auth = AuthContext(user=admin_user, organization=org, membership=mem, plan="pro", role="admin")

    mock_db = AsyncMock()
    fake = FakeEmailProvider()
    set_email_provider(fake)

    # Send to external client email (previously rejected by allowlist)
    req = AdminEmailTestRequest(
        recipient_email="client.partner@acmecorp.com",
        template_id="welcome",
    )
    resp = await send_admin_test_email(req, auth=auth, db=mock_db)
    assert resp.success is True
    assert resp.recipient == "client.partner@acmecorp.com"
    assert len(fake.sent_messages) == 1
    assert fake.sent_messages[0].to == "client.partner@acmecorp.com"

    set_email_provider(None)


@pytest.mark.asyncio
async def test_admin_test_email_rejects_crlf_injection():
    """Verifies that recipient email with newline or carriage return is rejected."""
    # Recipient validation error via Pydantic model
    with pytest.raises(Exception) as exc_info:
        AdminEmailTestRequest(
            recipient_email="admin@sitesecura.com\r\nBcc: evil@attacker.com",
            template_id="welcome",
        )
    assert "prohibited newline" in str(exc_info.value).lower() or "invalid recipient" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_admin_test_email_rejects_crlf_subject():
    """Verifies that custom subject with newline or carriage return is rejected."""
    with pytest.raises(Exception) as exc_info:
        AdminEmailTestRequest(
            recipient_email="admin@sitesecura.com",
            template_id="custom",
            custom_subject="Test Subject\r\nInjected-Header: 123",
            custom_body="Body",
        )
    assert "prohibited newline" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_admin_test_email_template_allowlist():
    """Verifies that send_admin_test_email rejects invalid or unapproved template identifiers."""
    admin_user = User(id=uuid.uuid4(), email="admin@sitesecura.com", role="admin")
    org = Organization(id=uuid.uuid4(), name="SiteSecura")
    mem = OrganizationMember(id=uuid.uuid4(), organization_id=org.id, user_id=admin_user.id, role="admin")
    auth = AuthContext(user=admin_user, organization=org, membership=mem, plan="pro", role="admin")

    mock_db = AsyncMock()

    req = AdminEmailTestRequest(
        recipient_email="admin@sitesecura.com",
        template_id="malicious_or_unknown_template",
    )
    with pytest.raises(HTTPException) as exc_info:
        await send_admin_test_email(req, auth=auth, db=mock_db)
    assert exc_info.value.status_code == 400
    assert "Invalid template_id" in exc_info.value.detail


@pytest.mark.asyncio
async def test_admin_test_email_rate_limiting():
    """Verifies that send_admin_test_email enforces rate-limiting after 5 requests per window."""
    import app.core.rate_limit as rate_limit_module

    rate_limit_module._memory_rate_limits.clear()

    admin_user = User(id=uuid.uuid4(), email="rate_admin@sitesecura.com", role="admin")
    org = Organization(id=uuid.uuid4(), name="SiteSecura")
    mem = OrganizationMember(id=uuid.uuid4(), organization_id=org.id, user_id=admin_user.id, role="admin")
    auth = AuthContext(user=admin_user, organization=org, membership=mem, plan="pro", role="admin")

    mock_db = AsyncMock()
    fake = FakeEmailProvider()
    set_email_provider(fake)

    req = AdminEmailTestRequest(
        recipient_email="rate_admin@sitesecura.com",
        template_id="welcome",
    )

    # First 5 calls pass
    for _ in range(5):
        res = await send_admin_test_email(req, auth=auth, db=mock_db)
        assert res.success is True

    # 6th call exceeds limit -> HTTP 429
    with pytest.raises(HTTPException) as exc_info:
        await send_admin_test_email(req, auth=auth, db=mock_db)
    assert exc_info.value.status_code == 429

    rate_limit_module._memory_rate_limits.clear()
    set_email_provider(None)


# =========================================================================
# 10. Authentication, Swagger UI HTTPBearer & Bearer Prefix Normalization
# =========================================================================

@pytest.mark.asyncio
async def test_get_current_user_token_missing_header():
    """Missing or empty token raises HTTP 401 with WWW-Authenticate: Bearer."""
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user_token(credentials=None, authorization=None)
    assert exc_info.value.status_code == 401
    assert exc_info.value.headers.get("WWW-Authenticate") == "Bearer"
    assert exc_info.value.detail["error"]["code"] == "AUTHENTICATION_REQUIRED"


@pytest.mark.asyncio
async def test_get_current_user_token_dev_token_success():
    """Valid dev token extracts normalized user identity context."""
    token_data = await get_current_user_token(
        credentials=None,
        authorization="Bearer test-token-adminuser-admin",
    )
    assert token_data["uid"] == "adminuser"
    assert token_data["role"] == "admin"
    assert token_data["email"] == "adminuser@example.com"


@pytest.mark.asyncio
async def test_get_current_user_token_duplicate_bearer_prefix_normalized():
    """
    When Swagger UI sends 'Bearer Bearer <token>' (e.g. user entered 'Bearer <token>' in Authorize modal),
    the system iteratively strips duplicate 'Bearer ' prefixes and succeeds without 401.
    """
    # 1. Via HTTPAuthorizationCredentials
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="Bearer test-token-swaggeradmin-admin")
    token_data1 = await get_current_user_token(credentials=creds, authorization=None)
    assert token_data1["uid"] == "swaggeradmin"
    assert token_data1["role"] == "admin"

    # 2. Via raw Authorization header with triple 'Bearer Bearer Bearer'
    token_data2 = await get_current_user_token(
        credentials=None,
        authorization="Bearer Bearer Bearer test-token-tripleswagger-admin",
    )
    assert token_data2["uid"] == "tripleswagger"
    assert token_data2["role"] == "admin"


@pytest.mark.asyncio
async def test_require_admin_enforcement():
    """Non-admin user role raises HTTP 403 ADMIN_ACCESS_REQUIRED."""
    non_admin_user = User(id=uuid.uuid4(), email="free@sitesecura.com", role="free")
    org = Organization(id=uuid.uuid4(), name="Free Org")
    mem = OrganizationMember(id=uuid.uuid4(), organization_id=org.id, user_id=non_admin_user.id, role="member")
    non_admin_auth = AuthContext(user=non_admin_user, organization=org, membership=mem, plan="free", role="member")

    with pytest.raises(HTTPException) as exc_info:
        await require_admin(auth=non_admin_auth)
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["error"]["code"] == "ADMIN_ACCESS_REQUIRED"

    # Admin user succeeds
    admin_user = User(id=uuid.uuid4(), email="admin@sitesecura.com", role="admin")
    admin_auth = AuthContext(user=admin_user, organization=org, membership=mem, plan="agency", role="admin")
    result = await require_admin(auth=admin_auth)
    assert result == admin_auth


# =========================================================================
# 11. Notification Preferences Schema Validation
# =========================================================================

def test_notification_preferences_schema_validation():
    """Verifies that NotificationPreferencesUpdate forbids unknown or malicious keys."""
    from pydantic import ValidationError
    from app.schemas.shared import NotificationPreferencesUpdate

    # Valid updates
    p1 = NotificationPreferencesUpdate(weekly_digest=False, ssl_expiry=True)
    assert p1.weekly_digest is False
    assert p1.ssl_expiry is True

    # Forbidden arbitrary keys
    with pytest.raises(ValidationError):
        NotificationPreferencesUpdate(is_admin=True)  # type: ignore

    with pytest.raises(ValidationError):
        NotificationPreferencesUpdate(role="superuser")  # type: ignore
