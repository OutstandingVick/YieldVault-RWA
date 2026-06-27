import { useEffect, useMemo, useState, type ReactNode } from "react";

export type AsyncActionStatus = "idle" | "pending" | "success" | "error";

export interface AsyncActionLabels {
  idle: ReactNode;
  pending?: ReactNode;
  success?: ReactNode;
  error?: ReactNode;
}

export interface UseAsyncActionButtonOptions {
  labels: AsyncActionLabels;
  isPending?: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  successResetMs?: number;
  errorResetMs?: number;
}

export interface AsyncActionButtonState {
  status: AsyncActionStatus;
  label: ReactNode;
  isDisabled: boolean;
  reset: () => void;
}

/**
 * Maps async wallet/mutation state to standardized button status and labels.
 */
export function useAsyncActionButton({
  labels,
  isPending = false,
  isSuccess = false,
  isError = false,
  successResetMs = 2000,
  errorResetMs = 3000,
}: UseAsyncActionButtonOptions): AsyncActionButtonState {
  const [status, setStatus] = useState<AsyncActionStatus>("idle");

  useEffect(() => {
    if (isPending) {
      setStatus("pending");
      return;
    }
    if (isSuccess) {
      setStatus("success");
      const timer = window.setTimeout(() => setStatus("idle"), successResetMs);
      return () => window.clearTimeout(timer);
    }
    if (isError) {
      setStatus("error");
      const timer = window.setTimeout(() => setStatus("idle"), errorResetMs);
      return () => window.clearTimeout(timer);
    }
    if (!isPending && !isSuccess && !isError) {
      setStatus("idle");
    }
  }, [isPending, isSuccess, isError, successResetMs, errorResetMs]);

  const label = useMemo(() => {
    switch (status) {
      case "pending":
        return labels.pending ?? labels.idle;
      case "success":
        return labels.success ?? labels.idle;
      case "error":
        return labels.error ?? labels.idle;
      default:
        return labels.idle;
    }
  }, [labels, status]);

  return {
    status,
    label,
    isDisabled: status === "pending",
    reset: () => setStatus("idle"),
  };
}
