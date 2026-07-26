import { describe, expect, it } from "vitest";
import {
  AmountInputSchema,
  AmountSchema,
  DepositRequestSchema,
  VaultDepositBodySchema,
  VaultOperationResponseSchema,
  VaultWithdrawalBodySchema,
  WithdrawalRequestSchema,
} from "./index";

const VALID_ADDRESS = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

describe("shared vault request schemas", () => {
  it("accepts canonical deposit payloads from the frontend client", () => {
    const result = DepositRequestSchema.safeParse({
      walletAddress: VALID_ADDRESS,
      amount: "500.25",
      asset: "USDC",
    });

    expect(result.success).toBe(true);
  });

  it("accepts canonical withdrawal payloads from the frontend client", () => {
    const result = WithdrawalRequestSchema.safeParse({
      walletAddress: VALID_ADDRESS,
      amount: "100",
      asset: "USDC",
    });

    expect(result.success).toBe(true);
  });

  it("normalizes numeric backend deposit amounts to strings", () => {
    const result = VaultDepositBodySchema.safeParse({
      walletAddress: VALID_ADDRESS,
      amount: 100,
      asset: "USDC",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe("100");
    }
  });

  it("normalizes numeric backend withdrawal amounts to strings", () => {
    const result = VaultWithdrawalBodySchema.safeParse({
      walletAddress: VALID_ADDRESS,
      amount: 50.5,
      asset: "USDC",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe("50.5");
    }
  });

  it("rejects unsupported assets for both consumers", () => {
    const result = VaultDepositBodySchema.safeParse({
      walletAddress: VALID_ADDRESS,
      amount: "10",
      asset: "BTC",
    });

    expect(result.success).toBe(false);
  });

  it("validates vault operation response shape", () => {
    const result = VaultOperationResponseSchema.safeParse({
      id: "tx-abc123",
      type: "deposit",
      amount: "100",
      asset: "USDC",
      walletAddress: VALID_ADDRESS,
      transactionHash: "hash",
      status: "pending",
      timestamp: new Date().toISOString(),
    });

    expect(result.success).toBe(true);
  });
});

describe("AmountSchema", () => {
  it("rejects more than 7 decimal places", () => {
    expect(AmountSchema.safeParse("1.00000001").success).toBe(false);
  });

  it("accepts AmountInputSchema numeric values", () => {
    const result = AmountInputSchema.safeParse(42);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("42");
    }
  });
});
