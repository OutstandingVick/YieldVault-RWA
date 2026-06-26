import { z } from "zod";

/**
 * Stellar / Soroban public key: G... base-32 address, 56 characters.
 * Validates format only — not an on-chain account existence check.
 */
export const StellarAddressSchema = z
  .string()
  .trim()
  .min(1, { message: "Wallet address is required" })
  .regex(/^G[A-Z2-7]{55}$/, {
    message: "Must be a valid Stellar public key (starts with G, 56 chars)",
  });

/**
 * Positive decimal amount represented as a string (preserves precision).
 * Allows up to 7 decimal places to match Stellar's stroop precision.
 */
export const AmountSchema = z
  .string()
  .trim()
  .min(1, { message: "Amount is required" })
  .regex(/^\d+(\.\d{1,7})?$/, {
    message: "Amount must be a positive number with up to 7 decimal places",
  })
  .refine((value) => parseFloat(value) > 0, {
    message: "Amount must be greater than zero",
  });

/**
 * API boundary amount: accepts canonical string amounts or legacy numeric JSON.
 * Normalizes to a string so frontend and backend share one wire format.
 */
export const AmountInputSchema = z
  .union([
    AmountSchema,
    z
      .number({ error: "Amount is required" })
      .positive("Amount must be greater than zero")
      .finite("Amount must be a finite number"),
  ])
  .transform((value) => (typeof value === "number" ? String(value) : value));

/** Positive integer share count (UI / portfolio display). */
export const ShareCountSchema = z
  .number({ error: "Share count is required" })
  .int("Share count must be a whole number")
  .positive("Share count must be greater than zero")
  .max(1_000_000_000, "Share count exceeds maximum allowed value");

/** Supported asset codes. Extend as new assets are on-boarded. */
export const AssetCodeSchema = z.enum(["XLM", "USDC", "yUSDC", "RWA"] as const, {
  error: "Asset must be one of: XLM, USDC, yUSDC, RWA",
});

/** ISO 8601 date string (YYYY-MM-DD). */
export const IsoDatestamp = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Date must be in YYYY-MM-DD format",
  });

/** Optional slippage tolerance in basis points (0–500). */
export const SlippageBpsSchema = z
  .number()
  .int("Slippage must be a whole number of basis points")
  .min(0, "Slippage cannot be negative")
  .max(500, "Slippage tolerance may not exceed 500 bps (5%)")
  .optional();
