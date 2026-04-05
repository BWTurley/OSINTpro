#!/bin/bash
set -euo pipefail

MINIO_HOST="http://localhost:9000"
MINIO_ACCESS_KEY="${MINIO_ROOT_USER:-minioadmin}"
MINIO_SECRET_KEY="${MINIO_ROOT_PASSWORD:-minioadmin}"
ALIAS="osint"
MAX_RETRIES=30
RETRY_INTERVAL=3

echo "[MinIO Init] Waiting for MinIO to become ready..."

for i in $(seq 1 $MAX_RETRIES); do
  if curl -sf "${MINIO_HOST}/minio/health/live" > /dev/null 2>&1; then
    echo "[MinIO Init] MinIO is ready."
    break
  fi
  if [ "$i" -eq "$MAX_RETRIES" ]; then
    echo "[MinIO Init] ERROR: MinIO did not start within $(( MAX_RETRIES * RETRY_INTERVAL ))s."
    exit 1
  fi
  echo "[MinIO Init] Waiting... (attempt $i/$MAX_RETRIES)"
  sleep $RETRY_INTERVAL
done

# Configure mc alias
mc alias set "$ALIAS" "$MINIO_HOST" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"

# Create buckets
BUCKETS=("osint-files" "osint-reports" "osint-screenshots" "osint-artifacts")

for bucket in "${BUCKETS[@]}"; do
  if mc ls "${ALIAS}/${bucket}" > /dev/null 2>&1; then
    echo "[MinIO Init] Bucket '${bucket}' already exists."
  else
    echo "[MinIO Init] Creating bucket: ${bucket}"
    mc mb "${ALIAS}/${bucket}"
  fi
done

# Set lifecycle rules — auto-expire artifacts after 90 days
echo "[MinIO Init] Setting lifecycle policy on osint-artifacts (90-day expiry)..."
mc ilm rule add "${ALIAS}/osint-artifacts" \
  --expire-days 90 \
  --prefix "" \
  --tags "" 2>/dev/null || echo "[MinIO Init] Lifecycle rule may already exist."

# Set anonymous download policy on reports (for shared report links)
echo "[MinIO Init] Setting download policy on osint-reports..."
mc anonymous set download "${ALIAS}/osint-reports" 2>/dev/null || true

echo "[MinIO Init] Initialization complete."
echo "[MinIO Init] Buckets:"
mc ls "$ALIAS"
