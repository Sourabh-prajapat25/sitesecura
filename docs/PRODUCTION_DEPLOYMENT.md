# SITESECURA — PRODUCTION VPS DEPLOYMENT GUIDE

This document provides the definitive guide for deploying **SiteSecura** on a single-node Linux Virtual Private Server (Ubuntu LTS) with Docker, Nginx, PostgreSQL, Redis, Celery, Cloudflare Edge DNS, and automated backups.

---

## 1. Production VPS Hardware Specifications

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **CPU** | 2 vCPU | **4 vCPU** (Dedicated or Cloud) |
| **RAM** | 4 GB | **8 GB** |
| **Disk** | 50 GB SSD | **80–100 GB NVMe SSD** |
| **Bandwidth** | 100 Mbps | **1 Gbps** |
| **OS** | Ubuntu 22.04 LTS | **Ubuntu 24.04 LTS (x86_64)** |
| **IP** | 1 Dedicated IPv4 + IPv6 | 1 Dedicated IPv4 + IPv6 |

*Rationale:* The 4 vCPU / 8 GB RAM target supports concurrent operations across Next.js (SSR), FastAPI (ASGI), PostgreSQL, Redis, Celery Worker (concurrency 2), Celery Beat, Nginx, and ReportLab PDF compilation without CPU throttling or out-of-memory crashes.

---

## 2. Operating System & Base Hardening

### 2.1 Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git ufw htop fail2ban jq unattended-upgrades
```

### 2.2 Configure System Timezone & NTP
```bash
sudo timedatectl set-timezone UTC
sudo timedatectl set-ntp true
timedatectl status
```

### 2.3 Automatic Security Patching
```bash
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## 3. Administrative User & SSH Hardening

### 3.1 Create Non-Root Deploy User
```bash
sudo adduser --gecos "" deploy
sudo usermod -aG sudo deploy
```

### 3.2 Configure SSH Keys
```bash
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

### 3.3 Harden SSH Daemon (`/etc/ssh/sshd_config`)
```bash
sudo sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

---

## 4. Host Firewall (UFW) Configuration

Docker can bypass default UFW rules when ports are published directly to `0.0.0.0`. In SiteSecura's production compose configuration (`docker-compose.prod.yml`), only Nginx publishes ports (80 and 443). PostgreSQL, Redis, FastAPI, and Next.js do not bind to host ports.

```bash
# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow 22/tcp comment 'SSH'

# Allow Web Traffic (Handled exclusively by Nginx)
sudo ufw allow 80/tcp comment 'HTTP ACME challenge'
sudo ufw allow 443/tcp comment 'HTTPS Production'

# Enable firewall
sudo ufw enable
sudo ufw status verbose
```

---

## 5. Docker Engine & Compose Installation

```bash
# Install official Docker repository
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker deploy
sudo systemctl enable docker
sudo systemctl start docker

# Log out and log back in as deploy user to refresh group membership
exit
```

---

## 6. Project Setup & Secret Management

Clone the repository into `/opt/sitesecura`:
```bash
sudo mkdir -p /opt/sitesecura
sudo chown -R deploy:deploy /opt/sitesecura
git clone https://github.com/your-org/sitesecura.git /opt/sitesecura
cd /opt/sitesecura
```

Copy the production environment template:
```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Generate secure secrets:
```bash
# Generate 64-character SECRET_KEY
openssl rand -hex 32

# Generate strong PostgreSQL password
openssl rand -hex 24
```

Edit `.env.production` and configure:
- `SECRET_KEY`: generated hex value
- `POSTGRES_PASSWORD`: generated password
- `NEXT_PUBLIC_APP_URL`: `https://sitesecura.com`
- `FIREBASE_PROJECT_ID`: production Firebase ID
- `FIREBASE_CREDENTIALS_PATH`: `/opt/sitesecura/secrets/firebase-service-account.json`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`: transactional email credentials

---

## 7. Cloudflare DNS & SSL Configuration

### 7.1 DNS Records
In your Cloudflare dashboard, add the following proxied records (Orange Cloud):
- `A` record: `@` pointing to `<VPS_PUBLIC_IPV4>` (Proxied: Yes)
- `A` record: `www` pointing to `<VPS_PUBLIC_IPV4>` (Proxied: Yes)

### 7.2 Cloudflare SSL/TLS Mode
- Set Encryption Mode to **Full (strict)**.
- Under **Edge Certificates**, enable **Always Use HTTPS**, **Automatic HTTPS Rewrites**, and **TLS 1.3**.

### 7.3 Origin Certificate
1. In Cloudflare, navigate to **SSL/TLS > Origin Server > Create Certificate**.
2. Select Hostnames: `sitesecura.com`, `*.sitesecura.com`.
3. Save the certificate to `/opt/sitesecura/nginx/ssl/fullchain.pem`.
4. Save the private key to `/opt/sitesecura/nginx/ssl/privkey.pem`.
5. Set permissions:
   ```bash
   chmod 600 /opt/sitesecura/nginx/ssl/privkey.pem
   chmod 644 /opt/sitesecura/nginx/ssl/fullchain.pem
   ```

---

## 8. Database Migrations & Initial Deployment

Run deployment with the automated script:
```bash
chmod +x scripts/*.sh
bash scripts/deploy.sh
```

Or manually:
```bash
# 1. Build images
docker compose -f docker-compose.prod.yml build

# 2. Start database and cache
docker compose -f docker-compose.prod.yml up -d postgres redis

# 3. Apply Alembic migrations
docker compose -f docker-compose.prod.yml run --rm --no-deps api alembic upgrade head

# 4. Start all remaining services
docker compose -f docker-compose.prod.yml up -d
```

Verify service statuses:
```bash
docker compose -f docker-compose.prod.yml ps
bash scripts/healthcheck.sh
```

---

## 9. Automated Daily Backups

Set up root/deploy cron jobs for automated database and report archiving:
```bash
sudo crontab -e
```

Add the following entries:
```cron
# Daily PostgreSQL backup at 03:00 UTC
0 3 * * * /bin/bash /opt/sitesecura/scripts/backup_postgres.sh >> /var/log/sitesecura_backup.log 2>&1

# Weekly Report Artifacts archive on Sunday at 04:00 UTC
0 4 * * 0 /bin/bash /opt/sitesecura/scripts/backup_reports.sh >> /var/log/sitesecura_backup.log 2>&1

# Weekly Backup Restoration Test Drill on Sunday at 05:00 UTC
0 5 * * 0 /bin/bash /opt/sitesecura/scripts/test_restore.sh >> /var/log/sitesecura_restore_drill.log 2>&1
```

---

## 10. External Off-Site Backup Replication (Mandatory)

To meet production compliance, backups must be stored **outside the VPS**. Sync local backup dumps to external S3-compatible cloud storage (e.g. AWS S3, Cloudflare R2, or Backblaze B2) using `rclone`:
```bash
sudo apt install -y rclone
rclone config # Configure 'b2-backups' remote
```
Add sync command to backup cron:
```bash
rclone sync /var/backups/sitesecura/ b2-backups:sitesecura-encrypted-backups/ --fast-list
```
