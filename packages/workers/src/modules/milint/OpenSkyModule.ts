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

type StateVector = [
  string,    // icao24
  string,    // callsign
  string,    // origin_country
  number,    // time_position
  number,    // last_contact
  number,    // longitude
  number,    // latitude
  number,    // baro_altitude
  boolean,   // on_ground
  number,    // velocity
  number,    // true_track
  number,    // vertical_rate
  number[],  // sensors
  number,    // geo_altitude
  string,    // squawk
  boolean,   // spi
  number,    // position_source
];

interface OpenSkyStates {
  time: number;
  states: StateVector[] | null;
}

interface OpenSkyFlights {
  icao24: string;
  firstSeen: number;
  estDepartureAirport: string;
  lastSeen: number;
  estArrivalAirport: string;
  callsign: string;
}

export class OpenSkyModule extends BaseModule {
  name = 'opensky';
  category = 'milint' as const;
  supportedEntityTypes = ['aircraft', 'location'];
  rateLimit: RateLimitConfig = { maxTokens: 5, refillRate: 1, refillInterval: 10000 };
  cacheTTL = 60;
  requiresApiKey = false;

  private normalizer: Normalizer;
  private baseUrl = 'https://opensky-network.org/api';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('opensky');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'aircraft', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const authConfig: Record<string, string> = {};
      if (apiKey) {
        const [user, pass] = apiKey.split(':');
        if (user && pass) {
          authConfig['auth'] = `${user}:${pass}`;
        }
      }

      const isIcao24 = /^[a-f0-9]{6}$/i.test(entity);
      const isCallsign = /^[A-Z]{2,3}\d{1,4}[A-Z]?$/i.test(entity);
      const coordMatch = entity.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);

      try {
        if (isIcao24 || isCallsign) {
          // Single aircraft tracking
          const params: Record<string, string> = {};
          if (isIcao24) params['icao24'] = entity.toLowerCase();

          const states = await this.makeRequest<OpenSkyStates>({
            url: `${this.baseUrl}/states/all`,
            method: 'GET',
            params,
            ...(apiKey ? { auth: { username: apiKey.split(':')[0], password: apiKey.split(':')[1] } } : {}),
          });
          apiCalls++;
          rawData['states'] = states;

          if (states.states) {
            for (const sv of states.states) {
              const callsign = sv[1]?.trim();
              if (isCallsign && callsign?.toUpperCase() !== entity.toUpperCase()) continue;

              const aircraftEntity = this.normalizer.createEntity({
                type: 'aircraft',
                name: `${callsign || 'Unknown'} (${sv[0]})`,
                description: `${sv[2]} | Alt: ${sv[7]?.toFixed(0) || '?'}m | Speed: ${sv[9]?.toFixed(0) || '?'}m/s | ${sv[8] ? 'On Ground' : 'Airborne'}`,
                attributes: {
                  icao24: sv[0],
                  callsign: callsign || null,
                  originCountry: sv[2],
                  timePosition: sv[3] ? new Date(sv[3] * 1000).toISOString() : null,
                  lastContact: sv[4] ? new Date(sv[4] * 1000).toISOString() : null,
                  longitude: sv[5],
                  latitude: sv[6],
                  baroAltitude: sv[7],
                  onGround: sv[8],
                  velocity: sv[9],
                  trueTrack: sv[10],
                  verticalRate: sv[11],
                  geoAltitude: sv[13],
                  squawk: sv[14],
                  spi: sv[15],
                  positionSource: sv[16],
                },
                confidence: 0.95,
                tags: ['opensky', 'aircraft', sv[2], sv[8] ? 'on-ground' : 'airborne'],
              });
              entities.push(aircraftEntity);
            }
          }

          // Get recent flights
          if (isIcao24) {
            try {
              const now = Math.floor(Date.now() / 1000);
              const weekAgo = now - 7 * 86400;

              const flights = await this.makeRequest<OpenSkyFlights[]>({
                url: `${this.baseUrl}/flights/aircraft`,
                method: 'GET',
                params: { icao24: entity.toLowerCase(), begin: weekAgo, end: now },
                ...(apiKey ? { auth: { username: apiKey.split(':')[0], password: apiKey.split(':')[1] } } : {}),
              });
              apiCalls++;
              rawData['flights'] = flights;

              for (const flight of (flights || []).slice(0, 20)) {
                entities.push(
                  this.normalizer.createEntity({
                    type: 'event',
                    name: `Flight ${flight.callsign?.trim() || flight.icao24}: ${flight.estDepartureAirport || '?'} -> ${flight.estArrivalAirport || '?'}`,
                    attributes: {
                      icao24: flight.icao24,
                      callsign: flight.callsign?.trim(),
                      departureAirport: flight.estDepartureAirport,
                      arrivalAirport: flight.estArrivalAirport,
                      firstSeen: new Date(flight.firstSeen * 1000).toISOString(),
                      lastSeen: new Date(flight.lastSeen * 1000).toISOString(),
                      durationMinutes: Math.round((flight.lastSeen - flight.firstSeen) / 60),
                    },
                    confidence: 0.9,
                    tags: ['flight', 'opensky'],
                  })
                );
              }
            } catch {
              // Flights supplementary
            }
          }
        } else if (coordMatch) {
          // Area search
          const lat = parseFloat(coordMatch[1]);
          const lon = parseFloat(coordMatch[2]);
          const delta = 1.0; // ~111km box

          const states = await this.makeRequest<OpenSkyStates>({
            url: `${this.baseUrl}/states/all`,
            method: 'GET',
            params: {
              lamin: lat - delta,
              lamax: lat + delta,
              lomin: lon - delta,
              lomax: lon + delta,
            },
            ...(apiKey ? { auth: { username: apiKey.split(':')[0], password: apiKey.split(':')[1] } } : {}),
          });
          apiCalls++;
          rawData['areaStates'] = states;

          if (states.states) {
            for (const sv of states.states.slice(0, 50)) {
              const callsign = sv[1]?.trim();
              entities.push(
                this.normalizer.createEntity({
                  type: 'aircraft',
                  name: `${callsign || 'Unknown'} (${sv[0]})`,
                  description: `${sv[2]} | Alt: ${sv[7]?.toFixed(0) || '?'}m`,
                  attributes: {
                    icao24: sv[0],
                    callsign: callsign || null,
                    originCountry: sv[2],
                    longitude: sv[5],
                    latitude: sv[6],
                    baroAltitude: sv[7],
                    onGround: sv[8],
                    velocity: sv[9],
                    trueTrack: sv[10],
                  },
                  confidence: 0.9,
                  tags: ['opensky', 'aircraft', sv[2]],
                })
              );
            }
          }
        }
      } catch (err) {
        errors.push(this.buildError('OPENSKY_ERROR', `OpenSky lookup failed: ${err}`));
      }

      return { rawData, entities, relationships: [], metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({ url: `${this.baseUrl}/states/all`, method: 'GET', params: { lamin: 51, lamax: 52, lomin: -1, lomax: 0 } }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'OpenSky Network unreachable' };
    }
  }
}
