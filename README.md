# OSINT Dashboard

Open-source intelligence dashboard for entity resolution, link analysis, and threat intelligence. Built as a monorepo with a Next.js frontend, Node.js API, and background workers backed by PostgreSQL, Redis, Elasticsearch, Neo4j, and MinIO.

## Architecture

| Service         | Purpose                          | Port  |
|-----------------|----------------------------------|-------|
| Frontend        | Next.js web UI                   | 3000  |
| API             | REST + GraphQL backend           | 4000  |
| Workers         | Background jobs (enrichment, ingestion) | —     |
| PostgreSQL      | Relational data, users, investigations | 5432  |
| Redis           | Caching, job queues, sessions    | 6379  |
| Elasticsearch   | Full-text search, entity index   | 9200  |
| Neo4j           | Graph relationships, link analysis | 7474/7687 |
| MinIO           | File/artifact storage (S3-compatible) | 9000/9001 |
| Nginx           | Reverse proxy                    | 80    |

## Quick Start

```bash
# 1. Clone and enter the project
git clone <repo-url> osint-dashboard
cd osint-dashboard

# 2. Run first-time setup (copies .env, starts Docker, runs migrations, seeds data)
make setup

# 3. Open the dashboard
open http://localhost:3000
```

## Development

```bash
make dev          # Start all services (foreground, with rebuild)
make dev-detached # Start all services (background)
make logs         # Tail all service logs
make down         # Stop everything
make clean        # Stop everything, remove volumes and build artifacts
```

## Useful Commands

```bash
make migrate          # Run database migrations
make seed             # Seed sample data
make backup           # Backup all databases
make test             # Run tests across all packages
make shell-postgres   # Open psql shell
make shell-redis      # Open redis-cli
make shell-neo4j      # Open cypher-shell
```

## Production

```bash
# Uses docker-compose.prod.yml overrides (resource limits, restart policies, no exposed internal ports)
make prod
```

## Project Structure

```
osint-dashboard/
  packages/
    frontend/       # Next.js App Router
    api/            # Node.js REST + GraphQL API
    workers/        # Background job processors
  infrastructure/
    nginx/          # Reverse proxy config
    postgres/       # Init SQL scripts
    elasticsearch/  # Index templates and init
    neo4j/          # Constraints and init
    minio/          # Bucket creation init
  scripts/          # Setup, seed, backup scripts
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your values. All API keys (Shodan, VirusTotal, etc.) are optional -- modules degrade gracefully when keys are missing.
