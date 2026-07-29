import request from 'supertest';
import app from '../index';

describe('API Version Negotiation and Deprecation Headers', () => {
  it('returns X-API-Version headers on normal requests', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-api-version']).toBe('1.0.0');
    expect(res.headers['x-api-version-supported']).toBe('1.0.0');
  });

  it('negotiates version via Accept-Version header', async () => {
    const res = await request(app)
      .get('/health')
      .set('Accept-Version', '1.0.0');

    expect(res.status).toBe(200);
    expect(res.headers['x-api-version']).toBe('1.0.0');
  });

  it('rejects unsupported API versions with 406 Not Acceptable', async () => {
    const res = await request(app)
      .get('/health')
      .set('Accept-Version', '2.0.0');

    expect(res.status).toBe(406);
    expect(res.body.error).toBe('Not Acceptable');
    expect(res.body.message).toContain('2.0.0');
  });

  it('adds deprecation, sunset, and link headers for legacy unversioned routes', async () => {
    const res = await request(app).get('/vault/summary');

    expect(res.headers['deprecation']).toBe('true');
    expect(res.headers['sunset']).toBeDefined();
    expect(res.headers['link']).toContain('successor-version');
    expect(res.headers['link']).toContain('/api/v1/vault/summary');
  });
});
