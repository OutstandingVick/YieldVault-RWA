import { describe, it, expect } from "vitest";
import {
  parseTransactionConflict,
  TransactionConflictError,
} from "./transactionConflict";

describe("transactionConflict", () => {
  it("parses wallet operation conflicts", () => {
    const conflict = parseTransactionConflict({
      status: 409,
      details: {
        error: "Conflict",
        status: 409,
        code: "WALLET_OPERATION_IN_PROGRESS",
        message: "Another operation is already in progress for this wallet",
      },
    });

    expect(conflict?.conflict.type).toBe("wallet-in-progress");
    expect(conflict?.conflict.code).toBe("WALLET_OPERATION_IN_PROGRESS");
  });

  it("parses idempotency conflicts", () => {
    const conflict = parseTransactionConflict({
      status: 409,
      details: {
        error: "Conflict",
        status: 409,
        message: "Idempotency key already used for a different request body",
      },
    });

    expect(conflict?.conflict.type).toBe("idempotency-conflict");
  });

  it("returns null for non-conflict errors", () => {
    expect(parseTransactionConflict(new Error("network"))).toBeNull();
    expect(parseTransactionConflict({ status: 500 })).toBeNull();
  });

  it("preserves TransactionConflictError instances", () => {
    const original = new TransactionConflictError({
      type: "stale-form",
      message: "Stale form",
    });

    expect(parseTransactionConflict(original)).toBe(original);
  });
});
