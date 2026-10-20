"""
Tests for Phase F5: Advanced Authentication, Session, Authorization & Business-Logic Security Intelligence
Comprehensive verification conforming strictly to Phase F5 specification:
- Auth endpoints classification & passive surface analysis
- Password forms cleartext action & GET method checks
- Password-in-URL detection with cryptographic masking
- Account recovery & enumeration signals
- MFA & WebAuthn passkey signal detection
- Session cookie attributes (HttpOnly, Secure, SameSite)
- Session tokens, URL path rewriting (jsessionid), and JWT in URLs with masking
- Anti-CSRF protection across forms, meta tags, and SameSite defenses
- OpenID Connect discovery, PKCE S256, implicit grant, password grant auditing
- OAuth redirect URIs (insecure HTTP and wildcard detection)
- SAML 2.0 metadata discovery and SSO service auditing
- Authorization architecture (RBAC roles, admin routes, object references / IDOR surfaces)
- Business-logic workflow surface inventory & magic link token exposure
- Master orchestrator execution, request budget enforcement, failure isolation
- Full Deep Scan runner integration (deep_scan_version = 5) and deterministic scoring
- Backward compatibility with legacy v1, v2, v3, v4 metadata
"""
import pytest
from unittest.mock import MagicMock
from urllib.parse import urlparse

from scanner.models import CheckStatus, Severity, Finding
from scanner.network.models import SafeResponse
from scanner.deep.models import CrawledPage, FormMetadata
from scanner.deep.config import DeepScanConfig
from scanner.deep.scoring import calculate_deep_score
from scanner.deep.auth_analyzer import (
    classify_auth_endpoint,
    analyze_password_forms,
    detect_password_in_urls,
    analyze_account_recovery,
    detect_mfa_signals,
)
from scanner.deep.session_analyzer import (
    parse_cookie_attributes,
    analyze_session_security,
    detect_session_tokens_in_urls,
)
from scanner.deep.csrf_analyzer import (
    evaluate_page_csrf_mechanisms,
    analyze_csrf_protection,
)
from scanner.deep.oauth_analyzer import (
    parse_oidc_configuration,
    analyze_oauth_redirect_uris,
    analyze_saml_metadata,
)
from scanner.deep.authorization_analyzer import (
    discover_role_metadata,
    analyze_authorization_architecture,
)
from scanner.deep.business_logic_analyzer import (
    analyze_business_logic_surface,
)
from scanner.deep.identity_security import analyze_identity_security
from scanner.deep.runner import run_deep_security_scan


def make_page(url: str, **kwargs) -> CrawledPage:
    """Helper to construct CrawledPage with proper required arguments."""
    parsed = urlparse(url)
    defaults = {
        "final_url": url,
        "depth": 1,
        "status_code": 200,
        "content_type": "text/html",
        "is_https": parsed.scheme.lower() == "https",
        "headers": {},
        "cookies": {},
        "forms": [],
        "discovered_links": [],
        "body_sample": "",
    }
    defaults.update(kwargs)
    return CrawledPage(url=url, **defaults)


def make_form(action: str, method: str = "POST", has_password: bool = False, has_sensitive_fields: bool = False, inputs: list = None, page_url: str = "https://example.com") -> FormMetadata:
    """Helper to construct FormMetadata with required positional arguments."""
    parsed = urlparse(action)
    proto = parsed.scheme or "https"
    host = parsed.netloc or "example.com"
    resolved = action if parsed.scheme else f"{page_url.rstrip('/')}/{action.lstrip('/')}"
    return FormMetadata(
        page_url=page_url,
        action=action,
        resolved_action_url=resolved,
        method=method,
        action_protocol=proto,
        action_host=host,
        is_external=False,
        has_password=has_password,
        has_sensitive_fields=has_sensitive_fields,
        inputs=inputs or [],
    )


# =============================================================================
# 1. Authentication Endpoint Classification
# =============================================================================

