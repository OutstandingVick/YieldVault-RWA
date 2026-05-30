import { Router, Request, Response } from 'express';
import { emailService } from './emailService';
import { logger } from './middleware/structuredLogging';
import { idempotencyStore, IdempotencyConflictError } from './idempotency';
import crypto from 'crypto';
import { db } from './database';
import { validateApiKey } from './middleware/apiKeyAuth';
import { cacheMiddleware } from './middleware/cache';
import { parsePaginationQuery } from './pagination';

const router = Router();

/**
 * Helper to generate a fingerprint for the request body.
 */
function generateFingerprint(body: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

/**
 * POST /api/v1/vault/deposits
 * Submit a deposit request and send confirmation email upon "confirmation".
 * Supports idempotency via x-idempotency-key header.
 */
router.post('/deposits', async (req: Request, res: Response) => {
  const idempotencyKey = req.headers['x-idempotency-key'] as string;
  const { amount, asset, walletAddress, email } = req.body;

  if (!amount || !asset || !walletAddress) {
    return res.status(400).json({
      error: 'Bad Request',
      status: 400,
      message: 'Missing required fields: amount, asset, and walletAddress are required',
    });
  }

  const operation = async () => {
    // 1. Simulate on-chain transaction submission
    const txHash = `0x${crypto.randomBytes(4).toString('hex')}${crypto.randomBytes(4).toString('hex')}`;
    
    const body = {
      id: `tx-${crypto.randomBytes(4).toString('hex')}`,
      type: 'deposit',
      amount,
      asset,
      walletAddress,
      transactionHash: txHash,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };

    // 2. Simulate on-chain confirmation and send email (async)
    // We trigger this after returning the response
    setTimeout(async () => {
      try {
        // Simulate on-chain confirmation delay
        await new Promise(resolve => setTimeout(resolve, 5000));
        logger.log('info', 'Deposit confirmed on-chain', { txHash, walletAddress });

        if (email) {
          await emailService.sendDepositConfirmation(email, {
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
        });
      }
    }, 100);

    return {
      statusCode: 201,
      body,
    };
  };

  try {
    if (idempotencyKey) {
      const fingerprint = generateFingerprint(req.body);
      const { result, replayed } = await idempotencyStore.execute(idempotencyKey, fingerprint, operation);
      
      if (replayed) {
        res.setHeader('idempotency-status', 'replayed');
      }
      
      return res.status(result.statusCode).json(result.body);
    }

    const result = await operation();
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return res.status(409).json({
        error: 'Conflict',
        status: 409,
        message: error.message,
      });
    }
    
    logger.log('error', 'Deposit operation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    return res.status(500).json({
      error: 'Internal Server Error',
      status: 500,
      message: 'Failed to process deposit',
    });
  }
});

/**
 * POST /api/v1/vault/withdrawals
 * Submit a withdrawal request and send confirmation email upon "confirmation".
 */
router.post('/withdrawals', async (req: Request, res: Response) => {
  const idempotencyKey = req.headers['x-idempotency-key'] as string;
  const { amount, asset, walletAddress, email } = req.body;

  if (!amount || !asset || !walletAddress) {
    return res.status(400).json({
      error: 'Bad Request',
      status: 400,
      message: 'Missing required fields: amount, asset, and walletAddress are required',
    });
  }

  const operation = async () => {
    const txHash = `0x${crypto.randomBytes(4).toString('hex')}${crypto.randomBytes(4).toString('hex')}`;
    
    const body = {
      id: `tx-${crypto.randomBytes(4).toString('hex')}`,
      type: 'withdrawal',
      amount,
      asset,
      walletAddress,
      transactionHash: txHash,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };

    setTimeout(async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 5000));
        logger.log('info', 'Withdrawal confirmed on-chain', { txHash, walletAddress });

        if (email) {
          await emailService.sendWithdrawalConfirmation(email, {
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
        });
      }
    }, 100);

    return {
      statusCode: 201,
      body,
    };
  };

  try {
    if (idempotencyKey) {
      const fingerprint = generateFingerprint(req.body);
      const { result, replayed } = await idempotencyStore.execute(idempotencyKey, fingerprint, operation);
      
      if (replayed) {
        res.setHeader('idempotency-status', 'replayed');
      }
      
      return res.status(result.statusCode).json(result.body);
    }

    const result = await operation();
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return res.status(409).json({
        error: 'Conflict',
        status: 409,
        message: error.message,
      });
    }
    
    return res.status(500).json({
      error: 'Internal Server Error',
      status: 500,
      message: 'Failed to process withdrawal',
    });
  }
});

