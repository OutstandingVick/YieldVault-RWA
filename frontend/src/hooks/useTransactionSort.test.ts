/**
 * useTransactionSort — URL-synced multi-column sort tests.
 *
 * The URL is the source of truth for ordering, so these tests assert on the
 * params the hook reads and writes: an ordering has to survive a reload, a
 * shared link, and the legacy single-column params older links still carry.
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import React from "react";
import { useTransactionSort } from "./useTransactionSort";
import { DEFAULT_SORT_KEYS } from "../lib/transactionQuery";

/** Renders the hook alongside the raw params, so writes can be inspected. */
function renderSort(initialSearch = "") {
  return renderHook(
    () => {
      const [searchParams] = useSearchParams();
      return { ...useTransactionSort(), searchParams };
    },
    {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(
          MemoryRouter,
          { initialEntries: [`/?${initialSearch}`] },
          children,
        ),
    },
  );
}

describe("useTransactionSort — reading the URL", () => {
  it("reports no explicit sort when the URL carries none", () => {
    const { result } = renderSort("");
    expect(result.current.sortKeys).toEqual([]);
    expect(result.current.isDefaultSort).toBe(true);
    expect(result.current.effectiveSortKeys).toEqual(DEFAULT_SORT_KEYS);
  });

  it("reads a multi-key sort param", () => {
    const { result } = renderSort("sort=status:asc,amount:desc");
    expect(result.current.sortKeys).toEqual([
      { field: "status", direction: "asc" },
      { field: "amount", direction: "desc" },
    ]);
    expect(result.current.isDefaultSort).toBe(false);
  });

  it("falls back to the legacy single-column params", () => {
    const { result } = renderSort("sortBy=amount&direction=asc");
    expect(result.current.sortKeys).toEqual([
      { field: "amount", direction: "asc" },
    ]);
  });

  it("prefers the multi-key param when both are present", () => {
    const { result } = renderSort("sort=type:asc&sortBy=amount&direction=desc");
    expect(result.current.sortKeys).toEqual([{ field: "type", direction: "asc" }]);
  });

  it("ignores an unusable sort param rather than throwing", () => {
    const { result } = renderSort("sort=wallet:sideways");
    expect(result.current.sortKeys).toEqual([]);
    expect(result.current.effectiveSortKeys).toEqual(DEFAULT_SORT_KEYS);
  });
});