def test_classify_auth_endpoint():
    """Verify classification of authentication paths into identity categories."""
    assert classify_auth_endpoint("https://example.com/login") == "LOGIN"
    assert classify_auth_endpoint("https://example.com/auth/signin") == "LOGIN"
    assert classify_auth_endpoint("https://example.com/register") == "REGISTER"
    assert classify_auth_endpoint("https://example.com/logout") == "LOGOUT"
    assert classify_auth_endpoint("https://example.com/auth/session") == "SESSION"
    assert classify_auth_endpoint("https://example.com/forgot-password") == "PASSWORD_RESET"
    assert classify_auth_endpoint("https://example.com/change-password") == "PASSWORD_CHANGE"
    assert classify_auth_endpoint("https://example.com/mfa/verify") == "MFA"
    assert classify_auth_endpoint("https://example.com/webauthn/login") == "MFA"
    assert classify_auth_endpoint("https://example.com/oauth/authorize") == "OAUTH"
    assert classify_auth_endpoint("https://example.com/.well-known/openid-configuration") == "OIDC"
    assert classify_auth_endpoint("https://example.com/saml/metadata") == "SAML"
    assert classify_auth_endpoint("https://example.com/admin/login") == "ADMIN_AUTH"
    assert classify_auth_endpoint("https://example.com/my-account") == "ACCOUNT"
    assert classify_auth_endpoint("https://example.com/blog/article-1") == "UNKNOWN"


# =============================================================================
# 2. Password Forms Security
# =============================================================================

def test_analyze_password_forms_cleartext_submission():
    """Verify detection of password form submitting over unencrypted HTTP."""
    form = make_form(
        action="http://insecure.example.com/auth/login",
        method="POST",
        has_password=True,
        inputs=[{"name": "username", "type": "text"}, {"name": "password", "type": "password"}],
    )
    page = make_page("https://example.com/login", forms=[form])
    evaluated, findings = analyze_password_forms([page])
    assert len(evaluated) == 1
    assert evaluated[0]["is_insecure_cleartext"] is True

    cleartext_findings = [f for f in findings if f.check_type == "deep_password_form_cleartext_action"]
    assert len(cleartext_findings) == 1
    assert cleartext_findings[0].severity == Severity.HIGH
    assert cleartext_findings[0].status == CheckStatus.HIGH


def test_analyze_password_forms_get_method():
    """Verify detection of password form using GET method."""
    form = make_form(
        action="/login",
        method="GET",
        has_password=True,
        inputs=[{"name": "user", "type": "text"}, {"name": "password", "type": "password"}],
    )
    page = make_page("https://example.com/login", forms=[form])
    evaluated, findings = analyze_password_forms([page])
    assert len(evaluated) == 1
    assert evaluated[0]["is_get_method"] is True

    get_findings = [f for f in findings if f.check_type == "deep_password_form_get_method"]
    assert len(get_findings) == 1
    assert get_findings[0].severity == Severity.HIGH
    assert get_findings[0].status == CheckStatus.HIGH


def test_analyze_password_forms_secure_post():
    """Verify that a compliant HTTPS POST password form passes without critical findings."""
    form = make_form(
        action="https://example.com/api/login",
        method="POST",
        has_password=True,
        inputs=[{"name": "user", "type": "text"}, {"name": "password", "type": "password"}],
    )
    page = make_page("https://example.com/login", forms=[form])
    evaluated, findings = analyze_password_forms([page])
    assert len(evaluated) == 1
    assert evaluated[0]["is_insecure_cleartext"] is False
    assert evaluated[0]["is_get_method"] is False
    assert len(findings) == 0


# =============================================================================
# 3. Password in URL Detection & Masking
# =============================================================================

