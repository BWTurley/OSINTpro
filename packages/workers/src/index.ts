import Redis from 'ioredis';
import pino from 'pino';
import type { BaseModule } from './base/BaseModule.js';

// FININT modules
import { SecEdgarModule } from './modules/finint/SecEdgarModule.js';
import { OpenCorporatesModule } from './modules/finint/OpenCorporatesModule.js';
import { GleifModule } from './modules/finint/GleifModule.js';
import { FredModule } from './modules/finint/FredModule.js';
import { SanctionsModule } from './modules/finint/SanctionsModule.js';
import { CryptoModule } from './modules/finint/CryptoModule.js';

// CTI modules
import { ShodanModule } from './modules/cti/ShodanModule.js';
import { VirusTotalModule } from './modules/cti/VirusTotalModule.js';
import { AbuseIPDBModule } from './modules/cti/AbuseIPDBModule.js';
import { AlienVaultOTXModule } from './modules/cti/AlienVaultOTXModule.js';
import { NvdModule } from './modules/cti/NvdModule.js';
import { CisaKevModule } from './modules/cti/CisaKevModule.js';
import { UrlScanModule } from './modules/cti/UrlScanModule.js';
import { AbuseChModule } from './modules/cti/AbuseChModule.js';
import { CertTransparencyModule } from './modules/cti/CertTransparencyModule.js';
import { MitreAttackModule } from './modules/cti/MitreAttackModule.js';
import { HibpModule } from './modules/cti/HibpModule.js';

// Domain modules
import { RdapModule } from './modules/domain/RdapModule.js';
import { DnsModule } from './modules/domain/DnsModule.js';
import { SecurityTrailsModule } from './modules/domain/SecurityTrailsModule.js';

// GEOINT modules
import { IpGeolocationModule } from './modules/geoint/IpGeolocationModule.js';
import { OsmModule } from './modules/geoint/OsmModule.js';
import { SentinelHubModule } from './modules/geoint/SentinelHubModule.js';
import { NasaGibsModule } from './modules/geoint/NasaGibsModule.js';

// SOCMINT modules
import { YouTubeModule } from './modules/socmint/YouTubeModule.js';
import { RedditModule } from './modules/socmint/RedditModule.js';
import { BlueskyModule } from './modules/socmint/BlueskyModule.js';
import { MastodonModule } from './modules/socmint/MastodonModule.js';
import { TelegramModule } from './modules/socmint/TelegramModule.js';
import { UsernameEnumModule } from './modules/socmint/UsernameEnumModule.js';

// People modules
import { EmailIntelModule } from './modules/people/EmailIntelModule.js';
import { PhoneIntelModule } from './modules/people/PhoneIntelModule.js';
import { CourtRecordsModule } from './modules/people/CourtRecordsModule.js';
import { AcademicModule } from './modules/people/AcademicModule.js';

// Political modules
import { CongressModule } from './modules/political/CongressModule.js';
import { FecModule } from './modules/political/FecModule.js';
import { FederalSpendingModule } from './modules/political/FederalSpendingModule.js';
import { FederalRegisterModule } from './modules/political/FederalRegisterModule.js';
import { GdeltModule } from './modules/political/GdeltModule.js';

// MILINT modules
import { OpenSkyModule } from './modules/milint/OpenSkyModule.js';
import { CelesTrakModule } from './modules/milint/CelesTrakModule.js';
import { AcledModule } from './modules/milint/AcledModule.js';
import { SipriModule } from './modules/milint/SipriModule.js';

// Processors
import { createCollectionWorker } from './processors/collectionProcessor.js';
import { createEnrichmentWorker } from './processors/enrichmentProcessor.js';
import { createDeduplicationWorker } from './processors/deduplicationProcessor.js';
import { createAlertWorker } from './processors/alertProcessor.js';

const logger = pino({ name: 'osint-workers' });

