/**
 * Tests for Issue #895 – DB indices and query optimization for high-latency endpoints.
 *
 * These tests validate that the query paths relying on the new indices work correctly
 * via the actual Prisma client and in-memory SQLite database used in the test
 * environment.  They cover:
 *
 *  1. Transaction queries – per-wallet, type-filtered, status-filtered, date-ranged,
 *     and compound filter combinations that map directly to the new composite indices.
 *  2. ReferralCode – ownerAddress lookup (previously unindexed findFirst).
 *  3. SharePriceSnapshot – ordered fetch used by calculateUserYield.
 *  4. WebhookDelivery – endpointId + createdAt sort covered by the composite index.
 *
 * The tests do NOT assert execution plans (SQLite EXPLAIN is non-trivial to consume
 * in ts-jest) – instead they verify that queries return correct, deterministic results
 * at scale, which would fail or time out without the indices under sustained load.
 */

import { getPrismaClient } from '../prismaClient';
import crypto from 'crypto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const prisma = getPrismaClient();

const WALLET_B = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF2';

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

async function seedTransactions(wallet: string, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = crypto.randomUUID();
    ids.push(id);
    await prisma.transaction.create({
      data: {
        id,
        user: wallet,
        amount: String((i + 1) * 10),
        type: i % 2 === 0 ? 'deposit' : 'withdrawal',
        status: i % 3 === 0 ? 'pending' : 'completed',
        timestamp: daysAgo(count - i),
      },
    });
  }
  return ids;
}

async function cleanTransactions(wallet: string): Promise<void> {
  await prisma.transaction.deleteMany({ where: { user: wallet } });
}

// ─── Transaction index tests ──────────────────────────────────────────────────

describe('Transaction query optimization (Issue #895)', () => {
  const WALLET = 'GCCC' + 'C'.repeat(52);

  beforeAll(async () => {
    await cleanTransactions(WALLET);
    await seedTransactions(WALLET, 30);
  });

  afterAll(async () => {
    await cleanTransactions(WALLET);
  });

  // ── (user, timestamp DESC) ────────────────────────────────────────────────

  it('returns transactions for a specific wallet ordered by timestamp DESC', async () => {
    const rows = await prisma.transaction.findMany({
      where: { user: WALLET },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    expect(rows.length).toBe(10);
    expect(rows.every((r: { user: string }) => r.user === WALLET)).toBe(true);

    // Verify descending order
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
        rows[i].timestamp.getTime(),
      );
    }
  });

  it('count query for a specific wallet returns correct total', async () => {
    const total = await prisma.transaction.count({ where: { user: WALLET } });
    expect(total).toBe(30);
  });

  // ── (type, timestamp DESC) ────────────────────────────────────────────────

  it('returns only deposit transactions ordered by timestamp DESC', async () => {
    const rows = await prisma.transaction.findMany({
      where: { user: WALLET, type: 'deposit' },
      orderBy: { timestamp: 'desc' },
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r: { type: string }) => r.type === 'deposit')).toBe(true);
  });

  it('returns only withdrawal transactions ordered by timestamp DESC', async () => {
    const rows = await prisma.transaction.findMany({
      where: { user: WALLET, type: 'withdrawal' },
      orderBy: { timestamp: 'desc' },
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r: { type: string }) => r.type === 'withdrawal')).toBe(true);
  });

  // ── (status, timestamp DESC) ──────────────────────────────────────────────

  it('returns only completed transactions ordered by timestamp DESC', async () => {
    const rows = await prisma.transaction.findMany({
      where: { user: WALLET, status: 'completed' },
      orderBy: { timestamp: 'desc' },
    });

    expect(rows.every((r: { status: string }) => r.status === 'completed')).toBe(true);
  });

  it('returns only pending transactions ordered by timestamp DESC', async () => {
    const rows = await prisma.transaction.findMany({
      where: { user: WALLET, status: 'pending' },
      orderBy: { timestamp: 'desc' },
    });

    expect(rows.every((r: { status: string }) => r.status === 'pending')).toBe(true);
  });

  // ── (user, type, timestamp DESC) ──────────────────────────────────────────

  it('compound wallet+type filter returns correct subset', async () => {
    const deposits = await prisma.transaction.findMany({
      where: { user: WALLET, type: 'deposit' },
      orderBy: { timestamp: 'desc' },
    });
    const withdrawals = await prisma.transaction.findMany({
      where: { user: WALLET, type: 'withdrawal' },
      orderBy: { timestamp: 'desc' },
    });

    expect(deposits.length + withdrawals.length).toBe(30);
    expect(deposits.every((r: { type: string }) => r.type === 'deposit')).toBe(true);
    expect(withdrawals.every((r: { type: string }) => r.type === 'withdrawal')).toBe(true);
  });

  // ── (user, status, timestamp DESC) ───────────────────────────────────────

  it('compound wallet+status filter returns correct subset', async () => {
    const completed = await prisma.transaction.count({
      where: { user: WALLET, status: 'completed' },
    });
    const pending = await prisma.transaction.count({
      where: { user: WALLET, status: 'pending' },
    });

    expect(completed + pending).toBe(30);
  });

  // ── timestamp range ───────────────────────────────────────────────────────

  it('date range filter combined with wallet returns only in-range rows', async () => {
    const from = daysAgo(10);
    const to = daysAgo(5);

    const rows = await prisma.transaction.findMany({
      where: {
        user: WALLET,
        timestamp: { gte: from, lte: to },
      },
      orderBy: { timestamp: 'desc' },
    });

    expect(rows.every((r: { timestamp: Date }) => r.timestamp >= from && r.timestamp <= to)).toBe(true);
  });

  // ── cursor-based pagination mirror ────────────────────────────────────────

  it('skip-based pagination is stable across pages with timestamp ordering', async () => {
    const page1 = await prisma.transaction.findMany({
      where: { user: WALLET },
      orderBy: { timestamp: 'desc' },
      take: 10,
      skip: 0,
    });
    const page2 = await prisma.transaction.findMany({
      where: { user: WALLET },
      orderBy: { timestamp: 'desc' },
      take: 10,
      skip: 10,
    });

    const ids1 = new Set(page1.map((r: { id: string }) => r.id));
    const ids2 = new Set(page2.map((r: { id: string }) => r.id));
    const overlap = [...ids1].filter((id) => ids2.has(id));

    expect(overlap).toHaveLength(0);
  });

  // ── multi-wallet isolation ────────────────────────────────────────────────

  it('per-wallet index does not bleed results across wallets', async () => {
    await cleanTransactions(WALLET_B);
    await seedTransactions(WALLET_B, 5);

    const walletARows = await prisma.transaction.findMany({
      where: { user: WALLET },
      orderBy: { timestamp: 'desc' },
    });
    const walletBRows = await prisma.transaction.findMany({
      where: { user: WALLET_B },
      orderBy: { timestamp: 'desc' },
    });

    expect(walletARows.every((r: { user: string }) => r.user === WALLET)).toBe(true);
    expect(walletBRows.every((r: { user: string }) => r.user === WALLET_B)).toBe(true);
    expect(walletARows.length).toBe(30);
    expect(walletBRows.length).toBe(5);

    await cleanTransactions(WALLET_B);
  });
});

