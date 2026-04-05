#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "============================================"
echo "  OSINT Dashboard — Seed Development Data"
echo "============================================"
echo ""

# ---- Seed PostgreSQL ----
echo "[Seed] Inserting sample data into PostgreSQL..."
docker compose exec -T postgres psql -U osint -d osint_db <<'EOSQL'

-- Sample users
INSERT INTO users (id, email, name, role, created_at) VALUES
  (gen_random_uuid(), 'admin@osint-dashboard.local', 'Admin User', 'admin', NOW()),
  (gen_random_uuid(), 'analyst@osint-dashboard.local', 'OSINT Analyst', 'analyst', NOW()),
  (gen_random_uuid(), 'viewer@osint-dashboard.local', 'Read Only User', 'viewer', NOW())
ON CONFLICT DO NOTHING;

-- Sample investigations
INSERT INTO investigations (id, name, description, status, created_by, created_at) VALUES
  (gen_random_uuid(), 'APT Infrastructure Mapping', 'Tracking C2 infrastructure for suspected APT group', 'active', (SELECT id FROM users WHERE role = 'admin' LIMIT 1), NOW()),
  (gen_random_uuid(), 'Phishing Campaign Analysis', 'Analysis of ongoing phishing campaign targeting finance sector', 'active', (SELECT id FROM users WHERE role = 'analyst' LIMIT 1), NOW()),
  (gen_random_uuid(), 'Brand Impersonation', 'Investigating domains impersonating company brand', 'closed', (SELECT id FROM users WHERE role = 'analyst' LIMIT 1), NOW())
ON CONFLICT DO NOTHING;

EOSQL
echo "[Seed] PostgreSQL seeding complete (tables may not exist yet — that's OK)." 2>/dev/null || echo "[Seed] PostgreSQL seed skipped — tables not yet created."

# ---- Seed Elasticsearch ----
echo ""
echo "[Seed] Inserting sample entities into Elasticsearch..."

curl -s -X POST "http://localhost:9200/entities/_bulk" -H "Content-Type: application/x-ndjson" -d '
{"index":{"_id":"entity-001"}}
{"id":"entity-001","type":"Domain","name":"suspicious-domain.com","description":"Suspected phishing domain","source":"manual","confidence":0.85,"risk_score":72.5,"tags":["phishing","active"],"first_seen":"2026-03-01T00:00:00Z","last_seen":"2026-04-01T00:00:00Z","created_at":"2026-04-01T12:00:00Z","is_active":true}
{"index":{"_id":"entity-002"}}
{"id":"entity-002","type":"IPAddress","name":"198.51.100.42","description":"C2 server IP","source":"shodan","confidence":0.92,"risk_score":89.0,"tags":["c2","malware"],"first_seen":"2026-02-15T00:00:00Z","last_seen":"2026-04-02T00:00:00Z","created_at":"2026-04-01T12:00:00Z","is_active":true}
{"index":{"_id":"entity-003"}}
{"id":"entity-003","type":"Person","name":"John Doe","description":"Suspected threat actor alias","source":"humint","confidence":0.65,"risk_score":45.0,"tags":["threat-actor"],"first_seen":"2026-01-10T00:00:00Z","created_at":"2026-04-01T12:00:00Z","is_active":true}
{"index":{"_id":"entity-004"}}
{"id":"entity-004","type":"Organization","name":"Shadow Corp Ltd","description":"Shell company linked to fraud","source":"osint","confidence":0.78,"risk_score":67.0,"tags":["fraud","shell-company"],"country_code":"CY","first_seen":"2025-11-20T00:00:00Z","created_at":"2026-04-01T12:00:00Z","is_active":true}
{"index":{"_id":"entity-005"}}
{"id":"entity-005","type":"EmailAddress","name":"admin@suspicious-domain.com","description":"Admin email on phishing domain","source":"whois","confidence":0.90,"risk_score":75.0,"tags":["phishing"],"first_seen":"2026-03-01T00:00:00Z","created_at":"2026-04-01T12:00:00Z","is_active":true}
' 2>/dev/null && echo "[Seed] Elasticsearch entities seeded." || echo "[Seed] Elasticsearch seed skipped."

