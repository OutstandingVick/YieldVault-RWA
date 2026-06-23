import { getNow } from "./dateUtils";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ApyDataQualityInput {
  /** ISO timestamp or Date for the most recent data point. */
  lastUpdatedAt: string | Date;
  /** Expected number of observations in the comparison window. */
  expectedDataPoints: number;
  /** Actual number of observations available. */
  actualDataPoints: number;
}

export interface ApyConfidenceResult {
  level: ConfidenceLevel;
  /** Combined score from 0 (unreliable) to 100 (reliable). */
  score: number;
  recencyScore: number;
  completenessScore: number;
  label: string;
}

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Deterministic recency score based on data age.
 * Same inputs always produce the same output.
 */
export function computeRecencyScore(
  lastUpdatedAt: string | Date,
  now: Date = getNow(),
): number {
  const updated =
    lastUpdatedAt instanceof Date ? lastUpdatedAt : new Date(lastUpdatedAt);
  if (Number.isNaN(updated.getTime())) {
    return 0;
  }

  const ageMs = Math.max(0, now.getTime() - updated.getTime());

  if (ageMs <= MS_PER_HOUR) return 100;
  if (ageMs <= MS_PER_DAY) return 80;
  if (ageMs <= 7 * MS_PER_DAY) return 55;
  if (ageMs <= 30 * MS_PER_DAY) return 30;
  return 10;
}

/**
 * Deterministic completeness score from available vs expected observations.
 */
export function computeCompletenessScore(
  expectedDataPoints: number,
  actualDataPoints: number,
): number {
  if (expectedDataPoints <= 0) {
    return actualDataPoints > 0 ? 100 : 0;
  }

  const ratio = Math.min(Math.max(actualDataPoints, 0) / expectedDataPoints, 1);
  return Math.round(ratio * 100);
}

function levelFromScore(score: number): ConfidenceLevel {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function labelFromLevel(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Low confidence";
  }
}

/**
 * Derives a confidence badge from data recency and completeness.
 * Weighting is fixed (50/50) so results are deterministic for tests and UI.
 */
export function computeApyConfidence(
  input: ApyDataQualityInput,
  now: Date = getNow(),
): ApyConfidenceResult {
  const recencyScore = computeRecencyScore(input.lastUpdatedAt, now);
  const completenessScore = computeCompletenessScore(
    input.expectedDataPoints,
    input.actualDataPoints,
  );
  const score = Math.round(recencyScore * 0.5 + completenessScore * 0.5);
  const level = levelFromScore(score);

  return {
    level,
    score,
    recencyScore,
    completenessScore,
    label: labelFromLevel(level),
  };
}
