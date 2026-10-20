# SITESECURA — PHASE 7: OPERATIONS & INCIDENT RESPONSE RUNBOOK

**Author:** Incident Response & SaaS Operations Lead  
**Target Audience:** Founder, System Operators, On-Call Engineers  
**Security Standard:** **Zero credentials or unredacted secrets in runbooks**

---

## 1. ROUTINE OPERATIONAL COMMANDS

### 1.1 Check Global System Health
Execute the automated healthcheck script:
```bash
bash scripts/healthcheck.sh
```
Expected output: All containers report `healthy`, Nginx reports `OK`, API liveness returns `OK`, API readiness returns `OK`, Celery ping returns `pong`.

### 1.2 Inspect Container Logs (Sanitized)
```bash
# View last 100 lines of API backend logs
docker compose -f docker-compose.prod.yml logs --tail=100 -f api

# View Celery worker task execution logs
docker compose -f docker-compose.prod.yml logs --tail=100 -f worker

# View Celery Beat scheduler logs
docker compose -f docker-compose.prod.yml logs --tail=100 -f beat

# View Nginx access & error logs (JSON format)
docker compose -f docker-compose.prod.yml logs --tail=100 -f nginx
```

### 1.3 Celery Worker & Queue Inspection
```bash
# Ping active Celery worker nodes
docker compose -f docker-compose.prod.yml exec worker \
  celery -A app.tasks.celery_app.celery_app inspect ping

# Inspect currently executing tasks
docker compose -f docker-compose.prod.yml exec worker \
  celery -A app.tasks.celery_app.celery_app inspect active

# Inspect Redis queue backlog length
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli llen celery
```

### 1.4 Restart an Individual Unhealthy Service Safely
```bash
# Restart worker only (preserves database & web traffic)
docker compose -f docker-compose.prod.yml restart worker

# Restart API backend (brief sub-second container reload behind Nginx proxy retry)
docker compose -f docker-compose.prod.yml restart api
```

### 1.5 System Resource Profiling
```bash
# Check host disk capacity (Threshold: Alert if >85%)
df -h / /var/lib/docker

# Check host memory & swap (Threshold: Alert if memory >90% and swap >50%)
free -h

# Inspect live container memory and CPU utilization
docker stats --no-stream
```

### 1.6 Check TLS Certificate Expiry
```bash
openssl x509 -enddate -noout -in /etc/nginx/ssl/live/sitesecura.com/fullchain.pem
```

---

## 2. INCIDENT RESPONSE PLAYBOOKS

### Playbook A: Investigating a Spike in Failed Scans
1. **Query recent failed scans:**
   ```bash
   docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d scanly -c \
     "SELECT id, domain, scan_type, status, error_message, created_at \
      FROM scans WHERE status = 'failed' \
      ORDER BY created_at DESC LIMIT 10;"
   ```
2. **Check worker error logs:**
   ```bash
   docker compose -f docker-compose.prod.yml logs --tail=200 worker | grep -E "ERROR|CRITICAL|Exception"
   ```
3. **Verify outbound DNS and internet connectivity from worker container:**
   ```bash
   docker compose -f docker-compose.prod.yml exec worker python -c \
     "import socket; print(socket.gethostbyname('google.com'))"
   ```
4. **If worker threads are stuck:** Restart the worker container:
   ```bash
   docker compose -f docker-compose.prod.yml restart worker
   ```
   *Note: The `stale-scan-watchdog` automatically marks any orphaned scans as `failed` within 15 minutes and refunds quotas.*

### Playbook B: Database Connection Exhaustion
1. **Inspect active PostgreSQL connections by state and query age:**
   ```bash
   docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d scanly -c \
     "SELECT pid, state, age(clock_timestamp(), query_start), query \
      FROM pg_stat_activity \
      WHERE state != 'idle' \
      ORDER BY query_start ASC LIMIT 10;"
   ```
2. **If connection pool is saturated:**
   - *Do NOT terminate normal idle pool connections directly with `pg_terminate_backend`* (as this drops client-side SQLAlchemy pool sockets and causes application reset errors).
   - Terminate stuck long-running *active* or *idle-in-transaction* queries exceeding 5 minutes:
     ```bash
     docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d scanly -c \
       "SELECT pg_terminate_backend(pid) FROM pg_stat_activity \
        WHERE state IN ('active', 'idle in transaction') \
          AND age(clock_timestamp(), query_start) > INTERVAL '5 minutes' \
          AND pid != pg_backend_pid();"
     ```
   - If the API asyncpg pool has leaked connections or becomes unresponsive, cleanly restart the API container to re-initialize connection pools:
     ```bash
     docker compose -f docker-compose.prod.yml restart api
     ```
   - Confirm `pool_pre_ping=True` and `pool_recycle=1800` are configured in `app/db/session.py`.

### Playbook C: Blocking an Abusive User or Target Domain
1. **Disable an abusive user account immediately:**
   ```bash
   docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d scanly -c \
     "UPDATE users SET is_active = false WHERE email = 'abusive_user@example.com';"
   ```
   *Result: User's tokens are immediately blocked across all endpoints with HTTP 403 `ACCOUNT_DISABLED`.*
2. **Block an abusive IP at Nginx:**
   Add IP to `/etc/nginx/conf.d/blocklist.conf`:
   ```nginx
   deny 203.0.113.50;
   ```
   Reload Nginx: `docker compose -f docker-compose.prod.yml exec nginx nginx -s reload`.

---

## 3. ALERT THRESHOLDS & MONITORING MATRIX

| Alert Signal | Warning Threshold | Critical Threshold | Automated Action | Operator Action |
|---|---|---|---|---|
| **Host Disk Utilization** | > 80% | > 90% | Log warning | Prune old Docker images (`docker image prune -a`) |
| **Container Restarts** | >= 2 in 10 mins | >= 5 in 10 mins | Healthcheck warning | Inspect container exit logs (`docker inspect`) |
| **Celery Queue Depth** | > 50 tasks | > 150 tasks | Telemetry alert | Check worker CPU; scale workers if needed |
| **Scan Failure Rate** | > 10% over 1 hour | > 25% over 1 hour | Watchdog compensations | Test outbound DNS & target reachability |
| **Daily Backup Failure**| No dump in 24h | Backup script non-zero | Sentry/Log error | Execute manual backup immediately |
| **TLS Expiry Window** | < 30 days | < 7 days | Certbot renewal | Renew certificate or update Cloudflare Origin cert |
