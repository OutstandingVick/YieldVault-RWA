import { describe, expect, it } from "vitest";
import {
  COMPARISON_METRICS,
  DEFAULT_SELECTION,
  MAX_COMPARISON_SELECTION,
  RISK_TIER_RANK,
  VAULT_STRATEGIES,
  findBestStrategyIds,
  findStrategy,
  formatLiquidityCadence,
  formatLockup,
  formatSettlement,
  getApySpread,
  getComparisonMetric,
  parseSelectionParam,
  parseSortDirection,
  serializeSelectionParam,
  sortStrategies,
  toggleStrategySelection,
} from "./vaultStrategies";
import type { VaultStrategy } from "./vaultStrategies";

function makeStrategy(overrides: Partial<VaultStrategy> & { id: string }): VaultStrategy {
  return {
    name: `Strategy ${overrides.id}`,
    issuer: "Test Issuer",
    apyPercent: 5,
    liquidityDays: 1,
    lockupDays: 0,
    riskTier: "low",
    settlementDays: 1,
    minimumDepositUsd: 100,
    note: "Test strategy.",
    accent: "var(--accent-cyan)",
    ...overrides,
  };
}

describe("vault strategy catalog", () => {
  it("exposes unique strategy ids", () => {
    const ids = VAULT_STRATEGIES.map((strategy) => strategy.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("stores metrics as numbers so they can be ranked", () => {
    VAULT_STRATEGIES.forEach((strategy) => {
      expect(Number.isFinite(strategy.apyPercent)).toBe(true);
      expect(Number.isFinite(strategy.liquidityDays)).toBe(true);
      expect(Number.isFinite(strategy.lockupDays)).toBe(true);
      expect(Number.isFinite(strategy.settlementDays)).toBe(true);
      expect(Number.isFinite(strategy.minimumDepositUsd)).toBe(true);
      expect(RISK_TIER_RANK[strategy.riskTier]).toBeGreaterThanOrEqual(0);
    });
  });

  it("defaults to two selectable strategies", () => {
    expect(DEFAULT_SELECTION).toHaveLength(2);
    DEFAULT_SELECTION.forEach((id) => expect(findStrategy(id)).toBeDefined());
  });

  it("resolves metrics by id and returns undefined for unknown ids", () => {
    expect(getComparisonMetric("apy")?.label).toBe("APY");
    expect(getComparisonMetric("not-a-metric")).toBeUndefined();
  });

  it("gives every metric a numeric projection and a formatter", () => {
    const strategy = VAULT_STRATEGIES[0];
    COMPARISON_METRICS.forEach((metric) => {
      expect(Number.isFinite(metric.valueOf(strategy))).toBe(true);
      expect(metric.format(strategy)).not.toBe("");
    });
  });
});

describe("day formatting", () => {
  it("collapses liquidity cadences to plain words", () => {
    expect(formatLiquidityCadence(0)).toBe("Instant");
    expect(formatLiquidityCadence(1)).toBe("Daily");
    expect(formatLiquidityCadence(7)).toBe("Weekly");
    expect(formatLiquidityCadence(30)).toBe("Monthly");
    expect(formatLiquidityCadence(3)).toBe("Every 3 days");
  });

  it("formats lockups, singular and plural", () => {
    expect(formatLockup(0)).toBe("None");
    expect(formatLockup(1)).toBe("1 day");
    expect(formatLockup(7)).toBe("7 days");
  });

  it("formats settlement in the T+n convention", () => {
    expect(formatSettlement(0)).toBe("Immediate (T+0)");
    expect(formatSettlement(2)).toBe("T+2");
  });
});

describe("toggleStrategySelection", () => {
  it("adds a strategy that is not selected", () => {
    expect(toggleStrategySelection(["a"], "b")).toEqual(["a", "b"]);
  });

  it("removes a strategy that is already selected", () => {
    expect(toggleStrategySelection(["a", "b"], "a")).toEqual(["b"]);
  });

  it("returns the identical array when the cap blocks the addition", () => {
    const current = ["a", "b", "c"];
    const next = toggleStrategySelection(current, "d", 3);
    // Referential equality is the signal callers use to show "limit reached".
    expect(next).toBe(current);
  });

  it("still allows deselection at the cap", () => {
    expect(toggleStrategySelection(["a", "b", "c"], "b", 3)).toEqual(["a", "c"]);
  });

  it("honours the default cap of three", () => {
    const current = ["benji", "treasury-ladder", "credit-income"];
    expect(toggleStrategySelection(current, "liquidity-buffer")).toBe(current);
    expect(MAX_COMPARISON_SELECTION).toBe(3);
  });
});

describe("parseSelectionParam", () => {
  it("falls back to the default selection when the param is absent", () => {
    expect(parseSelectionParam(null)).toEqual([...DEFAULT_SELECTION]);
  });

  it("honours an explicitly empty param so 'clear all' survives a reload", () => {
    expect(parseSelectionParam("")).toEqual([]);
  });

  it("reads a comma separated list", () => {
    expect(parseSelectionParam("benji,liquidity-buffer")).toEqual([
      "benji",
      "liquidity-buffer",
    ]);
  });

  it("preserves the order given in the URL", () => {
    expect(parseSelectionParam("liquidity-buffer,benji")).toEqual([
      "liquidity-buffer",
      "benji",
    ]);
  });

  it("drops ids that are not in the catalog", () => {
    expect(parseSelectionParam("benji,<script>,treasury-ladder")).toEqual([
      "benji",
      "treasury-ladder",
    ]);
  });

  it("collapses duplicates to the first occurrence", () => {
    expect(parseSelectionParam("benji,benji,treasury-ladder")).toEqual([
      "benji",
      "treasury-ladder",
    ]);
  });

  it("truncates anything beyond the cap", () => {
    const parsed = parseSelectionParam(
      "benji,treasury-ladder,credit-income,liquidity-buffer",
    );
    expect(parsed).toHaveLength(MAX_COMPARISON_SELECTION);
    expect(parsed).toEqual(["benji", "treasury-ladder", "credit-income"]);
  });

  it("tolerates whitespace and empty segments", () => {
    expect(parseSelectionParam(" benji , ,treasury-ladder ")).toEqual([
      "benji",
      "treasury-ladder",
    ]);
  });

  it("round-trips through serializeSelectionParam", () => {
    const ids = ["benji", "credit-income"];
    expect(parseSelectionParam(serializeSelectionParam(ids))).toEqual(ids);
  });
});

describe("parseSortDirection", () => {
  it("accepts known directions", () => {
    expect(parseSortDirection("asc")).toBe("asc");
    expect(parseSortDirection("desc")).toBe("desc");
  });

  it("falls back for missing or bogus values", () => {
    expect(parseSortDirection(null)).toBe("desc");
    expect(parseSortDirection("sideways")).toBe("desc");
    expect(parseSortDirection(null, "asc")).toBe("asc");
  });
});

describe("sortStrategies", () => {
  const apy = getComparisonMetric("apy")!;
  const risk = getComparisonMetric("risk")!;

  it("returns a copy without mutating the input", () => {
    const input = [...VAULT_STRATEGIES];
    const originalOrder = input.map((strategy) => strategy.id);
    sortStrategies(input, apy, "desc");
    expect(input.map((strategy) => strategy.id)).toEqual(originalOrder);
  });

  it("orders by APY descending", () => {
    const sorted = sortStrategies(VAULT_STRATEGIES, apy, "desc");
    expect(sorted.map((strategy) => strategy.id)).toEqual([
      "credit-income",
      "benji",
      "treasury-ladder",
      "liquidity-buffer",
    ]);
  });

  it("orders by APY ascending", () => {
    const sorted = sortStrategies(VAULT_STRATEGIES, apy, "asc");
    expect(sorted[0].id).toBe("liquidity-buffer");
    expect(sorted[sorted.length - 1].id).toBe("credit-income");
  });

  it("orders risk by its ordinal rank, not its label", () => {
    const sorted = sortStrategies(VAULT_STRATEGIES, risk, "asc");
    expect(sorted.map((strategy) => strategy.riskTier)).toEqual([
      "very-low",
      "low",
      "moderate",
      "elevated",
    ]);
  });

  it("breaks ties on name so ordering is stable", () => {
    const tied = [
      makeStrategy({ id: "z", name: "Zeta", apyPercent: 5 }),
      makeStrategy({ id: "a", name: "Alpha", apyPercent: 5 }),
    ];
    expect(sortStrategies(tied, apy, "desc").map((s) => s.name)).toEqual([
      "Alpha",
      "Zeta",
    ]);
  });

  it("leaves the order untouched when no metric is given", () => {
    const sorted = sortStrategies(VAULT_STRATEGIES, undefined, "desc");
    expect(sorted.map((strategy) => strategy.id)).toEqual(
      VAULT_STRATEGIES.map((strategy) => strategy.id),
    );
  });
});

describe("findBestStrategyIds", () => {
  const apy = getComparisonMetric("apy")!;
  const lockup = getComparisonMetric("lockup")!;

  it("picks the highest value when higher is better", () => {
    expect(findBestStrategyIds(VAULT_STRATEGIES, apy)).toEqual(["credit-income"]);
  });

  it("picks the lowest value when lower is better", () => {
    const strategies = [
      makeStrategy({ id: "a", lockupDays: 7 }),
      makeStrategy({ id: "b", lockupDays: 2 }),
    ];
    expect(findBestStrategyIds(strategies, lockup)).toEqual(["b"]);
  });

  it("marks every strategy sharing the best value", () => {
    const strategies = [
      makeStrategy({ id: "a", apyPercent: 9 }),
      makeStrategy({ id: "b", apyPercent: 9 }),
      makeStrategy({ id: "c", apyPercent: 4 }),
    ];
    expect(findBestStrategyIds(strategies, apy)).toEqual(["a", "b"]);
  });

  it("marks nothing when every value ties, since there is no signal", () => {
    const strategies = [
      makeStrategy({ id: "a", apyPercent: 7 }),
      makeStrategy({ id: "b", apyPercent: 7 }),
    ];
    expect(findBestStrategyIds(strategies, apy)).toEqual([]);
  });

  it("marks nothing when there is nothing to compare against", () => {
    expect(findBestStrategyIds([VAULT_STRATEGIES[0]], apy)).toEqual([]);
    expect(findBestStrategyIds([], apy)).toEqual([]);
  });
});

describe("getApySpread", () => {
  it("measures the gap between the best and worst APY", () => {
    const strategies = [
      makeStrategy({ id: "a", apyPercent: 9.15 }),
      makeStrategy({ id: "b", apyPercent: 5.2 }),
    ];
    expect(getApySpread(strategies)).toBeCloseTo(3.95, 10);
  });

  it("is zero when there is nothing to span", () => {
    expect(getApySpread([])).toBe(0);
    expect(getApySpread([VAULT_STRATEGIES[0]])).toBe(0);
  });
});
