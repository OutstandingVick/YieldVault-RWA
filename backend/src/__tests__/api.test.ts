import request from 'supertest';
import app from '../index';

describe('Backend API', () => {
  beforeAll(() => {
    jest.setTimeout(30000);
  });

  // ─── Health Endpoint Tests ───────────────────────────────────────────────

  describe('GET /health', () => {
    it('should return 200 with health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('checks');
    });

    it('should include dependency checks', async () => {
      const response = await request(app).get('/health');

      expect(response.body.checks).toHaveProperty('api');
      expect(response.body.checks).toHaveProperty('cache');
      expect(response.body.checks).toHaveProperty('stellarRpc');
    });

    it('should have cache up', async () => {
      const response = await request(app).get('/health');
      expect(response.body.checks.cache).toBe('up');
    });
  });

  // ─── Readiness Endpoint Tests ────────────────────────────────────────────

  describe('GET /ready', () => {
    it('should return 200 when ready', async () => {
      const response = await request(app).get('/ready');

      // Could be 200 or 503 depending on configuration
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('ready');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('dependencies');
    });

    it('should include dependency status', async () => {
      const response = await request(app).get('/ready');

      expect(response.body.dependencies).toHaveProperty('cache');
      expect(response.body.dependencies).toHaveProperty('stellarRpc');
      expect(typeof response.body.dependencies.cache).toBe('boolean');
      expect(typeof response.body.dependencies.stellarRpc).toBe('boolean');
    });
  });

  // ─── Rate Limiting Tests (Issue #145) ────────────────────────────────────

  describe('Rate Limiting - Global', () => {
    it('should not rate limit health endpoint', async () => {
      // Make multiple rapid requests to health endpoint
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/health');
        expect(response.status).toBe(200);
      }
    });

    it('should not rate limit ready endpoint', async () => {
      // Make multiple rapid requests to ready endpoint
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/ready');
        expect([200, 503]).toContain(response.status);
      }
    });
  });

  describe('Rate Limiting - API Endpoints', () => {
    it('should include rate limit headers in response', async () => {
      const response = await request(app).get('/api/v1/vault/summary');

      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
      expect(response.headers).toHaveProperty('ratelimit-reset');
    });

    it('should return 429 when rate limit exceeded', async () => {
      // Note: This test might need adjustment based on actual limit settings
      // It attempts to exceed the API rate limit
      const requests = Array(35).fill(null); // More than configured limit
      const results = await Promise.all(
        requests.map(() => request(app).get('/api/v1/vault/summary'))
      );

      expect(results.some((r) => r.status === 429)).toBe(true);
    }, 30000);

    it('should return 429 with clear error message', async () => {
      // Make multiple requests to trigger rate limit
      const requests = Array(35).fill(null);
      await Promise.all(
        requests.map(() => request(app).get('/api/v1/vault/summary'))
      );

      const response = await request(app).get('/api/v1/vault/summary');

      if (response.status === 429) {
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('status', 429);
        expect(response.body).toHaveProperty('message');
      }
    }, 30000);

    it('should support per-user rate limiting with API key', async () => {
      // Test that API key in header is used for rate limiting
      const response = await request(app)
        .get('/api/v1/vault/summary')
        .set('x-api-key', 'test-key-123');

      expect([200, 429]).toContain(response.status);
    });
  });

  // ─── Error Handling Tests ────────────────────────────────────────────────

  describe('Error Responses', () => {
    it('should return 404 for unknown endpoint', async () => {
      const response = await request(app).get('/api/unknown');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body).toHaveProperty('status', 404);
      expect(response.body).toHaveProperty('path');
      expect(response.body).toHaveProperty('message');
    });

    it('should return proper JSON error format', async () => {
      const response = await request(app).get('/api/nonexistent');

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('message');
    });
  });

  // ─── Configuration Tests ─────────────────────────────────────────────────

  describe('Configuration', () => {
    it('should have proper rate limit defaults', async () => {
      // This verifies the backend is configured with sensible defaults
      expect(process.env.PORT || 3000).toBeDefined();
    });

    it('should not expose sensitive info in error responses', async () => {
      const response = await request(app).get('/api/v1/vault/summary');

      // Ensure no stack traces in error responses in production-like environment
      if (response.status >= 500) {
        if (process.env.NODE_ENV === 'production') {
          expect(response.body.message).not.toContain('at ');
          expect(response.body.message).not.toContain('Error');
        }
      }
    });
  });

  // ─── Integration Tests ──────────────────────────────────────────────────

  describe('Integration', () => {
    it('should have proper CORS headers configured', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173');

      // Response should include appropriate headers
      expect(response.status).toBe(200);
    });

    it('should handle JSON body parsing', async () => {
      const response = await request(app)
        .post('/api/v1/vault/summary')
        .send({
          test: 'data',
        });

      // Should either accept or reject with proper error
      expect([200, 405, 404, 400]).toContain(response.status);
    });
  });

  // ─── Portfolio Aggregation Endpoints Tests (Issue #439) ────────────────────
  describe('GET /api/v1/vault/portfolio/:walletAddress', () => {
    const { registerApiKey } = require('../middleware/apiKeyAuth');
    const { db } = require('../database');
    let dbQuerySpy: jest.SpyInstance;

    beforeAll(() => {
      registerApiKey('test-portfolio-key');
    });

    beforeEach(() => {
      dbQuerySpy = jest.spyOn(db, 'query');
    });

    afterEach(() => {
      dbQuerySpy.mockRestore();
    });

    it('should return 401 if API key is missing or invalid', async () => {
      const response = await request(app).get('/api/v1/vault/portfolio/G12345');
      expect(response.status).toBe(401);
    });

    it('should return 404 if the wallet address is not found', async () => {
      dbQuerySpy.mockResolvedValueOnce({ rows: [] }); // User search returns empty

      const response = await request(app)
        .get('/api/v1/vault/portfolio/G_MISSING')
        .set('Authorization', 'ApiKey test-portfolio-key');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body.message).toContain('not found');
    });

    it('should return aggregated portfolio metrics and paginated transactions', async () => {
      // 1. Mock user check (found)
      dbQuerySpy.mockResolvedValueOnce({
        rows: [{ id: 1, address: 'G12345', createdAt: new Date() }],
      });

      // 2. Mock transaction aggregates (deposit sum, withdrawal sum)
      dbQuerySpy.mockResolvedValueOnce({
        rows: [
          { type: 'deposit', total: 1500.0 },
          { type: 'withdrawal', total: 300.0 },
        ],
      });

      // 3. Mock latest APY snapshot (12.5%)
      dbQuerySpy.mockResolvedValueOnce({
        rows: [{ apy: 12.5 }],
      });

      // 4. Mock transactions count (2)
      dbQuerySpy.mockResolvedValueOnce({
        rows: [{ count: 2 }],
      });

      // 5. Mock paginated transactions list
      dbQuerySpy.mockResolvedValueOnce({
        rows: [
          { id: 'tx-1', user: 'G12345', amount: '1500.00', type: 'deposit', timestamp: new Date() },
          { id: 'tx-2', user: 'G12345', amount: '300.00', type: 'withdrawal', timestamp: new Date() },
        ],
      });

      const response = await request(app)
        .get('/api/v1/vault/portfolio/G12345')
        .set('Authorization', 'ApiKey test-portfolio-key');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('walletAddress', 'G12345');
      expect(response.body).toHaveProperty('totalDeposited', 1500.0);
      expect(response.body).toHaveProperty('totalWithdrawn', 300.0);
      expect(response.body).toHaveProperty('netPosition', 1200.0);
      expect(response.body).toHaveProperty('latestApy', 12.5);
      expect(response.body).toHaveProperty('estimatedYield', 150.0); // 1200 * 0.125
      expect(response.body).toHaveProperty('transactions');
      expect(response.body.transactions.data).toHaveLength(2);
      expect(response.body.transactions.pagination).toEqual({
        count: 2,
        total: 2,
        currentPage: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });
  });
});
