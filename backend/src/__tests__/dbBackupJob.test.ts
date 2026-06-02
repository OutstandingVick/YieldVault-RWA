/**
 * Tests for the daily database backup job (Issue #376).
 */

import { EventEmitter, PassThrough } from 'stream';

// ─── Mock child_process ───────────────────────────────────────────────────────

const mockSpawn = jest.fn();
jest.mock('child_process', () => ({ spawn: mockSpawn }));

// ─── Mock @aws-sdk/client-s3 ─────────────────────────────────────────────────

const mockS3Send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    ListObjectsV2Command: jest.fn().mockImplementation((input) => ({ input })),
    DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

// ─── Mock emailService ────────────────────────────────────────────────────────

const mockSendEmail = jest.fn().mockResolvedValue(true);
jest.mock('../emailService', () => ({
  emailService: { sendEmail: mockSendEmail },
}));

// ─── Mock logger ─────────────────────────────────────────────────────────────

jest.mock('../middleware/structuredLogging', () => ({
  logger: { log: jest.fn() },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Builds a fake child_process object that writes `data` to stdout then exits. */
function makeFakeChild(data: string, exitCode: number = 0) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const child = new EventEmitter() as any;
  child.stdout = stdout;
  child.stderr = stderr;

  setImmediate(() => {
    stdout.write(Buffer.from(data));
    stdout.end();
    child.emit('close', exitCode);
  });

  return child;
}

// ─── Import SUT after mocks are in place ─────────────────────────────────────

import {
  dumpDatabase,
  uploadBackup,
  pruneOldBackups,
  sendBackupFailureAlert,
  runDbBackupJob,
  startDbBackupScheduler,
} from '../dbBackupJob';

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/yieldvault';
  process.env.BACKUP_S3_BUCKET = 'yieldvault-backups';
  process.env.BACKUP_S3_REGION = 'us-east-1';
  delete process.env.BACKUP_S3_ENDPOINT;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.BACKUP_SLACK_WEBHOOK_URL;
  delete process.env.BACKUP_ALERT_EMAIL;
  delete process.env.BACKUP_RETENTION_DAYS;
  delete process.env.BACKUP_ENABLED;
});

// ─── dumpDatabase() ───────────────────────────────────────────────────────────

describe('dumpDatabase()', () => {
  it('returns a gzip-compressed Buffer when pg_dump succeeds', async () => {
    mockSpawn.mockReturnValue(makeFakeChild('-- SQL dump content --'));
    const result = await dumpDatabase();
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('passes --dbname and DATABASE_URL to pg_dump', async () => {
    mockSpawn.mockReturnValue(makeFakeChild(''));
    await dumpDatabase();
    expect(mockSpawn).toHaveBeenCalledWith(
      'pg_dump',
      ['--dbname', 'postgresql://user:pass@localhost:5432/yieldvault'],
      expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }),
    );
  });

  it('rejects when pg_dump exits with non-zero code', async () => {
    mockSpawn.mockReturnValue(makeFakeChild('', 1));
    await expect(dumpDatabase()).rejects.toThrow('pg_dump exited with code 1');
  });

  it('rejects when DATABASE_URL is not set', async () => {
    delete process.env.DATABASE_URL;
    await expect(dumpDatabase()).rejects.toThrow('DATABASE_URL is not set');
  });

  it('rejects when the child process emits an error event', async () => {
    const child = makeFakeChild('');
    mockSpawn.mockReturnValue(child);
    setImmediate(() => child.emit('error', new Error('spawn ENOENT')));
    await expect(dumpDatabase()).rejects.toThrow('spawn ENOENT');
  });
});

// ─── uploadBackup() ───────────────────────────────────────────────────────────

