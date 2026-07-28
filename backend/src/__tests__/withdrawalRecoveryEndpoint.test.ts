// src/__tests__/withdrawalRecoveryEndpoint.test.ts
/**
 * End-to-end behaviour of the withdrawal endpoint and the recovery admin
 * surface when a ledger write fails after the on-chain submission (Issue #954).
 *
 * Prisma is mocked so the failure can be injected at an exact step boundary.
 */

const upsertTransaction = jest.fn();
const updateTransaction = jest.fn();
const vaultStateTransaction = jest.fn();

jest.mock('../prismaClient', () => ({
  getPrismaClient: () => ({
    transaction: {
      upsert: (...args: unknown[]) => upsertTransaction(...args),
      update: (...args: unknown[]) => updateTransaction(...args),
      create: jest.fn().mockResolvedValue({ id: 'row-deposit' }),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => vaultStateTransaction(fn),
  }),
  disconnectPrismaClient: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../prisma', () => ({
  prisma: {
    transaction: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'row-1' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(0),
    },
    $disconnect: jest.fn().mockResolvedValue(undefined),
  },
  getPrismaRuntimeConfig: () => ({}),
}));

import request from 'supertest';
import app from '../index';
import { withdrawalRecoveryCoordinator } from '../withdrawalRecovery';
import { idempotencyStore } from '../idempotency';
import { registerApiKey } from '../middleware/apiKeyAuth';
import { clearWithdrawalLimitStateForTests } from '../middleware/withdrawalDailyLimit';

/* eslint-disable @typescript-eslint/no-var-requires */
const sorobanMock = require('./mocks/sorobanClient.js');

const ADMIN_KEY = 'withdrawal-recovery-admin-key';
const WALLET = `G${'B'.repeat(55)}`;

/** Transient DB failure: retryable, so the coordinator schedules recovery. */
function dbOutage(): Error & { code: string } {
  return Object.assign(new Error('connection refused by database'), { code: 'ECONNREFUSED' });
}

async function postWithdrawal(idempotencyKey: string) {
  return request(app)
    .post('/api/v1/vault/withdrawals')
    .set('Idempotency-Key', idempotencyKey)
    .send({ amount: 50, asset: 'USDC', walletAddress: WALLET });
}

