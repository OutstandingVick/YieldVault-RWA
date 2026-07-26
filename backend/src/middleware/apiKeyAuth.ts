import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { ApiKeyRole } from '../middleware/apiKeyAuth'; // for type reuse

export type ApiKeyRole = 'viewer' | 'operator' | 'admin' | 'super-admin';

interface ApiKeyMetadata {
  role: ApiKeyRole;
  createdAt: Date;
  rotatedAt?: Date;
  revokedAt?: Date;
  tenantId: string;
  scopes: string[];
}

declare global {
  namespace Express {
    interface Request {
      authApiKeyHash?: string;
      authApiKeyRole?: ApiKeyRole;
      authApiKeyTenantId?: string;
      authApiKeyScopes?: string[];
    }
  }
}

export function normalizeApiKeyRole(raw: unknown): ApiKeyRole | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const value = raw.trim().toLowerCase();
  if (value === 'viewer' || value === 'operator' || value === 'admin' || value === 'super-admin') {
    return value as ApiKeyRole;
  }
  return null;
}

export async function validateApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.get?.('Authorization') || '';
  const match = authHeader.match(/^ApiKey\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid API key' });
    return;
  }
  const providedKey = match[1];
  const hashed = crypto.createHash('sha256').update(providedKey).digest('hex');
  const apiKey = await prisma.apiKey.findUnique({ where: { hashedKey: hashed } });
  if (!apiKey || !apiKey.isActive) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid API key' });
    return;
  }
  // Attach to request for downstream middleware
  req.authApiKeyHash = apiKey.hashedKey;
  req.authApiKeyRole = apiKey.role as ApiKeyRole;
  req.authApiKeyTenantId = apiKey.tenantId;
  req.authApiKeyScopes = apiKey.scopes;
  next();
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Legacy helpers retained for compatibility – they operate on in‑memory map only.
const IN_MEMORY_KEYS = new Map<string, ApiKeyMetadata>();

export function registerApiKey(key: string, options?: { role?: ApiKeyRole; tenantId?: string; scopes?: string[] }): string {
  const hash = hashApiKey(key);
  IN_MEMORY_KEYS.set(hash, {
    role: options?.role || 'admin',
    createdAt: new Date(),
    tenantId: options?.tenantId || 'unknown',
    scopes: options?.scopes || [],
  });
  return hash;
}

export function revokeApiKey(hash: string): boolean {
  const meta = IN_MEMORY_KEYS.get(hash);
  if (meta) {
    meta.revokedAt = new Date();
    IN_MEMORY_KEYS.set(hash, meta);
  }
  return IN_MEMORY_KEYS.delete(hash);
}

export function rotateApiKey(oldHash: string, newKey: string, options: { role?: ApiKeyRole; tenantId?: string; scopes?: string[] } = {}): string | null {
  const meta = IN_MEMORY_KEYS.get(oldHash);
  if (!meta) return null;
  IN_MEMORY_KEYS.delete(oldHash);
  const newHash = hashApiKey(newKey);
  IN_MEMORY_KEYS.set(newHash, {
    role: options.role || meta.role,
    createdAt: meta.createdAt,
    rotatedAt: new Date(),
    tenantId: options.tenantId || meta.tenantId,
    scopes: options.scopes || meta.scopes,
  });
  return newHash;
}

export function restoreApiKey(hash: string): boolean {
  const meta = IN_MEMORY_KEYS.get(hash);
  if (!meta) return false;
  meta.revokedAt = undefined;
  IN_MEMORY_KEYS.set(hash, meta);
  return true;
}

export function getApiKeyMetadata(hash: string) {
  const meta = IN_MEMORY_KEYS.get(hash);
  if (!meta) return null;
  return {
    hash,
    role: meta.role,
    createdAt: meta.createdAt.toISOString(),
    ...(meta.rotatedAt ? { rotatedAt: meta.rotatedAt.toISOString() } : {}),
    ...(meta.revokedAt ? { revokedAt: meta.revokedAt.toISOString() } : {}),
    tenantId: meta.tenantId,
    scopes: meta.scopes,
  };
}

export function authenticateApiKeyValue(value: string) {
  const hash = hashApiKey(value);
  const meta = IN_MEMORY_KEYS.get(hash);
  if (!meta || meta.revokedAt) return null;
  return { hash, role: meta.role };
}

