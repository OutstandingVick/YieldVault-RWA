/**
 * transactionQuery — filter and sort engine tests.
 *
 * These cover the behaviour the transaction history table depends on without
 * mounting React: which rows survive a filter set, in what order they come out,
 * and how sort state round-trips through the URL.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_SORT_DIRECTION,
  DEFAULT_SORT_KEYS,
  EMPTY_TRANSACTION_FILTERS,
  MAX_SORT_KEYS,
  compareTransactions,
  countActiveFilters,
  describeActiveFilters,
  filterTransactions,
  hasActiveTransactionFilters,
  isSortField,
  matchDatePreset,
  moveSortKey,
  paginateRows,
  parseLegacySortParams,
  parseSortParam,
  removeSortKey,
  resolveDatePreset,
  serializeSortParam,
  setSortKeyDirection,
  sortTransactions,
  toggleSortKey,
  validateTransactionFilters,
  type SortKey,
  type TransactionFilters,
} from "./transactionQuery";
import type { Transaction } from "./transactionApi";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "1",
    type: "deposit",
    status: "completed",
    amount: "100",
    asset: "USDC",
    timestamp: "2026-03-15T12:00:00Z",
    transactionHash: "abc123",
    ...overrides,
  };
}

function filters(overrides: Partial<TransactionFilters> = {}): TransactionFilters {
  return { ...EMPTY_TRANSACTION_FILTERS, ...overrides };
}

const ids = (rows: readonly Transaction[]) => rows.map((row) => row.id);

// ---------------------------------------------------------------------------
// Sort param serialisation
// ---------------------------------------------------------------------------

describe("parseSortParam", () => {
  it("parses a multi-key param in order", () => {
    expect(parseSortParam("status:asc,amount:desc")).toEqual([
      { field: "status", direction: "asc" },
      { field: "amount", direction: "desc" },
    ]);
  });

  it("returns no keys for empty input", () => {
    expect(parseSortParam("")).toEqual([]);
    expect(parseSortParam(null)).toEqual([]);
    expect(parseSortParam(undefined)).toEqual([]);
  });

  it("drops unknown fields instead of failing", () => {
    expect(parseSortParam("wallet:asc,amount:asc")).toEqual([
      { field: "amount", direction: "asc" },
    ]);
  });

  it("falls back to the field's default direction when the direction is unusable", () => {
    expect(parseSortParam("date:sideways")).toEqual([
      { field: "date", direction: DEFAULT_SORT_DIRECTION.date },
    ]);
    expect(parseSortParam("type")).toEqual([
      { field: "type", direction: DEFAULT_SORT_DIRECTION.type },
    ]);
  });

  it("keeps only the first occurrence of a repeated field", () => {
    expect(parseSortParam("amount:asc,amount:desc")).toEqual([
      { field: "amount", direction: "asc" },
    ]);
  });

  it("truncates past the key cap", () => {
    const parsed = parseSortParam("date:asc,amount:asc,type:asc,status:asc");
    expect(parsed).toHaveLength(MAX_SORT_KEYS);
    expect(parsed.map((key) => key.field)).toEqual(["date", "amount", "type"]);
  });

  it("tolerates whitespace and mixed case", () => {
    expect(parseSortParam(" DATE : DESC ")).toEqual([
      { field: "date", direction: "desc" },
    ]);
  });

  it("round-trips through serializeSortParam", () => {
    const keys: SortKey[] = [
      { field: "status", direction: "asc" },
      { field: "date", direction: "desc" },
    ];
    expect(parseSortParam(serializeSortParam(keys))).toEqual(keys);
  });

  it("serialises an empty key list to an empty string", () => {
    expect(serializeSortParam([])).toBe("");
  });
});

describe("parseLegacySortParams", () => {
  it("reads the pre-multi-sort single-column params", () => {
    expect(parseLegacySortParams("amount", "asc")).toEqual([
      { field: "amount", direction: "asc" },
    ]);
  });

  it("ignores an unknown field", () => {
    expect(parseLegacySortParams("hash", "asc")).toEqual([]);
    expect(parseLegacySortParams(null, null)).toEqual([]);
  });

  it("defaults the direction when it is missing", () => {
    expect(parseLegacySortParams("date", null)).toEqual([
      { field: "date", direction: DEFAULT_SORT_DIRECTION.date },
    ]);
  });
});

describe("isSortField", () => {
  it("accepts sortable columns and rejects the rest", () => {
    expect(isSortField("amount")).toBe(true);
    expect(isSortField("hash")).toBe(false);
    expect(isSortField("asset")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sort state transitions
// ---------------------------------------------------------------------------

describe("toggleSortKey — plain activation", () => {
  it("replaces the sort with the clicked field at its default direction", () => {
    expect(toggleSortKey([{ field: "date", direction: "desc" }], "amount")).toEqual(
      [{ field: "amount", direction: DEFAULT_SORT_DIRECTION.amount }],
    );
  });

  it("flips direction on the second activation", () => {
    const first = toggleSortKey([], "amount");
    expect(first).toEqual([{ field: "amount", direction: "desc" }]);
    expect(toggleSortKey(first, "amount")).toEqual([
      { field: "amount", direction: "asc" },
    ]);
  });

  it("returns to the default ordering on the third activation", () => {
    const cycled = toggleSortKey(
      toggleSortKey(toggleSortKey([], "amount"), "amount"),
      "amount",
    );
    expect(cycled).toEqual([]);
    // An empty list is what the sorter reads as "default ordering".
    expect(sortTransactions([tx()], cycled)).toHaveLength(1);
  });

  it("discards other keys rather than keeping a stale priority list", () => {
    const keys: SortKey[] = [
      { field: "status", direction: "asc" },
      { field: "amount", direction: "desc" },
    ];
    expect(toggleSortKey(keys, "date")).toEqual([
      { field: "date", direction: DEFAULT_SORT_DIRECTION.date },
    ]);
  });
});

describe("toggleSortKey — additive activation", () => {
  it("appends the field as a lower-priority tiebreaker", () => {
    const keys: SortKey[] = [{ field: "status", direction: "asc" }];
    expect(toggleSortKey(keys, "amount", { additive: true })).toEqual([
      { field: "status", direction: "asc" },
      { field: "amount", direction: DEFAULT_SORT_DIRECTION.amount },
    ]);
  });

  it("flips an existing key without changing its priority", () => {
    const keys: SortKey[] = [
      { field: "status", direction: "asc" },
      { field: "amount", direction: "desc" },
    ];
    expect(toggleSortKey(keys, "status", { additive: true })).toEqual([
      { field: "status", direction: "desc" },
      { field: "amount", direction: "desc" },
    ]);
  });

  it("removes the key on the third additive activation", () => {
    const keys: SortKey[] = [
      { field: "date", direction: "desc" },
      { field: "status", direction: "desc" },
    ];
    expect(toggleSortKey(keys, "status", { additive: true })).toEqual([
      { field: "date", direction: "desc" },
    ]);
  });

  it("refuses to exceed the key cap and signals it by returning the same reference", () => {
    const keys: SortKey[] = [
      { field: "date", direction: "desc" },
      { field: "amount", direction: "desc" },
      { field: "type", direction: "asc" },
    ];
    const result = toggleSortKey(keys, "status", { additive: true });
    expect(result).toBe(keys);
  });
});

describe("removeSortKey / setSortKeyDirection / moveSortKey", () => {
  const keys: SortKey[] = [
    { field: "date", direction: "desc" },
    { field: "amount", direction: "asc" },
  ];

  it("removes one key and keeps the order of the rest", () => {
    expect(removeSortKey(keys, "date")).toEqual([
      { field: "amount", direction: "asc" },
    ]);
  });

  it("removing an absent field is a no-op", () => {
    expect(removeSortKey(keys, "status")).toEqual(keys);
  });

  it("sets a direction", () => {
    expect(setSortKeyDirection(keys, "amount", "desc")).toEqual([
      { field: "date", direction: "desc" },
      { field: "amount", direction: "desc" },
    ]);
  });

  it("returns the same reference when the direction already matches", () => {
    expect(setSortKeyDirection(keys, "amount", "asc")).toBe(keys);
  });

  it("returns the same reference for a field that is not sorted", () => {
    expect(setSortKeyDirection(keys, "status", "asc")).toBe(keys);
  });

  it("moves a key down the priority list", () => {
    expect(moveSortKey(keys, "date", 1)).toEqual([
      { field: "amount", direction: "asc" },
      { field: "date", direction: "desc" },
    ]);
  });

  it("returns the same reference when the move falls off either end", () => {
    expect(moveSortKey(keys, "date", -1)).toBe(keys);
    expect(moveSortKey(keys, "amount", 1)).toBe(keys);
    expect(moveSortKey(keys, "date", 0)).toBe(keys);
  });
});

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

describe("sortTransactions", () => {
  it("does not mutate the input array", () => {
    const rows = [tx({ id: "b" }), tx({ id: "a" })];
    const snapshot = [...rows];
    sortTransactions(rows, [{ field: "type", direction: "asc" }]);
    expect(rows).toEqual(snapshot);
  });

  it("defaults to newest first when no keys are given", () => {
    const rows = [
      tx({ id: "old", timestamp: "2026-01-01T00:00:00Z" }),
      tx({ id: "new", timestamp: "2026-06-01T00:00:00Z" }),
    ];
    expect(ids(sortTransactions(rows))).toEqual(["new", "old"]);
    expect(ids(sortTransactions(rows, []))).toEqual(["new", "old"]);
    expect(ids(sortTransactions(rows, DEFAULT_SORT_KEYS))).toEqual(["new", "old"]);
  });

  it("sorts amounts numerically, not as strings", () => {
    const rows = [
      tx({ id: "9", amount: "9" }),
      tx({ id: "100", amount: "100" }),
      tx({ id: "20", amount: "20" }),
    ];
    expect(ids(sortTransactions(rows, [{ field: "amount", direction: "asc" }]))).toEqual(
      ["9", "20", "100"],
    );
  });

  it("orders status by lifecycle rather than alphabetically", () => {
    const rows = [
      tx({ id: "c", status: "completed" }),
      tx({ id: "f", status: "failed" }),
      tx({ id: "p", status: "pending" }),
    ];
    expect(ids(sortTransactions(rows, [{ field: "status", direction: "asc" }]))).toEqual(
      ["p", "c", "f"],
    );
  });

  it("orders type by deposit, withdrawal, transfer, trade", () => {
    const rows = [
      tx({ id: "trade", type: "trade" }),
      tx({ id: "withdrawal", type: "withdrawal" }),
      tx({ id: "transfer", type: "transfer" }),
      tx({ id: "deposit", type: "deposit" }),
    ];
    expect(ids(sortTransactions(rows, [{ field: "type", direction: "asc" }]))).toEqual(
      ["deposit", "withdrawal", "transfer", "trade"],
    );
  });

  it("applies later keys only to rows that tie on earlier ones", () => {
    const rows = [
      tx({ id: "a", status: "completed", amount: "10" }),
      tx({ id: "b", status: "pending", amount: "5" }),
      tx({ id: "c", status: "completed", amount: "50" }),
      tx({ id: "d", status: "pending", amount: "80" }),
    ];
    const sorted = sortTransactions(rows, [
      { field: "status", direction: "asc" },
      { field: "amount", direction: "desc" },
    ]);
    expect(ids(sorted)).toEqual(["d", "b", "c", "a"]);
  });

  it("sorts rows with no amount last in both directions", () => {
    const rows = [
      tx({ id: "none", amount: null }),
      tx({ id: "low", amount: "1" }),
      tx({ id: "high", amount: "999" }),
    ];
    expect(ids(sortTransactions(rows, [{ field: "amount", direction: "asc" }]))).toEqual(
      ["low", "high", "none"],
    );
    expect(ids(sortTransactions(rows, [{ field: "amount", direction: "desc" }]))).toEqual(
      ["high", "low", "none"],
    );
  });

  it("treats an unparseable amount as absent", () => {
    const rows = [
      tx({ id: "bad", amount: "not-a-number" }),
      tx({ id: "good", amount: "5" }),
    ];
    expect(ids(sortTransactions(rows, [{ field: "amount", direction: "desc" }]))).toEqual(
      ["good", "bad"],
    );
  });

  it("sorts rows with an unreadable timestamp last", () => {
    const rows = [
      tx({ id: "bad", timestamp: "whenever" }),
      tx({ id: "good", timestamp: "2026-01-01T00:00:00Z" }),
    ];
    expect(ids(sortTransactions(rows, [{ field: "date", direction: "asc" }]))).toEqual(
      ["good", "bad"],
    );
    expect(ids(sortTransactions(rows, [{ field: "date", direction: "desc" }]))).toEqual(
      ["good", "bad"],
    );
  });

  it("produces one ordering for rows that tie on every key, whatever the input order", () => {
    const a = tx({ id: "a" });
    const b = tx({ id: "b" });
    const keys: SortKey[] = [{ field: "type", direction: "asc" }];
    expect(ids(sortTransactions([a, b], keys))).toEqual(["a", "b"]);
    expect(ids(sortTransactions([b, a], keys))).toEqual(["a", "b"]);
  });
});

describe("compareTransactions", () => {
  it("returns 0 only for the same row identity", () => {
    const row = tx({ id: "same" });
    expect(compareTransactions(row, row, DEFAULT_SORT_KEYS)).toBe(0);
  });

  it("is antisymmetric for distinct rows", () => {
    const left = tx({ id: "a", amount: "10" });
    const right = tx({ id: "b", amount: "20" });
    const keys: SortKey[] = [{ field: "amount", direction: "asc" }];
    expect(compareTransactions(left, right, keys)).toBeLessThan(0);
    expect(compareTransactions(right, left, keys)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Date presets
// ---------------------------------------------------------------------------

describe("resolveDatePreset", () => {
  const now = new Date("2026-07-28T09:30:00Z");

  it("counts today as one of the days in a rolling window", () => {
    expect(resolveDatePreset("7d", now)).toEqual({
      dateFrom: "2026-07-22",
      dateTo: "2026-07-28",
    });
  });

  it("resolves 30 and 90 day windows", () => {
    expect(resolveDatePreset("30d", now)).toEqual({
      dateFrom: "2026-06-29",
      dateTo: "2026-07-28",
    });
    expect(resolveDatePreset("90d", now)).toEqual({
      dateFrom: "2026-04-30",
      dateTo: "2026-07-28",
    });
  });

  it("starts year-to-date on January 1", () => {
    expect(resolveDatePreset("ytd", now)).toEqual({
      dateFrom: "2026-01-01",
      dateTo: "2026-07-28",
    });
  });

  it("crosses a month boundary correctly", () => {
    expect(resolveDatePreset("7d", new Date("2026-03-03T00:00:00Z"))).toEqual({
      dateFrom: "2026-02-25",
      dateTo: "2026-03-03",
    });
  });

  it("ignores the time of day, so the range does not shift within a day", () => {
    const early = resolveDatePreset("30d", new Date("2026-07-28T00:00:01Z"));
    const late = resolveDatePreset("30d", new Date("2026-07-28T23:59:59Z"));
    expect(early).toEqual(late);
  });
});

describe("matchDatePreset", () => {
  const now = new Date("2026-07-28T09:30:00Z");

  it("identifies a range that a preset produced", () => {
    const range = resolveDatePreset("30d", now);
    expect(matchDatePreset(range, now)).toBe("30d");
  });

  it("returns null for a hand-picked range", () => {
    expect(
      matchDatePreset({ dateFrom: "2026-02-01", dateTo: "2026-02-14" }, now),
    ).toBeNull();
  });

  it("returns null when either bound is missing", () => {
    expect(matchDatePreset({ dateFrom: "2026-07-22", dateTo: "" }, now)).toBeNull();
    expect(matchDatePreset({ dateFrom: "", dateTo: "2026-07-28" }, now)).toBeNull();
  });

  it("stops matching once the range no longer means the same window", () => {
    const range = resolveDatePreset("7d", now);
    const tomorrow = new Date("2026-07-29T09:30:00Z");
    expect(matchDatePreset(range, tomorrow)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("validateTransactionFilters", () => {
  it("reports nothing for an empty filter set", () => {
    expect(validateTransactionFilters(filters())).toEqual([]);
  });

  it("reports an inverted date range", () => {
    expect(
      validateTransactionFilters(
        filters({ dateFrom: "2026-06-01", dateTo: "2026-01-01" }),
      ),
    ).toEqual([{ range: "date", code: "dateRangeInverted" }]);
  });

  it("accepts a single-day range", () => {
    expect(
      validateTransactionFilters(
        filters({ dateFrom: "2026-06-01", dateTo: "2026-06-01" }),
      ),
    ).toEqual([]);
  });

  it("reports an inverted amount range", () => {
    expect(
      validateTransactionFilters(filters({ amountMin: "500", amountMax: "10" })),
    ).toEqual([{ range: "amount", code: "amountRangeInverted" }]);
  });

  it("compares amounts numerically, so 9 is not above 100", () => {
    expect(
      validateTransactionFilters(filters({ amountMin: "9", amountMax: "100" })),
    ).toEqual([]);
  });

  it("reports both ranges at once", () => {
    expect(
      validateTransactionFilters(
        filters({
          dateFrom: "2026-06-01",
          dateTo: "2026-01-01",
          amountMin: "500",
          amountMax: "10",
        }),
      ),
    ).toHaveLength(2);
  });

  it("says nothing when only one bound of a range is set", () => {
    expect(validateTransactionFilters(filters({ amountMin: "500" }))).toEqual([]);
    expect(validateTransactionFilters(filters({ dateTo: "2026-01-01" }))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

describe("filterTransactions — search", () => {
  const rows = [
    tx({ id: "1", type: "deposit", asset: "USDC", transactionHash: "aaa111" }),
    tx({
      id: "2",
      type: "withdrawal",
      status: "failed",
      asset: "XLM",
      transactionHash: "bbb222",
    }),
  ];

  it("returns every row when the search is empty", () => {
    expect(filterTransactions(rows, filters())).toHaveLength(2);
    expect(filterTransactions(rows, filters({ search: "   " }))).toHaveLength(2);
  });

  it("matches on asset, type, status and hash, case-insensitively", () => {
    expect(ids(filterTransactions(rows, filters({ search: "usdc" })))).toEqual(["1"]);
    expect(ids(filterTransactions(rows, filters({ search: "WITHDRAWAL" })))).toEqual([
      "2",
    ]);
    expect(ids(filterTransactions(rows, filters({ search: "failed" })))).toEqual(["2"]);
    expect(ids(filterTransactions(rows, filters({ search: "bbb" })))).toEqual(["2"]);
  });

  it("requires every term to match, so terms narrow rather than widen", () => {
    expect(ids(filterTransactions(rows, filters({ search: "xlm failed" })))).toEqual([
      "2",
    ]);
    expect(filterTransactions(rows, filters({ search: "xlm deposit" }))).toEqual([]);
  });

  it("does not match a row on a term found only in another row", () => {
    expect(filterTransactions(rows, filters({ search: "eurc" }))).toEqual([]);
  });
});

describe("filterTransactions — type, status and asset", () => {
  const rows = [
    tx({ id: "1", type: "deposit", status: "completed", asset: "USDC" }),
    tx({ id: "2", type: "withdrawal", status: "pending", asset: "XLM" }),
    tx({ id: "3", type: "trade", status: "failed", asset: null }),
  ];

  it("treats an empty selection as 'all'", () => {
    expect(filterTransactions(rows, filters({ types: [], statuses: [] }))).toHaveLength(
      3,
    );
  });

  it("keeps rows matching any selected type", () => {
    expect(
      ids(filterTransactions(rows, filters({ types: ["deposit", "trade"] }))),
    ).toEqual(["1", "3"]);
  });

  it("keeps rows matching any selected status", () => {
    expect(
      ids(filterTransactions(rows, filters({ statuses: ["pending", "failed"] }))),
    ).toEqual(["2", "3"]);
  });

  it("intersects type and status rather than unioning them", () => {
    expect(
      filterTransactions(
        rows,
        filters({ types: ["deposit"], statuses: ["pending"] }),
      ),
    ).toEqual([]);
  });

  it("matches an asset without regard to case or padding", () => {
    expect(ids(filterTransactions(rows, filters({ asset: "usdc" })))).toEqual(["1"]);
    expect(ids(filterTransactions(rows, filters({ asset: " XLM " })))).toEqual(["2"]);
  });

  it("excludes rows with no asset when an asset is selected", () => {
    expect(ids(filterTransactions(rows, filters({ asset: "USDC" })))).toEqual(["1"]);
  });
});

describe("filterTransactions — date range", () => {
  const rows = [
    tx({ id: "jan", timestamp: "2026-01-15T12:00:00Z" }),
    tx({ id: "mar", timestamp: "2026-03-15T12:00:00Z" }),
    tx({ id: "jun", timestamp: "2026-06-15T12:00:00Z" }),
  ];

  it("filters from a lower bound inclusively", () => {
    expect(ids(filterTransactions(rows, filters({ dateFrom: "2026-03-15" })))).toEqual([
      "mar",
      "jun",
    ]);
  });

  it("filters to an upper bound inclusively", () => {
    expect(ids(filterTransactions(rows, filters({ dateTo: "2026-03-15" })))).toEqual([
      "jan",
      "mar",
    ]);
  });

  it("includes both ends of a single-day range", () => {
    const sameDay = [
      tx({ id: "start", timestamp: "2026-03-15T00:00:00.000Z" }),
      tx({ id: "end", timestamp: "2026-03-15T23:59:59.999Z" }),
      tx({ id: "next", timestamp: "2026-03-16T00:00:00.000Z" }),
    ];
    expect(
      ids(
        filterTransactions(
          sameDay,
          filters({ dateFrom: "2026-03-15", dateTo: "2026-03-15" }),
        ),
      ),
    ).toEqual(["start", "end"]);
  });

  it("excludes rows whose timestamp cannot be read", () => {
    const withBad = [...rows, tx({ id: "bad", timestamp: "sometime" })];
    expect(
      ids(filterTransactions(withBad, filters({ dateFrom: "2026-01-01" }))),
    ).not.toContain("bad");
  });

  it("keeps unreadable timestamps when no date bound is set", () => {
    const withBad = [tx({ id: "bad", timestamp: "sometime" })];
    expect(ids(filterTransactions(withBad, filters()))).toEqual(["bad"]);
  });

  it("ignores an inverted range instead of matching nothing", () => {
    expect(
      filterTransactions(
        rows,
        filters({ dateFrom: "2026-06-01", dateTo: "2026-01-01" }),
      ),
    ).toHaveLength(3);
  });

  it("still applies other filters when the date range is ignored", () => {
    const result = filterTransactions(
      rows,
      filters({
        dateFrom: "2026-06-01",
        dateTo: "2026-01-01",
        search: "mar",
      }),
    );
    // "mar" is not in the searchable text, so search alone rules everything out.
    expect(result).toEqual([]);
  });
});

describe("filterTransactions — amount range", () => {
  const rows = [
    tx({ id: "10", amount: "10" }),
    tx({ id: "100", amount: "100" }),
    tx({ id: "1000", amount: "1000" }),
    tx({ id: "none", amount: null }),
  ];

  it("filters on a minimum inclusively", () => {
    expect(ids(filterTransactions(rows, filters({ amountMin: "100" })))).toEqual([
      "100",
      "1000",
    ]);
  });

  it("filters on a maximum inclusively", () => {
    expect(ids(filterTransactions(rows, filters({ amountMax: "100" })))).toEqual([
      "10",
      "100",
    ]);
  });

  it("compares numerically, so 1000 is above 999 and not below it", () => {
    expect(ids(filterTransactions(rows, filters({ amountMin: "999" })))).toEqual([
      "1000",
    ]);
  });

  it("excludes rows with no amount once either bound is set", () => {
    expect(ids(filterTransactions(rows, filters({ amountMin: "0" })))).not.toContain(
      "none",
    );
    expect(ids(filterTransactions(rows, filters({ amountMax: "5000" })))).not.toContain(
      "none",
    );
  });

  it("keeps rows with no amount when the range is unbounded", () => {
    expect(ids(filterTransactions(rows, filters()))).toContain("none");
  });

  it("excludes rows whose amount is not a number", () => {
    const withBad = [tx({ id: "bad", amount: "one hundred" })];
    expect(filterTransactions(withBad, filters({ amountMin: "0" }))).toEqual([]);
  });

  it("ignores an inverted range instead of matching nothing", () => {
    expect(
      filterTransactions(rows, filters({ amountMin: "500", amountMax: "10" })),
    ).toHaveLength(4);
  });
});

describe("filterTransactions — combinations", () => {
  it("applies every filter as a conjunction", () => {
    const rows = [
      tx({
        id: "match",
        type: "withdrawal",
        status: "failed",
        asset: "USDC",
        amount: "250",
        timestamp: "2026-04-10T00:00:00Z",
      }),
      tx({
        id: "wrongType",
        type: "deposit",
        status: "failed",
        asset: "USDC",
        amount: "250",
        timestamp: "2026-04-10T00:00:00Z",
      }),
      tx({
        id: "wrongAmount",
        type: "withdrawal",
        status: "failed",
        asset: "USDC",
        amount: "9",
        timestamp: "2026-04-10T00:00:00Z",
      }),
      tx({
        id: "wrongDate",
        type: "withdrawal",
        status: "failed",
        asset: "USDC",
        amount: "250",
        timestamp: "2025-04-10T00:00:00Z",
      }),
    ];

    expect(
      ids(
        filterTransactions(
          rows,
          filters({
            types: ["withdrawal"],
            statuses: ["failed"],
            asset: "USDC",
            amountMin: "100",
            amountMax: "500",
            dateFrom: "2026-01-01",
            dateTo: "2026-12-31",
          }),
        ),
      ),
    ).toEqual(["match"]);
  });

  it("preserves input order, leaving ordering to the sorter", () => {
    const rows = [tx({ id: "b" }), tx({ id: "a" }), tx({ id: "c" })];
    expect(ids(filterTransactions(rows, filters()))).toEqual(["b", "a", "c"]);
  });

  it("does not mutate the input array", () => {
    const rows = [tx({ id: "a" }), tx({ id: "b" })];
    const snapshot = [...rows];
    filterTransactions(rows, filters({ search: "usdc" }));
    expect(rows).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// Active filter summary
// ---------------------------------------------------------------------------

describe("describeActiveFilters", () => {
  it("describes nothing for an empty filter set", () => {
    expect(describeActiveFilters(filters())).toEqual([]);
    expect(hasActiveTransactionFilters(filters())).toBe(false);
    expect(countActiveFilters(filters())).toBe(0);
  });

  it("emits one chip per selected type and status", () => {
    const chips = describeActiveFilters(
      filters({ types: ["deposit", "withdrawal"], statuses: ["failed"] }),
    );
    expect(chips).toEqual([
      { id: "type:deposit", kind: "type", value: "deposit" },
      { id: "type:withdrawal", kind: "type", value: "withdrawal" },
      { id: "status:failed", kind: "status", value: "failed" },
    ]);
  });

  it("emits a chip for every single-valued filter", () => {
    const chips = describeActiveFilters(
      filters({
        search: "abc",
        asset: "USDC",
        dateFrom: "2026-01-01",
        dateTo: "2026-02-01",
        amountMin: "5",
        amountMax: "50",
      }),
    );
    expect(chips.map((chip) => chip.kind)).toEqual([
      "search",
      "asset",
      "dateFrom",
      "dateTo",
      "amountMin",
      "amountMax",
    ]);
  });

  it("gives every chip a distinct id so they can be keyed and targeted", () => {
    const chips = describeActiveFilters(
      filters({ types: ["deposit", "trade"], statuses: ["pending"], search: "x" }),
    );
    expect(new Set(chips.map((chip) => chip.id)).size).toBe(chips.length);
  });

  it("ignores a whitespace-only search", () => {
    expect(describeActiveFilters(filters({ search: "   " }))).toEqual([]);
  });

  it("treats a zero amount bound as an applied filter", () => {
    // "" means unset; "0" is a real bound and must not be mistaken for unset.
    expect(countActiveFilters(filters({ amountMin: "0" }))).toBe(1);
  });

  it("counts each applied filter once", () => {
    expect(
      countActiveFilters(filters({ types: ["deposit", "trade"], asset: "USDC" })),
    ).toBe(3);
    expect(hasActiveTransactionFilters(filters({ asset: "USDC" }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe("paginateRows", () => {
  const rows = Array.from({ length: 12 }, (_, index) => tx({ id: String(index) }));

  it("slices the requested page", () => {
    const result = paginateRows(rows, 2, 5);
    expect(ids(result.rows)).toEqual(["5", "6", "7", "8", "9"]);
    expect(result).toMatchObject({ page: 2, totalItems: 12, totalPages: 3 });
  });

  it("returns a short final page", () => {
    expect(paginateRows(rows, 3, 5).rows).toHaveLength(2);
  });

  it("clamps a page past the end rather than returning nothing", () => {
    const result = paginateRows(rows, 99, 5);
    expect(result.page).toBe(3);
    expect(result.rows).toHaveLength(2);
  });

  it("clamps a page below one", () => {
    expect(paginateRows(rows, 0, 5).page).toBe(1);
    expect(paginateRows(rows, -4, 5).page).toBe(1);
  });

  it("reports one page for an empty result set", () => {
    expect(paginateRows([], 1, 10)).toEqual({
      rows: [],
      page: 1,
      totalItems: 0,
      totalPages: 1,
    });
  });

  it("survives a nonsensical page size", () => {
    expect(paginateRows(rows, 1, 0).rows).toHaveLength(1);
  });
});