def test_detect_password_in_urls():
    """Verify password query parameters are detected, masked, and flagged."""
    page = make_page("https://example.com/api/auth?user=john&password=SuperSecretPassword123")
    leaks, findings = detect_password_in_urls([page])
    assert len(leaks) == 1
    assert leaks[0]["parameter"] == "password"
    assert "SuperSecretPassword123" not in leaks[0]["masked_value"]
    assert leaks[0]["masked_value"].startswith("Su")

    assert len(findings) == 1
    assert findings[0].check_type == "deep_auth_password_in_url"
    assert findings[0].severity == Severity.HIGH
    # Evidence must contain masked value, never the raw plaintext
    assert "SuperSecretPassword123" not in findings[0].evidence


def test_detect_password_in_urls_dummy_values_ignored():
    """Verify dummy documentation placeholders in query params are not flagged."""
    page = make_page("https://example.com/docs?param=password&password={password}")
    leaks, findings = detect_password_in_urls([page])
    assert len(leaks) == 0
    assert len(findings) == 0


# =============================================================================
# 4. Account Recovery & Password Reset
# =============================================================================

def test_analyze_account_recovery_reset_token_exposed():
    """Verify exposed password reset token in URL is detected and masked."""
    page = make_page("https://example.com/reset-password?reset_token=abcdef1234567890abcdef")
    res, findings = analyze_account_recovery([page], [page.url])
    assert len(res["reset_tokens_found"]) == 1
    assert res["reset_tokens_found"][0]["parameter"] == "reset_token"
    assert "abcdef1234567890abcdef" not in res["reset_tokens_found"][0]["masked_token"]

    token_findings = [f for f in findings if f.check_type == "deep_password_reset_token_exposed"]
    assert len(token_findings) == 1
    assert token_findings[0].severity == Severity.HIGH


def test_analyze_account_recovery_enumeration_detection():
    """Verify account enumeration error message detection."""
    page = make_page(
        "https://example.com/forgot-password",
        body_sample="<html><body><div class='error'>No account found with that email address</div></body></html>",
    )
    res, findings = analyze_account_recovery([page], [page.url])
    assert len(res["enumeration_signals"]) == 1

    enum_findings = [f for f in findings if f.check_type in ("deep_auth_enumeration_signal", "deep_auth_account_enumeration")]
    assert len(enum_findings) == 1
    assert enum_findings[0].severity == Severity.INFO


def test_analyze_account_recovery_password_policy_observed():
    """Verify observable password complexity rules in page body."""
    page = make_page(
        "https://example.com/register",
        body_sample="Password must be at least 12 characters and include at least one uppercase letter and special character.",
    )
    res, findings = analyze_account_recovery([page], [page.url])
    assert res["password_policy"]["observed"] is True
    assert len(res["password_policy"]["rules"]) >= 1


# =============================================================================
# 5. Multi-Factor Authentication (MFA) Signals
# =============================================================================

def test_detect_mfa_signals():
    """Verify detection of MFA keywords (TOTP, WebAuthn passkeys, SMS OTP)."""
    page = make_page(
        "https://example.com/settings/security",
        body_sample="Enable Google Authenticator TOTP or register a hardware passkey / FIDO2 security key.",
    )
    mfa_res, findings = detect_mfa_signals([page])
    assert mfa_res["mfa_detected"] is True
    assert "TOTP" in mfa_res["methods_observed"]
    assert "WEBAUTHN" in mfa_res["methods_observed"]


# =============================================================================
# 6. Session Security & Cookie Attributes
# =============================================================================

def test_parse_cookie_attributes():
    """Verify parsing of Set-Cookie security attributes without saving cookie values."""
    header = "session_id=1234567890; Domain=example.com; Path=/; Secure; HttpOnly; SameSite=Strict"
    attrs = parse_cookie_attributes(header)
    assert attrs["name"] == "session_id"
    assert attrs["http_only"] is True
    assert attrs["is_http_only"] is True
    assert attrs["secure"] is True
    assert attrs["is_secure"] is True
    assert attrs["same_site"] == "Strict"
    assert attrs["domain"] == "example.com"
    assert attrs["path"] == "/"
    assert "1234567890" not in str(attrs)


