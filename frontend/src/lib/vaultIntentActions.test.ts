import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  triggerDepositIntent,
  triggerWithdrawIntent,
  triggerWalletConnectIntent,
} from "./vaultIntentActions";

describe("vaultIntentActions", () => {
  const navigate = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "dispatchEvent");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("dispatches wallet connect when deposit intent has no wallet", () => {
    triggerDepositIntent(navigate, null);
    expect(navigate).not.toHaveBeenCalled();
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "TRIGGER_WALLET_CONNECT" }),
    );
  });

  it("navigates home and dispatches deposit intent when wallet is connected", () => {
    triggerDepositIntent(navigate, "GABC123");
    expect(navigate).toHaveBeenCalledWith("/");
    expect(window.dispatchEvent).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "TRIGGER_DEPOSIT" }),
    );
  });

  it("navigates home and dispatches withdraw intent when wallet is connected", () => {
    triggerWithdrawIntent(navigate, "GABC123");
    expect(navigate).toHaveBeenCalledWith("/");
    vi.advanceTimersByTime(100);
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "TRIGGER_WITHDRAW" }),
    );
  });

  it("dispatches wallet connect for withdraw intent without wallet", () => {
    triggerWalletConnectIntent();
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "TRIGGER_WALLET_CONNECT" }),
    );
  });
});
