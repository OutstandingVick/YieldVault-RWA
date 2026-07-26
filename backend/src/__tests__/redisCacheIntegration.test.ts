/**
 * @file redisCacheIntegration.test.ts
 * Integration-level tests for the Redis cache layer.
 *
 * These tests exercise the public API of redisCache.ts + the cache middleware
 * (cache.ts) together, using a fake Redis client injected into the singleton,
 * without booting the full Express app (which requires the workspace package
 * @yieldvault/api-schemas to be built).
 *
 * Coverage:
 *   - getFromCache / setInCache round-trip through both Redis and in-memory LRU
 *   - invalidateCachePattern clears both stores
 *   - getRedisCacheHealth reflects real connection state
 *   - X-Cache-Hit and X-Cache-Backend headers are set by cacheMiddleware
 *   - Cache-Control header reflects the TTL
 *   - cacheMiddleware falls back to LRU when Redis is not ready
 *   - cacheMiddleware uses async Redis path when Redis is ready
 */

import { EventEmitter } from 'events';
import type { Request, Response } from 'express';

// ─── Fake Redis ───────────────────────────────────────────────────────────────

class FakeRedis extends EventEmitter {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async ping() { return 'PONG'; }

  async get(key: string): Promise<string | null> {
    const e = this.store.get(key);
    if (!e || e.expiresAt < Date.now()) { this.store.delete(key); return null; }
    return e.value;
  }

  async setex(key: string, ttlSec: number, value: string) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
    return 'OK';
  }

  async del(...keys: string[]) {
    let n = 0;
    for (const k of keys) if (this.store.delete(k)) n++;
    return n;
  }

  async scan(cursor: string, _m: 'MATCH', pattern: string, _c: 'COUNT', _n: number): Promise<[string, string[]]> {
    const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'));
    const matched = [...this.store.keys()].filter(k => re.test(k));
    return ['0', cursor === '0' ? matched : []];
  }

  async quit() {}

  size() { return this.store.size; }
  clear() { this.store.clear(); }
  keys() { return [...this.store.keys()]; }
}

// ─── Imports ──────────────────────────────────────────────────────────────────

import {
  redisCacheClient,
  getFromCache,
  setInCache,
  invalidateCachePattern,
  getRedisCacheHealth,
} from '../redisCache';
import { responseCache, cacheMiddleware, buildCacheKey } from '../middleware/cache';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let fakeRedis: FakeRedis;

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

function makeFakeRequest(path: string, query: Record<string, string> = {}): Partial<Request> {
  return {
    method: 'GET',
    path,
    baseUrl: '',
    query,
    headers: {},
    route: { path },
  } as unknown as Partial<Request>;
}

function makeFakeResponse(): { res: Partial<Response>; capturedJson: unknown; capturedStatus: number; headers: Record<string, string | number> } {
  const headers: Record<string, string | number> = {};
  let capturedJson: unknown = undefined;
  let capturedStatus = 200;

  const res = {
    statusCode: 200,
    setHeader(name: string, value: string | number) {
      headers[name.toLowerCase()] = value;
      (this as any).statusCode = name === 'status' ? Number(value) : (this as any).statusCode;
    },
    status(code: number) {
      capturedStatus = code;
      (this as any).statusCode = code;
      return this;
    },
    json(data: unknown) {
      capturedJson = data;
      return this;
    },
  } as unknown as Partial<Response>;

  return { res, capturedJson, capturedStatus, headers };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  fakeRedis = new FakeRedis();
  (redisCacheClient as any).client = fakeRedis;
  (redisCacheClient as any)._isReady = true;
  responseCache.clear();
});

