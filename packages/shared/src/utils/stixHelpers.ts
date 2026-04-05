import type { Entity, EntityType } from "../types/entities.js";
import type { Relationship } from "../types/relationships.js";

interface StixObject {
  type: string;
  spec_version: string;
  id: string;
  created: string;
  modified: string;
  [key: string]: unknown;
}

interface StixRelationship extends StixObject {
  type: "relationship";
  relationship_type: string;
  source_ref: string;
  target_ref: string;
  confidence?: number;
  description?: string;
  start_time?: string;
  stop_time?: string;
}

interface StixBundle {
  type: "bundle";
  id: string;
  spec_version: string;
  objects: StixObject[];
}

const ENTITY_TYPE_TO_STIX: Record<EntityType, string> = {
  "person": "identity",
  "organization": "identity",
  "location": "location",
  "domain": "domain-name",
  "ip-address": "ipv4-addr",
  "email-address": "email-addr",
  "phone-number": "x-osint-phone-number",
  "username": "user-account",
  "financial-account": "x-osint-financial-account",
  "vehicle": "x-osint-vehicle",
  "indicator": "indicator",
  "threat-actor": "threat-actor",
  "campaign": "campaign",
  "vulnerability": "vulnerability",
  "document": "note",
  "event": "x-osint-event",
};

const STIX_TO_ENTITY_TYPE: Record<string, EntityType> = {
  "identity": "person",
  "location": "location",
  "domain-name": "domain",
  "ipv4-addr": "ip-address",
  "ipv6-addr": "ip-address",
  "email-addr": "email-address",
  "x-osint-phone-number": "phone-number",
  "user-account": "username",
  "x-osint-financial-account": "financial-account",
  "x-osint-vehicle": "vehicle",
  "indicator": "indicator",
  "threat-actor": "threat-actor",
  "campaign": "campaign",
  "vulnerability": "vulnerability",
  "note": "document",
  "x-osint-event": "event",
};

function generateStixId(type: string, uuid: string): string {
  return `${type}--${uuid}`;
}

function extractUuidFromStixId(stixId: string): string {
  const parts = stixId.split("--");
  return parts.length > 1 ? parts[1] : stixId;
}

function buildIdentityProperties(entity: Entity): Record<string, unknown> {
  if (entity.entityType === "person") {
    return {
      name: entity.name,
      identity_class: "individual",
      aliases: entity.aliases.length > 0 ? entity.aliases : undefined,
      x_nationality: entity.nationality.length > 0 ? entity.nationality : undefined,
      x_date_of_birth: entity.dateOfBirth,
    };
  }
  if (entity.entityType === "organization") {
    return {
      name: entity.name,
      identity_class: "organization",
      aliases: entity.aliases.length > 0 ? entity.aliases : undefined,
      sectors: entity.industry.length > 0 ? entity.industry : undefined,
      x_jurisdiction: entity.jurisdiction,
      x_incorporation_date: entity.incorporationDate,
      x_status: entity.status,
    };
  }
  return {};
}

