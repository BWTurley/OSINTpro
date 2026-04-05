import type { EntityType, TLPLevel } from "./entities.js";

export type Role = "ADMIN" | "ANALYST" | "VIEWER" | "API_USER";

export type CaseStatus = "open" | "in-progress" | "pending-review" | "closed" | "archived";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  lastLogin?: string;
}

export interface Permission {
  id: string;
  resource: string;
  action: "create" | "read" | "update" | "delete" | "export" | "share";
  conditions?: Record<string, unknown>;
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
  permissions: string[];
  iat: number;
  exp: number;
  jti: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface Case {
  id: string;
  name: string;
  description?: string;
  status: CaseStatus;
  createdBy: string;
  entities: string[];
  tags: string[];
  tlpLevel: TLPLevel;
  createdAt: string;
  updatedAt: string;
}

export type NoteClassification = "unclassified" | "internal" | "confidential" | "restricted";

export interface Note {
  id: string;
  entityId: string;
  content: string;
  author: string;
  classification: NoteClassification;
  createdAt: string;
}

export type AuditAction =
  | "entity.create"
  | "entity.read"
  | "entity.update"
  | "entity.delete"
  | "entity.export"
  | "relationship.create"
  | "relationship.delete"
  | "case.create"
  | "case.update"
  | "case.close"
  | "search.execute"
  | "collection.start"
  | "collection.complete"
  | "user.login"
  | "user.logout"
  | "user.create"
  | "user.update"
  | "user.delete"
  | "alert.create"
  | "alert.trigger"
  | "note.create"
  | "export.download";

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: AuditAction;
  entityType?: EntityType;
  entityId?: string;
  details: Record<string, unknown>;
  sourceIp: string;
  timestamp: string;
  previousHash: string;
}
