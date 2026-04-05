import Redis from 'ioredis';
import { BaseModule } from '../../base/BaseModule.js';
import { Normalizer } from '../../base/Normalizer.js';
import type {
  CollectionResult,
  NormalizedEntity,
  ModuleHealth,
  RateLimitConfig,
  CollectionError,
} from '../../base/types.js';

interface AbuseIPDBReport {
  data: {
    ipAddress: string;
    isPublic: boolean;
    ipVersion: number;
    isWhitelisted: boolean;
    abuseConfidenceScore: number;
    countryCode: string;
    countryName: string;
    usageType: string;
    isp: string;
    domain: string;
    hostnames: string[];
    isTor: boolean;
    totalReports: number;
    numDistinctUsers: number;
    lastReportedAt: string;
    reports: Array<{
      reportedAt: string;
      comment: string;
      categories: number[];
      reporterId: number;
      reporterCountryCode: string;
    }>;
  };
}

const ABUSE_CATEGORIES: Record<number, string> = {
  1: 'DNS Compromise',
  2: 'DNS Poisoning',
  3: 'Fraud Orders',
  4: 'DDoS Attack',
  5: 'FTP Brute-Force',
  6: 'Ping of Death',
  7: 'Phishing',
  8: 'Fraud VoIP',
  9: 'Open Proxy',
  10: 'Web Spam',
  11: 'Email Spam',
  12: 'Blog Spam',
  13: 'VPN IP',
  14: 'Port Scan',
  15: 'Hacking',
  16: 'SQL Injection',
  17: 'Spoofing',
  18: 'Brute-Force',
  19: 'Bad Web Bot',
  20: 'Exploited Host',
  21: 'Web App Attack',
  22: 'SSH',
  23: 'IoT Targeted',
};

export class AbuseIPDBModule extends BaseModule {
  name = 'abuseipdb';
  category = 'cti' as const;
  supportedEntityTypes = ['ip'];
  rateLimit: RateLimitConfig = { maxTokens: 5, refillRate: 1, refillInterval: 1000 };
  cacheTTL = 3600;
  requiresApiKey = true;

  private normalizer: Normalizer;
  private baseUrl = 'https://api.abuseipdb.com/api/v2';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('abuseipdb');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false,
        module: this.name,
        entity,
        entityType: 'ip',
        timestamp: new Date().toISOString(),
        rawData: null,
        normalized: [],
        relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'AbuseIPDB API key is required', false)],
      };
    }

    return this.executeWithCache(entity, 'ip', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      try {
        const result = await this.makeRequest<AbuseIPDBReport>({
          url: `${this.baseUrl}/check`,
          method: 'GET',
          params: {
            ipAddress: entity,
            maxAgeInDays: 90,
            verbose: true,
          },
          headers: {
            Key: apiKey,
            Accept: 'application/json',
          },
        });
        apiCalls++;
        rawData['check'] = result;

        const d = result.data;
        const categorySet = new Set<string>();
        for (const report of d.reports || []) {
          for (const cat of report.categories) {
            categorySet.add(ABUSE_CATEGORIES[cat] || `Category ${cat}`);
          }
        }

        const threat = d.abuseConfidenceScore >= 80 ? 'high' : d.abuseConfidenceScore >= 40 ? 'medium' : 'low';

        entities.push(
          this.normalizer.createEntity({
            type: 'ip',
            name: entity,
            description: `AbuseIPDB: ${d.abuseConfidenceScore}% confidence | ${d.totalReports} reports | ${d.isp}`,
            attributes: {
              abuseConfidenceScore: d.abuseConfidenceScore,
              totalReports: d.totalReports,
              numDistinctUsers: d.numDistinctUsers,
              countryCode: d.countryCode,
              countryName: d.countryName,
              isp: d.isp,
              domain: d.domain,
              usageType: d.usageType,
              hostnames: d.hostnames,
              isTor: d.isTor,
              isWhitelisted: d.isWhitelisted,
              isPublic: d.isPublic,
              ipVersion: d.ipVersion,
              lastReportedAt: d.lastReportedAt,
              threatLevel: threat,
              abuseCategories: Array.from(categorySet),
              recentReports: (d.reports || []).slice(0, 10).map((r) => ({
                reportedAt: r.reportedAt,
                comment: r.comment,
                categories: r.categories.map((c) => ABUSE_CATEGORIES[c] || `Category ${c}`),
                reporterCountry: r.reporterCountryCode,
              })),
            },
            sourceUrl: `https://www.abuseipdb.com/check/${entity}`,
            confidence: 0.9,
            tags: [
              'abuseipdb',
              `threat-${threat}`,
              ...(d.isTor ? ['tor'] : []),
              ...Array.from(categorySet),
            ],
          })
        );
      } catch (err) {
        errors.push(this.buildError('ABUSEIPDB_ERROR', `AbuseIPDB check failed: ${err}`));
      }

      return { rawData, entities, relationships: [], metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    const data = rawData as Record<string, unknown>;
    const check = data['check'] as AbuseIPDBReport | undefined;
    if (!check) return [];

    return [
      this.normalizer.createEntity({
        type: 'ip',
        name: check.data.ipAddress,
        attributes: {
          abuseConfidenceScore: check.data.abuseConfidenceScore,
          totalReports: check.data.totalReports,
        },
        tags: ['abuseipdb'],
      }),
    ];
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.get(`${this.baseUrl}/check`, {
        timeout: 5000,
        validateStatus: () => true,
      });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'AbuseIPDB unreachable' };
    }
  }
}
