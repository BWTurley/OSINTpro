export interface CollectionResult {
  success: boolean;
  module: string;
  entity: string;
  entityType: string;
  timestamp: string;
  rawData: unknown;
  normalized: NormalizedEntity[];
  relationships: NormalizedRelationship[];
  metadata: CollectionMetadata;
  errors: CollectionError[];
}

export interface NormalizedEntity {
  id: string;
  type: EntityType;
  name: string;
  description: string;
  attributes: Record<string, unknown>;
  source: string;
  sourceUrl: string;
  confidence: number;
  firstSeen: string;
  lastSeen: string;
  tags: string[];
  raw: unknown;
}

export interface NormalizedRelationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  label: string;
  attributes: Record<string, unknown>;
  confidence: number;
  source: string;
  firstSeen: string;
  lastSeen: string;
}

export interface CollectionMetadata {
  duration: number;
  apiCalls: number;
  cached: boolean;
  rateLimited: boolean;
  partial: boolean;
  pagesFetched: number;
  totalPages: number;
}

export interface CollectionError {
  code: string;
  message: string;
  retryable: boolean;
  timestamp: string;
}

export interface ModuleHealth {
  status: 'ok' | 'degraded' | 'down';
  latency: number;
  lastCheck: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface RateLimitConfig {
  maxTokens: number;
  refillRate: number;
  refillInterval: number;
}

export interface ModuleConfig {
  name: string;
  category: ModuleCategory;
  supportedEntityTypes: string[];
  rateLimit: RateLimitConfig;
  cacheTTL: number;
  requiresApiKey: boolean;
}

export type ModuleCategory =
  | 'finint'
  | 'cti'
  | 'domain'
  | 'geoint'
  | 'socmint'
  | 'people'
  | 'political'
  | 'milint';

export type EntityType =
  | 'person'
  | 'organization'
  | 'domain'
  | 'ip'
  | 'email'
  | 'phone'
  | 'hash'
  | 'url'
  | 'wallet'
  | 'username'
  | 'location'
  | 'vessel'
  | 'aircraft'
  | 'satellite'
  | 'vulnerability'
  | 'malware'
  | 'campaign'
  | 'filing'
  | 'legislation'
  | 'contract'
  | 'event'
  | 'certificate'
  | 'indicator'
  | 'country';

export type RelationshipType =
  | 'owns'
  | 'controls'
  | 'employs'
  | 'affiliated_with'
  | 'communicates_with'
  | 'located_at'
  | 'resolves_to'
  | 'hosts'
  | 'registered_by'
  | 'signed_by'
  | 'references'
  | 'finances'
  | 'targets'
  | 'uses'
  | 'exploits'
  | 'mitigates'
  | 'part_of'
  | 'related_to'
  | 'same_as'
  | 'child_of'
  | 'parent_of';

export interface CollectionJob {
  id: string;
  module: string;
  entity: string;
  entityType: string;
  apiKey?: string;
  priority: number;
  investigationId?: string;
  userId: string;
  options?: Record<string, unknown>;
}

export interface EnrichmentJob {
  entityId: string;
  entityType: string;
  entity: string;
  investigationId: string;
  userId: string;
  excludeModules?: string[];
  depth: number;
  maxDepth: number;
}

export interface AlertJob {
  alertId: string;
  userId: string;
  query: string;
  modules: string[];
  lastRun: string;
}

export interface FeedIngestionJob {
  feedId: string;
  feedType: 'stix' | 'csv' | 'json' | 'taxii';
  url: string;
  apiKey?: string;
  schedule?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  keys: number;
}
