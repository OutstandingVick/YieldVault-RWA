import { Router, Request, Response, NextFunction } from 'express';
import { emailService } from './emailService';
import { logger } from './middleware/structuredLogging';
import { allowlistMiddleware } from './middleware/allowlist';
import { invalidateCache } from './middleware/cache';
import { writesLimiter } from './rateLimiter';
import { idempotencyStore, IdempotencyConflictError } from './idempotency';
import { sorobanCircuitBreaker, CircuitOpenError } from './circuitBreaker';
import { withSpan, getCurrentTraceId } from './tracing';
import { submitVaultOperation, SorobanSimulationError } from './sorobanClient';
import { requireFlag } from './featureFlags';
import { referralService } from './referralService';
import { getPrismaClient } from './prismaClient';
import { emitTransactionEvent, TransactionEventType } from './webhookDelivery';
import { validate, VaultOperationSchema } from './middleware/validate';
import { withdrawalDailyLimitMiddleware } from './middleware/withdrawalDailyLimit';
import { requireSignedWalletAction } from './middleware/walletSignedAction';
import crypto from 'crypto';
// crypto is still used below for generateFingerprint and body.id generation.
import { tryAcquireWalletLock } from './walletLock';
import { normalizeWalletAddress } from './walletUtils';
import Decimal from 'decimal.js';

const router = Router();
const ZERO = new Decimal(0);
const DEFAULT_SHARE_PRICE = new Decimal(1);

function invalidateReadCaches(_req: Request, _res: Response, next: NextFunction): void {
  // R5: pattern-scoped invalidation — only clear vault, transactions, and portfolio entries
  invalidateCache('GET:/api/v1/vault');
  invalidateCache('GET:/api/v1/transactions');
  invalidateCache('GET:/api/v1/portfolio');
  next();
}

function generateFingerprint(body: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

/**
 * Submit a vault operation to the Stellar network via the real Soroban RPC,
 * wrapped in the circuit breaker (opens after repeated RPC failures) and an
 * OTel trace span.
 */
async function submitSorobanTx(type: string, payload: Record<string, unknown>): Promise<string> {
  return sorobanCircuitBreaker.execute(() =>
    withSpan('soroban.rpc.submit', async (span) => {
      span.setAttributes({ 'rpc.type': type, 'rpc.wallet': String(payload.walletAddress ?? '') });
      return submitVaultOperation(
        type as 'deposit' | 'withdrawal',
        String(payload.walletAddress),
        String(payload.amount),
        String(payload.asset),
      );
    }),
  );
}

async function updateVaultStateAndSnapshot(
  type: 'deposit' | 'withdrawal',
  amountRaw: string,
  recordedAt: Date,
): Promise<void> {
  const prisma = getPrismaClient();
  const amount = new Decimal(amountRaw);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.vaultState.findUnique({ where: { id: 1 } });
    const currentAssets = existing ? new Decimal(existing.totalAssets) : ZERO;
    const currentShares = existing ? new Decimal(existing.totalShares) : ZERO;
    const currentSharePrice = currentAssets.gt(0) && currentShares.gt(0)
      ? currentAssets.div(currentShares)
      : DEFAULT_SHARE_PRICE;

    let nextAssets = currentAssets;
    let nextShares = currentShares;

    if (type === 'deposit') {
      const mintedShares = amount.div(currentSharePrice);
      nextAssets = currentAssets.plus(amount);
      nextShares = currentShares.plus(mintedShares);
    } else {
      const burnedShares = amount.div(currentSharePrice);
      nextAssets = Decimal.max(ZERO, currentAssets.minus(amount));
      nextShares = Decimal.max(ZERO, currentShares.minus(burnedShares));
    }

    await tx.vaultState.upsert({
      where: { id: 1 },
      update: {
        totalAssets: nextAssets.toFixed(6),
        totalShares: nextShares.toFixed(6),
      },
      create: {
        id: 1,
        totalAssets: nextAssets.toFixed(6),
        totalShares: nextShares.toFixed(6),
      },
    });

    const resultingSharePrice = nextAssets.gt(0) && nextShares.gt(0)
      ? nextAssets.div(nextShares)
      : DEFAULT_SHARE_PRICE;

    await tx.sharePriceSnapshot.create({
      data: {
        sharePrice: resultingSharePrice.toFixed(6),
        totalAssets: nextAssets.toFixed(6),
        totalShares: nextShares.toFixed(6),
        source: `vault_${type}`,
        recordedAt,
      },
    });
  });
}

