/**
 * Historical governance snapshot export for reporting (Issue #715).
 *
 * Aggregates persisted reconciliation snapshots, admin config changes, and
 * export manifests into a unified query/export surface for governance reporting.
 */

import { getPrismaClient } from './prismaClient';
import { listAdminConfigChanges } from './adminConfigChangeAudit';
import { createExportManifest } from './exportManifest';
import { logger } from './middleware/structuredLogging';

export type GovernanceSnapshotType = 'reconciliation' | 'config-change' | 'export-manifest';

export interface GovernanceSnapshotRecord {
  id: string;
  type: GovernanceSnapshotType;
  generatedAt: string;
  status?: string;
  summary: Record<string, unknown>;
}

export interface ListGovernanceSnapshotsFilters {
  type?: GovernanceSnapshotType;
  types?: GovernanceSnapshotType[];
  start?: string;
  end?: string;
  limit?: number;
  offset?: number;
}

export interface GovernanceSnapshotExportInput {
  requester: string;
  types?: GovernanceSnapshotType[];
  start?: string;
  end?: string;
  limit?: number;
}

function parseDateRange(start?: string, end?: string): { gte?: Date; lte?: Date } {
  const range: { gte?: Date; lte?: Date } = {};
  if (start) range.gte = new Date(start);
  if (end) range.lte = new Date(end);
  return range;
}

async function listReconciliationSnapshots(
  filters: ListGovernanceSnapshotsFilters,
): Promise<GovernanceSnapshotRecord[]> {
  try {
    const prisma = getPrismaClient();
    const generatedAt = parseDateRange(filters.start, filters.end);
    const where = Object.keys(generatedAt).length > 0 ? { generatedAt } : {};

    const rows = await prisma.reconciliationSnapshot.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      take: filters.limit ?? 100,
      skip: filters.offset ?? 0,
    });

    return rows.map((row) => {
      let summary: Record<string, unknown> = {};
      try {
        summary = JSON.parse(row.summaryJson) as Record<string, unknown>;
      } catch {
        summary = { driftCount: row.driftCount };
      }

      return {
        id: row.id,
        type: 'reconciliation' as const,
        generatedAt: row.generatedAt.toISOString(),
        status: row.status,
        summary: {
          windowFrom: row.windowFrom.toISOString(),
          windowTo: row.windowTo.toISOString(),
          driftCount: row.driftCount,
          traceId: row.traceId ?? undefined,
          ...summary,
        },
      };
    });
  } catch (error) {
    logger.log('warn', 'Failed to list reconciliation snapshots for governance export', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function listConfigChangeSnapshots(
  filters: ListGovernanceSnapshotsFilters,
): Promise<GovernanceSnapshotRecord[]> {
  const records = await listAdminConfigChanges({
    start: filters.start,
    end: filters.end,
    limit: filters.limit ?? 100,
  });

  return records.map((record) => ({
    id: record.id,
    type: 'config-change' as const,
    generatedAt: record.createdAt,
    status: record.action,
    summary: {
      configType: record.configType,
      actor: record.actor,
      preChangeSnapshot: record.preChangeSnapshot,
      postChangeSnapshot: record.postChangeSnapshot,
      metadata: record.metadata,
    },
  }));
}

async function listExportManifestSnapshots(
  filters: ListGovernanceSnapshotsFilters,
): Promise<GovernanceSnapshotRecord[]> {
  try {
    const prisma = getPrismaClient();
    const generatedAt = parseDateRange(filters.start, filters.end);
    const where = Object.keys(generatedAt).length > 0 ? { generatedAt } : {};

    const rows = await prisma.exportManifest.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      take: filters.limit ?? 100,
      skip: filters.offset ?? 0,
    });

    return rows.map((row) => ({
      id: row.id,
      type: 'export-manifest' as const,
      generatedAt: row.generatedAt.toISOString(),
      status: row.reportType,
      summary: {
        requester: row.requester,
        reportType: row.reportType,
        checksum: row.checksum,
        rowCount: row.rowCount,
        fileName: row.fileName,
      },
    }));
  } catch (error) {
    logger.log('warn', 'Failed to list export manifests for governance export', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function listGovernanceSnapshots(
  filters: ListGovernanceSnapshotsFilters = {},
): Promise<{ data: GovernanceSnapshotRecord[]; total: number }> {
  const types: GovernanceSnapshotType[] = filters.types
    ?? (filters.type ? [filters.type] : ['reconciliation', 'config-change', 'export-manifest']);

  const results: GovernanceSnapshotRecord[] = [];

  if (types.includes('reconciliation')) {
    results.push(...await listReconciliationSnapshots(filters));
  }
  if (types.includes('config-change')) {
    results.push(...await listConfigChangeSnapshots(filters));
  }
  if (types.includes('export-manifest')) {
    results.push(...await listExportManifestSnapshots(filters));
  }

  results.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));

  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 100;
  const data = results.slice(offset, offset + limit);

  return { data, total: results.length };
}

export async function exportGovernanceSnapshots(
  input: GovernanceSnapshotExportInput,
): Promise<{ manifest: Awaited<ReturnType<typeof createExportManifest>>; rows: GovernanceSnapshotRecord[] }> {
  const types = input.types ?? ['reconciliation', 'config-change', 'export-manifest'];
  const { data: rows } = await listGovernanceSnapshots({
    types,
    start: input.start,
    end: input.end,
    limit: input.limit ?? 500,
  });

  const manifest = await createExportManifest({
    requester: input.requester,
    reportType: 'governance-snapshots',
    filters: {
      types,
      start: input.start,
      end: input.end,
      limit: input.limit ?? 500,
    },
    rows,
  });

  return { manifest, rows };
}
