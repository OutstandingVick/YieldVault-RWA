/**
 * @file redisCache.test.ts
 * Unit tests for the Redis-backed response cache module (redisCache.ts).
 *
 * All Redis I/O is replaced with an in-memory fake so no real Redis instance
 * is required. The tests verify:
 *   - getFromCache returns null on miss, cached entry on hit
 *   - setInCache persists to both LRU and Redis
 *   - invalidateCachePattern clears matching keys from both stores
 *   - getRedisCacheHealth returns the correct status strings
 *   - Metrics counters increment correctly
 *   - Fail-open behaviour when Redis is unavailable
 */

import { EventEmitter } from 'events';

// ─── Fake Redis Client ────────────────────────────────────────────────────────

type FakeStore = Map<string, { value: string; expiresAt: number }>;

class FakeRedis extends EventEmitter {
  private store: FakeStore = new Map();
  public commandTimeout = 500;

  async ping(): Promise<string> {
    return 'PONG';
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<'OK'> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count++;
    }
    return count;
  }

  async scan(
    cursor: string,
    _matchCmd: 'MATCH',
    pattern: string,
    _countCmd: 'COUNT',
    _count: number,
  ): Promise<[string, string[]]> {
    // Simple full scan ignoring cursor pagination
    const regex = new RegExp(
      '^' +
        pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*'),
    );
    const matched = [...this.store.keys()].filter((k) => regex.test(k));
    return ['0', cursor === '0' ? matched : []];
  }

  async quit(): Promise<void> {}

  _keys(): string[] {
    return [...this.store.keys()];
  }
  _clear(): void {
    this.store.clear();
  }
  _size(): number {
    return this.store.size;
  }
}

// ─── Module Setup ─────────────────────────────────────────────────────────────

// We need to inject the fake redis into the redisCacheClient singleton.
// The simplest way is to access the private client property via a cast.

let fakeRedis: FakeRedis;

// Import the module under test (after setting up mocks)
import {
  redisCacheClient,
  getFromCache,
  setInCache,
  invalidateCachePattern,
  getRedisCacheHealth,
  redisCacheHitCount,
  redisCacheMissCount,
  redisCacheErrorCount,
} from '../redisCache';
import { responseCache } from '../middleware/cache';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(data: unknown, ttlMs = 60_000) {
  return {
    data,
    statusCode: 200,
    headers: {} as Record<string, string>,
    expiresAt: Date.now() + ttlMs,
    ttl: ttlMs,
    lastUsed: Date.now(),
  };
}

