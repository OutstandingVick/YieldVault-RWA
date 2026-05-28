export interface ParsedUtcDateRange {
  start?: string;
  end?: string;
  rawStart?: string;
  rawEnd?: string;
  normalizedStart?: string | null;
  normalizedEnd?: string | null;
}

export interface UtcDateRangeInput {
  from?: string;
  to?: string;
}

export interface UtcDateRangeOptions {
  maxRangeDays?: number;
}

export class DateRangeParseError extends Error {
  status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'DateRangeParseError';
  }
}

const DEFAULT_MAX_RANGE_DAYS = parseInt(process.env.MAX_UTC_DATE_RANGE_DAYS || '366', 10);

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function hasTimezone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
}

function startOfUtcDay(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function endOfUtcDay(date: string): string {
  return `${date}T23:59:59.999Z`;
}

function normalizeBoundary(value: string | undefined, boundary: 'from' | 'to'): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (isDateOnly(value)) {
    return boundary === 'from' ? startOfUtcDay(value) : endOfUtcDay(value);
  }

  if (!hasTimezone(value)) {
    throw new DateRangeParseError(
      `Invalid ${boundary} value. Use an ISO 8601 timestamp with timezone or YYYY-MM-DD.`,
    );
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new DateRangeParseError(`Invalid ${boundary} value. Unable to parse date.`);
  }

  return new Date(timestamp).toISOString();
}

export function parseUtcDateRange(
  input: UtcDateRangeInput,
  options: UtcDateRangeOptions = {},
): ParsedUtcDateRange {
  const normalizedStart = normalizeBoundary(input.from, 'from');
  const normalizedEnd = normalizeBoundary(input.to, 'to');
  const maxRangeDays = options.maxRangeDays ?? DEFAULT_MAX_RANGE_DAYS;

  if (normalizedStart && normalizedEnd) {
    const startTime = Date.parse(normalizedStart);
    const endTime = Date.parse(normalizedEnd);

    if (endTime < startTime) {
      throw new DateRangeParseError('Invalid date range. `to` must be greater than or equal to `from`.');
    }

    const rangeMs = endTime - startTime;
    const maxRangeMs = (maxRangeDays - 1) * 24 * 60 * 60 * 1000 + 999;
    if (rangeMs > maxRangeMs) {
      throw new DateRangeParseError(
        `Invalid date range. Maximum allowed range is ${maxRangeDays} days.`,
      );
    }
  }

  return {
    rawStart: input.from,
    rawEnd: input.to,
    normalizedStart,
    normalizedEnd,
    start: normalizedStart,
    end: normalizedEnd,
  };
}