describe("useTransactionSort — writing the URL", () => {
  it("writes an explicit single key to sort, and mirrors it into the legacy params", () => {
    const { result } = renderSort("");

    act(() => {
      result.current.toggleSort("amount");
    });

    expect(result.current.sortKeys).toEqual([
      { field: "amount", direction: "desc" },
    ]);
    expect(result.current.searchParams.get("sort")).toBe("amount:desc");
    expect(result.current.searchParams.get("sortBy")).toBe("amount");
    expect(result.current.searchParams.get("direction")).toBe("desc");
  });

  it("keeps an explicitly chosen default-direction sort distinct from no sort", () => {
    const { result } = renderSort("");

    // Choosing date/desc lands on the same ordering as the default, but it is a
    // choice: a further click has to be able to reverse it.
    act(() => {
      result.current.toggleSort("date");
    });
    expect(result.current.isDefaultSort).toBe(false);
    expect(result.current.searchParams.get("sort")).toBe("date:desc");

    act(() => {
      result.current.toggleSort("date");
    });
    expect(result.current.sortKeys).toEqual([{ field: "date", direction: "asc" }]);
  });

  it("does not mistake the legacy params' default values for a sort choice", () => {
    // This is what useDataTableState leaves behind after a page change.
    const { result } = renderSort("sortBy=date&direction=desc&page=2");
    expect(result.current.sortKeys).toEqual([]);
    expect(result.current.isDefaultSort).toBe(true);
  });

  it("mirrors the primary key into the legacy params for a multi-key sort", () => {
    const { result } = renderSort("");

    act(() => {
      result.current.toggleSort("status");
    });
    act(() => {
      result.current.toggleSort("amount", true);
    });

    expect(result.current.searchParams.get("sort")).toBe("status:asc,amount:desc");
    expect(result.current.searchParams.get("sortBy")).toBe("status");
    expect(result.current.searchParams.get("direction")).toBe("asc");
  });

  it("returns to page 1, since a row's page is meaningless under a new order", () => {
    const { result } = renderSort("page=4");

    act(() => {
      result.current.toggleSort("amount");
    });

    expect(result.current.searchParams.get("page")).toBe("1");
  });

  it("keeps filter params untouched", () => {
    const { result } = renderSort("types=deposit&search=abc");

    act(() => {
      result.current.toggleSort("amount");
    });

    expect(result.current.searchParams.get("types")).toBe("deposit");
    expect(result.current.searchParams.get("search")).toBe("abc");
  });

  it("cycles a column through both directions and back to the default order", () => {
    const { result } = renderSort("");

    act(() => {
      result.current.toggleSort("amount");
    });
    expect(result.current.sortKeys).toEqual([
      { field: "amount", direction: "desc" },
    ]);

    act(() => {
      result.current.toggleSort("amount");
    });
    expect(result.current.sortKeys).toEqual([
      { field: "amount", direction: "asc" },
    ]);

    act(() => {
      result.current.toggleSort("amount");
    });
    expect(result.current.sortKeys).toEqual([]);
    expect(result.current.effectiveSortKeys).toEqual(DEFAULT_SORT_KEYS);
  });

  it("reports refusal when the key cap is reached, and changes nothing", () => {
    const { result } = renderSort("sort=date:desc,amount:desc,type:asc");

    let accepted: boolean | undefined;
    act(() => {
      accepted = result.current.toggleSort("status", true);
    });

    expect(accepted).toBe(false);
    expect(result.current.sortKeys).toHaveLength(3);
    expect(result.current.searchParams.get("sort")).toBe(
      "date:desc,amount:desc,type:asc",
    );
  });

  it("reports acceptance for a change that was applied", () => {
    const { result } = renderSort("");

    let accepted: boolean | undefined;
    act(() => {
      accepted = result.current.toggleSort("type");
    });

    expect(accepted).toBe(true);
  });

  it("sets one key's direction without disturbing the others", () => {
    const { result } = renderSort("sort=status:asc,amount:desc");

    act(() => {
      result.current.setSortDirection("amount", "asc");
    });

    expect(result.current.sortKeys).toEqual([
      { field: "status", direction: "asc" },
      { field: "amount", direction: "asc" },
    ]);
  });

  it("removes one key and keeps the rest", () => {
    const { result } = renderSort("sort=status:asc,amount:desc");

    act(() => {
      result.current.removeSort("status");
    });

    expect(result.current.sortKeys).toEqual([
      { field: "amount", direction: "desc" },
    ]);
  });

  it("reorders priority", () => {
    const { result } = renderSort("sort=status:asc,amount:desc");

    act(() => {
      result.current.moveSort("amount", -1);
    });

    expect(result.current.sortKeys).toEqual([
      { field: "amount", direction: "desc" },
      { field: "status", direction: "asc" },
    ]);
  });

  it("clears the sort back to the default ordering", () => {
    const { result } = renderSort("sort=status:asc,amount:desc");

    act(() => {
      result.current.clearSort();
    });

    expect(result.current.sortKeys).toEqual([]);
    expect(result.current.searchParams.get("sort")).toBeNull();
    // The legacy params keep describing the default so they cannot contradict it.
    expect(result.current.searchParams.get("sortBy")).toBe(
      DEFAULT_SORT_KEYS[0].field,
    );
    expect(result.current.searchParams.get("direction")).toBe(
      DEFAULT_SORT_KEYS[0].direction,
    );
  });
});
