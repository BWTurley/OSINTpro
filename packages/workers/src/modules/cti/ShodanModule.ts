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

interface ShodanHost {
  ip_str: string;
  ports: number[];
  hostnames: string[];
  org: string;
  isp: string;
  os: string;
  asn: string;
  country_code: string;
  country_name: string;
  city: string;
  latitude: number;
  longitude: number;
  last_update: string;
  vulns?: string[];
  data: Array<{
    port: number;
    transport: string;
    product: string;
    version: string;
    data: string;
    ssl?: { cert: { subject: Record<string, string>; issuer: Record<string, string>; expires: string } };
    http?: { title: string; server: string; status: number };
  }>;
}

interface InternetDbResult {
  ip: string;
  ports: number[];
  cpes: string[];
  hostnames: string[];
  tags: string[];
  vulns: string[];
}

export class ShodanModule extends BaseModule {
  name = 'shodan';
  category = 'cti' as const;
  supportedEntityTypes = ['ip', 'domain'];
  rateLimit: RateLimitConfig = { maxTokens: 1, refillRate: 1, refillInterval: 1000 };
  cacheTTL = 1800;
  requiresApiKey = true;

  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('shodan');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'ip', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(entity);

      if (apiKey) {
        try {
          if (isIp) {
            const hostResult = await this.makeRequest<ShodanHost>({
              url: `https://api.shodan.io/shodan/host/${entity}`,
              method: 'GET',
              params: { key: apiKey },
            });
            apiCalls++;
            rawData['host'] = hostResult;

            const hostEntity = this.normalizer.createEntity({
              type: 'ip',
              name: entity,
              description: `${hostResult.org || 'Unknown org'} | ${hostResult.isp} | ${hostResult.country_name}`,
              attributes: {
                ports: hostResult.ports,
                hostnames: hostResult.hostnames,
                org: hostResult.org,
                isp: hostResult.isp,
                os: hostResult.os,
                asn: hostResult.asn,
                countryCode: hostResult.country_code,
                countryName: hostResult.country_name,
                city: hostResult.city,
                latitude: hostResult.latitude,
                longitude: hostResult.longitude,
                lastUpdate: hostResult.last_update,
                vulns: hostResult.vulns || [],
                services: hostResult.data.map((d) => ({
                  port: d.port,
                  transport: d.transport,
                  product: d.product,
                  version: d.version,
                  ssl: d.ssl ? { subject: d.ssl.cert.subject, issuer: d.ssl.cert.issuer, expires: d.ssl.cert.expires } : null,
                  http: d.http || null,
                })),
              },
              sourceUrl: `https://www.shodan.io/host/${entity}`,
              confidence: 0.95,
              tags: ['shodan', 'infrastructure'],
            });
            entities.push(hostEntity);

            for (const hostname of hostResult.hostnames) {
              const domainEntity = this.normalizer.createEntity({
                type: 'domain',
                name: hostname,
                attributes: {},
                sourceUrl: `https://www.shodan.io/host/${entity}`,
                confidence: 0.9,
                tags: ['hostname'],
              });
              entities.push(domainEntity);
              relationships.push(
                this.normalizer.createRelationship({
                  sourceEntityId: hostEntity.id,
                  targetEntityId: domainEntity.id,
                  type: 'resolves_to',
                  label: 'hostname',
                  confidence: 0.95,
                })
              );
            }

            if (hostResult.vulns) {
              for (const vuln of hostResult.vulns) {
                const vulnEntity = this.normalizer.createEntity({
                  type: 'vulnerability',
                  name: vuln,
                  attributes: { cve: vuln },
                  confidence: 0.8,
                  tags: ['cve', 'shodan-detected'],
                });
                entities.push(vulnEntity);
                relationships.push(
                  this.normalizer.createRelationship({
                    sourceEntityId: hostEntity.id,
                    targetEntityId: vulnEntity.id,
                    type: 'exploits',
                    label: 'vulnerable to',
                    confidence: 0.8,
                  })
                );
              }
            }
          } else {
            // Domain: DNS resolve + search
            const dnsResult = await this.makeRequest<Record<string, string>>({
              url: 'https://api.shodan.io/dns/resolve',
              method: 'GET',
              params: { hostnames: entity, key: apiKey },
            });
            apiCalls++;
            rawData['dns'] = dnsResult;

            const ip = dnsResult[entity];
            if (ip) {
              const domainEntity = this.normalizer.createEntity({
                type: 'domain',
                name: entity,
                attributes: { resolvedIp: ip },
                sourceUrl: `https://www.shodan.io/domain/${entity}`,
                confidence: 0.9,
                tags: ['domain'],
              });
              entities.push(domainEntity);

              const ipEntity = this.normalizer.createEntity({
                type: 'ip',
                name: ip,
                attributes: {},
                sourceUrl: `https://www.shodan.io/host/${ip}`,
                confidence: 0.9,
                tags: ['ip'],
              });
              entities.push(ipEntity);

              relationships.push(
                this.normalizer.createRelationship({
                  sourceEntityId: domainEntity.id,
                  targetEntityId: ipEntity.id,
                  type: 'resolves_to',
                  label: 'resolves to',
                  confidence: 0.95,
                })
              );
            }

            // Reverse DNS
            try {
              const reverseResult = await this.makeRequest<Record<string, string[]>>({
                url: 'https://api.shodan.io/dns/reverse',
                method: 'GET',
                params: { ips: ip || entity, key: apiKey },
              });
              apiCalls++;
              rawData['reverseDns'] = reverseResult;
            } catch {
              // Reverse DNS is supplementary
            }
          }
        } catch (err) {
          errors.push(this.buildError('SHODAN_API_ERROR', `Shodan API failed: ${err}`));
        }
      } else {
        // InternetDB free fallback
        if (isIp) {
          try {
            const idbResult = await this.makeRequest<InternetDbResult>({
              url: `https://internetdb.shodan.io/${entity}`,
              method: 'GET',
            });
            apiCalls++;
            rawData['internetdb'] = idbResult;

            const hostEntity = this.normalizer.createEntity({
              type: 'ip',
              name: entity,
              description: `InternetDB: ${idbResult.ports.length} ports, ${idbResult.vulns.length} vulns`,
              attributes: {
                ports: idbResult.ports,
                hostnames: idbResult.hostnames,
                cpes: idbResult.cpes,
                tags: idbResult.tags,
                vulns: idbResult.vulns,
              },
              sourceUrl: `https://internetdb.shodan.io/${entity}`,
              confidence: 0.75,
              tags: ['internetdb', 'free-tier'],
            });
            entities.push(hostEntity);

            for (const vuln of idbResult.vulns) {
              const vulnEntity = this.normalizer.createEntity({
                type: 'vulnerability',
                name: vuln,
                attributes: { cve: vuln },
                confidence: 0.7,
                tags: ['cve'],
              });
              entities.push(vulnEntity);
              relationships.push(
                this.normalizer.createRelationship({
                  sourceEntityId: hostEntity.id,
                  targetEntityId: vulnEntity.id,
                  type: 'exploits',
                  label: 'vulnerable to',
                  confidence: 0.7,
                })
              );
            }
          } catch (err) {
            errors.push(this.buildError('INTERNETDB_ERROR', `InternetDB lookup failed: ${err}`));
          }
        } else {
          errors.push(this.buildError('NO_API_KEY', 'Shodan API key required for domain lookups', false));
        }
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    const data = rawData as Record<string, unknown>;
    const host = data['host'] as ShodanHost | undefined;
    if (!host) return [];

    return [
      this.normalizer.createEntity({
        type: 'ip',
        name: host.ip_str,
        attributes: { ports: host.ports, org: host.org, asn: host.asn },
        tags: ['shodan'],
      }),
    ];
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({
        url: 'https://internetdb.shodan.io/8.8.8.8',
        method: 'GET',
      }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'Shodan unreachable' };
    }
  }
}
