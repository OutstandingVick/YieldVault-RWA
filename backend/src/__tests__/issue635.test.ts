import request from 'supertest';
import app from '../index';
import { idempotencyStore } from '../idempotency';
import {
  getMaintenanceModeState,
  resetMaintenanceModeState,
  updateMaintenanceModeState,
} from '../maintenanceMode';

const ADMIN_HEADER = { Authorization: 'ApiKey test-admin-key' };
const SUPER_ADMIN_HEADER = { Authorization: 'ApiKey super-admin-test-key' };

describe('Issue #635 - admin dry-run mode', () => {
  beforeEach(() => {
    resetMaintenanceModeState();
    idempotencyStore.clear();
  });

  afterEach(() => {
    resetMaintenanceModeState();
    idempotencyStore.clear();
  });

  it('previews maintenance changes without mutating runtime state', async () => {
    updateMaintenanceModeState({ enabled: false });

    const res = await request(app)
      .post('/admin/maintenance')
      .set(ADMIN_HEADER)
      .send({ enabled: true, reason: 'Preview only', dryRun: true });

    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.maintenance.enabled).toBe(true);
    expect(getMaintenanceModeState().enabled).toBe(false);
  });

  it('previews APY backfill without creating snapshots', async () => {
    const res = await request(app)
      .post('/admin/apy/backfill')
      .set(ADMIN_HEADER)
      .send({ start: '2026-01-01', end: '2026-01-03', dryRun: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      dryRun: true,
      estimatedDates: 3,
      wouldCreateSnapshots: true,
    });
  });

  it('previews idempotency store flush without deleting keys', async () => {
    await idempotencyStore.execute('dry-run-key', 'fingerprint', async () => ({
      statusCode: 200,
      body: { ok: true },
    }));

    const res = await request(app)
      .delete('/admin/idempotency/keys?dryRun=true')
      .set(SUPER_ADMIN_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.keyCount).toBe(1);
    expect(idempotencyStore.inspectKeys()).toHaveLength(1);
  });
});
