#!/usr/bin/env bash
# Production deployment script — Ubuntu 24.04 LTS VDS.
#
# Kullanım:
#   ssh prod-vds "cd /opt/sporthink && ./scripts/deploy.sh [--init|--update]"
#
# Adımlar:
#   1. git pull (latest code)
#   2. Frontend build
#   3. Docker images build
#   4. Migration (alembic upgrade head)
#   5. Compose up -d (zero-downtime restart)
#   6. Health check
#   7. Cache temizliği
#
# `docs/overview/11` §11.6 referans.

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$PROJECT_DIR"

MODE="${1:---update}"

log() { echo "[$(date +'%H:%M:%S')] $*"; }

if [[ ! -f .env ]]; then
    log "ERROR: .env not found. Copy .env.production.example to .env first."
    exit 1
fi

log "1/6 Pulling latest code..."
git fetch --all
git pull --ff-only

log "2/6 Building frontend..."
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml run --rm \
    -v "$PROJECT_DIR/frontend:/app" -w /app frontend npm ci
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml run --rm \
    -v "$PROJECT_DIR/frontend:/app" -w /app frontend npm run build

log "3/6 Building backend image..."
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml build backend celery_worker

if [[ "$MODE" == "--init" ]]; then
    log "4/6 Initial DB setup (init SQL + alembic stamp head + seed)..."
    docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml up -d mysql redis
    sleep 10
    docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml run --rm backend \
        sh -c "alembic stamp head && python -m app.seed"
else
    log "4/6 Running migrations..."
    docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml run --rm backend \
        alembic upgrade head
fi

log "5/6 Starting services..."
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml up -d --remove-orphans

log "6/6 Waiting for health..."
sleep 5
HEALTH=$(curl -sS http://localhost:8000/health 2>/dev/null || echo "FAIL")
if echo "$HEALTH" | grep -q healthy; then
    log "✓ Backend healthy"
else
    log "✗ Backend not healthy: $HEALTH"
    exit 1
fi

log "Cleaning cache (kpi:*)..."
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml exec -T redis \
    redis-cli -n 0 --scan --pattern 'kpi:*' | \
    xargs -r docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml exec -T redis redis-cli -n 0 DEL || true

log "✓ Deployment complete"
log "  Frontend: https://${FRONTEND_DOMAIN:-dashboard.sporthink.com.tr}"
log "  Backend health: http://localhost:8000/health"
