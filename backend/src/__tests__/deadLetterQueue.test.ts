import request from 'supertest';
import app from '../index';
import {
  jobGovernanceStore,
  runJobWithRetry,
  registerJobHandler,
  listDeadLetters,
  getDeadLetterRecord,
  retryDeadLetter,
  resolveDeadLetter,
  discardDeadLetter,
  bulkRetryDeadLetters,
  bulkDiscardDeadLetters,
  processDeadLetterQueue,
  resetJobGovernance,
  type DeadLetterRecord,
} from '../jobGovernance';
import { registerApiKey } from '../middleware/apiKeyAuth';

describe('Dead-Letter Queue (DLQ) Processing', () => {
  const adminApiKey = 'admin-dlq-test-key';
  const sleep = async () => undefined;

  beforeEach(() => {
    resetJobGovernance();
    registerApiKey(adminApiKey);
  });

  describe('Core Job Governance DLQ Logic', () => {
    it('auto-generates id and default dead-letter status when recording', () => {
      const record = jobGovernanceStore.recordDeadLetter({
        jobName: 'priceRefresh',
        attempts: 3,
        error: 'Network timeout',
        payload: { asset: 'USDC' },
        failedAt: new Date().toISOString(),
      });

      expect(record.id).toBeDefined();
      expect(record.id).toMatch(/^dlq_/);
      expect(record.status).toBe('dead-letter');

      const stored = getDeadLetterRecord(record.id!);
      expect(stored).toEqual(record);
    });

    it('lists and filters dead letters by jobName and status with pagination', () => {
      jobGovernanceStore.recordDeadLetter({
        id: 'dlq-1',
        jobName: 'priceRefresh',
        attempts: 3,
        error: 'Error 1',
        payload: null,
        failedAt: new Date().toISOString(),
        status: 'dead-letter',
      });

      jobGovernanceStore.recordDeadLetter({
        id: 'dlq-2',
        jobName: 'apySnapshot',
        attempts: 3,
        error: 'Error 2',
        payload: null,
        failedAt: new Date().toISOString(),
        status: 'resolved',
      });

      jobGovernanceStore.recordDeadLetter({
        id: 'dlq-3',
        jobName: 'priceRefresh',
        attempts: 3,
        error: 'Error 3',
        payload: null,
        failedAt: new Date().toISOString(),
        status: 'dead-letter',
      });

      const all = listDeadLetters();
      expect(all.total).toBe(3);

      const priceRefreshOnly = listDeadLetters({ jobName: 'priceRefresh' });
      expect(priceRefreshOnly.total).toBe(2);

      const deadLetterOnly = listDeadLetters({ status: 'dead-letter' });
      expect(deadLetterOnly.total).toBe(2);

      const paginated = listDeadLetters({ limit: 1, offset: 1 });
      expect(paginated.records.length).toBe(1);
      expect(paginated.total).toBe(3);
    });

    it('retries dead letter using registered job handler', async () => {
      let executedPayload: unknown = null;
      registerJobHandler('priceRefresh', async (payload: unknown) => {
        executedPayload = payload;
        return { refreshed: true };
      });

      const record = jobGovernanceStore.recordDeadLetter({
        id: 'dlq-retry-1',
        jobName: 'priceRefresh',
        attempts: 3,
        error: 'Temporary error',
        payload: { pair: 'XLM/USD' },
        failedAt: new Date().toISOString(),
      });

      const outcome = await retryDeadLetter(record.id!);
      expect(outcome.success).toBe(true);
      expect(outcome.result).toEqual({ refreshed: true });
      expect(executedPayload).toEqual({ pair: 'XLM/USD' });

      const updated = getDeadLetterRecord(record.id!);
      expect(updated?.status).toBe('requeued');
      expect(updated?.retriedAt).toBeDefined();
    });

    it('returns error when retrying without a registered handler or custom task', async () => {
      const record = jobGovernanceStore.recordDeadLetter({
        id: 'dlq-unhandled-1',
        jobName: 'reportGeneration',
        attempts: 2,
        error: 'Generation failure',
        payload: null,
        failedAt: new Date().toISOString(),
      });

      const outcome = await retryDeadLetter(record.id!);
      expect(outcome.success).toBe(false);
      expect(outcome.error).toContain("No registered handler or custom task for job type 'reportGeneration'");
    });

    it('resolves and discards dead letter records', () => {
      const rec1 = jobGovernanceStore.recordDeadLetter({
        id: 'dlq-res-1',
        jobName: 'databaseBackup',
        attempts: 3,
        error: 'S3 error',
        payload: null,
        failedAt: new Date().toISOString(),
      });

      const resolved = resolveDeadLetter(rec1.id!, 'admin-user', 'Fixed S3 bucket permissions');
      expect(resolved?.status).toBe('resolved');
      expect(resolved?.resolvedBy).toBe('admin-user');
      expect(resolved?.notes).toBe('Fixed S3 bucket permissions');

      const rec2 = jobGovernanceStore.recordDeadLetter({
        id: 'dlq-disc-1',
        jobName: 'databaseBackup',
        attempts: 3,
        error: 'Disk full',
        payload: null,
        failedAt: new Date().toISOString(),
      });

      const discarded = discardDeadLetter(rec2.id!);
      expect(discarded?.status).toBe('discarded');
      expect(getDeadLetterRecord(rec2.id!)).toBeNull();
    });

    it('handles bulk retry and bulk discard operations', async () => {
      registerJobHandler('apySnapshot', async () => ({ snapshot: true }));

      const r1 = jobGovernanceStore.recordDeadLetter({
        id: 'dlq-bulk-1',
        jobName: 'apySnapshot',
        attempts: 3,
        error: 'Err 1',
        payload: null,
        failedAt: new Date().toISOString(),
      });

      const r2 = jobGovernanceStore.recordDeadLetter({
        id: 'dlq-bulk-2',
        jobName: 'apySnapshot',
        attempts: 3,
        error: 'Err 2',
        payload: null,
        failedAt: new Date().toISOString(),
      });

      const bulkRetryRes = await bulkRetryDeadLetters([r1.id!, r2.id!, 'invalid-id']);
      expect(bulkRetryRes.retried).toBe(2);
      expect(bulkRetryRes.failed).toBe(1);

      const r3 = jobGovernanceStore.recordDeadLetter({
        id: 'dlq-bulk-3',
        jobName: 'databaseBackup',
        attempts: 3,
        error: 'Err 3',
        payload: null,
        failedAt: new Date().toISOString(),
      });

      const bulkDiscardRes = bulkDiscardDeadLetters([r3.id!, 'non-existent']);
      expect(bulkDiscardRes.discarded).toBe(1);
      expect(bulkDiscardRes.ids).toEqual([r3.id!]);
    });

    it('processes pending dead letter queue in batch via processDeadLetterQueue worker', async () => {
      let count = 0;
      registerJobHandler('positionReconciliation', async () => {
        count += 1;
        return { ok: true };
      });

      jobGovernanceStore.recordDeadLetter({
        id: 'dlq-batch-1',
        jobName: 'positionReconciliation',
        attempts: 2,
        error: 'Drift error 1',
        payload: null,
        failedAt: new Date().toISOString(),
      });

      jobGovernanceStore.recordDeadLetter({
        id: 'dlq-batch-2',
        jobName: 'positionReconciliation',
        attempts: 2,
        error: 'Drift error 2',
        payload: null,
        failedAt: new Date().toISOString(),
      });

      const result = await processDeadLetterQueue(5);
      expect(result.processed).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(count).toBe(2);
    });
  });

  describe('Admin REST API Endpoints for DLQ Management', () => {
    it('requires API key authentication for DLQ routes', async () => {
      const response = await request(app).get('/admin/jobs/dead-letters');
      expect(response.status).toBe(401);
    });

    it('GET /admin/jobs/dead-letters returns list of records with filters', async () => {
      jobGovernanceStore.recordDeadLetter({
        id: 'dlq-api-1',
        jobName: 'priceRefresh',
        attempts: 3,
        error: 'API failure',
        payload: { coin: 'BTC' },
        failedAt: new Date().toISOString(),
      });

      const response = await request(app)
        .get('/admin/jobs/dead-letters')
        .set('Authorization', `ApiKey ${adminApiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(1);
      expect(response.body.data[0].id).toBe('dlq-api-1');
    });

    it('GET /admin/jobs/dead-letters/:id returns single record or 404', async () => {
      jobGovernanceStore.recordDeadLetter({
        id: 'dlq-api-2',
        jobName: 'databaseBackup',
        attempts: 3,
        error: 'API backup error',
        payload: null,
        failedAt: new Date().toISOString(),
      });

      const notFound = await request(app)
        .get('/admin/jobs/dead-letters/non-existent')
        .set('Authorization', `ApiKey ${adminApiKey}`);
      expect(notFound.status).toBe(404);

      const found = await request(app)
        .get('/admin/jobs/dead-letters/dlq-api-2')
        .set('Authorization', `ApiKey ${adminApiKey}`);
      expect(found.status).toBe(200);
      expect(found.body.record.id).toBe('dlq-api-2');
    });

    it('POST /admin/jobs/dead-letters/:id/retry handles retry and dryRun preview', async () => {
      registerJobHandler('priceRefresh', async () => ({ refreshed: true }));

      jobGovernanceStore.recordDeadLetter({
        id: 'dlq-api-3',
        jobName: 'priceRefresh',
        attempts: 3,
        error: 'API error',
        payload: null,
        failedAt: new Date().toISOString(),
      });

      const dryRun = await request(app)
        .post('/admin/jobs/dead-letters/dlq-api-3/retry?dryRun=true')
        .set('Authorization', `ApiKey ${adminApiKey}`);

      expect(dryRun.status).toBe(200);
      expect(dryRun.body.dryRun).toBe(true);
      expect(dryRun.body.wouldRetry).toBe(true);

      const response = await request(app)
        .post('/admin/jobs/dead-letters/dlq-api-3/retry')
        .set('Authorization', `ApiKey ${adminApiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toMatch(/retried successfully/i);
      expect(response.body.record.status).toBe('requeued');
    });

    it('POST /admin/jobs/dead-letters/:id/resolve marks record as resolved with notes', async () => {
      jobGovernanceStore.recordDeadLetter({
        id: 'dlq-api-4',
        jobName: 'apySnapshot',
        attempts: 3,
        error: 'API snapshot err',
        payload: null,
        failedAt: new Date().toISOString(),
      });

      const response = await request(app)
        .post('/admin/jobs/dead-letters/dlq-api-4/resolve')
        .set('Authorization', `ApiKey ${adminApiKey}`)
        .send({ notes: 'Manually verified APY history' });

      expect(response.status).toBe(200);
      expect(response.body.record.status).toBe('resolved');
      expect(response.body.record.notes).toBe('Manually verified APY history');
    });

    it('DELETE /admin/jobs/dead-letters/:id discards record with dryRun support', async () => {
      jobGovernanceStore.recordDeadLetter({
        id: 'dlq-api-5',
        jobName: 'reportGeneration',
        attempts: 2,
        error: 'Report err',
        payload: null,
        failedAt: new Date().toISOString(),
      });

      const dryRun = await request(app)
        .delete('/admin/jobs/dead-letters/dlq-api-5?dryRun=true')
        .set('Authorization', `ApiKey ${adminApiKey}`);

      expect(dryRun.status).toBe(200);
      expect(dryRun.body.dryRun).toBe(true);
      expect(dryRun.body.wouldDiscard).toBe(true);

      const response = await request(app)
        .delete('/admin/jobs/dead-letters/dlq-api-5')
        .set('Authorization', `ApiKey ${adminApiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.record.status).toBe('discarded');
    });

    it('POST /admin/jobs/dead-letters/bulk-retry and bulk-discard', async () => {
      registerJobHandler('priceRefresh', async () => ({ ok: true }));

      const r1 = jobGovernanceStore.recordDeadLetter({
        id: 'dlq-api-bulk-1',
        jobName: 'priceRefresh',
        attempts: 3,
        error: 'Err 1',
        payload: null,
        failedAt: new Date().toISOString(),
      });

      const r2 = jobGovernanceStore.recordDeadLetter({
        id: 'dlq-api-bulk-2',
        jobName: 'priceRefresh',
        attempts: 3,
        error: 'Err 2',
        payload: null,
        failedAt: new Date().toISOString(),
      });

      const retryRes = await request(app)
        .post('/admin/jobs/dead-letters/bulk-retry')
        .set('Authorization', `ApiKey ${adminApiKey}`)
        .send({ ids: [r1.id, r2.id] });

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.retried).toBe(2);

      const r3 = jobGovernanceStore.recordDeadLetter({
        id: 'dlq-api-bulk-3',
        jobName: 'databaseBackup',
        attempts: 3,
        error: 'Err 3',
        payload: null,
        failedAt: new Date().toISOString(),
      });

      const discardRes = await request(app)
        .post('/admin/jobs/dead-letters/bulk-discard')
        .set('Authorization', `ApiKey ${adminApiKey}`)
        .send({ ids: [r3.id] });

      expect(discardRes.status).toBe(200);
      expect(discardRes.body.discardedCount).toBe(1);
    });

    it('POST /admin/jobs/dead-letters/process triggers batch processing', async () => {
      registerJobHandler('positionReconciliation', async () => ({ processed: true }));

      jobGovernanceStore.recordDeadLetter({
        id: 'dlq-api-proc-1',
        jobName: 'positionReconciliation',
        attempts: 2,
        error: 'Err',
        payload: null,
        failedAt: new Date().toISOString(),
      });

      const response = await request(app)
        .post('/admin/jobs/dead-letters/process')
        .set('Authorization', `ApiKey ${adminApiKey}`)
        .send({ batchSize: 5 });

      expect(response.status).toBe(200);
      expect(response.body.processed).toBe(1);
      expect(response.body.succeeded).toBe(1);
    });
  });
});
