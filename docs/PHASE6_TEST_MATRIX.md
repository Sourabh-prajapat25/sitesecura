# SITESECURA — PHASE 6 COMPREHENSIVE TEST MATRIX

**Product:** SiteSecura  
**Audit Scope:** End-to-End, Security, Reliability & Production Readiness  
**Test Suite:** `tests/test_phase6_e2e_security_validation.py` + Consolidated Regression Suite

---

## 1. AUTOMATED TEST MATRIX (PHASE 6 VALIDATION SUITE)

| Test ID | Functional Area | Objective | Environment | Input / Trigger | Expected Output | Actual Result | Status |
|---|---|---|---|---|---|---|---|
| **P6-01** | Public Health | Validate `/api/v1/health` status | Local TestClient | `GET /api/v1/health` | HTTP 200, `{"status": "ok"}` | HTTP 200, status ok returned | **PASS** |
| **P6-02** | Readiness Probe | Validate `/api/v1/ready` error sanitization | Local TestClient | `GET /api/v1/ready` | HTTP 200, DB/Redis checked, no passwords leaked | Sanitized JSON, zero credential leaks | **PASS** |
| **P6-03** | Security Headers | Enforce security headers & correlation ID | Local TestClient | `GET /api/v1/health` | `X-Request-ID`, nosniff, DENY, HSTS in prod | Headers present, HSTS max-age asserted | **PASS** |
| **P6-04** | Lead Capture | Verify newsletter subscription idempotency | Local TestClient | `POST /api/v1/newsletter/subscribe` | HTTP 200, duplicate-safe capture | 200 OK returned on initial & duplicate | **PASS** |
| **P6-05** | Auth Enforcement | Reject unauthenticated requests | Local TestClient | `GET /api/v1/auth/me` without token | HTTP 401 Unauthorized | HTTP 401 returned | **PASS** |
| **P6-06** | Token Validation | Reject malformed JWT tokens | Local TestClient | `Authorization: Bearer malformed.jwt` | HTTP 401 or 403 | HTTP 401/403 returned | **PASS** |
| **P6-07** | Prod Token Guard | Disallow mock tokens in production | Simulated Prod | `verify_firebase_id_token("dev-token-x")` | `HTTPException(401)` | Dev token rejected with HTTP 401 | **PASS** |
| **P6-08** | Account Lifecycle | Block deactivated user accounts | Local TestClient | `GET /api/v1/auth/me` with `is_active=False` | HTTP 403 `ACCOUNT_DISABLED` | HTTP 403 returned with error code | **PASS** |
| **P6-09** | Privilege Escalation | Prevent self-promotion to admin on signup | Simulated Prod | `get_or_create_user(token_role="admin")` | User role forced to `'free'` | Role persisted as `'free'` | **PASS** |
| **P6-10** | Scanner Safety | Block dangerous domain targets | Local Resolver | `SafeResolver.resolve("localhost", "127.0.0.1")` | `SSRFValidationError` | Raised `SSRFValidationError` | **PASS** |
| **P6-11** | IP Filtering | Filter RFC 1918, metadata, loopback IPs | Local Safety | `is_safe_ip("169.254.169.254", "10.0.0.1")` | `(False, reason)` | Private & link-local IPs rejected | **PASS** |
| **P6-12** | Tenant Isolation | Enforce cross-org scan and site isolation | Local TestClient | Org A requests Org B's scan & website | HTTP 404 Not Found (IDOR defense) | HTTP 404 returned on cross-tenant read | **PASS** |
| **P6-13** | Admin RBAC | Restrict admin routes from normal users | Local TestClient | Standard user requests `/api/v1/admin/users` | HTTP 403 Forbidden | HTTP 403 returned | **PASS** |
| **P6-14** | Billing Safety | Reject mock checkouts in production | Simulated Prod | `provider.create_checkout_session()` | HTTP 500/503 `PAYMENT_NOT_CONFIGURED` | Blocked with 500/503 error code | **PASS** |
| **P6-15** | Quota Idempotency | Prevent duplicate scan quota refunds | Isolated DB | Multiple `refund_scan_quota_sync` calls | Refund applied once; duplicates return `False` | 1st returns `True`, 2nd returns `False` | **PASS** |
| **P6-16** | PDF Security | Disallow unauthorized PDF report access | Local TestClient | Request report for scan owned by other org | HTTP 404 Not Found | HTTP 404 returned | **PASS** |
| **P6-17** | Path Traversal | Intercept report path traversal attacks | Local TestClient | `GET /api/v1/scans/../../etc/passwd/report` | HTTP 404 or 422 | Path traversal blocked | **PASS** |
| **P6-18** | Queue Scheduling | Verify Celery Beat schedules registered | Celery Conf | Inspect `beat_schedule` | Watchdog (10m) & monitoring (15m) active | Schedules verified in Celery config | **PASS** |
| **P6-19** | Worker Timeouts | Enforce bounded Celery task execution | Celery Conf | Inspect `task_time_limit`, `soft_time_limit` | Limits <= 300s, soft < hard limit | Timeouts asserted (300s hard, 240s soft) | **PASS** |
| **P6-20** | Runbook Integrity | Validate shell script existence & safety | Local Shell | Read scripts in `scripts/*.sh` | All exist and contain `set -euo pipefail` | All 6 scripts present with strict flags | **PASS** |
| **P6-21** | Port Isolation | Validate production Docker port exposure | Local Compose | Parse `docker-compose.prod.yml` | Only 80 & 443 exposed; internal ports blocked | Only 80 & 443 mapped to host | **PASS** |

