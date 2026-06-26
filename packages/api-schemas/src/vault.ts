import { z } from "zod";
import { AmountInputSchema } from "./primitives";
import { DepositRequestSchema, WithdrawalRequestSchema } from "./requests";

const signedActionFields = {
  nonce: z.string().min(16).max(128),
  signature: z.string().min(32).max(512),
};

const vaultOperationExtras = {
  email: z.string().email().optional(),
  referralCode: z.string().max(64).optional(),
  nonce: signedActionFields.nonce.optional(),
  signature: signedActionFields.signature.optional(),
};

/**
 * POST /api/v1/vault/deposits request body (shared with frontend client).
 * Accepts string or numeric amounts at the JSON boundary and normalizes to string.
 */
export const VaultDepositBodySchema = DepositRequestSchema.extend({
  amount: AmountInputSchema,
  ...vaultOperationExtras,
}).strict();

export type VaultDepositBody = z.infer<typeof VaultDepositBodySchema>;

/**
 * POST /api/v1/vault/withdrawals request body (shared with frontend client).
 */
export const VaultWithdrawalBodySchema = WithdrawalRequestSchema.extend({
  amount: AmountInputSchema,
  ...vaultOperationExtras,
}).strict();

export type VaultWithdrawalBody = z.infer<typeof VaultWithdrawalBodySchema>;

/** Vault write body when wallet nonce enforcement is strict. */
export const SignedVaultDepositBodySchema = DepositRequestSchema.extend({
  amount: AmountInputSchema,
  email: z.string().email().optional(),
  referralCode: z.string().max(64).optional(),
  ...signedActionFields,
}).strict();

export const SignedVaultWithdrawalBodySchema = WithdrawalRequestSchema.extend({
  amount: AmountInputSchema,
  email: z.string().email().optional(),
  referralCode: z.string().max(64).optional(),
  ...signedActionFields,
}).strict();

/** @deprecated Use VaultDepositBodySchema or VaultWithdrawalBodySchema */
export const VaultOperationSchema = VaultDepositBodySchema;
