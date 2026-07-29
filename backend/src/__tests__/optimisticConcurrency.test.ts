import {
  OptimisticConcurrencyError,
  executeWithOptimisticConcurrency,
  assertVersionMatch,
} from '../optimisticConcurrency';

describe('Optimistic Concurrency Control Persistence Layer', () => {
  describe('assertVersionMatch', () => {
    it('returns next version when expected version matches', () => {
      const entity = { id: 'v1', version: 2, totalAssets: '100' };
      const nextVersion = assertVersionMatch(entity, 2, 'VaultState', 'v1');
      expect(nextVersion).toBe(3);
    });

    it('throws OptimisticConcurrencyError when expected version mismatches', () => {
      const entity = { id: 'v1', version: 3, totalAssets: '100' };
      expect(() => assertVersionMatch(entity, 2, 'VaultState', 'v1')).toThrow(
        OptimisticConcurrencyError
      );
    });

    it('throws normal error when entity is null', () => {
      expect(() => assertVersionMatch(null, 1, 'VaultState', 'v1')).toThrow(
        'VaultState with id v1 not found'
      );
    });
  });

  describe('executeWithOptimisticConcurrency', () => {
    it('executes operation successfully on first attempt', async () => {
      let attempts = 0;
      const result = await executeWithOptimisticConcurrency(async (att) => {
        attempts = att;
        return 'success';
      });

      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('retries on OptimisticConcurrencyError up to maxRetries and succeeds', async () => {
      let attempts = 0;
      const result = await executeWithOptimisticConcurrency(
        async (att) => {
          attempts = att;
          if (att < 3) {
            throw new OptimisticConcurrencyError('VaultState', '1', att);
          }
          return 'retry-success';
        },
        { maxRetries: 3, initialDelayMs: 5 }
      );

      expect(result).toBe('retry-success');
      expect(attempts).toBe(3);
    });

    it('rethrows error after exceeding maxRetries', async () => {
      let attempts = 0;
      await expect(
        executeWithOptimisticConcurrency(
          async (att) => {
            attempts = att;
            throw new OptimisticConcurrencyError('VaultState', '1', att);
          },
          { maxRetries: 2, initialDelayMs: 5 }
        )
      ).rejects.toThrow(OptimisticConcurrencyError);

      expect(attempts).toBe(3);
    });

    it('immediately rethrows non-OCC errors without retry', async () => {
      let attempts = 0;
      await expect(
        executeWithOptimisticConcurrency(
          async (att) => {
            attempts = att;
            throw new Error('Database connection failed');
          },
          { maxRetries: 3, initialDelayMs: 5 }
        )
      ).rejects.toThrow('Database connection failed');

      expect(attempts).toBe(1);
    });
  });
});
