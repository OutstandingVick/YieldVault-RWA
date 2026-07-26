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
      scopes,
      createdAt: now,
      expiresAt,
      isActive: true,
    },
  });

  return { plainKey, record: { ...record, expiresAt: record.expiresAt ?? undefined } };
}

export async function getApiKeyByHashed(hashed: string): Promise<ApiKeyRecord | null> {
  const record = await prisma.apiKey.findUnique({ where: { hashedKey: hashed } });
  if (!record) return null;
  if (!record.isActive) return null;
  if (record.expiresAt && record.expiresAt < new Date()) return null;
  return { ...record, expiresAt: record.expiresAt ?? undefined };
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const updated = await prisma.apiKey.update({
    where: { id },
    data: { isActive: false, revokedAt: new Date() },
  });
  return !!updated;
}

export async function rotateApiKey(id: string, newPlainKey: string, newScopes?: string[]): Promise<ApiKeyRecord | null> {
  const hashedKey = hashApiKey(newPlainKey);
  const updateData: any = {
    hashedKey,
    rotatedAt: new Date(),
  };
  if (newScopes) updateData.scopes = newScopes;
  const record = await prisma.apiKey.update({ where: { id }, data: updateData });
  return { ...record, expiresAt: record.expiresAt ?? undefined };
}

export async function listApiKeys(tenantId: string): Promise<ApiKeyRecord[]> {
  const records = await prisma.apiKey.findMany({ where: { tenantId } });
  return records.map(r => ({ ...r, expiresAt: r.expiresAt ?? undefined }));
}
