import { useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  hasActiveTransactionFilters,
  resolveDatePreset,
  VALID_TX_STATUSES,
  VALID_TX_TYPES,
  type ActiveFilterDescriptor,
  type DatePresetId,
  type TransactionFilters,
  type TxStatus,
  type TxType,
} from "../lib/transactionQuery";

// ---------------------------------------------------------------------------
// Re-exports
//
// The filter vocabulary and shape live in `lib/transactionQuery` so the filter
// engine stays a pure module with no React or router dependency. They are
// re-exported here because this hook was the original home of both, and
// components import them from this path.
// ---------------------------------------------------------------------------

export { VALID_TX_TYPES, VALID_TX_STATUSES };
export type { TransactionFilters, TxType, TxStatus, DatePresetId };

// ---------------------------------------------------------------------------
// URL param names
// ---------------------------------------------------------------------------

const PARAM = {
  SEARCH: "search",
  TYPES: "types",
  STATUSES: "statuses",
  DATE_FROM: "dateFrom",
  DATE_TO: "dateTo",
  AMOUNT_MIN: "amountMin",
  AMOUNT_MAX: "amountMax",
  ASSET: "asset",
  PAGE: "page",
} as const;

// ---------------------------------------------------------------------------
// Safe parsers
// ---------------------------------------------------------------------------

function parseCommaList<T extends string>(
  raw: string | null,
  validValues: readonly T[],
): T[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim().toLowerCase() as T)
    .filter((v): v is T => (validValues as readonly string[]).includes(v));
}

function parseIsoDate(raw: string | null): string {
  if (!raw) return "";
  // Must match YYYY-MM-DD and be a valid calendar date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const [year, month, day] = raw.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return "";
  }
  return raw;
}

