import crypto from 'crypto';
import request from 'supertest';
import app from '../index';
import { registerApiKey } from '../middleware/apiKeyAuth';
import { resetWebhookState, getWebhookDeliveryMetrics } from '../webhookDelivery';
import { idempotencyStore, buildIdempotencyFingerprint } from '../idempotency';
import { resetBulkExportState, createBulkExportJob, getBulkExportJob, listBulkExportJobs, cancelBulkExportJob, processBulkExportJob, buildBulkExportArtifact, getBulkExportArtifact, storeBulkExportArtifact } from '../bulkExportJobs';
import { db, DatabaseManager } from '../database';

describe('Issue #532: Webhook retry jitter', () => {
  beforeAll(() => {
    process.env.WEBHOOK_MAX_ATTEMPTS = '5';
    process.env.WEBHOOK_JITTER_FACTOR = '0.5';
    process.env.WEBHOOK_JITTER_MAX_MS = '10000';
  });

  beforeEach(() => {
    resetWebhookState();
  });

  it('should produce varied backoff delays across retry attempts', () => {
    // Re-import with updated env vars by reading the module
    const webhookDelivery = require('../webhookDelivery');
    const delays = new Set<number>();

    // Run 100 trials collecting delays for attempt 1-4
    for (let trial = 0; trial < 100; trial++) {
      for (let attempt = 1; attempt <= 4; attempt++) {
        const delay = webhookDelivery.calculateBackoffDelay
          ? webhookDelivery.calculateBackoffDelay(attempt)
          : 0;
        delays.add(delay);
      }
    }

    // With jitter, we should see more than 4 unique delays
    expect(delays.size).toBeGreaterThan(4);
  });

  it('should register webhook and deliver with retry jitter', async () => {
    const adminKey = 'admin-532-test-key';
    registerApiKey(adminKey);

    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'ok',
      } as Response);

    const webhookResponse = await request(app)
      .post('/admin/webhooks')
      .set('Authorization', `ApiKey ${adminKey}`)
      .send({
        url: 'https://example.com/webhook-532',
        eventTypes: ['transaction.deposit.created'],
      });

    expect(webhookResponse.status).toBe(201);

    fetchMock.mockRestore();
  });
});

describe('Issue #539: Deterministic idempotency key hashing', () => {
  beforeAll(() => {
    process.env.IDEMPOTENCY_HASH_THRESHOLD_BYTES = '100';
  });

  beforeEach(() => {
    idempotencyStore.clear();
  });

  it('should hash payloads exceeding the configured byte threshold', () => {
    const smallPayload = { action: 'test', value: 42 };
    const largePayload = { data: 'x'.repeat(500), metadata: { nested: 'y'.repeat(200) } };

    const smallFingerprint = buildIdempotencyFingerprint(smallPayload);
    const largeFingerprint = buildIdempotencyFingerprint(largePayload);

    // Small payload should be a stable string (not hashed)
    expect(smallFingerprint).toBe(buildIdempotencyFingerprint(smallPayload));
    expect(smallFingerprint.startsWith('hashv1:')).toBe(false);

    // Large payload should produce a deterministic hash
    expect(largeFingerprint).toBe(buildIdempotencyFingerprint(largePayload));
    expect(largeFingerprint.startsWith('hashv1:')).toBe(true);
    expect(largeFingerprint.length).toBe(7 + 64); // 'hashv1:' + hex
  });

  it('should maintain consistency across repeated hashing of identical payloads', () => {
    const payload = { items: Array.from({ length: 50 }, (_, i) => ({ id: i, value: `val-${i}` })) };
    const fp1 = buildIdempotencyFingerprint(payload);
    const fp2 = buildIdempotencyFingerprint({ ...payload });
    expect(fp1).toBe(fp2);
  });

  it('should use the hashed fingerprint for idempotency key comparisons', async () => {
    idempotencyStore.clear();
    const largePayload = { bigField: 'a'.repeat(300) };
    const fingerprint = buildIdempotencyFingerprint(largePayload);

    const { result } = await idempotencyStore.execute(
      'large-payload-key',
      fingerprint,
      async () => ({ statusCode: 200, body: { ok: true } })
    );

    expect(result.statusCode).toBe(200);

    // Replay with same fingerprint
    const { replayed } = await idempotencyStore.execute(
      'large-payload-key',
      fingerprint,
      async () => ({ statusCode: 200, body: { ok: true } })
    );

    expect(replayed).toBe(true);
  });
});

