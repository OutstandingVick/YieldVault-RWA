import request from 'supertest';
import express from 'express';
import { authLimiter, writesLimiter, readsLimiter, adminLimiter } from '../rateLimiter';

describe('Adaptive Rate Limiting Tiers', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    app.get('/auth', authLimiter, (req, res) => res.status(200).json({ ok: true }));
    app.post('/write', writesLimiter, (req, res) => res.status(200).json({ ok: true }));
    app.get('/read', readsLimiter, (req, res) => res.status(200).json({ ok: true }));
    app.get('/admin', adminLimiter, (req, res) => res.status(200).json({ ok: true }));
  });

  it('should allow requests within auth limits', async () => {
    // Auth limit is 5 per minute in test/dev default
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/auth');
      expect(res.status).toBe(200);
    }
    const limitedRes = await request(app).get('/auth');
    expect(limitedRes.status).toBe(429);
    expect(limitedRes.body.error).toBe('Rate limit exceeded');
  });

  it('should allow requests within write limits', async () => {
    // Writes limit is 10 per minute
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/write');
      expect(res.status).toBe(200);
    }
    const limitedRes = await request(app).post('/write');
    expect(limitedRes.status).toBe(429);
  });

  it('should allow requests within read limits', async () => {
    // Reads limit is 60 per minute
    for (let i = 0; i < 60; i++) {
      const res = await request(app).get('/read');
      expect(res.status).toBe(200);
    }
    const limitedRes = await request(app).get('/read');
    expect(limitedRes.status).toBe(429);
  });

  it('should use different buckets for different tiers', async () => {
    // Fill up auth bucket
    for (let i = 0; i < 5; i++) {
      await request(app).get('/auth');
    }
    expect((await request(app).get('/auth')).status).toBe(429);

    // Read bucket should still be empty
    const readRes = await request(app).get('/read');
    expect(readRes.status).toBe(200);
  });
});
