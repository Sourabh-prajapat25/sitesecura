# Scanly Production Deployment Guide

This guide covers production deployment on a VPS (Ubuntu / Debian) with Docker Compose, Cloudflare DNS, and SSL.

---

## 1. Prerequisites

- A VPS (Ubuntu 22.04 LTS or newer) with at least 2GB RAM.
- A public domain (e.g. `scanly.io`) configured with Cloudflare DNS.
- Docker & Docker Compose installed:
  ```bash
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  sudo usermod -aG docker $USER
  ```

---

## 2. Environment Configuration

Clone the repository to `/opt/scanly` and copy `.env.example`:
```bash
git clone https://github.com/your-org/scanly.git /opt/scanly
cd /opt/scanly
cp .env.example .env
nano .env
```

Set the production variables:
- `ENVIRONMENT=production`
- `SECRET_KEY=<generate_random_64_char_secret>`
- `POSTGRES_PASSWORD=<strong_db_password>`
- `FIREBASE_PROJECT_ID=<your-firebase-project-id>`
- `FIREBASE_CLIENT_EMAIL=<service-account-email>`
- `FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."`
- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `EMAIL_MODE=smtp`
- `SMTP_HOST=smtp.mailgun.org`
- `SMTP_PASSWORD=...`

---

## 3. Launching with Docker Compose

Build and launch all services:
```bash
docker compose up -d --build
```

Verify service health:
```bash
docker compose ps
docker compose logs -f api worker beat
```

---

## 4. Running Database Migrations & Seeder

Execute Alembic migrations inside the API container:
```bash
docker compose exec api alembic upgrade head
docker compose exec api python scripts/seed_db.py
```

---

## 5. Setting up Stripe Webhooks

In your Stripe Dashboard:
1. Navigate to **Developers > Webhooks**.
2. Add endpoint: `https://scanly.io/api/v1/billing/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the Signing Secret to `STRIPE_WEBHOOK_SECRET` in your `.env` file and restart:
   ```bash
   docker compose restart api worker
   ```

---

## 6. Automated Daily Database Backups

Add a cron job on the host machine to back up PostgreSQL daily:
```bash
0 3 * * * docker compose -f /opt/scanly/docker-compose.yml exec -T postgres pg_dump -U postgres scanly | gzip > /backups/scanly_$(date +\%Y\%m\%d).sql.gz
```