/**
 * GET /api/v1/vault/portfolio/:walletAddress
 * Retrieve user portfolio summary, including aggregates and yield.
 * Securely protected by CORS, validation middleware, and caching.
 */
router.get(
  '/portfolio/:walletAddress',
  validateApiKey,
  cacheMiddleware({ ttl: 60000 }), // 1 minute cache
  async (req: Request, res: Response) => {
    const { walletAddress } = req.params;

    try {
      // 1. Verify user exists in the system
      const userCheck = await db.query(
        'SELECT * FROM "User" WHERE address = ? LIMIT 1',
        [walletAddress]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          error: 'Not Found',
          status: 404,
          message: `Wallet address ${walletAddress} not found`,
        });
      }

      // 2. Fetch deposits and withdrawals aggregates
      const aggResult = await db.query(
        'SELECT type, SUM(CAST(amount AS REAL)) as total FROM "Transaction" WHERE user = ? GROUP BY type',
        [walletAddress]
      );

      let totalDeposited = 0;
      let totalWithdrawn = 0;

      for (const row of aggResult.rows) {
        if (row.type === 'deposit') {
          totalDeposited = Number(row.total);
        } else if (row.type === 'withdrawal') {
          totalWithdrawn = Number(row.total);
        }
      }

      const netPosition = totalDeposited - totalWithdrawn;

      // 3. Fetch latest APY snapshot
      const apyResult = await db.query(
        'SELECT apy FROM "ApySnapshot" ORDER BY timestamp DESC LIMIT 1'
      );
      const latestApy = apyResult.rows[0] ? Number(apyResult.rows[0].apy) : 0;

      // Estimated yield accrued = net position * apy%
      const estimatedYield = netPosition > 0 ? netPosition * (latestApy / 100) : 0;

      // 4. Handle pagination for transaction details if requested
      const pagination = parsePaginationQuery(req, {
        defaultLimit: 10,
        maxLimit: 100,
        defaultSortBy: 'timestamp',
        defaultSortOrder: 'desc',
      });

      const countResult = await db.query(
        'SELECT COUNT(*) as count FROM "Transaction" WHERE user = ?',
        [walletAddress]
      );
      const totalCount = Number(countResult.rows[0]?.count || 0);

      const limitVal = pagination.limit || 10;
      const pageVal = pagination.page || 1;
      const offsetVal = (pageVal - 1) * limitVal;

      const transactionsResult = await db.query(
        'SELECT * FROM "Transaction" WHERE user = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
        [walletAddress, limitVal, offsetVal]
      );

      return res.status(200).json({
        walletAddress,
        totalDeposited,
        totalWithdrawn,
        netPosition,
        estimatedYield,
        latestApy,
        transactions: {
          data: transactionsResult.rows,
          pagination: {
            count: transactionsResult.rows.length,
            total: totalCount,
            currentPage: pageVal,
            totalPages: Math.ceil(totalCount / limitVal),
            hasNextPage: pageVal * limitVal < totalCount,
            hasPrevPage: pageVal > 1,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.log('error', 'Failed to retrieve user portfolio summary', {
        error: error instanceof Error ? error.message : String(error),
        walletAddress,
      });

      return res.status(500).json({
        error: 'Internal Server Error',
        status: 500,
        message: 'Failed to retrieve portfolio summary',
      });
    }
  }
);

export default router;
