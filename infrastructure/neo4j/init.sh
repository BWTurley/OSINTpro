#!/bin/bash
set -euo pipefail

NEO4J_USER="${NEO4J_USER:-neo4j}"
NEO4J_PASSWORD="${NEO4J_PASSWORD:-osint_secret}"
NEO4J_URI="bolt://localhost:7687"
CONSTRAINTS_FILE="/var/lib/neo4j/import/constraints.cypher"
MAX_RETRIES=60
RETRY_INTERVAL=5

echo "[Neo4j Init] Waiting for Neo4j to become ready..."

for i in $(seq 1 $MAX_RETRIES); do
  if cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" "RETURN 1" > /dev/null 2>&1; then
    echo "[Neo4j Init] Neo4j is ready."
    break
  fi
  if [ "$i" -eq "$MAX_RETRIES" ]; then
    echo "[Neo4j Init] ERROR: Neo4j did not start within $(( MAX_RETRIES * RETRY_INTERVAL ))s."
    exit 1
  fi
  echo "[Neo4j Init] Waiting... (attempt $i/$MAX_RETRIES)"
  sleep $RETRY_INTERVAL
done

if [ ! -f "$CONSTRAINTS_FILE" ]; then
  echo "[Neo4j Init] ERROR: Constraints file not found at ${CONSTRAINTS_FILE}"
  exit 1
fi

echo "[Neo4j Init] Applying constraints and indexes..."

# Read and execute each statement from the constraints file.
# Statements are separated by semicolons. Skip comment lines.
while IFS= read -r line; do
  # Skip blank lines and comments
  [[ -z "$line" || "$line" =~ ^[[:space:]]*//.* ]] && continue

  # Accumulate multi-line statements
  STATEMENT="${STATEMENT:-}${line} "

  # Execute when we hit a semicolon
  if [[ "$line" == *";" ]]; then
    CLEAN_STMT=$(echo "$STATEMENT" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    if [ -n "$CLEAN_STMT" ]; then
      echo "[Neo4j Init] Executing: ${CLEAN_STMT:0:80}..."
      cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" "$CLEAN_STMT" 2>&1 || {
        echo "[Neo4j Init] WARNING: Statement failed (may already exist): ${CLEAN_STMT:0:80}"
      }
    fi
    STATEMENT=""
  fi
done < "$CONSTRAINTS_FILE"

echo "[Neo4j Init] Initialization complete."
