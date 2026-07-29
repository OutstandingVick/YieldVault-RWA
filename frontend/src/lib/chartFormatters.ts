/**
 * Chart-specific formatting utilities for tooltips and axes.
 * Provides locale-aware formatting with sensible defaults for chart contexts.
 * Ensures consistency between chart values and tabular displays.
 */

import {
  formatNumber,
  formatCurrency,
  formatPercent,
} from "./formatters";

/**
 * Format a currency value for chart display (tooltips/axes).
 * Uses compact notation for very large numbers.
 * @param value - The numeric value to format
 * @param currency - Currency code (e.g., "USD")
 * @param locale - Locale code for formatting
 * @param options - Additional formatting options
 */
export function formatChartCurrency(
  value: number,
  currency: string,
  locale: string,
  options?: {
    compactThreshold?: number; // Use compact notation above this value (default: 1M)
    maxDecimals?: number; // Max decimal places (default: 2)
  }
): string {
  const compactThreshold = options?.compactThreshold ?? 1_000_000;
  const maxDecimals = options?.maxDecimals ?? 2;

  // Use compact notation for very large numbers
  if (Math.abs(value) >= compactThreshold) {
    const formatter = new Intl.NumberFormat(locale, {
      notation: "compact",
      compactDisplay: "short",
      style: "currency",
      currency: currency,
      maximumFractionDigits: Math.min(maxDecimals, 1),
    });
    return formatter.format(value);
  }

  // Use standard currency formatting for smaller numbers
  return formatCurrency(value, {
    currency,
    locale,
    minimumFractionDigits: value === 0 || value % 1 !== 0 ? maxDecimals : 0,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Format a percentage value for chart display (tooltips/axes).
 * @param value - The numeric value to format (0-1 range if isDecimal=true, 0-100 if false)
 * @param locale - Locale code for formatting
 * @param options - Additional formatting options
 */
export function formatChartPercent(
  value: number,
  locale: string,
  options?: {
    isDecimal?: boolean; // Value is in 0-1 range (default: false, assumes 0-100)
    maxDecimals?: number; // Max decimal places (default: 2)
  }
): string {
  const isDecimal = options?.isDecimal ?? false;
  const maxDecimals = options?.maxDecimals ?? 2;

  return formatPercent(value, {
    isDecimal,
    locale,
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Format a number for chart display (tooltips/axes).
 * @param value - The numeric value to format
 * @param locale - Locale code for formatting
 * @param options - Additional formatting options
 */
export function formatChartNumber(
  value: number,
  locale: string,
  options?: {
    compactThreshold?: number; // Use compact notation above this value (default: 1M)
    maxDecimals?: number; // Max decimal places (default: 2)
  }
): string {
  const compactThreshold = options?.compactThreshold ?? 1_000_000;
  const maxDecimals = options?.maxDecimals ?? 2;

  // Use compact notation for very large numbers
  if (Math.abs(value) >= compactThreshold) {
    const formatter = new Intl.NumberFormat(locale, {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: Math.min(maxDecimals, 1),
    });
    return formatter.format(value);
  }

  // Use standard formatting for smaller numbers
  return formatNumber(value, {
    locale,
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Format a currency value for chart axis labels.
 * Uses more aggressive compact notation and fewer decimals for readability.
 * @param value - The numeric value to format
 * @param currency - Currency code (e.g., "USD")
 * @param locale - Locale code for formatting
 */
export function formatChartAxisCurrency(
  value: number,
  currency: string,
  locale: string
): string {
  return formatChartCurrency(value, currency, locale, {
    compactThreshold: 100_000, // More aggressive compacting for axis labels
    maxDecimals: 1,
  });
}

/**
 * Format a percentage value for chart axis labels.
 * Uses minimal decimals for readability.
 * @param value - The numeric value to format (0-1 range if isDecimal=true, 0-100 if false)
 * @param locale - Locale code for formatting
 * @param isDecimal - Value is in 0-1 range (default: false)
 */
export function formatChartAxisPercent(
  value: number,
  locale: string,
  isDecimal: boolean = false
): string {
  return formatChartPercent(value, locale, {
    isDecimal,
    maxDecimals: isDecimal ? 0 : 0, // No decimals for axis labels
  });
}

/**
 * Format a number value for chart axis labels.
 * Uses minimal decimals for readability.
 * @param value - The numeric value to format
 * @param locale - Locale code for formatting
 */
export function formatChartAxisNumber(value: number, locale: string): string {
  return formatChartNumber(value, locale, {
    compactThreshold: 100_000, // More aggressive compacting for axis labels
    maxDecimals: 0, // No decimals for axis labels
  });
}

/**
 * Create a callback for recharts tickFormatter that formats currency values.
 * Returns a function suitable for YAxis/XAxis tickFormatter prop.
 * @param currency - Currency code (e.g., "USD")
 * @param locale - Locale code for formatting
 * @param isAxisLabel - If true, uses aggressive compacting; if false, uses standard formatting
 */
export function createChartCurrencyTickFormatter(
  currency: string,
  locale: string,
  isAxisLabel: boolean = true
): (value: number) => string {
  return (value: number) => {
    if (isAxisLabel) {
      return formatChartAxisCurrency(value, currency, locale);
    }
    return formatChartCurrency(value, currency, locale);
  };
}

/**
 * Create a callback for recharts tickFormatter that formats percentage values.
 * Returns a function suitable for YAxis/XAxis tickFormatter prop.
 * @param locale - Locale code for formatting
 * @param isDecimal - Value is in 0-1 range (default: false)
 * @param isAxisLabel - If true, uses minimal decimals; if false, uses standard formatting
 */
export function createChartPercentTickFormatter(
  locale: string,
  isDecimal: boolean = false,
  isAxisLabel: boolean = true
): (value: number) => string {
  return (value: number) => {
    if (isAxisLabel) {
      return formatChartAxisPercent(value, locale, isDecimal);
    }
    return formatChartPercent(value, locale, { isDecimal, maxDecimals: 2 });
  };
}

/**
 * Create a callback for recharts tickFormatter that formats numeric values.
 * Returns a function suitable for YAxis/XAxis tickFormatter prop.
 * @param locale - Locale code for formatting
 * @param isAxisLabel - If true, uses minimal decimals; if false, uses standard formatting
 */
export function createChartNumberTickFormatter(
  locale: string,
  isAxisLabel: boolean = true
): (value: number) => string {
  return (value: number) => {
    if (isAxisLabel) {
      return formatChartAxisNumber(value, locale);
    }
    return formatChartNumber(value, locale);
  };
}
