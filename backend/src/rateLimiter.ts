/**
 * @file rateLimiter.ts
 * Redis-backed rate limiting middleware for API endpoints.
 *
 * Provides per-endpoint, per-wallet-address rate limiting with fail-open
 * behaviour when Redis is unavailable.
 */

import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { Request, Response, RequestHandler } from 'express';
import { Redis } from 'ioredis';
import RedisStore from 'rate-limit-redis';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EndpointLimiterConfig {
  /** Tier name used as Redis key prefix, e.g. 'auth', 'writes', 'reads', 'admin' */
  tier: string;
  /** Maximum requests per window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimiterConfig {
  auth: { max: number; windowMs: number };
  writes: { max: number; windowMs: number };
  reads: { max: number; windowMs: number };
  admin: { max: number; windowMs: number };
}

// ─── Config Loader ───────────────────────────────────────────────────────────

/**
 * Reads rate-limit configuration from environment variables.
 * Falls back to compiled-in defaults when variables are absent or non-numeric.
 */
export function loadConfig(): RateLimiterConfig {
  const parseEnv = (key: string, defaultValue: number): number => {
    const raw = process.env[key];
    if (raw === undefined || raw === '') return defaultValue;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  };

  return {
    auth: {
      max: parseEnv('RATE_LIMIT_AUTH_MAX', 5),
      windowMs: parseEnv('RATE_LIMIT_AUTH_WINDOW_MS', 60000),
    },
    writes: {
      max: parseEnv('RATE_LIMIT_WRITES_MAX', 10),
      windowMs: parseEnv('RATE_LIMIT_WRITES_WINDOW_MS', 60000),
    },
    reads: {
      max: parseEnv('RATE_LIMIT_READS_MAX', 60),
      windowMs: parseEnv('RATE_LIMIT_READS_WINDOW_MS', 60000),
    },
    admin: {
      max: parseEnv('RATE_LIMIT_ADMIN_MAX', 20),
      windowMs: parseEnv('RATE_LIMIT_ADMIN_WINDOW_MS', 60000),
    },
  };
}

// ─── Redis Client Manager ────────────────────────────────────────────────────

/**
 * Singleton that manages the ioredis client lifecycle.
 * Emits structured log messages on connection events.
 * Exposes isReady() for fail-open checks.
 */
class RedisClientManager {
  private client: Redis | null = null;
  private redisAvailable: boolean = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.log(
        JSON.stringify({
          level: 'warn',
          event: 'redis_not_configured',
          message: 'REDIS_URL not set; using in-memory rate limit store',
        })
      );
      return;
    }

    this.client = new Redis(redisUrl, { lazyConnect: true });

    const parsed = new URL(redisUrl);
    const host = parsed.hostname;
    const port = parseInt(parsed.port || '6379', 10);

    this.client.on('connect', () => {
      this.redisAvailable = true;
      console.log(
        JSON.stringify({ level: 'info', event: 'redis_connected', host, port })
      );
    });

    this.client.on('reconnecting', () => {
      console.log(
        JSON.stringify({ level: 'info', event: 'redis_reconnecting', host, port })
      );
    });

    this.client.on('error', (err: Error) => {
      this.redisAvailable = false;
      console.log(
        JSON.stringify({
          level: 'error',
          event: 'redis_error',
          host,
          port,
          reason: err.message,
        })
      );
    });
  }

  isReady(): boolean {
    return this.redisAvailable;
  }

  getClient(): Redis | null {
    return this.client;
  }
}

export const redisClientManager = new RedisClientManager();

// ─── Wallet Address Masking ──────────────────────────────────────────────────

/**
 * Truncates a wallet address for safe logging.
 * In production: shows first 4 + '...' + last 4 chars.
 * In other environments: returns the full address.
 */
export function maskWalletAddress(addr: string): string {
  if (process.env.NODE_ENV === 'production' && addr.length > 8) {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  }
  return addr;
}

// ─── Key Extraction ──────────────────────────────────────────────────────────

/**
 * Extracts the rate-limit key from a request.
 * Priority: walletAddress (body) → x-wallet-address (header) → x-api-key (header) → IP → 'unknown'
 */
