// src/__tests__/transferOrchestrator.test.ts
import { orchestrateTransfer } from '../transferOrchestrator';
import { submitVaultOperation } from '../sorobanClient';
import { idempotencyStore, buildIdempotencyFingerprint } from '../idempotency';

jest.mock('../sorobanClient', () => ({ submitVaultOperation: jest.fn() }));
jest.mock('../idempotency', () => {
  const original = jest.requireActual('../idempotency');
  return {
    ...original,
    idempotencyStore: {
      execute: jest.fn(),
    },
    buildIdempotencyFingerprint: jest.fn().mockReturnValue('fingerprint'),
  };
});

describe('orchestrateTransfer', () => {
  const params = {
    operationType: 'deposit' as const,
    walletAddress: 'GABCDEF1234567890',
    amount: '1000',
    asset: 'USDC',
  };
  const key = 'test-idempotency-key';

  beforeEach(() => {
    (submitVaultOperation as jest.Mock).mockResolvedValue('txhash-123');
    (idempotencyStore.execute as jest.Mock).mockImplementation(async (k, fp, op) => {
      const result = await op();
      return { result, replayed: false };
    });
  });

  test('executes operation and stores result', async () => {
    const { result, replayed } = await orchestrateTransfer(params, key);

    expect(buildIdempotencyFingerprint).toHaveBeenCalledWith(params);
    expect(idempotencyStore.execute).toHaveBeenCalledWith(key, 'fingerprint', expect.any(Function));
    expect(submitVaultOperation).toHaveBeenCalledWith(
      params.operationType,
      params.walletAddress,
      params.amount,
      params.asset,
    );
    expect(result).toEqual({ statusCode: 200, body: 'txhash-123' });
    expect(replayed).toBe(false);
  });

  test('returns replayed flag when idempotent store reports replay', async () => {
    (idempotencyStore.execute as jest.Mock).mockResolvedValue({
      result: { statusCode: 200, body: 'txhash-123' },
      replayed: true,
    });
    const { replayed } = await orchestrateTransfer(params, key);
    expect(replayed).toBe(true);
  });
});
