/**
 * useTransactionFilters — URL query parameter parser tests
 *
 * These tests verify that the hook correctly serialises and deserialises all
 * filter values from URL search params, and that invalid / malformed values
 * are discarded gracefully without crashing.
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { useTransactionFilters } from "./useTransactionFilters";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderFilters(initialSearch = "") {
  return renderHook(() => useTransactionFilters(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        MemoryRouter,
        { initialEntries: [`/?${initialSearch}`] },
        children,
      ),
  });
}

// ---------------------------------------------------------------------------
// Default / empty state
// ---------------------------------------------------------------------------

describe("useTransactionFilters — defaults", () => {
  it("returns all defaults when URL has no params", () => {
    const { result } = renderFilters("");

    expect(result.current.filters).toEqual({
      search: "",
      asset: "",
      types: [],
      statuses: [],
      dateFrom: "",
      dateTo: "",
      amountMin: "",
      amountMax: "",
    });
    expect(result.current.hasActiveFilters).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Valid param parsing
// ---------------------------------------------------------------------------

describe("useTransactionFilters — valid param parsing", () => {
  it("parses a valid search string", () => {
    const { result } = renderFilters("search=abc123");
    expect(result.current.filters.search).toBe("abc123");
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("parses a single valid type", () => {
    const { result } = renderFilters("types=deposit");
    expect(result.current.filters.types).toEqual(["deposit"]);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("parses multiple valid types", () => {
    const { result } = renderFilters("types=deposit,withdrawal,transfer");
    expect(result.current.filters.types).toEqual([
      "deposit",
      "withdrawal",
      "transfer",
    ]);
  });

  it("parses multiple valid statuses", () => {
    const { result } = renderFilters("statuses=pending,completed");
    expect(result.current.filters.statuses).toEqual(["pending", "completed"]);
  });

  it("parses valid ISO date strings", () => {
    const { result } = renderFilters("dateFrom=2026-01-01&dateTo=2026-06-30");
    expect(result.current.filters.dateFrom).toBe("2026-01-01");
    expect(result.current.filters.dateTo).toBe("2026-06-30");
  });

  it("parses valid positive numeric amounts", () => {
    const { result } = renderFilters("amountMin=10&amountMax=5000.5");
    expect(result.current.filters.amountMin).toBe("10");
    expect(result.current.filters.amountMax).toBe("5000.5");
  });

  it("correctly identifies hasActiveFilters when at least one filter is set", () => {
    const { result } = renderFilters("amountMax=100");
    expect(result.current.hasActiveFilters).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invalid / malformed param handling — must discard without crashing
// ---------------------------------------------------------------------------

describe("useTransactionFilters — invalid param handling", () => {
  it("discards an unknown type value", () => {
    // 'swap' is not a valid TxType
    const { result } = renderFilters("types=deposit,swap");
    expect(result.current.filters.types).toEqual(["deposit"]);
  });

  it("discards all types if none are valid", () => {
    const { result } = renderFilters("types=unknown,bogus");
    expect(result.current.filters.types).toEqual([]);
  });

  it("discards an invalid status value", () => {
    const { result } = renderFilters("statuses=completed,cancelled");
    expect(result.current.filters.statuses).toEqual(["completed"]);
  });

  it("discards a non-ISO dateFrom value", () => {
    const { result } = renderFilters("dateFrom=not-a-date");
    expect(result.current.filters.dateFrom).toBe("");
  });

  it("discards a date with wrong format (DD/MM/YYYY)", () => {
    const { result } = renderFilters("dateFrom=15/01/2026");
    expect(result.current.filters.dateFrom).toBe("");
  });

  it("discards an impossible date (Feb 30)", () => {
    const { result } = renderFilters("dateFrom=2026-02-30");
    expect(result.current.filters.dateFrom).toBe("");
  });

  it("discards a negative amountMin", () => {
    const { result } = renderFilters("amountMin=-50");
    expect(result.current.filters.amountMin).toBe("");
  });

  it("discards a non-numeric amountMax", () => {
    const { result } = renderFilters("amountMax=abc");
    expect(result.current.filters.amountMax).toBe("");
  });

  it("discards zero-length / empty param values", () => {
    const { result } = renderFilters("types=&statuses=&dateFrom=&amountMin=");
    expect(result.current.filters.types).toEqual([]);
    expect(result.current.filters.statuses).toEqual([]);
    expect(result.current.filters.dateFrom).toBe("");
    expect(result.current.filters.amountMin).toBe("");
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("amountMin of 0 is valid (zero is non-negative)", () => {
    const { result } = renderFilters("amountMin=0");
    expect(result.current.filters.amountMin).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// Setter behaviour — clearAll
// ---------------------------------------------------------------------------

describe("useTransactionFilters — clearAll", () => {
  it("clearAll removes all filter params from URL and sets hasActiveFilters=false", async () => {
    const { result } = renderFilters(
      "search=xyz&types=deposit&statuses=completed&dateFrom=2026-01-01&amountMin=10",
    );

    // Verify all filters loaded
    expect(result.current.hasActiveFilters).toBe(true);

    // Clear
    act(() => {
      result.current.clearAll();
    });

    expect(result.current.filters).toEqual({
      search: "",
      asset: "",
      types: [],
      statuses: [],
      dateFrom: "",
      dateTo: "",
      amountMin: "",
      amountMax: "",
    });
    expect(result.current.hasActiveFilters).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Setter behaviour — individual setters
// ---------------------------------------------------------------------------

describe("useTransactionFilters — individual setters", () => {
  it("setSearch updates the search filter", () => {
    const { result } = renderFilters("");

    act(() => {
      result.current.setSearch("hello");
    });

    expect(result.current.filters.search).toBe("hello");
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("setSearch with empty string clears the filter", () => {
    const { result } = renderFilters("search=hello");

    act(() => {
      result.current.setSearch("");
    });

    expect(result.current.filters.search).toBe("");
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("setTypes updates type filter", () => {
    const { result } = renderFilters("");

    act(() => {
      result.current.setTypes(["deposit", "trade"]);
    });

    expect(result.current.filters.types).toEqual(["deposit", "trade"]);
  });

  it("setTypes with empty array clears type filter", () => {
    const { result } = renderFilters("types=deposit");

    act(() => {
      result.current.setTypes([]);
    });

    expect(result.current.filters.types).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("setStatuses updates status filter", () => {
    const { result } = renderFilters("");

    act(() => {
      result.current.setStatuses(["pending", "failed"]);
    });

    expect(result.current.filters.statuses).toEqual(["pending", "failed"]);
  });

  it("setDateFrom updates date from", () => {
    const { result } = renderFilters("");

    act(() => {
      result.current.setDateFrom("2026-03-01");
    });

    expect(result.current.filters.dateFrom).toBe("2026-03-01");
  });

  it("setDateTo updates date to", () => {
    const { result } = renderFilters("");

    act(() => {
      result.current.setDateTo("2026-12-31");
    });

    expect(result.current.filters.dateTo).toBe("2026-12-31");
  });

  it("setAmountMin updates amount min", () => {
    const { result } = renderFilters("");

    act(() => {
      result.current.setAmountMin("50");
    });

    expect(result.current.filters.amountMin).toBe("50");
  });

  it("setAmountMax updates amount max", () => {
    const { result } = renderFilters("");

    act(() => {
      result.current.setAmountMax("999");
    });

    expect(result.current.filters.amountMax).toBe("999");
  });
});
