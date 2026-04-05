# Intelligence Module Development Guide

## Architecture

Each intelligence module extends the `BaseModule` abstract class and implements three core methods:

- `collect(entity, apiKey?)` — Fetch data from the external source
- `normalize(rawData)` — Transform raw API response into standardized entities
- `healthCheck()` — Verify the external API is accessible

## Creating a New Module

```typescript
import { BaseModule } from '../base/BaseModule';
import { CollectionResult, NormalizedEntity } from '../base/types';

export class MyNewModule extends BaseModule {
  name = 'my-new-source';
  category = 'cti' as const;
  supportedEntityTypes = ['Domain', 'IPAddress'];
  rateLimit = { maxTokens: 10, refillRate: 1, refillInterval: 1000 };
  cacheTTL = 3600;
  requiresApiKey = true;

  async collect(entity: any, apiKey?: string): Promise<CollectionResult> {
    const response = await this.makeRequest('https://api.example.com/lookup', {
      params: { q: entity.data.value },
      headers: { 'X-Api-Key': apiKey }
    });

    const entities = this.normalize(response.data);
    return {
      entities,
      relationships: [],
      rawData: response.data,
      source: this.name,
      collectedAt: new Date(),
      confidence: 75,
      apiCallsUsed: 1
    };
  }

  normalize(rawData: any): NormalizedEntity[] {
    // Transform raw API response into standardized entity format
    return [];
  }

  async healthCheck() {
    const start = Date.now();
    try {
      await this.makeRequest('https://api.example.com/health');
      return { status: 'ok' as const, latency: Date.now() - start };
    } catch {
      return { status: 'down' as const, latency: Date.now() - start };
    }
  }
}
```

## Module Categories

| Category | Code | Description |
|----------|------|-------------|
| Financial Intelligence | `finint` | SEC, corporate registries, sanctions, crypto |
| Cyber Threat Intelligence | `cti` | Shodan, VirusTotal, AbuseIPDB, CVE/NVD |
| Domain Intelligence | `domain` | RDAP, DNS, SecurityTrails |
| Geospatial Intelligence | `geoint` | IP geolocation, OSM, satellite imagery |
| Social Media Intelligence | `socmint` | YouTube, Reddit, Bluesky, Mastodon, Telegram |
| People Intelligence | `people` | Email, phone, court records, academic |
| Political Intelligence | `political` | Congress, FEC, federal spending, GDELT |
| Military Intelligence | `milint` | Aircraft tracking, satellites, conflict data |

## Rate Limiting

Each module declares its rate limit using a token bucket configuration:
- `maxTokens` — Maximum burst capacity
- `refillRate` — Tokens added per refill
- `refillInterval` — Milliseconds between refills

The `BaseModule.executeWithRateLimit()` method handles token acquisition automatically.

## Caching

All API responses are cached in Redis with module-specific TTLs. The cache key format is:
```
cache:{moduleName}:{sha256(queryParams)}
```

Use `executeWithCache()` to automatically check cache before making API calls.

## Registration

Add new modules to `src/index.ts` module registry to enable them in the worker pool.
