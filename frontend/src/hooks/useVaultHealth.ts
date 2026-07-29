import { useQuery } from "@tanstack/react-query";
import { getVaultHealth } from "../lib/vaultHealthApi";
import { queryKeys } from "../lib/queryClient";

/** Poll interval for real-time vault health indicators (15 seconds). */
export const VAULT_HEALTH_POLL_INTERVAL_MS = 15_000;

/**
 * Hook for fetching vault health with caching and 15s polling.
 *
 * @param enabled - Optional flag to enable/disable polling (defaults to true)
 */
export function useVaultHealth(enabled = true) {
  return useQuery({
    queryKey: queryKeys.vault.health(),
    queryFn: getVaultHealth,
    staleTime: VAULT_HEALTH_POLL_INTERVAL_MS,
    refetchInterval: VAULT_HEALTH_POLL_INTERVAL_MS,
    enabled,
  });
}
