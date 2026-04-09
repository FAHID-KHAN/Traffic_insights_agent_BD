# ───────────────────────────────────────────────────────────────
# Makefile — Traffic Insight BD
# Quick commands for development and deployment
# ───────────────────────────────────────────────────────────────

.PHONY: help dev prod stop logs clean build test

# ── Default ────────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m  %-15s\033[0m %s\n", $$1, $$2}'

# ── Local Development (no Docker) ─────────────────────────────
install: ## Install Python + Node dependencies
	pip install -r requirements.txt
	cd frontend && npm install

build-frontend: ## Build React frontend
	cd frontend && npm run build

run-local: ## Run locally (dev mode, hot-reload)
	APP_ENV=development python run.py

# ── Docker — Development ──────────────────────────────────────
dev: ## Start dev container (port 8000)
	docker compose -f docker-compose.dev.yml up --build

dev-d: ## Start dev container (detached)
	docker compose -f docker-compose.dev.yml up --build -d

dev-stop: ## Stop dev container
	docker compose -f docker-compose.dev.yml down

dev-logs: ## Tail dev container logs
	docker compose -f docker-compose.dev.yml logs -f

# ── Docker — Production ───────────────────────────────────────
prod: ## Start prod container (port 80, detached)
	docker compose -f docker-compose.prod.yml up --build -d

prod-stop: ## Stop prod container
	docker compose -f docker-compose.prod.yml down

prod-logs: ## Tail prod container logs
	docker compose -f docker-compose.prod.yml logs -f

prod-restart: ## Restart prod container
	docker compose -f docker-compose.prod.yml restart

# ── Utilities ─────────────────────────────────────────────────
clean: ## Remove containers, volumes, and build artifacts
	docker compose -f docker-compose.dev.yml down -v 2>/dev/null || true
	docker compose -f docker-compose.prod.yml down -v 2>/dev/null || true
	rm -rf static/dist frontend/node_modules __pycache__

status: ## Show running containers
	docker ps --filter "name=traffic-insight"

shell-dev: ## Open shell in dev container
	docker exec -it traffic-insight-dev /bin/sh

shell-prod: ## Open shell in prod container
	docker exec -it traffic-insight-prod /bin/sh

db-backup: ## Backup production database
	@mkdir -p backups
	docker cp traffic-insight-prod:/app/data/accidents.db backups/accidents_$$(date +%Y%m%d_%H%M%S).db
	@echo "Backup saved to backups/"
