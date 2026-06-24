import crypto from 'crypto';
import { logger } from './middleware/structuredLogging';
import { getActiveRequestId } from './requestContext';

export interface WriteAheadEntry {
  id: string;
  configType: string;
  action: string;
  actor: string;
  ipAddress: string | null;
  userAgent: string | null;
  preChangeSnapshot: Record<string, unknown>;
  postChangeSnapshot: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  status: 'pending' | 'committed' | 'rolled_back';
  requestId: string | null;
  createdAt: string;
  committedAt: string | null;
}

export interface WriteAheadInput {
  configType: string;
  action: string;
  actor: string;
  ipAddress?: string;
  userAgent?: string;
  preChangeSnapshot: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

class WriteAheadAuditLogStore {
  private entries: WriteAheadEntry[] = [];
  private maxEntries = 10000;

  prepare(input: WriteAheadInput): WriteAheadEntry {
    const entry: WriteAheadEntry = {
      id: `wal-${crypto.randomUUID()}`,
      configType: input.configType,
      action: input.action,
      actor: input.actor,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      preChangeSnapshot: { ...input.preChangeSnapshot },
      postChangeSnapshot: null,
      metadata: { ...(input.metadata ?? {}) },
      status: 'pending',
      requestId: getActiveRequestId() ?? null,
      createdAt: new Date().toISOString(),
      committedAt: null,
    };

    this.entries.unshift(entry);
    this.trimEntries();

    logger.log('info', 'Write-ahead audit entry prepared', {
      walId: entry.id,
      configType: entry.configType,
      action: entry.action,
      actor: entry.actor,
    });

    return entry;
  }

  commit(walId: string, postChangeSnapshot: Record<string, unknown>): WriteAheadEntry | null {
    const entry = this.entries.find((e) => e.id === walId);
    if (!entry || entry.status !== 'pending') return null;

    entry.postChangeSnapshot = { ...postChangeSnapshot };
    entry.status = 'committed';
    entry.committedAt = new Date().toISOString();

    logger.log('info', 'Write-ahead audit entry committed', {
      walId: entry.id,
      configType: entry.configType,
      action: entry.action,
    });

    return entry;
  }

  rollback(walId: string, reason?: string): WriteAheadEntry | null {
    const entry = this.entries.find((e) => e.id === walId);
    if (!entry || entry.status !== 'pending') return null;

    entry.status = 'rolled_back';
    entry.metadata = { ...entry.metadata, rollbackReason: reason ?? 'unknown' };

    logger.log('warn', 'Write-ahead audit entry rolled back', {
      walId: entry.id,
      configType: entry.configType,
      reason,
    });

    return entry;
  }

  getEntry(walId: string): WriteAheadEntry | null {
    return this.entries.find((e) => e.id === walId) ?? null;
  }

  list(opts: {
    configType?: string;
    actor?: string;
    status?: 'pending' | 'committed' | 'rolled_back';
    limit?: number;
  } = {}): WriteAheadEntry[] {
    let result = this.entries;

    if (opts.configType) {
      result = result.filter((e) => e.configType === opts.configType);
    }
    if (opts.actor) {
      result = result.filter((e) => e.actor === opts.actor);
    }
    if (opts.status) {
      result = result.filter((e) => e.status === opts.status);
    }

    return result.slice(0, opts.limit ?? 100);
  }

  getPendingEntries(): WriteAheadEntry[] {
    return this.entries.filter((e) => e.status === 'pending');
  }

  getMetrics() {
    const total = this.entries.length;
    const pending = this.entries.filter((e) => e.status === 'pending').length;
    const committed = this.entries.filter((e) => e.status === 'committed').length;
    const rolledBack = this.entries.filter((e) => e.status === 'rolled_back').length;

    return { total, pending, committed, rolledBack };
  }

  clear(): void {
    this.entries = [];
  }

  private trimEntries(): void {
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }
  }
}

export const writeAheadAuditLog = new WriteAheadAuditLogStore();
