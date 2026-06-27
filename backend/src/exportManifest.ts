import crypto from 'crypto';
import { getPrismaClient } from './prismaClient';
import { logger } from './middleware/structuredLogging';

export interface ExportManifestRecord {
  id: string;
  requester: string;
  reportType: string;
  filters: Record<string, unknown>;
  checksum: string;
  generatedAt: string;
  fileName: string;
  rowCount: number;
  bulkExportJobId?: string;
  artifactId?: string;
}

interface CreateExportManifestInput {
  requester: string;
  reportType: string;
  filters: Record<string, unknown>;
  rows: unknown[];
  bulkExportJobId?: string;
  artifactId?: string;
}

const memoryManifests: ExportManifestRecord[] = [];

function getRetentionLimit(): number {
  return parseInt(process.env.EXPORT_MANIFEST_RETENTION || '500', 10);
}

function shouldUseMemoryFallback(): boolean {
  return process.env.EXPORT_MANIFEST_STORAGE === 'memory';
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function mapRow(row: {
  id: string;
  requester: string;
  reportType: string;
  filters: string;
  checksum: string;
  generatedAt: Date;
  fileName: string;
  rowCount: number;
  bulkExportJobId: string | null;
  artifactId: string | null;
}): ExportManifestRecord {
  let filters: Record<string, unknown> = {};
  try {
    filters = JSON.parse(row.filters) as Record<string, unknown>;
  } catch {
    filters = {};
  }

  return {
    id: row.id,
    requester: row.requester,
    reportType: row.reportType,
    filters,
    checksum: row.checksum,
    generatedAt: row.generatedAt.toISOString(),
    fileName: row.fileName,
    rowCount: row.rowCount,
    bulkExportJobId: row.bulkExportJobId ?? undefined,
    artifactId: row.artifactId ?? undefined,
  };
}

export async function createExportManifest(input: CreateExportManifestInput): Promise<ExportManifestRecord> {
  const generatedAt = new Date().toISOString();
  const canonicalPayload = stableStringify({
    reportType: input.reportType,
    filters: input.filters,
    rows: input.rows,
    generatedAt,
  });
  const checksum = crypto.createHash('sha256').update(canonicalPayload).digest('hex');
  const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const manifest: ExportManifestRecord = {
    id,
    requester: input.requester,
    reportType: input.reportType,
    filters: { ...input.filters },
    checksum,
    generatedAt,
    fileName: `${input.reportType}-${generatedAt.replace(/[:.]/g, '-')}.json`,
    rowCount: input.rows.length,
    bulkExportJobId: input.bulkExportJobId,
    artifactId: input.artifactId,
  };

  memoryManifests.unshift(manifest);

  if (!shouldUseMemoryFallback()) {
    try {
      const prisma = getPrismaClient();
      await prisma.exportManifest.create({
        data: {
          id: manifest.id,
          requester: manifest.requester,
          reportType: manifest.reportType,
          filters: JSON.stringify(manifest.filters),
          checksum: manifest.checksum,
          generatedAt: new Date(manifest.generatedAt),
          fileName: manifest.fileName,
          rowCount: manifest.rowCount,
          bulkExportJobId: manifest.bulkExportJobId ?? null,
          artifactId: manifest.artifactId ?? null,
        },
      });
      void pruneExportManifests();
    } catch (error) {
      logger.log('warn', 'Failed to persist export manifest', {
        error: error instanceof Error ? error.message : String(error),
        manifestId: manifest.id,
      });
    }
  }

  return Object.freeze(manifest) as ExportManifestRecord;
}

export async function listExportManifests(
  limit: number = 50,
  offset: number = 0,
): Promise<{ data: ExportManifestRecord[]; total: number }> {
  const bounded = Math.max(1, Math.min(limit, 200));
  const safeOffset = Math.max(0, offset);

  if (!shouldUseMemoryFallback()) {
    try {
      const prisma = getPrismaClient();
      const [rows, total] = await Promise.all([
        prisma.exportManifest.findMany({
          orderBy: { generatedAt: 'desc' },
          skip: safeOffset,
          take: bounded,
        }),
        prisma.exportManifest.count(),
      ]);

      return {
        data: rows.map(mapRow),
        total,
      };
    } catch (error) {
      logger.log('warn', 'Failed to list export manifests from database', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const data = memoryManifests.slice(safeOffset, safeOffset + bounded);
  return { data, total: memoryManifests.length };
}

export async function getExportManifestById(id: string): Promise<ExportManifestRecord | null> {
  if (!shouldUseMemoryFallback()) {
    try {
      const prisma = getPrismaClient();
      const row = await prisma.exportManifest.findUnique({ where: { id } });
      if (row) {
        return mapRow(row);
      }
    } catch (error) {
      logger.log('warn', 'Failed to fetch export manifest from database', {
        error: error instanceof Error ? error.message : String(error),
        manifestId: id,
      });
    }
  }

  return memoryManifests.find((manifest) => manifest.id === id) || null;
}

export async function verifyExportManifestChecksum(
  id: string,
  checksum: string,
): Promise<{ match: boolean; manifest: ExportManifestRecord | null }> {
  const manifest = await getExportManifestById(id);
  if (!manifest) {
    return { match: false, manifest: null };
  }

  return {
    match: manifest.checksum === checksum,
    manifest: {
      id: manifest.id,
      requester: manifest.requester,
      reportType: manifest.reportType,
      filters: manifest.filters,
      checksum: manifest.checksum,
      generatedAt: manifest.generatedAt,
      fileName: manifest.fileName,
      rowCount: manifest.rowCount,
      bulkExportJobId: manifest.bulkExportJobId,
      artifactId: manifest.artifactId,
    },
  };
}

export async function pruneExportManifests(): Promise<number> {
  const retention = getRetentionLimit();
  let pruned = 0;

  if (memoryManifests.length > retention) {
    const removed = memoryManifests.splice(retention);
    pruned += removed.length;
  }

  if (shouldUseMemoryFallback()) {
    return pruned;
  }

  try {
    const prisma = getPrismaClient();
    const rows = await prisma.exportManifest.findMany({
      orderBy: { generatedAt: 'desc' },
      skip: retention,
      select: { id: true },
    });

    if (rows.length > 0) {
      const result = await prisma.exportManifest.deleteMany({
        where: { id: { in: rows.map((row) => row.id) } },
      });
      pruned += result.count;
    }
  } catch (error) {
    logger.log('warn', 'Failed to prune export manifests', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return pruned;
}

export function resetExportManifestsForTests(): void {
  memoryManifests.splice(0, memoryManifests.length);
}