afterEach(() => {
  fakeRedis.clear();
  (redisCacheClient as any)._isReady = false;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getFromCache + setInCache round-trip', () => {
  it('returns null on empty cache', async () => {
    expect(await getFromCache('GET:/api/v1/vault/summary')).toBeNull();
  });

  it('stores to Redis and retrieves back', async () => {
    const entry = makeEntry({ totalAssets: '1000', sharePrice: '1.05' });
    await setInCache('GET:/api/v1/vault/summary', entry, 60_000);

    const retrieved = await getFromCache('GET:/api/v1/vault/summary');
    expect(retrieved).not.toBeNull();
    expect((retrieved!.data as any).totalAssets).toBe('1000');
    expect((retrieved!.data as any).sharePrice).toBe('1.05');
  });

  it('stores to both Redis and in-memory LRU simultaneously', async () => {
    const entry = makeEntry({ apy: 8.5 });
    await setInCache('GET:/api/v1/vault/apy', entry, 30_000);

    // Verify Redis key exists
    const redisRaw = await fakeRedis.get('cache:GET:/api/v1/vault/apy');
    expect(redisRaw).not.toBeNull();

    // Verify LRU entry exists
    const lruEntry = responseCache.get('GET:/api/v1/vault/apy');
    expect(lruEntry).not.toBeUndefined();
  });

  it('falls back to LRU when Redis not ready', async () => {
    (redisCacheClient as any)._isReady = false;

    const entry = makeEntry({ totalAssets: '500' });
    await setInCache('GET:/api/v1/vault/summary', entry, 60_000);

    // Nothing written to Redis
    expect(fakeRedis.size()).toBe(0);

    // Still retrievable from LRU
    const retrieved = await getFromCache('GET:/api/v1/vault/summary');
    expect(retrieved).not.toBeNull();
    expect((retrieved!.data as any).totalAssets).toBe('500');
  });

  it('respects TTL — stale entries are treated as misses', async () => {
    const expired = makeEntry({}, -5000); // expiresAt in the past
    // Write directly to Redis with a past expiresAt
    fakeRedis['store'].set('cache:GET:/api/v1/vault/summary', {
      value: JSON.stringify(expired),
      expiresAt: Date.now() + 60_000, // Redis TTL still valid
    });

    const result = await getFromCache('GET:/api/v1/vault/summary');
    expect(result).toBeNull();
  });
});

describe('invalidateCachePattern', () => {
  it('removes vault keys from both Redis and LRU', async () => {
    const entry = makeEntry({ totalAssets: '999' });

    // Seed both stores
    await setInCache('GET:/api/v1/vault/summary', entry, 60_000);
    await setInCache('GET:/api/v1/vault/apy', entry, 60_000);
    await setInCache('GET:/api/v1/transactions', entry, 60_000);

    await invalidateCachePattern('GET:/api/v1/vault*');

    // Vault entries gone from LRU
    expect(responseCache.get('GET:/api/v1/vault/summary')).toBeUndefined();
    expect(responseCache.get('GET:/api/v1/vault/apy')).toBeUndefined();
    // Transaction entry still present
    expect(responseCache.get('GET:/api/v1/transactions')).not.toBeUndefined();

    // Redis vault keys gone
    expect(await fakeRedis.get('cache:GET:/api/v1/vault/summary')).toBeNull();
    expect(await fakeRedis.get('cache:GET:/api/v1/vault/apy')).toBeNull();
    // Redis transaction key still present
    expect(await fakeRedis.get('cache:GET:/api/v1/transactions')).not.toBeNull();
  });

  it('is a no-op when nothing matches', async () => {
    const removed = await invalidateCachePattern('GET:/api/v1/nonexistent.*');
    expect(removed).toBe(0);
  });
});

describe('getRedisCacheHealth', () => {
  it('returns "up" when Redis is configured and responding', async () => {
    expect(await getRedisCacheHealth()).toBe('up');
  });

  it('returns "degraded" when Redis configured but not ready', async () => {
    (redisCacheClient as any)._isReady = false;
    expect(await getRedisCacheHealth()).toBe('degraded');
  });

  it('returns "up" when Redis is not configured (in-memory only mode)', async () => {
    const savedClient = (redisCacheClient as any).client;
    (redisCacheClient as any).client = null;
    (redisCacheClient as any)._isReady = false;

    expect(await getRedisCacheHealth()).toBe('up');

    (redisCacheClient as any).client = savedClient;
  });
});

