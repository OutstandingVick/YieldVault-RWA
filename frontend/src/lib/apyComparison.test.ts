import { describe, it, expect } from "vitest";
import { APY_BENCHMARKS, buildApyComparisons } from "./apyComparison";

const FIXED_NOW = new Date("2026-03-25T12:00:00.000Z");

describe("buildApyComparisons", () => {
  it("returns cards sorted deterministically by id", () => {
    const cards = buildApyComparisons({
      vaultApy: 8.45,
      vaultUpdatedAt: "2026-03-25T10:00:00.000Z",
      vaultHistoryPointCount: 27,
      now: FIXED_NOW,
    });

    expect(cards.map((card) => card.id)).toEqual([
      "defi-stablecoin",
      "money-market",
      "us-tbills",
      "vault",
    ]);
  });

  it("computes vault-relative deltas deterministically", () => {
    const cards = buildApyComparisons({
      vaultApy: 8.45,
      vaultUpdatedAt: "2026-03-25T10:00:00.000Z",
      vaultHistoryPointCount: 27,
      now: FIXED_NOW,
    });

    const vault = cards.find((card) => card.id === "vault");
    const tbills = cards.find((card) => card.id === "us-tbills");

    expect(vault?.deltaVsVault).toBe(0);
    expect(tbills?.deltaVsVault).toBe(-3.2);
  });

  it("includes confidence metadata on every card", () => {
    const cards = buildApyComparisons({
      vaultApy: 8.45,
      vaultUpdatedAt: "2026-03-25T10:00:00.000Z",
      vaultHistoryPointCount: 27,
      now: FIXED_NOW,
    });

    for (const card of cards) {
      expect(card.confidence.level).toMatch(/high|medium|low/);
      expect(card.confidence.label.length).toBeGreaterThan(0);
    }
  });

  it("uses the fixed benchmark catalog", () => {
    expect(APY_BENCHMARKS).toHaveLength(3);
    expect(APY_BENCHMARKS[0]?.id).toBe("us-tbills");
  });
});