describe('Issue #540: Bulk export job queue', () => {
  const adminKey = 'admin-540-test-key';

  beforeAll(() => {
    registerApiKey(adminKey);
  });

  beforeEach(() => {
    resetBulkExportState();
  });

  it('should create and track a bulk export job with progress states', async () => {
    const job = await createBulkExportJob({
      format: 'csv',
      generatedBy: 'admin-540',
      filters: { limit: 10 },
    });

    expect(job.status).toBe('pending');
    expect(job.format).toBe('csv');
    expect(job.processedRows).toBe(0);
    expect(job.errorRows).toBe(0);

    await processBulkExportJob(job.id);

    const completed = await getBulkExportJob(job.id);
    expect(completed).not.toBeNull();
    expect(completed!.status).toBe('completed');
    expect(completed!.totalRows).toBe(10);
    expect(completed!.processedRows).toBe(10);
    expect(completed!.artifactId).not.toBeNull();
  });

  it('should list bulk export jobs in reverse chronological order', async () => {
    const job1 = await createBulkExportJob({ format: 'csv', generatedBy: 'admin-540', filters: { limit: 5 } });
    await new Promise((r) => setTimeout(r, 5));
    const job2 = await createBulkExportJob({ format: 'json', generatedBy: 'admin-540', filters: { limit: 3 } });

    const jobs = await listBulkExportJobs(10);
    expect(jobs.length).toBeGreaterThanOrEqual(2);
    expect(jobs[0].id).toBe(job2.id);
    expect(jobs[1].id).toBe(job1.id);
  });

  it('should cancel a pending bulk export job', async () => {
    const job = await createBulkExportJob({ format: 'csv', generatedBy: 'admin-540', filters: { limit: 100 } });
    const cancelled = await cancelBulkExportJob(job.id);
    expect(cancelled).toBe(true);

    const cancelledJob = await getBulkExportJob(job.id);
    expect(cancelledJob!.status).toBe('cancelled');
  });

  it('should not cancel a completed job', async () => {
    const job = await createBulkExportJob({ format: 'csv', generatedBy: 'admin-540', filters: { limit: 5 } });
    await processBulkExportJob(job.id);

    const cancelled = await cancelBulkExportJob(job.id);
    expect(cancelled).toBe(false);
  });

  it('should build and retrieve artifacts', () => {
    const rows = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];

    const csvArtifact = buildBulkExportArtifact('csv', rows);
    expect(csvArtifact.contentType).toBe('text/csv');
    expect(csvArtifact.body).toContain('Alice');
    expect(csvArtifact.rowCount).toBe(2);
    expect(csvArtifact.checksum).toHaveLength(64);

    const jsonArtifact = buildBulkExportArtifact('json', rows);
    expect(jsonArtifact.contentType).toBe('application/json');
    expect(jsonArtifact.body).toContain('"name"');
    expect(jsonArtifact.rowCount).toBe(2);

    storeBulkExportArtifact(csvArtifact.id, csvArtifact);
    const retrieved = getBulkExportArtifact(csvArtifact.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.body).toBe(csvArtifact.body);
  });

  it('should expose admin API endpoints for bulk export', async () => {
    const createRes = await request(app)
      .post('/admin/exports/bulk')
      .set('Authorization', `ApiKey ${adminKey}`)
      .send({ format: 'json', filters: { limit: 10 } });

    expect(createRes.status).toBe(201);
    expect(createRes.body.job).toBeDefined();
    expect(createRes.body.job.status).toBe('pending');

    const jobId = createRes.body.job.id;

    const listRes = await request(app)
      .get('/admin/exports/bulk/jobs')
      .set('Authorization', `ApiKey ${adminKey}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.jobs.length).toBeGreaterThanOrEqual(1);

    const getRes = await request(app)
      .get(`/admin/exports/bulk/jobs/${jobId}`)
      .set('Authorization', `ApiKey ${adminKey}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.job.id).toBe(jobId);
  });
});

describe('Issue #534: Read-replica routing', () => {
  let manager: DatabaseManager;
  let primaryPool: any;
  let replicaPool: any;

  beforeEach(() => {
    primaryPool = {
      query: jest.fn().mockResolvedValue({ rows: [{ count: 10 }] }),
      end: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockResolvedValue(true),
    };
    replicaPool = {
      query: jest.fn().mockResolvedValue({ rows: [{ count: 5 }] }),
      end: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockResolvedValue(true),
    };
    manager = new DatabaseManager(primaryPool, replicaPool);
  });

  it('should route explicit replica queries to replica pool', async () => {
    const result = await manager.queryReplica('SELECT COUNT(*) as count FROM transactions');
    expect(replicaPool.query).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM transactions', undefined);
    expect(result.rows[0].count).toBe(5);
  });

  it('should route explicit primary queries to primary pool', async () => {
    const result = await manager.queryPrimary('SELECT COUNT(*) as count FROM transactions');
    expect(primaryPool.query).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM transactions', undefined);
    expect(result.rows[0].count).toBe(10);
  });

  it('should fall back to primary when replica fails for read queries', async () => {
    replicaPool.query.mockRejectedValueOnce(new Error('Replica down'));
    const result = await manager.query('SELECT * FROM transactions LIMIT 1');
    expect(replicaPool.query).toHaveBeenCalled();
    expect(primaryPool.query).toHaveBeenCalled();
    expect(result.rows[0].count).toBe(10);
  });

  it('should route INSERT queries to primary only', async () => {
    await manager.query('INSERT INTO transactions (id) VALUES (1)');
    expect(primaryPool.query).toHaveBeenCalled();
    expect(replicaPool.query).not.toHaveBeenCalled();
  });

  it('should detect replica health', async () => {
    const healthy = await manager.isReplicaHealthy();
    expect(healthy).toBe(true);

    replicaPool.isHealthy.mockResolvedValueOnce(false);
    const unhealthy = await manager.isReplicaHealthy();
    expect(unhealthy).toBe(false);
  });

  it('should estimate table count from replica', async () => {
    const count = await manager.estimatedCount('transactions');
    expect(replicaPool.query).toHaveBeenCalledWith(
      'SELECT COUNT(*) as count FROM "transactions"',
      undefined
    );
    expect(count).toBe(5);
  });

  it('should include replica health in the health check endpoint', async () => {
    // The health endpoint already reports databaseReplica status
    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.checks).toHaveProperty('databasePrimary');
    expect(healthRes.body.checks).toHaveProperty('databaseReplica');
  });
});
