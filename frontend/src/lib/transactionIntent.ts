/**
 * Transaction intent tracking with idempotency keys for vault operations.
 */

export type TransactionAction = "deposit" | "withdraw";

export interface TransactionIntent {
  idempotencyKey: string;
  action: TransactionAction;
  amount: number;
  walletAddress: string;
  createdAt: number;
  snapshotHash: string;
}

const STORAGE_PREFIX = "yv-transaction-intent";

function storageKey(walletAddress: string, action: TransactionAction): string {
  return `${STORAGE_PREFIX}:${walletAddress}:${action}`;
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `intent-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function hashSnapshot(parts: Array<string | number | boolean>): string {
  return parts.map(String).join("|");
}

export function createTransactionIntent(params: {
  action: TransactionAction;
  amount: number;
  walletAddress: string;
  snapshotHash: string;
  idempotencyKey?: string;
}): TransactionIntent {
  return {
    idempotencyKey: params.idempotencyKey ?? generateIdempotencyKey(),
    action: params.action,
    amount: params.amount,
    walletAddress: params.walletAddress,
    createdAt: Date.now(),
    snapshotHash: params.snapshotHash,
  };
}

export function storeTransactionIntent(intent: TransactionIntent): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  sessionStorage.setItem(
    storageKey(intent.walletAddress, intent.action),
    JSON.stringify(intent),
  );
}

export function getStoredTransactionIntent(
  walletAddress: string,
  action: TransactionAction,
): TransactionIntent | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(storageKey(walletAddress, action));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as TransactionIntent;
  } catch {
    return null;
  }
}

export function clearTransactionIntent(
  walletAddress: string,
  action: TransactionAction,
): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  sessionStorage.removeItem(storageKey(walletAddress, action));
}

export function rotateIdempotencyKey(intent: TransactionIntent): TransactionIntent {
  const rotated: TransactionIntent = {
    ...intent,
    idempotencyKey: generateIdempotencyKey(),
    createdAt: Date.now(),
  };

  storeTransactionIntent(rotated);
  return rotated;
}

export function isIntentStale(
  intent: TransactionIntent,
  snapshotHash: string,
  maxAgeMs = 15 * 60 * 1000,
): boolean {
  const expired = Date.now() - intent.createdAt > maxAgeMs;
  const snapshotChanged = intent.snapshotHash !== snapshotHash;
  return expired || snapshotChanged;
}
