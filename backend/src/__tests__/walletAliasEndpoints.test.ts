import request from 'supertest';
import app from '../index';
import { VALID_TEST_WALLET, SECOND_TEST_WALLET } from './setup';

describe('Wallet alias API endpoints', () => {
  const stellarWallet = VALID_TEST_WALLET;
  const providerAlias = 'wallet-connect-test-alias';

  it('POST /api/v1/wallet-aliases/link links provider aliases to a canonical identity', async () => {
    const res = await request(app)
      .post('/api/v1/wallet-aliases/link')
      .send({
        primaryAlias: SECOND_TEST_WALLET,
        primarySource: 'stellar',
        linkedAlias: 'freighter-session-alias',
        linkedSource: 'freighter',
      });

    expect(res.status).toBe(200);
    expect(res.body.canonicalId).toMatch(/^wallet-alias:/);
    expect(res.body.aliases).toEqual(
      expect.arrayContaining([SECOND_TEST_WALLET, 'freighter-session-alias']),
    );
    expect(res.body.canonicalWallet).toBe(SECOND_TEST_WALLET);
  });

  it('GET /api/v1/wallet-aliases/resolve returns canonical linkage for a provider alias', async () => {
    const linked = await request(app)
      .post('/api/v1/wallet-aliases/link')
      .send({
        primaryAlias: stellarWallet,
        primarySource: 'stellar',
        linkedAlias: providerAlias,
        linkedSource: 'walletconnect',
      });

    const res = await request(app)
      .get('/api/v1/wallet-aliases/resolve')
      .query({ alias: providerAlias, source: 'walletconnect' });

    expect(res.status).toBe(200);
    expect(res.body.canonicalId).toBe(linked.body.canonicalId);
    expect(res.body.canonicalWallet).toBe(stellarWallet);
  });

  it('GET /api/v1/wallet-aliases/:canonicalId returns linked aliases', async () => {
    const linked = await request(app)
      .post('/api/v1/wallet-aliases/link')
      .send({
        primaryAlias: stellarWallet,
        primarySource: 'stellar',
        linkedAlias: providerAlias,
        linkedSource: 'walletconnect',
      });

    const res = await request(app).get(`/api/v1/wallet-aliases/${linked.body.canonicalId}`);

    expect(res.status).toBe(200);
    expect(res.body.aliases).toEqual(expect.arrayContaining([stellarWallet, providerAlias]));
    expect(res.body.sources).toEqual(expect.arrayContaining(['stellar', 'walletconnect']));
  });
});

describe('Auth login wallet alias integration', () => {
  it('registers provider aliases during login and returns canonical wallet metadata', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        walletAddress: VALID_TEST_WALLET,
        source: 'stellar',
        providerAlias: 'lobstr-session-alias',
        providerSource: 'lobstr',
      });

    expect(res.status).toBe(200);
    expect(res.body.canonicalWallet).toBe(VALID_TEST_WALLET);
    expect(res.body.canonicalId).toMatch(/^wallet-alias:/);
    expect(res.body.accessToken).toBeDefined();
  });
});
