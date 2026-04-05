export const ENTITY_TYPES = {
  PERSON: "person",
  ORGANIZATION: "organization",
  LOCATION: "location",
  DOMAIN: "domain",
  IP_ADDRESS: "ip-address",
  EMAIL_ADDRESS: "email-address",
  PHONE_NUMBER: "phone-number",
  USERNAME: "username",
  FINANCIAL_ACCOUNT: "financial-account",
  VEHICLE: "vehicle",
  INDICATOR: "indicator",
  THREAT_ACTOR: "threat-actor",
  CAMPAIGN: "campaign",
  VULNERABILITY: "vulnerability",
  DOCUMENT: "document",
  EVENT: "event",
} as const;

export type EntityTypeValue = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

export const ENTITY_TYPE_LABELS: Record<EntityTypeValue, string> = {
  "person": "Person",
  "organization": "Organization",
  "location": "Location",
  "domain": "Domain",
  "ip-address": "IP Address",
  "email-address": "Email Address",
  "phone-number": "Phone Number",
  "username": "Username",
  "financial-account": "Financial Account",
  "vehicle": "Vehicle",
  "indicator": "Indicator",
  "threat-actor": "Threat Actor",
  "campaign": "Campaign",
  "vulnerability": "Vulnerability",
  "document": "Document",
  "event": "Event",
};

export const ENTITY_TYPE_ICONS: Record<EntityTypeValue, string> = {
  "person": "user",
  "organization": "building",
  "location": "map-pin",
  "domain": "globe",
  "ip-address": "server",
  "email-address": "mail",
  "phone-number": "phone",
  "username": "at-sign",
  "financial-account": "credit-card",
  "vehicle": "truck",
  "indicator": "alert-triangle",
  "threat-actor": "skull",
  "campaign": "target",
  "vulnerability": "shield-alert",
  "document": "file-text",
  "event": "calendar",
};

export const ALL_ENTITY_TYPES = Object.values(ENTITY_TYPES);
