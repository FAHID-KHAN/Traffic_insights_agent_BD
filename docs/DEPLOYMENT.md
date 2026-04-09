# Deployment Guide — Traffic Insight BD

> **Live URL:** https://trafficinsightbd.org  
> **Server IP:** 168.144.44.239  
> **Deployed:** 9 April 2026  
> **Last updated:** 9 April 2026

---

## Table of Contents

1. [Infrastructure Overview](#1-infrastructure-overview)
2. [Server Provisioning](#2-server-provisioning)
3. [Initial Server Setup](#3-initial-server-setup)
4. [Software Installation](#4-software-installation)
5. [GitHub Deploy Key](#5-github-deploy-key)
6. [Repository Cloning](#6-repository-cloning)
7. [Environment Configuration](#7-environment-configuration)
8. [Docker Build & Launch](#8-docker-build--launch)
9. [Nginx Reverse Proxy](#9-nginx-reverse-proxy)
10. [DNS Configuration](#10-dns-configuration)
11. [SSL/TLS with Let's Encrypt](#11-ssltls-with-lets-encrypt)
12. [Database Seeding](#12-database-seeding)
13. [CI/CD Pipeline](#13-cicd-pipeline)
14. [Networking Architecture](#14-networking-architecture)
15. [Maintenance & Operations](#15-maintenance--operations)
16. [Troubleshooting](#16-troubleshooting)
17. [Security Checklist](#17-security-checklist)
18. [Disaster Recovery](#18-disaster-recovery)

---

## 1. Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET                                 │
│                                                                 │
│   User → trafficinsightbd.org                                   │
│           │                                                     │
│           ▼                                                     │
│   ┌──────────────────┐                                          │
│   │  Namecheap DNS   │  A record → 168.144.44.239               │
│   └──────────────────┘                                          │
│           │                                                     │
│           ▼                                                     │
│   ┌──────────────────────────────────────────┐                  │
│   │  DigitalOcean Droplet (168.144.44.239)   │                  │
│   │  Ubuntu 24.04 LTS · 2GB RAM · 1 vCPU    │                  │
│   │  48GB SSD · Singapore (SGP1)             │                  │
│   │                                          │                  │
│   │  ┌────────────────────────────────────┐  │                  │
│   │  │ UFW Firewall                       │  │                  │
│   │  │ Allow: 22/tcp, 80/tcp, 443/tcp     │  │                  │
│   │  └────────────────────────────────────┘  │                  │
│   │           │                              │                  │
│   │           ▼                              │                  │
│   │  ┌────────────────────────────────────┐  │                  │
│   │  │ Nginx (port 80 → 301 → 443)       │  │                  │
│   │  │ SSL termination (Let's Encrypt)    │  │                  │
│   │  │ Gzip, API cache (60s), static 1y   │  │                  │
│   │  └────────────────────────────────────┘  │                  │
│   │           │                              │                  │
│   │           ▼ proxy_pass :8080             │                  │
│   │  ┌────────────────────────────────────┐  │                  │
│   │  │ Docker Container                   │  │                  │
│   │  │ traffic-insight-prod               │  │                  │
│   │  │ Host :8080 → Container :8000       │  │                  │
│   │  │                                    │  │                  │
│   │  │  ┌──────────────────────────────┐  │  │                  │
│   │  │  │ Uvicorn (4 workers)          │  │  │                  │
│   │  │  │ FastAPI application          │  │  │                  │
│   │  │  │ APScheduler (6h scrape)      │  │  │                  │
│   │  │  │ React SPA (static/dist/)     │  │  │                  │
│   │  │  └──────────────────────────────┘  │  │                  │
│   │  │                                    │  │                  │
│   │  │  Volume: prod-data → /app/data     │  │                  │
│   │  │  (accidents.db persists here)      │  │                  │
│   │  └────────────────────────────────────┘  │                  │
│   └──────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Versions

| Component        | Version               |
|------------------|-----------------------|
| OS               | Ubuntu 24.04.3 LTS    |
| Docker           | 29.4.0                |
| Docker Compose   | v5.1.2                |
| Nginx            | 1.24.0                |
| Certbot          | 2.9.0                 |
| Python (image)   | 3.13-slim             |
| Node (build)     | 22-alpine             |
| FastAPI          | 0.115                 |
| React            | 19                    |
| Vite             | 7.3                   |

---

## 2. Server Provisioning

### DigitalOcean Droplet Specs

- **Provider:** DigitalOcean
- **Plan:** Basic Regular ($12/mo — 2GB RAM, 1 vCPU, 48GB SSD)
- **Region:** Singapore (SGP1) — closest to Bangladesh
- **OS:** Ubuntu 24.04 LTS
- **Auth:** SSH key (RSA, added during creation)
- **Hostname:** `trafficinsightbd`

### Domain Registration

- **Registrar:** Namecheap
- **Domain:** `trafficinsightbd.org`

---

## 3. Initial Server Setup

### 3.1. Verify SSH Access

```bash
ssh root@168.144.44.239 "echo 'SSH OK' && uname -a && free -h && df -h /"
```

### 3.2. Create `deploy` User

A dedicated non-root user for running the application and deployments:

```bash
ssh root@168.144.44.239 'bash -s' << 'SETUP'
set -e

# Create user (no password — SSH key auth only)
adduser --disabled-password --gecos "" deploy

# Grant passwordless sudo
usermod -aG sudo deploy
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy

# Copy root's SSH authorized_keys to deploy user
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
SETUP
```

**Result:** User `deploy` (uid=1000) with groups: `deploy`, `sudo`, `users`, `docker`

### 3.3. Configure UFW Firewall

```bash
ssh root@168.144.44.239 'bash -s' << 'FW'
ufw allow OpenSSH     # port 22 — SSH access
ufw allow 80/tcp      # HTTP (Nginx, also for Certbot challenges)
ufw allow 443/tcp     # HTTPS (Nginx + SSL)
echo "y" | ufw enable
ufw status
FW
```

**Resulting firewall rules:**

```
To                         Action      From
--                         ------      ----
22/tcp (OpenSSH)           ALLOW IN    Anywhere
80/tcp                     ALLOW IN    Anywhere
443/tcp                    ALLOW IN    Anywhere
```

Default policy: **deny incoming**, allow outgoing.

---

## 4. Software Installation

### 4.1. Install Docker Engine + Compose Plugin

```bash
ssh root@168.144.44.239 'bash -s' << 'DOCKER'
set -e

apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) \
  signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list

# Install Docker + Compose
apt-get update -qq
apt-get install -y -qq \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

# Allow deploy user to use Docker without sudo
usermod -aG docker deploy

# Enable on boot
systemctl enable docker
systemctl start docker
DOCKER
```

### 4.2. Install Nginx + Certbot

```bash
ssh root@168.144.44.239 'bash -s' << 'WEB'
apt-get install -y -qq nginx certbot python3-certbot-nginx
systemctl enable nginx
systemctl start nginx
WEB
```

---

## 5. GitHub Deploy Key

Since the repository is **private**, we generate an SSH deploy key on the server to grant read-only access:

### 5.1. Generate Key

```bash
ssh root@168.144.44.239 'sudo -u deploy ssh-keygen \
  -t ed25519 \
  -C "deploy@trafficinsightbd.org" \
  -f /home/deploy/.ssh/id_ed25519 \
  -N ""'
```

### 5.2. Print Public Key

```bash
ssh root@168.144.44.239 'cat /home/deploy/.ssh/id_ed25519.pub'
```

Output:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKhyVKG+qUvzDob9zvS/4RtA5czfpKh4kLepmgGvMNKK deploy@trafficinsightbd.org
```

### 5.3. Add to GitHub

1. Go to: **https://github.com/FAHID-KHAN/Traffic_insights_agent_BD/settings/keys**
2. Click **"Add deploy key"**
3. Title: `trafficinsightbd-server`
4. Paste the public key
5. **Do NOT** check "Allow write access" (read-only is sufficient for pulls)
6. Click **"Add key"**

### 5.4. Test GitHub SSH

```bash
ssh root@168.144.44.239 'sudo -u deploy ssh -o StrictHostKeyChecking=accept-new -T git@github.com'
```

Expected output:
```
Hi FAHID-KHAN/Traffic_insights_agent_BD! You've successfully authenticated, but GitHub does not provide shell access.
```

---

## 6. Repository Cloning

```bash
ssh root@168.144.44.239 'bash -s' << 'CLONE'
set -e

# Create directory with deploy ownership
mkdir -p /opt/Traffic_insights_agent_BD
chown deploy:deploy /opt/Traffic_insights_agent_BD

# Clone the deployment branch
sudo -u deploy git clone \
  -b feature/full-platform-v2 \
  git@github.com:FAHID-KHAN/Traffic_insights_agent_BD.git \
  /opt/Traffic_insights_agent_BD
CLONE
```

**Repository location on server:** `/opt/Traffic_insights_agent_BD`  
**Branch:** `feature/full-platform-v2` (will switch to `main` after merge)  
**Owner:** `deploy:deploy`

---

## 7. Environment Configuration

The `.env.production` file is **not committed to git** (listed in `.gitignore`). It is created manually on the server.

### 7.1. Create `.env.production`

```bash
ssh root@168.144.44.239 'bash -s' << 'ENVFILE'
cat > /opt/Traffic_insights_agent_BD/.env.production << 'EOF'
# ─── Production Environment ─────────────────────────────────────
APP_ENV=production
LOG_LEVEL=WARNING

# Server
API_HOST=0.0.0.0
API_PORT=8000
WEB_WORKERS=4
CORS_ORIGINS=https://trafficinsightbd.org,https://www.trafficinsightbd.org

# Scraper
SCRAPE_INTERVAL_HOURS=6
REQUEST_TIMEOUT=30
REQUEST_DELAY=2
MAX_PAGES=5

# OpenAI / LLM
OPENAI_API_KEY=<your-openai-api-key-here>
OPENAI_MODEL=gpt-5.2
OPENAI_TIMEOUT_SECONDS=60
OPENAI_RETRIES=2

# Extraction guardrails
MAX_DEATHS_PER_EVENT=50
MAX_INJURIES_PER_EVENT=200
EOF

chown deploy:deploy /opt/Traffic_insights_agent_BD/.env.production
ENVFILE
```

### 7.2. Environment Variables Reference

| Variable                  | Value                    | Purpose                                           |
|---------------------------|--------------------------|---------------------------------------------------|
| `APP_ENV`                 | `production`             | Disables debug mode, /docs, /redoc                |
| `LOG_LEVEL`               | `WARNING`                | Reduces log noise                                 |
| `API_HOST`                | `0.0.0.0`               | Bind to all interfaces inside container           |
| `API_PORT`                | `8000`                   | Internal container port                           |
| `WEB_WORKERS`             | `4`                      | Uvicorn worker processes                          |
| `CORS_ORIGINS`            | `https://trafficinsightbd.org,...` | Allowed CORS origins                    |
| `SCRAPE_INTERVAL_HOURS`   | `6`                      | APScheduler runs scraper every 6 hours            |
| `REQUEST_TIMEOUT`         | `30`                     | HTTP timeout for scraper requests (seconds)       |
| `REQUEST_DELAY`           | `2`                      | Delay between scraper page requests (seconds)     |
| `MAX_PAGES`               | `5`                      | Max pages to scrape per run                       |
| `OPENAI_API_KEY`          | `sk-proj-...`            | OpenAI API key for LLM extraction                 |
| `OPENAI_MODEL`            | `gpt-5.2`               | Model used for accident data extraction           |
| `OPENAI_TIMEOUT_SECONDS`  | `60`                     | LLM request timeout                               |
| `OPENAI_RETRIES`          | `2`                      | Retry count for failed LLM calls                  |
| `MAX_DEATHS_PER_EVENT`    | `50`                     | Guardrail: reject if deaths exceed this           |
| `MAX_INJURIES_PER_EVENT`  | `200`                    | Guardrail: reject if injuries exceed this         |

---

## 8. Docker Build & Launch

### 8.1. Dockerfile Overview

The Dockerfile uses a **multi-stage build**:

```
Stage 1: frontend-build (node:22-alpine)
  ├── npm ci                  → install frontend deps
  ├── npm run build           → Vite builds React to /static/dist
  └── Output: /static/dist/

Stage 2: runtime (python:3.13-slim)
  ├── pip install             → install Python deps
  ├── COPY app/, run.py       → application code
  ├── COPY --from=frontend-build /static/dist → built frontend
  ├── HEALTHCHECK             → curl /api/overview
  └── CMD python run.py
```

**Key details:**
- Vite `outDir` is `path.resolve(__dirname, '../static/dist')` — relative to `/build` WORKDIR = `/static/dist`
- The `COPY --from=frontend-build /static/dist ./static/dist/` brings the built assets into the runtime image
- `curl` is installed in runtime for the Docker HEALTHCHECK
- `.dockerignore` excludes: `.git/`, `data/`, `tests/`, `docs/`, `node_modules/`, `.env.*`, `*.md`

### 8.2. docker-compose.prod.yml

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: traffic-insight-prod
    env_file: .env.production
    environment:
      - APP_ENV=production
      - LOG_LEVEL=WARNING
    ports:
      - "8080:8000"    # Host:Container
    volumes:
      - prod-data:/app/data   # Named volume for DB persistence
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/overview"]
      interval: 60s
      timeout: 10s
      retries: 5
      start_period: 20s

volumes:
  prod-data:
    driver: local
```

### 8.3. Build & Start

```bash
ssh root@168.144.44.239 'cd /opt/Traffic_insights_agent_BD && \
  docker compose -f docker-compose.prod.yml up -d --build'
```

### 8.4. Verify

```bash
# Check container is running and healthy
ssh root@168.144.44.239 'docker ps'

# Expected output:
# CONTAINER ID  IMAGE                          COMMAND          STATUS                    PORTS
# e8cf5e4ee026  traffic_insights_agent_bd-app   "python run.py"  Up X minutes (healthy)   0.0.0.0:8080->8000/tcp

# Test API internally
ssh root@168.144.44.239 'curl -s http://localhost:8080/api/overview'
```

### 8.5. Port Mapping

```
Internet → :443 (Nginx SSL) → proxy_pass :8080 (host) → :8000 (container)
```

### 8.6. Named Volume

The database is persisted on a Docker named volume:

```
Volume name:  traffic_insights_agent_bd_prod-data
Host path:    /var/lib/docker/volumes/traffic_insights_agent_bd_prod-data/_data
Container:    /app/data
Contents:     accidents.db, LLM logs
```

**This volume survives container rebuilds.** The database is NOT lost when you `docker compose up --build`.

---

## 9. Nginx Reverse Proxy

### 9.1. Install Configuration

The source config is at `deploy/nginx.conf` in the repo.

```bash
ssh root@168.144.44.239 'bash -s' << 'NGINX'
# Copy config
cp /opt/Traffic_insights_agent_BD/deploy/nginx.conf \
  /etc/nginx/sites-available/trafficinsightbd.org

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Enable our site
ln -sf /etc/nginx/sites-available/trafficinsightbd.org \
  /etc/nginx/sites-enabled/

# Test and reload
nginx -t && systemctl reload nginx
NGINX
```

### 9.2. Configuration Explained

**File locations:**
- Source: `/opt/Traffic_insights_agent_BD/deploy/nginx.conf`
- Active: `/etc/nginx/sites-available/trafficinsightbd.org`
- Symlink: `/etc/nginx/sites-enabled/trafficinsightbd.org`

**Upstream:**
```nginx
upstream app_backend {
    server 127.0.0.1:8080;    # Docker container's exposed port
    keepalive 16;              # Persistent connections to backend
}
```

**Gzip compression** — enabled for text, CSS, JS, JSON, SVG:
```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 5;          # Balance between CPU and compression
gzip_min_length 1000;       # Don't compress tiny responses
```

**API caching** — GET responses cached for 60 seconds:
```nginx
proxy_cache_path /tmp/nginx_api_cache
    levels=1:2
    keys_zone=api_cache:10m     # 10MB of key storage
    max_size=100m               # 100MB of cached responses
    inactive=5m                 # Evict after 5min of no access
    use_temp_path=off;

location /api/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 60s;           # Cache successful responses for 60s
    proxy_cache_methods GET HEAD;        # Only cache reads
    proxy_cache_use_stale error timeout; # Serve stale on backend failure
    proxy_cache_background_update on;    # Refresh cache in background
    proxy_cache_lock on;                 # Prevent stampede
    proxy_cache_bypass $request_method;  # POST/DELETE bypass cache
    add_header X-Cache-Status $upstream_cache_status;  # Debug header
}
```

**Static assets** — Vite hashed filenames get 1-year immutable cache:
```nginx
location /assets/ {
    proxy_pass http://app_backend;
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;               # No logging for static files
}
```

**Service worker** — short 1-hour cache with revalidation:
```nginx
location ~ ^/(sw\.js|manifest\.webmanifest|registerSW\.js) {
    expires 1h;
    add_header Cache-Control "public, must-revalidate";
}
```

**SPA catch-all** — everything else proxied to the backend (FastAPI serves React):
```nginx
location / {
    proxy_pass http://app_backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Connection "";   # Enable keepalive
}
```

**Security headers** (Nginx layer — FastAPI also adds its own):
```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
```

### 9.3. Final Nginx Config (After Certbot)

Certbot automatically modified the config to add:

```nginx
# HTTPS server block (main)
server {
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/trafficinsightbd.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/trafficinsightbd.org/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    # ... all location blocks ...
}

# HTTP → HTTPS redirect block
server {
    listen 80;
    server_name trafficinsightbd.org www.trafficinsightbd.org;
    # 301 redirects to HTTPS
    return 301 https://$host$request_uri;
}
```

---

## 10. DNS Configuration

### 10.1. Namecheap Advanced DNS Settings

Navigate to: **Namecheap → Domain List → trafficinsightbd.org → Manage → Advanced DNS**

Add these A records (remove any parking/default records first):

| Type       | Host  | Value             | TTL       |
|------------|-------|-------------------|-----------|
| A Record   | `@`   | `168.144.44.239`  | Automatic |
| A Record   | `www` | `168.144.44.239`  | Automatic |

### 10.2. Verify DNS Propagation

```bash
# Check via Google DNS
dig @8.8.8.8 trafficinsightbd.org A +short
# Expected: 168.144.44.239

dig @8.8.8.8 www.trafficinsightbd.org A +short
# Expected: 168.144.44.239
```

DNS typically propagates within 5–30 minutes for new records.

---

## 11. SSL/TLS with Let's Encrypt

### 11.1. Obtain and Install Certificate

```bash
ssh root@168.144.44.239 'certbot --nginx \
  -d trafficinsightbd.org \
  -d www.trafficinsightbd.org \
  --non-interactive \
  --agree-tos \
  --email admin@trafficinsightbd.org \
  --redirect'
```

**What this does:**
- Obtains a free SSL certificate from Let's Encrypt
- Automatically modifies the Nginx config to add SSL listener on port 443
- Adds HTTP→HTTPS redirect (301) for all HTTP traffic
- Certificate covers both `trafficinsightbd.org` and `www.trafficinsightbd.org`

### 11.2. Certificate Details

| Property          | Value                                                              |
|-------------------|--------------------------------------------------------------------|
| Certificate path  | `/etc/letsencrypt/live/trafficinsightbd.org/fullchain.pem`         |
| Private key path  | `/etc/letsencrypt/live/trafficinsightbd.org/privkey.pem`           |
| Expiry            | 90 days (auto-renews)                                              |
| Auto-renewal      | `certbot.timer` systemd timer (runs ~2x/day)                      |

### 11.3. Manual Install (if auto-install fails)

If Certbot obtains the cert but can't auto-configure Nginx (e.g., `server_name` mismatch):

```bash
# Fix server_name if needed
sed -i 's/yourdomain\.com/trafficinsightbd.org/g' \
  /etc/nginx/sites-available/trafficinsightbd.org

# Install the already-obtained certificate
certbot install --cert-name trafficinsightbd.org --nginx --redirect --non-interactive

# Reload Nginx
systemctl reload nginx
```

### 11.4. Verify SSL

```bash
curl -sI https://trafficinsightbd.org | head -5
# Expected: HTTP/1.1 200 OK (or 405 for HEAD)

curl -sI http://trafficinsightbd.org | head -5
# Expected: HTTP/1.1 301 Moved Permanently → https://
```

### 11.5. Auto-Renewal

Certbot installs a systemd timer for automatic renewal:

```bash
# Check timer status
systemctl list-timers certbot.timer

# Test renewal (dry run)
ssh root@168.144.44.239 'certbot renew --dry-run'
```

---

## 12. Database Seeding

The application starts with an empty database. To seed it with existing data from your local machine:

### 12.1. Upload Database

```bash
# From your local machine:
scp data/accidents.db root@168.144.44.239:/tmp/accidents.db
```

### 12.2. Inject into Container

```bash
ssh root@168.144.44.239 'bash -s' << 'SEED'
# Copy database into the running container's data directory
docker cp /tmp/accidents.db traffic-insight-prod:/app/data/accidents.db

# Clean up temp file
rm /tmp/accidents.db

# Restart container so the app picks up the new database
docker restart traffic-insight-prod
SEED
```

### 12.3. Verify

```bash
ssh root@168.144.44.239 'sleep 10 && curl -s http://localhost:8080/api/overview'
```

Expected: Non-zero `total_accidents`, `total_deaths`, `total_articles` values.

> **Note:** The database file lives inside the Docker named volume
> (`traffic_insights_agent_bd_prod-data`). It persists across container
> rebuilds. You only need to seed once — the scheduler auto-scrapes new
> articles every 6 hours after that.

---

## 13. CI/CD Pipeline

### 13.1. Pipeline Flow

```
┌──────────────┐     ┌────────────┐     ┌────────────────────┐
│ Push to any  │────▶│ CI (ci.yml)│────▶│ Backend tests       │
│ branch       │     │            │     │ Python 3.11/3.12/13 │
│              │     │            │     │ flake8 lint          │
│              │     │            │     │ pytest               │
│              │     │            │     │ Import verification  │
│              │     │            │     ├────────────────────  │
│              │     │            │     │ Frontend checks      │
│              │     │            │     │ npm ci + lint        │
└──────────────┘     └────────────┘     └────────┬───────────┘
                                                  │
                           On main branch CI pass │
                                                  ▼
                     ┌──────────────────────────────────────┐
                     │ Deploy (deploy.yml)                   │
                     │ SSH into 168.144.44.239 as deploy     │
                     │ 1. git pull origin main               │
                     │ 2. docker compose up -d --build       │
                     │ 3. Health check (30 attempts × 2s)    │
                     │ 4. docker image prune -f              │
                     └──────────────────────────────────────┘
```

### 13.2. CI Workflow (`.github/workflows/ci.yml`)

**Triggers:** Every push to any branch, PRs to main (ignores `*.md`, `docs/`, `LICENSE`)

**Backend job** (matrix: Python 3.11, 3.12, 3.13):
1. Install Python deps + flake8/pytest
2. Lint with flake8 (fatal errors + style warnings)
3. Verify all imports resolve: `python -c "from app.server import create_app"`
4. Run `pytest tests/ -v`

**Frontend job** (Node 22):
1. `npm ci`
2. `npm run lint`

### 13.3. Deploy Workflow (`.github/workflows/deploy.yml`)

**Trigger:** Automatically when CI passes on `main` branch (via `workflow_run`)

**What it does:**
```bash
cd /opt/Traffic_insights_agent_BD
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
# Health check loop (30 × 2s = 60s max)
docker image prune -f
```

### 13.4. Required GitHub Secrets

Set these at: **https://github.com/FAHID-KHAN/Traffic_insights_agent_BD/settings/secrets/actions**

| Secret             | Value                                      |
|--------------------|--------------------------------------------|
| `SERVER_HOST`      | `168.144.44.239`                           |
| `SERVER_USER`      | `deploy`                                   |
| `SSH_PRIVATE_KEY`  | Contents of your SSH private key            |

**To generate the SSH key for CI/CD:**

```bash
# On your local machine (or generate a dedicated CI key)
ssh-keygen -t ed25519 -C "github-actions@trafficinsightbd.org" -f ~/.ssh/deploy_ci -N ""

# Add the PUBLIC key to the server
ssh-copy-id -i ~/.ssh/deploy_ci.pub deploy@168.144.44.239

# Copy the PRIVATE key content into the SSH_PRIVATE_KEY GitHub secret
cat ~/.ssh/deploy_ci
```

### 13.5. Deployment Workflow (Manual)

Until GitHub Secrets are configured, deploy manually:

```bash
# SSH into server
ssh deploy@168.144.44.239

# Pull latest code
cd /opt/Traffic_insights_agent_BD
git pull

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# Verify
docker ps
curl -s http://localhost:8080/api/overview | python3 -m json.tool
```

---

## 14. Networking Architecture

### 14.1. Port Map

| Port  | Service       | Accessible From    | Purpose                            |
|-------|---------------|--------------------|------------------------------------|
| 22    | SSH (OpenSSH) | Internet (UFW)     | Server administration              |
| 80    | Nginx         | Internet (UFW)     | HTTP → 301 redirect to HTTPS       |
| 443   | Nginx (SSL)   | Internet (UFW)     | HTTPS entry point                  |
| 8080  | Docker host   | localhost only      | Nginx → Docker container bridge    |
| 8000  | Uvicorn       | Container internal  | FastAPI application                |

### 14.2. Request Flow (Detailed)

```
Client Request: https://trafficinsightbd.org/api/overview
         │
         ▼
    DNS Resolution
    trafficinsightbd.org → 168.144.44.239
         │
         ▼
    UFW Firewall (port 443 ALLOW)
         │
         ▼
    Nginx (:443 SSL)
    ├── SSL termination (Let's Encrypt cert)
    ├── Gzip compression check
    ├── Location match: /api/
    │   ├── Check proxy_cache (api_cache)
    │   │   ├── HIT → serve cached response (add X-Cache-Status: HIT)
    │   │   └── MISS → proxy to upstream
    │   ├── Set headers: X-Real-IP, X-Forwarded-For, X-Forwarded-Proto
    │   └── proxy_pass http://app_backend (127.0.0.1:8080)
         │
         ▼
    Docker port mapping (8080 → 8000)
         │
         ▼
    Uvicorn worker (1 of 4)
    ├── SecurityHeadersMiddleware (HSTS, CSP, X-Frame-Options)
    ├── CORSMiddleware
    └── FastAPI route handler → query SQLite → return JSON
```

### 14.3. Security Headers (Two Layers)

**Nginx layer:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

**FastAPI SecurityHeadersMiddleware (all responses):**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (production only)
- `Content-Security-Policy:` restricts scripts to `'self'`, images to self + OSM tiles, frames to YouTube only

### 14.4. CORS Policy

```python
CORS_ORIGINS = "https://trafficinsightbd.org,https://www.trafficinsightbd.org"
```

Only these origins are allowed to make cross-origin API requests.

---

## 15. Maintenance & Operations

### 15.1. Common Commands

```bash
# SSH into server
ssh deploy@168.144.44.239

# All commands below run on the server
cd /opt/Traffic_insights_agent_BD
```

**Container management:**
```bash
# View running containers
docker ps

# View container logs (last 100 lines)
docker logs traffic-insight-prod --tail 100

# Follow logs in real-time
docker logs traffic-insight-prod -f

# Restart container
docker restart traffic-insight-prod

# Stop container
docker compose -f docker-compose.prod.yml down

# Start container
docker compose -f docker-compose.prod.yml up -d

# Rebuild and restart (after code changes)
docker compose -f docker-compose.prod.yml up -d --build

# View container resource usage
docker stats traffic-insight-prod --no-stream
```

**Database operations:**
```bash
# Backup database from container
docker cp traffic-insight-prod:/app/data/accidents.db /tmp/accidents_backup.db
scp root@168.144.44.239:/tmp/accidents_backup.db ./backup_$(date +%Y%m%d).db

# Restore database to container
scp ./accidents.db root@168.144.44.239:/tmp/accidents.db
ssh root@168.144.44.239 'docker cp /tmp/accidents.db traffic-insight-prod:/app/data/accidents.db && docker restart traffic-insight-prod'

# Access database directly (read-only inspection)
ssh root@168.144.44.239 'docker exec traffic-insight-prod python -c "
import sqlite3
conn = sqlite3.connect(\"/app/data/accidents.db\")
c = conn.cursor()
c.execute(\"SELECT COUNT(*) FROM accidents\")
print(f\"Accidents: {c.fetchone()[0]}\")
c.execute(\"SELECT COUNT(*) FROM articles\")
print(f\"Articles: {c.fetchone()[0]}\")
conn.close()
"'
```

**Manual scrape trigger:**
```bash
# Trigger a scrape cycle
ssh root@168.144.44.239 'curl -X POST http://localhost:8080/api/scrape'
```

**Nginx:**
```bash
# Test config syntax
sudo nginx -t

# Reload config (no downtime)
sudo systemctl reload nginx

# View Nginx error log
sudo tail -50 /var/log/nginx/error.log

# View Nginx access log
sudo tail -50 /var/log/nginx/access.log
```

**SSL:**
```bash
# Check certificate expiry
sudo certbot certificates

# Force renewal
sudo certbot renew

# Test renewal (dry run)
sudo certbot renew --dry-run
```

**System:**
```bash
# Disk usage
df -h /
du -sh /var/lib/docker/

# Memory usage
free -h

# Check if swap is needed (if OOM issues occur)
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 15.2. Update Deployment (Manual)

```bash
ssh deploy@168.144.44.239
cd /opt/Traffic_insights_agent_BD

# Pull latest
git pull

# Rebuild (the database is on a named volume — it won't be lost)
docker compose -f docker-compose.prod.yml up -d --build

# Verify
docker ps
curl -s http://localhost:8080/api/overview | python3 -m json.tool

# Clean up old images
docker image prune -f
```

### 15.3. Updating Environment Variables

```bash
ssh deploy@168.144.44.239

# Edit the env file
nano /opt/Traffic_insights_agent_BD/.env.production

# Restart container to pick up changes
cd /opt/Traffic_insights_agent_BD
docker compose -f docker-compose.prod.yml up -d
```

### 15.4. Updating Nginx Config

```bash
ssh root@168.144.44.239

# Edit config
nano /etc/nginx/sites-available/trafficinsightbd.org

# Test syntax
nginx -t

# Reload (graceful, no downtime)
systemctl reload nginx
```

### 15.5. Server Updates

```bash
ssh root@168.144.44.239

# System packages
apt update && apt upgrade -y

# Docker images (rebuild pulls fresh base images)
cd /opt/Traffic_insights_agent_BD
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
docker image prune -f
```

---

## 16. Troubleshooting

### Container won't start

```bash
# Check container status
docker ps -a

# Check logs for errors
docker logs traffic-insight-prod --tail 50

# Common causes:
# - .env.production missing or malformed
# - Port 8080 already in use: lsof -i :8080
# - Docker volume permissions
```

### API returns 502 Bad Gateway

```bash
# Is the container running?
docker ps

# Is the container healthy?
docker inspect traffic-insight-prod --format='{{.State.Health.Status}}'

# Can Nginx reach the container?
curl -s http://localhost:8080/api/overview

# Check Nginx error log
tail -20 /var/log/nginx/error.log
```

### SSL certificate expired

```bash
# Check certificate status
certbot certificates

# Force renewal
certbot renew --force-renewal

# Reload Nginx after renewal
systemctl reload nginx
```

### Database is empty after rebuild

The database lives on a named volume and survives rebuilds. If it's empty:

```bash
# Check volume exists
docker volume ls | grep prod-data

# Check volume contents
docker exec traffic-insight-prod ls -la /app/data/

# If volume was accidentally removed, re-seed from backup
docker cp /path/to/backup/accidents.db traffic-insight-prod:/app/data/accidents.db
docker restart traffic-insight-prod
```

### High memory usage

```bash
# Check container memory
docker stats traffic-insight-prod --no-stream

# Reduce workers if needed (edit .env.production)
WEB_WORKERS=2

# Add swap if no swap exists
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
```

### Scraper not running

```bash
# Check scheduler logs
docker logs traffic-insight-prod 2>&1 | grep -i "scheduler\|scrape"

# Trigger manual scrape
curl -X POST http://localhost:8080/api/scrape

# Check last scrape status via API
curl -s http://localhost:8080/api/overview | python3 -m json.tool | grep scrape
```

---

## 17. Security Checklist

| Item                               | Status | Notes                                            |
|------------------------------------|--------|--------------------------------------------------|
| SSH key auth only (no passwords)   | ✅     | `deploy` user, no password set                   |
| UFW firewall active                | ✅     | Only 22, 80, 443 allowed                         |
| Non-root application user          | ✅     | `deploy` user runs Docker                        |
| HTTPS enforced                     | ✅     | HTTP 301 → HTTPS                                 |
| HSTS header                        | ✅     | `max-age=63072000; includeSubDomains; preload`   |
| CSP header                         | ✅     | Restricts scripts, images, frames                |
| X-Frame-Options: DENY              | ✅     | Prevents clickjacking                            |
| X-Content-Type-Options: nosniff    | ✅     | Prevents MIME sniffing                           |
| CORS restricted                    | ✅     | Only trafficinsightbd.org origins                |
| API docs disabled in production    | ✅     | `/docs` and `/redoc` return 404                  |
| Secrets not in git                 | ✅     | `.env.production` is gitignored                  |
| Deploy key is read-only            | ✅     | No write access to repo                          |
| SSL auto-renewal                   | ✅     | Certbot timer runs 2x/day                        |
| LLM output validation              | ✅     | Pydantic schema + casualty caps                  |
| Docker restart policy              | ✅     | `restart: always` — survives reboots             |

---

## 18. Disaster Recovery

### 18.1. Full Server Loss

If the droplet is destroyed, recreate from scratch:

1. Create new DigitalOcean droplet (same specs)
2. Follow this guide from [Section 3](#3-initial-server-setup) onwards
3. Update DNS A records to new IP
4. Re-seed database from local backup
5. Update `SERVER_HOST` in GitHub Secrets

### 18.2. Database Backup Schedule

Set up a cron job for automated backups:

```bash
ssh root@168.144.44.239 'bash -s' << 'CRON'
mkdir -p /opt/backups

cat > /opt/backup-db.sh << 'SCRIPT'
#!/bin/bash
BACKUP_DIR=/opt/backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker cp traffic-insight-prod:/app/data/accidents.db "$BACKUP_DIR/accidents_$TIMESTAMP.db"
# Keep only last 7 backups
ls -t "$BACKUP_DIR"/accidents_*.db | tail -n +8 | xargs rm -f 2>/dev/null
SCRIPT

chmod +x /opt/backup-db.sh

# Run daily at 3 AM UTC
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/backup-db.sh") | crontab -
CRON
```

### 18.3. Download Backup to Local

```bash
# Latest backup
scp root@168.144.44.239:/opt/backups/$(ssh root@168.144.44.239 'ls -t /opt/backups/ | head -1') ./

# Or directly from container
ssh root@168.144.44.239 'docker cp traffic-insight-prod:/app/data/accidents.db /tmp/accidents.db'
scp root@168.144.44.239:/tmp/accidents.db ./accidents_backup_$(date +%Y%m%d).db
```

---

## Quick Reference Card

```
═══════════════════════════════════════════════════════════════
  TRAFFIC INSIGHT BD — PRODUCTION QUICK REFERENCE
═══════════════════════════════════════════════════════════════

  URL:        https://trafficinsightbd.org
  Server:     168.144.44.239 (DigitalOcean SGP1)
  SSH:        ssh deploy@168.144.44.239
  Repo:       /opt/Traffic_insights_agent_BD
  Branch:     feature/full-platform-v2 (→ main after merge)
  Container:  traffic-insight-prod

  ── Deploy ──────────────────────────────────────────────────
  git pull && docker compose -f docker-compose.prod.yml up -d --build

  ── Logs ────────────────────────────────────────────────────
  docker logs traffic-insight-prod -f --tail 100

  ── Restart ─────────────────────────────────────────────────
  docker restart traffic-insight-prod

  ── Backup DB ───────────────────────────────────────────────
  docker cp traffic-insight-prod:/app/data/accidents.db ./backup.db

  ── Trigger Scrape ──────────────────────────────────────────
  curl -X POST http://localhost:8080/api/scrape

  ── SSL Renew ───────────────────────────────────────────────
  certbot renew && systemctl reload nginx

  ── Health Check ────────────────────────────────────────────
  curl -s http://localhost:8080/api/overview | python3 -m json.tool
═══════════════════════════════════════════════════════════════
```
