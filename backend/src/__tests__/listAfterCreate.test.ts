/**
 * @file listAfterCreate.test.ts
 * API tests for the list-after-create flow: verifies that transactions written
 * via Prisma are immediately visible through GET /api/v1/transactions.
 */

import { getPrismaClient } from '../prismaClient';
import { buildTransactionsResponse } from '../listEndpoints';

// ─── Prisma mock ─────────────────────────────────────────────────────────────

jest.mock('../prismaClient');

const mockPrisma = {
  transaction: {
    count: jest.fn<Promise<number>, [any?]>(),
    findMany: jest.fn<Promise<any[]>, [any?]>(),
  },
};
(getPrismaClient as jest.Mock).mockReturnValue(mockPrisma);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<{
  id: string;
  user: string;
  amount: string;
  type: string;
  status: string;
  referralCode: string | null;
  timestamp: Date;
}> = {}) {
  return {
    id: overrides.id ?? 'tx-001',
    user: overrides.user ?? 'GABC1234',
    amount: overrides.amount ?? '100.00',
    type: overrides.type ?? 'deposit',
    status: overrides.status ?? 'completed',
    referralCode: overrides.referralCode ?? null,
    timestamp: overrides.timestamp ?? new Date('2026-01-01T00:00:00.000Z'),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildTransactionsResponse — list-after-create flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty data when no transactions exist', async () => {
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    const result = await buildTransactionsResponse({});

    expect(result.data).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.hasNextPage).toBe(false);
  });

  it('reflects a newly created deposit immediately', async () => {
    const row = makeRow({ type: 'deposit', amount: '250.00', status: 'completed' });
    mockPrisma.transaction.count.mockResolvedValue(1);
    mockPrisma.transaction.findMany.mockResolvedValue([row]);

    const result = await buildTransactionsResponse({});

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: row.id,
      type: 'deposit',
      amount: '250.00',
      status: 'completed',
      walletAddress: row.user,
    });
  });

  it('reflects a newly created withdrawal immediately', async () => {
    const row = makeRow({ type: 'withdrawal', amount: '75.50', status: 'completed' });
    mockPrisma.transaction.count.mockResolvedValue(1);
    mockPrisma.transaction.findMany.mockResolvedValue([row]);

    const result = await buildTransactionsResponse({});

    expect(result.data[0].type).toBe('withdrawal');
    expect(result.data[0].amount).toBe('75.50');
  });

  it('paginates correctly — first page has nextCursor when more rows exist', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => makeRow({ id: `tx-${i + 1}` }));
    mockPrisma.transaction.count.mockResolvedValue(21);
    // findMany takes limit+1 — return all 21
    mockPrisma.transaction.findMany.mockResolvedValue(rows);

    const result = await buildTransactionsResponse({ limit: 20 });

    expect(result.data).toHaveLength(20);
    expect(result.pagination.hasNextPage).toBe(true);
    expect(result.pagination.nextCursor).not.toBeNull();
  });

  it('second page uses cursor and returns remaining items', async () => {
    const lastRow = makeRow({ id: 'tx-21' });
    mockPrisma.transaction.count.mockResolvedValue(21);
    mockPrisma.transaction.findMany.mockResolvedValue([lastRow]);

    const cursor = Buffer.from('tx-20').toString('base64url');
    const result = await buildTransactionsResponse({ limit: 20, cursor });

    expect(result.data).toHaveLength(1);
    expect(result.pagination.hasNextPage).toBe(false);
    expect(result.pagination.nextCursor).toBeNull();
    // Prisma should have been called with cursor + skip:1
    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'tx-20' }, skip: 1 }),
    );
  });

  it('filters by type=deposit via Prisma where clause', async () => {
    mockPrisma.transaction.count.mockResolvedValue(1);
    mockPrisma.transaction.findMany.mockResolvedValue([makeRow({ type: 'deposit' })]);

    await buildTransactionsResponse({ type: 'deposit' });

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: 'deposit' }) }),
    );
  });

  it('filters by walletAddress via Prisma where clause', async () => {
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    await buildTransactionsResponse({ walletAddress: 'GABC1234' });

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ user: 'GABC1234' }) }),
    );
  });

  it('maps DB row fields correctly to Transaction interface', async () => {
    const ts = new Date('2026-06-01T10:00:00.000Z');
    const row = makeRow({
      id: 'uuid-abc',
      user: 'GWALLET123',
      amount: '500',
      type: 'withdrawal',
      status: 'pending',
      timestamp: ts,
    });
    mockPrisma.transaction.count.mockResolvedValue(1);
    mockPrisma.transaction.findMany.mockResolvedValue([row]);

    const result = await buildTransactionsResponse({});
    const tx = result.data[0];

    expect(tx.id).toBe('uuid-abc');
    expect(tx.walletAddress).toBe('GWALLET123');
    expect(tx.amount).toBe('500');
    expect(tx.type).toBe('withdrawal');
    expect(tx.status).toBe('pending');
    expect(tx.timestamp).toBe(ts.toISOString());
    expect(tx.asset).toBe('USDC');
  });

  it('returns total from Prisma count', async () => {
    mockPrisma.transaction.count.mockResolvedValue(42);
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    const result = await buildTransactionsResponse({});

    expect(result.pagination.total).toBe(42);
  });
});