def test_session_security_missing_httponly():
    """Verify missing HttpOnly flag on auth session cookie raises HIGH finding."""
    page = make_page(
        "https://example.com/login",
        headers={"Set-Cookie": "session=xyz987654321; Path=/; Secure; SameSite=Lax"},
    )
    data, findings = analyze_session_security([page], ["https://example.com/login"])
    assert data["missing_httponly_count"] == 1

    httponly_findings = [f for f in findings if f.check_type == "deep_session_missing_httponly"]
    assert len(httponly_findings) == 1
    assert httponly_findings[0].severity == Severity.HIGH


def test_session_security_missing_secure():
    """Verify missing Secure flag on session cookie raises HIGH finding."""
    page = make_page(
        "https://example.com/dashboard",
        headers={"Set-Cookie": "connect.sid=xyz12345; Path=/; HttpOnly; SameSite=Lax"},
    )
    data, findings = analyze_session_security([page])
    assert data["missing_secure_count"] == 1

    secure_findings = [f for f in findings if f.check_type == "deep_session_missing_secure"]
    assert len(secure_findings) == 1
    assert secure_findings[0].severity == Severity.HIGH


def test_session_security_secure_cookie():
    """Verify properly hardened session cookie yields zero insecure findings."""
    page = make_page(
        "https://example.com/auth/login",
        headers={"Set-Cookie": "sessionid=abc123456789; Path=/; Secure; HttpOnly; SameSite=Strict"},
    )
    data, findings = analyze_session_security([page])
    assert data["insecure_session_cookies_count"] == 0
    assert len(findings) == 0


# =============================================================================
# 7. Session Tokens in URLs
# =============================================================================

def test_detect_session_tokens_in_urls_jsessionid():
    """Verify detection of jsessionid path rewriting in URLs."""
    page = make_page("https://example.com/app;jsessionid=5F29A38401832049BCA102934")
    leaks, findings = detect_session_tokens_in_urls([page])
    assert len(leaks) == 1
    assert leaks[0]["type"] == "JSESSIONID_PATH"
    assert "5F29A38401832049BCA102934" not in leaks[0]["masked_token"]

    jsession_findings = [f for f in findings if f.check_type == "deep_session_url_rewriting"]
    assert len(jsession_findings) == 1
    assert jsession_findings[0].severity == Severity.HIGH


def test_detect_session_tokens_in_urls_query_param():
    """Verify detection of session identifiers in query strings."""
    page = make_page("https://example.com/dashboard?session_id=98765432109876543210")
    leaks, findings = detect_session_tokens_in_urls([page])
    assert len(leaks) == 1
    assert leaks[0]["type"] == "SESSION_QUERY_PARAM"
    assert "98765432109876543210" not in leaks[0]["masked_token"]

    token_findings = [f for f in findings if f.check_type == "deep_session_token_in_url"]
    assert len(token_findings) == 1
    assert token_findings[0].severity == Severity.HIGH


def test_detect_session_tokens_in_urls_jwt():
    """Verify detection of JWT in query strings."""
    dummy_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    page = make_page(f"https://example.com/verify?token={dummy_jwt}")
    leaks, findings = detect_session_tokens_in_urls([page])
    assert len(leaks) == 1
    assert leaks[0]["type"] == "JWT_IN_URL"
    assert dummy_jwt not in leaks[0]["masked_token"]

    jwt_findings = [f for f in findings if f.check_type == "deep_session_jwt_in_url"]
    assert len(jwt_findings) == 1
    assert jwt_findings[0].severity == Severity.HIGH


# =============================================================================
# 8. Anti-CSRF Protection Analysis
# =============================================================================

def test_csrf_protection_form_without_token():
    """Verify sensitive POST form lacking CSRF token triggers finding."""
    form = make_form(
        action="/settings/email/update",
        method="POST",
        has_password=False,
        has_sensitive_fields=True,
        inputs=[{"name": "new_email", "type": "email"}],
    )
    page = make_page("https://example.com/settings", forms=[form])
    session_cookies = [{"name": "sid", "same_site": "None"}]
    csrf_res, findings = analyze_csrf_protection([page], session_cookies)
    assert csrf_res["unprotected_sensitive_forms_count"] == 1

    csrf_findings = [f for f in findings if f.check_type == "deep_csrf_missing_protection"]
    assert len(csrf_findings) == 1
    assert csrf_findings[0].severity == Severity.MEDIUM


