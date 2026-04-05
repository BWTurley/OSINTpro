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

interface GpRecord {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
  SEMIMAJOR_AXIS: number;
  PERIOD: number;
  APOAPSIS: number;
  PERIAPSIS: number;
  OBJECT_TYPE: string;
  RCS_SIZE: string;
  COUNTRY_CODE: string;
  LAUNCH_DATE: string;
  SITE: string;
  DECAY_DATE: string | null;
  TLE_LINE0: string;
  TLE_LINE1: string;
  TLE_LINE2: string;
}

export class CelesTrakModule extends BaseModule {
  name = 'celestrak';
  category = 'milint' as const;
  supportedEntityTypes = ['satellite'];
  rateLimit: RateLimitConfig = { maxTokens: 5, refillRate: 2, refillInterval: 1000 };
  cacheTTL = 3600;
  requiresApiKey = false;

  private normalizer: Normalizer;
  private baseUrl = 'https://celestrak.org';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('celestrak');
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'satellite', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const isNoradId = /^\d{1,5}$/.test(entity);

      try {
        let records: GpRecord[];

        if (isNoradId) {
          records = await this.makeRequest<GpRecord[]>({
            url: `${this.baseUrl}/NORAD/elements/gp.php`,
            method: 'GET',
            params: { CATNR: entity, FORMAT: 'json' },
          });
        } else {
          records = await this.makeRequest<GpRecord[]>({
            url: `${this.baseUrl}/NORAD/elements/gp.php`,
            method: 'GET',
            params: { NAME: entity, FORMAT: 'json' },
          });
        }
        apiCalls++;
        rawData['gp'] = records;

        if (!Array.isArray(records)) records = [records];

        for (const record of records) {
          const altitudeKm = record.SEMIMAJOR_AXIS ? record.SEMIMAJOR_AXIS - 6371 : null;
          const isLeo = altitudeKm !== null && altitudeKm < 2000;
          const isMeo = altitudeKm !== null && altitudeKm >= 2000 && altitudeKm < 35786;
          const isGeo = altitudeKm !== null && altitudeKm >= 35786 && altitudeKm < 36000;
          const orbitType = isGeo ? 'GEO' : isMeo ? 'MEO' : isLeo ? 'LEO' : 'HEO';

          entities.push(
            this.normalizer.createEntity({
              type: 'satellite',
              name: record.OBJECT_NAME,
              description: `NORAD ${record.NORAD_CAT_ID} | ${record.COUNTRY_CODE} | ${orbitType} orbit | Period: ${record.PERIOD?.toFixed(1)} min`,
              attributes: {
                noradCatId: record.NORAD_CAT_ID,
                objectId: record.OBJECT_ID,
                objectType: record.OBJECT_TYPE,
                countryCode: record.COUNTRY_CODE,
                launchDate: record.LAUNCH_DATE,
                launchSite: record.SITE,
                decayDate: record.DECAY_DATE,
                epoch: record.EPOCH,
                meanMotion: record.MEAN_MOTION,
                eccentricity: record.ECCENTRICITY,
                inclination: record.INCLINATION,
                raOfAscNode: record.RA_OF_ASC_NODE,
                argOfPericenter: record.ARG_OF_PERICENTER,
                meanAnomaly: record.MEAN_ANOMALY,
                bstar: record.BSTAR,
                semimajorAxis: record.SEMIMAJOR_AXIS,
                period: record.PERIOD,
                apoapsis: record.APOAPSIS,
                periapsis: record.PERIAPSIS,
                rcsSize: record.RCS_SIZE,
                classificationType: record.CLASSIFICATION_TYPE,
                orbitType,
                altitudeKm,
                tle: {
                  line0: record.TLE_LINE0,
                  line1: record.TLE_LINE1,
                  line2: record.TLE_LINE2,
                },
              },
              sourceUrl: `https://celestrak.org/NORAD/elements/gp.php?CATNR=${record.NORAD_CAT_ID}`,
              confidence: 0.95,
              tags: [
                'satellite', 'celestrak', orbitType.toLowerCase(),
                record.COUNTRY_CODE, record.OBJECT_TYPE?.toLowerCase() || 'unknown',
                ...(record.DECAY_DATE ? ['decayed'] : ['active']),
              ],
            })
          );
        }
      } catch (err) {
        errors.push(this.buildError('CELESTRAK_ERROR', `CelesTrak lookup failed: ${err}`));
      }

      // Special catalogs for military satellites
      if (entity.toLowerCase().includes('military') || entity.toLowerCase().includes('classified')) {
        try {
          const specialGroups = ['military', 'tle-new'];
          for (const group of specialGroups) {
            try {
              const groupData = await this.makeRequest<GpRecord[]>({
                url: `${this.baseUrl}/NORAD/elements/gp.php`,
                method: 'GET',
                params: { GROUP: group, FORMAT: 'json' },
              });
              apiCalls++;
              rawData[`group_${group}`] = { count: Array.isArray(groupData) ? groupData.length : 0 };
            } catch {
              // Group may not exist
            }
          }
        } catch {
          // Special groups supplementary
        }
      }

      return { rawData, entities, relationships: [], metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({
        url: `${this.baseUrl}/NORAD/elements/gp.php`,
        method: 'GET',
        params: { CATNR: 25544, FORMAT: 'json' },
      }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'CelesTrak unreachable' };
    }
  }
}