describe('uploadBackup()', () => {
  it('calls S3Client.send with PutObjectCommand', async () => {
    mockS3Send.mockResolvedValue({});
    const body = Buffer.from('compressed-data');
    await uploadBackup('backups/2025-01-01/2025-01-01T02-00-00-000Z.sql.gz', body);
    expect(mockS3Send).toHaveBeenCalledTimes(1);
    const [cmd] = mockS3Send.mock.calls[0];
    expect(cmd.input.Bucket).toBe('yieldvault-backups');
    expect(cmd.input.Key).toBe('backups/2025-01-01/2025-01-01T02-00-00-000Z.sql.gz');
    expect(cmd.input.Body).toBe(body);
    expect(cmd.input.ContentType).toBe('application/gzip');
  });

  it('rejects when BACKUP_S3_BUCKET is not set', async () => {
    delete process.env.BACKUP_S3_BUCKET;
    await expect(uploadBackup('key', Buffer.from(''))).rejects.toThrow('BACKUP_S3_BUCKET is not set');
  });

  it('propagates S3 send errors', async () => {
    mockS3Send.mockRejectedValue(new Error('NoSuchBucket'));
    await expect(uploadBackup('key', Buffer.from('data'))).rejects.toThrow('NoSuchBucket');
  });
});

// ─── pruneOldBackups() ────────────────────────────────────────────────────────

describe('pruneOldBackups()', () => {
  it('deletes objects older than retention days', async () => {
    const oldDate = new Date();
    oldDate.setUTCDate(oldDate.getUTCDate() - 31);

    const recentDate = new Date();
    recentDate.setUTCDate(recentDate.getUTCDate() - 5);

    mockS3Send.mockImplementation((cmd: any) => {
      if (cmd.input.ContinuationToken !== undefined || cmd.input.Prefix) {
        return Promise.resolve({
          Contents: [
            { Key: 'backups/old.sql.gz', LastModified: oldDate },
            { Key: 'backups/recent.sql.gz', LastModified: recentDate },
          ],
          NextContinuationToken: undefined,
        });
      }
      return Promise.resolve({});
    });

    const deleted = await pruneOldBackups();
    expect(deleted).toBe(1);

    const deleteCalls = mockS3Send.mock.calls.filter(
      ([cmd]: any[]) => cmd.input.Key !== undefined && cmd.input.Prefix === undefined,
    );
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0][0].input.Key).toBe('backups/old.sql.gz');
  });

  it('respects custom BACKUP_RETENTION_DAYS', async () => {
    process.env.BACKUP_RETENTION_DAYS = '7';

    const eightDaysAgo = new Date();
    eightDaysAgo.setUTCDate(eightDaysAgo.getUTCDate() - 8);

    const sixDaysAgo = new Date();
    sixDaysAgo.setUTCDate(sixDaysAgo.getUTCDate() - 6);

    mockS3Send.mockImplementation((cmd: any) => {
      if (cmd.input.Prefix !== undefined) {
        return Promise.resolve({
          Contents: [
            { Key: 'backups/old.sql.gz', LastModified: eightDaysAgo },
            { Key: 'backups/recent.sql.gz', LastModified: sixDaysAgo },
          ],
        });
      }
      return Promise.resolve({});
    });

    const deleted = await pruneOldBackups();
    expect(deleted).toBe(1);
  });

  it('returns 0 when there are no objects to prune', async () => {
    mockS3Send.mockResolvedValue({ Contents: [], NextContinuationToken: undefined });
    const deleted = await pruneOldBackups();
    expect(deleted).toBe(0);
  });

  it('handles S3 pagination via NextContinuationToken', async () => {
    const oldDate = new Date();
    oldDate.setUTCDate(oldDate.getUTCDate() - 35);

    let calls = 0;
    mockS3Send.mockImplementation((cmd: any) => {
      if (cmd.input.Prefix !== undefined) {
        calls += 1;
        if (calls === 1) {
          return Promise.resolve({
            Contents: [{ Key: 'backups/old-1.sql.gz', LastModified: oldDate }],
            NextContinuationToken: 'page2',
          });
        }
        return Promise.resolve({
          Contents: [{ Key: 'backups/old-2.sql.gz', LastModified: oldDate }],
          NextContinuationToken: undefined,
        });
      }
      return Promise.resolve({});
    });

    const deleted = await pruneOldBackups();
    expect(deleted).toBe(2);
  });

  it('rejects when BACKUP_S3_BUCKET is not set', async () => {
    delete process.env.BACKUP_S3_BUCKET;
    await expect(pruneOldBackups()).rejects.toThrow('BACKUP_S3_BUCKET is not set');
  });
});

