import { Redis } from 'ioredis';
import { BaseModule } from '../../base/BaseModule.js';
import { Normalizer } from '../../base/Normalizer.js';
import type {
  CollectionResult,
  NormalizedEntity,
  ModuleHealth,
  RateLimitConfig,
  CollectionError,
} from '../../base/types.js';

interface KevVulnerability {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  knownRansomwareCampaignUse: string;
  notes: string;
}

interface KevCatalog {
  title: string;
  catalogVersion: string;
  dateReleased: string;
  count: number;
  vulnerabilities: KevVulnerability[];
}

export class CisaKevModule extends BaseModule {
  name = 'cisa-kev';
  category = 'cti' as const;
  supportedEntityTypes = ['vulnerability', 'organization'];
  rateLimit: RateLimitConfig = { maxTokens: 5, refillRate: 5, refillInterval: 60000 };
  cacheTTL = 86400;
  requiresApiKey = false;

  private normalizer: Normalizer;
  private kevUrl = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('cisa-kev');
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'vulnerability', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      try {
        const catalog = await this.makeRequest<KevCatalog>({
          url: this.kevUrl,
          method: 'GET',
        });
        apiCalls++;

        const query = entity.toLowerCase();
        const isCve = /^cve-\d{4}-\d{4,}$/i.test(entity);

        const matches = catalog.vulnerabilities.filter((v) => {
          if (isCve) return v.cveID.toLowerCase() === query;
          return (
            v.vendorProject.toLowerCase().includes(query) ||
            v.product.toLowerCase().includes(query) ||
            v.vulnerabilityName.toLowerCase().includes(query) ||
            v.shortDescription.toLowerCase().includes(query)
          );
        });

        rawData = {
          catalogVersion: catalog.catalogVersion,
          dateReleased: catalog.dateReleased,
          totalCount: catalog.count,
          matchCount: matches.length,
          matches,
        };

        for (const vuln of matches) {
          entities.push(
            this.normalizer.createEntity({
              type: 'vulnerability',
              name: vuln.cveID,
              description: vuln.shortDescription,
              attributes: {
                cveId: vuln.cveID,
                vendorProject: vuln.vendorProject,
                product: vuln.product,
                vulnerabilityName: vuln.vulnerabilityName,
                dateAdded: vuln.dateAdded,
                requiredAction: vuln.requiredAction,
                dueDate: vuln.dueDate,
                knownRansomwareCampaignUse: vuln.knownRansomwareCampaignUse,
                notes: vuln.notes,
                isKev: true,
              },
              sourceUrl: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog`,
              confidence: 0.99,
              tags: [
                'cisa-kev',
                'actively-exploited',
                vuln.vendorProject.toLowerCase(),
                ...(vuln.knownRansomwareCampaignUse === 'Known' ? ['ransomware'] : []),
              ],
            })
          );
        }
      } catch (err) {
        errors.push(this.buildError('KEV_ERROR', `CISA KEV fetch failed: ${err}`));
      }

      return { rawData, entities, relationships: [], metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    const data = rawData as Record<string, unknown>;
    const matches = (data['matches'] || []) as KevVulnerability[];
    return matches.map((v) =>
      this.normalizer.createEntity({
        type: 'vulnerability',
        name: v.cveID,
        description: v.shortDescription,
        attributes: { vendorProject: v.vendorProject, product: v.product },
        tags: ['cisa-kev'],
      })
    );
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({ url: this.kevUrl, method: 'HEAD' }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'CISA KEV unreachable' };
    }
  }
}
