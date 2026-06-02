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

log "2/6 Building frontend (Vite production)..."
# Prod'da frontend servisi static nginx (build: null) oldugu icin Vite build'i
# dogrudan node imajinda calistiriyoruz; dist/ host'taki frontend/dist'e cikar.
docker run --rm -v "$PROJECT_DIR/frontend:/app" -w /app node:22-alpine \
    sh -c "npm ci && npm run build"

log "3/6 Building backend image..."
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml build backend celery_worker

if [[ "$MODE" == "--init" ]]; then
    log "4/6 Initial DB setup (init SQL + alembic stamp head + seed)..."
    docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml up -d mysql redis
    # MySQL ilk init'te baseline.sql + partition yuklemesi 10sn'den uzun surebilir;
    # sabit sleep yerine healthy olana kadar bekle.
    MYSQL_ROOT_PASSWORD="$(grep -E '^MYSQL_ROOT_PASSWORD=' .env | head -1 | cut -d= -f2-)"
    log "Waiting for MySQL to accept connections..."
    for i in $(seq 1 60); do
        if docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml exec -T mysql \
            mysqladmin ping -uroot -p"$MYSQL_ROOT_PASSWORD" --silent >/dev/null 2>&1; then
            log "MySQL ready"; break
        fi
        if [[ "$i" -eq 60 ]]; then log "ERROR: MySQL did not become ready"; exit 1; fi
        sleep 3
    done
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
# Prod'da backend portu host'a publish edilmez (sadece nginx uzerinden); health'i
# container icinden kontrol ediyoruz. Gunicorn boot icin retry.
HEALTH=""
for i in $(seq 1 20); do
    HEALTH=$(docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml exec -T backend \
        python -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=3).read().decode())" 2>/dev/null || echo "")
    echo "$HEALTH" | grep -q healthy && break
    sleep 3
done
if echo "$HEALTH" | grep -q healthy; then
    log "✓ Backend healthy: $HEALTH"
else
    log "✗ Backend not healthy: ${HEALTH:-no response}"
    docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml logs --tail=30 backend || true
    exit 1
fi

log "Cleaning cache (kpi:*)..."
docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml exec -T redis \
    redis-cli -n 0 --scan --pattern 'kpi:*' | \
    xargs -r docker compose -f docker-compose.dev.yml -f docker-compose.prod.yml exec -T redis redis-cli -n 0 DEL || true

FRONTEND_URL="$(grep -E '^FRONTEND_ORIGIN=' .env | head -1 | cut -d= -f2-)"
log "✓ Deployment complete"
log "  App: ${FRONTEND_URL:-http://<server-ip>}"
