/**
 * @file scopedAdminTokens.ts
 * Permission-scoped admin tokens with rotation support (Issue #723 / #858).
 *
 * Storage:
 *   Tokens are persisted in the `ScopedAdminToken` Prisma table.
 *   Every successful rotation appends an immutable row to the
 *   `ScopedAdminTokenRotationEvent` table – keyId + actor, no old secret.
 *
 * Secret handling:
 *   • Secrets are generated with crypto.randomBytes(32) → 64-char hex string.
 *   • Only the SHA-256 hash is stored; plaintext values are never written to the DB.
 *   • Authentication uses crypto.timingSafeEqual to prevent timing attacks.
 *
 * Cluster safety:
 *   Because state lives in Postgres/SQLite via Prisma every backend replica
 *   reads the same revocation and rotation state on each request, satisfying
 *   the durability and cluster-wide propagation acceptance criteria.
 */

import crypto from 'crypto';
import { logger } from './middleware/structuredLogging';
import { prisma } from './prisma';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminPermission =
  | 'read:audit'
  | 'write:config'
  | 'read:metrics'
  | 'write:maintenance'
  | 'read:webhooks'
  | 'write:webhooks'
  | 'read:exports'
  | 'write:exports'
  | 'read:allowlist'
  | 'write:allowlist'
  | 'read:users'
  | 'write:users'
  | 'admin:*';

export interface ScopedAdminToken {
  keyId: string;
  hashedSecret: string;
  permissions: AdminPermission[];
  createdAt: string;
  rotatedAt: string | null;
  expiresAt: string | null;
  revoked: boolean;
  revokedBy: string | null;
  revokedAt: string | null;
  label: string;
  createdBy: string;
}

export interface ScopedTokenCreateInput {
  label: string;
  permissions: AdminPermission[];
  expiresInSeconds?: number;
  createdBy: string;
}

export interface ScopedTokenRotateResult {
  keyId: string;
  newSecret: string;
  rotatedAt: string;
}

