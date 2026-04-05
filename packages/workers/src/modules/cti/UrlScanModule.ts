import Redis from 'ioredis';
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

interface UrlScanSearchResult {
  results: Array<{
    _id: string;
    page: {
      url: string;
      domain: string;
      ip: string;
      country: string;
      city: string;
      server: string;
      mimeType: string;
      title: string;
      status: string;
      asn: string;
      asnname: string;
    };
    stats: { uniqIPs: number; uniqCountries: number; dataLength: number; requests: number };
    task: {
      uuid: string;
      time: string;
      url: string;
      visibility: string;
      method: string;
      source: string;
    };
    verdicts: {
      overall: { score: number; malicious: boolean; hasVerdicts: boolean };
      urlscan: { score: number; malicious: boolean; categories: string[] };
      engines: { score: number; malicious: boolean; maliciousTotal: number; benignTotal: number };
      community: { score: number; malicious: boolean; votesMalicious: number; votesBenign: number };
    };
  }>;
  total: number;
}

export class UrlScanModule extends BaseModule {
  name = 'urlscan';
  category = 'cti' as const;
  supportedEntityTypes = ['url', 'domain', 'ip'];
  rateLimit: RateLimitConfig = { maxTokens: 2, refillRate: 2, refillInterval: 60000 };
  cacheTTL = 1800;
  requiresApiKey = true;

  private normalizer: Normalizer;
  private baseUrl = 'https://urlscan.io/api/v1';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('urlscan');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false,
        module: this.name,
        entity,
        entityType: 'url',
        timestamp: new Date().toISOString(),
        rawData: null,
        normalized: [],
        relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'urlscan.io API key required', false)],
      };
    }

    return this.executeWithCache(entity, 'url', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const headers = { 'API-Key': apiKey };

      try {
        const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(entity);
        const isDomain = !isIp && !entity.startsWith('http');
        const searchQuery = isIp ? `page.ip:"${entity}"` : isDomain ? `domain:${entity}` : `page.url:"${entity}"`;

        const searchResult = await this.makeRequest<UrlScanSearchResult>({
          url: `${this.baseUrl}/search/`,
          method: 'GET',
          params: { q: searchQuery, size: 20 },
          headers,
        });
        apiCalls++;
        rawData['search'] = searchResult;

        for (const result of searchResult.results) {
          const page = result.page;
          const verdicts = result.verdicts;

          const scanEntity = this.normalizer.createEntity({
            type: 'url',
            name: page.url,
            description: `${page.title || 'No title'} | ${page.server || 'Unknown server'}`,
            attributes: {
              scanId: result._id,
              domain: page.domain,
              ip: page.ip,
              country: page.country,
              city: page.city,
              server: page.server,
              mimeType: page.mimeType,
              title: page.title,
              httpStatus: page.status,
              asn: page.asn,
              asnName: page.asnname,
              scanTime: result.task.time,
              visibility: result.task.visibility,
              stats: result.stats,
              verdicts: {
                overallScore: verdicts.overall.score,
                malicious: verdicts.overall.malicious,
                urlscanScore: verdicts.urlscan.score,
                urlscanCategories: verdicts.urlscan.categories,
                enginesMaliciousTotal: verdicts.engines.maliciousTotal,
                enginesBenignTotal: verdicts.engines.benignTotal,
                communityMalicious: verdicts.community.votesMalicious,
                communityBenign: verdicts.community.votesBenign,
              },
              screenshotUrl: `https://urlscan.io/screenshots/${result._id}.png`,
              resultUrl: `https://urlscan.io/result/${result._id}/`,
            },
            sourceUrl: `https://urlscan.io/result/${result._id}/`,
            confidence: 0.9,
            tags: [
              'urlscan',
              verdicts.overall.malicious ? 'malicious' : 'clean',
              ...verdicts.urlscan.categories,
            ],
          });
          entities.push(scanEntity);

          if (page.ip) {
            const ipEntity = this.normalizer.createEntity({
              type: 'ip',
              name: page.ip,
              attributes: { country: page.country, asn: page.asn, asnName: page.asnname },
              confidence: 0.85,
              tags: ['urlscan-ip'],
            });
            entities.push(ipEntity);
            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: scanEntity.id,
                targetEntityId: ipEntity.id,
                type: 'hosts',
                label: 'hosted on',
                confidence: 0.9,
              })
            );
          }

          if (page.domain && page.domain !== entity) {
            const domainEntity = this.normalizer.createEntity({
              type: 'domain',
              name: page.domain,
              attributes: {},
              confidence: 0.85,
              tags: ['urlscan-domain'],
            });
            entities.push(domainEntity);
            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: scanEntity.id,
                targetEntityId: domainEntity.id,
                type: 'part_of',
                label: 'belongs to domain',
                confidence: 0.9,
              })
            );
          }
        }
      } catch (err) {
        errors.push(this.buildError('URLSCAN_ERROR', `urlscan.io search failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    const data = rawData as Record<string, unknown>;
    const search = data['search'] as UrlScanSearchResult | undefined;
    if (!search) return [];

    return search.results.map((r) =>
      this.normalizer.createEntity({
        type: 'url',
        name: r.page.url,
        attributes: { domain: r.page.domain, malicious: r.verdicts.overall.malicious },
        tags: ['urlscan'],
      })
    );
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.get(`${this.baseUrl}/search/?q=domain:example.com&size=1`, { timeout: 5000, validateStatus: () => true });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'urlscan.io unreachable' };
    }
  }
}
