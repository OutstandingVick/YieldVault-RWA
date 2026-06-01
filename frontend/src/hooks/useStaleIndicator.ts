import { useSyncExternalStore, useCallback, useRef } from 'react';

/** Threshold in ms after which data is considered stale for display purposes. */
const STALE_THRESHOLD_MS = 60_000; // 1 minute

function subscribeToTime(cb: () => void): () => void {
  const id = setInterval(cb, 15_000);
  return () => clearInterval(id);
}

export interface StaleIndicatorResult {
  /** True when lastUpdated is older than STALE_THRESHOLD_MS. */
  isStale: boolean;
  /** Human-readable age string, e.g. "2 min ago". Empty when no date. */
  ageText: string;
}

function computeSnapshot(lastUpdated: Date | null | undefined): StaleIndicatorResult {
  if (!lastUpdated) return { isStale: false, ageText: '' };

  const ageMs = Date.now() - lastUpdated.getTime();
  const isStale = ageMs > STALE_THRESHOLD_MS;

  const seconds = Math.floor(ageMs / 1000);
  let ageText = '';
  if (seconds < 60) {
    ageText = 'just now';
  } else {
    const minutes = Math.floor(seconds / 60);
    ageText = minutes === 1 ? '1 min ago' : `${minutes} min ago`;
  }

  return { isStale, ageText };
}

/**
 * Derives a live-updating stale indicator from a `lastUpdated` timestamp.
 * Re-evaluates every 15 seconds via `useSyncExternalStore`.
 */
export function useStaleIndicator(lastUpdated: Date | null | undefined): StaleIndicatorResult {
  // Cache the last returned snapshot so useSyncExternalStore gets a stable
  // reference when the computed value hasn't changed (avoids infinite loops).
  const cacheRef = useRef<StaleIndicatorResult | null>(null);

  const getSnapshot = useCallback((): StaleIndicatorResult => {
    const next = computeSnapshot(lastUpdated);
    const prev = cacheRef.current;
    if (prev && prev.isStale === next.isStale && prev.ageText === next.ageText) {
      return prev;
    }
    cacheRef.current = next;
    return next;
  }, [lastUpdated]);

  return useSyncExternalStore(subscribeToTime, getSnapshot, getSnapshot);
}
