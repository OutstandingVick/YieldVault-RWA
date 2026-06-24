import { WalletAliasMappingService } from '../walletAliasService';

describe('WalletAliasMappingService', () => {
  it('normalizes casing and whitespace for a single provider alias', () => {
    const service = new WalletAliasMappingService();

    const mapping = service.registerAlias('  gabcdefghijklmnopqrstuvwxyz234567  ', 'stellar');

    expect(mapping.canonicalId).toMatch(/^wallet-alias:/);
    expect(mapping.aliases).toEqual(['GABCDEFGHIJKLMNOPQRSTUVWXYZ234567']);
    expect(mapping.sources).toEqual(['stellar']);
    expect(service.resolveAlias('gabcdefghijklmnopqrstuvwxyz234567', 'stellar')?.canonicalId).toBe(mapping.canonicalId);
  });

  it('links aliases from different providers to the same canonical identity', () => {
    const service = new WalletAliasMappingService();

    const first = service.registerAlias('GABCDEFGHIJKLMNOPQRSTUVWXYZ234567', 'stellar');
    const second = service.registerAlias('wallet-connect-alias', 'walletconnect', first.canonicalId);

    expect(second.canonicalId).toBe(first.canonicalId);
    expect(second.aliases).toEqual(expect.arrayContaining(['GABCDEFGHIJKLMNOPQRSTUVWXYZ234567', 'wallet-connect-alias']));
    expect(second.sources).toEqual(expect.arrayContaining(['stellar', 'walletconnect']));
    expect(service.resolveAlias('wallet-connect-alias', 'walletconnect')?.canonicalId).toBe(first.canonicalId);
  });

  it('preserves a canonical identity when a previously linked alias is registered again', () => {
    const service = new WalletAliasMappingService();

    const first = service.registerAlias('wallet-connect-alias', 'walletconnect');
    const second = service.registerAlias('WALLET-CONNECT-ALIAS', 'walletconnect');

    expect(second.canonicalId).toBe(first.canonicalId);
    expect(service.getIdentityLinks(first.canonicalId)?.aliases).toEqual(['wallet-connect-alias']);
    expect(service.getIdentityLinks(first.canonicalId)?.sources).toEqual(['walletconnect']);
  });

  it('normalizes provider names across formatting variants to the same identity', () => {
    const service = new WalletAliasMappingService();

    const first = service.registerAlias('wallet-connect-alias', 'Wallet Connect');
    const second = service.registerAlias('wallet-connect-alias', 'wallet-connect');

    expect(first.canonicalId).toBe(second.canonicalId);
    expect(service.getIdentityLinks(first.canonicalId)?.sources).toEqual(['walletconnect']);
  });
});
