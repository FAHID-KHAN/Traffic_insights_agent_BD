# Deployment Plan — Traffic Insight BD

> Step-by-step guide to deploy the application to a real server with a real domain.

---

## Table of Contents

1. [Choose a Hosting Provider](#1-choose-a-hosting-provider)
2. [Provision the Server](#2-provision-the-server)
3. [Point Your Domain](#3-point-your-domain)
4. [Server Setup](#4-server-setup)
5. [Clone & Configure](#5-clone--configure)
6. [Add Nginx Reverse Proxy + SSL](#6-add-nginx-reverse-proxy--ssl)
7. [Deploy with Docker](#7-deploy-with-docker)
8. [Verify Everything Works](#8-verify-everything-works)
9. [Set Up Automatic DB Backups](#9-set-up-automatic-db-backups)
10. [CI/CD — Auto-Deploy on Push](#10-cicd--auto-deploy-on-push)
11. [Monitoring & Maintenance](#11-monitoring--maintenance)
12. [Cost Estimate](#12-cost-estimate)

---

## 1. Choose a Hosting Provider

Any VPS provider works. Recommended options:

| Provider | Cheapest Plan | Notes |
|----------|-------------|-------|
| **DigitalOcean** | $6/mo (1 vCPU, 1 GB RAM) | Simple, great docs, free $200 credit for students |
| **Hetzner** | €4.51/mo (2 vCPU, 2 GB RAM) | Best value, EU/US datacenters |
| **AWS Lightsail** | $5/mo (1 vCPU, 1 GB RAM) | Easy AWS entry point |
| **Vultr** | $6/mo (1 vCPU, 1 GB RAM) | 30+ datacenter locations |
| **Railway** | Free tier / $5/mo | Zero-config Docker deploy (no server admin) |

**Minimum requirements:** 1 vCPU, 1 GB RAM, 20 GB SSD, Ubuntu 22.04+

> **Student tip:** DigitalOcean gives $200 free credit via GitHub Student Developer Pack. Hetzner is the best bang-for-buck overall.

---

## 2. Provision the Server

### DigitalOcean (example)

1. Create a Droplet:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic $6/mo (1 vCPU, 1 GB RAM, 25 GB SSD)
   - **Region:** Singapore (closest to Bangladesh) or any preferred
   - **Authentication:** SSH key (recommended) or password

2. Note your server's **public IP address** (e.g. `188.166.xxx.xxx`)

3. SSH in:
   ```bash
   ssh root@188.166.xxx.xxx
   ```

---

## 3. Point Your Domain

### Option A — Buy a domain (~$10/year)

Providers: Namecheap, Cloudflare, Google Domains, GoDaddy

1. Buy a domain (e.g. `trafficinsight.bd` or `trafficinsight-bd.com`)
2. Go to DNS settings and add:

   | Type | Name | Value | TTL |
   |------|------|-------|-----|
   | A | `@` | `188.166.xxx.xxx` | 300 |
   | A | `www` | `188.166.xxx.xxx` | 300 |

3. Wait 5–30 minutes for DNS propagation

### Option B — Free subdomain (for testing)

Use a free DNS service like [DuckDNS](https://www.duckdns.org) or [nip.io](https://nip.io):

```bash
# nip.io gives you instant DNS — no signup needed
# Your app will be available at:
http://188.166.xxx.xxx.nip.io
```

---

## 4. Server Setup

SSH into your server and run these commands:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose (v2 — comes with Docker now)
docker compose version   # verify it's available

# Install Nginx (reverse proxy)
sudo apt install -y nginx certbot python3-certbot-nginx

# Create a non-root deploy user (optional but recommended)
adduser deploy
usermod -aG docker deploy
usermod -aG sudo deploy

# Enable firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Log out and back in (or `newgrp docker`) for Docker group to take effect.

---

## 5. Clone & Configure

```bash
# As deploy user (or root)
cd /opt
sudo git clone https://github.com/FAHID-KHAN/Traffic_insights_agent_BD.git
sudo chown -R deploy:deploy Traffic_insights_agent_BD
cd Traffic_insights_agent_BD

# Switch to the right branch
git checkout feature/analytics-and-react-migration
```

### Configure production environment

```bash
# Edit .env.production with your actual domain
nano .env.production
```

Update these values:

```dotenv
APP_ENV=production
LOG_LEVEL=WARNING
CORS_ORIGINS=https://trafficinsight-bd.com,https://www.trafficinsight-bd.com
API_HOST=0.0.0.0
API_PORT=8000
SCRAPE_INTERVAL_HOURS=6
```

---

## 6. Add Nginx Reverse Proxy + SSL

### Create Nginx config

```bash
sudo nano /etc/nginx/sites-available/trafficinsight
```

Paste:

```nginx
server {
    listen 80;
    server_name trafficinsight-bd.com www.trafficinsight-bd.com;

    # Redirect HTTP → HTTPS (will work after certbot runs)
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (for future use)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Larger uploads if needed
    client_max_body_size 10M;
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/trafficinsight /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default   # remove default page
sudo nginx -t                               # test config
sudo systemctl reload nginx
```

### Get free SSL certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d trafficinsight-bd.com -d www.trafficinsight-bd.com
```

Certbot will:
- Obtain a free TLS certificate
- Auto-configure Nginx for HTTPS
- Set up auto-renewal (runs twice daily via systemd timer)

Verify auto-renewal works:

```bash
sudo certbot renew --dry-run
```

---

## 7. Deploy with Docker

### Update docker-compose.prod.yml

Change the port mapping so Nginx can proxy to it (avoid port 80 conflict with Nginx):

```bash
cd /opt/Traffic_insights_agent_BD
```

Edit `docker-compose.prod.yml` — change ports from `"80:8000"` to `"8080:8000"`:

```yaml
    ports:
      - "8080:8000"    # Nginx proxies 80/443 → 8080 → container:8000
```

### Build and start

```bash
# Build the image and start in detached mode
docker compose -f docker-compose.prod.yml up -d --build

# Check it's running
docker ps
docker compose -f docker-compose.prod.yml logs -f
```

### Or use the Makefile

```bash
make prod         # builds and starts
make prod-logs    # check logs
make status       # see running containers
```

---

## 8. Verify Everything Works

```bash
# 1. Check container health
docker ps
# STATUS should show "(healthy)"

# 2. Test API directly
curl http://localhost:8080/api/overview

# 3. Test through Nginx
curl http://trafficinsight-bd.com/api/overview

# 4. Test HTTPS
curl https://trafficinsight-bd.com/api/overview

# 5. Open in browser
# Visit https://trafficinsight-bd.com
```

Expected: The full dashboard loads with all charts, maps, and data.

---

## 9. Set Up Automatic DB Backups

### Daily backup cron job

```bash
sudo nano /etc/cron.d/traffic-insight-backup
```

```cron
# Daily backup at 3:00 AM server time
0 3 * * * deploy cd /opt/Traffic_insights_agent_BD && docker cp traffic-insight-prod:/app/data/accidents.db /opt/Traffic_insights_agent_BD/backups/accidents_$(date +\%Y\%m\%d).db && find /opt/Traffic_insights_agent_BD/backups/ -name "*.db" -mtime +30 -delete
```

This:
- Copies the database from the container daily
- Deletes backups older than 30 days

### Optional — offsite backup to S3

```bash
# Install AWS CLI
sudo apt install -y awscli
aws configure   # enter your AWS credentials

# Add to the cron job (after the docker cp line):
aws s3 cp /opt/Traffic_insights_agent_BD/backups/accidents_$(date +%Y%m%d).db s3://your-bucket/backups/
```

---

## 10. CI/CD — Auto-Deploy on Push

### GitHub Actions auto-deploy

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/Traffic_insights_agent_BD
            git pull origin main
            docker compose -f docker-compose.prod.yml up -d --build
            docker image prune -f
```

### Set up GitHub Secrets

Go to **GitHub → Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `SERVER_HOST` | `188.166.xxx.xxx` |
| `SERVER_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | Contents of `~/.ssh/id_ed25519` (your deploy key) |

### Workflow

```
Developer pushes to main
        │
        ▼
GitHub Actions triggers
        │
        ├── SSH into server
        ├── git pull
        ├── docker compose up --build
        └── prune old images
        │
        ▼
New version is live (~2-3 minutes)
```

---

## 11. Monitoring & Maintenance

### Health monitoring

```bash
# Quick status check
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Resource usage
docker stats traffic-insight-prod --no-stream

# Application logs
docker compose -f docker-compose.prod.yml logs --tail=100

# Nginx access logs
sudo tail -f /var/log/nginx/access.log
```

### Free uptime monitoring

Set up a free ping monitor so you get alerted if the site goes down:

| Service | Free Tier |
|---------|-----------|
| [UptimeRobot](https://uptimerobot.com) | 50 monitors, 5-min checks |
| [Better Stack](https://betterstack.com) | Unlimited monitors |
| [Cronitor](https://cronitor.io) | 5 monitors |

Configure it to ping `https://trafficinsight-bd.com/api/overview` every 5 minutes.

### Updating the application

```bash
cd /opt/Traffic_insights_agent_BD

# Pull latest code
git pull origin main

# Rebuild and restart (zero-downtime if health check passes)
docker compose -f docker-compose.prod.yml up -d --build

# Clean old images
docker image prune -f
```

### Server maintenance

```bash
# Update OS packages monthly
sudo apt update && sudo apt upgrade -y

# Check disk usage
df -h

# Check memory
free -h

# Renew SSL (automatic, but verify)
sudo certbot renew --dry-run
```

---

## 12. Cost Estimate

### Monthly recurring

| Item | Cost |
|------|------|
| VPS (DigitalOcean/Hetzner) | $5–$6/mo |
| Domain name | ~$1/mo ($10–12/year) |
| SSL certificate | **Free** (Let's Encrypt) |
| Monitoring | **Free** (UptimeRobot) |
| **Total** | **~$6–7/month** |

### One-time setup

| Item | Time |
|------|------|
| Server provisioning | 10 min |
| DNS setup | 5 min + propagation |
| Server setup (Docker, Nginx) | 20 min |
| Clone, configure, deploy | 10 min |
| SSL setup | 5 min |
| CI/CD pipeline | 15 min |
| **Total** | **~1 hour** |

---

## Quick Reference — Full Deploy in 10 Commands

Once you have a VPS with Docker and a domain pointed at it:

```bash
# 1. SSH in
ssh deploy@your-server-ip

# 2. Clone
cd /opt && sudo git clone https://github.com/FAHID-KHAN/Traffic_insights_agent_BD.git && cd Traffic_insights_agent_BD

# 3. Configure
nano .env.production   # set CORS_ORIGINS to your domain

# 4. Set port for Nginx proxy
sed -i 's/"80:8000"/"8080:8000"/' docker-compose.prod.yml

# 5. Build & start
docker compose -f docker-compose.prod.yml up -d --build

# 6. Set up Nginx
sudo cp /path/to/nginx-config /etc/nginx/sites-available/trafficinsight
sudo ln -s /etc/nginx/sites-available/trafficinsight /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 7. Get SSL
sudo certbot --nginx -d trafficinsightbd.org -d www.trafficinsightbd.org

# 8. Verify
curl https://trafficinsightbd.org/api/overview

# 9. Trigger first scrape
curl -X POST https://trafficinsightbd.org/api/scrape

# 10. Done — open in browser
open https://trafficinsightbd.org
```

---

*Created: February 2026*
