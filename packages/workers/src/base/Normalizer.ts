import { v4 as uuidv4 } from 'uuid';
import type {
  NormalizedEntity,
  NormalizedRelationship,
  EntityType,
  RelationshipType,
} from './types.js';

export class Normalizer {
  protected source: string;

  constructor(source: string) {
    this.source = source;
  }

  createEntity(params: {
    type: EntityType;
    name: string;
    description?: string;
    attributes?: Record<string, unknown>;
    sourceUrl?: string;
    confidence?: number;
    tags?: string[];
    raw?: unknown;
    id?: string;
  }): NormalizedEntity {
    const now = new Date().toISOString();
    return {
      id: params.id || uuidv4(),
      type: params.type,
      name: params.name,
      description: params.description || '',
      attributes: params.attributes || {},
      source: this.source,
      sourceUrl: params.sourceUrl || '',
      confidence: params.confidence ?? 0.8,
      firstSeen: now,
      lastSeen: now,
      tags: params.tags || [],
      raw: params.raw,
    };
  }

  createRelationship(params: {
    sourceEntityId: string;
    targetEntityId: string;
    type: RelationshipType;
    label?: string;
    attributes?: Record<string, unknown>;
    confidence?: number;
    id?: string;
  }): NormalizedRelationship {
    const now = new Date().toISOString();
    return {
      id: params.id || uuidv4(),
      sourceEntityId: params.sourceEntityId,
      targetEntityId: params.targetEntityId,
      type: params.type,
      label: params.label || params.type,
      attributes: params.attributes || {},
      confidence: params.confidence ?? 0.7,
      source: this.source,
      firstSeen: now,
      lastSeen: now,
    };
  }

  extractDomain(input: string): string | null {
    try {
      if (input.includes('@')) {
        return input.split('@')[1]?.toLowerCase() || null;
      }
      if (input.includes('://')) {
        return new URL(input).hostname.toLowerCase();
      }
      return input.toLowerCase();
    } catch {
      return null;
    }
  }

  normalizeIp(ip: string): string {
    return ip.trim().toLowerCase();
  }

  normalizeHash(hash: string): string {
    return hash.trim().toLowerCase();
  }

  normalizeDomain(domain: string): string {
    return domain.trim().toLowerCase().replace(/^www\./, '');
  }

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  parseTimestamp(input: string | number | Date): string {
    const d = new Date(input);
    if (isNaN(d.getTime())) {
      return new Date().toISOString();
    }
    return d.toISOString();
  }

  truncate(str: string, maxLen: number = 1000): string {
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen) + '...';
  }
}
