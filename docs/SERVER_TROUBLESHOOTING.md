# Server Troubleshooting & Operations Guide

> **Server:** `168.144.44.239` (Ubuntu 24.04)  
> **SSH:** `ssh root@168.144.44.239`  
> **App path:** `/opt/Traffic_insights_agent_BD`  
> **Container:** `traffic-insight-prod`  
> **Port mapping:** `8080 → 8000` (Nginx proxies `80/443 → 8080`)

---

## Quick Health Check

```bash
# Container status
ssh root@168.144.44.239 "docker ps --filter name=traffic-insight-prod"

# API health
ssh root@168.144.44.239 "curl -sf http://localhost:8080/api/overview | head -c 200"

# Container logs (last 50 lines)
ssh root@168.144.44.239 "docker logs --tail 50 traffic-insight-prod"

# Follow logs live
ssh root@168.144.44.239 "docker logs -f traffic-insight-prod"
```

---

## Database Inspection

```bash
# Article and accident counts
ssh root@168.144.44.239 'docker exec traffic-insight-prod python -c "
import sqlite3
conn = sqlite3.connect(\"/app/data/accidents.db\")
arts = conn.execute(\"SELECT COUNT(*) FROM articles\").fetchone()[0]
accs = conn.execute(\"SELECT COUNT(*) FROM accidents\").fetchone()[0]
print(f\"Articles: {arts}\")
print(f\"Accidents: {accs}\")
conn.close()
"'

# Latest 10 articles
ssh root@168.144.44.239 'docker exec traffic-insight-prod python -c "
import sqlite3
conn = sqlite3.connect(\"/app/data/accidents.db\")
for r in conn.execute(\"SELECT id, published_date, title FROM articles ORDER BY id DESC LIMIT 10\"):
    print(f\"  [{r[0]}] {r[1]} — {r[2][:80]}\")
conn.close()
"'

# Latest 10 accidents
ssh root@168.144.44.239 'docker exec traffic-insight-prod python -c "
import sqlite3
conn = sqlite3.connect(\"/app/data/accidents.db\")
for r in conn.execute(\"SELECT id, accident_date, district, killed, injured FROM accidents ORDER BY id DESC LIMIT 10\"):
    print(f\"  [{r[0]}] {r[1]} | {r[2]} | killed={r[3]} injured={r[4]}\")
conn.close()
"'

# Check DB is writable (important after docker cp)
ssh root@168.144.44.239 'docker exec traffic-insight-prod python -c "
import sqlite3
conn = sqlite3.connect(\"/app/data/accidents.db\")
try:
    conn.execute(\"PRAGMA journal_mode=wal\")
    print(\"DB is writable\")
except Exception as e:
    print(f\"DB is READ-ONLY: {e}\")
conn.close()
"'
```

---

## Scrape Logs

```bash
# Last 10 scrape runs
ssh root@168.144.44.239 'docker exec traffic-insight-prod python -c "
import sqlite3
conn = sqlite3.connect(\"/app/data/accidents.db\")
print(\"ID | Started | Finished | Found | New | Status\")
print(\"-\" * 70)
for r in conn.execute(\"SELECT id, started_at, finished_at, articles_found, articles_new, status FROM scrape_logs ORDER BY id DESC LIMIT 10\"):
    print(f\"{r[0]:>3} | {r[1]} | {r[2]} | {r[3]:>5} | {r[4]:>3} | {r[5]}\")
conn.close()
"'

# Trigger a manual scrape
ADMIN_KEY="your-admin-key-here"
ssh root@168.144.44.239 "curl -s -X POST http://localhost:8080/api/scrape -H 'x-admin-key: $ADMIN_KEY'"
```

---

## Container Management

