# Architecture Decision Records

## Overview

OSINTpro is an enterprise-grade Open Source Intelligence (OSINT) platform built as a multi-service application using Docker Compose.

## Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Nginx                             │
│                   (Reverse Proxy)                         │
├─────────────┬───────────────────────────────────────────┤
│  Frontend   │              API Server                    │
│  (React)    │  (Express + Apollo GraphQL)                │
│  Port 3000  │         Port 4000                          │
├─────────────┴───────┬───────────────────────────────────┤
│                     │           Workers                   │
│                     │      (BullMQ Processors)            │
├─────────────────────┼───────────────────────────────────┤
│   PostgreSQL        │  Elasticsearch  │  Neo4j           │
│   (Primary DB)      │  (Search/Index) │  (Graph DB)      │
├─────────────────────┼─────────────────┼─────────────────┤
│       Redis         │     MinIO                          │
│  (Cache/Queue)      │  (Object Store)                    │
└─────────────────────┴───────────────────────────────────┘
```

## Data Flow

1. **Entity Creation**: API → PostgreSQL + Elasticsearch + Neo4j (tri-store sync)
2. **Data Collection**: API → BullMQ Queue → Worker → External API → Entity Creation
3. **Search**: Frontend → GraphQL → Elasticsearch → Formatted Results
4. **Graph Queries**: Frontend → GraphQL → Neo4j → Cytoscape.js Format
5. **File Storage**: Frontend → REST Upload → MinIO → Signed URL Response

## Key Design Decisions

### Tri-Store Data Model
Entities are stored in three databases simultaneously:
- **PostgreSQL** (via Prisma): Structured metadata, user-facing queries, access control
- **Elasticsearch**: Full-text search, aggregations, flexible document storage
- **Neo4j**: Entity relationships, graph traversal, path finding, community detection

### STIX 2.1 Inspired Entity Model
Entity types follow the STIX 2.1 standard with extensions for OSINT-specific data like financial records, social media profiles, and geospatial intelligence.

### Plugin Architecture for Intelligence Modules
Each data source is an independent module extending `BaseModule`, enabling:
- Independent rate limiting per source
- Per-source caching with configurable TTLs
- Easy addition of new sources without modifying core code
- Health monitoring per module

### BullMQ for Async Processing
Data collection runs asynchronously via BullMQ queues backed by Redis, enabling:
- Configurable concurrency
- Automatic retry with exponential backoff
- Job scheduling with cron expressions
- Real-time job status via WebSocket subscriptions

### Admiralty Code Confidence Scoring
All intelligence data includes provenance tracking with:
- Source reliability rating (A-F)
- Information credibility rating (1-6)
- Numeric confidence score (0-100)
