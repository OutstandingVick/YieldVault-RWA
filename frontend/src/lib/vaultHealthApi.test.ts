import { beforeEach, describe, expect, it, vi } from "vitest";
import { getVaultHealth, VaultHealthResponseSchema } from "./vaultHealthApi";
import { ValidationError } from "./api";

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock("./apiClient", () => ({
  apiClient: {
    get: mockGet,
  },
}));

const validRecords = [
  {
    vaultId: "vault-1",
    name: "Stellar RWA Yield Fund",
    status: "healthy",
    latencyMs: 48,
    uptimePct: 99.98,
    lastCheckedAt: "2026-07-24T08:45:00.000Z",
    message: "All systems operational",
  },
  {
    vaultId: "vault-3",
    name: "Liquidity Ladder",
    status: "degraded",
    latencyMs: 420,
    uptimePct: 98.2,
    lastCheckedAt: "2026-07-24T08:45:00.000Z",
    message: "Elevated settlement latency",
  },
  {
    vaultId: "vault-6",
    name: "Global Carry Vault",
    status: "unhealthy",
    latencyMs: 2100,
    uptimePct: 94.5,
    lastCheckedAt: "2026-07-24T08:45:00.000Z",
    message: "Oracle feed unreachable",
  },
];

describe("VaultHealthResponseSchema", () => {
  it("accepts a valid vault health payload", () => {
    const result = VaultHealthResponseSchema.safeParse(validRecords);
    expect(result.success).toBe(true);
  });

  it("rejects an unknown status value", () => {
    const result = VaultHealthResponseSchema.safeParse([
      { ...validRecords[0], status: "offline" },
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = VaultHealthResponseSchema.safeParse([
      { vaultId: "vault-1", status: "healthy" },
    ]);
    expect(result.success).toBe(false);
  });
});

describe("getVaultHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validated vault health records", async () => {
    mockGet.mockResolvedValue(validRecords);

    const records = await getVaultHealth();

    expect(mockGet).toHaveBeenCalledWith("/mock-api/vault-health.json");
    expect(records).toEqual(validRecords);
    expect(records).toHaveLength(3);
  });

  it("throws ValidationError when the payload is invalid", async () => {
    mockGet.mockResolvedValue([{ vaultId: "vault-1" }]);

    await expect(getVaultHealth()).rejects.toBeInstanceOf(ValidationError);
  });
});
