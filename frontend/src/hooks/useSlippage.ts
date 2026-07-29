import { useState, useCallback } from "react";

const STORAGE_KEY = "yv_slippage_bps";
const PRESETS = [0.1, 0.5, 1] as const;
const DEFAULT_SLIPPAGE = 0.5;
const HIGH_SLIPPAGE_THRESHOLD = 5;

function readStored(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_SLIPPAGE;
    const n = parseFloat(raw);
    return isFinite(n) && n >= 0 ? n : DEFAULT_SLIPPAGE;
  } catch {
    return DEFAULT_SLIPPAGE;
  }
}

export function useSlippage() {
  const [slippage, setSlippageState] = useState<number>(readStored);

  const setSlippage = useCallback((value: number) => {
    setSlippageState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // storage unavailable – state still updates in memory
    }
  }, []);

  const minReceived = useCallback(
    (amount: number) => Math.max(amount * (1 - slippage / 100), 0),
    [slippage],
  );

  return {
    slippage,
    setSlippage,
    presets: PRESETS,
    isHighSlippage: slippage > HIGH_SLIPPAGE_THRESHOLD,
    minReceived,
  };
}