describe('withdrawal endpoint partial-failure recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    withdrawalRecoveryCoordinator.reset();
    idempotencyStore.clear();
    clearWithdrawalLimitStateForTests();
    registerApiKey(ADMIN_KEY);
    process.env.ALLOWLIST_ENABLED = 'false';
    delete process.env.WITHDRAWAL_DAILY_LIMIT_USDC;

    sorobanMock.submitVaultOperation.mockResolvedValue('mock-soroban-tx-hash-abcd1234');
    vaultStateTransaction.mockResolvedValue(undefined);
    upsertTransaction.mockResolvedValue({ id: 'row-withdrawal' });
  });

  afterAll(() => {
    withdrawalRecoveryCoordinator.reset();
  });

  it('acknowledges with 202 and a recovery handle when the ledger write fails', async () => {
    upsertTransaction.mockRejectedValueOnce(dbOutage());

    const response = await postWithdrawal('idem-partial-1');

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      type: 'withdrawal',
      status: 'recovering',
      // The on-chain leg succeeded, so the client is told the hash rather than
      // being told (falsely) that nothing happened.
      transactionHash: 'mock-soroban-tx-hash-abcd1234',
    });
    expect(response.body.recovery).toMatchObject({
      status: 'awaiting_retry',
      automatedRetryScheduled: true,
      failedStep: 'persist_transaction',
    });
    expect(response.body.recovery.steps).toEqual([
      { name: 'chain_submit', status: 'completed' },
      { name: 'persist_transaction', status: 'failed' },
      { name: 'vault_state_update', status: 'pending' },
    ]);
    expect(vaultStateTransaction).not.toHaveBeenCalled();
  });

  it('completes the withdrawal on the next recovery pass without re-submitting on chain', async () => {
    upsertTransaction.mockRejectedValueOnce(dbOutage());

    const accepted = await postWithdrawal('idem-partial-2');
    const sagaId = accepted.body.recovery.sagaId;
    expect(sorobanMock.submitVaultOperation).toHaveBeenCalledTimes(1);

    const resumed = await request(app)
      .post(`/admin/withdrawals/recovery/${sagaId}/resume`)
      .set('Authorization', `ApiKey ${ADMIN_KEY}`)
      .send({});

    expect(resumed.status).toBe(200);
    expect(resumed.body).toMatchObject({ status: 'completed', completed: true, partial: false });
    expect(resumed.body.saga.steps.map((s: { status: string }) => s.status)).toEqual([
      'completed',
      'completed',
      'completed',
    ]);

    // The irreversible step ran exactly once across both passes.
    expect(sorobanMock.submitVaultOperation).toHaveBeenCalledTimes(1);
    expect(resumed.body.saga.steps[0].attempts).toBe(1);
    expect(upsertTransaction).toHaveBeenCalledTimes(2);
    expect(vaultStateTransaction).toHaveBeenCalledTimes(1);
  });

  it('parks the saga for an operator once retries are exhausted', async () => {
    upsertTransaction.mockRejectedValue(dbOutage());

    const accepted = await postWithdrawal('idem-partial-3');
    const sagaId = accepted.body.recovery.sagaId;

    // Burn the remaining attempts (default 3 per reversible step).
    await withdrawalRecoveryCoordinator.resume(sagaId);
    await withdrawalRecoveryCoordinator.resume(sagaId);

    const detail = await request(app)
      .get(`/admin/withdrawals/recovery/${sagaId}`)
      .set('Authorization', `ApiKey ${ADMIN_KEY}`);

    expect(detail.status).toBe(200);
    expect(detail.body.saga.status).toBe('needs_manual_intervention');
    expect(detail.body.saga.requiresManualIntervention).toBe(true);
    expect(detail.body.saga.state.txHash).toBe('mock-soroban-tx-hash-abcd1234');

    const queue = await request(app)
      .get('/admin/withdrawals/recovery?requiresManualIntervention=true')
      .set('Authorization', `ApiKey ${ADMIN_KEY}`);

    expect(queue.status).toBe(200);
    expect(queue.body.count).toBe(1);
    expect(queue.body.sagas[0].id).toBe(sagaId);
    expect(queue.body.metrics.byStatus.needs_manual_intervention).toBe(1);
  });

  it('rolls the withdrawal back when the failure precedes any irreversible step', async () => {
    sorobanMock.submitVaultOperation.mockRejectedValueOnce(
      new sorobanMock.SorobanSimulationError(
        'simulation failed: insufficient balance',
        'INSUFFICIENT_BALANCE',
        422,
      ),
    );

    const response = await postWithdrawal('idem-rollback-1');

    // Nothing durable happened, so the original failure is re-thrown and the
    // existing error mapping still applies.
    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    expect(upsertTransaction).not.toHaveBeenCalled();

    const sagas = await request(app)
      .get('/admin/withdrawals/recovery')
      .set('Authorization', `ApiKey ${ADMIN_KEY}`);

    expect(sagas.body.sagas[0]).toMatchObject({
      status: 'failed',
      requiresManualIntervention: false,
    });
  });

  it('does not re-submit on chain when a client retries a recovering withdrawal', async () => {
    upsertTransaction.mockRejectedValueOnce(dbOutage());

    const first = await postWithdrawal('idem-retry-1');
    expect(first.status).toBe(202);

    // Same Idempotency-Key: replayed by the idempotency store, and even if it
    // reached the coordinator the journalled saga would be reused.
    const second = await postWithdrawal('idem-retry-1');

    expect(second.status).toBe(202);
    expect(sorobanMock.submitVaultOperation).toHaveBeenCalledTimes(1);
    expect(withdrawalRecoveryCoordinator.list({ withdrawalId: 'idem-retry-1' })).toHaveLength(1);
  });

  it('drives due sagas to completion from the sweep endpoint', async () => {
    upsertTransaction.mockRejectedValueOnce(dbOutage());
    const accepted = await postWithdrawal('idem-sweep-1');
    const sagaId = accepted.body.recovery.sagaId;

    // Make the saga due without waiting out the real backoff.
    const saga = withdrawalRecoveryCoordinator.get(sagaId)!;
    saga.nextAttemptAt = new Date(Date.now() - 1).toISOString();

    const sweep = await request(app)
      .post('/admin/withdrawals/recovery/sweep')
      .set('Authorization', `ApiKey ${ADMIN_KEY}`)
      .send({});

    expect(sweep.status).toBe(200);
    expect(sweep.body.resumed).toEqual([sagaId]);
    expect(withdrawalRecoveryCoordinator.get(sagaId)?.status).toBe('completed');
  });

  describe('admin surface', () => {
    it('requires an admin API key', async () => {
      const response = await request(app).get('/admin/withdrawals/recovery');
      expect(response.status).toBe(401);
    });

    it('404s for an unknown saga', async () => {
      const response = await request(app)
        .get('/admin/withdrawals/recovery/wsaga_missing')
        .set('Authorization', `ApiKey ${ADMIN_KEY}`);
      expect(response.status).toBe(404);
    });

    it('exposes aggregate metrics', async () => {
      const response = await request(app)
        .get('/admin/withdrawals/recovery/metrics')
        .set('Authorization', `ApiKey ${ADMIN_KEY}`);

      expect(response.status).toBe(200);
      expect(response.body.metrics).toMatchObject({
        total: expect.any(Number),
        requiresManualIntervention: expect.any(Number),
      });
    });

    it('requires a note to resolve a saga and records the operator', async () => {
      upsertTransaction.mockRejectedValue(dbOutage());
      const accepted = await postWithdrawal('idem-resolve-1');
      const sagaId = accepted.body.recovery.sagaId;

      const missingNote = await request(app)
        .post(`/admin/withdrawals/recovery/${sagaId}/resolve`)
        .set('Authorization', `ApiKey ${ADMIN_KEY}`)
        .send({});
      expect(missingNote.status).toBe(400);

      const badOutcome = await request(app)
        .post(`/admin/withdrawals/recovery/${sagaId}/resolve`)
        .set('Authorization', `ApiKey ${ADMIN_KEY}`)
        .send({ note: 'reconciled', outcome: 'sideways' });
      expect(badOutcome.status).toBe(400);

      const resolved = await request(app)
        .post(`/admin/withdrawals/recovery/${sagaId}/resolve`)
        .set('Authorization', `ApiKey ${ADMIN_KEY}`)
        .set('x-admin-id', `G${'D'.repeat(55)}`)
        .send({ note: 'ledger row inserted manually', outcome: 'completed' });

      expect(resolved.status).toBe(200);
      expect(resolved.body.saga).toMatchObject({
        status: 'completed',
        requiresManualIntervention: false,
      });
      expect(resolved.body.saga.manualResolution).toMatchObject({
        note: 'ledger row inserted manually',
        outcome: 'completed',
      });
    });
  });
});