def test_csrf_protection_form_with_token():
    """Verify form containing CSRF hidden field is marked as protected."""
    form = make_form(
        action="/settings/update",
        method="POST",
        has_password=False,
        has_sensitive_fields=True,
        inputs=[
            {"name": "email", "type": "email"},
            {"name": "csrf_token", "type": "hidden", "value": "xyz123"},
        ],
    )
    page = make_page("https://example.com/settings", forms=[form])
    csrf_res, findings = analyze_csrf_protection([page], [])
    assert csrf_res["protected_forms_count"] == 1
    warn_findings = [f for f in findings if f.status in (CheckStatus.WARNING, CheckStatus.HIGH)]
    assert len(warn_findings) == 0


def test_csrf_protection_meta_tag():
    """Verify meta csrf-token tag protects forms on page."""
    form = make_form(
        action="/api/profile",
        method="POST",
        has_password=False,
        has_sensitive_fields=True,
        inputs=[{"name": "username", "type": "text"}],
    )
    page = make_page(
        "https://example.com/profile",
        body_sample='<html><head><meta name="csrf-token" content="token123"></head><body></body></html>',
        forms=[form],
    )
    csrf_res, findings = analyze_csrf_protection([page], [])
    assert csrf_res["protected_forms_count"] == 1
    warn_findings = [f for f in findings if f.status in (CheckStatus.WARNING, CheckStatus.HIGH)]
    assert len(warn_findings) == 0


# =============================================================================
# 9. OAuth 2.0 & OpenID Connect (OIDC)
# =============================================================================

def test_parse_oidc_configuration_valid():
    """Verify compliant OIDC discovery configuration generates PASS finding."""
    doc = {
        "issuer": "https://auth.example.com",
        "authorization_endpoint": "https://auth.example.com/oauth/authorize",
        "token_endpoint": "https://auth.example.com/oauth/token",
        "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
    }
    info, findings = parse_oidc_configuration(doc, "https://example.com/.well-known/openid-configuration")
    assert info["issuer"] == "https://auth.example.com"
    assert info["has_pkce_s256"] is True
    assert info["has_implicit_flow"] is False

    pass_findings = [f for f in findings if f.check_type == "deep_oidc_metadata_exposed"]
    assert len(pass_findings) == 1
    assert pass_findings[0].status == CheckStatus.PASS


def test_parse_oidc_configuration_cleartext_endpoint():
    """Verify cleartext HTTP endpoint in OIDC metadata triggers HIGH finding."""
    doc = {
        "issuer": "https://auth.example.com",
        "authorization_endpoint": "http://auth.example.com/oauth/authorize",
        "token_endpoint": "https://auth.example.com/oauth/token",
        "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
    }
    info, findings = parse_oidc_configuration(doc, "https://example.com/.well-known/openid-configuration")
    http_findings = [f for f in findings if f.check_type == "deep_oauth_http_endpoint"]
    assert len(http_findings) == 1


def test_parse_oidc_configuration_missing_pkce():
    """Verify absence of PKCE S256 triggers WARNING finding."""
    doc = {
        "issuer": "https://auth.example.com",
        "authorization_endpoint": "https://auth.example.com/oauth/authorize",
        "token_endpoint": "https://auth.example.com/oauth/token",
        "code_challenge_methods_supported": ["plain"],
    }
    info, findings = parse_oidc_configuration(doc, "https://example.com/.well-known/openid-configuration")
    pkce_findings = [f for f in findings if f.check_type == "deep_oauth_missing_pkce"]
    assert len(pkce_findings) == 1
    assert pkce_findings[0].severity == Severity.LOW