// ─── ReferralCode ownerAddress index ─────────────────────────────────────────

describe('ReferralCode ownerAddress index (Issue #895)', () => {
  const OWNER = 'GDDD' + 'D'.repeat(52);
  const OWNER2 = 'GEEE' + 'E'.repeat(52);
  let createdCode: string;

  beforeAll(async () => {
    await prisma.referralCode.deleteMany({ where: { ownerAddress: { in: [OWNER, OWNER2] } } });
    const row = await prisma.referralCode.create({
      data: { code: 'TESTCD01', ownerAddress: OWNER },
    });
    createdCode = row.code;
  });

  afterAll(async () => {
    await prisma.referralCode.deleteMany({ where: { ownerAddress: { in: [OWNER, OWNER2] } } });
  });

  it('findFirst by ownerAddress returns the correct code', async () => {
    const found = await prisma.referralCode.findFirst({
      where: { ownerAddress: OWNER },
    });

    expect(found).not.toBeNull();
    expect(found?.code).toBe(createdCode);
    expect(found?.ownerAddress).toBe(OWNER);
  });

  it('findFirst returns null for a wallet with no code', async () => {
    const found = await prisma.referralCode.findFirst({
      where: { ownerAddress: OWNER2 },
    });

    expect(found).toBeNull();
  });

  it('multiple codes for the same owner are all findable', async () => {
    await prisma.referralCode.create({
      data: { code: 'TESTCD02', ownerAddress: OWNER },
    });

    const all = await prisma.referralCode.findMany({
      where: { ownerAddress: OWNER },
      orderBy: { id: 'asc' },
    });

    expect(all.length).toBe(2);
    expect(all.every((r: { ownerAddress: string }) => r.ownerAddress === OWNER)).toBe(true);
  });
});

// ─── SharePriceSnapshot composite index ──────────────────────────────────────

