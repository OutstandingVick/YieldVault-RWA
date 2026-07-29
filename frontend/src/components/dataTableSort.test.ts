import { describe, it, expect } from "vitest";
import { getColumnSortState } from "./dataTableSort";
import type { TableSortKey } from "./dataTableSort";

describe("getColumnSortState", () => {
  const unsorted = { ariaSort: "none", direction: null, priority: null };

  it("reports a non-sortable column as unsorted, whatever the sort state says", () => {
    expect(
      getColumnSortState("amount", false, [{ field: "amount", direction: "asc" }], undefined, "asc"),
    ).toEqual(unsorted);
  });

  it("reports a sortable column that is not part of the sort as unsorted", () => {
    expect(
      getColumnSortState("type", true, [{ field: "amount", direction: "asc" }], undefined, "asc"),
    ).toEqual(unsorted);
  });

  it("maps direction onto the aria-sort vocabulary", () => {
    expect(
      getColumnSortState("amount", true, [{ field: "amount", direction: "asc" }], undefined, "desc"),
    ).toMatchObject({ ariaSort: "ascending", direction: "asc" });
    expect(
      getColumnSortState("amount", true, [{ field: "amount", direction: "desc" }], undefined, "asc"),
    ).toMatchObject({ ariaSort: "descending", direction: "desc" });
  });

  it("omits the priority when only one column is sorted", () => {
    expect(
      getColumnSortState("amount", true, [{ field: "amount", direction: "asc" }], undefined, "asc")
        .priority,
    ).toBeNull();
  });

  it("numbers priorities from one when several columns are sorted", () => {
    const keys: TableSortKey[] = [
      { field: "status", direction: "asc" },
      { field: "amount", direction: "desc" },
    ];
    expect(getColumnSortState("status", true, keys, undefined, "asc").priority).toBe(1);
    expect(getColumnSortState("amount", true, keys, undefined, "asc").priority).toBe(2);
  });

  it("falls back to the single-column props when no sort keys are given", () => {
    expect(getColumnSortState("amount", true, undefined, "amount", "desc")).toEqual({
      ariaSort: "descending",
      direction: "desc",
      priority: null,
    });
    expect(getColumnSortState("amount", true, undefined, "type", "desc")).toEqual(unsorted);
  });

  it("prefers sort keys over the single-column props", () => {
    // An empty key list is still a multi-sort answer: nothing is sorted.
    expect(getColumnSortState("amount", true, [], "amount", "desc")).toEqual(unsorted);
  });
});