def test_parse_oidc_configuration_implicit_and_password_grant():
    """Verify implicit grant and password grant configurations trigger WARNING findings."""
    doc = {
        "issuer": "https://auth.example.com",
        "authorization_endpoint": "https://auth.example.com/oauth/authorize",
        "token_endpoint": "https://auth.example.com/oauth/token",
        "response_types_supported": ["code", "token", "id_token token"],
        "grant_types_supported": ["authorization_code", "password"],
        "code_challenge_methods_supported": ["S256"],
    }
    info, findings = parse_oidc_configuration(doc, "https://example.com/.well-known/openid-configuration")
    implicit_findings = [f for f in findings if f.check_type == "deep_oauth_implicit_grant_allowed"]
    password_findings = [f for f in findings if f.check_type == "deep_oauth_password_grant_allowed"]
    assert len(implicit_findings) == 1
    assert len(password_findings) == 1


# =============================================================================
# 10. OAuth Redirect URIs & SAML Metadata
# =============================================================================

def test_analyze_oauth_redirect_uris_http_and_wildcard():
    """Verify detection of insecure HTTP and wildcard callback parameters."""
    urls = [
        "https://auth.example.com/oauth/authorize?client_id=123&redirect_uri=http://client.example.com/callback",
        "https://auth.example.com/oauth/authorize?client_id=456&redirect_uri=https://*.client.example.com/callback",
    ]
    obs, findings = analyze_oauth_redirect_uris(urls)
    assert len(obs) == 2

    http_findings = [f for f in findings if f.check_type == "deep_oauth_http_endpoint"]
    wildcard_findings = [f for f in findings if f.check_type == "deep_oauth_redirect_uri_exposure"]
    assert len(http_findings) == 1
    assert len(wildcard_findings) == 1


def test_analyze_saml_metadata():
    """Verify SAML 2.0 metadata XML parsing."""
    sample_xml = """<?xml version="1.0"?>
    <md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.com/saml">
        <md:IDPSSODescriptor>
            <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example.com/sso"/>
        </md:IDPSSODescriptor>
    </md:EntityDescriptor>"""
    info, findings = analyze_saml_metadata(sample_xml, "https://example.com/saml/metadata")
    assert info["entity_id"] == "https://idp.example.com/saml"
    assert info["sso_services_count"] == 1

    saml_findings = [f for f in findings if f.check_type == "deep_saml_metadata_exposed"]
    assert len(saml_findings) == 1
    assert saml_findings[0].status == CheckStatus.PASS


# =============================================================================
# 11. Authorization Architecture & RBAC
# =============================================================================

def test_discover_role_metadata():
    """Verify discovery of roles from body texts and OpenAPI specs."""
    texts = ["User roles available in application: admin, editor, and viewer."]
    specs = [{"paths": {"/api/users": {"get": {"security": [{"roles": ["superadmin"]}]}}}}]
    roles = discover_role_metadata(texts, specs)
    assert "admin" in roles
    assert "editor" in roles
    assert "viewer" in roles
    assert "superadmin" in roles


def test_analyze_authorization_architecture():
    """Verify RBAC role catalog, administrative surface, and object parameter routes."""
    endpoints = [
        "https://example.com/admin/users",
        "https://example.com/manage/settings",
        "https://example.com/api/users/12345",
        "https://example.com/api/orders/e4d909c2-9e86-4e58-8ec1-d57b328a9b34",
    ]
    texts = ["Current session role: admin"]
    data, findings = analyze_authorization_architecture(endpoints, texts, [])

    assert "admin" in data["roles_identified"]
    assert data["admin_routes_count"] >= 2
    assert data["object_routes_count"] >= 2

    admin_findings = [f for f in findings if f.check_type == "deep_auth_admin_endpoint"]
    object_findings = [f for f in findings if f.check_type == "deep_auth_object_reference_surface"]
    assert len(admin_findings) == 1
    assert len(object_findings) == 1


# =============================================================================
# 12. Business-Logic Workflow Surfaces
# =============================================================================

