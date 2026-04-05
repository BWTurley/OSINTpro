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

interface MastodonAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  note: string;
  url: string;
  avatar: string;
  header: string;
  followers_count: number;
  following_count: number;
  statuses_count: number;
  created_at: string;
  bot: boolean;
  group: boolean;
  fields: Array<{ name: string; value: string; verified_at: string | null }>;
  emojis: Array<{ shortcode: string; url: string }>;
  last_status_at: string;
}

interface MastodonStatus {
  id: string;
  created_at: string;
  content: string;
  url: string;
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  language: string;
  visibility: string;
  sensitive: boolean;
  spoiler_text: string;
  tags: Array<{ name: string; url: string }>;
  mentions: Array<{ id: string; username: string; acct: string; url: string }>;
}

export class MastodonModule extends BaseModule {
  name = 'mastodon';
  category = 'socmint' as const;
  supportedEntityTypes = ['username', 'person'];
  rateLimit: RateLimitConfig = { maxTokens: 30, refillRate: 30, refillInterval: 300000 };
  cacheTTL = 1800;
  requiresApiKey = false;

  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('mastodon');
  }

  private parseHandle(entity: string): { username: string; instance: string } {
    const clean = entity.replace(/^@/, '');
    const parts = clean.split('@');
    if (parts.length === 2) {
      return { username: parts[0], instance: parts[1] };
    }
    return { username: clean, instance: 'mastodon.social' };
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'username', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const { username, instance } = this.parseHandle(entity);
      const baseUrl = `https://${instance}/api`;

      try {
        // Search for account
        const searchResult = await this.makeRequest<{
          accounts: MastodonAccount[];
        }>({
          url: `${baseUrl}/v2/search`,
          method: 'GET',
          params: { q: `@${username}@${instance}`, type: 'accounts', limit: 5 },
        });
        apiCalls++;
        rawData['search'] = searchResult;

        const account = searchResult.accounts.find(
          (a) => a.username.toLowerCase() === username.toLowerCase()
        ) || searchResult.accounts[0];

        if (!account) {
          errors.push(this.buildError('NOT_FOUND', `Mastodon account @${username}@${instance} not found`, false));
          return { rawData, entities, relationships, metadata: { apiCalls }, errors };
        }

        rawData['account'] = account;

        const profileEntity = this.normalizer.createEntity({
          type: 'username',
          name: account.display_name || account.acct,
          description: account.note.replace(/<[^>]*>/g, '').slice(0, 500),
          attributes: {
            mastodonId: account.id,
            username: account.username,
            acct: account.acct,
            instance,
            avatar: account.avatar,
            header: account.header,
            followersCount: account.followers_count,
            followingCount: account.following_count,
            statusesCount: account.statuses_count,
            createdAt: account.created_at,
            isBot: account.bot,
            isGroup: account.group,
            lastStatusAt: account.last_status_at,
            fields: account.fields.map((f) => ({
              name: f.name,
              value: f.value.replace(/<[^>]*>/g, ''),
              verified: !!f.verified_at,
            })),
          },
          sourceUrl: account.url,
          confidence: 0.95,
          tags: ['mastodon', 'fediverse', instance, ...(account.bot ? ['bot'] : [])],
        });
        entities.push(profileEntity);

        // Get statuses
        try {
          const statuses = await this.makeRequest<MastodonStatus[]>({
            url: `${baseUrl}/v1/accounts/${account.id}/statuses`,
            method: 'GET',
            params: { limit: 30, exclude_replies: true, exclude_reblogs: true },
          });
          apiCalls++;
          rawData['statuses'] = statuses;

          const tagCounts = new Map<string, number>();

          for (const status of statuses) {
            const text = status.content.replace(/<[^>]*>/g, '');

            const statusEntity = this.normalizer.createEntity({
              type: 'event',
              name: text.slice(0, 150),
              description: text.slice(0, 500),
              attributes: {
                statusId: status.id,
                createdAt: status.created_at,
                reblogsCount: status.reblogs_count,
                favouritesCount: status.favourites_count,
                repliesCount: status.replies_count,
                language: status.language,
                visibility: status.visibility,
                sensitive: status.sensitive,
                spoilerText: status.spoiler_text,
                tags: status.tags.map((t) => t.name),
                mentions: status.mentions.map((m) => m.acct),
              },
              sourceUrl: status.url,
              confidence: 0.95,
              tags: ['mastodon', 'toot', ...status.tags.map((t) => t.name)],
            });
            entities.push(statusEntity);

            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: profileEntity.id,
                targetEntityId: statusEntity.id,
                type: 'owns',
                label: 'posted',
                confidence: 0.95,
              })
            );

            for (const tag of status.tags) {
              tagCounts.set(tag.name, (tagCounts.get(tag.name) || 0) + 1);
            }
          }

          profileEntity.attributes = {
            ...profileEntity.attributes,
            topHashtags: Array.from(tagCounts.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 20)
              .map(([tag, count]) => ({ tag, count })),
          };
        } catch {
          // Statuses supplementary
        }

      } catch (err) {
        errors.push(this.buildError('MASTODON_ERROR', `Mastodon lookup failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({
        url: 'https://mastodon.social/api/v2/instance',
        method: 'GET',
      }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'Mastodon API unreachable' };
    }
  }
}
