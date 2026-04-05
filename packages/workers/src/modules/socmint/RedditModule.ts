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

interface RedditToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface RedditUser {
  name: string;
  id: string;
  created_utc: number;
  link_karma: number;
  comment_karma: number;
  is_gold: boolean;
  is_mod: boolean;
  has_verified_email: boolean;
  icon_img: string;
  subreddit?: { display_name_prefixed: string; subscribers: number; public_description: string };
}

interface RedditPost {
  kind: string;
  data: {
    name: string;
    title: string;
    selftext: string;
    author: string;
    subreddit: string;
    score: number;
    num_comments: number;
    created_utc: number;
    url: string;
    permalink: string;
    domain: string;
    is_self: boolean;
  };
}

export class RedditModule extends BaseModule {
  name = 'reddit';
  category = 'socmint' as const;
  supportedEntityTypes = ['username', 'person'];
  rateLimit: RateLimitConfig = { maxTokens: 60, refillRate: 60, refillInterval: 60000 };
  cacheTTL = 1800;
  requiresApiKey = true;

  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('reddit');
  }

  private async getToken(apiKey: string): Promise<string> {
    const cacheKey = 'reddit:oauth-token';
    const cached = await this.cache.get<string>(cacheKey);
    if (cached) return cached;

    const [clientId, clientSecret] = apiKey.split(':');
    if (!clientId || !clientSecret) throw new Error('Reddit API key must be client_id:client_secret');

    const result = await this.httpClient.post<RedditToken>(
      'https://www.reddit.com/api/v1/access_token',
      new URLSearchParams({ grant_type: 'client_credentials' }),
      {
        auth: { username: clientId, password: clientSecret },
        headers: { 'User-Agent': 'OSINT-Dashboard/1.0', 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    await this.cache.set(cacheKey, result.data.access_token, result.data.expires_in - 60);
    return result.data.access_token;
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false, module: this.name, entity, entityType: 'username',
        timestamp: new Date().toISOString(), rawData: null, normalized: [], relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'Reddit OAuth client_id:client_secret required', false)],
      };
    }

    return this.executeWithCache(entity, 'username', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      try {
        const token = await this.getToken(apiKey);
        apiCalls++;
        const headers = {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'OSINT-Dashboard/1.0',
        };

        const username = entity.replace(/^u\//, '').replace(/^\/u\//, '');

        // User profile
        const userResult = await this.makeRequest<{ data: RedditUser }>({
          url: `https://oauth.reddit.com/user/${username}/about`,
          method: 'GET',
          headers,
        });
        apiCalls++;
        rawData['user'] = userResult;

        const user = userResult.data;
        const userEntity = this.normalizer.createEntity({
          type: 'username',
          name: user.name,
          description: `Reddit user since ${new Date(user.created_utc * 1000).toISOString().split('T')[0]}`,
          attributes: {
            redditId: user.id,
            created: new Date(user.created_utc * 1000).toISOString(),
            linkKarma: user.link_karma,
            commentKarma: user.comment_karma,
            totalKarma: user.link_karma + user.comment_karma,
            isGold: user.is_gold,
            isMod: user.is_mod,
            hasVerifiedEmail: user.has_verified_email,
            iconImg: user.icon_img,
            profileSubreddit: user.subreddit,
          },
          sourceUrl: `https://www.reddit.com/user/${user.name}`,
          confidence: 0.95,
          tags: ['reddit', 'social-media', ...(user.is_mod ? ['moderator'] : [])],
        });
        entities.push(userEntity);

        // Recent posts
        const postsResult = await this.makeRequest<{
          data: { children: RedditPost[] };
        }>({
          url: `https://oauth.reddit.com/user/${username}/submitted`,
          method: 'GET',
          headers,
          params: { limit: 25, sort: 'new' },
        });
        apiCalls++;
        rawData['posts'] = postsResult;

        const subredditCounts = new Map<string, number>();

        for (const post of postsResult.data.children) {
          const p = post.data;
          subredditCounts.set(p.subreddit, (subredditCounts.get(p.subreddit) || 0) + 1);

          const postEntity = this.normalizer.createEntity({
            type: 'event',
            name: p.title.slice(0, 200),
            description: p.selftext?.slice(0, 300) || '',
            attributes: {
              redditId: p.name,
              subreddit: p.subreddit,
              score: p.score,
              numComments: p.num_comments,
              created: new Date(p.created_utc * 1000).toISOString(),
              url: p.url,
              permalink: `https://www.reddit.com${p.permalink}`,
              domain: p.domain,
              isSelf: p.is_self,
            },
            sourceUrl: `https://www.reddit.com${p.permalink}`,
            confidence: 0.95,
            tags: ['reddit', 'post', `r/${p.subreddit}`],
          });
          entities.push(postEntity);

          relationships.push(
            this.normalizer.createRelationship({
              sourceEntityId: userEntity.id,
              targetEntityId: postEntity.id,
              type: 'owns',
              label: 'posted',
              confidence: 0.95,
            })
          );
        }

        // Recent comments
        const commentsResult = await this.makeRequest<{
          data: {
            children: Array<{
              data: {
                name: string;
                body: string;
                subreddit: string;
                score: number;
                created_utc: number;
                permalink: string;
                link_title: string;
              };
            }>;
          };
        }>({
          url: `https://oauth.reddit.com/user/${username}/comments`,
          method: 'GET',
          headers,
          params: { limit: 25, sort: 'new' },
        });
        apiCalls++;
        rawData['comments'] = commentsResult;

        for (const comment of commentsResult.data.children) {
          const c = comment.data;
          subredditCounts.set(c.subreddit, (subredditCounts.get(c.subreddit) || 0) + 1);
        }

        // Add subreddit activity summary to user entity
        const topSubreddits = Array.from(subredditCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20);

        userEntity.attributes = {
          ...userEntity.attributes,
          topSubreddits: topSubreddits.map(([sub, count]) => ({ subreddit: sub, count })),
          totalPostsFetched: postsResult.data.children.length,
          totalCommentsFetched: commentsResult.data.children.length,
        };

      } catch (err) {
        errors.push(this.buildError('REDDIT_ERROR', `Reddit user lookup failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.get('https://www.reddit.com/api/v1/scopes', { timeout: 5000, validateStatus: () => true });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'Reddit API unreachable' };
    }
  }
}
