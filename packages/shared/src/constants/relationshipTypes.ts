export const RELATIONSHIP_TYPES = {
  // Person relationships
  ASSOCIATED_WITH: "associated-with",
  EMPLOYED_BY: "employed-by",
  FAMILY_MEMBER_OF: "family-member-of",
  KNOWN_ASSOCIATE_OF: "known-associate-of",
  SAME_AS: "same-as",

  // Organization relationships
  SUBSIDIARY_OF: "subsidiary-of",
  PARENT_OF: "parent-of",
  PARTNER_OF: "partner-of",
  COMPETITOR_OF: "competitor-of",
  SUPPLIER_OF: "supplier-of",
  CLIENT_OF: "client-of",

  // Ownership and control
  OWNS: "owns",
  CONTROLS: "controls",
  BENEFICIAL_OWNER_OF: "beneficial-owner-of",
  SHAREHOLDER_OF: "shareholder-of",
  DIRECTOR_OF: "director-of",
  OFFICER_OF: "officer-of",

  // Location relationships
  LOCATED_AT: "located-at",
  HEADQUARTERED_AT: "headquartered-at",
  OPERATES_IN: "operates-in",
  REGISTERED_IN: "registered-in",
  INCORPORATED_IN: "incorporated-in",

  // Infrastructure relationships
  RESOLVES_TO: "resolves-to",
  HOSTED_ON: "hosted-on",
  REGISTERED_WITH: "registered-with",
  COMMUNICATES_WITH: "communicates-with",
  SUBDOMAIN_OF: "subdomain-of",
  BELONGS_TO: "belongs-to",

  // Threat relationships
  ATTRIBUTED_TO: "attributed-to",
  TARGETS: "targets",
  USES: "uses",
  EXPLOITS: "exploits",
  DELIVERS: "delivers",
  DROPS: "drops",
  INDICATES: "indicates",
  MITIGATES: "mitigates",
  VARIANT_OF: "variant-of",

  // Financial relationships
  TRANSACTED_WITH: "transacted-with",
  FUNDED_BY: "funded-by",
  ACCOUNT_HOLDER_OF: "account-holder-of",

  // Communication relationships
  CONTACTED: "contacted",
  EMAILED: "emailed",
  MENTIONED_IN: "mentioned-in",
  AUTHORED: "authored",

  // Event relationships
  PARTICIPATED_IN: "participated-in",
  WITNESSED: "witnessed",
  CAUSED: "caused",
  RELATED_TO: "related-to",
} as const;

export type RelationshipTypeValue = (typeof RELATIONSHIP_TYPES)[keyof typeof RELATIONSHIP_TYPES];

export interface RelationshipTypeMetadata {
  value: RelationshipTypeValue;
  label: string;
  category: string;
  bidirectional: boolean;
  inverseType?: RelationshipTypeValue;
}