---

## 2. SSRF TARGET VALIDATION MATRIX

| Target Domain / IP | Classification | Resolver Behavior | Expected Result | Actual Result |
|---|---|---|---|---|
| `example.com` | Public Domain | Resolved to public IP | Allowed | Allowed |
| `8.8.8.8` | Public IP | Direct public IP | Allowed | Allowed |
| `localhost` | Loopback FQDN | DNS / Host lookup | Blocked | Blocked (`SSRFValidationError`) |
| `127.0.0.1` | Loopback IPv4 | Direct IP check | Blocked | Blocked (`SSRFValidationError`) |
| `0.0.0.0` | Broadcast / Wildcard | Direct IP check | Blocked | Blocked (`SSRFValidationError`) |
| `169.254.169.254` | AWS / GCP Metadata | Link-Local IPv4 | Blocked | Blocked (`SSRFValidationError`) |
| `10.0.0.1` | RFC 1918 Class A | Private Subnet | Blocked | Blocked (`SSRFValidationError`) |
| `172.16.0.1` | RFC 1918 Class B | Private Subnet | Blocked | Blocked (`SSRFValidationError`) |
| `192.168.1.1` | RFC 1918 Class C | Private Subnet | Blocked | Blocked (`SSRFValidationError`) |
| `::1` | IPv6 Loopback | Direct IPv6 check | Blocked | Blocked (`SSRFValidationError`) |
| `::ffff:127.0.0.1` | IPv4-mapped IPv6 | Dual-stack mapping | Blocked | Blocked (`SSRFValidationError`) |

---

## 3. MULTI-TENANT ISOLATION MATRIX (IDOR DEFENSES)

| Action | Tenant Context | Target Resource Owner | Expected Response | Actual Response | Security Impact |
|---|---|---|---|---|---|
| Read Scan | Tenant A | Tenant A | HTTP 200 OK | HTTP 200 OK | Authorized access |
| Read Scan | Tenant A | Tenant B | HTTP 404 Not Found | HTTP 404 Not Found | IDOR prevented; existence masked |
| Read Website | Tenant A | Tenant B | HTTP 404 Not Found | HTTP 404 Not Found | IDOR prevented |
| Download PDF | Tenant A | Tenant B | HTTP 404 Not Found | HTTP 404 Not Found | Data exfiltration prevented |
| Update Alert Preferences | Tenant A | Tenant B | HTTP 404 Not Found | HTTP 404 Not Found | Cross-tenant mutation blocked |
| Trigger Scan on Site | Tenant A | Tenant B's Site ID | HTTP 404 Not Found | HTTP 404 Not Found | Quota theft prevented |

---

## 4. ENTITLEMENT & PLAN GATING MATRIX

| Feature / Resource | Free Plan | Basic Plan | Pro Plan | Agency Plan | Gating Mechanism |
|---|---|---|---|---|---|
| Monthly Normal Scans | 10 | 30 | 100 | 500 | `check_and_reserve_scan_quota` |
| Deep Scans | Disabled (0) | Disabled (0) | Enabled | Enabled | `can_run_deep_scan` |
| Monitored Websites | 1 | 3 | 10 | 50 | `can_add_monitored_site` |
| PDF Report Generation | Redacted Top 3 | Full PDF | Full PDF | Custom White-Label | `filter_findings_for_viewer` |
| Team Members | 1 | 1 | 3 | 10 | `OrganizationMember` quota |
| Security Badge Embedding | Locked Preview | Enabled | Enabled | Enabled | Entitlement check |
| AI Security Advisor | Locked | Locked | 100 queries/mo | 500 queries/mo | `check_and_reserve_ai_quota` |

---

## 5. INFRASTRUCTURE & LIVE DEPLOYMENT BLOCKERS MATRIX

| Verification Item | Requirement | Verification Method | Current Status | Blocker Reason |
|---|---|---|---|---|
| **Ubuntu VPS Host** | Dedicated production VPS | SSH login & `uname -a` | **BLOCKED** | VPS not provisioned in local environment |
| **Cloudflare DNS Proxy** | Public records pointing to VPS | `dig sitesecura.com +short` | **BLOCKED** | Live domain nameservers external |
| **Cloudflare WAF / TLS** | Strict edge encryption | Public HTTPS handshake | **BLOCKED** | External network dependency |
| **Live Stripe Billing** | Production keys & webhooks | Live card payment cycle | **DEFERRED** | Deferred per project instructions |
| **Offsite S3 Backups** | S3 bucket & access keys | `aws s3 ls s3://backups` | **BLOCKED** | AWS credentials not connected |
| **Transactional SMTP** | Production mail server | SMTP TLS handshake | **BLOCKED** | External SMTP server required |
