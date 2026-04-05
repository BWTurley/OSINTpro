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

export class YouTubeModule extends BaseModule {
  name = 'youtube';
  category = 'socmint' as const;
  supportedEntityTypes = ['username', 'organization', 'person'];
  rateLimit: RateLimitConfig = { maxTokens: 100, refillRate: 100, refillInterval: 86400000 };
  cacheTTL = 3600;
  requiresApiKey = true;

  private normalizer: Normalizer;
  private baseUrl = 'https://www.googleapis.com/youtube/v3';

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('youtube');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false, module: this.name, entity, entityType: 'username',
        timestamp: new Date().toISOString(), rawData: null, normalized: [], relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'YouTube Data API key required', false)],
      };
    }

    return this.executeWithCache(entity, 'username', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      try {
        // Search for channels
        const searchResult = await this.makeRequest<{
          items: Array<{
            id: { kind: string; channelId?: string; videoId?: string };
            snippet: {
              channelId: string;
              channelTitle: string;
              title: string;
              description: string;
              publishedAt: string;
              thumbnails: Record<string, { url: string }>;
            };
          }>;
          pageInfo: { totalResults: number };
        }>({
          url: `${this.baseUrl}/search`,
          method: 'GET',
          params: { key: apiKey, q: entity, type: 'channel', part: 'snippet', maxResults: 5 },
        });
        apiCalls++;
        rawData['search'] = searchResult;

        for (const item of searchResult.items) {
          const channelId = item.id.channelId || item.snippet.channelId;
          if (!channelId) continue;

          // Get full channel details
          const channelResult = await this.makeRequest<{
            items: Array<{
              id: string;
              snippet: {
                title: string;
                description: string;
                customUrl: string;
                publishedAt: string;
                country: string;
                thumbnails: Record<string, { url: string }>;
              };
              statistics: {
                viewCount: string;
                subscriberCount: string;
                videoCount: string;
                hiddenSubscriberCount: boolean;
              };
              brandingSettings?: {
                channel: { keywords?: string; description?: string };
              };
            }>;
          }>({
            url: `${this.baseUrl}/channels`,
            method: 'GET',
            params: {
              key: apiKey,
              id: channelId,
              part: 'snippet,statistics,brandingSettings',
            },
          });
          apiCalls++;

          if (channelResult.items.length > 0) {
            const ch = channelResult.items[0];
            const stats = ch.statistics;

            const channelEntity = this.normalizer.createEntity({
              type: 'username',
              name: ch.snippet.title,
              description: ch.snippet.description?.slice(0, 500) || '',
              attributes: {
                channelId: ch.id,
                customUrl: ch.snippet.customUrl,
                publishedAt: ch.snippet.publishedAt,
                country: ch.snippet.country,
                viewCount: parseInt(stats.viewCount, 10),
                subscriberCount: stats.hiddenSubscriberCount ? null : parseInt(stats.subscriberCount, 10),
                videoCount: parseInt(stats.videoCount, 10),
                hiddenSubscribers: stats.hiddenSubscriberCount,
                thumbnailUrl: ch.snippet.thumbnails?.medium?.url,
                keywords: ch.brandingSettings?.channel?.keywords,
              },
              sourceUrl: `https://www.youtube.com/channel/${ch.id}`,
              confidence: 0.9,
              tags: ['youtube', 'channel', ch.snippet.country || 'unknown'],
            });
            entities.push(channelEntity);

            // Get recent videos
            try {
              const videosResult = await this.makeRequest<{
                items: Array<{
                  id: { videoId: string };
                  snippet: {
                    title: string;
                    description: string;
                    publishedAt: string;
                    thumbnails: Record<string, { url: string }>;
                  };
                }>;
              }>({
                url: `${this.baseUrl}/search`,
                method: 'GET',
                params: {
                  key: apiKey,
                  channelId,
                  type: 'video',
                  part: 'snippet',
                  order: 'date',
                  maxResults: 10,
                },
              });
              apiCalls++;

              for (const video of videosResult.items) {
                const videoEntity = this.normalizer.createEntity({
                  type: 'event',
                  name: video.snippet.title,
                  description: video.snippet.description?.slice(0, 300) || '',
                  attributes: {
                    videoId: video.id.videoId,
                    publishedAt: video.snippet.publishedAt,
                    thumbnailUrl: video.snippet.thumbnails?.medium?.url,
                  },
                  sourceUrl: `https://www.youtube.com/watch?v=${video.id.videoId}`,
                  confidence: 0.9,
                  tags: ['youtube', 'video'],
                });
                entities.push(videoEntity);

                relationships.push(
                  this.normalizer.createRelationship({
                    sourceEntityId: channelEntity.id,
                    targetEntityId: videoEntity.id,
                    type: 'owns',
                    label: 'published',
                    confidence: 0.95,
                  })
                );
              }
            } catch {
              // Videos supplementary
            }
          }
        }
      } catch (err) {
        errors.push(this.buildError('YOUTUBE_ERROR', `YouTube search failed: ${err}`));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.httpClient.get(`${this.baseUrl}/search`, { timeout: 5000, validateStatus: () => true });
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'YouTube API unreachable' };
    }
  }
}
