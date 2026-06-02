import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type TransactionTab = "deposit" | "withdraw";
export type TransactionStep = "amount" | "review" | "result";

export interface DashboardUrlState {
  tab: TransactionTab;
  step: TransactionStep;
  amount: string;
}

export interface UseDashboardUrlStateReturn {
  state: DashboardUrlState;
  setTab: (tab: TransactionTab) => void;
  setStep: (step: TransactionStep) => void;
  setAmount: (amount: string) => void;
  setState: (updates: Partial<DashboardUrlState>) => void;
  reset: () => void;
}

export function useDashboardUrlState(): UseDashboardUrlStateReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo<DashboardUrlState>(() => {
    const tab = (searchParams.get("tab") ?? "deposit") as TransactionTab;
    const step = (searchParams.get("step") ?? "amount") as TransactionStep;
    const amount = searchParams.get("amount") ?? "";

    return { tab, step, amount };
  }, [searchParams]);

  const setState = useCallback(
    (updates: Partial<DashboardUrlState>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);

        if (updates.tab !== undefined) {
          next.set("tab", updates.tab);
        }
        if (updates.step !== undefined) {
          next.set("step", updates.step);
        }
        if (updates.amount !== undefined) {
          if (updates.amount === "") {
            next.delete("amount");
          } else {
            next.set("amount", updates.amount);
          }
        }

        return next;
      });
    },
    [setSearchParams],
  );

  const setTab = useCallback(
    (tab: TransactionTab) => setState({ tab }),
    [setState],
  );

  const setStep = useCallback(
    (step: TransactionStep) => setState({ step }),
    [setState],
  );

  const setAmount = useCallback(
    (amount: string) => setState({ amount }),
    [setState],
  );

  const reset = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("tab");
      next.delete("step");
      next.delete("amount");
      return next;
    });
  }, [setSearchParams]);

  return {
    state,
    setTab,
    setStep,
    setAmount,
    setState,
    reset,
  };
}
