import Redis from 'ioredis';
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

interface UrlhausUrl {
  id: string;
  urlhaus_reference: string;
  url: string;
  url_status: string;
  host: string;
  date_added: string;
  threat: string;
  blacklists: Record<string, string>;
  reporter: string;
  larted: boolean;
  tags: string[];
  payloads: Array<{
    filename: string;
    file_type: string;
    response_md5: string;
    response_sha256: string;
    signature: string;
  }>;
}

interface MalwareBazaarSample {
  sha256_hash: string;
  sha1_hash: string;
  md5_hash: string;
  first_seen: string;
  last_seen: string;
  file_name: string;
  file_size: number;
  file_type: string;
  file_type_mime: string;
  reporter: string;
  signature: string;
  tags: string[];
  delivery_method: string;
  intelligence: {
    clamav: string[];
    uploads: string;
    downloads: string;
    mail?: { generic?: string[]; smtp?: string[] };
  };
}

interface ThreatFoxIoc {
  id: string;
  ioc: string;
  threat_type: string;
  threat_type_desc: string;
  ioc_type: string;
  ioc_type_desc: string;
  malware: string;
  malware_printable: string;
  malware_alias: string;
  malware_malpedia: string;
  confidence_level: number;
  first_seen: string;
  last_seen: string;
  reporter: string;
  reference: string;
  tags: string[];
}

export class AbuseChModule extends BaseModule {
  name = 'abuse-ch';
  category = 'cti' as const;
  supportedEntityTypes = ['url', 'hash', 'domain', 'ip'];
  rateLimit: RateLimitConfig = { maxTokens: 5, refillRate: 2, refillInterval: 1000 };
  cacheTTL = 1800;
  requiresApiKey = false;

  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('abuse-ch');
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'indicator', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const isHash = /^[a-fA-F0-9]{32,64}$/.test(entity);
      const isUrl = entity.startsWith('http');
      const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(entity);

