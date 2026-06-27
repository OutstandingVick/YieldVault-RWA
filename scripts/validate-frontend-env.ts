#!/usr/bin/env tsx
/**
 * Validate frontend VITE_* env vars for contract deployment (Issue #820).
 *
 * Ensures VITE_VAULT_CONTRACT_ID, VITE_SOROBAN_RPC_URL, and
 * VITE_STELLAR_NETWORK_PASSPHRASE are present, correctly formatted, and
 * aligned with deployment.json before a frontend release build.
 *
 * Usage:
 *   tsx scripts/validate-frontend-env.ts
 *   tsx scripts/validate-frontend-env.ts --strict
 *   tsx scripts/validate-frontend-env.ts --env-file frontend/.env.local
 *   tsx scripts/validate-frontend-env.ts --deployment-json deployment.json --strict
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const TESTNET_RPC = 'https://soroban-testnet.stellar.org';
export const MAINNET_RPC = 'https://soroban-mainnet.stellar.org';
export const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
export const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
export const CONTRACT_ID_REGEX = /^C[A-Z2-7]{55}$/;

export const REQUIRED_VITE_KEYS = [
  'VITE_SOROBAN_RPC_URL',
  'VITE_STELLAR_NETWORK_PASSPHRASE',
  'VITE_VAULT_CONTRACT_ID',
] as const;

export interface FrontendEnv {
  VITE_SOROBAN_RPC_URL?: string;
  VITE_STELLAR_NETWORK_PASSPHRASE?: string;
  VITE_VAULT_CONTRACT_ID?: string;
}

export interface DeploymentJson {
  contract_id?: string;
  contracts?: {
    vault?: string;
  };
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidateOptions {
  strict?: boolean;
  checkRpc?: boolean;
  deployment?: DeploymentJson;
}

export function parseEnvFile(contents: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

export function loadEnvFile(filePath: string): Record<string, string> {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Env file not found: ${resolved}`);
  }
  return parseEnvFile(fs.readFileSync(resolved, 'utf-8'));
}

export function loadDeploymentJson(filePath: string): DeploymentJson {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Deployment JSON not found: ${resolved}`);
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf-8')) as DeploymentJson;
}

export function resolveDeployedContractId(deployment: DeploymentJson): string | undefined {
  return deployment.contract_id ?? deployment.contracts?.vault;
}

export function validateContractIdFormat(contractId: string): ValidationIssue | null {
  if (!contractId) {
    return { field: 'VITE_VAULT_CONTRACT_ID', message: 'Contract ID is required' };
  }
  if (!CONTRACT_ID_REGEX.test(contractId)) {
    return {
      field: 'VITE_VAULT_CONTRACT_ID',
      message: `Invalid contract ID format (expected C + 55 base32 chars): ${contractId}`,
    };
  }
  return null;
}

export function validatePassphrase(passphrase: string): ValidationIssue | null {
  if (!passphrase) {
    return {
      field: 'VITE_STELLAR_NETWORK_PASSPHRASE',
      message: 'Network passphrase is required',
    };
  }
  if (passphrase !== TESTNET_PASSPHRASE && passphrase !== MAINNET_PASSPHRASE) {
    return {
      field: 'VITE_STELLAR_NETWORK_PASSPHRASE',
      message: 'Unknown network passphrase (expected testnet or mainnet passphrase)',
    };
  }
  return null;
}

export function validateRpcUrl(rpcUrl: string): ValidationIssue | null {
  if (!rpcUrl) {
    return { field: 'VITE_SOROBAN_RPC_URL', message: 'RPC URL is required' };
  }
  try {
    const url = new URL(rpcUrl);
    if (url.protocol !== 'https:') {
      return { field: 'VITE_SOROBAN_RPC_URL', message: 'RPC URL must use HTTPS' };
    }
  } catch {
    return { field: 'VITE_SOROBAN_RPC_URL', message: 'Invalid RPC URL' };
  }
  return null;
}

export function validateRpcPassphraseMatch(
  rpcUrl: string,
  passphrase: string,
): ValidationIssue | null {
  if (passphrase === TESTNET_PASSPHRASE && !rpcUrl.includes('testnet')) {
    return {
      field: 'VITE_SOROBAN_RPC_URL',
      message: 'Testnet passphrase requires a testnet Soroban RPC URL',
    };
  }
  if (passphrase === MAINNET_PASSPHRASE && !rpcUrl.includes('mainnet')) {
    return {
      field: 'VITE_SOROBAN_RPC_URL',
      message: 'Mainnet passphrase requires a mainnet Soroban RPC URL',
    };
  }
  return null;
}

export function validateDeploymentJsonMatch(
  contractId: string,
  deployment: DeploymentJson,
): ValidationIssue | null {
  const deployedId = resolveDeployedContractId(deployment);
  if (!deployedId) {
    return {
      field: 'deployment.json',
      message: 'No contract_id or contracts.vault found in deployment JSON',
    };
  }
  if (deployedId !== contractId) {
    return {
      field: 'VITE_VAULT_CONTRACT_ID',
      message: `Contract ID mismatch: env=${contractId}, deployment=${deployedId}`,
    };
  }
  return null;
}

export async function checkRpcReachability(rpcUrl: string): Promise<ValidationIssue | null> {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return {
        field: 'VITE_SOROBAN_RPC_URL',
        message: `RPC returned HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as { error?: { message?: string } };
    if (data.error) {
      return {
        field: 'VITE_SOROBAN_RPC_URL',
        message: `RPC error: ${data.error.message ?? 'unknown'}`,
      };
    }

    return null;
  } catch (err) {
    return {
      field: 'VITE_SOROBAN_RPC_URL',
      message: `RPC unreachable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function validateFrontendEnv(
  env: FrontendEnv,
  options: ValidateOptions = {},
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const strict = options.strict ?? false;
  const checkRpc = options.checkRpc ?? strict;

  const rpcUrl = env.VITE_SOROBAN_RPC_URL ?? '';
  const passphrase = env.VITE_STELLAR_NETWORK_PASSPHRASE ?? '';
  const contractId = env.VITE_VAULT_CONTRACT_ID ?? '';

  const effectiveRpc = rpcUrl || (strict ? '' : TESTNET_RPC);
  const effectivePassphrase = passphrase || (strict ? '' : TESTNET_PASSPHRASE);

  const rpcIssue = validateRpcUrl(strict ? rpcUrl : effectiveRpc);
  if (rpcIssue) issues.push(rpcIssue);

  const passphraseIssue = validatePassphrase(strict ? passphrase : effectivePassphrase);
  if (passphraseIssue) issues.push(passphraseIssue);

  if (!rpcIssue && !passphraseIssue) {
    const matchIssue = validateRpcPassphraseMatch(effectiveRpc, effectivePassphrase);
    if (matchIssue) issues.push(matchIssue);
  }

  if (strict || contractId) {
    const contractIssue = validateContractIdFormat(strict ? contractId : contractId);
    if (contractIssue) issues.push(contractIssue);
  }

  if (options.deployment && contractId) {
    const deploymentIssue = validateDeploymentJsonMatch(contractId, options.deployment);
    if (deploymentIssue) issues.push(deploymentIssue);
  }

  if (
    checkRpc &&
    effectiveRpc &&
    !issues.some((issue) => issue.field === 'VITE_SOROBAN_RPC_URL')
  ) {
    const reachabilityIssue = await checkRpcReachability(effectiveRpc);
    if (reachabilityIssue) issues.push(reachabilityIssue);
  }

  return issues;
}

function readCliFlag(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) return undefined;
  return process.argv[index + 1];
}

function hasCliFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main(): Promise<void> {
  const strict = hasCliFlag('--strict');
  const envFile = readCliFlag('--env-file');
  const deploymentJsonPath = readCliFlag('--deployment-json');
  const checkRpc = hasCliFlag('--check-rpc') || strict;

  const envFromFile = envFile ? loadEnvFile(envFile) : {};
  const env: FrontendEnv = {
    VITE_SOROBAN_RPC_URL:
      process.env.VITE_SOROBAN_RPC_URL ?? envFromFile.VITE_SOROBAN_RPC_URL,
    VITE_STELLAR_NETWORK_PASSPHRASE:
      process.env.VITE_STELLAR_NETWORK_PASSPHRASE ??
      envFromFile.VITE_STELLAR_NETWORK_PASSPHRASE,
    VITE_VAULT_CONTRACT_ID:
      process.env.VITE_VAULT_CONTRACT_ID ?? envFromFile.VITE_VAULT_CONTRACT_ID,
  };

  const deployment = deploymentJsonPath
    ? loadDeploymentJson(deploymentJsonPath)
    : undefined;

  if (deployment && !env.VITE_VAULT_CONTRACT_ID) {
    const deployedId = resolveDeployedContractId(deployment);
    if (deployedId) {
      env.VITE_VAULT_CONTRACT_ID = deployedId;
    }
  }

  const issues = await validateFrontendEnv(env, { strict, checkRpc, deployment });

  if (issues.length > 0) {
    console.error('❌ Frontend environment validation failed:');
    for (const issue of issues) {
      console.error(`  - ${issue.field}: ${issue.message}`);
    }
    console.error(
      '\nCopy deployment.json contract_id into frontend/.env.local as VITE_VAULT_CONTRACT_ID.',
    );
    console.error('See frontend/.env.example and docs/ENV_VARIABLE_MATRIX.md.');
    process.exit(1);
  }

  console.log('✅ Frontend environment validation passed.');
  if (env.VITE_VAULT_CONTRACT_ID) {
    console.log(`   Contract ID: ${env.VITE_VAULT_CONTRACT_ID}`);
  }
  if (env.VITE_SOROBAN_RPC_URL) {
    console.log(`   RPC URL: ${env.VITE_SOROBAN_RPC_URL}`);
  }
}

const isMainModule =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main().catch((err) => {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