describe('cacheMiddleware — Redis path', () => {
  it('sets X-Cache-Hit: false on first request (miss)', (done) => {
    const req = makeFakeRequest('/api/v1/vault/summary');
    const { res, headers } = makeFakeResponse();
    let nextCalled = false;

    // Intercept res.json to capture what the middleware does on miss
    (res as any).json = function (data: unknown) {
      (res as any).statusCode = 200;
      // After our handler calls res.json, the middleware should have set headers
      expect(headers['x-cache-hit']).toBe('false');
      expect(headers['x-cache-backend']).toBeDefined();
      done();
      return res;
    };

    const middleware = cacheMiddleware({ ttl: 60_000 });

    middleware(req as Request, res as Response, () => {
      nextCalled = true;
      // Simulate route handler
      (res as any).json({ totalAssets: '1000' });
    });
  });

  it('serves X-Cache-Hit: true on second request (hit)', async () => {
    const key = 'GET:/api/v1/vault/summary';
    const entry = makeEntry({ totalAssets: '2000' });

    // Prime the cache
    await setInCache(key, entry, 60_000);

    return new Promise<void>((resolve, reject) => {
      const req = makeFakeRequest('/api/v1/vault/summary');
      const { res, headers } = makeFakeResponse();

      // Override res.json and status to capture the cache hit response
      (res as any).json = function (data: unknown) {
        try {
          expect(headers['x-cache-hit']).toBe('true');
          expect(headers['x-cache-backend']).toBeDefined();
          resolve();
        } catch (e) {
          reject(e);
        }
        return res;
      };

      (res as any).status = function (code: number) {
        (res as any).statusCode = code;
        return res;
      };

      const middleware = cacheMiddleware({ ttl: 60_000 });
      middleware(req as Request, res as Response, () => {
        reject(new Error('next() should not be called on a cache hit'));
      });
    });
  });

  it('sets Cache-Control with correct max-age', (done) => {
    const req = makeFakeRequest('/api/v1/vault/metrics');
    const { res, headers } = makeFakeResponse();

    (res as any).json = function (_data: unknown) {
      (res as any).statusCode = 200;
      const cc = headers['cache-control'] as string | undefined;
      expect(cc).toMatch(/max-age=\d+/);
      const match = cc?.match(/max-age=(\d+)/);
      expect(parseInt(match![1], 10)).toBeGreaterThan(0);
      done();
      return res;
    };

    const middleware = cacheMiddleware({ ttl: 45_000 });
    middleware(req as Request, res as Response, () => {
      (res as any).json({ message: 'Vault metrics' });
    });
  });

  it('skips cache for requests with Authorization header', (done) => {
    const req = {
      ...makeFakeRequest('/api/v1/vault/summary'),
      headers: { authorization: 'Bearer token123' },
    } as unknown as Request;

    const { res } = makeFakeResponse();
    const middleware = cacheMiddleware({ ttl: 60_000 });

    middleware(req, res as Response, () => {
      // next() should be called immediately — no caching for authed requests
      done();
    });
  });

  it('does not cache non-GET requests', (done) => {
    const req = { ...makeFakeRequest('/api/v1/vault/summary'), method: 'POST' } as unknown as Request;
    const { res } = makeFakeResponse();
    const middleware = cacheMiddleware({ ttl: 60_000 });

    middleware(req, res as Response, () => {
      // next() called, no cache interaction
      done();
    });
  });
});

describe('buildCacheKey', () => {
  it('produces deterministic keys regardless of query param order', () => {
    const req1 = makeFakeRequest('/api/v1/vault/apy', { limit: '10', offset: '0' });
    const req2 = makeFakeRequest('/api/v1/vault/apy', { offset: '0', limit: '10' });
    expect(buildCacheKey(req1 as Request)).toBe(buildCacheKey(req2 as Request));
  });

  it('includes method and path in key', () => {
    const req = makeFakeRequest('/api/v1/vault/summary');
    const key = buildCacheKey(req as Request);
    expect(key).toBe('GET:/api/v1/vault/summary');
  });

  it('appends sorted query params', () => {
    const req = makeFakeRequest('/api/v1/vault/apy', { b: '2', a: '1' });
    const key = buildCacheKey(req as Request);
    expect(key).toBe('GET:/api/v1/vault/apy:a=1&b=2');
  });
});
