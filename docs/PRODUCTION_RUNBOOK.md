# SITESECURA — PRODUCTION RUNBOOK & INCIDENT RESPONSE

This runbook contains verified operational procedures and step-by-step incident response playbooks for operators managing the SiteSecura production infrastructure.

---

## 1. Daily Operations & System Status

### 1.1 Check Health & Running Containers
```bash
cd /opt/sitesecura
docker compose -f docker-compose.prod.yml ps
bash scripts/healthcheck.sh
```

### 1.2 Inspect Container Logs
```bash
# View last 100 lines and follow API logs
docker compose -f docker-compose.prod.yml logs --tail=100 -f api

# View Celery worker scan execution logs
docker compose -f docker-compose.prod.yml logs --tail=100 -f worker

# View Celery Beat scheduler logs
docker compose -f docker-compose.prod.yml logs --tail=100 -f beat

# View Nginx access & error logs
docker compose -f docker-compose.prod.yml logs --tail=100 -f nginx
```

### 1.3 Service Restarts
```bash
# Restart API backend gracefully
docker compose -f docker-compose.prod.yml restart api

# Restart Celery worker daemon
docker compose -f docker-compose.prod.yml restart worker

# Restart Celery Beat scheduler (Ensure ONLY 1 instance runs)
docker compose -f docker-compose.prod.yml restart beat

# Reload Nginx without dropping client connections
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### 1.4 Celery Queue & Worker Inspection
```bash
# Ping worker
docker compose -f docker-compose.prod.yml exec worker celery -A app.tasks.celery_app.celery_app inspect ping

# View active running tasks
docker compose -f docker-compose.prod.yml exec worker celery -A app.tasks.celery_app.celery_app inspect active

# Check scheduled/registered periodic tasks
docker compose -f docker-compose.prod.yml exec worker celery -A app.tasks.celery_app.celery_app inspect registered
```

### 1.5 Database Status & Connections
```bash
# Test connection
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres -d scanly

# Check active database connections count
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d scanly -c \
    "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
```

---

## 2. Backup & Disaster Recovery Procedures

### 2.1 Trigger Immediate Manual Database Backup
```bash
bash /opt/sitesecura/scripts/backup_postgres.sh
```

### 2.2 Run Restore Test Drill (Safe isolated container verification)
```bash
bash /opt/sitesecura/scripts/test_restore.sh
```

### 2.3 Emergency Production Database Restore
> [!CAUTION]
> This overwrites the current production database. Use only during an emergency disaster recovery scenario.

```bash
# 1. Stop write-heavy application containers
docker compose -f docker-compose.prod.yml stop api worker beat

# 2. Identify the target backup
LATEST_BACKUP=$(find /var/backups/sitesecura/postgres -name "sitesecura_db_*.sql.gz" | sort -r | head -n 1)
echo "Restoring: ${LATEST_BACKUP}"

# 3. Stream backup into PostgreSQL
gzip -dc "${LATEST_BACKUP}" | docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d scanly

# 4. Restart application containers
docker compose -f docker-compose.prod.yml start api worker beat

# 5. Verify readiness
bash scripts/healthcheck.sh
```

---

## 3. Incident Response Playbooks

---

### INCIDENT 1: API DOWN (HTTP 502 / 503 / Connection Refused)

**Symptoms:** Nginx returns 502 Bad Gateway; healthcheck reports API failure.

**Action Steps:**
1. Check if the API container is running:
   ```bash
   docker compose -f docker-compose.prod.yml ps api
   ```
2. Inspect recent crash traces or exceptions in API logs:
   ```bash
   docker compose -f docker-compose.prod.yml logs --tail=100 api
   ```
3. Check PostgreSQL and Redis dependency health:
   ```bash
   docker compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres -d scanly
   docker compose -f docker-compose.prod.yml exec redis redis-cli ping
   ```
4. If the container crashed, restart it:
   ```bash
   docker compose -f docker-compose.prod.yml restart api
   ```
5. Confirm recovery:
   ```bash
   curl -i http://localhost:8000/api/v1/health
   ```

---

### INCIDENT 2: SCANS NOT RUNNING / QUEUE STALLED

**Symptoms:** Scans remain in `queued` state indefinitely.

**Action Steps:**
1. Check Celery worker status:
   ```bash
   docker compose -f docker-compose.prod.yml ps worker
   docker compose -f docker-compose.prod.yml logs --tail=100 worker
   ```
2. Ping worker from Celery CLI:
   ```bash
   docker compose -f docker-compose.prod.yml exec worker celery -A app.tasks.celery_app.celery_app inspect ping
   ```
3. Check Redis queue length in Redis CLI:
   ```bash
   docker compose -f docker-compose.prod.yml exec redis redis-cli llen celery
   ```
4. If worker is deadlocked or unresponsive:
   ```bash
   docker compose -f docker-compose.prod.yml restart worker
   ```
5. Run stale scan watchdog manually to mark expired scans as failed and refund quotas:
   ```bash
   docker compose -f docker-compose.prod.yml exec worker celery -A app.tasks.celery_app.celery_app call app.tasks.worker.recover_stale_scans_task
   ```

---

### INCIDENT 3: MONITORING NOT RUNNING

**Symptoms:** Scheduled monitoring scans are not being created every 15 minutes.

**Action Steps:**
1. Verify Celery Beat scheduler container is alive:
   ```bash
   docker compose -f docker-compose.prod.yml ps beat
   docker compose -f docker-compose.prod.yml logs --tail=100 beat
   ```
2. Confirm ONLY ONE Beat instance is running (multiple instances cause duplicated tasks).
3. If Beat exited or halted:
   ```bash
   docker compose -f docker-compose.prod.yml restart beat
   ```

---

### INCIDENT 4: DATABASE UNREACHABLE

**Symptoms:** API returns 500/503; logs show `ConnectionRefusedError` or `OperationalError`.

**Action Steps:**
1. Check PostgreSQL container logs:
   ```bash
   docker compose -f docker-compose.prod.yml logs --tail=100 postgres
   ```
2. Check disk space on the host:
   ```bash
   df -h /
   ```
   *Note: PostgreSQL shuts down immediately if the disk reaches 100%.*
3. Restart PostgreSQL if stopped:
   ```bash
   docker compose -f docker-compose.prod.yml restart postgres
   ```

---

### INCIDENT 5: DISK SPACE FULL (>85%)

**Symptoms:** Database writes fail; Docker containers stop unexpectedly.

**Action Steps:**
1. Identify disk usage breakdown:
   ```bash
   df -h /
   docker system df
   ```
2. Clean unused Docker cache:
   ```bash
   docker image prune -a --force --filter "until=72h"
   docker builder prune -a --force
   ```
3. Clean truncated container log files:
   ```bash
   sudo truncate -s 0 /var/lib/docker/containers/*/*-json.log
   ```
4. Verify old local database backups were pruned:
   ```bash
   ls -lh /var/backups/sitesecura/postgres/
   ```

---

### INCIDENT 6: SSL / CERTIFICATE EXPIRY

**Symptoms:** Browsers show `ERR_SSL_PROTOCOL_ERROR` or `SSL_ERROR_BAD_CERT_DOMAIN`.

**Action Steps:**
1. Check certificate validity on the host:
   ```bash
   openssl x509 -in /opt/sitesecura/nginx/ssl/fullchain.pem -noout -dates
   ```
2. If Cloudflare Origin Certificate expired, generate a new Origin Certificate in Cloudflare SSL/TLS dashboard and replace files.
3. Reload Nginx:
   ```bash
   docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
   ```