export const RELATIONSHIP_TYPE_METADATA: Record<RelationshipTypeValue, RelationshipTypeMetadata> = {
  "associated-with": { value: "associated-with", label: "Associated With", category: "person", bidirectional: true },
  "employed-by": { value: "employed-by", label: "Employed By", category: "person", bidirectional: false },
  "family-member-of": { value: "family-member-of", label: "Family Member Of", category: "person", bidirectional: true },
  "known-associate-of": { value: "known-associate-of", label: "Known Associate Of", category: "person", bidirectional: true },
  "same-as": { value: "same-as", label: "Same As", category: "person", bidirectional: true },
  "subsidiary-of": { value: "subsidiary-of", label: "Subsidiary Of", category: "organization", bidirectional: false, inverseType: "parent-of" },
  "parent-of": { value: "parent-of", label: "Parent Of", category: "organization", bidirectional: false, inverseType: "subsidiary-of" },
  "partner-of": { value: "partner-of", label: "Partner Of", category: "organization", bidirectional: true },
  "competitor-of": { value: "competitor-of", label: "Competitor Of", category: "organization", bidirectional: true },
  "supplier-of": { value: "supplier-of", label: "Supplier Of", category: "organization", bidirectional: false, inverseType: "client-of" },
  "client-of": { value: "client-of", label: "Client Of", category: "organization", bidirectional: false, inverseType: "supplier-of" },
  "owns": { value: "owns", label: "Owns", category: "ownership", bidirectional: false },
  "controls": { value: "controls", label: "Controls", category: "ownership", bidirectional: false },
  "beneficial-owner-of": { value: "beneficial-owner-of", label: "Beneficial Owner Of", category: "ownership", bidirectional: false },
  "shareholder-of": { value: "shareholder-of", label: "Shareholder Of", category: "ownership", bidirectional: false },
  "director-of": { value: "director-of", label: "Director Of", category: "ownership", bidirectional: false },
  "officer-of": { value: "officer-of", label: "Officer Of", category: "ownership", bidirectional: false },
  "located-at": { value: "located-at", label: "Located At", category: "location", bidirectional: false },
  "headquartered-at": { value: "headquartered-at", label: "Headquartered At", category: "location", bidirectional: false },
  "operates-in": { value: "operates-in", label: "Operates In", category: "location", bidirectional: false },
  "registered-in": { value: "registered-in", label: "Registered In", category: "location", bidirectional: false },
  "incorporated-in": { value: "incorporated-in", label: "Incorporated In", category: "location", bidirectional: false },
  "resolves-to": { value: "resolves-to", label: "Resolves To", category: "infrastructure", bidirectional: false },
  "hosted-on": { value: "hosted-on", label: "Hosted On", category: "infrastructure", bidirectional: false },
  "registered-with": { value: "registered-with", label: "Registered With", category: "infrastructure", bidirectional: false },
  "communicates-with": { value: "communicates-with", label: "Communicates With", category: "infrastructure", bidirectional: true },
  "subdomain-of": { value: "subdomain-of", label: "Subdomain Of", category: "infrastructure", bidirectional: false },
  "belongs-to": { value: "belongs-to", label: "Belongs To", category: "infrastructure", bidirectional: false },
  "attributed-to": { value: "attributed-to", label: "Attributed To", category: "threat", bidirectional: false },
  "targets": { value: "targets", label: "Targets", category: "threat", bidirectional: false },
  "uses": { value: "uses", label: "Uses", category: "threat", bidirectional: false },
  "exploits": { value: "exploits", label: "Exploits", category: "threat", bidirectional: false },
  "delivers": { value: "delivers", label: "Delivers", category: "threat", bidirectional: false },
  "drops": { value: "drops", label: "Drops", category: "threat", bidirectional: false },
  "indicates": { value: "indicates", label: "Indicates", category: "threat", bidirectional: false },
  "mitigates": { value: "mitigates", label: "Mitigates", category: "threat", bidirectional: false },
  "variant-of": { value: "variant-of", label: "Variant Of", category: "threat", bidirectional: true },
  "transacted-with": { value: "transacted-with", label: "Transacted With", category: "financial", bidirectional: true },
  "funded-by": { value: "funded-by", label: "Funded By", category: "financial", bidirectional: false },
  "account-holder-of": { value: "account-holder-of", label: "Account Holder Of", category: "financial", bidirectional: false },
  "contacted": { value: "contacted", label: "Contacted", category: "communication", bidirectional: true },
  "emailed": { value: "emailed", label: "Emailed", category: "communication", bidirectional: true },
  "mentioned-in": { value: "mentioned-in", label: "Mentioned In", category: "communication", bidirectional: false },
  "authored": { value: "authored", label: "Authored", category: "communication", bidirectional: false },
  "participated-in": { value: "participated-in", label: "Participated In", category: "event", bidirectional: false },
  "witnessed": { value: "witnessed", label: "Witnessed", category: "event", bidirectional: false },
  "caused": { value: "caused", label: "Caused", category: "event", bidirectional: false },
  "related-to": { value: "related-to", label: "Related To", category: "event", bidirectional: true },
};

export const RELATIONSHIP_CATEGORIES = [
  "person",
  "organization",
  "ownership",
  "location",
  "infrastructure",
  "threat",
  "financial",
  "communication",
  "event",
] as const;

export type RelationshipCategory = (typeof RELATIONSHIP_CATEGORIES)[number];

export const ALL_RELATIONSHIP_TYPES = Object.values(RELATIONSHIP_TYPES);
