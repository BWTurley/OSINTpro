#!/bin/bash
set -euo pipefail

ES_URL="http://localhost:9200"
TEMPLATES_DIR="/usr/local/bin/index-templates"
MAX_RETRIES=60
RETRY_INTERVAL=5

echo "[ES Init] Waiting for Elasticsearch to become ready..."

for i in $(seq 1 $MAX_RETRIES); do
  if curl -sf "${ES_URL}/_cluster/health" > /dev/null 2>&1; then
    echo "[ES Init] Elasticsearch is ready."
    break
  fi
  if [ "$i" -eq "$MAX_RETRIES" ]; then
    echo "[ES Init] ERROR: Elasticsearch did not start within $(( MAX_RETRIES * RETRY_INTERVAL ))s."
    exit 1
  fi
  echo "[ES Init] Waiting... (attempt $i/$MAX_RETRIES)"
  sleep $RETRY_INTERVAL
done

# Apply index templates
TEMPLATES=("entities" "relationships" "audit-logs" "threat-indicators")

for template in "${TEMPLATES[@]}"; do
  TEMPLATE_FILE="${TEMPLATES_DIR}/${template}.json"
  if [ -f "$TEMPLATE_FILE" ]; then
    echo "[ES Init] Applying index template: ${template}"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
      "${ES_URL}/_index_template/${template}" \
      -H "Content-Type: application/json" \
      -d @"$TEMPLATE_FILE")

    if [ "$HTTP_CODE" -eq 200 ]; then
      echo "[ES Init] Template '${template}' applied successfully."
    else
      echo "[ES Init] WARNING: Template '${template}' returned HTTP ${HTTP_CODE}."
    fi
  else
    echo "[ES Init] WARNING: Template file not found: ${TEMPLATE_FILE}"
  fi
done

# Create initial indices if they don't exist
INDICES=("entities" "relationships" "audit-logs" "threat-indicators")

for index in "${INDICES[@]}"; do
  EXISTS=$(curl -s -o /dev/null -w "%{http_code}" "${ES_URL}/${index}")
  if [ "$EXISTS" -eq 404 ]; then
    echo "[ES Init] Creating index: ${index}"
    curl -s -X PUT "${ES_URL}/${index}" -H "Content-Type: application/json" -d '{}'
    echo ""
  else
    echo "[ES Init] Index '${index}' already exists."
  fi
done

echo "[ES Init] Initialization complete."
