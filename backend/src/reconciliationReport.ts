/**
 * @file reconciliationReport.ts
 * Deterministic reconciliation report endpoint for ledger vs database drift.
 *
 * Compares on-chain ledger events (from Horizon/Soroban) against persisted
 * database state and produces a drift summary. Useful for identifying
 * missed events, duplicates, and amount mismatches.
 *
 * Issue #724
 */

import type { Request, Response } from 'express';
import { getPrismaClient } from './prismaClient';
import { logger } from './middleware/structuredLogging';
import { getCurrentTraceId } from './tracing';

// ─── Types ──────────────────────────────────────────────────────────────────

interface LedgerRecord {
  transactionHash: string;
  type: string;
  amount: string;
  walletAddress: string;
  timestamp: string;
}

interface DriftEntry {
  transactionHash: string;
  issue: 'MISSING_IN_DB' | 'MISSING_ON_LEDGER' | 'AMOUNT_MISMATCH' | 'TYPE_MISMATCH';
  details: Record<string, unknown>;
}

interface ReconciliationSummary {
  generatedAt: string;
  traceId: string | undefined;
  window: {
    from: string;
    to: string;
  };
  counts: {
    ledgerRecords: number;
    databaseRecords: number;
    matched: number;
    drifted: number;
  };
  driftEntries: DriftEntry[];
  status: 'CLEAN' | 'DRIFT_DETECTED';
}

// ─── Ledger Fetcher ─────────────────────────────────────────────────────────

/**
 * Fetches recent transaction records from the Horizon API for reconciliation.
 * In production, this queries the Stellar Horizon /transactions endpoint.
 * Falls back gracefully if Horizon is unreachable.
 */
