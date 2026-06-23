import { describe, it, expect } from "vitest";
import {
  computeApyConfidence,
  computeCompletenessScore,
  computeRecencyScore,
} from "./apyConfidence";

const FIXED_NOW = new Date("2026-03-25T12:00:00.000Z");

describe("computeRecencyScore", () => {
  it("returns 100 for data updated within the last hour", () => {
    const lastUpdated = new Date("2026-03-25T11:30:00.000Z");
    expect(computeRecencyScore(lastUpdated, FIXED_NOW)).toBe(100);
  });

  it("returns 80 for data updated within the last day", () => {
    const lastUpdated = new Date("2026-03-24T18:00:00.000Z");
    expect(computeRecencyScore(lastUpdated, FIXED_NOW)).toBe(80);
  });

  it("returns 55 for data updated within the last week", () => {
    const lastUpdated = new Date("2026-03-20T12:00:00.000Z");
    expect(computeRecencyScore(lastUpdated, FIXED_NOW)).toBe(55);
  });

  it("returns 0 for invalid timestamps", () => {
    expect(computeRecencyScore("invalid", FIXED_NOW)).toBe(0);
  });
});

describe("computeCompletenessScore", () => {
  it("returns 100 when all expected points are present", () => {
    expect(computeCompletenessScore(30, 30)).toBe(100);
  });

  it("returns a proportional score for partial data", () => {
    expect(computeCompletenessScore(30, 15)).toBe(50);
  });

  it("caps completeness at 100 when extra points are present", () => {
    expect(computeCompletenessScore(10, 20)).toBe(100);
  });
});

describe("computeApyConfidence", () => {
  it("produces deterministic high confidence for fresh, complete data", () => {
    const result = computeApyConfidence(
      {
        lastUpdatedAt: "2026-03-25T11:00:00.000Z",
        expectedDataPoints: 30,
        actualDataPoints: 30,
      },
      FIXED_NOW,
    );

    expect(result).toEqual({
      level: "high",
      score: 100,
      recencyScore: 100,
      completenessScore: 100,
      label: "High confidence",
    });
  });

  it("produces deterministic low confidence for stale, sparse data", () => {
    const result = computeApyConfidence(
      {
        lastUpdatedAt: "2026-02-01T00:00:00.000Z",
        expectedDataPoints: 30,
        actualDataPoints: 5,
      },
      FIXED_NOW,
    );

    expect(result.level).toBe("low");
    expect(result.score).toBeLessThan(45);
    expect(result.label).toBe("Low confidence");
  });
});