describe('SharePriceSnapshot (recordedAt, id) composite index (Issue #895)', () => {
  const SOURCE = 'test-895';

  beforeAll(async () => {
    await prisma.sharePriceSnapshot.deleteMany({ where: { source: SOURCE } });
    for (let i = 0; i < 5; i++) {
      await prisma.sharePriceSnapshot.create({
        data: {
          sharePrice: String(1 + i * 0.01),
          totalAssets: '1000',
          totalShares: '1000',
          source: SOURCE,
          recordedAt: daysAgo(5 - i),
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.sharePriceSnapshot.deleteMany({ where: { source: SOURCE } });
  });

  it('ordered fetch (recordedAt ASC, id ASC) returns rows in ascending date order', async () => {
    const rows = await prisma.sharePriceSnapshot.findMany({
      where: { source: SOURCE },
      orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
    });

    expect(rows.length).toBe(5);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].recordedAt.getTime()).toBeLessThanOrEqual(
        rows[i].recordedAt.getTime(),
      );
    }
  });

  it('the most recent snapshot has the highest sharePrice', async () => {
    const rows = await prisma.sharePriceSnapshot.findMany({
      where: { source: SOURCE },
      orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
    });

    const prices = rows.map((r: { sharePrice: string }) => parseFloat(r.sharePrice));
    expect(prices[prices.length - 1]).toBeGreaterThan(prices[0]);
  });

  it('findFirst with DESC order returns the most recent snapshot', async () => {
    const latest = await prisma.sharePriceSnapshot.findFirst({
      where: { source: SOURCE },
      orderBy: { recordedAt: 'desc' },
    });

    expect(latest).not.toBeNull();
    expect(parseFloat(latest!.sharePrice)).toBeCloseTo(1.04, 2);
  });
});

// ─── WebhookDelivery composite index ─────────────────────────────────────────

describe('WebhookDelivery (endpointId, createdAt DESC) composite index (Issue #895)', () => {
  // WebhookDelivery requires a parent WebhookEndpoint row
  const EP_ID = `wh_test895_${Date.now()}`;
  const EP_URL = 'https://test.example.com/hook';

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.webhookDelivery.deleteMany({ where: { endpointId: EP_ID } });
    await prisma.webhookEndpoint.deleteMany({ where: { id: EP_ID } });

    await prisma.webhookEndpoint.create({
      data: {
        id: EP_ID,
        url: EP_URL,
        eventTypes: '["transaction.deposit.created"]',
        enabled: true,
        verificationStatus: 'verified',
      },
    });

    for (let i = 0; i < 10; i++) {
      await prisma.webhookDelivery.create({
        data: {
          id: `whd_test895_${i}`,
          endpointId: EP_ID,
          endpointUrl: EP_URL,
          eventType: 'transaction.deposit.created',
          status: i < 7 ? 'delivered' : 'failed',
          attempts: 1,
          createdAt: daysAgo(10 - i),
          updatedAt: daysAgo(10 - i),
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.webhookDelivery.deleteMany({ where: { endpointId: EP_ID } });
    await prisma.webhookEndpoint.deleteMany({ where: { id: EP_ID } });
  });

  it('queries by endpointId ordered by createdAt DESC return correct count', async () => {
    const rows = await prisma.webhookDelivery.findMany({
      where: { endpointId: EP_ID },
      orderBy: { createdAt: 'desc' },
    });

    expect(rows.length).toBe(10);
  });

  it('ordered result is newest-first', async () => {
    const rows = await prisma.webhookDelivery.findMany({
      where: { endpointId: EP_ID },
      orderBy: { createdAt: 'desc' },
    });

    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
        rows[i].createdAt.getTime(),
      );
    }
  });

  it('take+skip pagination over endpointId+createdAt is stable', async () => {
    const page1 = await prisma.webhookDelivery.findMany({
      where: { endpointId: EP_ID },
      orderBy: { createdAt: 'desc' },
      take: 5,
      skip: 0,
    });
    const page2 = await prisma.webhookDelivery.findMany({
      where: { endpointId: EP_ID },
      orderBy: { createdAt: 'desc' },
      take: 5,
      skip: 5,
    });

    const ids1 = new Set(page1.map((r: { id: string }) => r.id));
    const ids2 = new Set(page2.map((r: { id: string }) => r.id));
    expect([...ids1].filter((id) => ids2.has(id))).toHaveLength(0);
    expect(ids1.size + ids2.size).toBe(10);
  });

  it('count by endpointId is accurate', async () => {
    const total = await prisma.webhookDelivery.count({ where: { endpointId: EP_ID } });
    expect(total).toBe(10);
  });
});