async function fetchLedgerRecords(
  from: string,
  to: string,
): Promise<LedgerRecord[]> {
  const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
  const vaultAddress = process.env.VAULT_PUBLIC_ADDRESS;

  if (!vaultAddress) {
    logger.log('warn', 'VAULT_PUBLIC_ADDRESS not set — ledger reconciliation will use DB-only mode');
    return [];
  }

  try {
    const url = `${horizonUrl}/accounts/${vaultAddress}/transactions?limit=200&order=asc`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      logger.log('warn', `Horizon returned ${response.status} during reconciliation`);
      return [];
    }

    const data = await response.json() as any;
    const records: LedgerRecord[] = [];

    for (const record of data?._embedded?.records ?? []) {
      const createdAt = record.created_at;
      if (createdAt < from || createdAt > to) continue;

      records.push({
        transactionHash: record.hash,
        type: record.memo_type === 'text' && record.memo?.startsWith('withdraw') ? 'withdrawal' : 'deposit',
        amount: record.fee_charged || '0',
        walletAddress: record.source_account,
        timestamp: createdAt,
      });
    }

    return records;
  } catch (err) {
    logger.log('error', 'Failed to fetch ledger records for reconciliation', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ─── Database Fetcher ───────────────────────────────────────────────────────

async function fetchDatabaseRecords(
  from: string,
  to: string,
): Promise<LedgerRecord[]> {
  const prisma = getPrismaClient();

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        timestamp: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      orderBy: { timestamp: 'asc' },
      take: 5000,
    });

    return transactions.map((tx: any) => ({
      // Map from Prisma schema fields to our internal LedgerRecord shape.
      // The Transaction model uses `id` as identifier and `user` for wallet.
      transactionHash: tx.id,
      type: tx.type,
      amount: String(tx.amount),
      walletAddress: tx.user,
      timestamp: tx.timestamp instanceof Date ? tx.timestamp.toISOString() : String(tx.timestamp),
    }));
  } catch (err) {
    logger.log('warn', 'Failed to fetch database records for reconciliation — model may not exist', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ─── Reconciliation Logic ───────────────────────────────────────────────────

function reconcile(
  ledgerRecords: LedgerRecord[],
  dbRecords: LedgerRecord[],
): { matched: number; driftEntries: DriftEntry[] } {
  const dbByHash = new Map<string, LedgerRecord>();
  for (const rec of dbRecords) {
    dbByHash.set(rec.transactionHash, rec);
  }

  const ledgerByHash = new Map<string, LedgerRecord>();
  for (const rec of ledgerRecords) {
    ledgerByHash.set(rec.transactionHash, rec);
  }

  const driftEntries: DriftEntry[] = [];
  let matched = 0;

  // Check ledger records against DB
  for (const ledgerRec of ledgerRecords) {
    const dbRec = dbByHash.get(ledgerRec.transactionHash);
    if (!dbRec) {
      driftEntries.push({
        transactionHash: ledgerRec.transactionHash,
        issue: 'MISSING_IN_DB',
        details: {
          ledgerType: ledgerRec.type,
          ledgerAmount: ledgerRec.amount,
          ledgerWallet: ledgerRec.walletAddress,
          ledgerTimestamp: ledgerRec.timestamp,
        },
      });
      continue;
    }

    // Check for mismatches
    if (ledgerRec.amount !== dbRec.amount) {
      driftEntries.push({
        transactionHash: ledgerRec.transactionHash,
        issue: 'AMOUNT_MISMATCH',
        details: {
          ledgerAmount: ledgerRec.amount,
          databaseAmount: dbRec.amount,
        },
      });
      continue;
    }

    if (ledgerRec.type !== dbRec.type) {
      driftEntries.push({
        transactionHash: ledgerRec.transactionHash,
        issue: 'TYPE_MISMATCH',
        details: {
          ledgerType: ledgerRec.type,
          databaseType: dbRec.type,
        },
      });
      continue;
    }

    matched++;
  }

  // Check DB records missing from ledger
  for (const dbRec of dbRecords) {
    if (!ledgerByHash.has(dbRec.transactionHash) && ledgerRecords.length > 0) {
      driftEntries.push({
        transactionHash: dbRec.transactionHash,
        issue: 'MISSING_ON_LEDGER',
        details: {
          databaseType: dbRec.type,
          databaseAmount: dbRec.amount,
          databaseWallet: dbRec.walletAddress,
          databaseTimestamp: dbRec.timestamp,
        },
      });
    }
  }

  return { matched, driftEntries };
}

// ─── Handler ────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/reconciliation
 *
 * Query params:
 *   - from: ISO 8601 start timestamp (defaults to 24h ago)
 *   - to:   ISO 8601 end timestamp (defaults to now)
 *
 * Returns a reconciliation report comparing ledger events vs DB state.
 * Requires admin API key with ADMIN_READ permission.
 */
export async function reconciliationReportHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const traceId = getCurrentTraceId();
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const from = (req.query.from as string) || defaultFrom.toISOString();
  const to = (req.query.to as string) || now.toISOString();

  logger.log('info', 'Reconciliation report requested', {
    traceId,
    from,
    to,
    requestedBy: req.get('x-admin-address') || 'unknown',
  });

  const [ledgerRecords, dbRecords] = await Promise.all([
    fetchLedgerRecords(from, to),
    fetchDatabaseRecords(from, to),
  ]);

  const { matched, driftEntries } = reconcile(ledgerRecords, dbRecords);

  const report: ReconciliationSummary = {
    generatedAt: now.toISOString(),
    traceId,
    window: { from, to },
    counts: {
      ledgerRecords: ledgerRecords.length,
      databaseRecords: dbRecords.length,
      matched,
      drifted: driftEntries.length,
    },
    driftEntries: driftEntries.slice(0, 100), // cap response size
    status: driftEntries.length === 0 ? 'CLEAN' : 'DRIFT_DETECTED',
  };

  const statusCode = report.status === 'CLEAN' ? 200 : 200;
  res.status(statusCode).json(report);
}
