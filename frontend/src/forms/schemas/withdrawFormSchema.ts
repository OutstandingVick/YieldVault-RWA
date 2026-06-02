/**
 * Validation schema for the withdraw form.
 * 
 * Enforces business rules for vault withdrawals:
 * - Amount is required and must be a positive number
 * - Amount cannot exceed user's vault balance
 */

import type { ValidationSchema } from "../validate";

export interface WithdrawFormValues {
  amount: string;
}

/**
 * Create a withdraw form validation schema.
 * 
 * @param availableBalance - User's available USDC balance (from vault shares)
 * @returns Validation schema for withdraw form
 */
export function createWithdrawFormSchema(
  availableBalance: number,
): ValidationSchema<WithdrawFormValues> {
  return {
    amount: {
      required: "Amount is required.",
      custom: (value) => {
        // Check if value is a valid number
        const num = Number(value);
        if (Number.isNaN(num) || !Number.isFinite(num)) {
          return "Enter a valid number.";
        }

        // Amount must be greater than 0
        if (num <= 0) {
          return "Amount must be greater than 0.";
        }

        // Check available vault balance
        if (num > availableBalance) {
          return `Withdrawal amount cannot exceed your available vault balance of ${availableBalance.toFixed(2)}.`;
        }

        return undefined;
      },
    },
  };
}