/** Shared handler logic for deposit / withdrawal to avoid duplication. */
async function handleVaultOperation(
  req: Request,
  res: Response,
  type: 'deposit' | 'withdrawal',
): Promise<Response> {
  // Task 3: read Idempotency-Key header (spec-compliant name)
  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ||
    (req.headers['x-idempotency-key'] as string | undefined);

  const { amount, asset, walletAddress, email, referralCode } = req.body;
  const normalizedWallet = normalizeWalletAddress(walletAddress);
  const walletLock = tryAcquireWalletLock(normalizedWallet);

  if (!walletLock.acquired) {
    return res.status(409).json({
      error: 'Conflict',
      status: 409,
      code: 'WALLET_OPERATION_IN_PROGRESS',
      message: 'Another operation is already in progress for this wallet',
      walletAddress: normalizedWallet,
    });
  }

  const operation = async () => {
    return withSpan(`vault.${type}`, async (span) => {
      span.setAttributes({
        'vault.amount': String(amount),
        'vault.asset': String(asset),
        'vault.wallet': String(walletAddress),
      });

      let txHash: string;
      try {
        txHash = await submitSorobanTx(type, { amount, asset, walletAddress });
      } catch (err) {
        if (err instanceof CircuitOpenError) {
          // Bubble up so the route handler can return 503
          throw err;
        }
        throw err;
      }

      // Persist transaction to DB
      const prisma = getPrismaClient();
      await prisma.transaction.create({
        data: {
          user: normalizedWallet,
          amount: String(amount),
          type,
          status: 'completed',
          referralCode,
        },
      });

      await updateVaultStateAndSnapshot(type, String(amount), new Date());

      // Handle referral recording on deposit
      if (type === 'deposit') {
        await referralService.recordDeposit(normalizedWallet, referralCode);
      }

      const body = {
        id: `tx-${crypto.randomBytes(4).toString('hex')}`,
        type,
        amount,
        asset,
        walletAddress,
        transactionHash: txHash,
        status: 'pending',
        timestamp: new Date().toISOString(),
      };

      // Fire webhook delivery in background so transaction API latency is not blocked.
      const eventType: TransactionEventType =
        type === 'deposit' ? 'transaction.deposit.created' : 'transaction.withdrawal.created';
      void emitTransactionEvent(eventType, {
        transactionId: body.id,
        amount: String(body.amount),
        asset: String(body.asset),
        walletAddress: String(body.walletAddress),
        transactionHash: String(body.transactionHash),
        status: String(body.status),
        timestamp: String(body.timestamp),
      }).catch((error) => {
        logger.log('error', 'Failed to emit webhook delivery', {
          error: error instanceof Error ? error.message : String(error),
          eventType,
          transactionId: body.id,
        });
      });

      span.setAttributes({ 'vault.txHash': txHash });

      // Post-confirmation email (fire-and-forget)
      const schedulePostConfirmation = process.env.NODE_ENV === 'test'
        ? (fn: () => Promise<void>) => {
            void fn();
          }
        : (fn: () => Promise<void>) => {
            setTimeout(() => {
              void fn();
            }, 100);
          };

      schedulePostConfirmation(async () => {
        try {
          const confirmationDelayMs = process.env.NODE_ENV === 'test' ? 0 : 5000;
          if (confirmationDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, confirmationDelayMs));
          }
          logger.log('info', `${type} confirmed on-chain`, {
            txHash,
            walletAddress,
            traceId: getCurrentTraceId(),
          });
          if (email) {
            const sendFn =
              type === 'deposit'
                ? emailService.sendDepositConfirmation.bind(emailService)
                : emailService.sendWithdrawalConfirmation.bind(emailService);
            await sendFn(email, {
              amount: String(amount),
              asset,
              date: new Date().toISOString(),
              txHash,
              walletAddress,
            });
          }
        } catch (error) {
          logger.log('error', 'Error in post-confirmation email logic', {
            error: error instanceof Error ? error.message : String(error),
            txHash,
            traceId: getCurrentTraceId(),
          });
        }
      });

      return { statusCode: 201, body };
    });
  };

  try {
    if (idempotencyKey) {
      const fingerprint = generateFingerprint(req.body);
      const { result, replayed } = await idempotencyStore.execute(
        idempotencyKey,
        fingerprint,
        operation,
      );
      if (replayed) res.setHeader('idempotency-status', 'replayed');
      // R5: pattern-scoped invalidation on successful write
      invalidateCache('GET:/api/v1/vault');
      invalidateCache('GET:/api/v1/transactions');
      invalidateCache('GET:/api/v1/portfolio');
      return res.status(result.statusCode).json(result.body);
    }

    const result = await operation();
    // R5: pattern-scoped invalidation on successful write
    invalidateCache('GET:/api/v1/vault');
    invalidateCache('GET:/api/v1/transactions');
    invalidateCache('GET:/api/v1/portfolio');
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    if (err instanceof IdempotencyConflictError) {
      return res.status(409).json({
        error: 'Conflict',
        status: 409,
        message: err.message,
      });
    }

    if (err instanceof CircuitOpenError) {
      const retryAfterSec = Math.ceil(err.retryAfterMs / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(503).json({
        error: 'Service Unavailable',
        status: 503,
        message: 'Soroban RPC is temporarily unavailable. Please retry later.',
        retryAfterMs: err.retryAfterMs,
      });
    }

    if (err instanceof SorobanSimulationError) {
      return res.status(err.statusCode).json({
        error: err.statusCode === 422 ? 'Unprocessable Entity' : 'Bad Gateway',
        status: err.statusCode,
        code: err.code,
        message: err.message,
      });
    }

    logger.log('error', `${type} operation failed`, {
      error: err instanceof Error ? err.message : String(err),
      traceId: getCurrentTraceId(),
    });
    return res.status(500).json({
      error: 'Internal Server Error',
      status: 500,
      message: `Failed to process ${type}`,
    });
  } finally {
    walletLock.release();
  }
}

