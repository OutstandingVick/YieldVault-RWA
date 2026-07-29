import { prisma } from '../prisma';
import crypto from 'crypto';
import { ApiKeyRole } from '../middleware/apiKeyAuth';

export interface ApiKeyRecord {
  id: string;
  tenantId: string;
  hashedKey: string;
  role: ApiKeyRole;
  scopes: string[];
  createdAt: Date;
  expiresAt?: Date | null;
  isActive: boolean;
}

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function serializeScopes(scopes: string[]): string {
  return JSON.stringify(scopes);
}

function deserializeScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toApiKeyRecord(r: {
  id: string;
  tenantId: string;
  hashedKey: string;
  role: string;
  scopes: unknown;
  createdAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
}): ApiKeyRecord {
  return {
    id: r.id,
    tenantId: r.tenantId,
    hashedKey: r.hashedKey,
    role: r.role as ApiKeyRole,
    scopes: deserializeScopes(r.scopes),
    createdAt: r.createdAt,
    expiresAt: r.expiresAt ?? undefined,
    isActive: r.isActive,
  };
}

export async function createApiKey(
  tenantId: string,
  role: ApiKeyRole = 'admin',
  scopes: string[] = [],
  expiresInDays?: number
): Promise<{ plainKey: string; record: ApiKeyRecord }> {
  const plainKey = crypto.randomBytes(32).toString('hex');
  const hashedKey = hashApiKey(plainKey);
  const now = new Date();
  const expiresAt = expiresInDays ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000) : null;

  const record = await prisma.apiKey.create({
    data: {
      tenantId,
      hashedKey,
      role,
      scopes: serializeScopes(scopes),
      createdAt: now,
      expiresAt,
      isActive: true,
    },
  });

  return { plainKey, record: toApiKeyRecord(record) };
}

export async function getApiKeyByHashed(hashed: string): Promise<ApiKeyRecord | null> {
  const record = await prisma.apiKey.findUnique({ where: { hashedKey: hashed } });
  if (!record) return null;
  if (!record.isActive) return null;
  if (record.expiresAt && record.expiresAt < new Date()) return null;
  return toApiKeyRecord(record);
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const updated = await prisma.apiKey.update({
    where: { id },
    data: { isActive: false },
  });
  return !!updated;
}

export async function rotateApiKey(id: string, newPlainKey: string, newScopes?: string[]): Promise<ApiKeyRecord | null> {
  const hashedKey = hashApiKey(newPlainKey);
  const updateData: Record<string, unknown> = {
    hashedKey,
  };
  if (newScopes) updateData.scopes = serializeScopes(newScopes);
  const record = await prisma.apiKey.update({ where: { id }, data: updateData });
  return toApiKeyRecord(record);
}

export async function listApiKeys(tenantId: string): Promise<ApiKeyRecord[]> {
  const records = await prisma.apiKey.findMany({ where: { tenantId } });
  return records.map(r => toApiKeyRecord(r));
}
