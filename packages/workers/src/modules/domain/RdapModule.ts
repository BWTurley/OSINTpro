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

interface RdapEntity {
  objectClassName: string;
  handle: string;
  roles: string[];
  vcardArray?: [string, Array<[string, Record<string, string>, string, string | string[]]>];
  entities?: RdapEntity[];
}

interface RdapResponse {
  objectClassName: string;
  handle: string;
  ldhName: string;
  unicodeName?: string;
  status: string[];
  events: Array<{ eventAction: string; eventDate: string }>;
  entities: RdapEntity[];
  nameservers?: Array<{ ldhName: string; objectClassName: string }>;
  secureDNS?: { delegationSigned: boolean };
  links?: Array<{ rel: string; href: string; type: string }>;
  notices?: Array<{ title: string; description: string[] }>;
  port43?: string;
}

export class RdapModule extends BaseModule {
  name = 'rdap';
  category = 'domain' as const;
  supportedEntityTypes = ['domain', 'ip'];
  rateLimit: RateLimitConfig = { maxTokens: 5, refillRate: 2, refillInterval: 1000 };
  cacheTTL = 86400;
  requiresApiKey = false;

  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('rdap');
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'domain', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(entity);
      const lookupUrl = isIp
        ? `https://rdap.org/ip/${entity}`
        : `https://rdap.org/domain/${entity}`;

      try {
        const result = await this.makeRequest<RdapResponse>({
          url: lookupUrl,
          method: 'GET',
          headers: { Accept: 'application/rdap+json' },
        });
        apiCalls++;
        rawData['rdap'] = result;

        const events: Record<string, string> = {};
        for (const event of result.events || []) {
          events[event.eventAction] = event.eventDate;
        }

        const mainEntity = this.normalizer.createEntity({
          type: isIp ? 'ip' : 'domain',
          name: result.ldhName || entity,
          description: `RDAP: ${result.status?.join(', ') || 'unknown status'}`,
          attributes: {
            handle: result.handle,
            status: result.status,
            registrationDate: events['registration'],
            expirationDate: events['expiration'],
            lastChangedDate: events['last changed'],
            lastUpdateOfRdap: events['last update of RDAP database'],
            secureDns: result.secureDNS,
            port43: result.port43,
          },
          sourceUrl: lookupUrl,
          confidence: 0.95,
          tags: ['rdap', 'whois', ...(result.status || [])],
        });
        entities.push(mainEntity);

        // Parse nameservers
        if (result.nameservers) {
          for (const ns of result.nameservers) {
            const nsEntity = this.normalizer.createEntity({
              type: 'domain',
              name: ns.ldhName,
              attributes: {},
              confidence: 0.9,
              tags: ['nameserver'],
            });
            entities.push(nsEntity);
            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: mainEntity.id,
                targetEntityId: nsEntity.id,
                type: 'uses',
                label: 'nameserver',
                confidence: 0.95,
              })
            );
          }
        }

        // Parse entities (registrant, admin, tech contacts)
        for (const rdapEntity of result.entities || []) {
          const vcard = rdapEntity.vcardArray;
          let contactName = '';
          let contactOrg = '';
          let contactEmail = '';

          if (vcard && vcard[1]) {
            for (const field of vcard[1]) {
              if (field[0] === 'fn') contactName = String(field[3]);
              if (field[0] === 'org') contactOrg = String(field[3]);
              if (field[0] === 'email') contactEmail = String(field[3]);
            }
          }

          if (contactName || contactOrg) {
            const contactEntity = this.normalizer.createEntity({
              type: contactOrg ? 'organization' : 'person',
              name: contactName || contactOrg,
              attributes: {
                organization: contactOrg,
                email: contactEmail,
                roles: rdapEntity.roles,
                handle: rdapEntity.handle,
              },
              confidence: 0.85,
              tags: ['whois-contact', ...rdapEntity.roles],
            });
            entities.push(contactEntity);

            const roleLabel = rdapEntity.roles?.join(', ') || 'contact';
            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: mainEntity.id,
                targetEntityId: contactEntity.id,
                type: 'registered_by',
                label: roleLabel,
                confidence: 0.85,
              })
            );
          }
        }
      } catch (err) {
        errors.push(this.buildError('RDAP_ERROR', `RDAP lookup failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    const data = rawData as Record<string, unknown>;
    const rdap = data['rdap'] as RdapResponse | undefined;
    if (!rdap) return [];

    return [
      this.normalizer.createEntity({
        type: 'domain',
        name: rdap.ldhName,
        attributes: { status: rdap.status },
        tags: ['rdap'],
      }),
    ];
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({
        url: 'https://rdap.org/domain/example.com',
        method: 'GET',
        headers: { Accept: 'application/rdap+json' },
      }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'RDAP unreachable' };
    }
  }
}
