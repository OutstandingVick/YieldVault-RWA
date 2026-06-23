import { describe, it, expect } from "vitest";
import {
  captureFormSnapshot,
  detectStaleSubmission,
  snapshotHashFromForm,
} from "./staleSubmissionDetection";

describe("staleSubmissionDetection", () => {
  const baseSnapshot = captureFormSnapshot({
    action: "deposit",
    amount: 100,
    availableBalance: 500,
    feeXlm: 0.05,
    isCapReached: false,
    slippage: 0.5,
  });

  it("returns not stale when snapshots match", () => {
    const result = detectStaleSubmission(baseSnapshot, { ...baseSnapshot });
    expect(result.isStale).toBe(false);
    expect(result.changes).toHaveLength(0);
  });

  it("detects amount and balance changes", () => {
    const current = captureFormSnapshot({
      action: "deposit",
      amount: 90,
      availableBalance: 450,
      feeXlm: 0.05,
      isCapReached: false,
      slippage: 0.5,
    });

    const result = detectStaleSubmission(baseSnapshot, current);

    expect(result.isStale).toBe(true);
    expect(result.changes.map((change) => change.field)).toEqual([
      "amount",
      "availableBalance",
    ]);
  });

  it("detects fee and vault cap changes", () => {
    const current = captureFormSnapshot({
      action: "deposit",
      amount: 100,
      availableBalance: 500,
      feeXlm: 0.08,
      isCapReached: true,
      slippage: 0.5,
    });

    const result = detectStaleSubmission(baseSnapshot, current);

    expect(result.isStale).toBe(true);
    expect(result.changes.map((change) => change.field)).toContain("feeXlm");
    expect(result.changes.map((change) => change.field)).toContain("isCapReached");
  });

  it("builds a stable snapshot hash", () => {
    const hash = snapshotHashFromForm(baseSnapshot);
    expect(hash).toContain("deposit");
    expect(hash).toContain("100");
  });
});
