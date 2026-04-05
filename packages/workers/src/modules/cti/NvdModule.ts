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

interface NvdCve {
  id: string;
  sourceIdentifier: string;
  published: string;
  lastModified: string;
  vulnStatus: string;
  descriptions: Array<{ lang: string; value: string }>;
  metrics: {
    cvssMetricV31?: Array<{
      source: string;
      type: string;
      cvssData: {
        version: string;
        vectorString: string;
        baseScore: number;
        baseSeverity: string;
        attackVector: string;
        attackComplexity: string;
        privilegesRequired: string;
        userInteraction: string;
        scope: string;
        confidentialityImpact: string;
        integrityImpact: string;
        availabilityImpact: string;
      };
      exploitabilityScore: number;
      impactScore: number;
    }>;
  };
  weaknesses?: Array<{
    source: string;
    type: string;
    description: Array<{ lang: string; value: string }>;
  }>;
  configurations?: Array<{
    nodes: Array<{
      operator: string;
      cpeMatch: Array<{
        vulnerable: boolean;
        criteria: string;
        versionStartIncluding?: string;
        versionEndExcluding?: string;
      }>;
    }>;
  }>;
  references: Array<{ url: string; source: string; tags: string[] }>;
}

export class NvdModule extends BaseModule {
  name = 'nvd';
  category = 'cti' as const;
  supportedEntityTypes = ['vulnerability', 'organization'];
  rateLimit: RateLimitConfig = { maxTokens: 5, refillRate: 5, refillInterval: 30000 };
  cacheTTL = 7200;
  requiresApiKey = false;

  private normalizer: Normalizer;
  private baseUrl = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('nvd');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'vulnerability', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const isCve = /^CVE-\d{4}-\d{4,}$/i.test(entity);
      const headers: Record<string, string> = {};
      if (apiKey) headers['apiKey'] = apiKey;

      try {
        if (isCve) {
          const result = await this.makeRequest<{
            vulnerabilities: Array<{ cve: NvdCve }>;
          }>({
            url: this.baseUrl,
            method: 'GET',
            params: { cveId: entity.toUpperCase() },
            headers,
          });
          apiCalls++;
          rawData['cve'] = result;

          if (result.vulnerabilities.length > 0) {
            const cve = result.vulnerabilities[0].cve;
            entities.push(this.buildCveEntity(cve));
          }
        } else {
          // Keyword search
          const result = await this.makeRequest<{
            vulnerabilities: Array<{ cve: NvdCve }>;
            totalResults: number;
            resultsPerPage: number;
          }>({
            url: this.baseUrl,
            method: 'GET',
            params: {
              keywordSearch: entity,
              resultsPerPage: 20,
            },
            headers,
          });
          apiCalls++;
          rawData['search'] = result;

          for (const item of result.vulnerabilities) {
            const cveEntity = this.buildCveEntity(item.cve);
            entities.push(cveEntity);

            // Link CVE to CPE products
            if (item.cve.configurations) {
              for (const config of item.cve.configurations) {
                for (const node of config.nodes) {
                  for (const match of node.cpeMatch) {
                    if (match.vulnerable) {
                      const productEntity = this.normalizer.createEntity({
                        type: 'indicator',
                        name: match.criteria,
                        attributes: {
                          cpe: match.criteria,
                          versionStart: match.versionStartIncluding,
                          versionEnd: match.versionEndExcluding,
                        },
                        confidence: 0.9,
                        tags: ['cpe', 'vulnerable-product'],
                      });
                      entities.push(productEntity);
                      relationships.push(
                        this.normalizer.createRelationship({
                          sourceEntityId: cveEntity.id,
                          targetEntityId: productEntity.id,
                          type: 'targets',
                          label: 'affects',
                          confidence: 0.95,
                        })
                      );
                    }
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        errors.push(this.buildError('NVD_ERROR', `NVD lookup failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  private buildCveEntity(cve: NvdCve): NormalizedEntity {
    const enDesc = cve.descriptions.find((d) => d.lang === 'en')?.value || '';
    const cvss = cve.metrics.cvssMetricV31?.[0]?.cvssData;
    const cwes = (cve.weaknesses || [])
      .flatMap((w) => w.description)
      .filter((d) => d.lang === 'en')
      .map((d) => d.value);

    return this.normalizer.createEntity({
      type: 'vulnerability',
      name: cve.id,
      description: enDesc.slice(0, 500),
      attributes: {
        cveId: cve.id,
        published: cve.published,
        lastModified: cve.lastModified,
        vulnStatus: cve.vulnStatus,
        sourceIdentifier: cve.sourceIdentifier,
        cvssScore: cvss?.baseScore,
        cvssSeverity: cvss?.baseSeverity,
        cvssVector: cvss?.vectorString,
        attackVector: cvss?.attackVector,
        attackComplexity: cvss?.attackComplexity,
        privilegesRequired: cvss?.privilegesRequired,
        userInteraction: cvss?.userInteraction,
        scope: cvss?.scope,
        cwes,
        references: cve.references.map((r) => ({ url: r.url, tags: r.tags })),
      },
      sourceUrl: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
      confidence: 0.95,
      tags: [
        'cve',
        'nvd',
        cvss?.baseSeverity?.toLowerCase() || 'unknown',
        ...(cvss && cvss.baseScore >= 9.0 ? ['critical'] : []),
        ...(cvss && cvss.baseScore >= 7.0 && cvss.baseScore < 9.0 ? ['high'] : []),
      ],
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    const data = rawData as Record<string, unknown>;
    const search = data['search'] as { vulnerabilities: Array<{ cve: NvdCve }> } | undefined;
    if (!search) return [];
    return search.vulnerabilities.map((v) => this.buildCveEntity(v.cve));
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({
        url: this.baseUrl,
        method: 'GET',
        params: { cveId: 'CVE-2021-44228', resultsPerPage: 1 },
      }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'NVD API unreachable' };
    }
  }
}
