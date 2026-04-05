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

interface FecCandidate {
  candidate_id: string;
  name: string;
  party_full: string;
  state: string;
  district: string;
  office_full: string;
  incumbent_challenge_full: string;
  candidate_status: string;
  election_years: number[];
  cycles: number[];
}

interface FecCommittee {
  committee_id: string;
  name: string;
  committee_type_full: string;
  designation_full: string;
  party_full: string;
  state: string;
  treasurer_name: string;
  candidate_ids: string[];
}

interface FecScheduleA {
  contribution_receipt_amount: number;
  contribution_receipt_date: string;
  contributor_name: string;
  contributor_city: string;
  contributor_state: string;
  contributor_employer: string;
  contributor_occupation: string;
  committee: { name: string; committee_id: string };
  memo_text: string;
}

export class FecModule extends BaseModule {
  name = 'fec';
  category = 'political' as const;
  supportedEntityTypes = ['person', 'organization'];
  rateLimit: RateLimitConfig = { maxTokens: 120, refillRate: 120, refillInterval: 3600000 };
  cacheTTL = 3600;
  requiresApiKey = true;

  private normalizer: Normalizer;
  private baseUrl = 'https://api.open.fec.gov/v1';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('fec');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false, module: this.name, entity, entityType: 'person',
        timestamp: new Date().toISOString(), rawData: null, normalized: [], relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'FEC API key required', false)],
      };
    }

    return this.executeWithCache(entity, 'person', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      // Search candidates
      try {
        const candidates = await this.makeRequest<{
          results: FecCandidate[];
          pagination: { count: number };
        }>({
          url: `${this.baseUrl}/candidates/search/`,
          method: 'GET',
          params: { api_key: apiKey, q: entity, per_page: 10, sort: '-election_years' },
        });
        apiCalls++;
        rawData['candidates'] = candidates;

        for (const candidate of candidates.results) {
          const candEntity = this.normalizer.createEntity({
            type: 'person',
            name: candidate.name,
            description: `${candidate.party_full} | ${candidate.office_full} | ${candidate.state}${candidate.district ? `-${candidate.district}` : ''}`,
            attributes: {
              fecCandidateId: candidate.candidate_id,
              party: candidate.party_full,
              state: candidate.state,
              district: candidate.district,
              office: candidate.office_full,
              incumbentChallenge: candidate.incumbent_challenge_full,
              status: candidate.candidate_status,
              electionYears: candidate.election_years,
              cycles: candidate.cycles,
            },
            sourceUrl: `https://www.fec.gov/data/candidate/${candidate.candidate_id}/`,
            confidence: 0.95,
            tags: ['fec', 'candidate', candidate.party_full.toLowerCase(), candidate.office_full.toLowerCase()],
          });
          entities.push(candEntity);

          // Get financial totals
          try {
            const totals = await this.makeRequest<{
              results: Array<{
                candidate_id: string;
                cycle: number;
                receipts: number;
                disbursements: number;
                cash_on_hand_end_period: number;
                debts_owed_by_committee: number;
                individual_contributions: number;
                other_political_committee_contributions: number;
              }>;
            }>({
              url: `${this.baseUrl}/candidates/totals/`,
              method: 'GET',
              params: { api_key: apiKey, candidate_id: candidate.candidate_id, per_page: 1, sort: '-cycle' },
            });
            apiCalls++;

            if (totals.results.length > 0) {
              const t = totals.results[0];
              candEntity.attributes = {
                ...candEntity.attributes,
                financials: {
                  cycle: t.cycle,
                  receipts: t.receipts,
                  disbursements: t.disbursements,
                  cashOnHand: t.cash_on_hand_end_period,
                  debts: t.debts_owed_by_committee,
                  individualContributions: t.individual_contributions,
                  pacContributions: t.other_political_committee_contributions,
                },
              };
            }
          } catch {
            // Financial totals supplementary
          }
        }
      } catch (err) {
        errors.push(this.buildError('FEC_CANDIDATE_ERROR', `FEC candidate search failed: ${err}`));
      }

      // Search contributions by individual
      try {
        const contributions = await this.makeRequest<{
          results: FecScheduleA[];
          pagination: { count: number };
        }>({
          url: `${this.baseUrl}/schedules/schedule_a/`,
          method: 'GET',
          params: {
            api_key: apiKey,
            contributor_name: entity,
            per_page: 20,
            sort: '-contribution_receipt_date',
            is_individual: true,
          },
        });
        apiCalls++;
        rawData['contributions'] = contributions;

        const totalContributed = contributions.results.reduce((sum, c) => sum + (c.contribution_receipt_amount || 0), 0);

        if (contributions.results.length > 0) {
          const contributorEntity = this.normalizer.createEntity({
            type: 'person',
            name: entity,
            description: `FEC contributions: $${totalContributed.toLocaleString()} across ${contributions.results.length} contributions`,
            attributes: {
              totalContributions: contributions.pagination.count,
              totalAmount: totalContributed,
              contributions: contributions.results.map((c) => ({
                amount: c.contribution_receipt_amount,
                date: c.contribution_receipt_date,
                committee: c.committee.name,
                committeeId: c.committee.committee_id,
                employer: c.contributor_employer,
                occupation: c.contributor_occupation,
                city: c.contributor_city,
                state: c.contributor_state,
              })),
            },
            sourceUrl: `https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=${encodeURIComponent(entity)}`,
            confidence: 0.85,
            tags: ['fec', 'political-donor'],
          });
          entities.push(contributorEntity);
        }
      } catch (err) {
        errors.push(this.buildError('FEC_CONTRIB_ERROR', `FEC contribution search failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.get(`${this.baseUrl}/`, { timeout: 5000, validateStatus: () => true });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'FEC API unreachable' };
    }
  }
}
