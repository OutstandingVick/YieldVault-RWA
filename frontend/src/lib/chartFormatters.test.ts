import { describe, it, expect } from "vitest";
import {
  formatChartCurrency,
  formatChartPercent,
  formatChartNumber,
  formatChartAxisCurrency,
  formatChartAxisPercent,
  formatChartAxisNumber,
  createChartCurrencyTickFormatter,
  createChartPercentTickFormatter,
  createChartNumberTickFormatter,
} from "./chartFormatters";

describe("chartFormatters", () => {
  const locale = "en-US";

  describe("formatChartNumber", () => {
    it("formats numbers with default settings", () => {
      expect(formatChartNumber(1234, locale)).toBe("1,234");
      expect(formatChartNumber(1234.567, locale)).toBe("1,234.57");
    });

    it("uses compact notation for large numbers", () => {
      const formatted = formatChartNumber(1_500_000, locale);
      expect(formatted).toContain("M"); // Should use compact notation like "1.5M"
    });

    it("respects custom max decimals", () => {
      const formatted = formatChartNumber(1234.567, locale, { maxDecimals: 0 });
      expect(formatted).toBe("1,235");
    });

    it("respects custom compact threshold", () => {
      // With default threshold (1M), 500k should not be compacted
      const formatted = formatChartNumber(500_000, locale, { compactThreshold: 1_000_000 });
      expect(formatted).not.toContain("M");
    });
  });

  describe("formatChartCurrency", () => {
    it("formats currency values with default settings", () => {
      const formatted = formatChartCurrency(1234.56, "USD", locale);
      expect(formatted).toContain("1,234.56");
      expect(formatted).toContain("$");
    });

    it("uses compact notation for large currency values", () => {
      const formatted = formatChartCurrency(1_500_000, "USD", locale);
      expect(formatted).toContain("M"); // Should use compact notation like "$1.5M"
    });

    it("respects custom max decimals", () => {
      const formatted = formatChartCurrency(1234.567, "USD", locale, { maxDecimals: 0 });
      expect(formatted).not.toContain(".567");
    });

    it("formats zero value correctly", () => {
      const formatted = formatChartCurrency(0, "USD", locale);
      expect(formatted).toContain("0");
      expect(formatted).toContain("$");
    });
  });

  describe("formatChartPercent", () => {
    it("formats percentage values with default settings (0-100 range)", () => {
      const formatted = formatChartPercent(50, locale);
      expect(formatted).toContain("50");
      expect(formatted).toContain("%");
    });

    it("formats decimal percentage values (0-1 range)", () => {
      const formatted = formatChartPercent(0.5, locale, { isDecimal: true });
      expect(formatted).toContain("50");
      expect(formatted).toContain("%");
    });

    it("respects custom max decimals", () => {
      const formatted = formatChartPercent(33.333, locale, { maxDecimals: 0 });
      expect(formatted).toContain("33");
    });
  });

  describe("formatChartAxisNumber", () => {
    it("formats axis numbers with minimal decimals", () => {
      const formatted = formatChartAxisNumber(1234.567, locale);
      expect(formatted).toBe("1,235");
    });

    it("uses more aggressive compacting for axis labels", () => {
      const formatted = formatChartAxisNumber(500_000, locale);
      expect(formatted).toContain("K"); // Should use compact notation like "500K"
    });
  });

  describe("formatChartAxisCurrency", () => {
    it("formats axis currency with aggressive compacting", () => {
      const formatted = formatChartAxisCurrency(500_000, "USD", locale);
      expect(formatted).toContain("K"); // Should use compact notation like "$500K"
    });

    it("uses minimal decimals for axis labels", () => {
      const formatted = formatChartAxisCurrency(1234.56, "USD", locale);
      expect(formatted).not.toContain("56"); // Should not show decimals
    });
  });

  describe("formatChartAxisPercent", () => {
    it("formats axis percentages with no decimals", () => {
      const formatted = formatChartAxisPercent(50.5, locale);
      expect(formatted).toContain("51");
      expect(formatted).not.toContain(".5");
      expect(formatted).toContain("%");
    });

    it("handles decimal percentages correctly", () => {
      const formatted = formatChartAxisPercent(0.505, locale, true);
      expect(formatted).toContain("51");
      expect(formatted).toContain("%");
    });
  });

  describe("createChartCurrencyTickFormatter", () => {
    it("returns a function that formats currency for axis labels", () => {
      const formatter = createChartCurrencyTickFormatter("USD", locale, true);
      expect(typeof formatter).toBe("function");

      const formatted = formatter(500_000);
      expect(formatted).toContain("K");
    });

    it("uses standard formatting when isAxisLabel is false", () => {
      const formatter = createChartCurrencyTickFormatter("USD", locale, false);
      const formatted = formatter(1234.56);
      expect(formatted).toContain("1,234");
    });
  });

  describe("createChartPercentTickFormatter", () => {
    it("returns a function that formats percentages", () => {
      const formatter = createChartPercentTickFormatter(locale, false, true);
      expect(typeof formatter).toBe("function");

      const formatted = formatter(50);
      expect(formatted).toContain("50");
      expect(formatted).toContain("%");
    });

    it("handles decimal mode correctly", () => {
      const formatter = createChartPercentTickFormatter(locale, true, true);
      const formatted = formatter(0.5);
      expect(formatted).toContain("50");
      expect(formatted).toContain("%");
    });

    it("uses more decimals when not axis label", () => {
      const formatterAxis = createChartPercentTickFormatter(locale, false, true);
      const formatterTooltip = createChartPercentTickFormatter(locale, false, false);

      // Axis labels should have no decimals
      const axisFormatted = formatterAxis(33.333);
      expect(axisFormatted).toContain("33%");

      // Tooltip values should have more decimals
      const tooltipFormatted = formatterTooltip(33.333);
      expect(tooltipFormatted).toContain("33");
    });
  });

  describe("createChartNumberTickFormatter", () => {
    it("returns a function that formats numbers", () => {
      const formatter = createChartNumberTickFormatter(locale, true);
      expect(typeof formatter).toBe("function");

      const formatted = formatter(1234.567);
      expect(formatted).toContain("1,235");
    });

    it("uses aggressive compacting for axis labels", () => {
      const formatter = createChartNumberTickFormatter(locale, true);
      const formatted = formatter(500_000);
      expect(formatted).toContain("K");
    });

    it("uses standard compacting for non-axis labels", () => {
      const formatter = createChartNumberTickFormatter(locale, false);
      const formatted = formatter(500_000);
      expect(formatted).not.toContain("K");
    });
  });

  describe("locale support", () => {
    it("formats currency correctly for different locales", () => {
      const deFormatted = formatChartCurrency(1234.56, "EUR", "de-DE");
      const enFormatted = formatChartCurrency(1234.56, "EUR", "en-US");

      // Both should contain the number and EUR symbol, but may be formatted differently
      expect(deFormatted).toContain("1.234");
      expect(enFormatted).toContain("1,234");
    });

    it("formats numbers with locale-specific separators", () => {
      const deFormatted = formatChartNumber(1234.56, "de-DE");
      const enFormatted = formatChartNumber(1234.56, "en-US");

      // German uses comma for decimal, period for thousands
      expect(deFormatted).toContain("1.234");
      // English uses period for decimal, comma for thousands
      expect(enFormatted).toContain("1,234");
    });
  });

  describe("edge cases", () => {
    it("handles zero values", () => {
      expect(formatChartNumber(0, locale)).toBe("0");
      expect(formatChartCurrency(0, "USD", locale)).toContain("$0");
      expect(formatChartPercent(0, locale)).toContain("0%");
    });

    it("handles negative values", () => {
      expect(formatChartNumber(-1234, locale)).toContain("-");
      expect(formatChartCurrency(-1234, "USD", locale)).toContain("-");
      expect(formatChartPercent(-50, locale)).toContain("-");
    });

    it("handles very large numbers", () => {
      const formatted = formatChartNumber(1_000_000_000, locale);
      expect(formatted).toContain("B"); // Should use "B" for billions
    });

    it("handles very small numbers", () => {
      const formatted = formatChartNumber(0.001, locale);
      expect(formatted).toBe("0");
    });
  });
});
