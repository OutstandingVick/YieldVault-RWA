import crypto from 'crypto';

export interface ExportManifestRecord {
  id: string;
  requester: string;
  reportType: string;
  filters: Record<string, unknown>;
  checksum: string;
  generatedAt: string;
  fileName: string;
  rowCount: number;
}

interface CreateExportManifestInput {
  requester: string;
  reportType: string;
  filters: Record<string, unknown>;
  rows: unknown[];
}

const manifests: ExportManifestRecord[] = [];

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

export function createExportManifest(input: CreateExportManifestInput): ExportManifestRecord {
  const generatedAt = new Date().toISOString();
  const canonicalPayload = stableStringify({
    reportType: input.reportType,
    filters: input.filters,
    rows: input.rows,
    generatedAt,
  });
  const checksum = crypto.createHash('sha256').update(canonicalPayload).digest('hex');
  const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const manifest: ExportManifestRecord = Object.freeze({
    id,
    requester: input.requester,
    reportType: input.reportType,
    filters: Object.freeze({ ...input.filters }),
    checksum,
    generatedAt,
    fileName: `${input.reportType}-${generatedAt.replace(/[:.]/g, '-')}.json`,
    rowCount: input.rows.length,
  }) as ExportManifestRecord;

  manifests.unshift(manifest);
  return manifest;
}

export function listExportManifests(limit: number = 50): ExportManifestRecord[] {
  const bounded = Math.max(1, Math.min(limit, 200));
  return manifests.slice(0, bounded);
}

export function getExportManifestById(id: string): ExportManifestRecord | null {
  return manifests.find((manifest) => manifest.id === id) || null;
}

export function resetExportManifestsForTests(): void {
  manifests.splice(0, manifests.length);
}
