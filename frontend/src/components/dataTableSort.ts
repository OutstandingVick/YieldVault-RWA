/**
 * Sort-state helpers shared by `DataTable` and `VirtualizedDataTable`.
 *
 * These live outside the component modules so both tables can share one
 * implementation of "how should this header look" without either file exporting
 * a non-component (which breaks fast refresh).
 */

export type TableSortDirection = "asc" | "desc";

/**
 * One column of a multi-column sort. Deliberately keyed by a plain string so
 * the shared table components stay independent of any one page's sort field
 * union.
 */
export interface TableSortKey {
  field: string;
  direction: TableSortDirection;
}

export interface ColumnSortState {
  ariaSort: "ascending" | "descending" | "none";
  /** Direction this column is sorted in, or null when it is not sorted. */
  direction: TableSortDirection | null;
  /**
   * 1-based position in the sort priority list, or null when the column is not
   * sorted or when it is the only sorted column (a lone "1" is just noise).
   */
  priority: number | null;
}

/**
 * Resolves how a header should present its sort state.
 *
 * Two prop shapes are supported: `sortKeys` for multi-column sort, and the
 * original single-column `sortBy` / `sortDirection` pair, which every other
 * table in the app still uses. `sortKeys` takes precedence when provided.
 */
export function getColumnSortState(
  columnId: string,
  sortable: boolean | undefined,
  sortKeys: readonly TableSortKey[] | undefined,
  sortBy: string | undefined,
  sortDirection: TableSortDirection,
): ColumnSortState {
  const unsorted: ColumnSortState = {
    ariaSort: "none",
    direction: null,
    priority: null,
  };

  if (!sortable) return unsorted;

  if (sortKeys) {
    const index = sortKeys.findIndex((key) => key.field === columnId);
    if (index === -1) return unsorted;

    const { direction } = sortKeys[index];
    return {
      ariaSort: direction === "asc" ? "ascending" : "descending",
      direction,
      priority: sortKeys.length > 1 ? index + 1 : null,
    };
  }

  if (sortBy !== columnId) return unsorted;

  return {
    ariaSort: sortDirection === "asc" ? "ascending" : "descending",
    direction: sortDirection,
    priority: null,
  };
}
