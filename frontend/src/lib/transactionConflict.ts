/**
 * Transaction conflict types and parsing for vault deposit/withdraw operations.
 */

export type TransactionConflictType =
  | "stale-form"
  | "wallet-in-progress"
  | "idempotency-conflict";

export type TransactionConflictResolution =
  | "update-values"
  | "proceed-anyway"
  | "retry"
  | "new-intent"
  | "retry-same"
  | "dismiss";

export interface TransactionConflictDetails {
  type: TransactionConflictType;
  code?: string;
  message: string;
  walletAddress?: string;
}

export class TransactionConflictError extends Error {
  readonly conflict: TransactionConflictDetails;

  constructor(conflict: TransactionConflictDetails) {
    super(conflict.message);
    this.name = "TransactionConflictError";
    this.conflict = conflict;
  }
}

interface ConflictResponseBody {
  error?: string;
  status?: number;
  code?: string;
  message?: string;
  walletAddress?: string;
}

function isConflictResponseBody(value: unknown): value is ConflictResponseBody {
  return value !== null && typeof value === "object";
}

/**
 * Map an API error payload to a transaction conflict, if applicable.
 */
export function parseTransactionConflict(error: unknown): TransactionConflictError | null {
  if (error instanceof TransactionConflictError) {
    return error;
  }

  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as {
    status?: number;
    code?: string;
    message?: string;
    details?: unknown;
    conflict?: TransactionConflictDetails;
  };

  if (candidate.conflict) {
    return new TransactionConflictError(candidate.conflict);
  }

  const status = candidate.status;
  const details = isConflictResponseBody(candidate.details)
    ? candidate.details
    : isConflictResponseBody(error)
      ? (error as ConflictResponseBody)
      : null;

  if (status !== 409 && details?.status !== 409) {
    return null;
  }

  const code = details?.code ?? candidate.code;
  const message =
    details?.message ??
    candidate.message ??
    "A transaction conflict occurred. Please resolve before continuing.";

  if (code === "WALLET_OPERATION_IN_PROGRESS") {
    return new TransactionConflictError({
      type: "wallet-in-progress",
      code,
      message,
      walletAddress: details?.walletAddress,
    });
  }

  if (
    code === "API_409_IDEMPOTENCY" ||
    message.toLowerCase().includes("idempotency")
  ) {
    return new TransactionConflictError({
      type: "idempotency-conflict",
      code: code ?? "API_409_IDEMPOTENCY",
      message,
    });
  }

  return new TransactionConflictError({
    type: "idempotency-conflict",
    code: code ?? "CONFLICT",
    message,
  });
}

export function isTransactionConflict(error: unknown): error is TransactionConflictError {
  return error instanceof TransactionConflictError;
}
