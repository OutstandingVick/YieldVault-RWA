import type { Request } from 'express';
import { prisma } from './prisma';

export interface AdminConfigChangeRecord {
  id: string;
  configType: string;
  action: string;
  actor: string;
  ipAddress?: string;
  userAgent?: string;
  preChangeSnapshot: Record<string, unknown>;
  postChangeSnapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ListAdminConfigChangesFilters {
  configType?: string;
  actor?: string;
  start?: string;
  end?: string;
  limit?: number;
}

function shouldUseInMemoryAdminConfigAuditFallback(): boolean {
  const nodeEnv = process.env.NODE_ENV || '';
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  return nodeEnv === 'test' || Boolean(process.env.JEST_WORKER_ID) || !hasDatabaseUrl;
}

function buildFallbackAdminConfigChangeRecord(input: {
  configType: string;
  action: string;
  actor: string;
  ipAddress?: string;
  userAgent?: string;
  preChangeSnapshot: Record<string, unknown>;
  postChangeSnapshot: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): AdminConfigChangeRecord {
  return {
    id: `admin-config-change-${Date.now()}`,
    configType: input.configType,
    action: input.action,
    actor: input.actor,
    ipAddress: input.ipAddress ?? undefined,
    userAgent: input.userAgent ?? undefined,
    preChangeSnapshot: input.preChangeSnapshot,
    postChangeSnapshot: input.postChangeSnapshot,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString(),
  };
}

export async function recordAdminConfigChange(input: {
  configType: string;
  action: string;
  actor: string;
  ipAddress?: string;
  userAgent?: string;
  preChangeSnapshot: Record<string, unknown>;
  postChangeSnapshot: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<AdminConfigChangeRecord> {
  if (shouldUseInMemoryAdminConfigAuditFallback()) {
    return buildFallbackAdminConfigChangeRecord(input);
  }

  try {
    const record = await prisma.adminConfigChange.create({
      data: {
        configType: input.configType,
        action: input.action,
        actor: input.actor,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        preChangeSnapshot: JSON.stringify(input.preChangeSnapshot),
        postChangeSnapshot: JSON.stringify(input.postChangeSnapshot),
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    });

    return {
      id: record.id,
      configType: record.configType,
      action: record.action,
      actor: record.actor,
      ipAddress: record.ipAddress ?? undefined,
      userAgent: record.userAgent ?? undefined,
      preChangeSnapshot: JSON.parse(record.preChangeSnapshot),
      postChangeSnapshot: JSON.parse(record.postChangeSnapshot),
      metadata: JSON.parse(record.metadata),
      createdAt: record.createdAt.toISOString(),
    };
  } catch {
    return buildFallbackAdminConfigChangeRecord(input);
  }
}

export async function listAdminConfigChanges(
  filters: ListAdminConfigChangesFilters = {},
): Promise<AdminConfigChangeRecord[]> {
  const where: any = {};

  if (filters.configType) {
    where.configType = filters.configType;
  }

  if (filters.actor) {
    where.actor = filters.actor;
  }

  if (filters.start || filters.end) {
    where.createdAt = {};
    if (filters.start) {
      where.createdAt.gte = new Date(filters.start);
    }
    if (filters.end) {
      where.createdAt.lte = new Date(filters.end);
    }
  }

  if (shouldUseInMemoryAdminConfigAuditFallback()) {
    return [];
  }

  try {
    const records = await prisma.adminConfigChange.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: filters.limit ?? 100,
    });

    return records.map((record) => ({
      id: record.id,
      configType: record.configType,
      action: record.action,
      actor: record.actor,
      ipAddress: record.ipAddress ?? undefined,
      userAgent: record.userAgent ?? undefined,
      preChangeSnapshot: JSON.parse(record.preChangeSnapshot),
      postChangeSnapshot: JSON.parse(record.postChangeSnapshot),
      metadata: JSON.parse(record.metadata),
      createdAt: record.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

export function getActorFromRequest(req: Request): string {
  const explicitActor =
    req.get('x-admin-address') ||
    req.get('x-admin-id') ||
    req.get('x-wallet-address');
  if (explicitActor) {
    return explicitActor;
  }

  const authHeader = req.header('authorization');
  if (!authHeader) {
    return 'unknown';
  }

  const apiKeyMatch = authHeader.match(/^ApiKey\s+(.+)$/i);
  if (apiKeyMatch) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(apiKeyMatch[1]).digest('hex');
    return `apiKey:${hash.slice(0, 12)}`;
  }

  return 'authenticated';
}
