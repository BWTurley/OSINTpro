import type { EntityType, TLPLevel } from "./entities.js";

export interface SearchFilter {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "starts_with" | "ends_with" | "in" | "not_in" | "exists" | "range";
  value: unknown;
}

export interface SearchQuery {
  query: string;
  entityTypes?: EntityType[];
  filters?: SearchFilter[];
  sort?: {
    field: string;
    direction: "asc" | "desc";
  };
  pagination: PaginationInput;
  facets?: string[];
  highlight?: boolean;
}

export interface PaginationInput {
  cursor?: string;
  limit: number;
}

export interface PaginationOutput {
  nextCursor?: string;
  previousCursor?: string;
  totalCount: number;
  hasMore: boolean;
}

export interface SearchAggregation {
  field: string;
  buckets: {
    key: string;
    count: number;
  }[];
}

export interface SearchFacets {
  entityTypes: SearchAggregation;
  sources: SearchAggregation;
  tags: SearchAggregation;
  tlpLevels: SearchAggregation;
  confidence: SearchAggregation;
  dateRange: {
    min: string;
    max: string;
  };
}

export interface SearchResultItem {
  entityId: string;
  entityType: EntityType;
  score: number;
  highlights: Record<string, string[]>;
  data: Record<string, unknown>;
}

export interface SearchResults {
  items: SearchResultItem[];
  pagination: PaginationOutput;
  facets?: SearchFacets;
  queryTime: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  query: SearchQuery;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
}

export type AlertFrequency = "realtime" | "hourly" | "daily" | "weekly";
export type AlertChannel = "email" | "webhook" | "in-app";

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  query: SearchQuery;
  frequency: AlertFrequency;
  channels: AlertChannel[];
  enabled: boolean;
  tlpLevel: TLPLevel;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastTriggered?: string;
  triggerCount: number;
}
