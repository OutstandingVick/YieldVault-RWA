import {
  exportGovernanceSnapshots,
  listGovernanceSnapshots,
} from '../governanceSnapshotExport';

jest.mock('../prismaClient', () => ({
  getPrismaClient: () => ({
    reconciliationSnapshot: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'rec-1',
          generatedAt: new Date('2026-01-01T00:00:00Z'),
          traceId: 'trace-1',
          status: 'CLEAN',
          windowFrom: new Date('2025-12-31T00:00:00Z'),
          windowTo: new Date('2026-01-01T00:00:00Z'),
          summaryJson: JSON.stringify({ counts: { drifted: 0 } }),
          driftCount: 0,
        },
      ]),
    },
    exportManifest: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  }),
}));

jest.mock('../adminConfigChangeAudit', () => ({
  listAdminConfigChanges: jest.fn().mockResolvedValue([
    {
      id: 'cfg-1',
      configType: 'feature-flag',
      action: 'update',
      actor: 'admin@test',
      preChangeSnapshot: { enabled: false },
      postChangeSnapshot: { enabled: true },
      metadata: {},
      createdAt: '2026-01-02T00:00:00Z',
    },
  ]),
}));

jest.mock('../exportManifest', () => ({
  createExportManifest: jest.fn().mockResolvedValue({
    id: 'exp-test',
    reportType: 'governance-snapshots',
    checksum: 'abc',
    rowCount: 2,
  }),
}));

jest.mock('../middleware/structuredLogging', () => ({
  logger: { log: jest.fn(), configure: jest.fn() },
}));

describe('governanceSnapshotExport', () => {
  it('lists reconciliation and config-change snapshots', async () => {
    const result = await listGovernanceSnapshots({ limit: 10 });

    expect(result.total).toBeGreaterThanOrEqual(2);
    expect(result.data.some((row) => row.type === 'reconciliation')).toBe(true);
    expect(result.data.some((row) => row.type === 'config-change')).toBe(true);
  });

  it('exports governance snapshots with manifest', async () => {
    const result = await exportGovernanceSnapshots({
      requester: 'admin@test',
      types: ['reconciliation', 'config-change'],
      limit: 10,
    });

    expect(result.rows.length).toBeGreaterThanOrEqual(2);
    expect(result.manifest.reportType).toBe('governance-snapshots');
  });
});
