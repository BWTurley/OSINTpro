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

interface BskyProfile {
  did: string;
  handle: string;
  displayName: string;
  description: string;
  avatar: string;
  banner: string;
  followsCount: number;
  followersCount: number;
  postsCount: number;
  indexedAt: string;
  createdAt: string;
  labels: Array<{ val: string }>;
}

interface BskyPost {
  uri: string;
  cid: string;
  author: { did: string; handle: string; displayName: string };
  record: { text: string; createdAt: string; langs?: string[] };
  replyCount: number;
  repostCount: number;
  likeCount: number;
  indexedAt: string;
}

export class BlueskyModule extends BaseModule {
  name = 'bluesky';
  category = 'socmint' as const;
  supportedEntityTypes = ['username', 'person'];
  rateLimit: RateLimitConfig = { maxTokens: 30, refillRate: 30, refillInterval: 300000 };
  cacheTTL = 1800;
  requiresApiKey = false;

  private normalizer: Normalizer;
  private baseUrl = 'https://public.api.bsky.app/xrpc';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('bluesky');
  }

  async collect(entity: string, _apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'username', undefined, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const handle = entity.replace(/^@/, '').includes('.') ? entity.replace(/^@/, '') : `${entity.replace(/^@/, '')}.bsky.social`;

      try {
        // Resolve handle to DID
        const resolveResult = await this.makeRequest<{ did: string }>({
          url: `${this.baseUrl}/com.atproto.identity.resolveHandle`,
          method: 'GET',
          params: { handle },
        });
        apiCalls++;
        const did = resolveResult.did;
        rawData['did'] = did;

        // Get profile
        const profile = await this.makeRequest<BskyProfile>({
          url: `${this.baseUrl}/app.bsky.actor.getProfile`,
          method: 'GET',
          params: { actor: did },
        });
        apiCalls++;
        rawData['profile'] = profile;

        const profileEntity = this.normalizer.createEntity({
          type: 'username',
          name: profile.displayName || profile.handle,
          description: profile.description?.slice(0, 500) || '',
          attributes: {
            did: profile.did,
            handle: profile.handle,
            displayName: profile.displayName,
            avatar: profile.avatar,
            banner: profile.banner,
            followsCount: profile.followsCount,
            followersCount: profile.followersCount,
            postsCount: profile.postsCount,
            createdAt: profile.createdAt,
            indexedAt: profile.indexedAt,
            labels: profile.labels?.map((l) => l.val) || [],
          },
          sourceUrl: `https://bsky.app/profile/${profile.handle}`,
          confidence: 0.95,
          tags: ['bluesky', 'at-protocol', 'social-media'],
        });
        entities.push(profileEntity);

        // Get recent posts (author feed)
        try {
          const feedResult = await this.makeRequest<{
            feed: Array<{ post: BskyPost; reply?: unknown; reason?: unknown }>;
            cursor?: string;
          }>({
            url: `${this.baseUrl}/app.bsky.feed.getAuthorFeed`,
            method: 'GET',
            params: { actor: did, limit: 30, filter: 'posts_no_replies' },
          });
          apiCalls++;
          rawData['feed'] = feedResult;

          for (const item of feedResult.feed) {
            const post = item.post;
            const postEntity = this.normalizer.createEntity({
              type: 'event',
              name: post.record.text.slice(0, 150),
              description: post.record.text,
              attributes: {
                uri: post.uri,
                cid: post.cid,
                createdAt: post.record.createdAt,
                replyCount: post.replyCount,
                repostCount: post.repostCount,
                likeCount: post.likeCount,
                languages: post.record.langs,
                indexedAt: post.indexedAt,
              },
              sourceUrl: `https://bsky.app/profile/${profile.handle}/post/${post.uri.split('/').pop()}`,
              confidence: 0.95,
              tags: ['bluesky', 'post'],
            });
            entities.push(postEntity);

            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: profileEntity.id,
                targetEntityId: postEntity.id,
                type: 'owns',
                label: 'posted',
                confidence: 0.95,
              })
            );
          }
        } catch {
          // Feed is supplementary
        }

        // Get followers (sample)
        try {
          const followersResult = await this.makeRequest<{
            followers: Array<{ did: string; handle: string; displayName: string; indexedAt: string }>;
            cursor?: string;
          }>({
            url: `${this.baseUrl}/app.bsky.graph.getFollowers`,
            method: 'GET',
            params: { actor: did, limit: 20 },
          });
          apiCalls++;
          rawData['followers'] = followersResult;

          for (const follower of followersResult.followers) {
            const followerEntity = this.normalizer.createEntity({
              type: 'username',
              name: follower.displayName || follower.handle,
              attributes: { did: follower.did, handle: follower.handle },
              sourceUrl: `https://bsky.app/profile/${follower.handle}`,
              confidence: 0.7,
              tags: ['bluesky', 'follower'],
            });
            entities.push(followerEntity);

            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: followerEntity.id,
                targetEntityId: profileEntity.id,
                type: 'affiliated_with',
                label: 'follows',
                confidence: 0.9,
              })
            );
          }
        } catch {
          // Followers supplementary
        }

      } catch (err) {
        errors.push(this.buildError('BLUESKY_ERROR', `Bluesky lookup failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({
        url: `${this.baseUrl}/com.atproto.identity.resolveHandle`,
        method: 'GET',
        params: { handle: 'bsky.app' },
      }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'Bluesky API unreachable' };
    }
  }
}
