import { useQuery } from "@tanstack/react-query";
import { getVaultSummary, getVaultHistory } from "../lib/vaultApi";
import { queryKeys } from "../lib/queryClient";

/**
 * Hook for fetching vault summary with caching and polling.
 * Stale time: 30s (vault metrics update slowly)
 * Refetch interval: 30s (auto-refresh every 30 seconds)
 *
 * @param enabled - Optional flag to enable/disable polling (defaults to true)
 *                  Pass `isOnline` from useNetworkStatus to pause polling when offline
 *
 * @example
 * ```tsx
 * const { isOnline } = useNetworkStatus();
 * const vaultSummary = useVaultSummary(isOnline);
 * ```
 */
export function useVaultSummary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.vault.summary(),
    queryFn: getVaultSummary,
    staleTime: 30000, // 30 seconds
    refetchInterval: 30000, // 30 seconds
    enabled, // Support pause/resume based on network status
  });
}

/**
 * Hook for fetching vault performance history with caching.
 * Stale time: 60s (historical data changes infrequently)
 * No polling for history data (changes infrequently)
 */
export function useVaultHistory() {
  return useQuery({
    queryKey: queryKeys.vault.history(),
    queryFn: getVaultHistory,
    staleTime: 60000, // 60 seconds
  });
}
