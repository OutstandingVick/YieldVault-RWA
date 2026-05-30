import { Router, Request, Response } from 'express';
import Redis from 'ioredis';
import crypto from 'crypto';
import { logger } from './middleware/structuredLogging';

// Schema and Types for RefreshToken
export interface RefreshTokenEntry {
  token: string;
  userId: string;
  familyId: string;
  isUsed: boolean;
  expiresAt: number; // epoch ms
}

export interface IRefreshTokenStore {
  get(token: string): Promise<RefreshTokenEntry | null>;
  set(token: string, entry: RefreshTokenEntry, ttlSeconds: number): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;
  markAsUsed(token: string, ttlSeconds: number): Promise<void>;
}

// In-Memory fallback implementation (dev mode)
export class InMemoryRefreshTokenStore implements IRefreshTokenStore {
  private store = new Map<string, RefreshTokenEntry>();

  async get(token: string): Promise<RefreshTokenEntry | null> {
    const entry = this.store.get(token);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(token);
      return null;
    }
    return entry;
  }

  async set(token: string, entry: RefreshTokenEntry): Promise<void> {
    this.store.set(token, entry);
  }

  async revokeFamily(familyId: string): Promise<void> {
    const toDelete: string[] = [];
    for (const [token, entry] of this.store.entries()) {
      if (entry.familyId === familyId) {
        toDelete.push(token);
      }
    }
    for (const token of toDelete) {
      this.store.delete(token);
    }
  }

  async markAsUsed(token: string): Promise<void> {
    const entry = this.store.get(token);
    if (entry) {
      entry.isUsed = true;
    }
  }
}

// Redis production implementation
export class RedisRefreshTokenStore implements IRefreshTokenStore {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
    });
    this.redis.on('error', (err) => {
      logger.log('error', 'Redis RefreshTokenStore Connection Error', { error: err.message });
    });
  }

  private getKey(token: string): string {
    return `refresh:${token}`;
  }

  private getFamilyKey(familyId: string): string {
    return `family:${familyId}`;
  }

  async get(token: string): Promise<RefreshTokenEntry | null> {
    const data = await this.redis.get(this.getKey(token));
    if (!data) return null;
    try {
      const entry = JSON.parse(data) as RefreshTokenEntry;
      if (Date.now() > entry.expiresAt) {
        await this.redis.del(this.getKey(token));
        return null;
      }
      return entry;
    } catch {
      return null;
    }
  }

  async set(token: string, entry: RefreshTokenEntry, ttlSeconds: number): Promise<void> {
    const key = this.getKey(token);
    const familyKey = this.getFamilyKey(entry.familyId);

    const pipeline = this.redis.multi();
    pipeline.set(key, JSON.stringify(entry), 'EX', ttlSeconds);
    pipeline.sadd(familyKey, token);
    pipeline.expire(familyKey, ttlSeconds);
    await pipeline.exec();
  }

  async revokeFamily(familyId: string): Promise<void> {
    const familyKey = this.getFamilyKey(familyId);
    const tokens = await this.redis.smembers(familyKey);
    if (tokens.length > 0) {
      const keysToDelete = tokens.map((t) => this.getKey(t));
      const pipeline = this.redis.multi();
      pipeline.del(...keysToDelete);
      pipeline.del(familyKey);
      await pipeline.exec();
    } else {
      await this.redis.del(familyKey);
    }
  }

  async markAsUsed(token: string, ttlSeconds: number): Promise<void> {
    const entry = await this.get(token);
    if (entry) {
      entry.isUsed = true;
      await this.set(token, entry, ttlSeconds);
    }
  }
}

const redisUrl = process.env.REDIS_URL;
const JWT_REFRESH_TTL_SECONDS = parseInt(process.env.JWT_REFRESH_TTL_SECONDS || '604800', 10);

export const tokenStore: IRefreshTokenStore = redisUrl
  ? new RedisRefreshTokenStore(redisUrl)
  : new InMemoryRefreshTokenStore();

logger.log('info', 'Refresh Token Store successfully initialized', {
  storeMode: redisUrl ? 'Redis' : 'In-Memory Fallback',
  ttlSeconds: JWT_REFRESH_TTL_SECONDS,
});

export const authRouter = Router();

// POST /api/v1/auth/login (Bootstrap endpoint to simulate a login session)
authRouter.post('/login', async (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Missing required field: userId' });
  }

  const token = crypto.randomBytes(40).toString('hex');
  const familyId = crypto.randomBytes(16).toString('hex');
  const entry: RefreshTokenEntry = {
    token,
    userId: String(userId),
    familyId,
    isUsed: false,
    expiresAt: Date.now() + JWT_REFRESH_TTL_SECONDS * 1000,
  };

  await tokenStore.set(token, entry, JWT_REFRESH_TTL_SECONDS);

  return res.status(200).json({
    accessToken: `access-${crypto.randomBytes(20).toString('hex')}`,
    refreshToken: token,
  });
});

// POST /api/v1/auth/refresh (Refreshes session with active theft detection / replay protection)
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing required field: refreshToken' });
  }

  const entry = await tokenStore.get(refreshToken);
  if (!entry) {
    return res.status(401).json({
      error: 'Unauthorized',
      status: 401,
      message: 'Invalid or expired refresh token',
    });
  }

  // Theft detection: check if this refresh token was already used
  if (entry.isUsed) {
    // Revoke the entire session family
    await tokenStore.revokeFamily(entry.familyId);
    logger.log('warn', 'Replay attack detected! Revoking full session family', {
      familyId: entry.familyId,
      userId: entry.userId,
    });
    return res.status(401).json({
      error: 'Unauthorized',
      status: 401,
      message: 'Refresh token reuse detected. Full session family invalidated.',
    });
  }

  // Mark the current token as used
  await tokenStore.markAsUsed(refreshToken, JWT_REFRESH_TTL_SECONDS);

  // Generate a new rotated refresh token in the same family
  const newRefreshToken = crypto.randomBytes(40).toString('hex');
  const newEntry: RefreshTokenEntry = {
    token: newRefreshToken,
    userId: entry.userId,
    familyId: entry.familyId,
    isUsed: false,
    expiresAt: Date.now() + JWT_REFRESH_TTL_SECONDS * 1000,
  };

  await tokenStore.set(newRefreshToken, newEntry, JWT_REFRESH_TTL_SECONDS);

  return res.status(200).json({
    accessToken: `access-${crypto.randomBytes(20).toString('hex')}`,
    refreshToken: newRefreshToken,
  });
});

// POST /api/v1/auth/revoke (Revokes a refresh token family immediately)
authRouter.post('/revoke', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing required field: refreshToken' });
  }

  const entry = await tokenStore.get(refreshToken);
  if (entry) {
    await tokenStore.revokeFamily(entry.familyId);
  }

  return res.status(200).json({ message: 'Session family successfully revoked' });
});
