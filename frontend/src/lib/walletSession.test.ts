import { describe, it, expect, beforeEach } from "vitest";
import {
  getLastWalletProvider,
  setLastWalletProvider,
  clearLastWalletProvider,
  WALLET_LAST_PROVIDER_KEY,
} from "./walletSession";

describe("walletSession provider helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no provider is stored", () => {
    expect(getLastWalletProvider()).toBeNull();
  });

  it("returns the stored provider after setLastWalletProvider", () => {
    setLastWalletProvider("freighter");
    expect(getLastWalletProvider()).toBe("freighter");
  });

  it("returns null after clearLastWalletProvider", () => {
    setLastWalletProvider("freighter");
    clearLastWalletProvider();
    expect(getLastWalletProvider()).toBeNull();
  });

  it("ignores unknown values in localStorage", () => {
    localStorage.setItem(WALLET_LAST_PROVIDER_KEY, "metamask");
    expect(getLastWalletProvider()).toBeNull();
  });
});
