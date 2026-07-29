import { z } from "zod";
import { apiClient } from "./apiClient";
import { validate } from "./api";

export const VaultHealthStatusSchema = z.enum([
  "healthy",
  "degraded",
  "unhealthy",
]);

export const VaultHealthRecordSchema = z.object({
  vaultId: z.string().min(1),
  name: z.string().min(1),
  status: VaultHealthStatusSchema,
  latencyMs: z.number().nonnegative(),
  uptimePct: z.number().min(0).max(100),
  lastCheckedAt: z.string().min(1),
  message: z.string(),
});

export const VaultHealthResponseSchema = z.array(VaultHealthRecordSchema);

export type VaultHealthStatus = z.infer<typeof VaultHealthStatusSchema>;
export type VaultHealthRecord = z.infer<typeof VaultHealthRecordSchema>;

/**
 * Fetch live vault health indicators from the mock (or upstream) health API.
 * Response is validated with Zod before returning.
 */
export async function getVaultHealth(): Promise<VaultHealthRecord[]> {
  const data = await apiClient.get<unknown>("/mock-api/vault-health.json");
  return validate(VaultHealthResponseSchema, data, "VaultHealth");
}