export function extractRateLimitKey(req: Request): string {
  if (req.body?.walletAddress) {
    return req.body.walletAddress as string;
  }

  const walletHeader = req.headers['x-wallet-address'];
  if (walletHeader) {
    return Array.isArray(walletHeader) ? walletHeader[0] : walletHeader;
  }

  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    return Array.isArray(apiKey) ? apiKey[0] : apiKey;
  }

  if (req.ip) {
    return req.ip;
  }

  return 'unknown';
}

// ─── Redis Key Builder ───────────────────────────────────────────────────────

/**
 * Constructs the Redis key for a given route prefix and identifier.
 * Format: `rl:{routePrefix}:{identifier}`
 */
export function buildRedisKey(routePrefix: string, identifier: string): string {
  return `rl:${routePrefix}:${identifier}`;
}

// ─── Limiter Factory ─────────────────────────────────────────────────────────

/**
 * Creates an express-rate-limit middleware instance.
 * Uses Redis store when available; falls back to in-memory store otherwise.
 * Fail-open: skips enforcement when Redis was configured but is currently unreachable.
 */
export function createLimiter(config: EndpointLimiterConfig): RequestHandler {
  const client = redisClientManager.getClient();
  const redisConfigured = client !== null;
  const redisReady = redisConfigured && redisClientManager.isReady();
  const usingRedis = redisConfigured && redisReady;

  const store = usingRedis
    ? new RedisStore({
        sendCommand: ((command: string, ...args: string[]) =>
          client.call(command, ...args)) as any,
        prefix: `rl:${config.tier}:`,
      })
    : undefined;

  const options: Partial<Options> = {
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    keyGenerator: (req: Request) => extractRateLimitKey(req),
    skip: (_req: Request) => {
      // Fail-open: bypass enforcement when Redis was configured but is unavailable
      if (redisConfigured && !redisReady) {
        return true;
      }
      return false;
    },
    handler: (req: Request, res: Response) => {
      const key = extractRateLimitKey(req);
      const resetHeader = res.getHeader('RateLimit-Reset');
      const resetTime =
        typeof resetHeader === 'string' || typeof resetHeader === 'number'
          ? Number(resetHeader)
          : Math.floor((Date.now() + config.windowMs) / 1000);
      const now = Math.floor(Date.now() / 1000);
      const retryAfter = Math.max(0, resetTime - now);

      res.setHeader('Retry-After', retryAfter);

      console.log(
        JSON.stringify({
          level: 'warn',
          event: 'rate_limited',
          key: maskWalletAddress(key),
          path: req.path,
          resetTime,
        })
      );

      res.status(429).json({
        error: 'Rate limit exceeded',
        status: 429,
        message: `Too many requests. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      });
    },
  };

  if (store) {
    options.store = store;
  }

  return rateLimit(options) as RateLimitRequestHandler;
}

// ─── Pre-built Limiter Instances ─────────────────────────────────────────────

const config = loadConfig();

/** Strictest policy: prevents brute-force on authentication endpoints. */
export const authLimiter: RequestHandler = createLimiter({
  tier: 'auth',
  max: config.auth.max,
  windowMs: config.auth.windowMs,
});

/** Strict policy: prevents spamming mutation operations (deposits, withdrawals, admin writes). */
export const writesLimiter: RequestHandler = createLimiter({
  tier: 'writes',
  max: config.writes.max,
  windowMs: config.writes.windowMs,
});

/** Relaxed policy: allows regular browsing of public summary and metrics endpoints. */
export const readsLimiter: RequestHandler = createLimiter({
  tier: 'reads',
  max: config.reads.max,
  windowMs: config.reads.windowMs,
});

/** Medium-strict policy: protects administrative read/write operations. */
export const adminLimiter: RequestHandler = createLimiter({
  tier: 'admin',
  max: config.admin.max,
  windowMs: config.admin.windowMs,
});

/** Backward-compatibility aliases */
export const depositsLimiter = writesLimiter;
export const summaryLimiter = readsLimiter;
export const defaultLimiter = readsLimiter;
export const apiLimiter = readsLimiter;
