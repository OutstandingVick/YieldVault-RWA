import { formatCurrency, formatPercent } from "./formatters";

/**
 * Vault strategy catalog and the comparison primitives behind the
 * multi-strategy selection screen (`/compare`).
 *
 * The catalog is served locally on purpose: the backend exposes no strategy
 * listing endpoint yet (see `backend/src/vaultEndpoints.ts`), so this module is
 * the single fixture source the UI reads from. Metrics are stored as **numbers**
 * rather than pre-formatted strings so the screen can sort them, rank
 * best-in-class values, and locale-format them at render time. When a
 * `GET /vault/strategies` endpoint lands, only `VAULT_STRATEGIES` needs to be
 * swapped for a fetch — `COMPARISON_METRICS` and the selection helpers below
 * stay unchanged.
 */

// ─── Risk tiers ───────────────────────────────────────────────────────────────

export type RiskTier = "very-low" | "low" | "moderate" | "elevated";

export const RISK_TIER_LABELS: Record<RiskTier, string> = {
  "very-low": "Very low",
  low: "Low",
  moderate: "Moderate",
  elevated: "Elevated",
};

/** Ordinal risk ranking. Lower is safer, so it sorts ascending by default. */
export const RISK_TIER_RANK: Record<RiskTier, number> = {
  "very-low": 0,
  low: 1,
  moderate: 2,
  elevated: 3,
};

// ─── Strategy shape ───────────────────────────────────────────────────────────

export interface VaultStrategy {
  id: string;
  name: string;
  issuer: string;
  /** Net annualised yield as a percentage, so `8.45` means 8.45%. */
  apyPercent: number;
  /** Redemption cadence in days. `0` means instant. */
  liquidityDays: number;
  /** Mandatory lock-up in days. `0` means none. */
  lockupDays: number;
  riskTier: RiskTier;
  /** Settlement latency in days, i.e. the `n` in `T+n`. */
  settlementDays: number;
  /** Minimum allocation, denominated in the vault's deposit asset (USDC). */
  minimumDepositUsd: number;
  note: string;
  /** CSS custom property used to tint the strategy's card and badges. */
  accent: string;
}

export const VAULT_STRATEGIES: readonly VaultStrategy[] = [
  {
    id: "benji",
    name: "Franklin BENJI Connector",
    issuer: "Franklin Templeton",
    apyPercent: 8.45,
    liquidityDays: 1,
    lockupDays: 0,
    riskTier: "moderate",
    settlementDays: 0,
    minimumDepositUsd: 100,
    note: "Current vault allocation with short-duration sovereign bond exposure.",
    accent: "var(--accent-cyan)",
  },
  {
    id: "treasury-ladder",
    name: "Tokenized Treasury Ladder",
    issuer: "OpenEden",
    apyPercent: 7.9,
    liquidityDays: 1,
    lockupDays: 0,
    riskTier: "low",
    settlementDays: 1,
    minimumDepositUsd: 250,
    note: "Prioritizes capital preservation and predictable liquidity windows.",
    accent: "var(--accent-green)",
  },
  {
    id: "credit-income",
    name: "Private Credit Income",
    issuer: "Ondo Finance",
    apyPercent: 9.15,
    liquidityDays: 7,
    lockupDays: 7,
    riskTier: "elevated",
    settlementDays: 2,
    minimumDepositUsd: 1000,
    note: "Higher yield profile with more settlement friction and monitoring.",
    accent: "var(--text-warning)",
  },
  {
    id: "liquidity-buffer",
    name: "Liquidity Buffer",
    issuer: "YieldVault Treasury",
    apyPercent: 5.2,
    liquidityDays: 0,
    lockupDays: 0,
    riskTier: "very-low",
    settlementDays: 0,
    minimumDepositUsd: 10,
    note: "Keeps most assets in reserve for rapid withdrawals and capital calls.",
    accent: "var(--accent-purple)",
  },
] as const;

// ─── Day formatting helpers ───────────────────────────────────────────────────

/** Renders a redemption cadence, collapsing common intervals to plain words. */
export function formatLiquidityCadence(days: number): string {
  if (days <= 0) return "Instant";
  if (days === 1) return "Daily";
  if (days === 7) return "Weekly";
  if (days === 30) return "Monthly";
  return `Every ${days} days`;
}

