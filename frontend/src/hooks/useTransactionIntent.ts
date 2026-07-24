import { useCallback, useMemo, useState } from "react";
import {
  clearTransactionIntent,
  createTransactionIntent,
  getStoredTransactionIntent,
  hashSnapshot,
  isIntentStale,
  rotateIdempotencyKey,
  storeTransactionIntent,
  type TransactionAction,
  type TransactionIntent,
} from "../lib/transactionIntent";

interface UseTransactionIntentParams {
  walletAddress: string | null;
  action: TransactionAction;
  amount: number;
  snapshotHash: string;
}

export function useTransactionIntent({
  walletAddress,
  action,
  amount,
  snapshotHash,
}: UseTransactionIntentParams) {
  const [intent, setIntent] = useState<TransactionIntent | null>(() => {
    if (!walletAddress) {
      return null;
    }
    return getStoredTransactionIntent(walletAddress, action);
  });

  const ensureIntent = useCallback(() => {
    if (!walletAddress) {
      return null;
    }

    const existing = intent ?? getStoredTransactionIntent(walletAddress, action);
    if (existing && !isIntentStale(existing, snapshotHash)) {
      setIntent(existing);
      return existing;
    }

    const next = createTransactionIntent({
      action,
      amount,
      walletAddress,
      snapshotHash,
      idempotencyKey: existing?.idempotencyKey,
    });

    storeTransactionIntent(next);
    setIntent(next);
    return next;
  }, [action, amount, intent, snapshotHash, walletAddress]);

  const refreshIntent = useCallback(() => {
    if (!walletAddress) {
      return null;
    }

    const next = createTransactionIntent({
      action,
      amount,
      walletAddress,
      snapshotHash,
    });

    storeTransactionIntent(next);
    setIntent(next);
    return next;
  }, [action, amount, snapshotHash, walletAddress]);

  const rotateIntent = useCallback(() => {
    if (!walletAddress) {
      return null;
    }

    const base =
      intent ??
      createTransactionIntent({
        action,
        amount,
        walletAddress,
        snapshotHash,
      });

    const rotated = rotateIdempotencyKey(base);
    setIntent(rotated);
    return rotated;
  }, [action, amount, intent, snapshotHash, walletAddress]);

  const clearIntent = useCallback(() => {
    if (!walletAddress) {
      return;
    }

    clearTransactionIntent(walletAddress, action);
    setIntent(null);
  }, [action, walletAddress]);

  const intentIsStale = useMemo(() => {
    if (!intent) {
      return false;
    }
    return isIntentStale(intent, snapshotHash);
  }, [intent, snapshotHash]);

  const currentSnapshotHash = useMemo(
    () => hashSnapshot([action, amount, snapshotHash]),
    [action, amount, snapshotHash],
  );

  return {
    intent,
    intentIsStale,
    currentSnapshotHash,
    ensureIntent,
    refreshIntent,
    rotateIntent,
    clearIntent,
  };
}