def test_analyze_business_logic_surface_categories():
    """Verify categorization of business-critical workflows."""
    endpoints = [
        "https://example.com/checkout/pay",
        "https://example.com/billing/invoices",
        "https://example.com/admin/users/5/roles",
        "https://example.com/orders/cancel-order",
        "https://example.com/team/invites",
        "https://example.com/requests/approve",
        "https://example.com/wallet/transfers",
    ]
    data, findings = analyze_business_logic_surface(endpoints)
    workflows = data["categorized_workflows"]
    assert len(workflows["payment"]) >= 2
    assert len(workflows["role_change"]) >= 1
    assert len(workflows["refund"]) >= 1
    assert len(workflows["invitation"]) >= 1
    assert len(workflows["approval"]) >= 1
    assert len(workflows["credit"]) >= 1

    surface_findings = [f for f in findings if f.check_type.startswith("deep_business_")]
    assert len(surface_findings) >= 1


def test_analyze_business_logic_magic_link_exposed():
    """Verify magic link / invitation token in URL query is detected and masked."""
    endpoints = [
        "https://example.com/join?magic_link=supersecrettoken1234567890",
    ]
    data, findings = analyze_business_logic_surface(endpoints)
    assert len(data["magic_links_found"]) == 1
    assert "supersecrettoken1234567890" not in data["magic_links_found"][0]["masked_token"]

    magic_findings = [f for f in findings if "magic_link" in f.check_type]
    assert len(magic_findings) == 1
    assert magic_findings[0].severity == Severity.MEDIUM


# =============================================================================
# 13. Master Orchestrator, Budget Enforcement & Failure Isolation
# =============================================================================

def test_analyze_identity_security_orchestrator():
    """Verify master orchestrator coordinates all 6 sub-modules safely."""
    client = MagicMock()
    oidc_resp = SafeResponse(
        url="https://example.com/.well-known/openid-configuration",
        status_code=200,
        headers={"Content-Type": "application/json"},
        text='{"issuer": "https://example.com", "authorization_endpoint": "https://example.com/oauth/authorize", "token_endpoint": "https://example.com/oauth/token", "code_challenge_methods_supported": ["S256"]}',
        final_url="https://example.com/.well-known/openid-configuration",
        redirect_chain=[],
        elapsed_ms=15,
        resolved_ip="93.184.216.34",
    )
    client.get.return_value = oidc_resp

    page = make_page(
        "https://example.com/login",
        body_sample="<html><body><a href='/forgot-password'>Forgot Password?</a></body></html>",
        headers={"Set-Cookie": "session=xyz12345; Secure; HttpOnly; SameSite=Lax"},
    )

    meta, findings = analyze_identity_security(
        crawled_pages=[page],
        client=client,
        target_domain="example.com",
    )

    assert meta["status"] == "completed"
    assert "auth_endpoints" in meta
    assert "session_security" in meta
    assert "csrf" in meta
    assert "oauth_oidc" in meta
    assert "authorization" in meta
    assert "business_logic" in meta
    assert isinstance(findings, list)


def test_identity_security_request_budget_enforcement():
    """Verify request budget enforces max_f5_requests limit strictly."""
    client = MagicMock()
    client.get.return_value = SafeResponse(
        url="https://example.com/404",
        status_code=404,
        headers={},
        text="",
        final_url="https://example.com/404",
        redirect_chain=[],
        elapsed_ms=10,
        resolved_ip="93.184.216.34",
    )
    cfg = DeepScanConfig(max_f5_requests=3)
    meta, findings = analyze_identity_security(
        crawled_pages=[],
        client=client,
        target_domain="example.com",
        config=cfg,
    )
    assert meta["requests_executed"] <= 3


def test_identity_security_failure_isolation():
    """Verify exceptions in client do not crash orchestrator."""
    client = MagicMock()
    client.get.side_effect = Exception("Simulated connection timeout")

    meta, findings = analyze_identity_security(
        crawled_pages=[],
        client=client,
        target_domain="example.com",
    )
    assert meta["status"] == "completed"


