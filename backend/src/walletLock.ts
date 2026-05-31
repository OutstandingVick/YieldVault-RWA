import { normalizeWalletAddress } from './walletUtils';

const inFlightWallets = new Set<string>();

export interface WalletLockResult {
  acquired: boolean;
  key: string;
  release: () => void;
}

export function tryAcquireWalletLock(walletAddress: string): WalletLockResult {
  const key = normalizeWalletAddress(walletAddress);
  if (!key) {
    return {
      acquired: false,
      key,
      release: () => undefined,
    };
  }

  if (inFlightWallets.has(key)) {
    return {
      acquired: false,
      key,
      release: () => undefined,
    };
  }

  inFlightWallets.add(key);

  return {
    acquired: true,
    key,
    release: () => {
      inFlightWallets.delete(key);
    },
  };
}

export function clearWalletLocksForTests(): void {
  inFlightWallets.clear();
}
