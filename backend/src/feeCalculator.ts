// src/feeCalculator.ts
/**
 * Deterministic fee calculator.
 * Returns a base fee that is stable across runs.
 * The fee is read from the FIXED_BASE_FEE environment variable if present,
 * otherwise it falls back to the historic default of '100'.
 */
export function getDeterministicBaseFee(): string {
  const envFee = process.env.FIXED_BASE_FEE;
  if (envFee) {
    // Basic validation – ensure it's a positive integer string.
    if (!/^[0-9]+$/.test(envFee)) {
      throw new Error('FIXED_BASE_FEE must be a positive integer string');
    }
    return envFee;
  }
  // Default base fee used by stellar-sdk when not overridden.
  return '100';
}
