import crypto from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  correlationId?: string;
}

/**
 * AsyncLocalStorage instance that carries request context across async
 * boundaries including queued jobs, worker callbacks, and setTimeout chains.
 * Store a RequestContext value at the HTTP handler entry point and read it
 * anywhere downstream with requestIdStorage.getStore().
 */
export const requestIdStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Returns the request ID from the active AsyncLocalStorage context, or
 * undefined when called outside of a stored context (e.g. background timers).
 */
export function getActiveRequestId(): string | undefined {
  return requestIdStorage.getStore()?.requestId;
}

/**
 * Returns the correlation ID from the active AsyncLocalStorage context.
 */
export function getActiveCorrelationId(): string | undefined {
  return requestIdStorage.getStore()?.correlationId;
}

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function normalizeRequestId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) {
    return null;
  }

  return /^[A-Za-z0-9._:-]+$/.test(trimmed) ? trimmed : null;
}