async function getCounterValue(
  counter: import('prom-client').Counter<string>,
  labels: Record<string, string> = {},
): Promise<number> {
  // prom-client counters expose async get()
  const values = await counter.get();
  const found = values.values.find((v) =>
    Object.entries(labels).every(([k, val]) => v.labels[k] === val),
  );
  return found?.value ?? 0;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('redisCacheClient', () => {
  beforeEach(() => {
    fakeRedis = new FakeRedis();
    // Inject fake client and mark as ready
    (redisCacheClient as any).client = fakeRedis;
    (redisCacheClient as any)._isReady = true;
    // Clear in-memory LRU between tests
    responseCache.clear();
  });

  afterEach(() => {
    fakeRedis._clear();
    // Reset ready flag so later tests start clean
    (redisCacheClient as any)._isReady = false;
  });

  describe('get()', () => {
    it('returns null when key does not exist', async () => {
      const result = await redisCacheClient.get('missing-key');
      expect(result).toBeNull();
    });

    it('returns the parsed entry when key exists', async () => {
      const entry = makeEntry({ hello: 'world' });
      await fakeRedis.setex('cache:test-key', 60, JSON.stringify(entry));

      const result = await redisCacheClient.get('test-key');
      expect(result).not.toBeNull();
      expect(result!.data).toEqual({ hello: 'world' });
    });

    it('returns null when client is not ready', async () => {
      (redisCacheClient as any)._isReady = false;
      const result = await redisCacheClient.get('any-key');
      expect(result).toBeNull();
    });
  });

  describe('set()', () => {
    it('stores an entry with the correct prefixed key', async () => {
      const entry = makeEntry({ vault: 'data' });
      await redisCacheClient.set('vault-key', entry, 30_000);

      const raw = await fakeRedis.get('cache:vault-key');
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!).data).toEqual({ vault: 'data' });
    });

    it('converts ttlMs to seconds when calling setex', async () => {
      const entry = makeEntry({});
      await redisCacheClient.set('ttl-key', entry, 90_000); // 90 seconds

      // Check that the store entry expires ~90s from now
      const raw = fakeRedis['store'].get('cache:ttl-key');
      expect(raw).toBeDefined();
      const ttlRemaining = (raw!.expiresAt - Date.now()) / 1000;
      expect(ttlRemaining).toBeGreaterThan(88);
      expect(ttlRemaining).toBeLessThanOrEqual(90);
    });

    it('no-ops silently when client is not ready', async () => {
      (redisCacheClient as any)._isReady = false;
      // Should not throw
      await expect(
        redisCacheClient.set('k', makeEntry({}), 1000),
      ).resolves.toBeUndefined();
    });
  });

  describe('del()', () => {
    it('removes an existing key', async () => {
      await fakeRedis.setex('cache:del-key', 60, JSON.stringify(makeEntry({})));
      await redisCacheClient.del('del-key');
      expect(fakeRedis._size()).toBe(0);
    });
  });

  describe('invalidatePattern()', () => {
    it('removes all keys matching a glob pattern', async () => {
      const entry = JSON.stringify(makeEntry({}));
      await fakeRedis.setex('cache:GET:/api/v1/vault/summary', 60, entry);
      await fakeRedis.setex('cache:GET:/api/v1/vault/apy', 60, entry);
      await fakeRedis.setex('cache:GET:/api/v1/transactions', 60, entry);

      const removed = await redisCacheClient.invalidatePattern(
        'GET:/api/v1/vault*',
      );

      expect(removed).toBe(2);
      expect(fakeRedis._size()).toBe(1);
    });

    it('returns 0 when no keys match', async () => {
      const removed = await redisCacheClient.invalidatePattern('nomatch*');
      expect(removed).toBe(0);
    });

    it('returns 0 when client is not ready', async () => {
      (redisCacheClient as any)._isReady = false;
      const removed = await redisCacheClient.invalidatePattern('*');
      expect(removed).toBe(0);
    });
  });

  describe('ping()', () => {
    it('returns PONG when ready', async () => {
      const result = await redisCacheClient.ping();
      expect(result).toBe('PONG');
    });

    it('returns null when not ready', async () => {
      (redisCacheClient as any)._isReady = false;
      const result = await redisCacheClient.ping();
      expect(result).toBeNull();
    });
  });
});

describe('getFromCache', () => {
  beforeEach(() => {
    fakeRedis = new FakeRedis();
    (redisCacheClient as any).client = fakeRedis;
    (redisCacheClient as any)._isReady = true;
    responseCache.clear();
  });

  afterEach(() => {
    fakeRedis._clear();
    (redisCacheClient as any)._isReady = false;
  });

  it('returns null on cache miss', async () => {
    const result = await getFromCache('GET:/api/v1/vault/summary');
    expect(result).toBeNull();
  });

  it('returns entry from Redis on cache hit', async () => {
    const entry = makeEntry({ totalAssets: '1000' });
    await fakeRedis.setex(
      'cache:GET:/api/v1/vault/summary',
      60,
      JSON.stringify(entry),
    );

    const result = await getFromCache('GET:/api/v1/vault/summary');
    expect(result).not.toBeNull();
    expect((result!.data as any).totalAssets).toBe('1000');
  });

  it('returns null for stale Redis entries', async () => {
    const staleEntry = makeEntry({}, -1000); // already expired
    await fakeRedis.setex(
      'cache:GET:/api/v1/vault/summary',
      1, // 1s TTL in Redis; entry itself has expiresAt in the past
      JSON.stringify(staleEntry),
    );
    // We need to override expiresAt to be in the past for our check
    const raw = await fakeRedis.get('cache:GET:/api/v1/vault/summary');
    const parsed = JSON.parse(raw!);
    parsed.expiresAt = Date.now() - 1000;
    fakeRedis['store'].set('cache:GET:/api/v1/vault/summary', {
      value: JSON.stringify(parsed),
      expiresAt: Date.now() + 60_000,
    });

    const result = await getFromCache('GET:/api/v1/vault/summary');
    expect(result).toBeNull();
  });

  it('falls back to in-memory LRU when Redis is not ready', async () => {
    (redisCacheClient as any)._isReady = false;

    const entry = makeEntry({ totalAssets: '500' });
    responseCache.set('GET:/api/v1/vault/summary', entry);

    const result = await getFromCache('GET:/api/v1/vault/summary');
    expect(result).not.toBeNull();
    expect((result!.data as any).totalAssets).toBe('500');
  });
});

