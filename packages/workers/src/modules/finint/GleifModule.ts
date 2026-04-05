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

interface GleifEntity {
  type: string;
  id: string;
  attributes: {
    lei: string;
    entity: {
      legalName: { name: string; language: string };
      legalAddress: {
        addressLines: string[];
        city: string;
        region: string;
        country: string;
        postalCode: string;
      };
      headquartersAddress: {
        addressLines: string[];
        city: string;
        region: string;
        country: string;
        postalCode: string;
      };
      registeredAt: { id: string; other: string };
      registeredAs: string;
      jurisdiction: string;
      category: string;
      legalForm: { id: string; other: string };
      status: string;
      creationDate: string;
    };
    registration: {
      initialRegistrationDate: string;
      lastUpdateDate: string;
      status: string;
      nextRenewalDate: string;
      managingLou: string;
    };
  };
}

interface GleifRelationship {
  type: string;
  id: string;
  attributes: {
    relationship: {
      startNode: { id: string; type: string };
      endNode: { id: string; type: string };
      type: string;
      status: string;
    };
  };
}

export class GleifModule extends BaseModule {
  name = 'gleif';
  category = 'finint' as const;
  supportedEntityTypes = ['organization'];
  rateLimit: RateLimitConfig = { maxTokens: 10, refillRate: 5, refillInterval: 1000 };
  cacheTTL = 86400;
  requiresApiKey = false;

  private normalizer: Normalizer;
  private baseUrl = 'https://api.gleif.org/api/v1';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('gleif');
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'organization', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      try {
        const isLei = /^[A-Z0-9]{20}$/.test(entity.toUpperCase());

        if (isLei) {
          const leiResult = await this.makeRequest<{ data: GleifEntity }>({
            url: `${this.baseUrl}/lei-records/${entity.toUpperCase()}`,
            method: 'GET',
          });
          apiCalls++;
          rawData['leiRecord'] = leiResult;

          const leiEntity = this.buildEntityFromGleif(leiResult.data);
          entities.push(leiEntity);

          try {
            const relResult = await this.makeRequest<{ data: GleifRelationship[] }>({
              url: `${this.baseUrl}/lei-records/${entity.toUpperCase()}/direct-child-relationships`,
              method: 'GET',
            });
            apiCalls++;
            rawData['childRelationships'] = relResult;

            for (const rel of relResult.data) {
              const childId = rel.attributes.relationship.startNode.id;
              relationships.push(
                this.normalizer.createRelationship({
                  sourceEntityId: leiEntity.id,
                  targetEntityId: childId,
                  type: 'parent_of',
                  label: 'parent of',
                  attributes: { relationshipType: rel.attributes.relationship.type },
                  confidence: 0.95,
                })
              );
            }
          } catch {
            // No child relationships found
          }

          try {
            const parentResult = await this.makeRequest<{ data: GleifRelationship[] }>({
              url: `${this.baseUrl}/lei-records/${entity.toUpperCase()}/direct-parent-relationship`,
              method: 'GET',
            });
            apiCalls++;
            rawData['parentRelationship'] = parentResult;

            for (const rel of parentResult.data) {
              const parentId = rel.attributes.relationship.endNode.id;
              relationships.push(
                this.normalizer.createRelationship({
                  sourceEntityId: leiEntity.id,
                  targetEntityId: parentId,
                  type: 'child_of',
                  label: 'subsidiary of',
                  confidence: 0.95,
                })
              );
            }
          } catch {
            // No parent relationship found
          }
        } else {
          const searchResult = await this.makeRequest<{
            data: GleifEntity[];
            meta: { pagination: { total: number } };
          }>({
            url: `${this.baseUrl}/lei-records`,
            method: 'GET',
            params: {
              'filter[fulltext]': entity,
              'page[size]': 20,
            },
          });
          apiCalls++;
          rawData['search'] = searchResult;

          for (const record of searchResult.data) {
            entities.push(this.buildEntityFromGleif(record));
          }
        }
      } catch (err) {
        errors.push(this.buildError('GLEIF_ERROR', `GLEIF lookup failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  private buildEntityFromGleif(record: GleifEntity): NormalizedEntity {
    const ent = record.attributes.entity;
    const reg = record.attributes.registration;

    return this.normalizer.createEntity({
      type: 'organization',
      name: ent.legalName.name,
      description: `LEI: ${record.attributes.lei} | ${ent.jurisdiction} | ${ent.category}`,
      attributes: {
        lei: record.attributes.lei,
        jurisdiction: ent.jurisdiction,
        category: ent.category,
        status: ent.status,
        legalForm: ent.legalForm,
        registeredAs: ent.registeredAs,
        legalAddress: ent.legalAddress,
        headquartersAddress: ent.headquartersAddress,
        registrationStatus: reg.status,
        initialRegistrationDate: reg.initialRegistrationDate,
        lastUpdateDate: reg.lastUpdateDate,
        nextRenewalDate: reg.nextRenewalDate,
        managingLou: reg.managingLou,
        creationDate: ent.creationDate,
      },
      sourceUrl: `https://search.gleif.org/#/record/${record.attributes.lei}`,
      confidence: 0.95,
      tags: ['lei', 'gleif', ent.jurisdiction],
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    const data = rawData as Record<string, unknown>;
    const search = data['search'] as { data: GleifEntity[] } | undefined;
    if (!search) return [];
    return search.data.map((r) => this.buildEntityFromGleif(r));
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({
        url: `${this.baseUrl}/lei-records`,
        method: 'GET',
        params: { 'page[size]': 1 },
      }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'GLEIF API unreachable' };
    }
  }
}
