# SiteSecura Resend-Only Transactional Email Architecture & Integration Guide

This document specifies the architecture, configuration, testing procedures, provider integration, and production deployment requirements for SiteSecura's transactional email service.

---

## 1. Architecture Overview

SiteSecura implements a production-grade, Resend-only transactional email system. Application services (monitoring alerts, security reports, weekly digests) never interact directly with low-level email networking. Instead, all email operations pass through a centralized application service:

```
[Application Events]
       │
       ▼
[EmailService Singleton]  (apps/api/app/services/email_service.py)
       │
       ├── Template Engine: HTML & Auto Plain-Text (apps/api/app/services/email_templates/)
       │
       ▼
[EmailProvider Factory]   (apps/api/app/services/email_providers/__init__.py)
       │
       ├─► ResendEmailProvider  (Production delivery via official resend Python SDK)
       └─► FakeEmailProvider    (In-memory test double for zero-network automated suites)
```

### Core Design Principles
1. **Single Production Provider (Resend-Only):** Production strictly delivers transactional emails via Resend (`resend>=2.50.0`). All obsolete Testmail and SMTP adapters have been completely removed from the runtime.
2. **Fail-Closed in Production:** `validate_production_configuration()` strictly refuses to start the application in production if `RESEND_API_KEY` is missing or placeholder (`re_placeholder...`), or if `EMAIL_FROM` is missing or uses a development domain (`example.com`, `localhost`).
3. **No Silent Fallback:** If Resend encounters an outage or rate limit, structured errors (`RATE_LIMIT_EXCEEDED`, `TIMEOUT`, `AUTHENTICATION_ERROR`, `VALIDATION_ERROR`) are returned with accurate transient/permanent classification rather than silently discarding messages.
4. **Delivery Semantics (`provider_accepted`):** The system reports `status="provider_accepted"` when Resend's API accepts the request for transmission. It never misleadingly reports `status="delivered"` before downstream inbox placement occurs.
5. **Security & Escaping:** All user-controlled parameters (domain names, user names, error messages) pass through `html.escape()` to prevent HTML injection and client-side XSS.
6. **Firebase Auth Isolation:** Firebase Authentication remains solely responsible for email verification and password reset workflows. The email service will not send duplicate auth emails.

---

## 2. Environment Configuration Reference

| Variable | Type | Allowed Values | Default | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `RESEND_API_KEY` | string | Secret token (`re_...`) | `None` | Production Resend API key (required in production). |
| `RESEND_API_BASE_URL` | string | URL | `https://api.resend.com/emails` | Resend REST API base endpoint. |
| `RESEND_WEBHOOK_SECRET` | string | Secret token (`whsec_...`) | `None` | Optional Resend webhook signature verification secret. |
| `EMAIL_FROM` | string | Email address / formatted header | `"SiteSecura Security <alerts@sitesecura.com>"` | Sender identity. |
| `EMAIL_FROM_NAME` | string | Text string | `"SiteSecura Security"` | Friendly sender name. |
| `EMAIL_REPLY_TO` | string | Email address | `"support@sitesecura.com"` | Default reply-to address. |
| `EMAIL_TIMEOUT_SECONDS` | float | Seconds (> 0) | `10.0` | HTTP request timeout. |
| `EMAIL_MAX_RETRIES` | integer | Count (>= 0) | `3` | Maximum Celery task retries. |
| `EMAIL_RETRY_BACKOFF_SECONDS`| float | Seconds (> 0) | `2.0` | Exponential backoff base. |

> [!NOTE]
> Legacy configuration variables `EMAIL_PROVIDER`, `EMAIL_MODE`, `EMAIL_TEST_RECIPIENT_ALLOWLIST`, `TESTMAIL_*`, and `SMTP_*` are no longer recognized. Any presence of these variables in legacy environment files is ignored to prevent accidental fallback overrides.

---

## 3. Resend Provider Setup Guide

Resend provides reliable transactional delivery over direct HTTPS REST endpoints with official SDK bindings.

