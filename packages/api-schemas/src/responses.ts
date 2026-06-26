import { z } from "zod";
import { AssetCodeSchema, StellarAddressSchema } from "./primitives";

/** Successful vault deposit / withdrawal response body. */
export const VaultOperationResponseSchema = z
  .object({
    id: z.string(),
    type: z.enum(["deposit", "withdrawal"]),
    amount: z.union([z.string(), z.number()]),
    asset: AssetCodeSchema,
    walletAddress: StellarAddressSchema,
    transactionHash: z.string(),
    status: z.string(),
    timestamp: z.string(),
  })
  .strict();

export type VaultOperationResponse = z.infer<typeof VaultOperationResponseSchema>;
