import type { Entity, EntityType } from "./entities.js";
import type { Relationship } from "./relationships.js";

export type ModuleCategory =
  | "people"
  | "companies"
  | "domains"
  | "ip-addresses"
  | "email"
  | "phone"
  | "social-media"
  | "threat-intel"
  | "financial"
  | "geospatial"
  | "documents"
  | "dark-web"
  | "sanctions"
  | "breach-data";

export interface NormalizedEntity {
  id: string;
  entityType: EntityType;
  data: Record<string, unknown>;
  confidence: number;
  source: string;
}

export interface NormalizedCollectionRelationship {
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: string;
  confidence: number;
  source: string;
}

export interface CollectionResult {
  entities: Entity[];
  relationships: Relationship[];
  rawData: Record<string, unknown>;
  source: string;
  collectedAt: string;
  confidence: number;
  apiCallsUsed: number;
}

export interface ModuleConfig {
  name: string;
  category: ModuleCategory;
  enabled: boolean;
  apiKey?: string;
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  cacheTTL: number;
}

export interface ModuleHealth {
  status: "healthy" | "degraded" | "down" | "unknown";
  latency: number;
  lastCheck: string;
}

export type CollectionJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface CollectionJob {
  id: string;
  entityId: string;
  modules: string[];
  status: CollectionJobStatus;
  progress: number;
  results: CollectionResult[];
  createdAt: string;
  completedAt?: string;
  error?: string;
}