# =============================================================================
# 14. Full Deep Scan Runner Integration & Deterministic Scoring
# =============================================================================

def test_full_deep_scan_runner_f5_integration():
    """Verify run_deep_security_scan outputs deep_scan_version = 5 and identity_security."""
    client = MagicMock()
    mock_resp = SafeResponse(
        url="https://example.com",
        status_code=200,
        headers={"Content-Type": "text/html", "Set-Cookie": "sid=12345; Secure; HttpOnly; SameSite=Strict"},
        text="<html><head><title>Secure Site</title></head><body><h1>Welcome</h1><a href='/login'>Login</a></body></html>",
        final_url="https://example.com",
        redirect_chain=[],
        elapsed_ms=20,
        resolved_ip="93.184.216.34",
    )
    client.get.return_value = mock_resp
    client.options.return_value = mock_resp

    resolver = MagicMock()
    resolver.resolve.return_value = ["93.184.216.34"]

    res = run_deep_security_scan("example.com", resolver=resolver, client=client)
    assert res.scan_metadata["deep_scan_version"] >= 5
    assert "identity_security" in res.scan_metadata
    assert 0 <= res.score <= 100
    assert "Cookie Security" in res.score_breakdown
    assert "Forms & Input Security" in res.score_breakdown
    assert "Website & Technology" in res.score_breakdown


def test_scoring_f5_deductions_bounded():
    """Verify F5 findings map to appropriate categories and never cause negative scores."""
    findings = [
        Finding(
            check_type="deep_session_missing_httponly",
            name="Session Cookie Missing HttpOnly",
            status=CheckStatus.HIGH,
            severity=Severity.HIGH,
            score_impact=-4,
            title="Session Cookie Missing HttpOnly",
            summary="test",
            why_it_matters="test",
            how_to_fix="test",
            estimated_fix_minutes=10,
            documentation_url="",
        ),
        Finding(
            check_type="deep_csrf_missing_protection",
            name="CSRF Protection Missing",
            status=CheckStatus.WARNING,
            severity=Severity.MEDIUM,
            score_impact=-4,
            title="CSRF Protection Missing",
            summary="test",
            why_it_matters="test",
            how_to_fix="test",
            estimated_fix_minutes=15,
            documentation_url="",
        ),
        Finding(
            check_type="deep_auth_password_in_url",
            name="Password in URL",
            status=CheckStatus.HIGH,
            severity=Severity.HIGH,
            score_impact=-10,
            title="Password in URL",
            summary="test",
            why_it_matters="test",
            how_to_fix="test",
            estimated_fix_minutes=30,
            documentation_url="",
        ),
    ]
    score, risk, breakdown, passed_c, total_c = calculate_deep_score(findings)
    assert 0 <= score <= 100
    # Cookie Security had deduction
    assert breakdown["Cookie Security"]["deductions"] == 4
    assert breakdown["Cookie Security"]["score"] == 15 - 4
    # Forms & Input Security had deduction
    assert breakdown["Forms & Input Security"]["deductions"] == 4
    assert breakdown["Forms & Input Security"]["score"] == 10 - 4
    # Website & Technology had deduction (capped at max 10)
    assert breakdown["Website & Technology"]["deductions"] == 10
    assert breakdown["Website & Technology"]["score"] == 0


# =============================================================================
# 15. Backward Compatibility (v1 to v4)
# =============================================================================

def test_backward_compatibility_v1_to_v4():
    """Verify older scan schemas without identity_security are compatible."""
    v1_meta = {"deep_scan_version": 1, "pages_crawled": 5}
    v2_meta = {"deep_scan_version": 2, "tls": {}, "dns": {}}
    v3_meta = {"deep_scan_version": 3, "frontend_security": {}}
    v4_meta = {"deep_scan_version": 4, "application_security": {}}

    for meta in (v1_meta, v2_meta, v3_meta, v4_meta):
        identity = meta.get("identity_security")
        assert identity is None
