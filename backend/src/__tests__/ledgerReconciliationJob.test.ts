/**
 * Tests for scheduled ledger reconciliation drift detection.
 */

import {
  runReconciliationReport,
  reconcile,
  resetReconciliationStateForTests,
  type LedgerRecord,
} from '../reconciliationReport';
import { runLedgerReconciliationJob, resetLedgerReconciliationSchedulerForTests } from '../positionReconciliationJob';
import {
  reconciliationDriftTotal,
  reconciliationStatus,
  reconciliationLastRunTimestamp,
  register,
} from '../metrics';
import { resetJobGovernance } from '../jobGovernance';

const mockFindMany = jest.fn().mockResolvedValue([]);
const mockSnapshotCreate = jest.fn().mockResolvedValue({});

jest.mock('../prismaClient', () => ({
  getPrismaClient: () => ({
    transaction: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    reconciliationSnapshot: {
      create: (...args: unknown[]) => mockSnapshotCreate(...args),
    },
  }),
}));

jest.mock('../middleware/structuredLogging', () => ({
  logger: { log: jest.fn(), configure: jest.fn() },
}));

describe('runReconciliationReport', () => {
  beforeEach(() => {
    resetReconciliationStateForTests();
    resetLedgerReconciliationSchedulerForTests();
    resetJobGovernance();
    mockFindMany.mockReset();
    mockFindMany.mockResolvedValue([]);
  });

  it('reports CLEAN when ledger and database records match', async () => {
    const records: LedgerRecord[] = [
      {
        transactionHash: 'tx-1',
        type: 'deposit',
        amount: '100',
        walletAddress: 'GABC',
        timestamp: '2026-06-20T10:00:00Z',
      },
    ];

    mockFindMany.mockResolvedValueOnce([
      {
        id: 'tx-1',
        type: 'deposit',
        amount: '100',
        user: 'GABC',
        timestamp: new Date('2026-06-20T10:00:00Z'),
      },
    ]);

    const report = await runReconciliationReport({
      from: '2026-06-20T00:00:00Z',
      to: '2026-06-21T00:00:00Z',
      ledgerFetcher: async () => records,
      storeAsAutomated: true,
      persistSnapshot: false,
    });

    expect(report.status).toBe('CLEAN');
    expect(report.counts.matched).toBe(1);
    expect(report.counts.drifted).toBe(0);
  });

  it('detects drift when ledger record is missing in DB', async () => {
    const ledgerRecords: LedgerRecord[] = [
      {
        transactionHash: 'tx-missing',
        type: 'deposit',
        amount: '50',
        walletAddress: 'GXYZ',
        timestamp: '2026-06-20T10:00:00Z',
      },
    ];

    const report = await runReconciliationReport({
      from: '2026-06-20T00:00:00Z',
      to: '2026-06-21T00:00:00Z',
      ledgerFetcher: async () => ledgerRecords,
      storeAsAutomated: true,
      persistSnapshot: false,
    });

    expect(report.status).toBe('DRIFT_DETECTED');
    expect(report.driftEntries[0].issue).toBe('MISSING_IN_DB');
  });
});

describe('runLedgerReconciliationJob metrics', () => {
  beforeEach(async () => {
    resetReconciliationStateForTests();
    resetJobGovernance();
    reconciliationDriftTotal.reset();
    reconciliationStatus.reset();
    reconciliationLastRunTimestamp.reset();
  });

  it('increments drift counters and sets status gauge on drift', async () => {
    const ledgerRecords: LedgerRecord[] = [
      {
        transactionHash: 'tx-drift',
        type: 'withdrawal',
        amount: '10',
        walletAddress: 'GDRIFT',
        timestamp: '2026-06-20T10:00:00Z',
      },
    ];

    jest.spyOn(require('../reconciliationReport'), 'runReconciliationReport').mockResolvedValue({
      generatedAt: new Date().toISOString(),
      traceId: 'trace-1',
      window: { from: '2026-06-20T00:00:00Z', to: '2026-06-21T00:00:00Z' },
      counts: { ledgerRecords: 1, databaseRecords: 0, matched: 0, drifted: 1 },
      driftEntries: [{ transactionHash: 'tx-drift', issue: 'MISSING_IN_DB', details: {} }],
      status: 'DRIFT_DETECTED',
    });

    await runLedgerReconciliationJob();

    const metrics = await register.metrics();
    expect(metrics).toContain('reconciliation_drift_total');
    expect(metrics).toContain('reconciliation_status');
    expect(metrics).toContain('reconciliation_last_run_timestamp');
  });
});

describe('reconcile', () => {
  it('flags amount mismatches', () => {
    const ledger: LedgerRecord[] = [{
      transactionHash: 'tx-1',
      type: 'deposit',
      amount: '100',
      walletAddress: 'GABC',
      timestamp: '2026-06-20T10:00:00Z',
    }];
    const db: LedgerRecord[] = [{
      transactionHash: 'tx-1',
      type: 'deposit',
      amount: '99',
      walletAddress: 'GABC',
      timestamp: '2026-06-20T10:00:00Z',
    }];

    const result = reconcile(ledger, db);
    expect(result.driftEntries[0].issue).toBe('AMOUNT_MISMATCH');
  });
});
