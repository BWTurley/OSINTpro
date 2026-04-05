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

interface SipriTransfer {
  seller: string;
  buyer: string;
  description: string;
  numOrdered: number;
  yearOfOrder: number;
  yearOfDelivery: number;
  numDelivered: number;
  status: string;
  comments: string;
  tivDelivered: number;
  tivOrdered: number;
}

export class SipriModule extends BaseModule {
  name = 'sipri';
  category = 'milint' as const;
  supportedEntityTypes = ['country', 'organization'];
  rateLimit: RateLimitConfig = { maxTokens: 5, refillRate: 2, refillInterval: 1000 };
  cacheTTL = 86400;
  requiresApiKey = false;

  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('sipri');
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'country', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      // SIPRI Arms Transfers Database (web scraping/API)
      try {
        // SIPRI provides data in various formats. Use their API/embed endpoints
        const milex = await this.makeRequest<string>({
          url: 'https://www.sipri.org/sites/default/files/Data%20for%20all%20countries%20from%201949%E2%80%932023%20as%20a%20share%20of%20GDP.csv',
          method: 'GET',
          responseType: 'text',
        });
        apiCalls++;

        if (typeof milex === 'string') {
          const lines = milex.trim().split('\n');
          const headers = lines[0]?.split(',') || [];
          const query = entity.toLowerCase();

          const matchingRows = lines.slice(1).filter((line) =>
            line.toLowerCase().includes(query)
          );

          rawData['milexMatches'] = matchingRows.length;

          for (const row of matchingRows.slice(0, 5)) {
            const values = row.split(',');
            const countryName = values[0]?.replace(/"/g, '').trim();
            if (!countryName) continue;

            const yearValues: Array<{ year: string; value: number }> = [];
            for (let i = 1; i < Math.min(values.length, headers.length); i++) {
              const val = parseFloat(values[i]);
              if (!isNaN(val) && val > 0) {
                yearValues.push({ year: headers[i]?.trim(), value: val });
              }
            }

            const recentValues = yearValues.slice(-10);
            const latestValue = recentValues[recentValues.length - 1];

            entities.push(
              this.normalizer.createEntity({
                type: 'country',
                name: countryName,
                description: `Military expenditure: ${latestValue ? `${latestValue.value}% of GDP (${latestValue.year})` : 'data available'}`,
                attributes: {
                  milexGdpPercent: recentValues,
                  latestMilexGdp: latestValue?.value,
                  latestYear: latestValue?.year,
                  dataSource: 'SIPRI Military Expenditure Database',
                },
                sourceUrl: 'https://www.sipri.org/databases/milex',
                confidence: 0.9,
                tags: ['sipri', 'military-expenditure', 'defense'],
              })
            );
          }
        }
      } catch (err) {
        errors.push(this.buildError('SIPRI_MILEX_ERROR', `SIPRI military expenditure fetch failed: ${err}`));
      }

      // SIPRI Arms Transfers search
      try {
        // The SIPRI arms transfer database is accessible via their trade register
        const tradeResult = await this.makeRequest<string>({
          url: 'https://armstrade.sipri.org/armstrade/page/trade_register.php',
          method: 'GET',
          params: {
            seller_country_code: '',
            buyer_country_code: '',
            armament_category_id: '',
            incl_open_deals: 'on',
            low_year: 2015,
            high_year: new Date().getFullYear(),
            sum: 'on',
            output_type: 'json',
          },
          responseType: 'text',
        });
        apiCalls++;

        // Parse if we got JSON back
        try {
          const transfers = typeof tradeResult === 'string' ? JSON.parse(tradeResult) : tradeResult;
          rawData['armsTransfers'] = { available: true, type: typeof transfers };

          if (Array.isArray(transfers)) {
            const query = entity.toLowerCase();
            const matching = transfers.filter((t: Record<string, string>) => {
              const seller = (t.seller || t.Seller || '').toLowerCase();
              const buyer = (t.buyer || t.Buyer || '').toLowerCase();
              return seller.includes(query) || buyer.includes(query);
            });

            for (const transfer of matching.slice(0, 20)) {
              const t = transfer as Record<string, string | number>;
              entities.push(
                this.normalizer.createEntity({
                  type: 'event',
                  name: `Arms transfer: ${t.seller || t.Seller} -> ${t.buyer || t.Buyer}`,
                  description: String(t.description || t.Description || ''),
                  attributes: {
                    seller: t.seller || t.Seller,
                    buyer: t.buyer || t.Buyer,
                    description: t.description || t.Description,
                    numOrdered: t.numOrdered || t.Number_ordered,
                    yearOfOrder: t.yearOfOrder || t.Year_of_order,
                    status: t.status || t.Status,
                  },
                  sourceUrl: 'https://armstrade.sipri.org/armstrade/page/trade_register.php',
                  confidence: 0.85,
                  tags: ['sipri', 'arms-transfer'],
                })
              );
            }
          }
        } catch {
          // Response may not be valid JSON
          rawData['armsTransfers'] = { available: false, note: 'Trade register returned non-JSON response' };
        }
      } catch (err) {
        errors.push(this.buildError('SIPRI_TRADE_ERROR', `SIPRI trade register query failed: ${err}`));
      }

      // If no entities found, create a reference entity
      if (entities.length === 0) {
        entities.push(
          this.normalizer.createEntity({
            type: 'country',
            name: entity,
            description: 'SIPRI data: manual lookup recommended at sipri.org',
            attributes: {
              milexDatabaseUrl: 'https://www.sipri.org/databases/milex',
              armsTransferDatabaseUrl: 'https://www.sipri.org/databases/armstransfers',
              armsEmbargoDatabaseUrl: 'https://www.sipri.org/databases/embargoes',
            },
            sourceUrl: 'https://www.sipri.org/databases',
            confidence: 0.5,
            tags: ['sipri', 'reference'],
          })
        );
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.head('https://www.sipri.org/databases', { timeout: 5000 });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'SIPRI unreachable' };
    }
  }
}