function buildModuleRegistry(redis: Redis): Map<string, BaseModule> {
  const registry = new Map<string, BaseModule>();

  const modules: BaseModule[] = [
    // FININT
    new SecEdgarModule(redis),
    new OpenCorporatesModule(redis),
    new GleifModule(redis),
    new FredModule(redis),
    new SanctionsModule(redis),
    new CryptoModule(redis),
    // CTI
    new ShodanModule(redis),
    new VirusTotalModule(redis),
    new AbuseIPDBModule(redis),
    new AlienVaultOTXModule(redis),
    new NvdModule(redis),
    new CisaKevModule(redis),
    new UrlScanModule(redis),
    new AbuseChModule(redis),
    new CertTransparencyModule(redis),
    new MitreAttackModule(redis),
    new HibpModule(redis),
    // Domain
    new RdapModule(redis),
    new DnsModule(redis),
    new SecurityTrailsModule(redis),
    // GEOINT
    new IpGeolocationModule(redis),
    new OsmModule(redis),
    new SentinelHubModule(redis),
    new NasaGibsModule(redis),
    // SOCMINT
    new YouTubeModule(redis),
    new RedditModule(redis),
    new BlueskyModule(redis),
    new MastodonModule(redis),
    new TelegramModule(redis),
    new UsernameEnumModule(redis),
    // People
    new EmailIntelModule(redis),
    new PhoneIntelModule(redis),
    new CourtRecordsModule(redis),
    new AcademicModule(redis),
    // Political
    new CongressModule(redis),
    new FecModule(redis),
    new FederalSpendingModule(redis),
    new FederalRegisterModule(redis),
    new GdeltModule(redis),
    // MILINT
    new OpenSkyModule(redis),
    new CelesTrakModule(redis),
    new AcledModule(redis),
    new SipriModule(redis),
  ];

  for (const mod of modules) {
    registry.set(mod.name, mod);
    logger.debug({ module: mod.name, category: mod.category, requiresApiKey: mod.requiresApiKey }, 'Registered module');
  }

  return registry;
}

async function main(): Promise<void> {
  logger.info('Starting OSINT Dashboard workers...');

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times: number) => {
      if (times > 10) {
        logger.error('Redis connection failed after 10 retries, exiting');
        process.exit(1);
      }
      return Math.min(times * 500, 5000);
    },
  });

  redis.on('connect', () => logger.info('Redis connected'));
  redis.on('error', (err) => logger.error({ error: err.message }, 'Redis error'));

  // Build module registry
  const moduleRegistry = buildModuleRegistry(redis);
  logger.info({ moduleCount: moduleRegistry.size }, 'Module registry initialized');

  // Log registered modules by category
  const byCategory = new Map<string, string[]>();
  for (const [name, mod] of moduleRegistry) {
    const list = byCategory.get(mod.category) || [];
    list.push(name);
    byCategory.set(mod.category, list);
  }
  for (const [cat, mods] of byCategory) {
    logger.info({ category: cat, count: mods.length, modules: mods }, 'Category modules');
  }

  // Start workers
  const collectionConcurrency = parseInt(process.env.COLLECTION_CONCURRENCY || '5', 10);
  const enrichmentConcurrency = parseInt(process.env.ENRICHMENT_CONCURRENCY || '3', 10);
  const dedupConcurrency = parseInt(process.env.DEDUP_CONCURRENCY || '2', 10);
  const alertConcurrency = parseInt(process.env.ALERT_CONCURRENCY || '2', 10);

  const collectionWorker = createCollectionWorker(redis, moduleRegistry, collectionConcurrency);
  const enrichmentWorker = createEnrichmentWorker(redis, moduleRegistry, enrichmentConcurrency);
  const deduplicationWorker = createDeduplicationWorker(redis, dedupConcurrency);
  const alertWorker = createAlertWorker(redis, moduleRegistry, alertConcurrency);

  const workers = [collectionWorker, enrichmentWorker, deduplicationWorker, alertWorker];

  logger.info({
    workers: {
      collection: collectionConcurrency,
      enrichment: enrichmentConcurrency,
      deduplication: dedupConcurrency,
      alert: alertConcurrency,
    },
    totalModules: moduleRegistry.size,
  }, 'All workers started');

  // Graceful shutdown
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, 'Shutdown signal received, closing workers...');

    const closeResults = await Promise.allSettled(
      workers.map((w) => w.close())
    );

    for (const result of closeResults) {
      if (result.status === 'rejected') {
        logger.error({ error: String(result.reason) }, 'Error closing worker');
      }
    }

    await redis.quit();
    logger.info('All workers closed, Redis disconnected. Goodbye.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.info('OSINT Dashboard workers ready and processing');
}

main().catch((err) => {
  logger.fatal({ error: err }, 'Fatal error starting workers');
  process.exit(1);
});
