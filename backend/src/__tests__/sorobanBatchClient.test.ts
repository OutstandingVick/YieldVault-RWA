/**
 * Tests for SorobanBatchClient (Issue #955).
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../middleware/structuredLogging', () => ({ logger: { log: jest.fn() } }));
jest.mock('../tracing', () => ({ getCurrentTraceId: () => 'test-trace-id' }));

import {
  SorobanBatchClient,
  BatchCall,
  BatchCallResult,
  createBatchClient,
  RpcReader,
  VaultSummary,
} from '../sorobanBatchClient';
import { logger } from '../middleware/structuredLogging';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a mock RpcReader that always returns a fixed value map. */
function mockReader(responses: Record<string, unknown>): jest.Mock<Promise<unknown>> {
  return jest.fn(async (_rpc, _contract, method: string) => {
    if (method in responses) return responses[method];
    throw new Error(`Unexpected method: ${method}`);
  });
}

/** Build a SorobanBatchClient wired to a test RpcReader. */
function makeClient(reader: RpcReader, maxConcurrency = 5): SorobanBatchClient {
  return new SorobanBatchClient(
    { rpcUrl: 'https://test-rpc', contractId: 'CONTRACT123', maxConcurrency },
    reader,
  );
}

// ── batchRead ─────────────────────────────────────────────────────────────────

describe('SorobanBatchClient.batchRead', () => {
  it('returns results in the same order as calls', async () => {
    const reader = mockReader({ total_assets: 1000n, total_shares: 500n });
    const client = makeClient(reader);

    const calls: BatchCall[] = [{ method: 'total_assets' }, { method: 'total_shares' }];
    const results = await client.batchRead(calls);

    expect(results).toEqual([1000n, 500n]);
  });

  it('fires all calls concurrently (reader called as many times as calls)', async () => {
    const reader = mockReader({ a: 1, b: 2, c: 3 });
    const client = makeClient(reader);

    await client.batchRead([{ method: 'a' }, { method: 'b' }, { method: 'c' }]);

    expect(reader).toHaveBeenCalledTimes(3);
  });

  it('returns an empty array for empty call list', async () => {
    const reader = jest.fn();
    const client = makeClient(reader);

    const results = await client.batchRead([]);
    expect(results).toEqual([]);
    expect(reader).not.toHaveBeenCalled();
  });

  it('rejects if any call throws', async () => {
    const reader = jest.fn().mockRejectedValue(new Error('rpc down'));
    const client = makeClient(reader);

    await expect(client.batchRead([{ method: 'x' }])).rejects.toThrow('rpc down');
  });

  it('logs batch latency info', async () => {
    const reader = mockReader({ total_assets: 42n });
    const client = makeClient(reader);

    await client.batchRead([{ method: 'total_assets' }]);

    expect(logger.log).toHaveBeenCalledWith(
      'debug',
      'soroban batch read complete',
      expect.objectContaining({ callCount: 1, traceId: 'test-trace-id' }),
    );
  });
});

// ── batchReadWithFallback ─────────────────────────────────────────────────────

describe('SorobanBatchClient.batchReadWithFallback', () => {
  it('returns all values when all calls succeed', async () => {
    const reader = mockReader({ a: 10, b: 20 });
    const client = makeClient(reader);

    const results = await client.batchReadWithFallback(
      [{ method: 'a' }, { method: 'b' }],
      -1,
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(expect.objectContaining({ method: 'a', value: 10, success: true }));
    expect(results[1]).toEqual(expect.objectContaining({ method: 'b', value: 20, success: true }));
  });

  it('returns fallback for a failing call without rejecting the batch', async () => {
    const reader = jest.fn(async (_r: unknown, _c: unknown, method: string) => {
      if (method === 'good') return 42;
      throw new Error('network error');
    });
    const client = makeClient(reader);

    const results = await client.batchReadWithFallback(
      [{ method: 'good' }, { method: 'bad' }],
      -99,
    );

    expect(results[0]).toEqual(expect.objectContaining({ method: 'good', value: 42, success: true }));
    expect(results[1]).toEqual(
      expect.objectContaining({ method: 'bad', value: -99, success: false }),
    );
    expect(results[1].error?.message).toBe('network error');
  });

  it('logs a warning when a call falls back', async () => {
    const reader = jest.fn().mockRejectedValue(new Error('timeout'));
    const client = makeClient(reader);

    await client.batchReadWithFallback([{ method: 'x' }], null);

    expect(logger.log).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('fallback for x'),
      expect.any(Object),
    );
  });

  it('returns empty array for empty call list', async () => {
    const reader = jest.fn();
    const client = makeClient(reader);

    const results = await client.batchReadWithFallback([], null);
    expect(results).toEqual([]);
    expect(reader).not.toHaveBeenCalled();
  });

  it('logs aggregate warning when multiple calls fail', async () => {
    const reader = jest.fn().mockRejectedValue(new Error('fail'));
    const client = makeClient(reader);

    await client.batchReadWithFallback([{ method: 'a' }, { method: 'b' }], null);

    expect(logger.log).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('2/2'),
      expect.any(Object),
    );
  });
});

