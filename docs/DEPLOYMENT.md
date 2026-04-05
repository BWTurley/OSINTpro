# Deployment Guide

## Prerequisites

- Docker Engine 24+
- Docker Compose v2
- 8GB+ RAM (recommended 16GB for all services)
- 20GB+ disk space

## Local Development

```bash
# Clone and setup
git clone https://github.com/BWTurley/OSINTpro.git
cd OSINTpro

# Copy environment configuration
cp .env.example .env
# Edit .env with your API keys

# Start all services
make dev

# Or manually:
docker compose up -d

# Run database migrations
make migrate

# Seed sample data (optional)
make seed
```

Access the application:
- Frontend: http://localhost
- API/GraphQL: http://localhost/api, http://localhost/graphql
- Neo4j Browser: http://localhost:7474
- MinIO Console: http://localhost:9001
- Elasticsearch: http://localhost:9200

## Production Deployment

```bash
# Build production images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start with production overrides
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Production Checklist

- [ ] Set strong passwords in `.env` for all services
- [ ] Set unique `JWT_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Set unique `ENCRYPTION_KEY` for API key storage
- [ ] Configure TLS certificates in `infrastructure/nginx/ssl/`
- [ ] Set `NODE_ENV=production`
- [ ] Configure backup schedule
- [ ] Set appropriate resource limits in `docker-compose.prod.yml`
- [ ] Enable Elasticsearch security features
- [ ] Configure Neo4j authentication

## Backup & Restore

```bash
# Manual backup
make backup

# Scheduled backups (add to crontab)
0 2 * * * /path/to/scripts/backup.sh
```

## Monitoring

- Health endpoint: `GET /api/health`
- Module status: `GET /api/health/modules`
- System health dashboard: Admin panel in the UI
