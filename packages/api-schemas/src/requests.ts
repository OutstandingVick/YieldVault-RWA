import { z } from "zod";
import {
  AmountSchema,
  AssetCodeSchema,
  IsoDatestamp,
  SlippageBpsSchema,
  StellarAddressSchema,
} from "./primitives";

/**
 * Payload sent when a user deposits assets into a vault.
 */
export const DepositRequestSchema = z.object({
  walletAddress: StellarAddressSchema,
  amount: AmountSchema,
  asset: AssetCodeSchema,
  slippageBps: SlippageBpsSchema,
  referralCode: z.string().optional(),
});

export type DepositRequest = z.infer<typeof DepositRequestSchema>;

/**
 * Payload sent when a user redeems vault shares for underlying assets.
 */
export const WithdrawalRequestSchema = z.object({
  walletAddress: StellarAddressSchema,
  amount: AmountSchema,
  asset: AssetCodeSchema,
  destinationAddress: StellarAddressSchema.optional(),
  slippageBps: SlippageBpsSchema,
});

export type WithdrawalRequest = z.infer<typeof WithdrawalRequestSchema>;

/**
 * Query-string parameters for the vault performance history endpoint.
 */
export const VaultHistoryQuerySchema = z
  .object({
    from: IsoDatestamp.optional(),
    to: IsoDatestamp.optional(),
    limit: z
      .number()
      .int("Limit must be a whole number")
      .min(1, "Limit must be at least 1")
      .max(365, "Limit may not exceed 365 data points")
      .optional(),
  })
  .refine(
    (query) => {
      if (query.from && query.to) {
        return query.from <= query.to;
      }
      return true;
    },
    { message: '"from" date must not be later than "to" date', path: ["from"] },
  );

export type VaultHistoryQuery = z.infer<typeof VaultHistoryQuerySchema>;

/**
 * Query-string parameters for the portfolio holdings endpoint.
 */
export const PortfolioQuerySchema = z.object({
  walletAddress: StellarAddressSchema,
  status: z.enum(["active", "pending", "all"]).optional().default("all"),
});

export type PortfolioQuery = z.infer<typeof PortfolioQuerySchema>;

/**
 * Single-param schema used when an endpoint only needs the caller's address.
 */
export const WalletAddressSchema = z.object({
  walletAddress: StellarAddressSchema,
});

export type WalletAddressParam = z.infer<typeof WalletAddressSchema>;

/**
 * Query-string parameters for the transaction history endpoint.
 */
export const TransactionQuerySchema = z.object({
  walletAddress: StellarAddressSchema,
  limit: z
    .number()
    .int("Limit must be a whole number")
    .min(1, "Limit must be at least 1")
    .max(200, "Limit may not exceed 200 records")
    .optional()
    .default(50),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  type: z.enum(["deposit", "withdrawal", "all"]).optional().default("all"),
});

export type TransactionQuery = z.infer<typeof TransactionQuerySchema>;
export type TransactionQueryInput = z.input<typeof TransactionQuerySchema>;
