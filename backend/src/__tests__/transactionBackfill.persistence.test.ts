import {
  createOrResumeTransactionBackfill,
  getTransactionBackfillJob,
  resetTransactionBackfillJobsForTests,
  MAX_LEDGER_RANGE,
} from '../transactionBackfill';

const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpsert = jest.fn();
const mockBackfillFindMany = jest.fn();

jest.mock('../prismaClient', () => ({
  getPrismaClient: () => ({
    processedEvent: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      upsert: jest.fn(),
    },
    transactionBackfillJob: {
      findMany: (...args: unknown[]) => mockBackfillFindMany(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  }),
}));

jest.mock('../middleware/structuredLogging', () => ({
  logger: { log: jest.fn(), configure: jest.fn() },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('transactionBackfill persistence', () => {
  beforeEach(() => {
    resetTransactionBackfillJobsForTests();
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockBackfillFindMany.mockResolvedValue([]);
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockImplementation(async ({ data }: any) => data);
    mockUpsert.mockResolvedValue({});
    mockFetch.mockResolvedValue({
      json: async () => ({ result: { events: [] } }),
    });
  });

  const baseInput = {
    startLedger: 100,
    endLedger: 102,
    rpcUrl: 'https://rpc.test',
    contractId: 'CONTRACT',
    batchSize: 2,
    dryRun: false,
  };

  it('persists job on start and completes successfully', async () => {
    const job = await createOrResumeTransactionBackfill(baseInput);

    expect(job.status).toBe('completed');
    expect(mockUpsert).toHaveBeenCalled();
    expect(job.progress.scannedLedgers).toBe(3);
  });

  it('dry-run persists job without mutating processed events', async () => {
    const job = await createOrResumeTransactionBackfill({ ...baseInput, dryRun: true });

    expect(job.status).toBe('completed');
    expect(job.dryRun).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('resumes from persisted checkpoint after simulated restart', async () => {
    const first = await createOrResumeTransactionBackfill(baseInput);
    expect(first.status).toBe('completed');

    resetTransactionBackfillJobsForTests();

    mockBackfillFindMany.mockResolvedValueOnce([
      {
        id: first.id,
        jobKey: first.key,
        startLedger: first.startLedger,
        endLedger: first.endLedger,
        batchSize: first.batchSize,
        dryRun: first.dryRun,
        status: 'running',
        rpcUrl: baseInput.rpcUrl,
        contractId: baseInput.contractId,
        progressJson: JSON.stringify({
          ...first.progress,
          scannedLedgers: 1,
        }),
        errorMessage: null,
        createdAt: new Date(first.createdAt),
        updatedAt: new Date(first.updatedAt),
        lastProcessedLedger: 100,
      },
    ]);

    const resumed = await getTransactionBackfillJob(first.id);
    expect(resumed?.lastProcessedLedger).toBe(100);
    expect(resumed?.status).toBe('running');
  });

  it('rejects ledger ranges above MAX_LEDGER_RANGE', async () => {
    await expect(
      createOrResumeTransactionBackfill({
        ...baseInput,
        startLedger: 1,
        endLedger: MAX_LEDGER_RANGE + 1,
      }),
    ).rejects.toThrow(`ledger range exceeds maximum of ${MAX_LEDGER_RANGE}`);
  });

  it('marks job failed when RPC fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('rpc unavailable'));

    const job = await createOrResumeTransactionBackfill(baseInput);
    expect(job.status).toBe('failed');
    expect(job.error).toContain('rpc unavailable');
  });
});
