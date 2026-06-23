import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createTransactionIntent,
  generateIdempotencyKey,
  getStoredTransactionIntent,
  isIntentStale,
  rotateIdempotencyKey,
  storeTransactionIntent,
} from "./transactionIntent";

describe("transactionIntent", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("generates unique idempotency keys", () => {
    const first = generateIdempotencyKey();
    const second = generateIdempotencyKey();
    expect(first).not.toBe(second);
  });

  it("stores and retrieves intents from session storage", () => {
    const intent = createTransactionIntent({
      action: "deposit",
      amount: 25,
      walletAddress: "GABC123",
      snapshotHash: "deposit|25|500",
    });

    storeTransactionIntent(intent);

    expect(getStoredTransactionIntent("GABC123", "deposit")).toEqual(intent);
  });

  it("marks intents stale when snapshot hash changes", () => {
    const intent = createTransactionIntent({
      action: "withdraw",
      amount: 10,
      walletAddress: "GABC123",
      snapshotHash: "withdraw|10|100",
    });

    expect(isIntentStale(intent, "withdraw|10|100")).toBe(false);
    expect(isIntentStale(intent, "withdraw|10|90")).toBe(true);
  });

  it("rotates idempotency keys while preserving intent metadata", () => {
    const intent = createTransactionIntent({
      action: "deposit",
      amount: 50,
      walletAddress: "GABC123",
      snapshotHash: "deposit|50|500",
    });

    const rotated = rotateIdempotencyKey(intent);

    expect(rotated.idempotencyKey).not.toBe(intent.idempotencyKey);
    expect(rotated.amount).toBe(intent.amount);
    expect(getStoredTransactionIntent("GABC123", "deposit")?.idempotencyKey).toBe(
      rotated.idempotencyKey,
    );
  });
});
