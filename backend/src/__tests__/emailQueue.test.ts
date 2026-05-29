import request from 'supertest';
import app from '../index';
import { getPrismaClient, disconnectPrismaClient } from '../prismaClient';
import { emailQueueService } from '../emailQueue';
import { emailService } from '../emailService';
import { registerApiKey } from '../middleware/apiKeyAuth';

const prisma = getPrismaClient();

describe('Email Queue & Outbound Retries Integration', () => {
  const adminKey = 'email-queue-test-admin-key';
  const authHeader = { Authorization: `ApiKey ${adminKey}` };
  let sendEmailDirectlySpy: jest.SpyInstance;

  beforeAll(async () => {
    registerApiKey(adminKey);
    // Clear queue before runs
    await prisma.emailQueue.deleteMany();
  });

  beforeEach(() => {
    sendEmailDirectlySpy = jest.spyOn(emailService, 'sendEmailDirectly');
  });

  afterEach(async () => {
    sendEmailDirectlySpy.mockRestore();
    await prisma.emailQueue.deleteMany();
  });

  afterAll(async () => {
    await disconnectPrismaClient();
  });

  it('enqueues an email asynchronously from a mock request handler or via emailService.sendEmail', async () => {
    sendEmailDirectlySpy.mockResolvedValue(true);

    const result = await emailService.sendEmail({
      to: 'test@example.com',
      subject: 'Welcome to YieldVault',
      text: 'Hello!',
      html: '<p>Hello!</p>',
    });

    expect(result).toBe(true);

    // Verify it is in the database queue with status 'pending'
    const queueItems = await prisma.emailQueue.findMany();
    expect(queueItems).toHaveLength(1);
    expect(queueItems[0].to).toBe('test@example.com');
    expect(queueItems[0].status).toBe('pending');
    expect(queueItems[0].retryCount).toBe(0);
  });

  it('processes pending emails and updates status to completed on success', async () => {
    sendEmailDirectlySpy.mockResolvedValue(true);

    await emailQueueService.enqueueEmail({
      to: 'completed@example.com',
      subject: 'Transaction Confirmed',
      text: 'Confirmed',
      html: '<p>Confirmed</p>',
    });

    await emailQueueService.processQueue();

    const email = await prisma.emailQueue.findFirst({
      where: { to: 'completed@example.com' },
    });
    expect(email?.status).toBe('completed');
    expect(sendEmailDirectlySpy).toHaveBeenCalledTimes(1);
  });

  it('implements retry policy with exponential backoff and moves to failed status on transient errors', async () => {
    // Mock the direct send function to throw error (simulate provider down)
    sendEmailDirectlySpy.mockRejectedValue(new Error('Rate limit exceeded'));

    const email = await emailQueueService.enqueueEmail({
      to: 'failed@example.com',
      subject: 'Transient failure',
      text: 'Retry me',
      html: '<p>Retry me</p>',
    });

    // Run first processing attempt
    await emailQueueService.processQueue();

    const updatedEmail = await prisma.emailQueue.findUniqueOrThrow({
      where: { id: email.id },
    });

    expect(updatedEmail.status).toBe('failed');
    expect(updatedEmail.retryCount).toBe(1);
    expect(updatedEmail.lastError).toBe('Rate limit exceeded');
    expect(updatedEmail.nextRetryAt).not.toBeNull();

    // Verify exponential backoff date
    const expectedDelay = 1000 * Math.pow(2, 1); // 2000 ms
    const nextRetryAtTime = updatedEmail.nextRetryAt ? updatedEmail.nextRetryAt.getTime() : 0;
    const diff = nextRetryAtTime - Date.now();
    expect(diff).toBeGreaterThan(0);
    expect(diff).toBeLessThanOrEqual(expectedDelay + 1000);
  });

  it('moves exhausted jobs to dead-letter state with error reason when maxRetries is reached', async () => {
    sendEmailDirectlySpy.mockRejectedValue(new Error('Auth failed permanently'));

    // Create an email that is already at maxRetries - 1 (retryCount = 4, maxRetries = 5)
    const email = await prisma.emailQueue.create({
      data: {
        to: 'deadletter@example.com',
        subject: 'Exhausted',
        text: 'Final attempt',
        html: '<p>Final attempt</p>',
        status: 'failed',
        retryCount: 4,
        maxRetries: 5,
      },
    });

    await emailQueueService.processQueue();

    const updatedEmail = await prisma.emailQueue.findUniqueOrThrow({
      where: { id: email.id },
    });

    expect(updatedEmail.status).toBe('dead-letter');
    expect(updatedEmail.retryCount).toBe(5);
    expect(updatedEmail.lastError).toBe('Auth failed permanently');
  });

  it('provides admin endpoints to inspect the queue (filtered by status) and replay failed jobs', async () => {
    sendEmailDirectlySpy.mockResolvedValue(true);

    // Seed 2 emails: 1 completed, 1 dead-letter
    await prisma.emailQueue.create({
      data: {
        to: 'completed-admin@example.com',
        subject: 'Completed',
        text: 'Clean',
        html: '<p>Clean</p>',
        status: 'completed',
      },
    });

    const deadLetterEmail = await prisma.emailQueue.create({
      data: {
        to: 'deadletter-admin@example.com',
        subject: 'Dead',
        text: 'Dead',
        html: '<p>Dead</p>',
        status: 'dead-letter',
        lastError: 'Permanent failure',
      },
    });

    // 1. Test GET /admin/emails/queue without filter
    const inspectAllResponse = await request(app)
      .get('/admin/emails/queue')
      .set(authHeader);

    expect(inspectAllResponse.status).toBe(200);
    expect(inspectAllResponse.body.count).toBe(2);

    // 2. Test GET /admin/emails/queue with status=dead-letter filter
    const inspectDeadResponse = await request(app)
      .get('/admin/emails/queue?status=dead-letter')
      .set(authHeader);

    expect(inspectDeadResponse.status).toBe(200);
    expect(inspectDeadResponse.body.count).toBe(1);
    expect(inspectDeadResponse.body.emails[0].to).toBe('deadletter-admin@example.com');

    // 3. Test POST /admin/emails/replay/:id to replay the dead-letter email
    const replayResponse = await request(app)
      .post(`/admin/emails/replay/${deadLetterEmail.id}`)
      .set(authHeader);

    expect(replayResponse.status).toBe(200);
    expect(replayResponse.body.message).toBe('Email requeued successfully');
    expect(replayResponse.body.email.status).toBe('pending');
    expect(replayResponse.body.email.retryCount).toBe(0);
    expect(replayResponse.body.email.lastError).toBeNull();

    // Verify in DB
    const replayedInDb = await prisma.emailQueue.findUniqueOrThrow({
      where: { id: deadLetterEmail.id },
    });
    expect(replayedInDb.status).toBe('pending');
  });
});
