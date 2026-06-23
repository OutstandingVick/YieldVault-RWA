import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook that tracks if any active query is currently in a retry cycle.
 * Provides the seconds remaining until the next retry attempt based on React Query's
 * configured retry delays and the last error timestamp.
 *
 * @returns {{
 *   isRetrying: boolean;
 *   secondsUntilRetry: number | null;
 * }} Retry state with countdown
 *
 * This hook subscribes to React Query's cache to detect when queries enter error/retry states.
 * It computes the countdown based on configured retry delays.
 *
 * @example
 * ```tsx
 * const { isRetrying, secondsUntilRetry } = useRetryState();
 * if (isRetrying) {
 *   return <div>Retrying in {secondsUntilRetry}s...</div>;
 * }
 * ```
 */
export function useRetryState() {
  const queryClient = useQueryClient();
  const [isRetrying, setIsRetrying] = useState(false);
  const [secondsUntilRetry, setSecondsUntilRetry] = useState<number | null>(null);
  const lastErrorTimeRef = useRef<number | null>(null);
  const retryDelayRef = useRef<number>(1000); // Default 1s, will be updated

  useEffect(() => {
    // Subscribe to query cache updates to detect retry cycles
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      // Check if any query is in an error state (will trigger retry if not exhausted)
      const cache = queryClient.getQueryCache();
      let anyRetrying = false;
      let minSecondsUntilRetry: number | null = null;

      cache.getAll().forEach((query) => {
        if (query.getObserversCount() > 0) {
          // Only consider observed (active) queries
          const state = query.state;

          // Detect if query is in error state (likely to retry)
          if (state.status === "error" && state.error) {
            anyRetrying = true;
            lastErrorTimeRef.current = Date.now();

            // Get retry delay from query's meta or use default exponential backoff
            const meta = query.meta as { retryDelay?: number } | undefined;
            const retryDelay = meta?.retryDelay || computeExponentialBackoff(state.dataUpdateCount);
            retryDelayRef.current = retryDelay;

            // Compute seconds until next retry based on last error time
            const retryAt = (lastErrorTimeRef.current || Date.now()) + retryDelay;
            const secondsRemaining = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));

            if (minSecondsUntilRetry === null || secondsRemaining < minSecondsUntilRetry) {
              minSecondsUntilRetry = secondsRemaining;
            }
          }
        }
      });

      setIsRetrying(anyRetrying);
      setSecondsUntilRetry(minSecondsUntilRetry);
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  // Update countdown every second
  useEffect(() => {
    if (!isRetrying) {
      queueMicrotask(() => setSecondsUntilRetry(null));
      return;
    }

    const interval = setInterval(() => {
      if (lastErrorTimeRef.current === null) return;

      const retryAt = lastErrorTimeRef.current + retryDelayRef.current;
      const secondsRemaining = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));

      setSecondsUntilRetry(secondsRemaining);

      if (secondsRemaining === 0) {
        setIsRetrying(false);
        setSecondsUntilRetry(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRetrying]);

  return { isRetrying, secondsUntilRetry };
}

/**
 * Compute exponential backoff delay for React Query retries.
 * Formula: min(1000 * 2^attemptNumber, 30000)
 */
function computeExponentialBackoff(attemptCount: number): number {
  const delay = Math.min(1000 * Math.pow(2, attemptCount), 30000);
  return delay;
}