function parsePositiveNumericString(raw: string | null): string {
  if (!raw) return "";
  const n = parseFloat(raw);
  if (!isFinite(n) || n < 0) return "";
  return raw;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTransactionFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  /** Parsed, type-safe filter state derived entirely from the URL */
  const filters = useMemo<TransactionFilters>(() => {
    return {
      search: searchParams.get(PARAM.SEARCH) ?? "",
      asset: (searchParams.get(PARAM.ASSET) ?? "").trim(),
      types: parseCommaList(searchParams.get(PARAM.TYPES), VALID_TX_TYPES),
      statuses: parseCommaList(
        searchParams.get(PARAM.STATUSES),
        VALID_TX_STATUSES,
      ),
      dateFrom: parseIsoDate(searchParams.get(PARAM.DATE_FROM)),
      dateTo: parseIsoDate(searchParams.get(PARAM.DATE_TO)),
      amountMin: parsePositiveNumericString(searchParams.get(PARAM.AMOUNT_MIN)),
      amountMax: parsePositiveNumericString(searchParams.get(PARAM.AMOUNT_MAX)),
    };
  }, [searchParams]);

  /** True when any filter is non-default */
  const hasActiveFilters = useMemo(
    () => hasActiveTransactionFilters(filters),
    [filters],
  );

  // ---------------------------------------------------------------------------
  // Helpers for updating the URL (always uses replace to avoid history bloat)
  // ---------------------------------------------------------------------------

  const updateParams = useCallback(
    (
      updater: (next: URLSearchParams) => void,
      resetPage = true,
    ) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          updater(next);
          if (resetPage) next.set(PARAM.PAGE, "1");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSearch = useCallback(
    (value: string) => {
      updateParams((next) => {
        if (value) next.set(PARAM.SEARCH, value);
        else next.delete(PARAM.SEARCH);
      });
    },
    [updateParams],
  );

  const setTypes = useCallback(
    (types: TxType[]) => {
      updateParams((next) => {
        if (types.length > 0) next.set(PARAM.TYPES, types.join(","));
        else next.delete(PARAM.TYPES);
      });
    },
    [updateParams],
  );

  const setStatuses = useCallback(
    (statuses: TxStatus[]) => {
      updateParams((next) => {
        if (statuses.length > 0)
          next.set(PARAM.STATUSES, statuses.join(","));
        else next.delete(PARAM.STATUSES);
      });
    },
    [updateParams],
  );

  const setDateFrom = useCallback(
    (value: string) => {
      updateParams((next) => {
        if (value) next.set(PARAM.DATE_FROM, value);
        else next.delete(PARAM.DATE_FROM);
      });
    },
    [updateParams],
  );

  const setDateTo = useCallback(
    (value: string) => {
      updateParams((next) => {
        if (value) next.set(PARAM.DATE_TO, value);
        else next.delete(PARAM.DATE_TO);
      });
    },
    [updateParams],
  );

  const setAmountMin = useCallback(
    (value: string) => {
      updateParams((next) => {
        if (value) next.set(PARAM.AMOUNT_MIN, value);
        else next.delete(PARAM.AMOUNT_MIN);
      });
    },
    [updateParams],
  );

  const setAmountMax = useCallback(
    (value: string) => {
      updateParams((next) => {
        if (value) next.set(PARAM.AMOUNT_MAX, value);
        else next.delete(PARAM.AMOUNT_MAX);
      });
    },
    [updateParams],
  );

  const setAsset = useCallback(
    (value: string) => {
      updateParams((next) => {
        const v = (value ?? "").trim();
        if (v) next.set(PARAM.ASSET, v);
        else next.delete(PARAM.ASSET);
      });
    },
    [updateParams],
  );

  /**
   * Writes the absolute date range a relative preset resolves to, in one URL
   * update so the two bounds never land in the URL separately (which would
   * momentarily produce an inverted range and an empty table).
   *
   * `now` is injectable to keep the resolution deterministic under test.
   */
  const applyDatePreset = useCallback(
    (preset: DatePresetId, now: Date = new Date()) => {
      const { dateFrom, dateTo } = resolveDatePreset(preset, now);
      updateParams((next) => {
        next.set(PARAM.DATE_FROM, dateFrom);
        next.set(PARAM.DATE_TO, dateTo);
      });
    },
    [updateParams],
  );

  /** Clears both date bounds in one update. */
  const clearDateRange = useCallback(() => {
    updateParams((next) => {
      next.delete(PARAM.DATE_FROM);
      next.delete(PARAM.DATE_TO);
    });
  }, [updateParams]);

  /**
   * Removes exactly what one summary chip stands for: the whole filter for
   * single-valued ones, or a single selection out of `types` / `statuses`.
   */
  const removeFilter = useCallback(
    (descriptor: ActiveFilterDescriptor) => {
      switch (descriptor.kind) {
        case "search":
          setSearch("");
          return;
        case "asset":
          setAsset("");
          return;
        case "dateFrom":
          setDateFrom("");
          return;
        case "dateTo":
          setDateTo("");
          return;
        case "amountMin":
          setAmountMin("");
          return;
        case "amountMax":
          setAmountMax("");
          return;
        case "type":
          setTypes(filters.types.filter((type) => type !== descriptor.value));
          return;
        case "status":
          setStatuses(
            filters.statuses.filter((status) => status !== descriptor.value),
          );
          return;
      }
    },
    [
      filters.statuses,
      filters.types,
      setAmountMax,
      setAmountMin,
      setAsset,
      setDateFrom,
      setDateTo,
      setSearch,
      setStatuses,
      setTypes,
    ],
  );

  /** Strips all filter params and resets page to 1 */
  const clearAll = useCallback(() => {
    updateParams((next) => {
      next.delete(PARAM.SEARCH);
      next.delete(PARAM.TYPES);
      next.delete(PARAM.STATUSES);
      next.delete(PARAM.DATE_FROM);
      next.delete(PARAM.DATE_TO);
      next.delete(PARAM.AMOUNT_MIN);
      next.delete(PARAM.AMOUNT_MAX);
      next.delete(PARAM.ASSET);
    });
  }, [updateParams]);

  return {
    filters,
    hasActiveFilters,
    setSearch,
    setTypes,
    setStatuses,
    setDateFrom,
    setDateTo,
    setAmountMin,
    setAmountMax,
    setAsset,
    applyDatePreset,
    clearDateRange,
    removeFilter,
    clearAll,
  };
}