# ---- Seed Threat Indicators ----
echo ""
echo "[Seed] Inserting sample threat indicators..."

curl -s -X POST "http://localhost:9200/threat-indicators/_bulk" -H "Content-Type: application/x-ndjson" -d '
{"index":{"_id":"ti-001"}}
{"id":"ti-001","type":"indicator","indicator_type":"ipv4","value":"198.51.100.42","threat_type":"c2","severity":"high","confidence":0.92,"risk_score":89.0,"tlp":"amber","tags":["c2","apt"],"source":"shodan","description":"Known C2 server","first_seen":"2026-02-15T00:00:00Z","last_seen":"2026-04-02T00:00:00Z","created_at":"2026-04-02T12:00:00Z","is_active":true,"is_false_positive":false}
{"index":{"_id":"ti-002"}}
{"id":"ti-002","type":"indicator","indicator_type":"domain","value":"suspicious-domain.com","threat_type":"phishing","severity":"medium","confidence":0.85,"risk_score":72.5,"tlp":"green","tags":["phishing"],"source":"urlscan","description":"Phishing domain targeting financial sector","first_seen":"2026-03-01T00:00:00Z","created_at":"2026-04-02T12:00:00Z","is_active":true,"is_false_positive":false}
{"index":{"_id":"ti-003"}}
{"id":"ti-003","type":"indicator","indicator_type":"sha256","value":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","threat_type":"malware","malware_family":"EmptyHash","severity":"low","confidence":0.50,"risk_score":25.0,"tlp":"white","tags":["test"],"source":"virustotal","description":"Test indicator — empty file hash","created_at":"2026-04-02T12:00:00Z","is_active":true,"is_false_positive":true}
' 2>/dev/null && echo "[Seed] Threat indicators seeded." || echo "[Seed] Threat indicators seed skipped."

# ---- Seed Neo4j ----
echo ""
echo "[Seed] Inserting sample graph data into Neo4j..."

docker compose exec -T neo4j cypher-shell -u "${NEO4J_USER:-neo4j}" -p "${NEO4J_PASSWORD:-osint_secret}" <<'EOCYPHER'

// Create sample entities
MERGE (d:Domain {id: "entity-001", name: "suspicious-domain.com"})
SET d.risk_score = 72.5, d.first_seen = datetime("2026-03-01T00:00:00Z");

MERGE (ip:IPAddress {id: "entity-002", address: "198.51.100.42"})
SET ip.name = "198.51.100.42", ip.risk_score = 89.0, ip.first_seen = datetime("2026-02-15T00:00:00Z");

MERGE (p:Person {id: "entity-003", name: "John Doe"})
SET p.risk_score = 45.0;

MERGE (org:Organization {id: "entity-004", name: "Shadow Corp Ltd"})
SET org.country_code = "CY", org.risk_score = 67.0;

MERGE (email:EmailAddress {id: "entity-005", address: "admin@suspicious-domain.com"})
SET email.name = "admin@suspicious-domain.com", email.risk_score = 75.0;

// Create relationships
MATCH (d:Domain {id: "entity-001"}), (ip:IPAddress {id: "entity-002"})
MERGE (d)-[:RESOLVES_TO {confidence: 0.95, first_seen: datetime("2026-03-01T00:00:00Z")}]->(ip);

MATCH (d:Domain {id: "entity-001"}), (email:EmailAddress {id: "entity-005"})
MERGE (email)-[:REGISTERED_ON {source: "whois"}]->(d);

MATCH (p:Person {id: "entity-003"}), (org:Organization {id: "entity-004"})
MERGE (p)-[:ASSOCIATED_WITH {confidence: 0.65, source: "humint"}]->(org);

MATCH (org:Organization {id: "entity-004"}), (d:Domain {id: "entity-001"})
MERGE (org)-[:OWNS {confidence: 0.70}]->(d);

MATCH (p:Person {id: "entity-003"}), (email:EmailAddress {id: "entity-005"})
MERGE (p)-[:USES {confidence: 0.60}]->(email);

EOCYPHER
echo "[Seed] Neo4j seeding complete." 2>/dev/null || echo "[Seed] Neo4j seed skipped."

echo ""
echo "============================================"
echo "  Seeding Complete"
echo "============================================"
