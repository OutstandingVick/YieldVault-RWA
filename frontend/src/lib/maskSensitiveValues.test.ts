import { describe, expect, it } from "vitest";
import {
  displayBalance,
  displayIdentifier,
  maskBalance,
  maskIdentifier,
  MASKED_BALANCE,
} from "./maskSensitiveValues";

describe("maskSensitiveValues", () => {
  it("masks balances with optional suffix", () => {
    expect(maskBalance(1234.56)).toBe(MASKED_BALANCE);
    expect(maskBalance("99.00", { suffix: "USDC" })).toBe(`${MASKED_BALANCE} USDC`);
  });

  it("allows zero display when configured", () => {
    expect(maskBalance(0, { suffix: "USDC", showZero: true })).toBe("0 USDC");
  });

  it("masks identifiers with edge preservation", () => {
    const addr = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    expect(maskIdentifier(addr, { keepEdges: true })).toBe("GAAA••••••••AWHF");
  });

  it("displayBalance respects masked preference", () => {
    const fmt = (n: number) => n.toFixed(2);
    expect(displayBalance(42.5, true, fmt)).toBe(MASKED_BALANCE);
    expect(displayBalance(42.5, false, fmt)).toBe("42.50");
  });

  it("displayIdentifier respects masked preference", () => {
    const addr = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    expect(displayIdentifier(addr, true)).toContain("•");
    expect(displayIdentifier(addr, false, (v) => v.slice(0, 4))).toBe("GAAA");
  });
});
