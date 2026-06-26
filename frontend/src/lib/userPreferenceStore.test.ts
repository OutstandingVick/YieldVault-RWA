import { describe, it, expect, beforeEach } from "vitest";
import {
  PREFERENCE_STORE_VERSION,
  DEFAULT_USER_PREFERENCE_STORE,
  loadUserPreferenceStore,
  saveUserPreferenceStore,
  updateUserPreferenceStore,
  setChartMode,
  setTableDensity,
  setTransactionViewMode,
  setTransactionPageSize,
  resetUserPreferenceStore,
  getPreferenceStorageKey,
} from "./userPreferenceStore";

const WALLET = "GTESTWALLET1234567890ABCDEF1234567890ABCDEF12";
const OTHER_WALLET = "GOTHERWALLET1234567890ABCDEF1234567890ABCDEF1";

describe("userPreferenceStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns defaults when no stored preferences exist", () => {
    const prefs = loadUserPreferenceStore(WALLET);
    expect(prefs).toEqual(DEFAULT_USER_PREFERENCE_STORE);
  });

  it("persists preferences with a versioned envelope", () => {
    setChartMode("vaultPerformance", "bar", WALLET);

    const raw = localStorage.getItem(getPreferenceStorageKey(WALLET));
    expect(raw).toBeTruthy();

    const envelope = JSON.parse(raw!);
    expect(envelope.version).toBe(PREFERENCE_STORE_VERSION);
    expect(envelope.data.chartModes.vaultPerformance).toBe("bar");
  });

  it("scopes preferences per wallet without cross-wallet leakage", () => {
    setTableDensity("compact", WALLET);
    setTableDensity("spacious", OTHER_WALLET);

    expect(loadUserPreferenceStore(WALLET).tables.density).toBe("compact");
    expect(loadUserPreferenceStore(OTHER_WALLET).tables.density).toBe("spacious");
    expect(loadUserPreferenceStore(null).tables.density).toBe("comfortable");
  });

  it("migrates legacy transaction view mode and page size keys", () => {
    localStorage.setItem(`yieldvault:transactions:view-mode:${WALLET}`, "infinite");
    localStorage.setItem(`yieldvault:transactions:page-size:${WALLET}`, "25");

    const prefs = loadUserPreferenceStore(WALLET);
    expect(prefs.tables.transactionViewMode).toBe("infinite");
    expect(prefs.tables.transactionPageSize).toBe(25);

    expect(localStorage.getItem(`yieldvault:transactions:view-mode:${WALLET}`)).toBeNull();
    expect(localStorage.getItem(`yieldvault:transactions:page-size:${WALLET}`)).toBeNull();
    expect(localStorage.getItem(getPreferenceStorageKey(WALLET))).toBeTruthy();
  });

  it("ignores invalid legacy page size values", () => {
    localStorage.setItem(`yieldvault:transactions:page-size:${WALLET}`, "99");
    const prefs = loadUserPreferenceStore(WALLET);
    expect(prefs.tables.transactionPageSize).toBe(10);
  });

  it("merges partial updates without dropping unrelated fields", () => {
    setChartMode("apyTrend", "area", WALLET);
    setTableDensity("compact", WALLET);

    const updated = updateUserPreferenceStore(
      (prev) => ({
        ...prev,
        chartModes: { ...prev.chartModes, yieldBreakdown: "bar" },
      }),
      WALLET,
    );

    expect(updated.chartModes.apyTrend).toBe("area");
    expect(updated.chartModes.yieldBreakdown).toBe("bar");
    expect(updated.tables.density).toBe("compact");
  });

  it("rejects invalid chart mode and table density values on save", () => {
    saveUserPreferenceStore(
      {
        chartModes: {
          vaultPerformance: "invalid" as never,
          apyTrend: "line",
          yieldBreakdown: "line",
        },
        tables: {
          density: "invalid" as never,
          transactionViewMode: "paginated",
          transactionPageSize: 10,
        },
      },
      WALLET,
    );

    const prefs = loadUserPreferenceStore(WALLET);
    expect(prefs.chartModes.vaultPerformance).toBe("area");
    expect(prefs.tables.density).toBe("comfortable");
  });

  it("updates transaction preferences independently", () => {
    setTransactionViewMode("infinite", WALLET);
    setTransactionPageSize(50, WALLET);

    const prefs = loadUserPreferenceStore(WALLET);
    expect(prefs.tables.transactionViewMode).toBe("infinite");
    expect(prefs.tables.transactionPageSize).toBe(50);
  });

  it("resets preferences to defaults", () => {
    setChartMode("vaultPerformance", "bar", WALLET);
    setTableDensity("compact", WALLET);

    const reset = resetUserPreferenceStore(WALLET);
    expect(reset).toEqual(DEFAULT_USER_PREFERENCE_STORE);
    expect(loadUserPreferenceStore(WALLET)).toEqual(DEFAULT_USER_PREFERENCE_STORE);
  });

  it("handles corrupt stored JSON gracefully", () => {
    localStorage.setItem(getPreferenceStorageKey(WALLET), "{not-json");
    expect(loadUserPreferenceStore(WALLET)).toEqual(DEFAULT_USER_PREFERENCE_STORE);
  });
});
