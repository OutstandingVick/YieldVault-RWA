import request from 'supertest';
import app from '../index';
import { redactSensitiveLogAttributes } from '../auditRedaction';
import { clearWalletLocksForTests, tryAcquireWalletLock } from '../walletLock';

describe('Issues #631-#634', () => {
  describe('Issue #631 - wallet-scoped operation lock', () => {
    afterEach(() => {
      clearWalletLocksForTests();
    });

    it('prevents concurrent lock acquisition for the same wallet', () => {
      const first = tryAcquireWalletLock('GABC');
      const second = tryAcquireWalletLock('gabc');

      expect(first.acquired).toBe(true);
      expect(second.acquired).toBe(false);

      first.release();

      const third = tryAcquireWalletLock(' GABC ');
      expect(third.acquired).toBe(true);
      third.release();
    });
  });

  describe('Issue #632 - standardized pagination envelope', () => {
    const listRoutes = [
      '/api/transactions?limit=3',
      '/api/portfolio/holdings?limit=3',
      '/api/vault/history?limit=3',
    ];

    it.each(listRoutes)('returns standardized pagination keys for %s', async (route) => {
      const res = await request(app).get(route);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('pagination');
      const keys = [
        'count',
        'limit',
        'total',
        'nextCursor',
        'prevCursor',
        'currentPage',
        'totalPages',
        'hasNextPage',
        'hasPrevPage',
      ];

      keys.forEach((key) => {
        expect(Object.prototype.hasOwnProperty.call(res.body.pagination, key)).toBe(true);
      });

      expect(typeof res.body.pagination.count).toBe('number');
      expect(typeof res.body.pagination.limit).toBe('number');
      expect(typeof res.body.pagination.hasNextPage).toBe('boolean');
      expect(typeof res.body.pagination.hasPrevPage).toBe('boolean');
    });
  });

  describe('Issue #633 - secure audit redaction', () => {
    it('redacts nested sensitive attributes', () => {
      const redacted = redactSensitiveLogAttributes({
        message: 'test',
        apiKey: 'abc',
        nested: {
          authorization: 'Bearer secret-token',
          ok: 'value',
        },
        arr: [{ password: 'p@ss' }, { label: 'visible' }],
      });

      expect(redacted).toEqual({
        message: 'test',
        apiKey: '[REDACTED]',
        nested: {
          authorization: '[REDACTED]',
          ok: 'value',
        },
        arr: [{ password: '[REDACTED]' }, { label: 'visible' }],
      });
    });
  });

  describe('Issue #634 - deterministic validation schema and codes', () => {
    it('returns stable validation error shape with top-level and field-level codes', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ walletAddress: 'not-a-wallet' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: 'Bad Request',
        status: 400,
        code: 'VALIDATION_ERROR',
        summary: 'Request validation failed',
      });

      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.errors[0]).toHaveProperty('code');
      expect(res.body.details[0]).toHaveProperty('code');
    });
  });
});
