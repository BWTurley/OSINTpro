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

interface S2Author {
  authorId: string;
  name: string;
  affiliations: string[];
  paperCount: number;
  citationCount: number;
  hIndex: number;
  url: string;
}

interface S2Paper {
  paperId: string;
  title: string;
  abstract: string;
  year: number;
  citationCount: number;
  referenceCount: number;
  isOpenAccess: boolean;
  fieldsOfStudy: string[];
  authors: Array<{ authorId: string; name: string }>;
  venue: string;
  url: string;
  externalIds: Record<string, string>;
  publicationDate: string;
}

interface OpenAlexAuthor {
  id: string;
  display_name: string;
  orcid: string;
  works_count: number;
  cited_by_count: number;
  last_known_institutions: Array<{
    id: string;
    display_name: string;
    ror: string;
    country_code: string;
    type: string;
  }>;
  x_concepts: Array<{ id: string; display_name: string; level: number; score: number }>;
}

export class AcademicModule extends BaseModule {
  name = 'academic';
  category = 'people' as const;
  supportedEntityTypes = ['person', 'organization'];
  rateLimit: RateLimitConfig = { maxTokens: 10, refillRate: 10, refillInterval: 1000 };
  cacheTTL = 86400;
  requiresApiKey = false;

  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('academic');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'person', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const headers: Record<string, string> = {};
      if (apiKey) headers['x-api-key'] = apiKey;

      // Semantic Scholar author search
      try {
        const s2Search = await this.makeRequest<{
          total: number;
          data: S2Author[];
        }>({
          url: 'https://api.semanticscholar.org/graph/v1/author/search',
          method: 'GET',
          params: { query: entity, limit: 5, fields: 'authorId,name,affiliations,paperCount,citationCount,hIndex,url' },
          headers,
        });
        apiCalls++;
        rawData['s2Authors'] = s2Search;

        for (const author of s2Search.data) {
          const authorEntity = this.normalizer.createEntity({
            type: 'person',
            name: author.name,
            description: `h-index: ${author.hIndex} | ${author.paperCount} papers | ${author.citationCount} citations`,
            attributes: {
              s2AuthorId: author.authorId,
              affiliations: author.affiliations,
              paperCount: author.paperCount,
              citationCount: author.citationCount,
              hIndex: author.hIndex,
            },
            sourceUrl: author.url,
            confidence: 0.85,
            tags: ['academic', 'semantic-scholar', ...author.affiliations.slice(0, 3)],
          });
          entities.push(authorEntity);

          // Get recent papers
          try {
            const papers = await this.makeRequest<{
              data: S2Paper[];
            }>({
              url: `https://api.semanticscholar.org/graph/v1/author/${author.authorId}/papers`,
              method: 'GET',
              params: {
                limit: 10,
                fields: 'paperId,title,abstract,year,citationCount,referenceCount,isOpenAccess,fieldsOfStudy,authors,venue,url,externalIds,publicationDate',
              },
              headers,
            });
            apiCalls++;

            for (const paper of papers.data) {
              const paperEntity = this.normalizer.createEntity({
                type: 'event',
                name: paper.title,
                description: paper.abstract?.slice(0, 500) || '',
                attributes: {
                  paperId: paper.paperId,
                  year: paper.year,
                  citationCount: paper.citationCount,
                  referenceCount: paper.referenceCount,
                  isOpenAccess: paper.isOpenAccess,
                  fieldsOfStudy: paper.fieldsOfStudy,
                  venue: paper.venue,
                  doi: paper.externalIds?.DOI,
                  publicationDate: paper.publicationDate,
                  coAuthors: paper.authors.map((a) => a.name),
                },
                sourceUrl: paper.url,
                confidence: 0.9,
                tags: ['academic-paper', ...(paper.fieldsOfStudy || [])],
              });
              entities.push(paperEntity);

              relationships.push(
                this.normalizer.createRelationship({
                  sourceEntityId: authorEntity.id,
                  targetEntityId: paperEntity.id,
                  type: 'owns',
                  label: 'authored',
                  confidence: 0.95,
                })
              );
            }
          } catch {
            // Papers supplementary
          }
        }
      } catch (err) {
        errors.push(this.buildError('S2_ERROR', `Semantic Scholar search failed: ${err}`));
      }

      // OpenAlex author search
      try {
        const oaSearch = await this.makeRequest<{
          results: OpenAlexAuthor[];
          meta: { count: number };
        }>({
          url: 'https://api.openalex.org/authors',
          method: 'GET',
          params: { search: entity, per_page: 5 },
          headers: { 'User-Agent': 'OSINT-Dashboard/1.0 (mailto:contact@osint-dashboard.local)' },
        });
        apiCalls++;
        rawData['openAlex'] = oaSearch;

        for (const author of oaSearch.results) {
          const oaEntity = this.normalizer.createEntity({
            type: 'person',
            name: author.display_name,
            description: `OpenAlex: ${author.works_count} works, ${author.cited_by_count} citations`,
            attributes: {
              openAlexId: author.id,
              orcid: author.orcid,
              worksCount: author.works_count,
              citedByCount: author.cited_by_count,
              institutions: author.last_known_institutions,
              topConcepts: author.x_concepts?.slice(0, 10).map((c) => ({
                name: c.display_name,
                score: c.score,
              })),
            },
            sourceUrl: author.id,
            confidence: 0.8,
            tags: ['academic', 'openalex'],
          });
          entities.push(oaEntity);

          for (const inst of author.last_known_institutions || []) {
            const instEntity = this.normalizer.createEntity({
              type: 'organization',
              name: inst.display_name,
              attributes: { ror: inst.ror, countryCode: inst.country_code, type: inst.type },
              confidence: 0.8,
              tags: ['academic-institution'],
            });
            entities.push(instEntity);

            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: oaEntity.id,
                targetEntityId: instEntity.id,
                type: 'affiliated_with',
                label: 'affiliated with',
                confidence: 0.85,
              })
            );
          }
        }
      } catch (err) {
        errors.push(this.buildError('OPENALEX_ERROR', `OpenAlex search failed: ${err}`));
      }

      // ORCID search (if entity looks like ORCID)
      if (/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(entity)) {
        try {
          const orcidResult = await this.makeRequest<{
            'orcid-identifier': { path: string; uri: string };
            person: {
              name: { 'given-names': { value: string }; 'family-name': { value: string } };
              biography?: { content: string };
            };
          }>({
            url: `https://pub.orcid.org/v3.0/${entity}/record`,
            method: 'GET',
            headers: { Accept: 'application/json' },
          });
          apiCalls++;
          rawData['orcid'] = orcidResult;

          const person = orcidResult.person;
          entities.push(
            this.normalizer.createEntity({
              type: 'person',
              name: `${person.name['given-names'].value} ${person.name['family-name'].value}`,
              description: person.biography?.content?.slice(0, 500) || '',
              attributes: { orcid: entity },
              sourceUrl: `https://orcid.org/${entity}`,
              confidence: 0.95,
              tags: ['orcid', 'academic'],
            })
          );
        } catch {
          // ORCID supplementary
        }
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({
        url: 'https://api.semanticscholar.org/graph/v1/author/search',
        method: 'GET',
        params: { query: 'Einstein', limit: 1 },
      }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'Academic APIs unreachable' };
    }
  }
}
