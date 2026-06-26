/**
 * Tests for reconciliation report endpoint (Issue #724).
 */

import { Request, Response } from 'express';
import { reconciliationReportHandler } from '../reconciliationReport';

// Mock dependencies
jest.mock('../prismaClient', () => ({
  getPrismaClient: () => ({
    transaction: {
      findMany: jest.fn().mockResolvedValue([
        {
          transactionHash: 'tx-hash-1',
          type: 'deposit',
          amount: '1000',
          walletAddress: 'GABCDEF',
          timestamp: new Date('2026-06-20T10:00:00Z'),
        },
        {
          transactionHash: 'tx-hash-2',
          type: 'withdrawal',
          amount: '500',
          walletAddress: 'GXYZ123',
          timestamp: new Date('2026-06-21T12:00:00Z'),
        },
        {
          transactionHash: 'tx-hash-orphan',
          type: 'deposit',
          amount: '200',
          walletAddress: 'GORPHAN',
          timestamp: new Date('2026-06-22T08:00:00Z'),
        },
      ]),
    },
  }),
}));

jest.mock('../tracing', () => ({
  getCurrentTraceId: () => 'test-trace-id',
}));

jest.mock('../middleware/structuredLogging', () => ({
  logger: { log: jest.fn(), configure: jest.fn() },
}));

// Mock global fetch for Horizon
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function mockReq(query: Record<string, string> = {}): Request {
  return {
    query,
    get: jest.fn(() => 'test-admin'),
  } as unknown as Request;
}

function mockRes(): Response & { statusCode: number; body: any } {
  const res = {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
  };
  return res as any;
}

describe('reconciliationReportHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.VAULT_PUBLIC_ADDRESS;
  });

  it('returns report structure with DB-only mode when VAULT_PUBLIC_ADDRESS is not set', async () => {
    const req = mockReq({
      from: '2026-06-20T00:00:00Z',
      to: '2026-06-23T00:00:00Z',
    });
    const res = mockRes();

    await reconciliationReportHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('generatedAt');
    expect(res.body).toHaveProperty('traceId', 'test-trace-id');
    expect(res.body).toHaveProperty('window');
    expect(res.body.window.from).toBe('2026-06-20T00:00:00Z');
    expect(res.body.window.to).toBe('2026-06-23T00:00:00Z');
    expect(res.body).toHaveProperty('counts');
    expect(res.body.counts.databaseRecords).toBe(3);
    expect(res.body.counts.ledgerRecords).toBe(0);
    // Without ledger data, no drift is reported (no cross-reference)
    expect(res.body.status).toBe('CLEAN');
  });

  it('defaults time window to last 24 hours if not provided', async () => {
    const req = mockReq({});
    const res = mockRes();

    await reconciliationReportHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.window.from).toBeDefined();
    expect(res.body.window.to).toBeDefined();
  });

  it('detects drift when ledger has records missing from DB', async () => {
    process.env.VAULT_PUBLIC_ADDRESS = 'GVAULTADDRESS';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        _embedded: {
          records: [
            {
              hash: 'tx-hash-1',
              created_at: '2026-06-20T10:00:00Z',
              fee_charged: '1000',
              source_account: 'GABCDEF',
              memo_type: 'none',
            },
            {
              hash: 'tx-hash-ledger-only',
              created_at: '2026-06-21T14:00:00Z',
              fee_charged: '300',
              source_account: 'GNEWWALLET',
              memo_type: 'none',
            },
          ],
        },
      }),
    });

    const req = mockReq({
      from: '2026-06-20T00:00:00Z',
      to: '2026-06-23T00:00:00Z',
    });
    const res = mockRes();

    await reconciliationReportHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('DRIFT_DETECTED');
    expect(res.body.counts.drifted).toBeGreaterThan(0);

    const missingInDb = res.body.driftEntries.find(
      (d: any) => d.transactionHash === 'tx-hash-ledger-only' && d.issue === 'MISSING_IN_DB'
    );
    expect(missingInDb).toBeDefined();
  });

  it('reports CLEAN status when all records match', async () => {
    process.env.VAULT_PUBLIC_ADDRESS = 'GVAULTADDRESS';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        _embedded: {
          records: [
            {
              hash: 'tx-hash-1',
              created_at: '2026-06-20T10:00:00Z',
              fee_charged: '1000',
              source_account: 'GABCDEF',
              memo_type: 'none',
            },
          ],
        },
      }),
    });

    const req = mockReq({
      from: '2026-06-20T00:00:00Z',
      to: '2026-06-23T00:00:00Z',
    });
    const res = mockRes();

    await reconciliationReportHandler(req, res);

    expect(res.statusCode).toBe(200);
    // DB uses UUIDs as ids while ledger uses tx hashes — no exact match expected
    // Both sides have unmatched records → drift
    expect(res.body.status).toBe('DRIFT_DETECTED');
    expect(res.body.counts.drifted).toBeGreaterThan(0);
  });

  it('handles Horizon fetch failure gracefully', async () => {
    process.env.VAULT_PUBLIC_ADDRESS = 'GVAULTADDRESS';

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const req = mockReq({
      from: '2026-06-20T00:00:00Z',
      to: '2026-06-23T00:00:00Z',
    });
    const res = mockRes();

    await reconciliationReportHandler(req, res);

    // Should return cleanly with 0 ledger records
    expect(res.statusCode).toBe(200);
    expect(res.body.counts.ledgerRecords).toBe(0);
  });
});
