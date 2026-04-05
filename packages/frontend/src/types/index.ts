// ─── Entity Types ────────────────────────────────────────────────

export type EntityType =
  | 'person'
  | 'organization'
  | 'domain'
  | 'ip'
  | 'email'
  | 'phone'
  | 'hash'
  | 'cryptocurrency'
  | 'vehicle'
  | 'location'
  | 'event'
  | 'malware'
  | 'vulnerability'
  | 'threat_actor';

export type TLPLevel = 'white' | 'green' | 'amber' | 'amber-strict' | 'red';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type CaseStatus = 'open' | 'in_progress' | 'pending' | 'closed' | 'archived';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type ConfidenceLevel = 'confirmed' | 'probably_true' | 'possibly_true' | 'doubtful' | 'improbable' | 'unknown';

// Admiralty Code: reliability + credibility
export interface AdmiraltyCode {
  reliability: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  credibility: '1' | '2' | '3' | '4' | '5' | '6';
}

export interface Entity {
  id: string;
  type: EntityType;
  value: string;
  label: string;
  confidence: number;
  admiraltyCode: AdmiraltyCode;
  tlp: TLPLevel;
  tags: string[];
  sources: string[];
  firstSeen: string;
  lastSeen: string;
  metadata: Record<string, unknown>;
  relationships: Relationship[];
  notes: Note[];
  createdAt: string;
  updatedAt: string;
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  label: string;
  confidence: number;
  firstSeen: string;
  lastSeen: string;
  metadata: Record<string, unknown>;
}

export interface Case {
  id: string;
  title: string;
  description: string;
  status: CaseStatus;
  tlp: TLPLevel;
  priority: Severity;
  assignee: string;
  entities: Entity[];
  notes: Note[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface Note {
  id: string;
  content: string;
  author: string;
  tlp: TLPLevel;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionJob {
  id: string;
  module: string;
  entityId: string;
  entityValue: string;
  status: JobStatus;
  progress: number;
  resultCount: number;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface IntelModule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  healthy: boolean;
  entityTypes: EntityType[];
  rateLimitUsed: number;
  rateLimitMax: number;
  lastChecked: string;
}

export interface IOCEntry {
  id: string;
  value: string;
  type: EntityType;
  source: string;
  confidence: number;
  tags: string[];
  firstSeen: string;
  lastSeen: string;
  threatScore: number;
}

export interface CVEEntry {
  id: string;
  cveId: string;
  description: string;
  cvssScore: number;
  severity: Severity;
  exploitAvailable: boolean;
  cisaKev: boolean;
  publishedAt: string;
  updatedAt: string;
}

export interface ThreatActor {
  id: string;
  name: string;
  aliases: string[];
  motivation: string;
  sophistication: string;
  country: string;
  ttps: string[];
  description: string;
  firstSeen: string;
  lastSeen: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'analyst' | 'viewer';
  avatar: string | null;
  lastLogin: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: Severity;
  source: string;
  entityId: string | null;
  read: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalEntities: number;
  totalCases: number;
  activeCases: number;
  activeJobs: number;
  alertsCritical: number;
  alertsHigh: number;
  alertsMedium: number;
  alertsLow: number;
  modulesHealthy: number;
  modulesTotal: number;
}

export interface GraphNode {
  id: string;
  type: EntityType;
  label: string;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
  confidence: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SearchResult {
  entities: Entity[];
  total: number;
  facets: Record<string, FacetBucket[]>;
}

export interface FacetBucket {
  key: string;
  count: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, unknown>;
  alertEnabled: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  timestamp: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: string[];
}

export interface GeoEvent {
  id: string;
  lat: number;
  lng: number;
  type: string;
  title: string;
  description: string;
  source: string;
  date: string;
  severity: Severity;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

export interface ScheduledJob {
  id: string;
  name: string;
  module: string;
  cron: string;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string;
  entityQuery: string;
}
