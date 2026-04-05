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

interface GibsLayer {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  type: string;
  period: string;
  startDate?: string;
  endDate?: string;
  projections: Record<string, { source: string; matrixSet: string }>;
}

export class NasaGibsModule extends BaseModule {
  name = 'nasa-gibs';
  category = 'geoint' as const;
  supportedEntityTypes = ['location'];
  rateLimit: RateLimitConfig = { maxTokens: 10, refillRate: 5, refillInterval: 1000 };
  cacheTTL = 3600;
  requiresApiKey = false;

  private normalizer: Normalizer;
  private wmtsBase = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('nasa-gibs');
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'location', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const coordMatch = entity.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
      if (!coordMatch) {
        errors.push(this.buildError('INVALID_COORDS', 'Entity must be lat,lon coordinates', false));
        return { rawData, entities, relationships: [], metadata: { apiCalls }, errors };
      }

      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);

      try {
        // Get WMTS capabilities
        const capabilitiesUrl = `${this.wmtsBase}/1.0.0/WMTSCapabilities.xml`;
        const capabilities = await this.makeRequest<string>({
          url: capabilitiesUrl,
          method: 'GET',
          responseType: 'text',
        });
        apiCalls++;
        rawData['capabilitiesLength'] = typeof capabilities === 'string' ? capabilities.length : 0;

        // Key layers useful for OSINT
        const osintLayers = [
          {
            id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
            title: 'MODIS Terra True Color',
            description: 'Daily true color satellite imagery',
          },
          {
            id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
            title: 'VIIRS True Color',
            description: 'Daily VIIRS true color imagery',
          },
          {
            id: 'MODIS_Terra_Thermal_Anomalies_Day',
            title: 'Thermal Anomalies (Day)',
            description: 'Active fire and thermal hotspot detection',
          },
          {
            id: 'MODIS_Terra_Thermal_Anomalies_Night',
            title: 'Thermal Anomalies (Night)',
            description: 'Nighttime thermal anomaly detection',
          },
          {
            id: 'VIIRS_NOAA20_Thermal_Anomalies_375m_Day',
            title: 'VIIRS Thermal Anomalies',
            description: 'High-res thermal anomaly detection',
          },
          {
            id: 'MODIS_Terra_Aerosol_Optical_Depth_3km',
            title: 'Aerosol Optical Depth',
            description: 'Atmospheric particles indicator (fires, pollution)',
          },
          {
            id: 'VIIRS_SNPP_DayNightBand_ENCC',
            title: 'Day/Night Band',
            description: 'Nighttime lights and activity detection',
          },
        ];

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // Calculate WMTS tile coordinates
        const tileMatrix = '5';
        const tileCol = Math.floor((lon + 180) / 360 * 32);
        const tileRow = Math.floor((90 - lat) / 180 * 16);

        const tileUrls: Record<string, string> = {};
        for (const layer of osintLayers) {
          tileUrls[layer.id] = `${this.wmtsBase}/${layer.id}/default/${yesterday}/250m/${tileMatrix}/${tileRow}/${tileCol}.jpg`;
        }

        rawData['tileUrls'] = tileUrls;
        rawData['layers'] = osintLayers;

        const locationEntity = this.normalizer.createEntity({
          type: 'location',
          name: `${lat}, ${lon}`,
          description: `NASA GIBS imagery available for ${osintLayers.length} layers`,
          attributes: {
            latitude: lat,
            longitude: lon,
            date: yesterday,
            availableLayers: osintLayers.map((l) => ({
              id: l.id,
              title: l.title,
              description: l.description,
              tileUrl: tileUrls[l.id],
            })),
            wmtsEndpoint: this.wmtsBase,
            tileMatrix,
            tileRow,
            tileCol,
          },
          sourceUrl: `https://worldview.earthdata.nasa.gov/?v=${lon - 2},${lat - 2},${lon + 2},${lat + 2}&t=${yesterday}`,
          confidence: 0.95,
          tags: ['nasa', 'satellite-imagery', 'gibs'],
        });
        entities.push(locationEntity);

        // Check NASA FIRMS for recent fire activity
        try {
          const firmsResult = await this.makeRequest<string>({
            url: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/OPEN_KEY/VIIRS_SNPP_NRT/${lon - 1},${lat - 1},${lon + 1},${lat + 1}/1`,
            method: 'GET',
            responseType: 'text',
          });
          apiCalls++;
          rawData['firms'] = firmsResult;

          if (typeof firmsResult === 'string' && firmsResult.trim().split('\n').length > 1) {
            const lines = firmsResult.trim().split('\n');
            const headers = lines[0].split(',');
            const firePoints = lines.slice(1).map((line) => {
              const values = line.split(',');
              const obj: Record<string, string> = {};
              headers.forEach((h, i) => { obj[h] = values[i]; });
              return obj;
            });

            for (const fire of firePoints.slice(0, 10)) {
              entities.push(
                this.normalizer.createEntity({
                  type: 'event',
                  name: `Fire detection at ${fire['latitude']}, ${fire['longitude']}`,
                  attributes: {
                    latitude: parseFloat(fire['latitude']),
                    longitude: parseFloat(fire['longitude']),
                    brightness: parseFloat(fire['bright_ti4']),
                    confidence: fire['confidence'],
                    acquisitionDate: fire['acq_date'],
                    acquisitionTime: fire['acq_time'],
                    satellite: fire['satellite'],
                    frp: parseFloat(fire['frp']),
                  },
                  confidence: 0.85,
                  tags: ['fire-detection', 'firms', 'thermal-anomaly'],
                })
              );
            }
          }
        } catch {
          // FIRMS is supplementary
        }
      } catch (err) {
        errors.push(this.buildError('GIBS_ERROR', `NASA GIBS query failed: ${err}`));
      }

      return { rawData, entities, relationships: [], metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    return [];
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.head(`${this.wmtsBase}/1.0.0/WMTSCapabilities.xml`, { timeout: 5000 });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'NASA GIBS unreachable' };
    }
  }
}
