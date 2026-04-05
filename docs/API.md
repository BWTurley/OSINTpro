# API Documentation

## GraphQL API

The primary API is GraphQL, accessible at `/graphql`.

### Authentication

All API requests require a JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Obtain tokens via the REST auth endpoints.

### Core Queries

| Query | Description | Required Role |
|-------|-------------|---------------|
| `entity(id: ID!)` | Get single entity by ID | VIEWER+ |
| `entities(filter, pagination)` | List entities with filtering | VIEWER+ |
| `searchEntities(query, types, limit)` | Full-text entity search | VIEWER+ |
| `relationships(entityId, direction, types)` | Get entity relationships | VIEWER+ |
| `shortestPath(fromId, toId, maxDepth)` | Find shortest path between entities | ANALYST+ |
| `entityGraph(entityId, depth, filter)` | Get entity neighborhood graph | ANALYST+ |
| `case(id)` | Get investigation case | VIEWER+ |
| `cases(filter, pagination)` | List cases | VIEWER+ |
| `collectionJobs(filter, pagination)` | List collection jobs | ANALYST+ |
| `moduleStatus` | Get all module health status | ANALYST+ |
| `search(query)` | Advanced search with facets | VIEWER+ |
| `dashboardStats` | Dashboard summary statistics | VIEWER+ |
| `threatFeed(sources, limit)` | Latest threat indicators | VIEWER+ |

### Core Mutations

| Mutation | Description | Required Role |
|----------|-------------|---------------|
| `createEntity(input)` | Create new entity | ANALYST+ |
| `updateEntity(id, input)` | Update entity | ANALYST+ |
| `mergeEntities(sourceId, targetId)` | Merge duplicate entities | ANALYST+ |
| `deleteEntity(id)` | Delete entity | ADMIN |
| `triggerCollection(entityId, modules)` | Start data collection | ANALYST+ |
| `bulkImport(entities)` | Import multiple entities | ANALYST+ |
| `createCase(input)` | Create investigation case | ANALYST+ |
| `addEntityToCase(caseId, entityId)` | Link entity to case | ANALYST+ |
| `addNote(entityId, content, classification)` | Add analyst note | ANALYST+ |
| `updateModuleConfig(moduleId, config)` | Configure intelligence module | ADMIN |

### Subscriptions

| Subscription | Description |
|-------------|-------------|
| `collectionJobUpdated(caseId)` | Real-time job status updates |
| `entityUpdated(caseId)` | Entity change notifications |
| `alertTriggered` | Alert rule matches |

## REST API

### Authentication

```
POST /api/auth/login         - Login with email/password
POST /api/auth/register      - Register new user (admin only)
POST /api/auth/refresh       - Refresh JWT token
GET  /api/auth/oauth/:provider - OAuth2 redirect
POST /api/auth/oauth/callback  - OAuth2 callback
```

### Files

```
POST /api/files/upload       - Upload file attachment
GET  /api/files/:id          - Download file
```

### Export

```
GET /api/export/case/:id/:format  - Export case (pdf, stix, csv, json, md)
GET /api/export/report/:id        - Download generated report
```

### Health

```
GET /api/health              - System health check
GET /api/health/modules      - Per-module health status
```

### Audit

```
GET /api/audit/logs          - Search audit logs (admin only)
```

## Pagination

All list endpoints use cursor-based pagination:

```graphql
query {
  entities(
    filter: { entityType: PERSON }
    pagination: { first: 20, after: "base64cursor" }
  ) {
    edges {
      node { id, entityType, data }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
```

## Rate Limiting

- API endpoints: 100 requests/minute per user
- GraphQL: 60 queries/minute per user
- File uploads: 10/minute per user
- Auth endpoints: 5/minute per IP
