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

/** Persisted last-used wallet provider across sessions. */
export const WALLET_LAST_PROVIDER_KEY = "yieldvault_last_wallet_provider";

export type WalletProvider = "freighter";

export function getLastWalletProvider(): WalletProvider | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(WALLET_LAST_PROVIDER_KEY);
  return value === "freighter" ? "freighter" : null;
}

export function setLastWalletProvider(provider: WalletProvider): void {
  localStorage.setItem(WALLET_LAST_PROVIDER_KEY, provider);
}

export function clearLastWalletProvider(): void {
  localStorage.removeItem(WALLET_LAST_PROVIDER_KEY);
}
