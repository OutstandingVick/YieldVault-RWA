import crypto from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  correlationId?: string;
  originService?: string;
  parentJobId?: string;
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

/**
 * Returns the full request context snapshot for serialization into job
 * payloads, queue messages, or worker metadata.
 */
export function captureRequestContext(): RequestContext | null {
  return requestIdStorage.getStore() ?? null;
}

/**
 * Runs a callback within a restored request context. Use this to propagate
 * request IDs across async job boundaries (queues, workers, setTimeout).
 */
export function runWithRequestContext<T>(
  ctx: RequestContext,
  fn: () => T,
): T {
  return requestIdStorage.run(ctx, fn);
}

/**
 * Wraps an async task function so that the current request context is
 * captured at enqueue time and restored when the task executes.
 */
export function wrapWithContext<T extends (...args: any[]) => any>(fn: T): T {
  const captured = captureRequestContext();
  if (!captured) return fn;

  const wrapped = (...args: any[]) => {
    return requestIdStorage.run(captured, () => fn(...args));
  };
  return wrapped as T;
}

/**
 * Serializes the current request context into a plain object suitable
 * for inclusion in job payloads or queue message headers.
 */
export function serializeContext(): Record<string, string> | null {
  const ctx = requestIdStorage.getStore();
  if (!ctx) return null;

  const result: Record<string, string> = {
    requestId: ctx.requestId,
  };
  if (ctx.correlationId) result.correlationId = ctx.correlationId;
  if (ctx.originService) result.originService = ctx.originService;
  if (ctx.parentJobId) result.parentJobId = ctx.parentJobId;

  return result;
}

/**
 * Deserializes a plain object back into a RequestContext and runs the
 * callback within that context.
 */
export function runWithSerializedContext<T>(
  serialized: Record<string, string> | null | undefined,
  fn: () => T,
): T {
  if (!serialized || !serialized.requestId) {
    const fallback: RequestContext = { requestId: createRequestId() };
    return requestIdStorage.run(fallback, fn);
  }

  const ctx: RequestContext = {
    requestId: serialized.requestId,
    correlationId: serialized.correlationId,
    originService: serialized.originService,
    parentJobId: serialized.parentJobId,
  };

  return requestIdStorage.run(ctx, fn);
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
