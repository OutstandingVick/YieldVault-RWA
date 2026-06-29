import crypto from 'crypto';
import {
  createExportManifest,
  verifyExportManifestChecksum,
  listExportManifests,
  pruneExportManifests,
  resetExportManifestsForTests,
} from '../exportManifest';

jest.mock('../prismaClient', () => ({
  getPrismaClient: () => ({
    exportManifest: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  }),
}));

jest.mock('../middleware/structuredLogging', () => ({
  logger: { log: jest.fn(), configure: jest.fn() },
}));

describe('exportManifest persistence', () => {
  beforeEach(() => {
    resetExportManifestsForTests();
    process.env.EXPORT_MANIFEST_STORAGE = 'memory';
  });

  it('creates a manifest with deterministic checksum', async () => {
    const manifest = await createExportManifest({
      requester: 'admin@test',
      reportType: 'transactions',
      filters: { status: 'completed' },
      rows: [{ id: '1', amount: '10' }],
    });

    expect(manifest.id).toMatch(/^exp-/);
    expect(manifest.checksum).toHaveLength(64);
    expect(manifest.rowCount).toBe(1);
  });

  it('verifies checksum match and mismatch without exposing rows', async () => {
    const manifest = await createExportManifest({
      requester: 'admin@test',
      reportType: 'transactions',
      filters: {},
      rows: [{ id: '1' }],
    });

    const match = await verifyExportManifestChecksum(manifest.id, manifest.checksum);
    expect(match.match).toBe(true);
    expect(match.manifest?.rowCount).toBe(1);
    expect((match.manifest as any).rows).toBeUndefined();

    const mismatch = await verifyExportManifestChecksum(manifest.id, crypto.randomBytes(32).toString('hex'));
    expect(mismatch.match).toBe(false);
  });

  it('lists manifests with pagination from memory store', async () => {
    await createExportManifest({
      requester: 'a',
      reportType: 'transactions',
      filters: {},
      rows: [{ id: '1' }],
    });
    await createExportManifest({
      requester: 'b',
      reportType: 'transactions',
      filters: {},
      rows: [{ id: '2' }],
    });

    const page = await listExportManifests(1, 0);
    expect(page.total).toBe(2);
    expect(page.data).toHaveLength(1);
  });

  it('prunes manifests beyond retention limit', async () => {
    process.env.EXPORT_MANIFEST_RETENTION = '2';

    for (let i = 0; i < 4; i += 1) {
      await createExportManifest({
        requester: 'admin',
        reportType: 'transactions',
        filters: { i },
        rows: [{ id: String(i) }],
      });
    }

    const pruned = await pruneExportManifests();
    expect(pruned).toBeGreaterThan(0);

    const remaining = await listExportManifests(10, 0);
    expect(remaining.total).toBeLessThanOrEqual(2);
  });
});
