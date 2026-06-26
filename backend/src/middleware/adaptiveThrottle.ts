import { NextFunction, Request, Response } from 'express';
import { logger } from './structuredLogging';

interface AbuseState {
  score: number;
  blockedUntil: number;
  lastSeenAt: number;
}

const abuseByIp = new Map<string, AbuseState>();

const HALFLIFE_MS = parseInt(process.env.ADAPTIVE_THROTTLE_HALFLIFE_MS || '300000', 10);
const BASE_BLOCK_MS = parseInt(process.env.ADAPTIVE_THROTTLE_BASE_BLOCK_MS || '15000', 10);
const SCORE_THRESHOLD = parseFloat(process.env.ADAPTIVE_THROTTLE_SCORE_THRESHOLD || '6');
const MAX_BLOCK_MS = parseInt(process.env.ADAPTIVE_THROTTLE_MAX_BLOCK_MS || '300000', 10);

function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

function decayScore(score: number, elapsedMs: number): number {
  if (elapsedMs <= 0) {
    return score;
  }
  const decayFactor = Math.pow(0.5, elapsedMs / Math.max(1000, HALFLIFE_MS));
  return score * decayFactor;
}

function scoreForStatus(statusCode: number): number {
  if (statusCode === 401 || statusCode === 403) return 1.5;
  if (statusCode === 404) return 0.5;
  if (statusCode >= 400 && statusCode < 500) return 1;
  return 0;
}

export function adaptiveThrottleMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = getIp(req);
  const now = Date.now();
  const existing = abuseByIp.get(ip);

  if (existing) {
    existing.score = decayScore(existing.score, now - existing.lastSeenAt);
    existing.lastSeenAt = now;

    if (existing.blockedUntil > now) {
      const retryAfter = Math.ceil((existing.blockedUntil - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        error: 'Too many invalid requests',
        status: 429,
        message: 'Adaptive throttle activated due to repeated invalid requests.',
        retryAfter,
      });
      return;
    }
  }

  res.on('finish', () => {
    if (res.statusCode < 400 || res.statusCode >= 500) {
      return;
    }

    const state = abuseByIp.get(ip) || {
      score: 0,
      blockedUntil: 0,
      lastSeenAt: now,
    };

    const current = Date.now();
    state.score = decayScore(state.score, current - state.lastSeenAt);
    state.lastSeenAt = current;
    state.score += scoreForStatus(res.statusCode);

    if (state.score >= SCORE_THRESHOLD) {
      const multiplier = Math.max(1, Math.floor(state.score / SCORE_THRESHOLD));
      const blockMs = Math.min(MAX_BLOCK_MS, BASE_BLOCK_MS * multiplier);
      state.blockedUntil = current + blockMs;

      logger.log('warn', 'Adaptive throttle triggered', {
        ip,
        score: Number(state.score.toFixed(2)),
        blockMs,
        path: req.path,
      });
    }

    abuseByIp.set(ip, state);
  });

  next();
}

export function resetAdaptiveThrottleStateForTests(): void {
  abuseByIp.clear();
}
