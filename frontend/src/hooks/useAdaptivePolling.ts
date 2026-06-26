import { useCallback } from "react";
import { usePolling } from "./usePolling";
import { useNetworkQuality, getAdaptiveInterval } from "./useNetworkQuality";

interface UseAdaptivePollingOptions {
  baseInterval: number;
  enabled?: boolean;
  pauseOnHidden?: boolean;
  pauseOnOffline?: boolean;
  adaptive?: boolean;
}

interface UseAdaptivePollingResult {
  isPolling: boolean;
  isPaused: boolean;
  pauseReason: "hidden" | "offline" | "manual" | null;
  pause: () => void;
  resume: () => void;
  forceRefresh: () => void;
  effectiveInterval: number;
  quality: ReturnType<typeof useNetworkQuality>["quality"];
}

export function useAdaptivePolling(
  refetchFn: () => Promise<unknown>,
  options: UseAdaptivePollingOptions,
): UseAdaptivePollingResult {
  const {
    baseInterval,
    enabled = true,
    pauseOnHidden = true,
    pauseOnOffline = true,
    adaptive = true,
  } = options;

  const { quality } = useNetworkQuality({ enabled: adaptive && enabled });

  const effectiveInterval = adaptive
    ? getAdaptiveInterval(baseInterval, quality)
    : baseInterval;

  const polling = usePolling(refetchFn, {
    interval: effectiveInterval,
    enabled,
    pauseOnHidden,
    pauseOnOffline,
  });

  const forceRefresh = useCallback(() => {
    polling.forceRefresh();
  }, [polling]);

  return {
    ...polling,
    forceRefresh,
    effectiveInterval,
    quality,
  };
}
