import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export type ApiKeyRole = 'viewer' | 'operator' | 'admin' | 'super-admin';

interface ApiKeyMetadata {
  createdAt: Date;
  rotatedAt?: Date;
  role: ApiKeyRole;
}

const API_KEYS = new Map<string, ApiKeyMetadata>(); // hash -> key metadata
const ROLE_ORDER: Record<ApiKeyRole, number> = {
  viewer: 1,
  operator: 2,
  admin: 3,
  'super-admin': 4,
};

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

  const authenticated = authenticateApiKeyValue(match[1]);
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

export function authenticateApiKeyValue(key: string): { hash: string; role: ApiKeyRole } | null {
  const hash = hashApiKey(key);
  const metadata = API_KEYS.get(hash);

  if (!metadata) {
    return null;
  }

  return {
    hash,
    role: metadata.role,
  };
}

export function getApiKeyMetadata(hash: string): ApiKeyMetadata | null {
  const metadata = API_KEYS.get(hash);
  if (!metadata) {
    return null;
  }

  return {
    ...metadata,
    createdAt: new Date(metadata.createdAt),
    rotatedAt: metadata.rotatedAt ? new Date(metadata.rotatedAt) : undefined,
  };
}

export function registerApiKey(key: string, options: { role?: ApiKeyRole } = {}): string {
  const hash = hashApiKey(key);
  API_KEYS.set(hash, { createdAt: new Date(), role: normalizeApiKeyRole(options.role) });
  return hash;
}

export function revokeApiKey(hash: string): boolean {
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
    createdAt: metadata.createdAt,
    rotatedAt: new Date(),
    role: normalizeApiKeyRole(options.role ?? metadata.role),
  });

  return newHash;
}

export function restoreApiKey(hash: string, options: { role?: ApiKeyRole } = {}): string | null {
  const metadata = API_KEYS.get(hash);
  if (!metadata) {
    return null;
  }

  API_KEYS.set(hash, {
    createdAt: metadata.createdAt,
    rotatedAt: metadata.rotatedAt,
    role: normalizeApiKeyRole(options.role ?? metadata.role),
  });

  return hash;
}

export function normalizeApiKeyRole(role: string | undefined | null): ApiKeyRole {
  const normalized = role?.trim().toLowerCase();

  switch (normalized) {
    case 'viewer':
      return 'viewer';
    case 'operator':
      return 'operator';
    case 'admin':
      return 'admin';
    case 'super-admin':
    case 'superadmin':
      return 'super-admin';
    default:
      return 'admin';
  }
}

export function hasRequiredApiKeyRole(req: Request, requiredRole: ApiKeyRole): boolean {
  const role = normalizeApiKeyRole(req.authApiKeyRole);
  return ROLE_ORDER[role] >= ROLE_ORDER[requiredRole];
}