/** Renders a mandatory lock-up window. */
export function formatLockup(days: number): string {
  if (days <= 0) return "None";
  return days === 1 ? "1 day" : `${days} days`;
}

/** Renders settlement latency in the `T+n` convention traders expect. */
export function formatSettlement(days: number): string {
  return days <= 0 ? "Immediate (T+0)" : `T+${days}`;
}

// ─── Comparison metrics ───────────────────────────────────────────────────────

export type ComparisonMetricId =
  | "apy"
  | "liquidity"
  | "lockup"
  | "risk"
  | "settlement"
  | "minimum";

export interface ComparisonMetric {
  id: ComparisonMetricId;
  label: string;
  /** Plain-language explanation surfaced to screen readers and tooltips. */
  description: string;
  /** Which direction counts as better when ranking best-in-class. */
  betterIs: "higher" | "lower";
  /** Numeric projection used for sorting and ranking. */
  valueOf: (strategy: VaultStrategy) => number;
  /** Locale-aware display string for the comparison table. */
  format: (strategy: VaultStrategy, locale?: string) => string;
}

export const COMPARISON_METRICS: readonly ComparisonMetric[] = [
  {
    id: "apy",
    label: "APY",
    description: "Net annualised yield. Higher is better.",
    betterIs: "higher",
    valueOf: (strategy) => strategy.apyPercent,
    format: (strategy, locale) => formatPercent(strategy.apyPercent, false, 2, locale),
  },
  {
    id: "liquidity",
    label: "Liquidity",
    description: "How often you can redeem. More frequent is better.",
    betterIs: "lower",
    valueOf: (strategy) => strategy.liquidityDays,
    format: (strategy) => formatLiquidityCadence(strategy.liquidityDays),
  },
  {
    id: "lockup",
    label: "Lockup",
    description: "Period your capital cannot be withdrawn. Shorter is better.",
    betterIs: "lower",
    valueOf: (strategy) => strategy.lockupDays,
    format: (strategy) => formatLockup(strategy.lockupDays),
  },
  {
    id: "risk",
    label: "Risk",
    description: "Issuer and instrument risk tier. Lower is better.",
    betterIs: "lower",
    valueOf: (strategy) => RISK_TIER_RANK[strategy.riskTier],
    format: (strategy) => RISK_TIER_LABELS[strategy.riskTier],
  },
  {
    id: "settlement",
    label: "Settlement",
    description: "Time for a redemption to settle on-chain. Faster is better.",
    betterIs: "lower",
    valueOf: (strategy) => strategy.settlementDays,
    format: (strategy) => formatSettlement(strategy.settlementDays),
  },
  {
    id: "minimum",
    label: "Minimum deposit",
    description: "Smallest allocation the strategy accepts. Lower is better.",
    betterIs: "lower",
    valueOf: (strategy) => strategy.minimumDepositUsd,
    format: (strategy, locale) =>
      formatCurrency(strategy.minimumDepositUsd, "USD", 0, locale),
  },
] as const;

export function getComparisonMetric(
  id: string,
): ComparisonMetric | undefined {
  return COMPARISON_METRICS.find((metric) => metric.id === id);
}

// ─── Selection rules ──────────────────────────────────────────────────────────

/** Comparing more than three columns stops fitting on a laptop viewport. */
export const MAX_COMPARISON_SELECTION = 3;

/** A comparison needs at least two columns to be meaningful. */
export const MIN_COMPARISON_SELECTION = 2;

/** URL query parameter holding the selected strategy ids, comma separated. */
export const SELECTION_PARAM = "strategies";

/** URL query parameter holding the metric the columns are ordered by. */
export const SORT_PARAM = "sortBy";

/** URL query parameter holding the sort direction. */
export const SORT_DIRECTION_PARAM = "direction";

export type SortDirection = "asc" | "desc";

/** The two strategies pre-selected when the URL carries no selection. */
export const DEFAULT_SELECTION: readonly string[] = [
  VAULT_STRATEGIES[0].id,
  VAULT_STRATEGIES[1].id,
];

