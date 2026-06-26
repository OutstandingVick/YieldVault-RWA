import { getPrismaClient } from './prismaClient';
import { logger } from './middleware/structuredLogging';
import { runJobWithRetry, registerJob } from './jobGovernance';
import { startEventPollingService } from './eventPollingService';
import { updateVaultMetrics } from './metrics';
import Decimal from 'decimal.js';

const prisma = getPrismaClient();

export async function runPositionReconciliationJob(): Promise<void> {
  const contractId = process.env.VITE_VAULT_CONTRACT_ID || process.env.VAULT_CONTRACT_ID;
  if (!contractId) {
    throw new Error('VITE_VAULT_CONTRACT_ID or VAULT_CONTRACT_ID environment variable is not set');
  }

  logger.log('info', 'Position reconciliation job started');

  // Get/start the event polling service singleton
  const pollingService = startEventPollingService({
    rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
    contractId,
    pollIntervalMs: parseInt(process.env.EVENT_POLL_INTERVAL_MS || '10000', 10),
    batchSize: parseInt(process.env.EVENT_REPLAY_BATCH_SIZE || '100', 10),
  });

  // Trigger poll cycle and propagate errors
  await pollingService.pollEvents();

  // Read the updated vault state from the database
  const state = await prisma.vaultState.findUnique({ where: { id: 1 } });
  if (state) {
    const assets = new Decimal(state.totalAssets);
    const shares = new Decimal(state.totalShares);
    const sharePrice = assets.gt(0) && shares.gt(0) ? assets.div(shares) : new Decimal(1);

    updateVaultMetrics(assets.toNumber(), sharePrice.toNumber());

    logger.log('info', 'Vault metrics updated from on-chain state', {
      tvl: assets.toString(),
      sharePrice: sharePrice.toString(),
    });
  } else {
    updateVaultMetrics(0, 1);
    logger.log('info', 'Vault metrics initialized to default values');
  }

  logger.log('info', 'Position reconciliation job completed');
}

let reconciliationTimer: ReturnType<typeof setInterval> | null = null;

export function startPositionReconciliationScheduler(): () => void {
  const enabled = process.env.POSITION_RECONCILIATION_ENABLED !== 'false';
  if (!enabled) {
    logger.log('info', 'Position reconciliation scheduler disabled');
    return () => {};
  }

  const intervalMs = parseInt(process.env.POSITION_RECONCILIATION_INTERVAL_MS || '30000', 10);
  registerJob('positionReconciliation');

  reconciliationTimer = setInterval(() => {
    void runJobWithRetry('positionReconciliation', runPositionReconciliationJob).catch((error) => {
      logger.log('error', 'Position reconciliation scheduler error', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, intervalMs);

  logger.log('info', 'Position reconciliation scheduler started', {
    intervalMs,
  });

  return () => {
    if (reconciliationTimer) {
      clearInterval(reconciliationTimer);
      reconciliationTimer = null;
      logger.log('info', 'Position reconciliation scheduler stopped');
    }
  };
}
