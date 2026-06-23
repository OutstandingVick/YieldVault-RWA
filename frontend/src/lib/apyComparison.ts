import {
  computeApyConfidence,
  type ApyConfidenceResult,
  type ApyDataQualityInput,
} from "./apyConfidence";
import { getNow } from "./dateUtils";

export interface ApyBenchmarkDefinition {
  id: string;
  label: string;
  source: string;
  apy: number;
  lastUpdatedAt: string;
  expectedDataPoints: number;
  actualDataPoints: number;
}

export interface ApyComparisonCardModel {
  id: string;
  label: string;
  source: string;
  apy: number;
  deltaVsVault: number;
  dataQuality: ApyDataQualityInput;
  confidence: ApyConfidenceResult;
}

/** Fixed benchmark set so card ordering and values are deterministic. */
export const APY_BENCHMARKS: readonly ApyBenchmarkDefinition[] = [
  {
    id: "us-tbills",
    label: "US T-Bills",
    source: "Treasury benchmark",
    apy: 5.25,
    lastUpdatedAt: "2026-03-24T00:00:00.000Z",
    expectedDataPoints: 30,
    actualDataPoints: 30,
  },
  {
    id: "defi-stablecoin",
    label: "DeFi Stablecoin Avg",
    source: "On-chain lending index",
    apy: 6.5,
    lastUpdatedAt: "2026-03-23T12:00:00.000Z",
    expectedDataPoints: 30,
    actualDataPoints: 27,
  },
  {
    id: "money-market",
    label: "Traditional MMF",
    source: "Fund benchmark",
    apy: 4.8,
    lastUpdatedAt: "2026-03-20T00:00:00.000Z",
    expectedDataPoints: 30,
    actualDataPoints: 22,
  },
] as const;

const DEFAULT_EXPECTED_HISTORY_POINTS = 30;

function toCardModel(
  entry: {
    id: string;
    label: string;
    source: string;
    apy: number;
    dataQuality: ApyDataQualityInput;
  },
  vaultApy: number,
  now: Date,
): ApyComparisonCardModel {
  return {
    ...entry,
    deltaVsVault: Number((entry.apy - vaultApy).toFixed(2)),
    confidence: computeApyConfidence(entry.dataQuality, now),
  };
}

export interface BuildApyComparisonsInput {
  vaultApy: number;
  vaultUpdatedAt: string;
  vaultHistoryPointCount: number;
  expectedHistoryPoints?: number;
  now?: Date;
}

/**
 * Builds a deterministic, sorted list of APY comparison cards for the vault
 * and fixed external benchmarks.
 */
export function buildApyComparisons({
  vaultApy,
  vaultUpdatedAt,
  vaultHistoryPointCount,
  expectedHistoryPoints = DEFAULT_EXPECTED_HISTORY_POINTS,
  now = getNow(),
}: BuildApyComparisonsInput): ApyComparisonCardModel[] {
  const entries = [
    toCardModel(
      {
        id: "vault",
        label: "YieldVault",
        source: "Live vault APY",
        apy: vaultApy,
        dataQuality: {
          lastUpdatedAt: vaultUpdatedAt,
          expectedDataPoints: expectedHistoryPoints,
          actualDataPoints: vaultHistoryPointCount,
        },
      },
      vaultApy,
      now,
    ),
    ...APY_BENCHMARKS.map((benchmark) =>
      toCardModel(
        {
          id: benchmark.id,
          label: benchmark.label,
          source: benchmark.source,
          apy: benchmark.apy,
          dataQuality: {
            lastUpdatedAt: benchmark.lastUpdatedAt,
            expectedDataPoints: benchmark.expectedDataPoints,
            actualDataPoints: benchmark.actualDataPoints,
          },
        },
        vaultApy,
        now,
      ),
    ),
  ];

  return entries.sort((a, b) => a.id.localeCompare(b.id));
}
