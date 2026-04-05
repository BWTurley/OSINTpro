import { Redis } from 'ioredis';
import { BaseModule } from '../../base/BaseModule.js';
import { Normalizer } from '../../base/Normalizer.js';
import type {
  CollectionResult,
  NormalizedEntity,
  NormalizedRelationship,
  ModuleHealth,
  RateLimitConfig,
  CollectionError,
} from '../../base/types.js';

interface StixObject {
  type: string;
  id: string;
  name?: string;
  description?: string;
  created: string;
  modified: string;
  external_references?: Array<{
    source_name: string;
    external_id?: string;
    url?: string;
    description?: string;
  }>;
  kill_chain_phases?: Array<{ kill_chain_name: string; phase_name: string }>;
  x_mitre_platforms?: string[];
  x_mitre_detection?: string;
  x_mitre_data_sources?: string[];
  x_mitre_is_subtechnique?: boolean;
  x_mitre_deprecated?: boolean;
  x_mitre_version?: string;
  aliases?: string[];
  relationship_type?: string;
  source_ref?: string;
  target_ref?: string;
}

interface StixBundle {
  type: string;
  id: string;
  objects: StixObject[];
}

export class MitreAttackModule extends BaseModule {
  name = 'mitre-attack';
  category = 'cti' as const;
  supportedEntityTypes = ['vulnerability', 'malware', 'campaign', 'organization'];
  rateLimit: RateLimitConfig = { maxTokens: 5, refillRate: 5, refillInterval: 60000 };
  cacheTTL = 86400;
  requiresApiKey = false;

  private normalizer: Normalizer;
  private stixUrl = 'https://raw.githubusercontent.com/mitre/ctr/master/enterprise-attack/enterprise-attack.json';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('mitre-attack');
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'campaign', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      try {
        // Check cache for full STIX bundle
        const cacheKey = 'mitre-attack:stix-bundle';
        let bundle = await this.cache.get<StixBundle>(cacheKey);

        if (!bundle) {
          bundle = await this.makeRequest<StixBundle>({
            url: this.stixUrl,
            method: 'GET',
            timeout: 60000,
          });
          apiCalls++;
          await this.cache.set(cacheKey, bundle, 86400);
        }

        const query = entity.toLowerCase();
        const isTechniqueId = /^t\d{4}(\.\d{3})?$/i.test(entity);

        const matchingObjects = bundle.objects.filter((obj) => {
          if (obj.x_mitre_deprecated) return false;
          if (!obj.name) return false;

          if (isTechniqueId) {
            const extRef = obj.external_references?.find(
              (r) => r.source_name === 'mitre-attack' && r.external_id?.toLowerCase() === query
            );
            return !!extRef;
          }

          return (
            obj.name.toLowerCase().includes(query) ||
            obj.description?.toLowerCase().includes(query) ||
            obj.aliases?.some((a) => a.toLowerCase().includes(query)) ||
            obj.external_references?.some((r) => r.external_id?.toLowerCase() === query)
          );
        });

        rawData['matchCount'] = matchingObjects.length;
        rawData['bundleObjectCount'] = bundle.objects.length;

        for (const obj of matchingObjects.slice(0, 30)) {
          const mitreId = obj.external_references?.find(
            (r) => r.source_name === 'mitre-attack'
          )?.external_id;
          const mitreUrl = obj.external_references?.find(
            (r) => r.source_name === 'mitre-attack'
          )?.url;

          const typeMap: Record<string, 'campaign' | 'malware' | 'vulnerability' | 'indicator'> = {
            'attack-pattern': 'indicator',
            malware: 'malware',
            tool: 'indicator',
            campaign: 'campaign',
            'intrusion-set': 'campaign',
            'course-of-action': 'indicator',
          };

          const entityType = typeMap[obj.type] || 'indicator';

          const mitreEntity = this.normalizer.createEntity({
            type: entityType,
            name: `${mitreId ? `${mitreId}: ` : ''}${obj.name}`,
            description: obj.description?.slice(0, 1000) || '',
            attributes: {
              stixId: obj.id,
              stixType: obj.type,
              mitreId,
              created: obj.created,
              modified: obj.modified,
              killChainPhases: obj.kill_chain_phases,
              platforms: obj.x_mitre_platforms,
              detection: obj.x_mitre_detection?.slice(0, 500),
              dataSources: obj.x_mitre_data_sources,
              isSubtechnique: obj.x_mitre_is_subtechnique,
              aliases: obj.aliases,
              version: obj.x_mitre_version,
            },
            sourceUrl: mitreUrl || `https://attack.mitre.org/`,
            confidence: 0.95,
            tags: [
              'mitre-attack',
              obj.type,
              ...(obj.kill_chain_phases?.map((p) => p.phase_name) || []),
              ...(obj.x_mitre_platforms || []),
            ],
          });
          entities.push(mitreEntity);
        }

        // Find relationships between matched objects
        const matchedIds = new Set(matchingObjects.map((o) => o.id));
        const relObjects = bundle.objects.filter(
          (obj) =>
            obj.type === 'relationship' &&
            obj.source_ref &&
            obj.target_ref &&
            (matchedIds.has(obj.source_ref) || matchedIds.has(obj.target_ref))
        );

        for (const rel of relObjects.slice(0, 50)) {
          if (rel.source_ref && rel.target_ref) {
            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: rel.source_ref,
                targetEntityId: rel.target_ref,
                type: 'uses',
                label: rel.relationship_type || 'related',
                attributes: { stixRelType: rel.relationship_type },
                confidence: 0.9,
              })
            );
          }
        }
      } catch (err) {
        errors.push(this.buildError('MITRE_ERROR', `MITRE ATT&CK lookup failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    return [];
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.head(this.stixUrl, { timeout: 5000 });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'MITRE ATT&CK STIX unreachable' };
    }
  }
}
