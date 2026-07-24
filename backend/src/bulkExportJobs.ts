import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { createExportManifest } from './exportManifest';

export type BulkExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type ExportFormat = 'csv' | 'json';

export interface BulkExportJobRecord {
  id: string;
  status: BulkExportStatus;
  format: ExportFormat;
  generatedBy: string;
  filters: Record<string, unknown>;
  totalRows: number;
  processedRows: number;
  errorRows: number;
  artifactId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface BulkExportArtifact {
  id: string;
  body: string;
  contentType: string;
  checksum: string;
  checksumAlgorithm: string;
  rowCount: number;
}

interface CreateBulkExportJobInput {
  format: ExportFormat;
  generatedBy: string;
  filters: Record<string, unknown>;
}

const jobs = new Map<string, BulkExportJobRecord>();
const artifacts = new Map<string, BulkExportArtifact>();
const BATCH_SIZE = parseInt(process.env.BULK_EXPORT_BATCH_SIZE || '1000', 10);
let persistenceInitialized = false;

export function createBulkExportJobId(): string {
  return `bulk_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

export async function createBulkExportJob(input: CreateBulkExportJobInput): Promise<BulkExportJobRecord> {
  const id = createBulkExportJobId();
  const now = new Date().toISOString();

  const job: BulkExportJobRecord = {
    id,
    status: 'pending',
    format: input.format,
    generatedBy: input.generatedBy,
    filters: input.filters,
    totalRows: 0,
    processedRows: 0,
    errorRows: 0,
    artifactId: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  jobs.set(id, job);
  void persistBulkExportJob(job);
  return job;
}

export async function getBulkExportJob(id: string): Promise<BulkExportJobRecord | null> {
  return jobs.get(id) ?? null;
}

export async function listBulkExportJobs(limit = 50): Promise<BulkExportJobRecord[]> {
  return Array.from(jobs.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function updateBulkExportProgress(
  id: string,
  progress: {
    status?: BulkExportStatus;
    processedRows?: number;
    errorRows?: number;
    totalRows?: number;
    artifactId?: string | null;
    errorMessage?: string | null;
  }
): Promise<void> {
  const existing = jobs.get(id);
  if (!existing) return;

  const now = new Date().toISOString();
  const updated: BulkExportJobRecord = {
    ...existing,
    status: progress.status ?? existing.status,
    processedRows: progress.processedRows ?? existing.processedRows,
    errorRows: progress.errorRows ?? existing.errorRows,
    totalRows: progress.totalRows ?? existing.totalRows,
    artifactId: progress.artifactId !== undefined ? progress.artifactId : existing.artifactId,
    errorMessage: progress.errorMessage !== undefined ? progress.errorMessage : existing.errorMessage,
    updatedAt: now,
    completedAt: (progress.status === 'completed' || progress.status === 'failed')
      ? now
      : existing.completedAt,
  };

  jobs.set(id, updated);
  void persistBulkExportJob(updated);
}

export async function cancelBulkExportJob(id: string): Promise<boolean> {
  const job = jobs.get(id);
  if (!job) return false;
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return false;
  }

  await updateBulkExportProgress(id, { status: 'cancelled', errorMessage: 'Cancelled by admin' });
  return true;
}

export function storeBulkExportArtifact(artifactId: string, artifact: BulkExportArtifact): void {
  artifacts.set(artifactId, artifact);
}

export function getBulkExportArtifact(artifactId: string): BulkExportArtifact | undefined {
  return artifacts.get(artifactId);
}

export function buildBulkExportArtifact(
  format: ExportFormat,
  rows: Array<Record<string, unknown>>
): BulkExportArtifact {
  const id = `bulk_art_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  let body: string;
  let contentType: string;

  if (format === 'csv') {
    contentType = 'text/csv';
    if (rows.length === 0) {
      body = '';
    } else {
      const headers = Object.keys(rows[0]);
      const csvLines = rows.map((row) =>
        headers.map((h) => {
          const val = row[h];
          const str = val == null ? '' : String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(',')
      );
      body = [headers.join(','), ...csvLines].join('\n');
    }
  } else {
    contentType = 'application/json';
    body = JSON.stringify(rows, null, 2);
  }

  const checksum = crypto.createHash('sha256').update(body).digest('hex');

  return {
    id,
    body,
    contentType,
    checksum,
    checksumAlgorithm: 'sha256',
    rowCount: rows.length,
  };
}

export async function processBulkExportJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job || job.status !== 'pending') return;

  await updateBulkExportProgress(jobId, { status: 'processing' });

  try {
    const allRows = simulateTransactionFetch(job.filters);
    const totalRows = allRows.length;
    await updateBulkExportProgress(jobId, { totalRows });

    let processedRows = 0;
    let errorRows = 0;
    const batch: Array<Record<string, unknown>> = [];

    for (const row of allRows) {
      try {
        batch.push(row);
        processedRows++;
      } catch {
        errorRows++;
      }

      if (batch.length >= BATCH_SIZE || processedRows === totalRows) {
        await updateBulkExportProgress(jobId, { processedRows, errorRows });
        batch.length = 0;
      }
    }

    const artifact = buildBulkExportArtifact(job.format, allRows);
    storeBulkExportArtifact(artifact.id, artifact);

    await createExportManifest({
      requester: job.generatedBy,
      reportType: 'bulk-transactions',
      filters: job.filters,
      rows: allRows,
      bulkExportJobId: jobId,
      artifactId: artifact.id,
    });

    await updateBulkExportProgress(jobId, {
      status: 'completed',
      processedRows,
      errorRows,
      artifactId: artifact.id,
    });
  } catch (error) {
    await updateBulkExportProgress(jobId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

export function resetBulkExportState(): void {
  jobs.clear();
  artifacts.clear();
  persistenceInitialized = false;
}

function simulateTransactionFetch(filters: Record<string, unknown>): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];
  const count = Math.min(Math.max(Number(filters.limit) || 100, 1), 50000);

  for (let i = 0; i < count; i++) {
    rows.push({
      id: `tx_${i}`,
      user: `G${crypto.randomBytes(28).toString('hex').slice(0, 55)}`,
      amount: (Math.random() * 10000).toFixed(2),
      type: Math.random() > 0.5 ? 'deposit' : 'withdrawal',
      status: Math.random() > 0.2 ? 'completed' : 'pending',
      timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return rows;
}

async function persistBulkExportJob(job: BulkExportJobRecord): Promise<void> {
  try {
    await ensureBulkExportTable();
    await prisma.$executeRaw`
      INSERT INTO BulkExportJob (
        id, status, format, generatedBy, filters,
        totalRows, processedRows, errorRows,
        artifactId, errorMessage,
        createdAt, updatedAt, completedAt
      ) VALUES (
        ${job.id}, ${job.status}, ${job.format}, ${job.generatedBy},
        ${JSON.stringify(job.filters)},
        ${job.totalRows}, ${job.processedRows}, ${job.errorRows},
        ${job.artifactId}, ${job.errorMessage},
        ${job.createdAt}, ${job.updatedAt}, ${job.completedAt}
      )
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        format = excluded.format,
        generatedBy = excluded.generatedBy,
        filters = excluded.filters,
        totalRows = excluded.totalRows,
        processedRows = excluded.processedRows,
        errorRows = excluded.errorRows,
        artifactId = excluded.artifactId,
        errorMessage = excluded.errorMessage,
        updatedAt = excluded.updatedAt,
        completedAt = excluded.completedAt
    `;
  } catch {
    // Runtime persistence is best-effort so local development and tests still work without migrations.
  }
}

async function ensureBulkExportTable(): Promise<void> {
  if (persistenceInitialized) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS BulkExportJob (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      format TEXT NOT NULL,
      generatedBy TEXT NOT NULL,
      filters TEXT NOT NULL,
      totalRows INTEGER NOT NULL DEFAULT 0,
      processedRows INTEGER NOT NULL DEFAULT 0,
      errorRows INTEGER NOT NULL DEFAULT 0,
      artifactId TEXT,
      errorMessage TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      completedAt TEXT
    )
  `);
  persistenceInitialized = true;
}
