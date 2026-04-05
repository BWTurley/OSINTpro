.PHONY: setup dev build test down clean logs migrate seed backup prod

# ---- First-time Setup ----
setup:
	@bash scripts/setup.sh

# ---- Development ----
dev:
	docker compose up --build

dev-detached:
	docker compose up --build -d

# ---- Production ----
prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

# ---- Build ----
build:
	docker compose build --no-cache

# ---- Tests ----
test:
	npm run test --workspaces --if-present

test-api:
	npm run test --workspace=packages/api

test-frontend:
	npm run test --workspace=packages/frontend

# ---- Stop Services ----
down:
	docker compose down

# ---- Clean Everything (volumes, images) ----
clean:
	docker compose down -v --rmi local --remove-orphans
	rm -rf node_modules packages/*/node_modules packages/*/dist packages/*/.next

# ---- Logs ----
logs:
	docker compose logs -f

logs-api:
	docker compose logs -f api

logs-workers:
	docker compose logs -f workers

logs-postgres:
	docker compose logs -f postgres

# ---- Database Migrations ----
migrate:
	docker compose exec api npm run migrate

migrate-create:
	@read -p "Migration name: " name; \
	docker compose exec api npm run migrate:create -- $$name

migrate-rollback:
	docker compose exec api npm run migrate:rollback

# ---- Seed Data ----
seed:
	@bash scripts/seed.sh

# ---- Backup ----
backup:
	@bash scripts/backup.sh

# ---- Infrastructure Init Scripts ----
init-es:
	docker compose exec elasticsearch bash /usr/local/bin/init-es.sh

init-neo4j:
	docker compose exec neo4j bash /var/lib/neo4j/import/init.sh

init-minio:
	docker compose exec minio bash /usr/local/bin/init-minio.sh

init-all: init-es init-neo4j init-minio

# ---- Utilities ----
shell-api:
	docker compose exec api sh

shell-postgres:
	docker compose exec postgres psql -U osint -d osint_db

shell-redis:
	docker compose exec redis redis-cli

shell-neo4j:
	docker compose exec neo4j cypher-shell -u neo4j -p osint_secret

status:
	docker compose ps