// ─── sendBackupFailureAlert() ─────────────────────────────────────────────────

describe('sendBackupFailureAlert()', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('POSTs to BACKUP_SLACK_WEBHOOK_URL when set', async () => {
    process.env.BACKUP_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await sendBackupFailureAlert(new Error('disk full'));

    expect(global.fetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.text).toContain('disk full');
  });

  it('sends an email when BACKUP_ALERT_EMAIL is set', async () => {
    process.env.BACKUP_ALERT_EMAIL = 'ops@yieldvault.finance';

    await sendBackupFailureAlert(new Error('upload timeout'));

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ops@yieldvault.finance',
        subject: expect.stringContaining('Backup Failed'),
      }),
    );
    expect(mockSendEmail.mock.calls[0][0].text).toContain('upload timeout');
  });

  it('sends both Slack and email when both are configured', async () => {
    process.env.BACKUP_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.BACKUP_ALERT_EMAIL = 'ops@yieldvault.finance';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await sendBackupFailureAlert(new Error('s3 error'));

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it('does not throw when neither Slack nor email is configured', async () => {
    await expect(sendBackupFailureAlert(new Error('fail'))).resolves.not.toThrow();
  });

  it('does not throw when the Slack POST fails', async () => {
    process.env.BACKUP_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network error'));

    await expect(sendBackupFailureAlert(new Error('backup failed'))).resolves.not.toThrow();
  });
});

// ─── runDbBackupJob() ─────────────────────────────────────────────────────────

describe('runDbBackupJob()', () => {
  it('returns a BackupResult with key, sizeBytes, and deletedCount', async () => {
    mockSpawn.mockReturnValue(makeFakeChild('-- SQL content --'));
    mockS3Send.mockResolvedValue({ Contents: [], NextContinuationToken: undefined });

    const result = await runDbBackupJob();

    expect(result).toMatchObject({
      key: expect.stringMatching(/^backups\/\d{4}-\d{2}-\d{2}\/.+\.sql\.gz$/),
      sizeBytes: expect.any(Number),
      deletedCount: 0,
    });
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it('uploads to S3 and reports deleted count', async () => {
    const oldDate = new Date();
    oldDate.setUTCDate(oldDate.getUTCDate() - 35);

    mockSpawn.mockReturnValue(makeFakeChild('SELECT 1;'));
    mockS3Send.mockImplementation((cmd: any) => {
      if (cmd.input.Prefix !== undefined) {
        return Promise.resolve({
          Contents: [{ Key: 'backups/very-old.sql.gz', LastModified: oldDate }],
        });
      }
      return Promise.resolve({});
    });

    const result = await runDbBackupJob();
    expect(result.deletedCount).toBe(1);

    // PutObject + ListObjectsV2 + DeleteObject = 3 calls
    expect(mockS3Send).toHaveBeenCalledTimes(3);
  });

  it('throws when pg_dump fails', async () => {
    mockSpawn.mockReturnValue(makeFakeChild('', 1));
    await expect(runDbBackupJob()).rejects.toThrow('pg_dump exited with code 1');
  });

  it('includes date-stamped path in the S3 key', async () => {
    mockSpawn.mockReturnValue(makeFakeChild('data'));
    mockS3Send.mockResolvedValue({ Contents: [] });

    const result = await runDbBackupJob();
    const today = new Date().toISOString().slice(0, 10);
    expect(result.key).toContain(today);
    expect(result.key).toMatch(/\.sql\.gz$/);
  });
});

// ─── startDbBackupScheduler() ────────────────────────────────────────────────

describe('startDbBackupScheduler()', () => {
  it('returns a cancel function that clears the timer', () => {
    const stop = startDbBackupScheduler();
    expect(typeof stop).toBe('function');
    stop();
  });

  it('returns a no-op when BACKUP_ENABLED=false', () => {
    process.env.BACKUP_ENABLED = 'false';
    const stop = startDbBackupScheduler();
    expect(typeof stop).toBe('function');
    // Calling stop() on a disabled scheduler should not throw.
    expect(() => stop()).not.toThrow();
  });
});
