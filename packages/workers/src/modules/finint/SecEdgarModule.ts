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

interface EdgarCompany {
  cik: string;
  entity_name: string;
  tickers?: string[];
  exchanges?: string[];
}

interface EdgarFiling {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  form: string;
  primaryDocument: string;
  primaryDocDescription: string;
}

interface EdgarSearchHit {
  _id: string;
  _source: {
    file_num: string;
    display_names: string[];
    entity_id: string;
    file_date: string;
    period_of_report: string;
    form_type: string;
    file_description: string;
  };
}

export class SecEdgarModule extends BaseModule {
  name = 'sec-edgar';
  category = 'finint' as const;
  supportedEntityTypes = ['organization', 'person'];
  rateLimit: RateLimitConfig = { maxTokens: 10, refillRate: 10, refillInterval: 1000 };
  cacheTTL = 3600;
  requiresApiKey = false;

  private userAgent = 'OSINTDashboard/1.0 (contact@osint-dashboard.local)';
  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('sec-edgar');
    this.httpClient.defaults.headers.common['User-Agent'] = this.userAgent;
    this.httpClient.defaults.headers.common['Accept'] = 'application/json';
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'organization', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      try {
        const searchResults = await this.makeRequest<{
          hits: { hits: EdgarSearchHit[] };
        }>({
          url: 'https://efts.sec.gov/LATEST/search-index',
          method: 'GET',
          params: { q: entity, dateRange: 'custom', startdt: '2020-01-01', forms: 'all' },
          headers: { 'User-Agent': this.userAgent },
        });
        apiCalls++;
        rawData['search'] = searchResults;
      } catch {
        // Full-text search may not be available, fall back to company search
      }

      try {
        const companyTickers = await this.makeRequest<Record<string, EdgarCompany>>({
          url: 'https://www.sec.gov/files/company_tickers.json',
          method: 'GET',
          headers: { 'User-Agent': this.userAgent },
        });
        apiCalls++;

        const matches = Object.values(companyTickers).filter(
          (c) => c.entity_name.toLowerCase().includes(entity.toLowerCase())
        );

        rawData['companyMatches'] = matches;

        for (const match of matches.slice(0, 5)) {
          const cikPadded = match.cik.toString().padStart(10, '0');

          const entityObj = this.normalizer.createEntity({
            type: 'organization',
            name: match.entity_name,
            attributes: {
              cik: match.cik,
              tickers: match.tickers || [],
              exchanges: match.exchanges || [],
              secUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${match.cik}`,
            },
            sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${match.cik}`,
            confidence: 0.9,
            tags: ['sec', 'public-company'],
          });
          entities.push(entityObj);

          try {
            const filings = await this.makeRequest<{
              filings: {
                recent: {
                  accessionNumber: string[];
                  filingDate: string[];
                  reportDate: string[];
                  form: string[];
                  primaryDocument: string[];
                  primaryDocDescription: string[];
                };
              };
            }>({
              url: `https://data.sec.gov/submissions/CIK${cikPadded}.json`,
              method: 'GET',
              headers: { 'User-Agent': this.userAgent },
            });
            apiCalls++;

            rawData[`filings_${match.cik}`] = filings;

            const recent = filings.filings.recent;
            const count = Math.min(recent.accessionNumber.length, 20);
            for (let i = 0; i < count; i++) {
              const filingEntity = this.normalizer.createEntity({
                type: 'filing',
                name: `${recent.form[i]} - ${match.entity_name} (${recent.filingDate[i]})`,
                description: recent.primaryDocDescription[i] || '',
                attributes: {
                  accessionNumber: recent.accessionNumber[i],
                  filingDate: recent.filingDate[i],
                  reportDate: recent.reportDate[i],
                  formType: recent.form[i],
                  primaryDocument: recent.primaryDocument[i],
                  cik: match.cik,
                  url: `https://www.sec.gov/Archives/edgar/data/${match.cik}/${recent.accessionNumber[i]?.replace(/-/g, '')}/${recent.primaryDocument[i]}`,
                },
                sourceUrl: `https://www.sec.gov/Archives/edgar/data/${match.cik}/${recent.accessionNumber[i]?.replace(/-/g, '')}`,
                confidence: 0.95,
                tags: ['sec-filing', recent.form[i]],
              });
              entities.push(filingEntity);

              relationships.push(
                this.normalizer.createRelationship({
                  sourceEntityId: entityObj.id,
                  targetEntityId: filingEntity.id,
                  type: 'references',
                  label: `filed ${recent.form[i]}`,
                  confidence: 0.95,
                })
              );
            }
          } catch (err) {
            errors.push(this.buildError('FILING_FETCH_ERROR', `Failed to fetch filings for CIK ${match.cik}: ${err}`));
          }
        }
      } catch (err) {
        errors.push(this.buildError('COMPANY_SEARCH_ERROR', `Company search failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    const data = rawData as Record<string, unknown>;
    const entities: NormalizedEntity[] = [];
    const matches = (data['companyMatches'] || []) as EdgarCompany[];

    for (const match of matches) {
      entities.push(
        this.normalizer.createEntity({
          type: 'organization',
          name: match.entity_name,
          attributes: { cik: match.cik, tickers: match.tickers },
          tags: ['sec'],
        })
      );
    }

    return entities;
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({
        url: 'https://data.sec.gov/submissions/CIK0000320193.json',
        method: 'HEAD',
        headers: { 'User-Agent': this.userAgent },
      }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'SEC EDGAR unreachable' };
    }
  }
}
