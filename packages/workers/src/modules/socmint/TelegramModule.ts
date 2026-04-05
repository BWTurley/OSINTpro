import { Redis } from 'ioredis';
import { BaseModule } from '../../base/BaseModule.js';
import { Normalizer } from '../../base/Normalizer.js';
import type {
  CollectionResult,
  NormalizedEntity,
  ModuleHealth,
  RateLimitConfig,
  CollectionError,
} from '../../base/types.js';

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  description?: string;
  photo?: { small_file_id: string; big_file_id: string };
  invite_link?: string;
  linked_chat_id?: number;
  has_private_forwards?: boolean;
  member_count?: number;
}

export class TelegramModule extends BaseModule {
  name = 'telegram';
  category = 'socmint' as const;
  supportedEntityTypes = ['username', 'organization'];
  rateLimit: RateLimitConfig = { maxTokens: 30, refillRate: 30, refillInterval: 60000 };
  cacheTTL = 3600;
  requiresApiKey = true;

  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('telegram');
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    if (!apiKey) {
      return {
        success: false, module: this.name, entity, entityType: 'username',
        timestamp: new Date().toISOString(), rawData: null, normalized: [], relationships: [],
        metadata: { duration: 0, apiCalls: 0, cached: false, rateLimited: false, partial: false, pagesFetched: 0, totalPages: 0 },
        errors: [this.buildError('NO_API_KEY', 'Telegram Bot API token required', false)],
      };
    }

    return this.executeWithCache(entity, 'username', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const botUrl = `https://api.telegram.org/bot${apiKey}`;
      const username = entity.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');

      try {
        const chatResult = await this.makeRequest<{
          ok: boolean;
          result: TelegramChat;
        }>({
          url: `${botUrl}/getChat`,
          method: 'POST',
          data: { chat_id: `@${username}` },
        });
        apiCalls++;
        rawData['chat'] = chatResult;

        if (chatResult.ok) {
          const chat = chatResult.result;
          const isGroup = chat.type === 'group' || chat.type === 'supergroup';
          const isChannel = chat.type === 'channel';

          const chatEntity = this.normalizer.createEntity({
            type: isChannel || isGroup ? 'organization' : 'username',
            name: chat.title || `${chat.first_name || ''} ${chat.last_name || ''}`.trim() || username,
            description: chat.description || chat.bio || '',
            attributes: {
              telegramId: chat.id,
              type: chat.type,
              username: chat.username,
              firstName: chat.first_name,
              lastName: chat.last_name,
              bio: chat.bio,
              description: chat.description,
              inviteLink: chat.invite_link,
              linkedChatId: chat.linked_chat_id,
              hasPrivateForwards: chat.has_private_forwards,
            },
            sourceUrl: `https://t.me/${username}`,
            confidence: 0.9,
            tags: ['telegram', chat.type, ...(isChannel ? ['channel'] : []), ...(isGroup ? ['group'] : [])],
          });
          entities.push(chatEntity);

          // Get member count for groups/channels
          if (isGroup || isChannel) {
            try {
              const countResult = await this.makeRequest<{
                ok: boolean;
                result: number;
              }>({
                url: `${botUrl}/getChatMemberCount`,
                method: 'POST',
                data: { chat_id: `@${username}` },
              });
              apiCalls++;

              if (countResult.ok) {
                chatEntity.attributes = {
                  ...chatEntity.attributes,
                  memberCount: countResult.result,
                };
                chatEntity.description = `${chat.type} with ${countResult.result} members`;
              }
            } catch {
              // Member count may not be accessible
            }
          }

          // Try to get pinned message
          try {
            const pinnedResult = await this.makeRequest<{
              ok: boolean;
              result: { pinned_message?: { text?: string; date: number; message_id: number } };
            }>({
              url: `${botUrl}/getChat`,
              method: 'POST',
              data: { chat_id: `@${username}` },
            });

            if (pinnedResult.result.pinned_message) {
              const pinned = pinnedResult.result.pinned_message;
              chatEntity.attributes = {
                ...chatEntity.attributes,
                pinnedMessage: {
                  text: pinned.text?.slice(0, 500),
                  date: new Date(pinned.date * 1000).toISOString(),
                  messageId: pinned.message_id,
                },
              };
            }
          } catch {
            // Pinned message may not be accessible
          }
        }
      } catch (err) {
        errors.push(this.buildError('TELEGRAM_ERROR', `Telegram lookup failed: ${err}`));
      }

      return { rawData, entities, relationships: [], metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] { return []; }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    // Can't health check without a bot token
    return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'Requires bot token for full check' };
  }
}
