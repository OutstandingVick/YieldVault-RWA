/**
 * @file schemas.ts
 * Re-exports shared API schemas from @yieldvault/api-schemas.
 *
 * Import the schema you need and pass it to `validate()` from ./validation
 * before calling any API function.
 */

export {
  StellarAddressSchema,
  AmountSchema,
  ShareCountSchema,
  AssetCodeSchema,
  IsoDatestamp,
  DepositRequestSchema,
  WithdrawalRequestSchema,
  VaultHistoryQuerySchema,
  PortfolioQuerySchema,
  WalletAddressSchema,
  TransactionQuerySchema,
  type DepositRequest,
  type WithdrawalRequest,
  type VaultHistoryQuery,
  type PortfolioQuery,
  type WalletAddressParam,
  type TransactionQuery,
  type TransactionQueryInput,
} from "@yieldvault/api-schemas";
