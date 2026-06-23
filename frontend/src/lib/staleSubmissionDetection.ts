/**
 * Detects when vault form state has changed since the user entered review.
 */

import type { TransactionAction } from "./transactionIntent";

export interface FormSubmissionSnapshot {
  action: TransactionAction;
  amount: number;
  availableBalance: number;
  feeXlm: number;
  isCapReached: boolean;
  slippage: number;
  capturedAt: number;
}

export interface StaleFieldChange {
  field: keyof FormSubmissionSnapshot | "intent";
  label: string;
  previous: string;
  current: string;
}

export interface StaleSubmissionResult {
  isStale: boolean;
  changes: StaleFieldChange[];
}

function formatAmount(value: number): string {
  return `${value.toFixed(2)} USDC`;
}

function formatFee(value: number): string {
  return `${value.toFixed(4)} XLM`;
}

export function captureFormSnapshot(params: {
  action: TransactionAction;
  amount: number;
  availableBalance: number;
  feeXlm: number;
  isCapReached: boolean;
  slippage: number;
}): FormSubmissionSnapshot {
  return {
    action: params.action,
    amount: params.amount,
    availableBalance: params.availableBalance,
    feeXlm: params.feeXlm,
    isCapReached: params.isCapReached,
    slippage: params.slippage,
    capturedAt: Date.now(),
  };
}

export function detectStaleSubmission(
  snapshot: FormSubmissionSnapshot | null,
  current: FormSubmissionSnapshot,
): StaleSubmissionResult {
  if (!snapshot) {
    return { isStale: false, changes: [] };
  }

  const changes: StaleFieldChange[] = [];

  if (snapshot.amount !== current.amount) {
    changes.push({
      field: "amount",
      label: "Amount",
      previous: formatAmount(snapshot.amount),
      current: formatAmount(current.amount),
    });
  }

  if (snapshot.availableBalance !== current.availableBalance) {
    changes.push({
      field: "availableBalance",
      label: "Available balance",
      previous: formatAmount(snapshot.availableBalance),
      current: formatAmount(current.availableBalance),
    });
  }

  if (Math.abs(snapshot.feeXlm - current.feeXlm) > 0.0001) {
    changes.push({
      field: "feeXlm",
      label: "Network fee",
      previous: formatFee(snapshot.feeXlm),
      current: formatFee(current.feeXlm),
    });
  }

  if (snapshot.isCapReached !== current.isCapReached) {
    changes.push({
      field: "isCapReached",
      label: "Vault capacity",
      previous: snapshot.isCapReached ? "Reached" : "Available",
      current: current.isCapReached ? "Reached" : "Available",
    });
  }

  if (snapshot.action === "withdraw" && snapshot.slippage !== current.slippage) {
    changes.push({
      field: "slippage",
      label: "Slippage tolerance",
      previous: `${snapshot.slippage}%`,
      current: `${current.slippage}%`,
    });
  }

  return {
    isStale: changes.length > 0,
    changes,
  };
}

export function snapshotHashFromForm(snapshot: FormSubmissionSnapshot): string {
  return [
    snapshot.action,
    snapshot.amount,
    snapshot.availableBalance,
    snapshot.feeXlm,
    snapshot.isCapReached,
    snapshot.slippage,
  ].join("|");
}
