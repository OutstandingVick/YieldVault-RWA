import { describe, expect, it } from "vitest";
import { sampleChartSeries } from "./chartSeries";

describe("sampleChartSeries", () => {
  it("returns a copy when the input is already within the point limit", () => {
    const data = [{ date: "2026-01-01", value: 1 }];

    const sampled = sampleChartSeries(data, 10);

    expect(sampled).toEqual(data);
    expect(sampled).not.toBe(data);
  });

  it("reduces large series to the requested number of evenly spaced points", () => {
    const data = Array.from({ length: 1000 }, (_, index) => ({
      date: `2026-01-${String((index % 30) + 1).padStart(2, "0")}`,
      value: index,
    }));

    const sampled = sampleChartSeries(data, 120);

    expect(sampled).toHaveLength(120);
    expect(sampled[0]).toBe(data[0]);
    expect(sampled[sampled.length - 1]).toBe(data[data.length - 1]);
  });
});