function buildEntityProperties(entity: Entity): Record<string, unknown> {
  switch (entity.entityType) {
    case "person":
    case "organization":
      return buildIdentityProperties(entity);

    case "location":
      return {
        latitude: entity.coordinates?.latitude,
        longitude: entity.coordinates?.longitude,
        street_address: entity.address,
        city: entity.city,
        administrative_area: entity.stateProvince,
        country: entity.country,
        postal_code: entity.postalCode,
        x_location_type: entity.locationType,
      };

    case "domain":
      return {
        value: entity.domainName,
        x_registrar: entity.registrar,
        x_registration_date: entity.registrationDate,
        x_expiration_date: entity.expirationDate,
        x_nameservers: entity.nameservers,
        x_technologies: entity.technologies,
      };

    case "ip-address":
      return {
        value: entity.ip,
        x_version: entity.version,
        x_asn: entity.asn,
        x_as_org: entity.asOrg,
      };

    case "email-address":
      return {
        value: entity.email,
        display_name: entity.provider,
        x_verified: entity.verified,
      };

    case "phone-number":
      return {
        x_number: entity.number,
        x_carrier: entity.carrier,
        x_phone_type: entity.type,
        x_country: entity.country,
        x_owner_name: entity.ownerName,
      };

    case "username":
      return {
        user_id: entity.username,
        account_login: entity.username,
        display_name: entity.displayName,
        x_platform: entity.platform,
        x_profile_url: entity.profileUrl,
        x_bio: entity.bio,
        x_followers: entity.followers,
        x_following: entity.following,
      };

    case "financial-account":
      return {
        x_account_type: entity.accountType,
        x_institution: entity.institution,
        x_currency: entity.currency,
      };

    case "vehicle":
      return {
        x_vehicle_type: entity.vehicleType,
        x_registration: entity.registration,
        x_name: entity.name,
        x_owner: entity.owner,
        x_flag_state: entity.flagState,
      };

    case "indicator":
      return {
        indicator_types: [entity.indicatorType],
        pattern: entity.pattern ?? `[x-osint:value = '${entity.value}']`,
        pattern_type: "stix",
        valid_from: entity.validFrom,
        valid_until: entity.validUntil,
        kill_chain_phases: entity.killChainPhases.map((k) => ({
          kill_chain_name: k.killChainName,
          phase_name: k.phaseName,
        })),
        x_malware_families: entity.malwareFamilies,
      };

    case "threat-actor":
      return {
        name: entity.name,
        aliases: entity.aliases.length > 0 ? entity.aliases : undefined,
        description: entity.description,
        threat_actor_types: entity.motivation,
        sophistication: entity.sophistication,
        first_seen: entity.firstSeen,
        last_seen: entity.lastSeen,
        x_country: entity.country,
      };

    case "campaign":
      return {
        name: entity.name,
        description: entity.description,
        objective: entity.objective,
        first_seen: entity.firstSeen,
        last_seen: entity.lastSeen,
        x_status: entity.status,
      };

    case "vulnerability":
      return {
        name: entity.cveId,
        description: entity.description,
        x_cvss_score: entity.cvssScore,
        x_cvss_vector: entity.cvssVector,
        x_severity: entity.severity,
        x_exploit_available: entity.exploitAvailable,
        x_cisa_kev: entity.cisaKev,
        x_published_date: entity.publishedDate,
        external_references: entity.references.map((ref) => ({
          source_name: "reference",
          url: ref,
        })),
      };

    case "document":
      return {
        abstract: entity.title,
        content: entity.content,
        x_source: entity.source,
        x_source_url: entity.sourceUrl,
        x_content_type: entity.contentType,
        x_language: entity.language,
        x_published_date: entity.publishedDate,
      };

    case "event":
      return {
        x_event_type: entity.eventType,
        x_description: entity.description,
        x_timestamp: entity.timestamp,
        x_location_id: entity.locationId,
        x_actors: entity.actors,
        x_gdelt_event_id: entity.gdeltEventId,
        x_acled_event_id: entity.acledEventId,
      };
  }
}

export function entityToStix(entity: Entity): StixObject {
  const stixType = ENTITY_TYPE_TO_STIX[entity.entityType];
  const properties = buildEntityProperties(entity);

  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(properties)) {
    if (v !== undefined && v !== null) {
      cleaned[k] = v;
    }
  }

  return {
    type: stixType,
    spec_version: "2.1",
    id: generateStixId(stixType, entity.id),
    created: entity.createdAt,
    modified: entity.updatedAt,
    confidence: Math.round(entity.confidence * 100),
    object_marking_refs: [],
    labels: entity.tags,
    ...cleaned,
  };
}

export function relationshipToStix(relationship: Relationship): StixRelationship {
  const sourceStixType = ENTITY_TYPE_TO_STIX[relationship.sourceEntityType];
  const targetStixType = ENTITY_TYPE_TO_STIX[relationship.targetEntityType];

  return {
    type: "relationship",
    spec_version: "2.1",
    id: generateStixId("relationship", relationship.id),
    created: relationship.createdAt,
    modified: relationship.updatedAt,
    relationship_type: relationship.relationshipType,
    source_ref: generateStixId(sourceStixType, relationship.sourceEntityId),
    target_ref: generateStixId(targetStixType, relationship.targetEntityId),
    confidence: Math.round(relationship.confidence * 100),
    description: relationship.description,
    start_time: relationship.startDate,
    stop_time: relationship.endDate,
  };
}

export function bundleToStix(
  entities: Entity[],
  relationships: Relationship[]
): StixBundle {
  const bundleId = `bundle--${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
  const objects: StixObject[] = [
    ...entities.map(entityToStix),
    ...relationships.map(relationshipToStix),
  ];

  return {
    type: "bundle",
    id: bundleId,
    spec_version: "2.1",
    objects,
  };
}

export function stixToEntity(stix: StixObject): {
  entityType: EntityType;
  id: string;
  data: Record<string, unknown>;
} | null {
  const stixType = stix.type;

  let entityType: EntityType | undefined;

  if (stixType === "identity") {
    const identityClass = stix["identity_class"] as string | undefined;
    entityType = identityClass === "organization" ? "organization" : "person";
  } else {
    entityType = STIX_TO_ENTITY_TYPE[stixType];
  }

  if (!entityType) {
    return null;
  }

  const id = extractUuidFromStixId(stix.id);

  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(stix)) {
    if (key !== "type" && key !== "spec_version" && key !== "id" && key !== "created" && key !== "modified") {
      data[key] = value;
    }
  }

  return {
    entityType,
    id,
    data,
  };
}
