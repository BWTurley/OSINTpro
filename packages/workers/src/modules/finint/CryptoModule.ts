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

interface EtherscanBalance {
  status: string;
  message: string;
  result: string;
}

interface EtherscanTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasUsed: string;
  isError: string;
  functionName: string;
}

interface BlockchairBtcAddress {
  data: Record<string, {
    address: {
      type: string;
      balance: number;
      received: number;
      spent: number;
      output_count: number;
      unspent_output_count: number;
      first_seen_receiving: string;
      last_seen_receiving: string;
      first_seen_spending: string;
      last_seen_spending: string;
      transaction_count: number;
    };
    transactions: string[];
  }>;
}

export class CryptoModule extends BaseModule {
  name = 'crypto';
  category = 'finint' as const;
  supportedEntityTypes = ['wallet'];
  rateLimit: RateLimitConfig = { maxTokens: 5, refillRate: 1, refillInterval: 1000 };
  cacheTTL = 300;
  requiresApiKey = true;

  private normalizer: Normalizer;

  constructor(redis: Redis) {
    super(redis);
    this.normalizer = new Normalizer('crypto');
  }

  private detectChain(address: string): 'eth' | 'btc' | 'unknown' {
    if (/^0x[a-fA-F0-9]{40}$/.test(address)) return 'eth';
    if (/^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address)) return 'btc';
    return 'unknown';
  }

  async collect(entity: string, apiKey?: string): Promise<CollectionResult> {
    return this.executeWithCache(entity, 'wallet', apiKey, async () => {
      const errors: CollectionError[] = [];
      const entities: NormalizedEntity[] = [];
      const relationships: NormalizedRelationship[] = [];
      let rawData: Record<string, unknown> = {};
      let apiCalls = 0;

      const chain = this.detectChain(entity);

      if (chain === 'eth') {
        // Etherscan API
        try {
          const balanceResult = await this.makeRequest<EtherscanBalance>({
            url: 'https://api.etherscan.io/api',
            method: 'GET',
            params: {
              module: 'account',
              action: 'balance',
              address: entity,
              tag: 'latest',
              apikey: apiKey || '',
            },
          });
          apiCalls++;
          rawData['ethBalance'] = balanceResult;

          const balanceEth = parseInt(balanceResult.result, 10) / 1e18;

          const txResult = await this.makeRequest<{
            status: string;
            result: EtherscanTx[];
          }>({
            url: 'https://api.etherscan.io/api',
            method: 'GET',
            params: {
              module: 'account',
              action: 'txlist',
              address: entity,
              startblock: 0,
              endblock: 99999999,
              page: 1,
              offset: 50,
              sort: 'desc',
              apikey: apiKey || '',
            },
          });
          apiCalls++;
          rawData['ethTransactions'] = txResult;

          const transactions = Array.isArray(txResult.result) ? txResult.result : [];
          const uniqueAddresses = new Set<string>();
          transactions.forEach((tx) => {
            if (tx.from.toLowerCase() !== entity.toLowerCase()) uniqueAddresses.add(tx.from.toLowerCase());
            if (tx.to.toLowerCase() !== entity.toLowerCase()) uniqueAddresses.add(tx.to.toLowerCase());
          });

          const walletEntity = this.normalizer.createEntity({
            type: 'wallet',
            name: entity,
            description: `Ethereum wallet with ${balanceEth.toFixed(4)} ETH`,
            attributes: {
              chain: 'ethereum',
              balanceWei: balanceResult.result,
              balanceEth,
              transactionCount: transactions.length,
              uniqueInteractions: uniqueAddresses.size,
              firstTransaction: transactions[transactions.length - 1]?.timeStamp
                ? new Date(parseInt(transactions[transactions.length - 1].timeStamp, 10) * 1000).toISOString()
                : null,
              lastTransaction: transactions[0]?.timeStamp
                ? new Date(parseInt(transactions[0].timeStamp, 10) * 1000).toISOString()
                : null,
              recentTransactions: transactions.slice(0, 10).map((tx) => ({
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                valueEth: parseInt(tx.value, 10) / 1e18,
                timestamp: new Date(parseInt(tx.timeStamp, 10) * 1000).toISOString(),
                isError: tx.isError === '1',
              })),
            },
            sourceUrl: `https://etherscan.io/address/${entity}`,
            confidence: 0.95,
            tags: ['ethereum', 'wallet', 'crypto'],
          });
          entities.push(walletEntity);

          for (const addr of Array.from(uniqueAddresses).slice(0, 20)) {
            const interactionEntity = this.normalizer.createEntity({
              type: 'wallet',
              name: addr,
              attributes: { chain: 'ethereum' },
              sourceUrl: `https://etherscan.io/address/${addr}`,
              confidence: 0.7,
              tags: ['ethereum', 'wallet'],
            });
            entities.push(interactionEntity);

            relationships.push(
              this.normalizer.createRelationship({
                sourceEntityId: walletEntity.id,
                targetEntityId: interactionEntity.id,
                type: 'communicates_with',
                label: 'transacted with',
                confidence: 0.9,
              })
            );
          }
        } catch (err) {
          errors.push(this.buildError('ETHERSCAN_ERROR', `Etherscan lookup failed: ${err}`));
        }
      } else if (chain === 'btc') {
        // Blockchair API for BTC
        try {
          const btcResult = await this.makeRequest<BlockchairBtcAddress>({
            url: `https://api.blockchair.com/bitcoin/dashboards/address/${entity}`,
            method: 'GET',
            params: apiKey ? { key: apiKey } : {},
          });
          apiCalls++;
          rawData['btcAddress'] = btcResult;

          const addressData = btcResult.data[entity];
          if (addressData) {
            const info = addressData.address;
            const balanceBtc = info.balance / 1e8;

            const walletEntity = this.normalizer.createEntity({
              type: 'wallet',
              name: entity,
              description: `Bitcoin wallet with ${balanceBtc.toFixed(8)} BTC`,
              attributes: {
                chain: 'bitcoin',
                type: info.type,
                balanceSatoshis: info.balance,
                balanceBtc,
                totalReceived: info.received / 1e8,
                totalSpent: info.spent / 1e8,
                transactionCount: info.transaction_count,
                outputCount: info.output_count,
                unspentOutputs: info.unspent_output_count,
                firstSeenReceiving: info.first_seen_receiving,
                lastSeenReceiving: info.last_seen_receiving,
                firstSeenSpending: info.first_seen_spending,
                lastSeenSpending: info.last_seen_spending,
                recentTxHashes: addressData.transactions.slice(0, 20),
              },
              sourceUrl: `https://blockchair.com/bitcoin/address/${entity}`,
              confidence: 0.95,
              tags: ['bitcoin', 'wallet', 'crypto'],
            });
            entities.push(walletEntity);
          }
        } catch (err) {
          errors.push(this.buildError('BLOCKCHAIR_ERROR', `Blockchair lookup failed: ${err}`));

          // Fallback to Blockchain.com
          try {
            const fallback = await this.makeRequest<{
              hash160: string;
              address: string;
              n_tx: number;
              total_received: number;
              total_sent: number;
              final_balance: number;
            }>({
              url: `https://blockchain.info/rawaddr/${entity}`,
              method: 'GET',
              params: { limit: 0 },
            });
            apiCalls++;
            rawData['blockchainInfo'] = fallback;

            entities.push(
              this.normalizer.createEntity({
                type: 'wallet',
                name: entity,
                description: `Bitcoin wallet with ${(fallback.final_balance / 1e8).toFixed(8)} BTC`,
                attributes: {
                  chain: 'bitcoin',
                  balanceSatoshis: fallback.final_balance,
                  balanceBtc: fallback.final_balance / 1e8,
                  totalReceived: fallback.total_received / 1e8,
                  totalSent: fallback.total_sent / 1e8,
                  transactionCount: fallback.n_tx,
                  hash160: fallback.hash160,
                },
                sourceUrl: `https://www.blockchain.com/btc/address/${entity}`,
                confidence: 0.9,
                tags: ['bitcoin', 'wallet', 'crypto'],
              })
            );
          } catch (err2) {
            errors.push(this.buildError('BLOCKCHAIN_INFO_ERROR', `Blockchain.info fallback failed: ${err2}`));
          }
        }
      } else {
        errors.push(this.buildError('UNKNOWN_CHAIN', `Cannot detect blockchain for address: ${entity}`, false));
      }

      return { rawData, entities, relationships, metadata: { apiCalls }, errors };
    });
  }

  normalize(rawData: unknown): NormalizedEntity[] {
    const data = rawData as Record<string, unknown>;
    const entities: NormalizedEntity[] = [];

    if (data['ethBalance']) {
      entities.push(
        this.normalizer.createEntity({
          type: 'wallet',
          name: 'eth-wallet',
          attributes: { chain: 'ethereum' },
          tags: ['ethereum'],
        })
      );
    }

    return entities;
  }

  async healthCheck(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.makeRequest({
        url: 'https://api.etherscan.io/api',
        method: 'GET',
        params: { module: 'stats', action: 'ethprice' },
      }, 1);
      return { status: 'ok', latency: Date.now() - start, lastCheck: new Date().toISOString() };
    } catch {
      return { status: 'down', latency: Date.now() - start, lastCheck: new Date().toISOString(), message: 'Crypto APIs unreachable' };
    }
  }
}
