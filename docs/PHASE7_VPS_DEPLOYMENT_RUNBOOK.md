# SITESECURA — PHASE 7: VPS DEPLOYMENT & ROLLBACK RUNBOOK

**Author:** Principal DevSecOps Engineer  
**Target Infrastructure:** Ubuntu 22.04 LTS / Docker Compose v2 / Nginx Reverse Proxy  
**Status:** **TESTED & READY FOR EXECUTION ON HOST PROVISIONING**

---

## 1. HARDWARE & OPERATING SYSTEM SPECIFICATION

| Parameter | Specification | Notes |
|---|---|---|
| **Operating System** | Ubuntu 22.04 LTS (Jammy Jellyfish) | Minimal server install |
| **Compute** | 4 vCPU cores | Dedicated or performance compute |
| **Memory** | 8 GB RAM | Accommodates Next.js build, Python API, Celery worker pool, PostgreSQL, Redis |
| **Storage** | 80–100 GB NVMe SSD | High IOPS for PostgreSQL WAL and PDF report storage |
| **Network** | 1 Gbps unmetered | Required for rapid scanner HTTP checks |

---

## 2. HOST SYSTEM INITIALIZATION & HARDENING

### 2.1 Non-Root User Provisioning
```bash
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 2.2 SSH Daemon Hardening
Edit `/etc/ssh/sshd_config`:
```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 3
```
Restart SSH: `sudo systemctl restart sshd`

### 2.3 Host Firewall (UFW)
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP (ACME & Redirect)'
sudo ufw allow 443/tcp comment 'HTTPS (Application)'
sudo ufw enable
```

### 2.4 Docker Engine Installation
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker deploy
```

---

## 3. APPLICATION CODEBASE & SECRETS SETUP

Log in as `deploy`:
```bash
sudo mkdir -p /opt/sitesecura
sudo chown -R deploy:deploy /opt/sitesecura
cd /opt/sitesecura

git clone https://github.com/<ORG>/sitesecura.git .
mkdir -p secrets
chmod 700 secrets

# Configure production environment variables
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

### Place TLS Certificates
For Cloudflare Origin CA certificate:
```bash
sudo mkdir -p /etc/nginx/ssl/live/sitesecura.com
# Paste Cloudflare Origin Certificate into /etc/nginx/ssl/live/sitesecura.com/fullchain.pem
# Paste Cloudflare Private Key into /etc/nginx/ssl/live/sitesecura.com/privkey.pem
sudo chmod 600 /etc/nginx/ssl/live/sitesecura.com/privkey.pem
```

---

## 4. ORDERED DEPLOYMENT EXECUTION

Run the automated deployment script:
```bash
bash scripts/deploy.sh
```

### Internal Execution Sequence:
1. **Acquires Mutex Lock:** Flocks `/tmp/sitesecura_deploy.lock` to prevent race conditions.
2. **Pre-Flight Check:** Validates presence of `docker-compose.prod.yml` and `.env.production`.
3. **Database Pre-Backup:** Executes `scripts/backup_postgres.sh` before applying any migrations.
4. **Container Image Build:** Compiles optimized production images for `api`, `worker`, `beat`, and `web`.
5. **Alembic Migrations:** Runs `docker compose -f docker-compose.prod.yml run --rm --no-deps api alembic upgrade head`.
6. **Ordered Dependency Startup:**
   - Starts `postgres` and `redis`, waiting for health check probes to pass.
   - Starts `api`, `worker`, and `beat`.
   - Starts `web` and `nginx`.
7. **Post-Deployment Healthcheck:** Executes `scripts/healthcheck.sh` verifying all services, HTTP probes, and Celery pings.

---

## 5. EMERGENCY ROLLBACK PROCEDURE

If a deployment introduces regressions:

### Scenario A: Application Code / Frontend Regression (Non-Destructive Schema)
```bash
bash scripts/rollback.sh HEAD~1
```
The script will:
1. Check out the previous stable Git commit.
2. Rebuild the container images.
3. Restart all services cleanly with `--remove-orphans`.
4. Re-verify health probes.

### Scenario B: Destructive Migration / Database Corruption
If a database migration corrupted state:
1. Stop application traffic to prevent inconsistent writes:
   ```bash
   docker compose -f docker-compose.prod.yml stop api worker beat web
   ```
2. Locate the pre-deployment backup archive in `/var/backups/sitesecura/postgres/`.
3. Restore the pre-deployment database dump:
   ```bash
   gzip -dc /var/backups/sitesecura/postgres/sitesecura_db_PRE_DEPLOY.sql.gz | \
     docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d scanly
   ```
4. Revert codebase to the prior stable commit:
   ```bash
   git checkout <PRIOR_STABLE_COMMIT>
   docker compose -f docker-compose.prod.yml build
   docker compose -f docker-compose.prod.yml up -d
   ```
5. Run health check: `bash scripts/healthcheck.sh`.
