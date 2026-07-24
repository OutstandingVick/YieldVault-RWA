import { useCallback, useState } from "react";
import {
  captureFormSnapshot,
  detectStaleSubmission,
  snapshotHashFromForm,
  type FormSubmissionSnapshot,
  type StaleSubmissionResult,
} from "../lib/staleSubmissionDetection";
import type { TransactionAction } from "../lib/transactionIntent";

interface UseStaleSubmissionGuardParams {
  action: TransactionAction;
  amount: number;
  availableBalance: number;
  feeXlm: number;
  isCapReached: boolean;
  slippage: number;
}

export function useStaleSubmissionGuard({
  action,
  amount,
  availableBalance,
  feeXlm,
  isCapReached,
  slippage,
}: UseStaleSubmissionGuardParams) {
  const [reviewSnapshot, setReviewSnapshot] = useState<FormSubmissionSnapshot | null>(null);

  const buildCurrentSnapshot = useCallback((): FormSubmissionSnapshot => {
    return captureFormSnapshot({
      action,
      amount,
      availableBalance,
      feeXlm,
      isCapReached,
      slippage,
    });
  }, [action, amount, availableBalance, feeXlm, isCapReached, slippage]);

  const captureReviewSnapshot = useCallback(() => {
    const snapshot = buildCurrentSnapshot();
    setReviewSnapshot(snapshot);
    return snapshot;
  }, [buildCurrentSnapshot]);

  const clearReviewSnapshot = useCallback(() => {
    setReviewSnapshot(null);
  }, []);

  const checkStaleSubmission = useCallback((): StaleSubmissionResult => {
    return detectStaleSubmission(reviewSnapshot, buildCurrentSnapshot());
  }, [buildCurrentSnapshot, reviewSnapshot]);

  const refreshSnapshot = useCallback(() => {
    return captureReviewSnapshot();
  }, [captureReviewSnapshot]);

  const snapshotHash = snapshotHashFromForm(buildCurrentSnapshot());

  return {
    reviewSnapshot,
    snapshotHash,
    captureReviewSnapshot,
    clearReviewSnapshot,
    checkStaleSubmission,
    refreshSnapshot,
  };
}