export interface ScopedAdminTokenRotationEvent {
  id: string;
  keyId: string;
  keyFingerprint: string;
  rotatedBy: string;
  rotatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_PERMISSIONS: ReadonlySet<string> = new Set<AdminPermission>([
  'read:audit',
  'write:config',
  'read:metrics',
  'write:maintenance',
  'read:webhooks',
  'write:webhooks',
  'read:exports',
  'write:exports',
  'read:allowlist',
  'write:allowlist',
  'read:users',
  'write:users',
  'admin:*',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateKeyId(): string {
  return `yv_${crypto.randomBytes(8).toString('hex')}`;
}

function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Returns a short, non-reversible fingerprint suitable for audit logs.
 * Format: `sha256:<first 16 hex chars of the hash>`.
 */
export function getScopedTokenFingerprint(hashedSecret: string): string {
  return `sha256:${hashedSecret.slice(0, 16)}`;
}

function mapRow(row: {
  keyId: string;
  hashedSecret: string;
  permissions: string;
  label: string;
  createdBy: string;
  revoked: boolean;
  revokedBy: string | null;
  revokedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  rotatedAt: Date | null;
}): ScopedAdminToken {
  return {
    keyId: row.keyId,
    hashedSecret: row.hashedSecret,
    permissions: JSON.parse(row.permissions) as AdminPermission[],
    createdAt: row.createdAt.toISOString(),
    rotatedAt: row.rotatedAt ? row.rotatedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    revoked: row.revoked,
    revokedBy: row.revokedBy,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    label: row.label,
    createdBy: row.createdBy,
  };
}

// ─── Repository ───────────────────────────────────────────────────────────────

/**
 * Prisma-backed scoped admin token repository.
 *
 * All operations are async and durable. The `clear()` method is intentionally
 * restricted to test environments to prevent accidental data loss.
 */
class ScopedAdminTokenStore {
  // ── Validation ──────────────────────────────────────────────────────────────

  private validatePermissions(permissions: AdminPermission[]): void {
    if (permissions.length === 0) {
      throw new Error('At least one permission is required');
    }
    for (const perm of permissions) {
      if (!VALID_PERMISSIONS.has(perm)) {
        throw new Error(`Invalid permission: ${perm}`);
      }
    }
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  /**
   * Creates a new scoped admin token and persists it to the database.
   * Returns the token record and the **plaintext** secret (shown once, never stored).
   */
  async create(
    input: ScopedTokenCreateInput,
  ): Promise<{ token: ScopedAdminToken; secret: string }> {
    this.validatePermissions(input.permissions);

    const keyId = generateKeyId();
    const secret = generateSecret();
    const hashed = hashSecret(secret);
    const now = new Date();
    const expiresAt = input.expiresInSeconds
      ? new Date(now.getTime() + input.expiresInSeconds * 1000)
      : null;

    const row = await prisma.scopedAdminToken.create({
      data: {
        keyId,
        hashedSecret: hashed,
        permissions: JSON.stringify(input.permissions),
        label: input.label,
        createdBy: input.createdBy,
        expiresAt,
        createdAt: now,
      },
    });

    const token = mapRow(row as any);

    logger.log('info', 'Scoped admin token created', {
      keyId,
      label: input.label,
      permissions: input.permissions,
      createdBy: input.createdBy,
    });

    return { token, secret };
  }

  /**
   * Authenticates a keyId + secret pair.
   * Returns the token record on success, `null` on any failure (not found,
   * revoked, expired, or wrong secret).
   */
  async authenticate(keyId: string, secret: string): Promise<ScopedAdminToken | null> {
    const row = await prisma.scopedAdminToken.findUnique({ where: { keyId } });
    if (!row) return null;
    if (row.revoked) return null;

    if (row.expiresAt && row.expiresAt <= new Date()) {
      return null;
    }

    const hashedInput = hashSecret(secret);
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(hashedInput, 'hex'),
      Buffer.from(row.hashedSecret, 'hex'),
    );
    if (!isMatch) return null;

    return mapRow(row as any);
  }

  /** Checks whether a token has the given permission. */
  hasPermission(token: ScopedAdminToken, required: AdminPermission): boolean {
    if (token.permissions.includes('admin:*')) return true;
    return token.permissions.includes(required);
  }

  /** Returns `true` if the token has at least one of the supplied permissions. */
  hasAnyPermission(token: ScopedAdminToken, required: AdminPermission[]): boolean {
    return required.some((perm) => this.hasPermission(token, perm));
  }

  /**
   * Rotates the secret for an existing, active token.
   * Writes an immutable `ScopedAdminTokenRotationEvent` row for the audit trail.
   * Returns the new plaintext secret (shown once).
   */
  async rotate(
    keyId: string,
    opts: { rotatedBy?: string } = {},
  ): Promise<ScopedTokenRotateResult | null> {
    const row = await prisma.scopedAdminToken.findUnique({ where: { keyId } });
    if (!row || row.revoked) return null;

    const newSecret = generateSecret();
    const newHash = hashSecret(newSecret);
    const now = new Date();
    const rotatedBy = opts.rotatedBy ?? 'system';
    const fingerprint = getScopedTokenFingerprint(row.hashedSecret);

    await prisma.$transaction([
      prisma.scopedAdminToken.update({
        where: { keyId },
        data: { hashedSecret: newHash, rotatedAt: now },
      }),
      prisma.scopedAdminTokenRotationEvent.create({
        data: {
          keyId,
          keyFingerprint: fingerprint,
          rotatedBy,
        },
      }),
    ]);

    logger.log('info', 'Scoped admin token rotated', {
      keyId,
      label: row.label,
      rotatedBy,
      rotatedAt: now.toISOString(),
    });

    return { keyId, newSecret, rotatedAt: now.toISOString() };
  }

  /**
   * Revokes a token, preventing further authentication.
   * Returns `false` if the token was already revoked or not found.
   */
  async revoke(keyId: string, opts: { revokedBy?: string } = {}): Promise<boolean> {
    const row = await prisma.scopedAdminToken.findUnique({ where: { keyId } });
    if (!row || row.revoked) return false;

    const revokedBy = opts.revokedBy ?? 'system';
    const now = new Date();

    await prisma.scopedAdminToken.update({
      where: { keyId },
      data: { revoked: true, revokedBy, revokedAt: now },
    });

    logger.log('info', 'Scoped admin token revoked', {
      keyId,
      label: row.label,
      revokedBy,
    });

    return true;
  }

  /** Fetches a single token record by keyId (without secret verification). */
  async get(keyId: string): Promise<ScopedAdminToken | null> {
    const row = await prisma.scopedAdminToken.findUnique({ where: { keyId } });
    return row ? mapRow(row as any) : null;
  }

  /** Lists all tokens, optionally including revoked ones. */
  async list(opts: { includeRevoked?: boolean } = {}): Promise<ScopedAdminToken[]> {
    const rows = await prisma.scopedAdminToken.findMany({
      where: opts.includeRevoked ? {} : { revoked: false },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r: any) => mapRow(r));
  }

  /**
   * Returns the full rotation history for a token, oldest-first.
   * Secrets are never included – only fingerprints and actor identities.
   */
  async listRotationEvents(keyId: string): Promise<ScopedAdminTokenRotationEvent[]> {
    const rows = await prisma.scopedAdminTokenRotationEvent.findMany({
      where: { keyId },
      orderBy: { rotatedAt: 'asc' },
    });
    return rows.map((r: any) => ({
      id: r.id,
      keyId: r.keyId,
      keyFingerprint: r.keyFingerprint,
      rotatedBy: r.rotatedBy,
      rotatedAt: r.rotatedAt.toISOString(),
    }));
  }

  /** Returns the list of valid permission strings. */
  getValidPermissions(): string[] {
    return Array.from(VALID_PERMISSIONS);
  }

  /**
   * Deletes all tokens **and** rotation events from the database.
   * Only available in test environments; throws in production.
   */
  async clear(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('clear() is not allowed in production');
    }
    await prisma.scopedAdminTokenRotationEvent.deleteMany({});
    await prisma.scopedAdminToken.deleteMany({});
  }
}

export const scopedAdminTokenStore = new ScopedAdminTokenStore();
