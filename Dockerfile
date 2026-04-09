# ───────────────────────────────────────────────────────────────
# Dockerfile — Multi-stage build for Traffic Insight BD
# ───────────────────────────────────────────────────────────────

# ── Stage 1: Build React frontend ──────────────────────────────
FROM node:22-alpine AS frontend-build

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit

COPY frontend/ ./

# Vite outputs to ../static/dist relative to frontend/
RUN mkdir -p /out/static && npm run build


# ── Stage 2: Python runtime ───────────────────────────────────
FROM python:3.13-slim AS runtime

LABEL maintainer="Traffic Insight BD"
LABEL description="Bangladesh Road Accident Analytics Platform"

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY app/ ./app/
COPY run.py .

# Copy built frontend from stage 1
COPY --from=frontend-build /out/static/dist ./static/dist/

# Create data directory
RUN mkdir -p /app/data

# Defaults (overridable via docker-compose or env)
ENV APP_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=8000 \
    LOG_LEVEL=WARNING \
    PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/overview || exit 1

CMD ["python", "run.py"]
