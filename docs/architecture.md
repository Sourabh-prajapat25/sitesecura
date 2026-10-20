# Scanly Technical Architecture

Scanly is designed with clear domain boundaries, asynchronous background task queues, and defensive non-destructive scanning.

```
                    Internet / Visitors
                             │
                             ▼
                    Cloudflare CDN / DNS
                             │
                             ▼
                    Nginx Reverse Proxy (:80 / :443)
                     ├── /      ──► Next.js Frontend (:3000)
                     └── /api/  ──► FastAPI Backend (:8000)
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  ▼                       ▼                       ▼
          PostgreSQL Database       Redis Queue / Cache     Stripe & Firebase
         (Users, Orgs, Scans,     (Celery Task Broker,     (Identity & Billing)
          Reports, Alerts, CMS)    Rate Limiting, Beat)
                                          │
                                          ▼
                                Celery Worker Daemon
                                          │
                                          ▼
                                Modular Python Scanner
                              (SSRF Protection, TLS, DNS,
                               Security Headers, Cookies)
```

## Security & SSRF Protection Model

Because Scanly accepts arbitrary user domains, it implements strict Server-Side Request Forgery (SSRF) countermeasures:
1. **Pre-flight DNS Resolution:** Hostnames are resolved using `socket.getaddrinfo` before any network handshake.
2. **Subnet Filtering:** Every resolved IP is checked against RFC1918 private subnets, loopback (`127.0.0.0/8`), link-local metadata (`169.254.169.254`), carrier-grade NAT, and IPv6 unique locals.
3. **Redirect Hop Verification:** HTTP redirects are capped at 5 hops and re-validated at each step.
4. **Passive Only:** The scanner never executes SQLi/XSS payloads, credential attacks, or denial-of-service tests.