```bash
# Restart container
ssh root@168.144.44.239 "docker restart traffic-insight-prod"

# Rebuild and restart (after code changes)
ssh root@168.144.44.239 "cd /opt/Traffic_insights_agent_BD && docker compose -f docker-compose.prod.yml up -d --build"

# Shell into container
ssh root@168.144.44.239 "docker exec -it traffic-insight-prod sh"

# Check who the process is running as
ssh root@168.144.44.239 "docker exec traffic-insight-prod whoami"

# Check /app/data permissions
ssh root@168.144.44.239 "docker exec traffic-insight-prod ls -la /app/data/"

# View environment variables (redacted)
ssh root@168.144.44.239 "docker exec traffic-insight-prod env | grep -v KEY | sort"
```

---

## Database Backup & Replace

```bash
# Backup production DB to server /tmp
ssh root@168.144.44.239 'docker exec traffic-insight-prod cp /app/data/accidents.db /tmp/accidents_backup_$(date +%Y%m%d_%H%M%S).db'

# Copy DB from server to local machine
scp root@168.144.44.239:/tmp/accidents_backup_*.db ./data/

# Copy local DB to production container
scp ./data/accidents.db root@168.144.44.239:/tmp/accidents_upload.db
ssh root@168.144.44.239 "docker cp /tmp/accidents_upload.db traffic-insight-prod:/app/data/accidents.db"

# IMPORTANT: Fix ownership after docker cp (entrypoint.sh handles this on restart)
ssh root@168.144.44.239 "docker restart traffic-insight-prod"
```

---

## Logs & Debugging

```bash
# Application logs
ssh root@168.144.44.239 "docker logs --tail 100 traffic-insight-prod"

# LLM extraction logs (if they exist in the container)
ssh root@168.144.44.239 "docker exec traffic-insight-prod cat /app/data/llm_extraction_responses.log 2>/dev/null | tail -20"
ssh root@168.144.44.239 "docker exec traffic-insight-prod cat /app/data/llm_extraction_failures.log 2>/dev/null | tail -20"
ssh root@168.144.44.239 "docker exec traffic-insight-prod cat /app/data/non_incident_report.log 2>/dev/null | tail -20"

# Nginx logs
ssh root@168.144.44.239 "tail -30 /var/log/nginx/access.log"
ssh root@168.144.44.239 "tail -30 /var/log/nginx/error.log"
```

---

## Docker Volume & Disk

```bash
# Check disk usage
ssh root@168.144.44.239 "df -h / && echo '---' && du -sh /opt/Traffic_insights_agent_BD"

# Docker disk usage
ssh root@168.144.44.239 "docker system df"

# List volumes
ssh root@168.144.44.239 "docker volume ls"

# Inspect the data volume
ssh root@168.144.44.239 "docker volume inspect traffic_insights_agent_bd_prod-data"

# Prune old images (saves disk)
ssh root@168.144.44.239 "docker image prune -f"
```

---

## Git & Deployment

```bash
# Check what's deployed
ssh root@168.144.44.239 "cd /opt/Traffic_insights_agent_BD && git log --oneline -5"

# Check current branch
ssh root@168.144.44.239 "cd /opt/Traffic_insights_agent_BD && git branch"

# Check .env.production (redacted)
ssh root@168.144.44.239 "cd /opt/Traffic_insights_agent_BD && cat .env.production | grep -v KEY"

# Manual deploy (same as what CI/CD does)
ssh root@168.144.44.239 "cd /opt/Traffic_insights_agent_BD && git pull origin main && docker compose -f docker-compose.prod.yml up -d --build"
```

---

## Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| `attempt to write a readonly database` | DB owned by root after `docker cp` | `docker restart` (entrypoint fixes it) |
| `Admin endpoints not configured` (503) | `ADMIN_API_KEY` empty in `.env.production` | Set the key in `.env.production`, rebuild |
| Scrape returns 0 new articles | All articles already in DB (URLs are unique) | Normal — means no new content |
| Container unhealthy | App crashed or port mismatch | Check `docker logs`, restart |
| UNIQUE constraint on `scrape_logs` | Concurrent scheduler + manual scrape | Transient — safe to ignore |
| LLM extraction not running | `OPENAI_API_KEY` empty | Falls back to regex extractor — set key if LLM needed |
