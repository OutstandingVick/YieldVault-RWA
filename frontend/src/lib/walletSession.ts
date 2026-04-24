/** Session flag: user chose Disconnect; skip Freighter auto-reconnect until they connect again. */
export const WALLET_MANUAL_DISCONNECT_KEY = "yieldvault_wallet_manual_disconnect";

export function isWalletManualDisconnectSet(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(WALLET_MANUAL_DISCONNECT_KEY) === "1";
}

export function setWalletManualDisconnect(): void {
  sessionStorage.setItem(WALLET_MANUAL_DISCONNECT_KEY, "1");
}

export function clearWalletManualDisconnect(): void {
  sessionStorage.removeItem(WALLET_MANUAL_DISCONNECT_KEY);
}
