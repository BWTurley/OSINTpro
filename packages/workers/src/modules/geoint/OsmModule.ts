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

interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
  boundingbox: string[];
  type: string;
  importance: number;
  category: string;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  center?: { lat: number; lon: number };
}

export class OsmModule extends BaseModule {
  name = 'osm';
  category = 'geoint' as const;
  supportedEntityTypes = ['location', 'organization'];
  rateLimit: RateLimitConfig = { maxTokens: 1, refillRate: 1, refillInterval: 1000 };
  cacheTTL = 86400;
  requiresApiKey = false;

  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('osm');
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'location', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      // Check if entity is coordinates
      const coordMatch = entity.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);

      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lon = parseFloat(coordMatch[2]);

        // Reverse geocode
        try {
          const result = await this.makeRequest<NominatimResult>({
            url: 'https://nominatim.openstreetmap.org/reverse',
            method: 'GET',
            params: { lat, lon, format: 'json', addressdetails: 1, zoom: 18 },
            headers: { 'User-Agent': 'OSINT-Dashboard/1.0' },
          });
          apiCalls++;
          rawData['reverseGeocode'] = result;

          entities.push(
            this.normalizer.createEntity({
              type: 'location',
              name: result.display_name,
              attributes: {
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
                address: result.address,
                osmType: result.osm_type,
                osmId: result.osm_id,
                placeType: result.type,
                category: result.category,
                boundingBox: result.boundingbox,
              },
              sourceUrl: `https://www.openstreetmap.org/${result.osm_type}/${result.osm_id}`,
              confidence: 0.9,
              tags: ['osm', 'geocoded', result.type],
            })
          );
        } catch (err) {
          errors.push(this.buildError('REVERSE_GEOCODE_ERROR', `Reverse geocoding failed: ${err}`));
        }

        // Overpass POI search (500m radius)
        try {
          const overpassQuery = `
            [out:json][timeout:25];
            (
              node["amenity"](around:500,${lat},${lon});
              node["building"](around:500,${lat},${lon});
              node["military"](around:500,${lat},${lon});
              node["aeroway"](around:500,${lat},${lon});
              way["building"](around:500,${lat},${lon});
            );
            out center body 50;
          `;

          const overpassResult = await this.makeRequest<{
            elements: OverpassElement[];
          }>({
            url: 'https://overpass-api.de/api/interpreter',
            method: 'POST',
            data: `data=${encodeURIComponent(overpassQuery)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 30000,
          });
          apiCalls++;
          rawData['overpass'] = overpassResult;

          for (const elem of overpassResult.elements.slice(0, 30)) {
            const tags = elem.tags || {};
            const name = tags['name'] || tags['amenity'] || tags['building'] || `OSM ${elem.type}/${elem.id}`;
            const elLat = elem.lat ?? elem.center?.lat;
            const elLon = elem.lon ?? elem.center?.lon;

            entities.push(
              this.normalizer.createEntity({
                type: 'location',
                name,
                description: Object.entries(tags).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(', '),
                attributes: {
                  latitude: elLat,
                  longitude: elLon,
                  osmType: elem.type,
                  osmId: elem.id,
                  tags,
                },
                sourceUrl: `https://www.openstreetmap.org/${elem.type}/${elem.id}`,
                confidence: 0.8,
                tags: ['osm', 'poi', ...Object.keys(tags).slice(0, 5)],
              })
            );
          }
        } catch (err) {
          errors.push(this.buildError('OVERPASS_ERROR', `Overpass query failed: ${err}`));
        }
      } else {
        // Forward geocode (search by name)
        try {
          const results = await this.makeRequest<NominatimResult[]>({
            url: 'https://nominatim.openstreetmap.org/search',
            method: 'GET',
            params: { q: entity, format: 'json', addressdetails: 1, limit: 10 },
            headers: { 'User-Agent': 'OSINT-Dashboard/1.0' },
          });
          apiCalls++;
          rawData['geocode'] = results;

          for (const result of results) {
            const locEntity = this.normalizer.createEntity({
              type: 'location',
              name: result.display_name,
              attributes: {
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
                address: result.address,
                osmType: result.osm_type,
                osmId: result.osm_id,
                placeType: result.type,
                category: result.category,
                importance: result.importance,
                boundingBox: result.boundingbox,
              },
              sourceUrl: `https://www.openstreetmap.org/${result.osm_type}/${result.osm_id}`,
              confidence: Math.min(0.95, result.importance + 0.3),
              tags: ['osm', 'geocoded', result.type],
            });
            entities.push(locEntity);
          }
        } catch (err) {
          errors.push(this.buildError('GEOCODE_ERROR', `Geocoding failed: ${err}`));
        }
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    return [];
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({
        url: 'https://nominatim.openstreetmap.org/search',
        method: 'GET',
        params: { q: 'London', format: 'json', limit: 1 },
        headers: { 'User-Agent': 'OSINT-Dashboard/1.0' },
      }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'OSM/Nominatim unreachable' };
    }
  }
}