/**
 * POST /api/v1/vault/deposits
 * Accepts optional Idempotency-Key header for deduplication.
 * Requires wallet address to be on the private beta allowlist (Issue #375).
 */
router.post(
  '/deposits',
  writesLimiter,
  invalidateReadCaches,
  requireSignedWalletAction('deposit'),
  allowlistMiddleware,
  validate({ body: VaultOperationSchema }),
  (req: Request, res: Response) => handleVaultOperation(req, res, 'deposit'),
);

/**
 * POST /api/v1/vault/withdrawals
 * Accepts optional Idempotency-Key header for deduplication.
 * Requires wallet address to be on the private beta allowlist (Issue #375).
 */
router.post(
  '/withdrawals',
  writesLimiter,
  invalidateReadCaches,
  requireSignedWalletAction('withdrawal'),
  allowlistMiddleware,
  validate({ body: VaultOperationSchema }),
  withdrawalDailyLimitMiddleware(),
  (req: Request, res: Response) => handleVaultOperation(req, res, 'withdrawal'),
);

// ─── Feature-flagged v2 endpoints ────────────────────────────────────────────

/**
 * POST /api/v1/vault/deposits/v2
 * Gated behind the "deposit-v2" feature flag.
 * Supports per-wallet targeting via x-wallet-address header or body.walletAddress.
 */
router.post(
  '/deposits/v2',
  writesLimiter,
  invalidateReadCaches,
  requireSignedWalletAction('deposit'),
  requireFlag('deposit-v2'),
  validate({ body: VaultOperationSchema }),
  (req: Request, res: Response) => handleVaultOperation(req, res, 'deposit'),
);

/**
 * POST /api/v1/vault/strategy
 * Gated behind the "strategy-selection" feature flag.
 */
router.post('/strategy', writesLimiter, requireFlag('strategy-selection'), (_req: Request, res: Response) => {
  res.status(200).json({ message: 'Strategy selection endpoint (v2 preview)' });
});

export default router;