// ── Concurrency limit ─────────────────────────────────────────────────────────

describe('SorobanBatchClient — maxConcurrency', () => {
  it('never exceeds maxConcurrency simultaneous calls', async () => {
    let activeCount = 0;
    let maxActive = 0;

    const reader = jest.fn(async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise((r) => setTimeout(r, 10));
      activeCount--;
      return 'ok';
    });

    const client = makeClient(reader, 2); // cap at 2
    const calls: BatchCall[] = Array.from({ length: 6 }, (_, i) => ({ method: `m${i}` }));

    await client.batchRead(calls);

    expect(maxActive).toBeLessThanOrEqual(2);
  });
});

// ── getVaultSummaryBatched ────────────────────────────────────────────────────

describe('SorobanBatchClient.getVaultSummaryBatched', () => {
  it('returns a complete VaultSummary from concurrent reads', async () => {
    const reader = mockReader({
      total_assets: 5_000_000n,
      total_shares: 4_800_000n,
      share_price: 1_041_666_666_666_666_667n,
      is_paused: false,
    });
    const client = makeClient(reader);

    const summary: VaultSummary = await client.getVaultSummaryBatched();

    expect(summary.totalAssets).toBe('5000000');
    expect(summary.totalShares).toBe('4800000');
    expect(summary.sharePrice).toBeDefined();
    expect(summary.isPaused).toBe(false);
  });

  it('fires exactly 4 reads', async () => {
    const reader = mockReader({
      total_assets: 1n,
      total_shares: 1n,
      share_price: 1n,
      is_paused: false,
    });
    const client = makeClient(reader);

    await client.getVaultSummaryBatched();
    expect(reader).toHaveBeenCalledTimes(4);
  });

  it('returns zero strings when all RPC calls fail', async () => {
    const reader = jest.fn().mockRejectedValue(new Error('offline'));
    const client = makeClient(reader);

    const summary = await client.getVaultSummaryBatched();

    expect(summary.totalAssets).toBe('0');
    expect(summary.totalShares).toBe('0');
    expect(summary.sharePrice).toBe('0');
    expect(summary.isPaused).toBe(false);
  });

  it('handles a paused vault', async () => {
    const reader = mockReader({
      total_assets: 100n,
      total_shares: 100n,
      share_price: 1_000_000_000_000_000_000n,
      is_paused: true,
    });
    const client = makeClient(reader);

    const summary = await client.getVaultSummaryBatched();
    expect(summary.isPaused).toBe(true);
  });
});

// ── createBatchClient factory ─────────────────────────────────────────────────

describe('createBatchClient', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env.STELLAR_RPC_URL = originalEnv.STELLAR_RPC_URL;
    process.env.VAULT_CONTRACT_ID = originalEnv.VAULT_CONTRACT_ID;
  });

  it('creates a SorobanBatchClient instance', () => {
    const client = createBatchClient('https://rpc.example', 'CCONTRACT123');
    expect(client).toBeInstanceOf(SorobanBatchClient);
  });

  it('resolves contract ID from env var', () => {
    process.env.VAULT_CONTRACT_ID = 'ENV_CONTRACT_ID';
    const client = createBatchClient('https://rpc.example');
    expect(client).toBeInstanceOf(SorobanBatchClient);
  });

  it('throws when contractId is missing and env var is not set', () => {
    delete process.env.VAULT_CONTRACT_ID;
    expect(() => createBatchClient('https://rpc.example')).toThrow(/VAULT_CONTRACT_ID/);
  });

  it('uses STELLAR_RPC_URL env var when rpcUrl is not provided', () => {
    process.env.STELLAR_RPC_URL = 'https://custom-rpc.example';
    process.env.VAULT_CONTRACT_ID = 'C123';
    const client = createBatchClient();
    expect(client).toBeInstanceOf(SorobanBatchClient);
  });
});
