import { describe, expect, it, vi } from 'vitest';
import {
  CONTRACT_ID_REGEX,
  MAINNET_PASSPHRASE,
  TESTNET_PASSPHRASE,
  TESTNET_RPC,
  checkRpcReachability,
  parseEnvFile,
  resolveDeployedContractId,
  validateContractIdFormat,
  validateDeploymentJsonMatch,
  validateFrontendEnv,
  validatePassphrase,
  validateRpcPassphraseMatch,
  validateRpcUrl,
} from './validate-frontend-env';

const VALID_CONTRACT_ID = 'C' + 'A'.repeat(55);

describe('validate-frontend-env', () => {
  it('parses env files with comments and quoted values', () => {
    const parsed = parseEnvFile(`
      # comment
      VITE_VAULT_CONTRACT_ID=${VALID_CONTRACT_ID}
      VITE_SOROBAN_RPC_URL="${TESTNET_RPC}"
    `);

    expect(parsed.VITE_VAULT_CONTRACT_ID).toBe(VALID_CONTRACT_ID);
    expect(parsed.VITE_SOROBAN_RPC_URL).toBe(TESTNET_RPC);
  });

  it('validates contract ID format', () => {
    expect(validateContractIdFormat(VALID_CONTRACT_ID)).toBeNull();
    expect(validateContractIdFormat('')?.field).toBe('VITE_VAULT_CONTRACT_ID');
    expect(validateContractIdFormat('G' + 'A'.repeat(55))?.message).toContain(
      'Invalid contract ID format',
    );
    expect(CONTRACT_ID_REGEX.test(VALID_CONTRACT_ID)).toBe(true);
  });

  it('validates known network passphrases', () => {
    expect(validatePassphrase(TESTNET_PASSPHRASE)).toBeNull();
    expect(validatePassphrase(MAINNET_PASSPHRASE)).toBeNull();
    expect(validatePassphrase('unknown')?.field).toBe('VITE_STELLAR_NETWORK_PASSPHRASE');
  });

  it('requires HTTPS RPC URLs', () => {
    expect(validateRpcUrl(TESTNET_RPC)).toBeNull();
    expect(validateRpcUrl('http://insecure.example.com')?.message).toContain('HTTPS');
    expect(validateRpcUrl('not-a-url')?.message).toContain('Invalid RPC URL');
  });

  it('matches RPC URL to passphrase network', () => {
    expect(validateRpcPassphraseMatch(TESTNET_RPC, TESTNET_PASSPHRASE)).toBeNull();
    expect(
      validateRpcPassphraseMatch('https://soroban-mainnet.stellar.org', TESTNET_PASSPHRASE)?.message,
    ).toContain('testnet');
  });

  it('resolves deployment.json contract IDs from both shapes', () => {
    expect(resolveDeployedContractId({ contract_id: VALID_CONTRACT_ID })).toBe(
      VALID_CONTRACT_ID,
    );
    expect(
      resolveDeployedContractId({ contracts: { vault: VALID_CONTRACT_ID } }),
    ).toBe(VALID_CONTRACT_ID);
    expect(validateDeploymentJsonMatch(VALID_CONTRACT_ID, { contract_id: VALID_CONTRACT_ID })).toBeNull();
    expect(
      validateDeploymentJsonMatch('C' + 'B'.repeat(55), { contract_id: VALID_CONTRACT_ID })?.message,
    ).toContain('mismatch');
  });

  it('fails strict validation when required vars are missing', async () => {
    const issues = await validateFrontendEnv({}, { strict: true, checkRpc: false });
    expect(issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining([
        'VITE_SOROBAN_RPC_URL',
        'VITE_STELLAR_NETWORK_PASSPHRASE',
        'VITE_VAULT_CONTRACT_ID',
      ]),
    );
  });

  it('passes strict validation with aligned deployment.json values', async () => {
    const issues = await validateFrontendEnv(
      {
        VITE_SOROBAN_RPC_URL: TESTNET_RPC,
        VITE_STELLAR_NETWORK_PASSPHRASE: TESTNET_PASSPHRASE,
        VITE_VAULT_CONTRACT_ID: VALID_CONTRACT_ID,
      },
      {
        strict: true,
        checkRpc: false,
        deployment: { contract_id: VALID_CONTRACT_ID, git_sha: 'abc' },
      },
    );

    expect(issues).toEqual([]);
  });

  it('reports RPC reachability failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      }),
    );

    const issue = await checkRpcReachability(TESTNET_RPC);
    expect(issue?.message).toContain('503');

    vi.unstubAllGlobals();
  });
});
