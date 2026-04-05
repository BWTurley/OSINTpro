#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${PROJECT_ROOT}/backups/${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

echo "============================================"
echo "  OSINT Dashboard — Backup"
echo "  Timestamp: ${TIMESTAMP}"
echo "  Output:    ${BACKUP_DIR}"
echo "============================================"
echo ""

# ---- 1. PostgreSQL Backup ----
echo "[Backup] Dumping PostgreSQL..."
docker compose exec -T postgres pg_dump \
  -U osint \
  -d osint_db \
  --format=custom \
  --compress=9 \
  > "${BACKUP_DIR}/postgres_osint_db.dump" 2>/dev/null

if [ -f "${BACKUP_DIR}/postgres_osint_db.dump" ] && [ -s "${BACKUP_DIR}/postgres_osint_db.dump" ]; then
  PG_SIZE=$(du -sh "${BACKUP_DIR}/postgres_osint_db.dump" | cut -f1)
  echo "[Backup] PostgreSQL dump complete (${PG_SIZE})."
else
  echo "[Backup] WARNING: PostgreSQL dump may have failed."
fi

# ---- 2. Elasticsearch Snapshot ----
echo ""
echo "[Backup] Creating Elasticsearch snapshot..."

# Register snapshot repository (idempotent)
curl -s -X PUT "http://localhost:9200/_snapshot/osint_backup" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"fs\",
    \"settings\": {
      \"location\": \"/usr/share/elasticsearch/data/snapshots\"
    }
  }" > /dev/null 2>&1

# Create snapshot
SNAPSHOT_NAME="snapshot_${TIMESTAMP}"
ES_RESPONSE=$(curl -s -X PUT "http://localhost:9200/_snapshot/osint_backup/${SNAPSHOT_NAME}?wait_for_completion=true" \
  -H "Content-Type: application/json" \
  -d '{
    "indices": "entities,relationships,audit-logs,threat-indicators",
    "ignore_unavailable": true,
    "include_global_state": false
  }' 2>/dev/null || echo '{"error":"snapshot failed"}')

if echo "$ES_RESPONSE" | grep -q '"state":"SUCCESS"'; then
  echo "[Backup] Elasticsearch snapshot '${SNAPSHOT_NAME}' created."
else
  echo "[Backup] WARNING: Elasticsearch snapshot may have failed."
  echo "[Backup] Response: ${ES_RESPONSE}"
fi

# Also dump index data as JSON for portability
echo "[Backup] Exporting Elasticsearch indices as JSON..."
INDICES=("entities" "relationships" "audit-logs" "threat-indicators")
for index in "${INDICES[@]}"; do
  curl -s "http://localhost:9200/${index}/_search?size=10000" \
    -H "Content-Type: application/json" \
    -d '{"query":{"match_all":{}}}' \
    > "${BACKUP_DIR}/es_${index}.json" 2>/dev/null || true
  if [ -f "${BACKUP_DIR}/es_${index}.json" ] && [ -s "${BACKUP_DIR}/es_${index}.json" ]; then
    echo "[Backup]   ${index}: exported."
  else
    echo "[Backup]   ${index}: skipped (empty or missing)."
  fi
done

# ---- 3. Neo4j Export ----
echo ""
echo "[Backup] Exporting Neo4j data..."
docker compose exec -T neo4j cypher-shell \
  -u "${NEO4J_USER:-neo4j}" \
  -p "${NEO4J_PASSWORD:-osint_secret}" \
  "CALL apoc.export.json.all(null, {stream: true}) YIELD data RETURN data" \
  > "${BACKUP_DIR}/neo4j_export.json" 2>/dev/null || {
    echo "[Backup] APOC not available. Falling back to Cypher dump..."
    docker compose exec -T neo4j cypher-shell \
      -u "${NEO4J_USER:-neo4j}" \
      -p "${NEO4J_PASSWORD:-osint_secret}" \
      "MATCH (n) RETURN labels(n) AS labels, properties(n) AS props" \
      > "${BACKUP_DIR}/neo4j_nodes.csv" 2>/dev/null || echo "[Backup] Neo4j export skipped."
    docker compose exec -T neo4j cypher-shell \
      -u "${NEO4J_USER:-neo4j}" \
      -p "${NEO4J_PASSWORD:-osint_secret}" \
      "MATCH (a)-[r]->(b) RETURN id(a) AS from, type(r) AS type, properties(r) AS props, id(b) AS to" \
      > "${BACKUP_DIR}/neo4j_relationships.csv" 2>/dev/null || true
  }

echo "[Backup] Neo4j export complete."

# ---- 4. Redis RDB snapshot ----
echo ""
echo "[Backup] Triggering Redis BGSAVE..."
docker compose exec -T redis redis-cli BGSAVE > /dev/null 2>&1
sleep 2
docker compose cp redis:/data/dump.rdb "${BACKUP_DIR}/redis_dump.rdb" 2>/dev/null || echo "[Backup] Redis dump copy skipped."
echo "[Backup] Redis backup complete."

# ---- Summary ----
echo ""
echo "============================================"
echo "  Backup Complete"
echo "============================================"
echo ""
echo "  Location: ${BACKUP_DIR}"
echo "  Contents:"
ls -lh "$BACKUP_DIR" 2>/dev/null || true
echo ""
echo "  To restore PostgreSQL:"
echo "    docker compose exec -T postgres pg_restore -U osint -d osint_db < ${BACKUP_DIR}/postgres_osint_db.dump"
echo ""
