import { getStellarExplorerUrl } from '../emailService';

const TX = 'abc123txhash';

describe('getStellarExplorerUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.STELLAR_NETWORK;
    delete process.env.STELLAR_NETWORK_PASSPHRASE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('defaults to testnet when no env vars are set', () => {
    expect(getStellarExplorerUrl(TX)).toBe(
      `https://stellar.expert/explorer/testnet/tx/${TX}`,
    );
  });

  it('returns testnet URL for STELLAR_NETWORK=testnet', () => {
    process.env.STELLAR_NETWORK = 'testnet';
    expect(getStellarExplorerUrl(TX)).toContain('/testnet/tx/');
  });

  it('returns public URL for STELLAR_NETWORK=mainnet', () => {
    process.env.STELLAR_NETWORK = 'mainnet';
    expect(getStellarExplorerUrl(TX)).toBe(
      `https://stellar.expert/explorer/public/tx/${TX}`,
    );
  });

  it('returns public URL for STELLAR_NETWORK=public', () => {
    process.env.STELLAR_NETWORK = 'public';
    expect(getStellarExplorerUrl(TX)).toContain('/public/tx/');
  });

  it('returns public URL when STELLAR_NETWORK_PASSPHRASE matches mainnet passphrase', () => {
    process.env.STELLAR_NETWORK_PASSPHRASE =
      'Public Global Stellar Network ; September 2015';
    expect(getStellarExplorerUrl(TX)).toContain('/public/tx/');
  });

  it('returns testnet URL when passphrase is the testnet passphrase', () => {
    process.env.STELLAR_NETWORK_PASSPHRASE =
      'Test SDF Network ; September 2015';
    expect(getStellarExplorerUrl(TX)).toContain('/testnet/tx/');
  });

  it('STELLAR_NETWORK takes precedence and mainnet wins over a non-mainnet passphrase', () => {
    process.env.STELLAR_NETWORK = 'mainnet';
    process.env.STELLAR_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
    expect(getStellarExplorerUrl(TX)).toContain('/public/tx/');
  });

  it('includes the txHash in the returned URL', () => {
    const hash = 'deadbeefcafebabe';
    expect(getStellarExplorerUrl(hash)).toContain(hash);
  });
});
