import type { NavigateFunction } from "react-router-dom";

const INTENT_DELAY_MS = 100;

export function triggerWalletConnectIntent(): void {
  window.dispatchEvent(new CustomEvent("TRIGGER_WALLET_CONNECT"));
}

export function triggerDepositIntent(
  navigate: NavigateFunction,
  walletAddress: string | null,
): void {
  if (!walletAddress) {
    triggerWalletConnectIntent();
    return;
  }
  navigate("/");
  window.setTimeout(
    () => window.dispatchEvent(new CustomEvent("TRIGGER_DEPOSIT")),
    INTENT_DELAY_MS,
  );
}

export function triggerWithdrawIntent(
  navigate: NavigateFunction,
  walletAddress: string | null,
): void {
  if (!walletAddress) {
    triggerWalletConnectIntent();
    return;
  }
  navigate("/");
  window.setTimeout(
    () => window.dispatchEvent(new CustomEvent("TRIGGER_WITHDRAW")),
    INTENT_DELAY_MS,
  );
}
