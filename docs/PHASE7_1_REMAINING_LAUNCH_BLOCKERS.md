# SITESECURA — PHASE 7.1 REMAINING LAUNCH BLOCKERS & ACTIVATION ROADMAP

**Audit Date:** October 2026  
**Auditor:** Principal DevSecOps & Production Launch Auditor  
**Launch Verdict:**  
- **Application Validation:** **PASS** (150/150 automated tests passed, 0 TypeScript errors)
- **Controlled Beta Readiness:** **READY FOR VPS DEPLOYMENT** (with deferred live payments)
- **Public Launch Readiness:** **LIVE DEPLOYMENT VALIDATION BLOCKED** (Pending physical VPS provisioning)

---

## 1. BLOCKER CLASSIFICATION MATRIX

```
+-----------------------------------------------------------------------------------+
|                        SITESECURA LAUNCH STATUS SUMMARY                          |
+-----------------------------------------------------------------------------------+
| [PASS] Application Core (FastAPI, Next.js, Celery, Scanner, Reports, Badge, AI)  |
| [PASS] Regression Testing (138 Phase tests + 12 AI tests = 150/150 Passing)       |
| [PASS] Frontend Build & Static Typing (58 Routes, 0 TypeScript compilation errors)|
| [PASS] Production Docker Configuration (All 7 services validated via compose)     |
+-----------------------------------------------------------------------------------+
| [BLOCKED] Physical Host Provisioning (Target Linux VPS host not yet provisioned)  |
| [BLOCKED] Public DNS & Cloudflare Routing (A records not yet pointed to VPS IP)   |
| [BLOCKED] Live Edge TLS Certificate (Certbot / Let's Encrypt requires public IP)  |
| [BLOCKED] Off-Site Remote Backup Storage (S3 / R2 / B2 bucket credentials pending)|
| [DEFERRED] Live Payment Gateways (Stripe & Razorpay live keys intentionally held) |
+-----------------------------------------------------------------------------------+
```

---

## 2. DETAILED REMAINING BLOCKERS

### Blocker 1: Physical VPS Host Provisioning (Hardware / OS Level)
- **Status:** **BLOCKED**
- **Impact:** Production deployment scripts cannot be executed on local Windows development workstation.
- **Requirements to Unblock:**
  1. Provision an Ubuntu 24.04 LTS (or Debian 12) VPS with at least 4 vCPUs, 8 GB RAM, and 80 GB SSD.
  2. Install Docker Engine and Docker Compose V2 plugin.
  3. Configure non-root `deploy` user with passwordless SSH key authentication.
  4. Enable `ufw` firewall allowing ONLY ports 22 (SSH), 80 (HTTP), and 443 (HTTPS).

### Blocker 2: DNS & Cloudflare Edge Routing
- **Status:** **BLOCKED**
- **Impact:** Endpoints cannot receive live public internet traffic at `sitesecura.com` or `app.sitesecura.com`.
- **Requirements to Unblock:**
  1. Create DNS `A` records for `@` (`sitesecura.com`) and `app` (`app.sitesecura.com`) pointing to the VPS public IP.
  2. Enable Cloudflare Proxy (Orange Cloud) with SSL/TLS encryption mode set strictly to **Full (Strict)**.
  3. **MANDATORY SAFETY RULE:** Strictly preserve all existing email DNS records (Zoho MX, SPF, DKIM, DMARC, and domain ownership verification TXT records).

### Blocker 3: Live TLS Certificate Generation
- **Status:** **BLOCKED**
- **Impact:** Nginx cannot terminate TLS until valid certificates exist in `nginx_ssl` volume.
- **Requirements to Unblock:**
  1. Execute initial Certbot webroot certificate request once DNS resolves to the VPS:
     ```bash
     docker compose -f docker-compose.prod.yml run --rm certbot certonly \
       --webroot --webroot-path=/var/www/certbot \
       -d sitesecura.com -d app.sitesecura.com --email support@sitesecura.com --agree-tos
     ```
  2. Reload Nginx: `docker compose -f docker-compose.prod.yml exec nginx nginx -s reload`.

### Blocker 4: Off-Site Backup Remote Sync Storage
- **Status:** **BLOCKED**
- **Impact:** Database backups remain local on the VPS disk until synced off-site.
- **Requirements to Unblock:**
  1. Create private bucket on AWS S3, Cloudflare R2, or Backblaze B2.
  2. Provide bucket credentials and configure daily cron to sync `/var/backups/sitesecura/` off-site.

### Blocker 5: Live Payment Gateway Activation (Policy Deferred)
- **Status:** **SAFELY DEFERRED**
- **Impact:** Paid self-service upgrades via Stripe and Razorpay return HTTP 503 `PAYMENT_NOT_CONFIGURED`. Free plans and manually provisioned accounts work 100%.
- **Requirements to Unblock for Public Launch:**
  1. Populate live `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `.env.production`.
  2. Populate live `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in `.env.production`.
  3. Perform a live 1-cent test transaction and verify webhook credit processing.

---

## 3. STEP-BY-STEP ACTIVATION ROADMAP FOR INFRASTRUCTURE ENGINEER

When the physical VPS server is available, execute the following verified activation procedure:

### Step 1: Server Setup & Code Checkout
```bash
# On VPS as deploy user
ssh deploy@<vps-ip>
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin git ufw
sudo usermod -aG docker deploy
git clone <repository_url> /opt/sitesecura
cd /opt/sitesecura
```

### Step 2: Environment Configuration
```bash
# Create production environment file from template
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production # Populate database passwords, SECRET_KEY, Firebase credentials, etc.
```

### Step 3: Execute Deployment Script
```bash
# Run the newly hardened deployment script
bash scripts/deploy.sh
```
*The script will:*
1. Acquire mutex lock.
2. Start PostgreSQL and Redis containers and wait for `pg_isready`.
3. Detect clean database and safely skip pre-backup.
4. Build all container images.
5. Apply Alembic migrations to head.
6. Start API, workers, scheduler, Next.js web, and Nginx.
7. Verify healthcheck endpoints.

### Step 4: Verify First Restore Drill
```bash
# Run manual backup and verify restore drill
bash scripts/backup_postgres.sh
bash scripts/test_restore.sh
```

### Step 5: Configure Production Crontab
```bash
sudo crontab -e
# Add:
# 1. Daily DB backup at 02:00 UTC:
0 2 * * * cd /opt/sitesecura && bash scripts/backup_postgres.sh >> /var/log/sitesecura_backup.log 2>&1
# 2. Weekly restore drill on Sundays at 04:00 UTC:
0 4 * * 0 cd /opt/sitesecura && bash scripts/test_restore.sh >> /var/log/sitesecura_restore_drill.log 2>&1
# 3. Bi-monthly cert renewal at 03:00 UTC on 1st & 15th:
0 3 1,15 * * cd /opt/sitesecura && docker compose -f docker-compose.prod.yml run --rm certbot renew && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```
