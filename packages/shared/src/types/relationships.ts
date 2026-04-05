import type { EntityType, AdmiraltySourceReliability, AdmiraltyInformationCredibility } from "./entities.js";

export type RelationshipType =
  // Person relationships
  | "associated-with"
  | "employed-by"
  | "family-member-of"
  | "known-associate-of"
  | "same-as"
  // Organization relationships
  | "subsidiary-of"
  | "parent-of"
  | "partner-of"
  | "competitor-of"
  | "supplier-of"
  | "client-of"
  // Ownership and control
  | "owns"
  | "controls"
  | "beneficial-owner-of"
  | "shareholder-of"
  | "director-of"
  | "officer-of"
  // Location relationships
  | "located-at"
  | "headquartered-at"
  | "operates-in"
  | "registered-in"
  | "incorporated-in"
  // Infrastructure relationships
  | "resolves-to"
  | "hosted-on"
  | "registered-with"
  | "communicates-with"
  | "subdomain-of"
  | "belongs-to"
  // Threat relationships
  | "attributed-to"
  | "targets"
  | "uses"
  | "exploits"
  | "delivers"
  | "drops"
  | "indicates"
  | "mitigates"
  | "variant-of"
  // Financial relationships
  | "transacted-with"
  | "funded-by"
  | "account-holder-of"
  // Communication relationships
  | "contacted"
  | "emailed"
  | "mentioned-in"
  | "authored"
  // Event relationships
  | "participated-in"
  | "witnessed"
  | "caused"
  | "related-to";

export interface Relationship {
  id: string;
  sourceEntityId: string;
  sourceEntityType: EntityType;
  targetEntityId: string;
  targetEntityType: EntityType;
  relationshipType: RelationshipType;
  confidence: number;
  admiraltySourceReliability: AdmiraltySourceReliability;
  admiraltyInformationCredibility: AdmiraltyInformationCredibility;
  source: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedRelationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: RelationshipType;
  confidence: number;
  source: string;
  metadata: Record<string, unknown>;
}