export function findStrategy(
  id: string,
  catalog: readonly VaultStrategy[] = VAULT_STRATEGIES,
): VaultStrategy | undefined {
  return catalog.find((strategy) => strategy.id === id);
}

/**
 * Adds or removes `id` from the current selection.
 *
 * Deselecting always succeeds. Selecting past `max` is rejected — the caller
 * gets the unchanged array back (referentially identical) so it can tell the
 * difference and surface a "limit reached" message instead of failing silently.
 */
export function toggleStrategySelection(
  current: readonly string[],
  id: string,
  max: number = MAX_COMPARISON_SELECTION,
): readonly string[] {
  if (current.includes(id)) {
    return current.filter((value) => value !== id);
  }

  if (current.length >= max) {
    return current;
  }

  return [...current, id];
}

/**
 * Reads a selection out of a URL query parameter.
 *
 * URLs are user-editable and shareable, so the raw value is untrusted: unknown
 * ids are dropped, duplicates collapse to their first occurrence, and anything
 * beyond `max` is truncated. A missing parameter falls back to
 * `DEFAULT_SELECTION`; an explicitly empty one (`?strategies=`) is honoured as
 * an empty selection so "clear all" survives a page reload.
 */
export function parseSelectionParam(
  raw: string | null,
  catalog: readonly VaultStrategy[] = VAULT_STRATEGIES,
  max: number = MAX_COMPARISON_SELECTION,
): readonly string[] {
  if (raw === null) {
    return DEFAULT_SELECTION.filter((id) => findStrategy(id, catalog));
  }

  const seen = new Set<string>();
  const parsed: string[] = [];

  for (const candidate of raw.split(",")) {
    const id = candidate.trim();
    if (id === "" || seen.has(id) || !findStrategy(id, catalog)) continue;
    seen.add(id);
    parsed.push(id);
    if (parsed.length >= max) break;
  }

  return parsed;
}

export function serializeSelectionParam(ids: readonly string[]): string {
  return ids.join(",");
}

/** Coerces an untrusted URL value into a known sort direction. */
export function parseSortDirection(
  raw: string | null,
  fallback: SortDirection = "desc",
): SortDirection {
  return raw === "asc" || raw === "desc" ? raw : fallback;
}

// ─── Ordering and ranking ─────────────────────────────────────────────────────

/**
 * Orders strategies by a metric's numeric projection.
 *
 * Ties break on `name` so the column order is stable across renders — without
 * it, equal APYs could swap places on every re-sort.
 */
export function sortStrategies(
  strategies: readonly VaultStrategy[],
  metric: ComparisonMetric | undefined,
  direction: SortDirection = "desc",
): VaultStrategy[] {
  const sorted = [...strategies];
  if (!metric) return sorted;

  const sign = direction === "asc" ? 1 : -1;

  return sorted.sort((a, b) => {
    const delta = metric.valueOf(a) - metric.valueOf(b);
    if (delta !== 0) return delta * sign;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Ids holding the best value for `metric` among `strategies`.
 *
 * Ties all win, so a shared best value highlights every strategy that reaches
 * it. When *every* strategy ties there is no winner to point at, so the result
 * is empty — highlighting the whole row would be noise, not signal.
 */
export function findBestStrategyIds(
  strategies: readonly VaultStrategy[],
  metric: ComparisonMetric,
): string[] {
  if (strategies.length < 2) return [];

  const values = strategies.map((strategy) => metric.valueOf(strategy));
  const best =
    metric.betterIs === "higher" ? Math.max(...values) : Math.min(...values);
  const worst =
    metric.betterIs === "higher" ? Math.min(...values) : Math.max(...values);

  if (best === worst) return [];

  return strategies
    .filter((strategy) => metric.valueOf(strategy) === best)
    .map((strategy) => strategy.id);
}

/** The APY spread across a selection, in percentage points. */
export function getApySpread(strategies: readonly VaultStrategy[]): number {
  if (strategies.length < 2) return 0;
  const apys = strategies.map((strategy) => strategy.apyPercent);
  return Math.max(...apys) - Math.min(...apys);
}
