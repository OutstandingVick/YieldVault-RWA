import crypto from 'crypto';
import { logger } from './middleware/structuredLogging';

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

class ScopedAdminTokenStore {
  private tokens = new Map<string, ScopedAdminToken>();

  generateKeyId(): string {
    return `yv_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  create(input: ScopedTokenCreateInput): { token: ScopedAdminToken; secret: string } {
    for (const perm of input.permissions) {
      if (!VALID_PERMISSIONS.has(perm)) {
        throw new Error(`Invalid permission: ${perm}`);
      }
    }

    if (input.permissions.length === 0) {
      throw new Error('At least one permission is required');
    }

    const keyId = this.generateKeyId();
    const secret = this.generateSecret();
    const now = new Date().toISOString();

    const token: ScopedAdminToken = {
      keyId,
      hashedSecret: this.hashSecret(secret),
      permissions: [...input.permissions],
      createdAt: now,
      rotatedAt: null,
      expiresAt: input.expiresInSeconds
        ? new Date(Date.now() + input.expiresInSeconds * 1000).toISOString()
        : null,
      revoked: false,
      label: input.label,
      createdBy: input.createdBy,
    };

    this.tokens.set(keyId, token);

    logger.log('info', 'Scoped admin token created', {
      keyId,
      label: input.label,
      permissions: input.permissions,
      createdBy: input.createdBy,
    });

    return { token, secret };
  }

  authenticate(keyId: string, secret: string): ScopedAdminToken | null {
    const token = this.tokens.get(keyId);
    if (!token) return null;
    if (token.revoked) return null;

    if (token.expiresAt && new Date(token.expiresAt) <= new Date()) {
      return null;
    }

    const hashedInput = this.hashSecret(secret);
    if (!crypto.timingSafeEqual(Buffer.from(hashedInput), Buffer.from(token.hashedSecret))) {
      return null;
    }

    return token;
  }

  hasPermission(token: ScopedAdminToken, required: AdminPermission): boolean {
    if (token.permissions.includes('admin:*')) return true;
    return token.permissions.includes(required);
  }

  hasAnyPermission(token: ScopedAdminToken, required: AdminPermission[]): boolean {
    return required.some((perm) => this.hasPermission(token, perm));
  }

  rotate(keyId: string): ScopedTokenRotateResult | null {
    const token = this.tokens.get(keyId);
    if (!token || token.revoked) return null;

    const newSecret = this.generateSecret();
    const now = new Date().toISOString();

    token.hashedSecret = this.hashSecret(newSecret);
    token.rotatedAt = now;

    logger.log('info', 'Scoped admin token rotated', {
      keyId,
      label: token.label,
      rotatedAt: now,
    });

    return { keyId, newSecret, rotatedAt: now };
  }

  revoke(keyId: string): boolean {
    const token = this.tokens.get(keyId);
    if (!token || token.revoked) return false;

    token.revoked = true;

    logger.log('info', 'Scoped admin token revoked', {
      keyId,
      label: token.label,
    });

    return true;
  }

  get(keyId: string): ScopedAdminToken | null {
    return this.tokens.get(keyId) ?? null;
  }

  list(opts: { includeRevoked?: boolean } = {}): ScopedAdminToken[] {
    const all = Array.from(this.tokens.values());
    if (opts.includeRevoked) return all;
    return all.filter((t) => !t.revoked);
  }

  getValidPermissions(): string[] {
    return Array.from(VALID_PERMISSIONS);
  }

  clear(): void {
    this.tokens.clear();
  }
}

export const scopedAdminTokenStore = new ScopedAdminTokenStore();
