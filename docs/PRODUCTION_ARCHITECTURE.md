# SITESECURA — PRODUCTION ARCHITECTURE SPECIFICATION

This document details the production network, container topology, service boundaries, and security perimeters for the single-node production deployment of SiteSecura.

---

## 1. Network & Container Topology Diagram

```
                                  INTERNET
                                     │
                                     │ (Public HTTPS 443 / DNS)
                                     ▼
                      ┌───────────────────────────────┐
                      │    CLOUDFLARE EDGE NETWORK    │
                      │  - DNS & Anycast Routing      │
                      │  - DDoS & WAF Protection      │
                      │  - SSL Edge Termination       │
                      │  - Real-IP Forwarding (CF-IP) │
                      └──────────────┬────────────────┘
                                     │ (Origin HTTPS / Port 443)
                                     ▼
                      ┌───────────────────────────────┐
                      │      HOST FIREWALL (UFW)      │
                      │  - Allow: 22 (SSH), 80, 443   │
                      │  - Deny: All Other Inbound    │
                      └──────────────┬────────────────┘
                                     │
                                     ▼
                      ┌───────────────────────────────┐
                      │    NGINX REVERSE PROXY        │
                      │    (Ports 80 & 443 Host)      │
                      │  - HTTP -> HTTPS Redirect     │
                      │  - TLSv1.2/1.3 Termination    │
                      │  - Real-IP Restoration        │
                      │  - Request ID Injection       │
                      │  - Security Headers (HSTS)    │
                      └───────┬───────────────┬───────┘
                              │               │
     ┌────────────────────────┘               └────────────────────────┐
     │ (Internal /)                                                    │ (Internal /api/)
     ▼                                                                 ▼
┌─────────────────────────┐                               ┌─────────────────────────┐
│     NEXT.JS WEB         │                               │     FASTAPI API         │
│   (Node 20 / Port 3000) │                               │  (Python 3.12 / :8000)  │
│  - SSR & Static Pages   │                               │  - Multi-tenant Core    │
│  - Client Dashboard     │                               │  - Entitlement Engine   │
│  - Authenticated Views  │                               │  - Scan Dispatcher      │
└────────────┬────────────┘                               └────────────┬────────────┘
             │                                                         │
             │                                    ┌────────────────────┴────────────────────┐
             │                                    │                                         │
             ▼                                    ▼                                         ▼
┌─────────────────────────┐          ┌─────────────────────────┐               ┌─────────────────────────┐
│      FIREBASE AUTH      │          │       POSTGRESQL 16     │               │         REDIS 7         │
│  - Identity Authority   │          │  - Multi-Tenant Tables  │               │  - Celery Task Broker   │
│  - JWT Verification     │          │  - Scans & Findings     │               │  - Distributed Limits   │
│  - OAuth & Passwords    │          │  - Persistent Volume    │               │  - Sliding Window State │
└─────────────────────────┘          └────────────┬────────────┘               └────────────┬────────────┘
                                                  │                                         │
                                                  │         ┌───────────────────────────────┘
                                                  │         │
                                                  ▼         ▼
                                     ┌─────────────────────────┐               ┌─────────────────────────┐
                                     │      CELERY WORKER      │               │       CELERY BEAT       │
                                     │  (Prefork Concurrency)  │               │  (Single Instance)      │
                                     │  - Modular Scanner Run  │               │  - Watchdog (10 min)    │
                                     │  - ReportLab PDF Build  │               │  - Monitor Run (15 min) │
                                     │  - Email Notifications  │               │  - Subscription Audit   │
                                     └────────────┬────────────┘               └─────────────────────────┘
                                                  │
                                                  ▼
                                     ┌─────────────────────────┐
                                     │  MODULAR SCANNER ENGINE │
                                     │  - Normal (7 checks)    │
                                     │  - Deep Scan (F1–F8)    │
                                     │  - SSRF SafeResolver    │
                                     │  - Outbound-only Net    │
                                     └────────────┬────────────┘
                                                  │
                                                  ▼
                                        TARGET CLIENT DOMAIN
                                        (Strictly Authorized)

                                  DISASTER RECOVERY ARCHITECTURE
                                                ▲
                                                │
                      ┌─────────────────────────┴─────────────────────────┐
                      │         AUTOMATED ENCRYPTED BACKUPS               │
                      │  - PostgreSQL Dumps: Daily with 7-Day Retention   │
                      │  - PDF Report Archives: Weekly Retention          │
                      │  - Off-Site Cloud Mirror: AWS S3 / Cloudflare R2  │
                      └───────────────────────────────────────────────────┘
```

---

## 2. Container Inventory & Resource Boundaries

| Container Name | Base Image | Service Role | Internal Port | Host Port Binding | Restart Policy | Healthcheck Probe | Volume Mounts |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `scanly-prod-nginx` | `nginx:1.27-alpine` | Edge Proxy / TLS | 80, 443 | **80:80, 443:443** | `unless-stopped` | `wget /nginx-health` | `nginx_ssl`, `certbot_www` |
| `scanly-prod-web` | `node:20-alpine` | Frontend App | 3000 | **None (Internal)** | `unless-stopped` | `wget :3000/` | None (Stateless) |
| `scanly-prod-api` | `python:3.12-slim` | Core Backend | 8000 | **None (Internal)** | `unless-stopped` | `curl /api/v1/health` | `storage_reports` |
| `scanly-prod-postgres` | `postgres:16-alpine`| Relational DB | 5432 | **None (Internal)** | `unless-stopped` | `pg_isready` | `postgres_data` |
| `scanly-prod-redis` | `redis:7-alpine` | Broker / Rate Limit | 6379 | **None (Internal)** | `unless-stopped` | `redis-cli ping` | `redis_data` |
| `scanly-prod-worker` | `python:3.12-slim` | Task Execution | N/A | **None (Internal)** | `unless-stopped` | Celery Ping | `storage_reports` |
| `scanly-prod-beat` | `python:3.12-slim` | Periodic Scheduler | N/A | **None (Internal)** | `unless-stopped` | Process alive | None |

---

## 3. Security Perimeters & Invariants

1. **Strict Origin Isolation:** No internal application ports (3000, 8000, 5432, 6379) are exposed on host network interfaces. All ingress traffic enters via Nginx on ports 80/443.
2. **SSRF Defensive Perimeter:** The scanner worker resolves DNS via `SafeResolver`, strictly forbidding loopback (`127.0.0.0/8`), private RFC1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), cloud metadata (`169.254.169.254`), and non-routable targets.
3. **Report Privacy:** Generated PDF reports are saved in the internal `/storage/reports` volume and can never be accessed via direct static Nginx paths. All report downloads require authorization through `/api/v1/scans/{id}/report`.
4. **Billing Status:** Stripe and Razorpay live payments are explicitly deferred per founder decision. Mock checkout is rejected with HTTP 503 `PAYMENT_NOT_CONFIGURED` in production.
