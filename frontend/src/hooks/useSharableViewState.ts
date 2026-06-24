import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type SortDirection = "asc" | "desc";

export interface ViewFilters {
  [key: string]: string | string[] | undefined;
}

export interface SharableViewState {
  page: number;
  pageSize: number;
  sortBy: string;
  sortDirection: SortDirection;
  search: string;
  filters: ViewFilters;
}

interface UseSharableViewStateOptions {
  defaultPage?: number;
  defaultPageSize?: number;
  defaultSortBy?: string;
  defaultSortDirection?: SortDirection;
  defaultFilters?: ViewFilters;
  filterKeys?: string[];
}

function parseNumeric(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : fallback;
}

function serializeFilters(filters: ViewFilters): Record<string, string> {
  const sorted: Record<string, string> = {};
  Object.keys(filters)
    .sort()
    .forEach((key) => {
      const val = filters[key];
      if (val === undefined || val === "") return;
      if (Array.isArray(val)) {
        if (val.length > 0) sorted[key] = val.join(",");
      } else {
        sorted[key] = val;
      }
    });
  return sorted;
}

function deserializeFilters(
  searchParams: URLSearchParams,
  defaultFilters: ViewFilters,
  filterKeys?: string[],
): ViewFilters {
  const result: ViewFilters = { ...defaultFilters };
  const keys = filterKeys ?? Object.keys(defaultFilters);

  keys.forEach((key) => {
    const raw = searchParams.get(key);
    if (raw === null) return;

    const defaultVal = defaultFilters[key];
    if (Array.isArray(defaultVal)) {
      result[key] = raw.split(",").filter(Boolean);
    } else {
      result[key] = raw;
    }
  });

  return result;
}

export function useSharableViewState(options: UseSharableViewStateOptions = {}) {
  const {
    defaultPage = 1,
    defaultPageSize = 25,
    defaultSortBy = "",
    defaultSortDirection = "asc",
    defaultFilters = {},
    filterKeys,
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo<SharableViewState>(() => {
    const page = parseNumeric(searchParams.get("p"), defaultPage);
    const pageSize = parseNumeric(searchParams.get("ps"), defaultPageSize);
    const sortBy = searchParams.get("sb") ?? defaultSortBy;
    const rawDir = searchParams.get("sd");
    const sortDirection: SortDirection =
      rawDir === "asc" || rawDir === "desc" ? rawDir : defaultSortDirection;
    const search = searchParams.get("q") ?? "";
    const filters = deserializeFilters(searchParams, defaultFilters, filterKeys);

    return { page, pageSize, sortBy, sortDirection, search, filters };
  }, [searchParams, defaultPage, defaultPageSize, defaultSortBy, defaultSortDirection, defaultFilters, filterKeys]);

  const setState = useCallback(
    (updates: Partial<SharableViewState>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams();

        const merged = { ...state, ...updates };

        if (merged.page !== defaultPage) next.set("p", String(merged.page));
        if (merged.pageSize !== defaultPageSize) next.set("ps", String(merged.pageSize));
        if (merged.sortBy) next.set("sb", merged.sortBy);
        if (merged.sortDirection !== defaultSortDirection) next.set("sd", merged.sortDirection);
        if (merged.search) next.set("q", merged.search);

        const serialized = serializeFilters(merged.filters);
        Object.entries(serialized).forEach(([k, v]) => next.set(k, v));

        const params = new URLSearchParams();
        Array.from(next.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([k, v]) => params.set(k, v));

        return params;
      });
    },
    [setSearchParams, state, defaultPage, defaultPageSize, defaultSortBy, defaultSortDirection],
  );

  const setPage = useCallback((page: number) => setState({ page }), [setState]);
  const setPageSize = useCallback((pageSize: number) => setState({ pageSize, page: 1 }), [setState]);
  const setSearch = useCallback((search: string) => setState({ search, page: 1 }), [setState]);

  const setSort = useCallback(
    (sortBy: string, sortDirection?: SortDirection) => {
      if (!sortDirection) {
        sortDirection = state.sortBy === sortBy && state.sortDirection === "asc" ? "desc" : "asc";
      }
      setState({ sortBy, sortDirection, page: 1 });
    },
    [setState, state.sortBy, state.sortDirection],
  );

  const setFilters = useCallback(
    (newFilters: Partial<ViewFilters>) => {
      setState({ filters: { ...state.filters, ...newFilters }, page: 1 });
    },
    [setState, state.filters],
  );

  const reset = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const getShareableUrl = useCallback((): string => {
    const params = new URLSearchParams(searchParams);
    const sorted = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b));
    const base = window.location.origin + window.location.pathname;
    return sorted.length > 0 ? `${base}?${sorted.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}` : base;
  }, [searchParams]);

  return {
    state,
    setState,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    setFilters,
    reset,
    getShareableUrl,
  };
}