### Setup Steps:
1. Create an account at [Resend.com](https://resend.com).
2. Navigate to **Domains** -> **Add Domain** (e.g. `sitesecura.com` or `mail.sitesecura.com`).
3. Add the required DNS records in your DNS provider:
   - **SPF:** `v=spf1 include:amazonses.com ~all` (or Resend's provided include)
   - **DKIM:** Three CNAME records for public key verification
   - **DMARC:** `v=DMARC1; p=reject; rua=mailto:dmarc@sitesecura.com`
4. Wait for domain status to become **Verified**.
5. Navigate to **API Keys** -> **Create API Key** with "Sending access".
6. Configure the production VPS environment (`.env.production`):
   ```bash
   RESEND_API_KEY=re_live_YOUR_PRODUCTION_KEY
   RESEND_API_BASE_URL=https://api.resend.com/emails
   EMAIL_FROM="SiteSecura Security <alerts@sitesecura.com>"
   EMAIL_FROM_NAME="SiteSecura Security"
   EMAIL_REPLY_TO="support@sitesecura.com"
   ```

---

## 4. Admin Smoke Testing & Diagnostic Endpoints

To safely verify transactional delivery, SiteSecura provides protected administrator-only endpoints:

### Endpoint: `POST /api/v1/admin/email/test`
* **Authorization:** Requires Admin role (`require_admin`).
* **OpenAPI Security:** Exposed via standard `HTTPBearer` in Swagger UI (`/docs`).
* **Any Valid Recipient:** Accepts any valid recipient address specified by the authenticated admin caller. No allowlist restriction applies to authorized administrators.
* **Format & CRLF Validation:** Rejects invalid email syntax and prohibits carriage return (`\r`) or line feed (`\n`) characters in recipient and custom subject fields to defend against header injection.
* **Rate Limiting:** Enforces a strict rate limit of **5 requests per 60 seconds** per administrator user.
* **Template Selection:** Validates `template_id` against explicit allowed IDs: `welcome`, `ssl_expiry`, `score_drop`, `critical_finding`, `downtime`, `scan_completion`, `weekly_digest`, `custom`.
* **HTML Injection Protection:** When using `custom`, input is treated as plain text (`text_body`), prohibiting arbitrary HTML injection.
* **Delivery Semantics:** Reports `provider_accepted` upon successful API acceptance by Resend.
* **Audit Logging:** Every test invocation records an `ADMIN_EMAIL_TEST` audit log with sanitized status.

#### Authenticating via Swagger UI (`/docs`):
1. Open `/docs` in your browser.
2. Click the green **Authorize** button at the top right of the page.
3. In the **HTTPBearer (http, Bearer)** dialog:
   - Enter your Firebase JWT ID Token (obtained via client login or Firebase CLI).
   - If you enter the raw token `<token>` or `Bearer <token>`, the backend automatically strips duplicate `Bearer ` prefixes and authenticates cleanly.
4. Click **Authorize**, then **Close**.
5. Navigate to `POST /api/v1/admin/email/test`, click **Try it out**, fill in the request body, and click **Execute**.

#### Example Request:
```bash
curl -X POST https://sitesecura.com/api/v1/admin/email/test \
  -H "Authorization: Bearer <ADMIN_FIREBASE_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_email": "admin@sitesecura.com",
    "template_id": "welcome"
  }'
```

#### Example Response:
```json
{
  "success": true,
  "status": "provider_accepted",
  "provider": "resend",
  "provider_message_id": "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794",
  "recipient": "admin@sitesecura.com",
  "error": null,
  "correlation_id": "test_e847ad89fc01"
}
```

### Endpoint: `GET /api/v1/admin/email/health`
Returns provider configuration diagnostics. Strictly sanitizes credentials and avoids leaking secrets or masked tokens:
```json
{
  "provider": "resend",
  "status": "configured",
  "mode": "production",
  "api_key_configured": true,
  "from_email": "SiteSecura Security <alerts@sitesecura.com>"
}
```

---

## 5. Background Processing & Task Deduplication

Transactional emails are offloaded to background Celery workers to prevent blocking client HTTP responses:

* **Task:** `app.tasks.email_tasks.send_email_task`
* **Idempotency Deduplication:** When `idempotency_key` is supplied, tasks are tracked via Redis with a 24-hour TTL (and process-local fallback). Redelivered tasks or duplicate queue dispatches return `{"status": "dropped", "reason": "duplicate_idempotency_key"}` to prevent duplicate notification delivery.
* **Retry Policy:** Bounded to 3 attempts with exponential backoff (`2s`, `4s`, `8s`) and random jitter.
* **Transient vs Permanent Error Classification:**
  - Transient errors (`RATE_LIMIT_EXCEEDED`, `TIMEOUT`, `NETWORK_ERROR`, server 5xx) trigger `self.retry()`.
  - Permanent errors (`AUTHENTICATION_ERROR`, `VALIDATION_ERROR`, invalid email format) are logged and dropped without retrying.

### Weekly Security Digest Schedule
* **Task:** `app.tasks.email_tasks.send_weekly_security_digest_task`
* **Schedule:** Mondays at 08:00 UTC (registered in Celery Beat). Exactly one Celery Beat daemon should run per cluster.
* **Behavior:** Aggregates already stored scan records and SSL certificate days remaining for active organizations. Respects user notification preferences. **Never triggers new scans.**

---

## 6. Firebase Authentication Boundary

SiteSecura enforces strict separation between authentication emails and application notifications:

1. **Verification & Password Reset:** Handled natively by Firebase Authentication on the client side (`apps/web/src/lib/auth.ts`) using Google's infrastructure.
2. **Action Handling:** Firebase action codes are processed at `/auth/action?mode=verifyEmail` and `/auth/action?mode=resetPassword`.
3. **Boundary Guarantee:** SiteSecura's backend does not duplicate or intercept Firebase verification or password-reset emails.

---

## 7. Production Cutover Checklist

- [ ] **Domain Verification:** Verify sending domain in Resend dashboard with valid SPF, DKIM, and DMARC records.
- [ ] **Production Secret:** Generate live Resend API key and inject into `.env.production` as `RESEND_API_KEY`.
- [ ] **Sender Address:** Ensure `EMAIL_FROM` is set to an authorized domain address (e.g. `SiteSecura Security <alerts@sitesecura.com>`).
- [ ] **Celery Beat Running:** Ensure exactly one Celery Beat scheduler daemon is running to execute `weekly-security-digest`.
- [ ] **Health Check:** Invoke `GET /api/v1/admin/email/health` to confirm provider status is `configured`.
- [ ] **Smoke Test:** Send one test email to any authorized address via `POST /api/v1/admin/email/test`.
