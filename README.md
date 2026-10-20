# Scanly — Defensive Website Cybersecurity SaaS

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Scanly is an accessible, actionable cybersecurity platform built for small businesses, startups, developers, freelancers, and digital agencies.

---

## Key Features

- **60-Second Real Defensive Scan:** Tests HTTPS enforcement, SSL/TLS certificate validity & expiration, SPF/DMARC email spoofing protection, and HTTP security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options).
- **Deterministic 0–100 Security Score:** Every deduction is mapped to verified check results.
- **Strict SSRF Protection:** Pre-flight DNS resolution blocks loopback, RFC1918 private IPs, link-local metadata endpoints (`169.254.169.254`), and unauthorized networks.
- **Automated Background Monitoring:** Periodic Celery Beat schedules audit domains for certificate expiration and security score drops.
- **Executive PDF Audit Reports:** Server-side PDF generation using ReportLab with custom agency white-label branding.
- **Stripe Billing & Subscriptions:** Full checkout sessions, customer portal, and idempotent webhook processing.
- **Agency Multi-Tenancy:** Organization data isolation, team member seats, and bulk CSV domain imports.

---

## Monorepo Structure

```
/scanly
├── /apps
│   ├── /web              # Next.js 14 App Router, TypeScript, Tailwind CSS
│   └── /api              # FastAPI, SQLAlchemy 2.0, Celery, Alembic
├── /scanner              # Modular Python defensive scanning engine
├── /infra                # Dockerfiles, docker-compose.yml, Nginx configuration
├── /docs                 # Deployment, Architecture, and API documentation
└── /scripts              # Database seeder and development utilities
```

---

## Quick Start (Local Development)

### 1. Start Infrastructure via Docker Compose
```bash
docker compose up postgres redis -d
```

### 2. Backend Setup & Migrations
```bash
cd apps/api
pip install -r requirements.txt
alembic upgrade head
python ../../scripts/seed_db.py
uvicorn main:app --reload --port 8000
```

### 3. Start Celery Worker (Optional for background async scans)
```bash
celery -A app.tasks.celery_app.celery_app worker --loglevel=info
```

### 4. Frontend Setup
```bash
cd apps/web
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to access the landing page and dashboard.
Visit [http://localhost:8000/docs](http://localhost:8000/docs) for the interactive Swagger OpenAPI specification.

---

## Running Automated Tests

Run the test suite:
```bash
pytest tests/
```