export function hasRequiredApiKeyRole(req: Request, requiredRole: ApiKeyRole): boolean {
  const currentRole = req.authApiKeyRole || 'admin';
  const order: Record<ApiKeyRole, number> = { viewer: 0, operator: 1, admin: 2, 'super-admin': 3 };
  return order[currentRole] >= order[requiredRole];
}
import crypto from 'crypto';

export type ApiKeyRole = 'viewer' | 'operator' | 'admin' | 'super-admin';

interface ApiKeyMetadata {
  role: ApiKeyRole;
  createdAt: Date;
  rotatedAt?: Date;
  revokedAt?: Date;
}

const API_KEYS = new Map<string, ApiKeyMetadata>(); // hash -> key metadata
const ROLE_ORDER: Record<ApiKeyRole, number> = {
  viewer: 1,
  operator: 2,
  admin: 3,
  'super-admin': 4,
};

declare global {
  namespace Express {
    interface Request {
      authApiKeyHash?: string;
      authApiKeyRole?: ApiKeyRole;
    }
  }
}

const ROLE_PRECEDENCE: Record<ApiKeyRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
  'super-admin': 3,
};

export function normalizeApiKeyRole(raw: unknown): ApiKeyRole | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const value = raw.trim().toLowerCase();
  if (value === 'viewer' || value === 'operator' || value === 'admin' || value === 'super-admin') {
    return value;
  }

  return null;
}

export function validateApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.get?.('Authorization') || '';
  const match = authHeader.match(/^ApiKey\s+(.+)$/i);

  if (!match) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid API key',
    });
    return;
  }

  const providedKey = match[1];
  const authenticated = authenticateApiKeyValue(providedKey);

  if (!authenticated) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  req.authApiKeyHash = authenticated.hash;
  req.authApiKeyRole = authenticated.role;

  next();
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function registerApiKey(key: string, options?: { role?: ApiKeyRole }): string {
  const hash = hashApiKey(key);
  API_KEYS.set(hash, {
    createdAt: new Date(),
    role: options?.role || 'admin',
  });
  return hash;
}

export function revokeApiKey(hash: string): boolean {
  const metadata = API_KEYS.get(hash);
  if (metadata) {
    metadata.revokedAt = new Date();
    API_KEYS.set(hash, metadata);
  }
  return API_KEYS.delete(hash);
}

export function rotateApiKey(oldHash: string, newKey: string, options: { role?: ApiKeyRole } = {}): string | null {
  const metadata = API_KEYS.get(oldHash);
  if (!metadata) {
    return null;
  }

  API_KEYS.delete(oldHash);

  const newHash = hashApiKey(newKey);
  API_KEYS.set(newHash, {
    role: metadata.role,
    createdAt: metadata.createdAt,
    rotatedAt: new Date(),
    role: normalizeApiKeyRole(options.role ?? metadata.role),
  });

  return newHash;
}

export function restoreApiKey(hash: string): boolean {
  const metadata = API_KEYS.get(hash);
  if (!metadata) {
    return false;
  }

  metadata.revokedAt = undefined;
  API_KEYS.set(hash, metadata);
  return true;
}

export function getApiKeyMetadata(hash: string):
  | {
      hash: string;
      role: ApiKeyRole;
      createdAt: string;
      rotatedAt?: string;
      revokedAt?: string;
    }
  | null {
  const metadata = API_KEYS.get(hash);
  if (!metadata) {
    return null;
  }

  return {
    hash,
    role: metadata.role,
    createdAt: metadata.createdAt.toISOString(),
    ...(metadata.rotatedAt ? { rotatedAt: metadata.rotatedAt.toISOString() } : {}),
    ...(metadata.revokedAt ? { revokedAt: metadata.revokedAt.toISOString() } : {}),
  };
}

export function authenticateApiKeyValue(value: string): { hash: string; role: ApiKeyRole } | null {
  const hash = hashApiKey(value);
  const metadata = API_KEYS.get(hash);
  if (!metadata || metadata.revokedAt) {
    return null;
  }

  return {
    hash,
    role: metadata.role,
  };
}

export function hasRequiredApiKeyRole(req: Request, requiredRole: ApiKeyRole): boolean {
  const currentRole = req.authApiKeyRole || 'admin';
  return ROLE_PRECEDENCE[currentRole] >= ROLE_PRECEDENCE[requiredRole];
}
