# SITESECURA — PHASE 7: PRODUCTION ENVIRONMENT & SECRET READINESS CHECKLIST

**Author:** DevSecOps Release Engineer  
**Scope:** Complete Production Secret & Variable Inventory  
**Security Rule:** **ZERO SECRETS DISPLAYED OR COMMITTED**  
**Status:** **TEMPLATE & VALIDATOR VERIFIED; HOST PROVISIONING PENDING**

---

## 1. PRODUCTION ENVIRONMENT VARIABLE INVENTORY

| Variable Name | Purpose | Required / Optional | Consuming Service | Expected Production Format | Validation Behavior | Configured Status (Repo) | Value Exposure |
|---|---|---|---|---|---|---|---|
| `ENVIRONMENT` | Declares runtime environment mode | Required | api, worker, beat | Literal `"production"` | Activates prod security policies | Configured (in example) | [PUBLIC MODE] |
| `APP_NAME` | Branding string in logs & emails | Optional | api, worker | Literal `"SiteSecura"` | Defaults to `"Scanly"` if missing | Configured | [NON-SECRET] |
| `NEXT_PUBLIC_APP_URL` | Canonical public origin | Required | web, api | `https://sitesecura.com` | Rejects localhost in prod | Configured | [PUBLIC URL] |
| `API_URL` | Public API routing path | Required | api | `https://sitesecura.com/api` | Matches Nginx proxy route | Configured | [PUBLIC URL] |
| `ALLOWED_ORIGINS` | CORS allowed origins list | Required | api | `https://sitesecura.com` | Strips localhost/loopback | Configured | [PUBLIC URL] |
| `SECRET_KEY` | Cryptographic signing key | **CRITICAL** | api | 64-char Hex (from openssl rand) | **Fails fast if <32 chars or default** | **PENDING FOUNDER** | [PROTECTED] |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiration window | Optional | api | Integer (e.g. `1440` for 24h) | Defaults to `1440` | Configured | [NON-SECRET] |
| `POSTGRES_USER` | PostgreSQL superuser | Required | postgres, api, worker, beat | Alphanumeric (e.g. `postgres`) | Enforced in Docker compose | Configured | [NON-SECRET] |
| `POSTGRES_PASSWORD` | PostgreSQL database password | **CRITICAL** | postgres, api, worker, beat | High-entropy string (>=24 chars) | **Fails fast if default/dev password** | **PENDING FOUNDER** | [PROTECTED] |
| `POSTGRES_DB` | Database name | Required | postgres, api, worker, beat | Alphanumeric (e.g. `scanly`) | Database initialized on startup | Configured | [NON-SECRET] |
| `DATABASE_URL` | Async connection string | Required | api, worker | `postgresql+asyncpg://user:pass@postgres:5432/db` | Checked on API startup | Configured | [PROTECTED] |
| `DATABASE_URL_SYNC` | Sync connection string | Required | worker, beat | `postgresql://user:pass@postgres:5432/db` | Checked on worker startup | Configured | [PROTECTED] |
| `REDIS_URL` | In-memory cache & rate limit URL | Required | api | `redis://redis:6379/0` | Pinged by `/ready` health probe | Configured | [INTERNAL URI] |
| `CELERY_BROKER_URL` | Celery task message broker | Required | api, worker, beat | `redis://redis:6379/0` | Used for task enqueueing | Configured | [INTERNAL URI] |
| `CELERY_RESULT_BACKEND` | Celery task result store | Required | api, worker, beat | `redis://redis:6379/0` | Stores task state & exceptions | Configured | [INTERNAL URI] |
| `REDIS_RATE_LIMIT_FAIL_CLOSED` | Rate limit failure mode | Optional | api | Boolean (`false` default) | Bounded in-memory if false | Configured | [NON-SECRET] |
| `SCANNER_MODE` | Scanner execution mode | Required | worker | Literal `"real"` | Runs real live network scans | Configured | [NON-SECRET] |
| `SCANNER_TIMEOUT_SECONDS` | Scan socket timeout | Optional | worker | Integer (e.g. `10`) | Bounded per check | Configured | [NON-SECRET] |
| `ENABLE_NMAP` | System Nmap scanner toggle | Optional | worker | Literal `"false"` (passive safe) | True requires nmap binary | Configured | [NON-SECRET] |
| `FIREBASE_PROJECT_ID` | Firebase GCP project ID | Required | api, web | e.g. `sitesecura-prod` | Matches Firebase Console | **PENDING FOUNDER** | [PROJECT ID] |
| `FIREBASE_CREDENTIALS_PATH` | Path to service account JSON | **CRITICAL** | api | Mounted path `/app/secrets/...` | Verified by Firebase Admin SDK | **PENDING FOUNDER** | [PROTECTED] |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public Firebase Web API Key | Required | web | `AIzaSy...` format | Initialized in browser | **PENDING FOUNDER** | [PUBLIC KEY] |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`| Firebase Auth Domain | Required | web | `sitesecura-prod.firebaseapp.com`| Authorized in Firebase Console | **PENDING FOUNDER** | [PUBLIC DOMAIN] |
| `NEXT_PUBLIC_API_URL` | Frontend relative API path | Required | web | Literal `"/api/v1"` | Build argument in Dockerfile.web | Configured | [PUBLIC PATH] |
| `STORAGE_PATH` | PDF reports storage mount | Required | api, worker | Literal `"/storage/reports"` | Must be writable by non-root | Configured | [CONTAINER PATH] |
| `EMAIL_MODE` | Transactional email provider | Optional | api, worker | `"smtp"` or `"console"` | Falls back safely on error | Configured | [NON-SECRET] |
| `SMTP_HOST` | Outgoing mail server host | Optional | api, worker | e.g. `smtp.mailgun.org` | Checked on mail send | **PENDING FOUNDER** | [HOSTNAME] |
| `SMTP_PORT` | Outgoing mail server port | Optional | api, worker | `587` (STARTTLS) or `465` (SSL) | Integer | Configured | [PORT] |
| `SMTP_USERNAME` | SMTP account username | Optional | api, worker | e.g. `postmaster@sitesecura.com`| Authenticated with SMTP server | **PENDING FOUNDER** | [ACCOUNT NAME] |
| `SMTP_PASSWORD` | SMTP password / API token | Optional | api, worker | High-entropy token | Never logged | **PENDING FOUNDER** | [PROTECTED] |
| `EMAIL_FROM` | Sender address in headers | Optional | api, worker | `SiteSecura <alerts@sitesecura.com>`| Sender domain matches SPF | Configured | [EMAIL ADDR] |
| `ENABLE_STRIPE` | Live Stripe payment toggle | **DEFERRED** | api | Literal `"false"` | Live billing deferred | Configured (false) | [NON-SECRET] |
| `ENABLE_RAZORPAY` | Live Razorpay toggle | **DEFERRED** | api | Literal `"false"` | Live billing deferred | Configured (false) | [NON-SECRET] |
| `AI_ENABLED` | AI Security Advisor toggle | **DEFERRED** | api | Literal `"false"` | AI generation deferred | Configured (false) | [NON-SECRET] |

---

## 2. FOUNDER INSTRUCTIONS FOR SECURE HOST PROVISIONING

To configure the live production environment without leaking secrets into Git:

1. **SSH into the production VPS:**
   ```bash
   ssh deploy@<PROD_VPS_IP>
   cd /opt/sitesecura
   ```
2. **Generate the strong cryptographic secret:**
   ```bash
   SECRET_KEY=$(openssl rand -hex 32)
   DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9')
   ```
3. **Create the production environment file with restrictive permissions:**
   ```bash
   cp .env.production.example .env.production
   chmod 600 .env.production
   ```
4. **Populate `.env.production`:**
   - Set `SECRET_KEY=${SECRET_KEY}`
   - Set `POSTGRES_PASSWORD=${DB_PASSWORD}`
   - Set `DATABASE_URL=postgresql+asyncpg://postgres:${DB_PASSWORD}@postgres:5432/scanly`
   - Set `DATABASE_URL_SYNC=postgresql://postgres:${DB_PASSWORD}@postgres:5432/scanly`
   - Insert production Firebase Admin service account JSON into `/opt/sitesecura/secrets/firebase-service-account.json` (chmod 600).
   - Insert Firebase Web Client API credentials.
5. **Verify file permissions:**
   ```bash
   ls -la .env.production
   # Output must show: -rw------- 1 deploy deploy ... .env.production
   ```
