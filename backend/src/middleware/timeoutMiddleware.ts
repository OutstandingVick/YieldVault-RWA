import type { Request, Response, NextFunction } from 'express';
import { logger, LogLevel } from './structuredLogging';

/**
 * Configuration options for the timeout middleware
 */
export interface TimeoutOptions {
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Optional: custom fallback response to send on timeout */
  fallbackResponse?: (req: Request) => Record<string, unknown>;
  /** Optional: custom message for the timeout */
  message?: string;
}

/**
 * Default timeout configuration
 */
export const DEFAULT_TIMEOUT_OPTIONS: TimeoutOptions = {
  timeoutMs: 30000, // 30 seconds default
  message: 'Request timed out',
};

/**
 * Express middleware that adds per-request timeout budgets
 * and returns graceful fallback responses
 */
export function timeoutMiddleware(options: TimeoutOptions = DEFAULT_TIMEOUT_OPTIONS) {
  const { timeoutMs, fallbackResponse, message } = {
    ...DEFAULT_TIMEOUT_OPTIONS,
    ...options,
  };

  return (req: Request, res: Response, next: NextFunction) => {
    let timeoutId: NodeJS.Timeout | null = null;
    let isResponded = false;

    // Cleanup function
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    // Set up the timeout
    timeoutId = setTimeout(() => {
      if (!isResponded && !res.headersSent) {
        isResponded = true;
        logger.log(LogLevel.WARN, 'Request timed out', {
          path: req.path,
          method: req.method,
          timeoutMs,
        });

        // Send fallback response
        const response = fallbackResponse ? fallbackResponse(req) : {
          error: 'Request Timeout',
          status: 408,
          message: message || DEFAULT_TIMEOUT_OPTIONS.message,
          retryAfter: Math.ceil(timeoutMs / 1000),
          timestamp: new Date().toISOString(),
        };

        res.status(408).json(response);
        cleanup();
      }
    }, timeoutMs);

    // Hook into response events to clean up
    const originalEnd = res.end;
    const originalWrite = res.write;

    // Override end to clean up timeout
    res.end = (...args: any[]) => {
      if (!isResponded) {
        isResponded = true;
        cleanup();
      }
      return originalEnd.apply(res, args);
    };

    // Also clean up on write (in case response is streamed)
    res.write = (...args: any[]) => {
      if (!isResponded) {
        isResponded = true;
        cleanup();
      }
      return originalWrite.apply(res, args);
    };

    // Clean up on request close or error
    req.on('close', cleanup);
    req.on('error', cleanup);

    next();
  };
}

/**
 * Helper function to create a timeout middleware for common route types
 */
export const createTimeoutFor = {
  /** Read‑heavy endpoints (5 seconds) */
  read: () => timeoutMiddleware({ timeoutMs: 5000 }),
  /** Write operations (15 seconds) */
  write: () => timeoutMiddleware({ timeoutMs: 15000 }),
  /** Admin operations (30 seconds) */
  admin: () => timeoutMiddleware({ timeoutMs: 30000 }),
  /** Export/download endpoints (60 seconds) */
  export: () => timeoutMiddleware({ timeoutMs: 60000 }),
};
