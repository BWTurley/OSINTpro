#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "============================================"
echo "  OSINT Dashboard — First-Time Setup"
echo "============================================"
echo ""

# ---- 1. Copy .env ----
if [ ! -f .env ]; then
  echo "[Setup] Creating .env from .env.example..."
  cp .env.example .env
  echo "[Setup] IMPORTANT: Edit .env and fill in your secrets before going to production."
else
  echo "[Setup] .env already exists — skipping."
fi

# ---- 2. Install npm dependencies ----
echo ""
echo "[Setup] Installing npm dependencies..."
npm install

# ---- 3. Start infrastructure services first ----
echo ""
echo "[Setup] Starting infrastructure services (postgres, redis, elasticsearch, neo4j, minio)..."
docker compose up -d postgres redis elasticsearch neo4j minio

echo "[Setup] Waiting for services to become healthy..."
SERVICES=("postgres" "redis" "elasticsearch" "neo4j" "minio")
for svc in "${SERVICES[@]}"; do
  echo -n "[Setup] Waiting for ${svc}..."
  RETRIES=60
  for i in $(seq 1 $RETRIES); do
    STATUS=$(docker compose ps --format json "$svc" 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 || echo "")
    if echo "$STATUS" | grep -q "healthy"; then
      echo " ready."
      break
    fi
    if [ "$i" -eq "$RETRIES" ]; then
      echo " TIMEOUT — check logs with: docker compose logs ${svc}"
    fi
    sleep 3
  done
done

# ---- 4. Run infrastructure init scripts ----
echo ""
echo "[Setup] Running Elasticsearch init..."
docker compose exec -T elasticsearch bash /usr/local/bin/init-es.sh 2>/dev/null || echo "[Setup] ES init skipped (run manually with: make init-es)"

echo "[Setup] Running Neo4j init..."
docker compose exec -T neo4j bash /var/lib/neo4j/import/init.sh 2>/dev/null || echo "[Setup] Neo4j init skipped (run manually with: make init-neo4j)"

echo "[Setup] Running MinIO init..."
docker compose exec -T minio bash /usr/local/bin/init-minio.sh 2>/dev/null || echo "[Setup] MinIO init skipped (run manually with: make init-minio)"

# ---- 5. Build and start all services ----
echo ""
echo "[Setup] Building and starting all services..."
docker compose up --build -d

# ---- 6. Run migrations ----
echo ""
echo "[Setup] Running database migrations..."
docker compose exec -T api npm run migrate 2>/dev/null || echo "[Setup] Migrations skipped (API may not have migrate script yet)."

# ---- 7. Seed sample data ----
echo ""
echo "[Setup] Seeding sample data..."
bash scripts/seed.sh 2>/dev/null || echo "[Setup] Seeding skipped (run manually with: make seed)."

echo ""
echo "============================================"
echo "  Setup Complete"
echo "============================================"
echo ""
echo "  Frontend:       http://localhost:3000"
echo "  API:            http://localhost:4000"
echo "  Nginx proxy:    http://localhost"
echo "  Neo4j Browser:  http://localhost:7474"
echo "  MinIO Console:  http://localhost:9001"
echo "  Elasticsearch:  http://localhost:9200"
echo ""
echo "  Run 'make dev' to start in foreground."
echo "  Run 'make logs' to tail all logs."
echo ""