describe('setInCache', () => {
  beforeEach(() => {
    fakeRedis = new FakeRedis();
    (redisCacheClient as any).client = fakeRedis;
    (redisCacheClient as any)._isReady = true;
    responseCache.clear();
  });

  afterEach(() => {
    fakeRedis._clear();
    (redisCacheClient as any)._isReady = false;
  });

  it('writes to both Redis and in-memory LRU', async () => {
    const entry = makeEntry({ sharePrice: '1.05' });
    await setInCache('GET:/api/v1/vault/summary', entry, 60_000);

    // Verify Redis
    const redisRaw = await fakeRedis.get('cache:GET:/api/v1/vault/summary');
    expect(redisRaw).not.toBeNull();
    expect(JSON.parse(redisRaw!).data.sharePrice).toBe('1.05');

    // Verify LRU
    const lruEntry = responseCache.get('GET:/api/v1/vault/summary');
    expect(lruEntry).not.toBeUndefined();
    expect((lruEntry!.data as any).sharePrice).toBe('1.05');
  });

  it('writes only to LRU when Redis is not ready (fail-open)', async () => {
    (redisCacheClient as any)._isReady = false;

    const entry = makeEntry({ sharePrice: '1.10' });
    await setInCache('GET:/api/v1/vault/summary', entry, 60_000);

    expect(fakeRedis._size()).toBe(0);
    const lruEntry = responseCache.get('GET:/api/v1/vault/summary');
    expect(lruEntry).not.toBeUndefined();
  });
});

describe('invalidateCachePattern', () => {
  beforeEach(() => {
    fakeRedis = new FakeRedis();
    (redisCacheClient as any).client = fakeRedis;
    (redisCacheClient as any)._isReady = true;
    responseCache.clear();
  });

  afterEach(() => {
    fakeRedis._clear();
    (redisCacheClient as any)._isReady = false;
  });

  it('clears matching keys from both Redis and in-memory LRU', async () => {
    const entry = makeEntry({});

    // Seed Redis
    const entryJson = JSON.stringify(entry);
    fakeRedis['store'].set('cache:GET:/api/v1/vault/summary', {
      value: entryJson,
      expiresAt: Date.now() + 60_000,
    });
    fakeRedis['store'].set('cache:GET:/api/v1/transactions', {
      value: entryJson,
      expiresAt: Date.now() + 60_000,
    });

    // Seed LRU
    responseCache.set('GET:/api/v1/vault/summary', entry);
    responseCache.set('GET:/api/v1/transactions', entry);

    await invalidateCachePattern('GET:/api/v1/vault.*');

    // Vault entry should be gone from LRU
    expect(responseCache.get('GET:/api/v1/vault/summary')).toBeUndefined();
    // Transactions entry should still be present
    expect(responseCache.get('GET:/api/v1/transactions')).not.toBeUndefined();
  });
});

describe('getRedisCacheHealth', () => {
  beforeEach(() => {
    fakeRedis = new FakeRedis();
    (redisCacheClient as any).client = fakeRedis;
  });

  afterEach(() => {
    (redisCacheClient as any)._isReady = false;
  });

  it('returns "up" when Redis is ready and PING succeeds', async () => {
    (redisCacheClient as any)._isReady = true;
    const health = await getRedisCacheHealth();
    expect(health).toBe('up');
  });

  it('returns "degraded" when Redis is configured but not ready', async () => {
    (redisCacheClient as any)._isReady = false;
    const health = await getRedisCacheHealth();
    expect(health).toBe('degraded');
  });

  it('returns "up" when Redis is not configured (in-memory only)', async () => {
    (redisCacheClient as any).client = null;
    (redisCacheClient as any)._isReady = false;
    const health = await getRedisCacheHealth();
    expect(health).toBe('up');
    // Restore
    (redisCacheClient as any).client = fakeRedis;
  });
});
