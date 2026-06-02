/**
 * Soroban RPC client for submitting vault operations to the Stellar network.
 * Uses @stellar/stellar-sdk for contract invocation.
 */

import fs from 'fs';
import path from 'path';
import {
  Keypair,
  Contract,
  rpc,
  nativeToScVal,
  StrKey,
  TransactionBuilder,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { logger } from './middleware/structuredLogging';
import { getCurrentTraceId } from './tracing';

// Well-known Stellar network passphrases (avoids importing Networks which is
// not consistently re-exported across stellar-sdk minor versions).
const NETWORK_PASSPHRASES: Record<string, string> = {
  testnet: 'Test SDF Network ; September 2015',
  mainnet: 'Public Global Stellar Network ; September 2015',
  public: 'Public Global Stellar Network ; September 2015',
};

// ─── Config helpers ───────────────────────────────────────────────────────────

const getRpcClient = () => {
  const rpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
  return new rpc.Server(rpcUrl);
};

/**
 * Returns the vault contract ID.
 * Checks VAULT_CONTRACT_ID env var first, then falls back to the
 * deployments/contracts.<network>.json file so the value is never hard-coded.
 */
export function resolveContractId(): string {
  if (process.env.VAULT_CONTRACT_ID) return process.env.VAULT_CONTRACT_ID;

  const network = process.env.STELLAR_NETWORK || 'testnet';
  const deploymentFile = path.resolve(
    __dirname,
    `../../deployments/contracts.${network}.json`,
  );
  try {
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf-8'));
    const id: string | undefined = deployment?.contracts?.vault;
    if (id) return id;
  } catch {
    // deployments file missing or unreadable — fall through to error
  }

  throw new Error(
    'VAULT_CONTRACT_ID is not set and no vault address found in the deployments file',
  );
}

function resolveNetworkPassphrase(): string {
  if (process.env.STELLAR_NETWORK_PASSPHRASE) return process.env.STELLAR_NETWORK_PASSPHRASE;
  const network = process.env.STELLAR_NETWORK || 'testnet';
  return NETWORK_PASSPHRASES[network] ?? NETWORK_PASSPHRASES.testnet;
}

function validateEnvironment(): void {
  if (!process.env.STELLAR_SECRET_KEY) {
    throw new Error('STELLAR_SECRET_KEY environment variable is not set');
  }
  // Validate contract ID is resolvable early so the error message is clear.
  resolveContractId();
}

function getSourceKeypair(): Keypair {
  try {
    return Keypair.fromSecret(process.env.STELLAR_SECRET_KEY!);
  } catch (err) {
    throw new Error(
      `Invalid STELLAR_SECRET_KEY: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ─── Error types ─────────────────────────────────────────────────────────────

export interface SorobanTxError extends Error {
  code?: string;
  statusCode?: number;
}

export class SorobanSimulationError extends Error implements SorobanTxError {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string = 'SIMULATION_ERROR', statusCode: number = 502) {
    super(message);
    this.name = 'SorobanSimulationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ─── Core RPC call ────────────────────────────────────────────────────────────

/**
 * Submit a Soroban vault contract invocation (deposit or withdrawal) to the
 * Stellar network. Steps:
 *  1. Build the transaction with the correct contract arguments.
 *  2. Simulate to validate inputs and obtain the resource footprint.
 *  3. Assemble (inject footprint + auth entries), sign, and submit.
 *  4. Return the on-chain transaction hash once the tx is PENDING.
 *
 * @throws SorobanSimulationError for any Stellar/RPC-level failure.
 */
export async function submitVaultOperation(
  operationType: 'deposit' | 'withdrawal',
  walletAddress: string,
  amount: string,
  asset: string,
): Promise<string> {
  try {
    validateEnvironment();

    const rpcClient = getRpcClient();
    const sourceKeypair = getSourceKeypair();
    const contractId = resolveContractId();
    const networkPassphrase = resolveNetworkPassphrase();

    if (!StrKey.isValidEd25519PublicKey(walletAddress)) {
      throw new SorobanSimulationError(
        `Invalid Stellar wallet address: ${walletAddress}`,
        'INVALID_ADDRESS',
        422,
      );
    }

    logger.log('debug', `Submitting Soroban ${operationType}`, {
      walletAddress,
      amount,
      asset,
      contractId,
      traceId: getCurrentTraceId(),
    });

    const sourceAccount = await rpcClient.getAccount(sourceKeypair.publicKey());
    const contract = new Contract(contractId);

    // Convert the amount string to BigInt so nativeToScVal produces a valid i128.
    let amountBigInt: bigint;
    try {
      amountBigInt = BigInt(Math.round(Number(amount)));
    } catch {
      throw new SorobanSimulationError(
        `Invalid amount value: ${amount}`,
        'INVALID_AMOUNT',
        422,
      );
    }

    const op = contract.call(
      operationType,
      nativeToScVal(walletAddress, { type: 'address' }),
      nativeToScVal(amountBigInt, { type: 'i128' }),
      nativeToScVal(asset, { type: 'string' }),
    );

    const tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(300)
      .build();

    logger.log('debug', `Simulating Soroban transaction for ${operationType}`, {
      traceId: getCurrentTraceId(),
    });

    const simulated = await rpcClient.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simulated)) {
      const errorMessage = `Soroban simulation failed: ${
        'error' in simulated ? String(simulated.error) : 'unknown simulation error'
      }`;
      logger.log('error', errorMessage, {
        operationType,
        walletAddress,
        traceId: getCurrentTraceId(),
      });
      throw new SorobanSimulationError(errorMessage, 'SIMULATION_ERROR');
    }

    if (rpc.Api.isSimulationRestore(simulated)) {
      logger.log('warn', 'Soroban transaction requires ledger entry restore', {
        operationType,
        walletAddress,
        traceId: getCurrentTraceId(),
      });
      throw new SorobanSimulationError(
        'Contract state requires ledger restore. Please retry in a few minutes.',
        'RESTORE_REQUIRED',
        503,
      );
    }

    // assembleTransaction injects the resource footprint and auth entries.
    // .build() gives a Transaction; it must be signed before submission.
    const assembled = rpc.assembleTransaction(tx, simulated).build();
    assembled.sign(sourceKeypair);

    logger.log('debug', `Submitting assembled Soroban transaction for ${operationType}`, {
      traceId: getCurrentTraceId(),
    });

    const txResponse = await rpcClient.sendTransaction(assembled);

    if (txResponse.status === 'ERROR') {
      const detail = txResponse.errorResult?.toXDR?.('base64') ?? 'unknown error';
      const errorMessage = `Soroban RPC rejected transaction: ${detail}`;
      logger.log('error', errorMessage, {
        operationType,
        walletAddress,
        traceId: getCurrentTraceId(),
      });
      throw new SorobanSimulationError(errorMessage, 'RPC_ERROR');
    }

    if (txResponse.status !== 'PENDING') {
      const detail = txResponse.errorResult?.toXDR?.('base64') ?? txResponse.status;
      const errorMessage = `Unexpected transaction status: ${detail}`;
      logger.log('error', errorMessage, {
        operationType,
        walletAddress,
        traceId: getCurrentTraceId(),
      });
      throw new SorobanSimulationError(errorMessage, 'SUBMISSION_FAILED');
    }

    logger.log('info', `Soroban ${operationType} submitted`, {
      transactionHash: txResponse.hash,
      walletAddress,
      traceId: getCurrentTraceId(),
    });

    return txResponse.hash;
  } catch (err) {
    if (err instanceof SorobanSimulationError) throw err;

    const message = err instanceof Error ? err.message : String(err);
    logger.log('error', `Unexpected error in submitVaultOperation: ${message}`, {
      operationType,
      walletAddress,
      traceId: getCurrentTraceId(),
    });
    throw new SorobanSimulationError(`Unexpected error: ${message}`, 'INTERNAL_ERROR');
  }
}
