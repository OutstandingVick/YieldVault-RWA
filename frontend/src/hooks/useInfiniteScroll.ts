import { useCallback, useEffect, useRef, useState } from "react";

export interface UseInfiniteScrollOptions {
  /** Distance in pixels from the bottom of the container to trigger loading more. */
  threshold?: number;
  /** Whether to enable the infinite scroll behavior. */
  enabled?: boolean;
}

export interface UseInfiniteScrollReturn {
  /** Ref to attach to the sentinel element at the bottom of the list. */
  sentinelRef: React.RefCallback<HTMLElement>;
  /** Whether a new page is currently being loaded. */
  isLoadingMore: boolean;
  /** Set loading state externally (e.g. after fetching). */
  setIsLoadingMore: (loading: boolean) => void;
}

/**
 * Custom hook that uses IntersectionObserver to detect when the user scrolls
 * near the bottom of a list, triggering a callback to load more data.
 *
 * Attach `sentinelRef` to an element placed at the end of your list.
 * When that element becomes visible, `onLoadMore` is called.
 */
export function useInfiniteScroll(
  onLoadMore: () => void,
  options: UseInfiniteScrollOptions = {},
): UseInfiniteScrollReturn {
  const { threshold = 0, enabled = true } = options;
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);

  // Keep the callback ref up-to-date without resubscribing the observer.
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      // Disconnect old observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!node || !enabled) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry.isIntersecting) {
            onLoadMoreRef.current();
          }
        },
        {
          rootMargin: `0px 0px ${threshold}px 0px`,
        },
      );

      observerRef.current.observe(node);
    },
    [enabled, threshold],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return { sentinelRef, isLoadingMore, setIsLoadingMore };
}
