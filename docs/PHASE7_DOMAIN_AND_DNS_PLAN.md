# SITESECURA — PHASE 7: PRODUCTION DOMAIN & DNS ARCHITECTURE PLAN

**Author:** SaaS Production Architect & DevSecOps Engineer  
**Target Domain:** `sitesecura.com`  
**Status:** **READY FOR DEPLOYMENT (DNS VALIDATION BLOCKED UNTIL ACCESS GRANTED)**

---

## 1. CANONICAL DOMAIN & ROUTING ARCHITECTURE

### 1.1 Architectural Decision: Single-Domain Model
- **Canonical Public Hostname:** `https://sitesecura.com` (Apex Domain)
- **www Subdomain:** `https://www.sitesecura.com` (301 Permanent Redirect to `https://sitesecura.com`)
- **API Routing Model:** **Single-Domain Reverse Proxy** (`https://sitesecura.com/api/...`)
  - **No separate `api.sitesecura.com` subdomain.**
  - Next.js frontend is served at root `https://sitesecura.com/`.
  - FastAPI backend is served at `https://sitesecura.com/api/`.
  - Nginx handles path-based routing internally:
    ```nginx
    location /api/ {
        proxy_pass http://api_upstream;  # api:8000
    }
    location / {
        proxy_pass http://web_upstream;  # web:3000
    }
    ```

### 1.2 Architectural Benefits of Single-Domain Architecture
1. **Zero CORS Preflight Overhead:** Browser requests from the Next.js frontend to `/api/v1/*` are same-origin. Eliminates `OPTIONS` preflight requests on standard API queries.
2. **Simplified Cookie & Session Scoping:** Authentication cookies and sessions are scoped directly to `sitesecura.com`, avoiding cross-subdomain cookie leakage or third-party cookie restrictions.
3. **Single TLS Certificate:** Only one certificate (or wildcard `*.sitesecura.com` + apex `sitesecura.com`) is needed, simplifying Let's Encrypt / Cloudflare Origin CA certificate lifecycle.

---

## 2. PRODUCTION DNS RECORDS SPECIFICATION

The following records must be configured in the DNS management console (e.g., Cloudflare DNS):

| Type | Name | Content / Target | TTL | Proxy Status (Cloudflare) | Purpose |
|---|---|---|---|---|---|
| **A** | `@` (apex) | `<PROD_VPS_PUBLIC_IP>` | Auto | **Proxied (Orange Cloud)** | Canonical web & API entrypoint |
| **CNAME** | `www` | `sitesecura.com` | Auto | **Proxied (Orange Cloud)** | Redirects `www` to apex |

---

## 3. MANDATORY PRESERVATION OF EXISTING EMAIL & VERIFICATION RECORDS

> [!CAUTION]
> **CRITICAL RULE:** Never change nameservers away from the existing DNS provider or delete existing email records as a shortcut to pointing the website.

The `sitesecura.com` zone may contain existing transactional or business email records (such as Zoho Mail, Google Workspace, or custom mail servers). Under NO circumstances should these records be removed or modified:

| Record Type | Host | Expected Typical Value | Action |
|---|---|---|---|
| **MX** | `@` | `mx.zoho.com` (Priority 10) | **PRESERVE UNTOUCHED** |
| **MX** | `@` | `mx2.zoho.com` (Priority 20) | **PRESERVE UNTOUCHED** |
| **MX** | `@` | `mx3.zoho.com` (Priority 50) | **PRESERVE UNTOUCHED** |
| **TXT** | `@` | `v=spf1 include:zoho.com ~all` | **PRESERVE / MERGE** |
| **TXT** | `zoho._domainkey` | `k=rsa; p=MIGf...` (DKIM public key) | **PRESERVE UNTOUCHED** |
| **TXT** | `_dmarc` | `v=DMARC1; p=none; ...` | **PRESERVE UNTOUCHED** |
| **TXT** | `zoho-verification` | `zoho-verification=...` | **PRESERVE UNTOUCHED** |

If a dedicated transactional email service (e.g., Mailgun, SendGrid, Postmark) is provisioned for SiteSecura automated scan alerts, add a dedicated subdomain such as:
- Subdomain: `mail.sitesecura.com` or `alerts.sitesecura.com`
- This ensures transactional alerts never interfere with apex domain MX records or business mail delivery.

---

## 4. FIREBASE AUTHENTICATION AUTHORIZED DOMAINS

Before public launch, the founder must add the production domain to the **Firebase Console**:
1. Navigate to: **Firebase Console** -> **Authentication** -> **Settings** -> **Authorized Domains**.
2. Add the following domains:
   - `sitesecura.com`
   - `www.sitesecura.com`
3. Verify default Firebase authorized domains remain present:
   - `localhost` (for local development)
   - `sitesecura-prod.firebaseapp.com`

---

## 5. CLOUDFLARE EDGE CONFIGURATION PROTOCOL

1. **SSL/TLS Mode:**
   - Configure to **Full (Strict)** in Cloudflare SSL/TLS overview.
   - Requires valid Cloudflare Origin CA certificate or Let's Encrypt certificate on the origin Nginx.
2. **Always Use HTTPS:**
   - Enable **Always Use HTTPS** in Cloudflare Edge Certificates.
3. **HTTP Strict Transport Security (HSTS):**
   - Enable HSTS in Cloudflare with `max-age=31536000` (1 year), `includeSubDomains: true`, and `nosniff`.
4. **Cloudflare Page Rules / Redirects:**
   - Add Single Redirect rule:
     - When incoming request matches: `http://www.sitesecura.com/*` or `https://www.sitesecura.com/*`
     - Forward (301 Permanent Redirect) to: `https://sitesecura.com/$1`

---

## 6. DNS ROLLBACK PROCEDURE

If the VPS deployment encounters fatal issues and the site must be rolled back:
1. Note the original `A` record value prior to making changes.
2. Change the `A` record for `@` back to the fallback maintenance server or previous host IP.
3. Since Cloudflare proxied records have short edge TTLs (typically 300 seconds), changes propagate globally within 5 minutes.
