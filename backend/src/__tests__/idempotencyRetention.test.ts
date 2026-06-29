import { IdempotencyStore } from '../idempotency';
import {
  getIdempotencyRetentionMetrics,
  pruneStaleIdempotencyRecords,
  resetIdempotencyRetentionStateForTests,
} from '../idempotencyRetention';

jest.mock('../rateLimiter', () => ({
  redisClientManager: {
    isReady: () => false,
    getClient: () => null,
  },
}));

describe('idempotencyRetention', () => {
  beforeEach(() => {
    resetIdempotencyRetentionStateForTests();
    process.env.IDEMPOTENCY_KEY_TTL_MS = '1000';
    process.env.IDEMPOTENCY_RETENTION_ENABLED = 'true';
  });

  it('reports retention policy and store metrics', () => {
    const metrics = getIdempotencyRetentionMetrics();
    expect(metrics.policy.retentionMs).toBe(1000);
    expect(metrics.storeMetrics).toBeDefined();
  });

  it('prunes stale local idempotency keys', async () => {
    const store = new IdempotencyStore(1000);
    const staleCreatedAt = new Date(Date.now() - 10_000).toISOString();

    (store as any).localCache.set('stale-key', {
      statusCode: 200,
      body: { ok: true },
      fingerprint: 'fp',
      metadata: {
        createdAt: staleCreatedAt,
        lastAccessedAt: staleCreatedAt,
        replayCount: 0,
        status: 'completed',
      },
    });

    const result = await store.pruneStaleKeys(1000, false);
    expect(result.localPruned).toBe(1);
    expect(result.pruned).toBe(1);
  });

  it('supports dry-run retention sweeps', async () => {
    const result = await pruneStaleIdempotencyRecords(true);
    expect(result.dryRun).toBe(true);
    expect(result.pruned).toBeGreaterThanOrEqual(0);
  });
});
