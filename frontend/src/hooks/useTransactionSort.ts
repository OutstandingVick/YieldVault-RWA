import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DEFAULT_SORT_KEYS,
  moveSortKey,
  parseLegacySortParams,
  parseSortParam,
  removeSortKey,
  serializeSortParam,
  setSortKeyDirection,
  toggleSortKey,
  type SortDirection,
  type SortField,
  type SortKey,
} from "../lib/transactionQuery";

/** Multi-column sort, e.g. `?sort=status:asc,amount:desc`. */
export const SORT_PARAM = "sort";
/** Single-column params the table used before multi-sort; still honoured. */
export const LEGACY_SORT_FIELD_PARAM = "sortBy";
export const LEGACY_SORT_DIRECTION_PARAM = "direction";
const PAGE_PARAM = "page";

export interface UseTransactionSortResult {
  /**
   * Sort keys as configured, empty when the table is on its default ordering.
   * Use this to decide whether a "clear sort" control is relevant.
   */
  sortKeys: SortKey[];
  /** Sort keys to actually sort by — the default ordering when none are set. */
  effectiveSortKeys: readonly SortKey[];
  /** True when no explicit sort is configured. */
  isDefaultSort: boolean;
  /**
   * Cycles a field's sort on header activation. Pass `additive` to append it as
   * a lower-priority tiebreaker instead of replacing the sort.
   *
   * @returns `false` when the request was refused because {@link MAX_SORT_KEYS}
   * is already reached, so the caller can say so rather than appear to ignore
   * the click.
   */
  toggleSort: (field: SortField, additive?: boolean) => boolean;
  setSortDirection: (field: SortField, direction: SortDirection) => void;
  removeSort: (field: SortField) => void;
  /** Moves a field up (-1) or down (+1) the priority list. */
  moveSort: (field: SortField, offset: number) => void;
  clearSort: () => void;
}

/**
 * URL-synced multi-column sort state for the transaction history table.
 *
 * The URL is the single source of truth, so an ordering can be bookmarked and
 * shared. Alongside the multi-key `sort` param the primary key is mirrored into
 * the legacy `sortBy`/`direction` params: `useDataTableState` still writes
 * those on every page change, and mirroring keeps the two representations from
 * contradicting each other. `sort` wins whenever it is present.
 */
export function useTransactionSort(): UseTransactionSortResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const sortKeys = useMemo(() => {
    // `sort` is written for every explicit ordering, so its presence — not its
    // content — is what distinguishes "the user chose this" from "the default".
    const fromMultiParam = parseSortParam(searchParams.get(SORT_PARAM));
    if (fromMultiParam.length > 0) return fromMultiParam;

    const legacy = parseLegacySortParams(
      searchParams.get(LEGACY_SORT_FIELD_PARAM),
      searchParams.get(LEGACY_SORT_DIRECTION_PARAM),
    );

    // `useDataTableState` writes the legacy params on every page change, filling
    // them with the table's defaults. Reading those back as an explicit sort
    // would make a page change look like a sort choice — leaving the sort panel
    // claiming a key the user never picked. A legacy pair that merely restates
    // the default therefore means "no explicit sort".
    const isRestatingDefault =
      legacy.length === 1 &&
      legacy[0].field === DEFAULT_SORT_KEYS[0].field &&
      legacy[0].direction === DEFAULT_SORT_KEYS[0].direction;

    return isRestatingDefault ? [] : legacy;
  }, [searchParams]);

  const effectiveSortKeys = sortKeys.length > 0 ? sortKeys : DEFAULT_SORT_KEYS;

  const commit = useCallback(
    (nextKeys: readonly SortKey[]) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          const primary = nextKeys[0] ?? DEFAULT_SORT_KEYS[0];

          if (nextKeys.length > 0) {
            next.set(SORT_PARAM, serializeSortParam(nextKeys));
          } else {
            next.delete(SORT_PARAM);
          }

          next.set(LEGACY_SORT_FIELD_PARAM, primary.field);
          next.set(LEGACY_SORT_DIRECTION_PARAM, primary.direction);
          // Row 1 of the old ordering is meaningless under a new one.
          next.set(PAGE_PARAM, "1");

          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const toggleSort = useCallback(
    (field: SortField, additive = false) => {
      const next = toggleSortKey(sortKeys, field, { additive });
      // toggleSortKey returns its input unchanged only when it refused the
      // change, which today means the key cap was reached.
      if (next === sortKeys) return false;
      commit(next);
      return true;
    },
    [commit, sortKeys],
  );

  const setSortDirection = useCallback(
    (field: SortField, direction: SortDirection) => {
      const next = setSortKeyDirection(sortKeys, field, direction);
      if (next !== sortKeys) commit(next);
    },
    [commit, sortKeys],
  );

  const removeSort = useCallback(
    (field: SortField) => {
      commit(removeSortKey(sortKeys, field));
    },
    [commit, sortKeys],
  );

  const moveSort = useCallback(
    (field: SortField, offset: number) => {
      const next = moveSortKey(sortKeys, field, offset);
      if (next !== sortKeys) commit(next);
    },
    [commit, sortKeys],
  );

  const clearSort = useCallback(() => {
    commit([]);
  }, [commit]);

  return {
    sortKeys,
    effectiveSortKeys,
    isDefaultSort: sortKeys.length === 0,
    toggleSort,
    setSortDirection,
    removeSort,
    moveSort,
    clearSort,
  };
}
