import { Client } from '@elastic/elasticsearch';
import { Entity } from '@prisma/client';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const ENTITY_INDEX = 'osint-entities';

export interface SearchHit {
  id: string;
  entityType: string;
  data: Record<string, unknown>;
  confidence: number;
  tags: string[];
  score: number;
}

export interface SearchResults {
  hits: SearchHit[];
  total: number;
  aggregations?: Record<string, unknown>;
  suggestions?: string[];
}

export interface FacetedSearchFilters {
  query: string;
  entityTypes?: string[];
  tlpLevels?: string[];
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  confidenceMin?: number;
  confidenceMax?: number;
  page?: number;
  size?: number;
}

export class SearchService {
  private client: Client;

  constructor() {
    const clientConfig: { node: string; auth?: { username: string; password: string } } = {
      node: config.ELASTICSEARCH_URL,
    };

    if (config.ELASTICSEARCH_USERNAME && config.ELASTICSEARCH_PASSWORD) {
      clientConfig.auth = {
        username: config.ELASTICSEARCH_USERNAME,
        password: config.ELASTICSEARCH_PASSWORD,
      };
    }

    this.client = new Client(clientConfig);
  }

  async initialize(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index: ENTITY_INDEX });
      if (!exists) {
        await this.client.indices.create({
          index: ENTITY_INDEX,
          body: {
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              analysis: {
                analyzer: {
                  entity_analyzer: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: ['lowercase', 'asciifolding', 'edge_ngram_filter'],
                  },
                },
                filter: {
                  edge_ngram_filter: {
                    type: 'edge_ngram',
                    min_gram: 2,
                    max_gram: 20,
                  },
                },
              },
            },
            mappings: {
              properties: {
                entityType: { type: 'keyword' },
                data: { type: 'object', enabled: true },
                'data.name': { type: 'text', analyzer: 'entity_analyzer', fields: { keyword: { type: 'keyword' } } },
                'data.value': { type: 'text', analyzer: 'entity_analyzer', fields: { keyword: { type: 'keyword' } } },
                'data.description': { type: 'text' },
                confidence: { type: 'float' },
                admiraltySource: { type: 'keyword' },
                admiraltyCredibility: { type: 'keyword' },
                tlpLevel: { type: 'keyword' },
                tags: { type: 'keyword' },
                sources: { type: 'object', enabled: false },
                createdAt: { type: 'date' },
                updatedAt: { type: 'date' },
                suggest: {
                  type: 'completion',
                  analyzer: 'simple',
                },
              },
            },
          },
        });
        logger.info('Created Elasticsearch index: %s', ENTITY_INDEX);
      }
    } catch (err) {
      logger.error({ err }, 'Failed to initialize Elasticsearch index');
    }
  }

  async indexEntity(entity: Entity): Promise<void> {
    const data = entity.data as Record<string, unknown>;
    const suggestInput: string[] = [];

    if (typeof data.name === 'string') suggestInput.push(data.name);
    if (typeof data.value === 'string') suggestInput.push(data.value);
    if (entity.tags.length > 0) suggestInput.push(...entity.tags);

    await this.client.index({
      index: ENTITY_INDEX,
      id: entity.id,
      body: {
        entityType: entity.entityType,
        data,
        confidence: entity.confidence,
        admiraltySource: entity.admiraltySource,
        admiraltyCredibility: entity.admiraltyCredibility,
        tlpLevel: entity.tlpLevel,
        tags: entity.tags,
        sources: entity.sources,
        createdAt: entity.createdAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
        suggest: {
          input: suggestInput.length > 0 ? suggestInput : [entity.entityType],
        },
      },
      refresh: 'wait_for',
    });
  }

  async deleteEntity(id: string): Promise<void> {
    try {
      await this.client.delete({
        index: ENTITY_INDEX,
        id,
        refresh: 'wait_for',
      });
    } catch (err: unknown) {
      const esErr = err as { meta?: { statusCode?: number } };
      if (esErr.meta?.statusCode === 404) return;
      throw err;
    }
  }

  async search(filters: FacetedSearchFilters): Promise<SearchResults> {
    const must: Array<Record<string, unknown>> = [];
    const filterClauses: Array<Record<string, unknown>> = [];

    // Full-text query
    if (filters.query) {
      must.push({
        multi_match: {
          query: filters.query,
          fields: ['data.name^3', 'data.value^2', 'data.description', 'tags^1.5'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Entity type filter
    if (filters.entityTypes && filters.entityTypes.length > 0) {
      filterClauses.push({ terms: { entityType: filters.entityTypes } });
    }

    // TLP level filter
    if (filters.tlpLevels && filters.tlpLevels.length > 0) {
      filterClauses.push({ terms: { tlpLevel: filters.tlpLevels } });
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      filterClauses.push({ terms: { tags: filters.tags } });
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      const range: Record<string, string> = {};
      if (filters.dateFrom) range.gte = filters.dateFrom;
      if (filters.dateTo) range.lte = filters.dateTo;
      filterClauses.push({ range: { createdAt: range } });
    }

    // Confidence range filter
    if (filters.confidenceMin !== undefined || filters.confidenceMax !== undefined) {
      const range: Record<string, number> = {};
      if (filters.confidenceMin !== undefined) range.gte = filters.confidenceMin;
      if (filters.confidenceMax !== undefined) range.lte = filters.confidenceMax;
      filterClauses.push({ range: { confidence: range } });
    }

    const page = filters.page ?? 0;
    const size = filters.size ?? 25;

    const result = await this.client.search({
      index: ENTITY_INDEX,
      body: {
        query: {
          bool: {
            must: must.length > 0 ? must : [{ match_all: {} }],
            filter: filterClauses,
          },
        },
        from: page * size,
        size,
        sort: [{ _score: 'desc' }, { createdAt: 'desc' }],
        aggs: {
          entityTypes: { terms: { field: 'entityType', size: 20 } },
          tlpLevels: { terms: { field: 'tlpLevel', size: 10 } },
          tags: { terms: { field: 'tags', size: 50 } },
          avgConfidence: { avg: { field: 'confidence' } },
          dateHistogram: {
            date_histogram: { field: 'createdAt', calendar_interval: 'day' },
          },
        },
      },
    });

    const hits: SearchHit[] = [];
    const hitsArray = (result.hits?.hits ?? []) as Array<{
      _id: string;
      _score: number | null;
      _source: Record<string, unknown>;
    }>;

    for (const hit of hitsArray) {
      const source = hit._source;
      hits.push({
        id: hit._id,
        entityType: source.entityType as string,
        data: source.data as Record<string, unknown>,
        confidence: source.confidence as number,
        tags: source.tags as string[],
        score: hit._score ?? 0,
      });
    }

    const totalValue = result.hits?.total;
    const total = typeof totalValue === 'number'
      ? totalValue
      : (totalValue as { value: number })?.value ?? 0;

    return {
      hits,
      total,
      aggregations: result.aggregations as Record<string, unknown> | undefined,
    };
  }

  async suggest(prefix: string, size: number = 5): Promise<string[]> {
    const result = await this.client.search({
      index: ENTITY_INDEX,
      body: {
        suggest: {
          entity_suggest: {
            prefix,
            completion: {
              field: 'suggest',
              size,
              fuzzy: { fuzziness: 'AUTO' },
            },
          },
        },
      },
    });

    const suggestions = result.suggest?.entity_suggest;
    if (!suggestions || !Array.isArray(suggestions)) return [];

    const options = (suggestions[0] as { options: Array<{ text: string }> })?.options ?? [];
    return options.map((opt) => opt.text);
  }

  async findSimilar(entityId: string, entityType: string, threshold: number = 0.7): Promise<Array<{ id: string; score: number }>> {
    const result = await this.client.search({
      index: ENTITY_INDEX,
      body: {
        query: {
          bool: {
            must: [
              {
                more_like_this: {
                  fields: ['data.name', 'data.value', 'data.description', 'tags'],
                  like: [{ _index: ENTITY_INDEX, _id: entityId }],
                  min_term_freq: 1,
                  min_doc_freq: 1,
                  minimum_should_match: `${Math.round(threshold * 100)}%`,
                },
              },
            ],
            filter: [
              { term: { entityType } },
            ],
          },
        },
        size: 10,
      },
    });

    const hitsArray = (result.hits?.hits ?? []) as Array<{ _id: string; _score: number | null }>;
    return hitsArray.map((hit) => ({
      id: hit._id,
      score: hit._score ?? 0,
    }));
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.cluster.health();
      return result.status === 'green' || result.status === 'yellow';
    } catch {
      return false;
    }
  }
}