      // URLhaus lookup
      try {
        let urlhausResult: { query_status: string; urls?: UrlhausUrl[] };

        if (isUrl) {
          urlhausResult = await this.makeRequest<{ query_status: string; urls: UrlhausUrl[] }>({
            url: 'https://urlhaus-api.abuse.ch/v1/url/',
            method: 'POST',
            data: new URLSearchParams({ url: entity }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });
        } else if (isIp) {
          urlhausResult = await this.makeRequest<{ query_status: string; urls: UrlhausUrl[] }>({
            url: 'https://urlhaus-api.abuse.ch/v1/host/',
            method: 'POST',
            data: new URLSearchParams({ host: entity }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });
        } else if (!isHash) {
          urlhausResult = await this.makeRequest<{ query_status: string; urls: UrlhausUrl[] }>({
            url: 'https://urlhaus-api.abuse.ch/v1/host/',
            method: 'POST',
            data: new URLSearchParams({ host: entity }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });
        } else {
          urlhausResult = { query_status: 'no_results' };
        }
        apiCalls++;
        rawData['urlhaus'] = urlhausResult;

        if (urlhausResult.query_status === 'ok' && urlhausResult.urls) {
          for (const url of urlhausResult.urls.slice(0, 20)) {
            const urlEntity = this.normalizer.createEntity({
              type: 'url',
              name: url.url,
              description: `URLhaus: ${url.threat} | Status: ${url.url_status}`,
              attributes: {
                urlhausId: url.id,
                urlStatus: url.url_status,
                host: url.host,
                dateAdded: url.date_added,
                threat: url.threat,
                blacklists: url.blacklists,
                reporter: url.reporter,
                tags: url.tags,
                payloads: url.payloads,
              },
              sourceUrl: url.urlhaus_reference,
              confidence: 0.9,
              tags: ['urlhaus', 'malware-url', url.threat, ...url.tags],
            });
            entities.push(urlEntity);

            for (const payload of url.payloads || []) {
              const hashEntity = this.normalizer.createEntity({
                type: 'hash',
                name: payload.response_sha256,
                attributes: {
                  md5: payload.response_md5,
                  sha256: payload.response_sha256,
                  filename: payload.filename,
                  fileType: payload.file_type,
                  signature: payload.signature,
                },
                confidence: 0.9,
                tags: ['malware-payload', payload.signature],
              });
              entities.push(hashEntity);
              relationships.push(
                this.normalizer.createRelationship({
                  sourceEntityId: urlEntity.id,
                  targetEntityId: hashEntity.id,
                  type: 'hosts',
                  label: 'delivers payload',
                  confidence: 0.9,
                })
              );
            }
          }
        }
      } catch (err) {
        errors.push(this.buildError('URLHAUS_ERROR', `URLhaus lookup failed: ${err}`));
      }

      // MalwareBazaar for hashes
      if (isHash) {
        try {
          const mbResult = await this.makeRequest<{
            query_status: string;
            data: MalwareBazaarSample[];
          }>({
            url: 'https://mb-api.abuse.ch/api/v1/',
            method: 'POST',
            data: new URLSearchParams({
              query: 'get_info',
              hash: entity,
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });
          apiCalls++;
          rawData['malwarebazaar'] = mbResult;

          if (mbResult.query_status === 'ok' && mbResult.data) {
            for (const sample of mbResult.data) {
              entities.push(
                this.normalizer.createEntity({
                  type: 'hash',
                  name: sample.sha256_hash,
                  description: `MalwareBazaar: ${sample.signature || 'Unknown'} | ${sample.file_type}`,
                  attributes: {
                    sha256: sample.sha256_hash,
                    sha1: sample.sha1_hash,
                    md5: sample.md5_hash,
                    firstSeen: sample.first_seen,
                    lastSeen: sample.last_seen,
                    fileName: sample.file_name,
                    fileSize: sample.file_size,
                    fileType: sample.file_type,
                    mimeType: sample.file_type_mime,
                    signature: sample.signature,
                    tags: sample.tags,
                    deliveryMethod: sample.delivery_method,
                    intelligence: sample.intelligence,
                  },
                  sourceUrl: `https://bazaar.abuse.ch/sample/${sample.sha256_hash}/`,
                  confidence: 0.95,
                  tags: ['malware-bazaar', sample.signature, ...sample.tags],
                })
              );
            }
          }
        } catch (err) {
          errors.push(this.buildError('MALWAREBAZAAR_ERROR', `MalwareBazaar lookup failed: ${err}`));
        }
      }

      // ThreatFox IOC search
      try {
        const tfResult = await this.makeRequest<{
          query_status: string;
          data: ThreatFoxIoc[];
        }>({
          url: 'https://threatfox-api.abuse.ch/api/v1/',
          method: 'POST',
          data: JSON.stringify({ query: 'search_ioc', search_term: entity }),
          headers: { 'Content-Type': 'application/json' },
        });
        apiCalls++;
        rawData['threatfox'] = tfResult;

        if (tfResult.query_status === 'ok' && tfResult.data) {
          for (const ioc of tfResult.data.slice(0, 20)) {
            const iocEntity = this.normalizer.createEntity({
              type: 'indicator',
              name: ioc.ioc,
              description: `ThreatFox: ${ioc.malware_printable} (${ioc.threat_type_desc})`,
              attributes: {
                threatFoxId: ioc.id,
                iocType: ioc.ioc_type,
                iocTypeDesc: ioc.ioc_type_desc,
                threatType: ioc.threat_type,
                threatTypeDesc: ioc.threat_type_desc,
                malware: ioc.malware,
                malwarePrintable: ioc.malware_printable,
                malwareAlias: ioc.malware_alias,
                malpediaUrl: ioc.malware_malpedia,
                confidenceLevel: ioc.confidence_level,
                firstSeen: ioc.first_seen,
                lastSeen: ioc.last_seen,
                reporter: ioc.reporter,
                reference: ioc.reference,
                tags: ioc.tags,
              },
              sourceUrl: `https://threatfox.abuse.ch/ioc/${ioc.id}/`,
              confidence: ioc.confidence_level / 100,
              tags: ['threatfox', ioc.malware_printable, ...ioc.tags],
            });
            entities.push(iocEntity);
          }
        }
      } catch (err) {
        errors.push(this.buildError('THREATFOX_ERROR', `ThreatFox lookup failed: ${err}`));
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
      await this.httpClient.post('https://urlhaus-api.abuse.ch/v1/urls/recent/', new URLSearchParams({ limit: '1' }), { timeout: 5000 });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'abuse.ch APIs unreachable' };
    }
  }
}
