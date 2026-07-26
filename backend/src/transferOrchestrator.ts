// src/transferOrchestrator.ts
/**
 * Idempotent retry‑safe transfer orchestration service.
 *
 * It wraps the low‑level `submitVaultOperation` RPC call with the
 * `IdempotencyStore` ensuring that repeated attempts with the same
 * idempotency key result in a single on‑chain transaction and that the
 * original response is replayed safely.
 */
import { submitVaultOperation } from './sorobanClient';
import { idempotencyStore, buildIdempotencyFingerprint } from './idempotency';
import { IdempotentOperationResult } from './idempotency';

export interface TransferParams {
  operationType: 'deposit' | 'withdrawal';
  walletAddress: string;
  amount: string;
  asset: string;
}

/**
 * Orchestrates a vault transfer with idempotency.
 *
 * @param params - transfer details
 * @param idempotencyKey - unique key supplied by the client (e.g., UUID)
 * @returns result of the vault operation and a flag indicating if the result
 *          was replayed from a previous execution.
 */
export async function orchestrateTransfer(
  params: TransferParams,
  idempotencyKey: string,
): Promise<{ result: IdempotentOperationResult<string>; replayed: boolean }> {
  const fingerprint = buildIdempotencyFingerprint(params);

  return idempotencyStore.execute<string>(idempotencyKey, fingerprint, async () => {
    const txHash = await submitVaultOperation(
      params.operationType,
      params.walletAddress,
      params.amount,
      params.asset,
    );
    // The service returns the transaction hash as the body.
    return { statusCode: 200, body: txHash };
  });
}
