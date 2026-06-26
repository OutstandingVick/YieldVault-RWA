/**
 * Secure masking helpers for balances, wallet addresses, and other identifiers.
 * Used when the user enables privacy mode (default: masked).
 */

export const MASKED_BALANCE = "••••••";
export const MASKED_IDENTIFIER = "••••••••";

/** Mask a numeric balance for display. Preserves currency suffix when provided. */
export function maskBalance(
  value: string | number,
  options?: { suffix?: string; showZero?: boolean },
): string {
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (options?.showZero && (numeric === 0 || Number.isNaN(numeric))) {
    const suffix = options.suffix ? ` ${options.suffix}` : "";
    return `0${suffix}`;
  }
  const suffix = options?.suffix ? ` ${options.suffix}` : "";
  return `${MASKED_BALANCE}${suffix}`;
}

/** Mask a Stellar address or transaction hash, optionally keeping edge characters. */
export function maskIdentifier(
  value: string | null | undefined,
  options?: { keepEdges?: boolean; visibleChars?: number },
): string {
  if (!value?.trim()) {
    return MASKED_IDENTIFIER;
  }
  const trimmed = value.trim();
  if (!options?.keepEdges || trimmed.length <= 8) {
    return MASKED_IDENTIFIER;
  }
  const n = options.visibleChars ?? 4;
  return `${trimmed.slice(0, n)}${"•".repeat(8)}${trimmed.slice(-n)}`;
}

/** Apply masking based on user preference. */
export function displayBalance(
  value: string | number,
  masked: boolean,
  formatter: (value: number) => string,
): string {
  if (masked) {
    return maskBalance(value);
  }
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (Number.isNaN(numeric)) {
    return formatter(0);
  }
  return formatter(numeric);
}

export function displayIdentifier(
  value: string | null | undefined,
  masked: boolean,
  formatter?: (value: string) => string,
): string {
  if (masked) {
    return maskIdentifier(value, { keepEdges: true });
  }
  if (!value) {
    return "";
  }
  return formatter ? formatter(value) : value;
}
