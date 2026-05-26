import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import ApiStatusBanner from "../components/ApiStatusBanner";
import Badge from "../components/Badge";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import { Activity } from "../components/icons";
import { 
  normalizeApiError, 
  isValidationError, 
  type ApiError, 
  type ValidationError 
} from "../lib/api";
import {
  formatAmount,
  formatTimestamp,
  truncateHash,
  getTransactions,
  type Transaction,
} from "../lib/transactionApi";
import { useClientDataTable } from "../hooks/useClientDataTable";
import { useDataTableState } from "../hooks/useDataTableState";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { getStellarExplorerUrl } from "../lib/security";
import { networkConfig } from "../config/network";

interface TransactionHistoryProps {
  walletAddress: string | null;
}

type TxTypeFilter = "all" | "deposit" | "withdrawal";
type ViewMode = "paginated" | "infinite";
const DEFAULT_PAGE_SIZE = 10;
const INFINITE_SCROLL_BATCH_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function getPageSizeStorageKey(walletAddress: string | null): string {
  return `yieldvault:transactions:page-size:${walletAddress ?? "guest"}`;
}

function getViewModeStorageKey(walletAddress: string | null): string {
  return `yieldvault:transactions:view-mode:${walletAddress ?? "guest"}`;
}

function loadPreferredPageSize(walletAddress: string | null): number {
  try {
    const raw = localStorage.getItem(getPageSizeStorageKey(walletAddress));
    const parsed = raw ? Number(raw) : Number.NaN;
    if (PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])) {
      return parsed;
    }
  } catch {
    // localStorage unavailable; fall back to defaults
  }
  return DEFAULT_PAGE_SIZE;
}

function persistPreferredPageSize(walletAddress: string | null, pageSize: number): void {
  try {
    localStorage.setItem(getPageSizeStorageKey(walletAddress), String(pageSize));
  } catch {
    // localStorage unavailable; silently ignore
  }
}

function loadViewMode(walletAddress: string | null): ViewMode {
  try {
    const raw = localStorage.getItem(getViewModeStorageKey(walletAddress));
    if (raw === "paginated" || raw === "infinite") {
      return raw;
    }
  } catch {
    // localStorage unavailable
  }
  return "paginated";
}

function persistViewMode(walletAddress: string | null, mode: ViewMode): void {
  try {
    localStorage.setItem(getViewModeStorageKey(walletAddress), mode);
  } catch {
    // localStorage unavailable
  }
}

const columns: DataTableColumn<Transaction>[] = [
  {
    id: "type",
    header: "Type",
    sortable: true,
    cell: (row) => (
      <Badge variant="status" color={row.type === "deposit" ? "cyan" : "error"}>
        {row.type}
      </Badge>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    sortable: true,
    cell: (row) => <span>{formatAmount(row.amount, row.asset)}</span>,
  },
  {
    id: "asset",
    header: "Asset",
    sortable: false,
    cell: (row) => <span>{row.asset ?? "—"}</span>,
  },
  {
    id: "date",
    header: "Date",
    sortable: true,
    cell: (row) => <span>{formatTimestamp(row.timestamp)}</span>,
  },
  {
    id: "hash",
    header: "Transaction Hash",
    sortable: false,
    cell: (row) => (
      <a
        href={getStellarExplorerUrl(
          row.transactionHash,
          networkConfig.isTestnet ? "testnet" : "mainnet",
        )}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--accent-cyan)", textDecoration: "none" }}
        title={row.transactionHash}
      >
        {truncateHash(row.transactionHash)}
      </a>
    ),
  },
];

const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  walletAddress,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | ValidationError | null>(null);
  const preferredPageSize = React.useMemo(
    () => loadPreferredPageSize(walletAddress),
    [walletAddress],
  );

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewMode(walletAddress));

  // Infinite scroll state
  const [visibleCount, setVisibleCount] = useState(INFINITE_SCROLL_BATCH_SIZE);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const loadMoreLockRef = useRef(false);

  const { state, setSearch, setSort, setPage, setPageSize } = useDataTableState(
    {
      defaultSortBy: "date",
      defaultSortDirection: "desc",
      defaultPageSize: preferredPageSize,
    },
  );
  const [searchInput, setSearchInput] = useState(state.search);

  const [searchParams, setSearchParams] = useSearchParams();
  const txType = (searchParams.get("txType") ?? "all") as TxTypeFilter;

  const setTxType = (value: TxTypeFilter) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("txType", value);
    nextParams.set("page", "1");
    setSearchParams(nextParams, { replace: true });
  };

  // Date range from URL
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  const setDateFrom = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) nextParams.set("dateFrom", value);
    else nextParams.delete("dateFrom");
    nextParams.set("page", "1");
    setSearchParams(nextParams, { replace: true });
  };

  const setDateTo = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) nextParams.set("dateTo", value);
    else nextParams.delete("dateTo");
    nextParams.set("page", "1");
    setSearchParams(nextParams, { replace: true });
  };

  const clearAllFilters = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("txType");
    nextParams.delete("dateFrom");
    nextParams.delete("dateTo");
    nextParams.set("page", "1");
    setSearchParams(nextParams, { replace: true });
    setSearchInput("");
    setSearch("");
  };

  const hasActiveFilters =
    txType !== "all" ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Boolean(state.search);

  useEffect(() => {
    setSearchInput(state.search);
  }, [state.search]);

  useEffect(() => {
    if (searchInput === state.search) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput, setSearch, state.search]);

  useEffect(() => {
    if (!walletAddress) {
      return;
    }

    let isMounted = true;

    const loadTransactions = async () => {
      setIsLoading(true);

      try {
        const data = await getTransactions({
          walletAddress,
          limit: state.pageSize,
          order: state.sortDirection,
          type: txType,
        });
        if (!isMounted) return;
        setTransactions(data);
        setError(null);
      } catch (unknownError) {
        if (!isMounted) return;
        if (isValidationError(unknownError)) {
          setError(unknownError);
        } else {
          setError(normalizeApiError(unknownError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadTransactions();

    return () => {
      isMounted = false;
    };
  }, [walletAddress, state.pageSize, state.sortDirection, txType]);

  const { rows, sortedRows, page, totalItems, totalPages } = useClientDataTable(
    {
      rows: transactions,
      state,
      getSearchValue: (row) =>
        `${row.type} ${row.asset ?? ""} ${row.transactionHash}`,
      getSortValue: (row, columnId) => {
        switch (columnId) {
          case "type":
            return row.type;
          case "amount":
            return row.amount !== null ? parseFloat(row.amount) : 0;
          case "date":
            return row.timestamp;
          default:
            return row.timestamp;
        }
      },
      filterRow: (row) => {
        if (dateFrom) {
          const from = new Date(dateFrom);
          from.setHours(0, 0, 0, 0);
          if (new Date(row.timestamp) < from) return false;
        }
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          if (new Date(row.timestamp) > to) return false;
        }
        return true;
      },
    },
  );

  // Infinite scroll: compute visible rows from sorted/filtered set
  const infiniteScrollRows = React.useMemo(() => {
    return sortedRows.slice(0, visibleCount);
  }, [sortedRows, visibleCount]);

  // Update hasMoreItems when the data or visibleCount changes
  useEffect(() => {
    setHasMoreItems(visibleCount < sortedRows.length);
  }, [visibleCount, sortedRows.length]);

  // Reset visible count when filters/search/sort change
  useEffect(() => {
    setVisibleCount(INFINITE_SCROLL_BATCH_SIZE);
  }, [state.search, state.sortBy, state.sortDirection, txType, dateFrom, dateTo]);

  // Handle loading more items for infinite scroll
  const handleLoadMore = useCallback(() => {
    if (loadMoreLockRef.current || !hasMoreItems) return;
    loadMoreLockRef.current = true;

    setVisibleCount((prev) => {
      const next = Math.min(prev + INFINITE_SCROLL_BATCH_SIZE, sortedRows.length);
      return next;
    });

    // Release lock after a small delay to prevent rapid-fire calls
    setTimeout(() => {
      loadMoreLockRef.current = false;
    }, 100);
  }, [hasMoreItems, sortedRows.length]);

  const { sentinelRef, isLoadingMore } = useInfiniteScroll(handleLoadMore, {
    enabled: viewMode === "infinite" && hasMoreItems && !isLoading,
    threshold: 200,
  });

  // View mode toggle handler
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    persistViewMode(walletAddress, mode);
    if (mode === "infinite") {
      setVisibleCount(INFINITE_SCROLL_BATCH_SIZE);
    }
  };

  const buildCsvContent = (transactionsToExport: Transaction[]) => {
    const headers = ["date", "type", "amount", "share price", "fee", "tx hash"];

    const escapeCsvValue = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const csvRows = transactionsToExport.map((transaction) => [
      formatTimestamp(transaction.timestamp),
      transaction.type,
      formatAmount(transaction.amount, transaction.asset),
      "",
      "",
      transaction.transactionHash,
    ]);

    return [headers, ...csvRows]
      .map((columns) => columns.map(escapeCsvValue).join(","))
      .join("\r\n");
  };

  const handleExportCsv = () => {
    const csvContent = buildCsvContent(sortedRows);
    const fileName = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url =
      typeof URL !== "undefined" && URL.createObjectURL
        ? URL.createObjectURL(blob)
        : `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (
      typeof URL !== "undefined" &&
      URL.revokeObjectURL &&
      url.startsWith("blob:")
    ) {
      URL.revokeObjectURL(url);
    }
  };

  const emptyMessage = (
    <EmptyState
      variant="minimal"
      title={txType !== "all" ? "No matches found" : "No transactions yet"}
      description={
        txType !== "all"
          ? "Try changing your filter settings to see more history."
          : "Once you make a deposit or withdrawal, it will appear here."
      }
      icon={<Activity size={24} />}
    />
  );

  // Determine which rows to show based on view mode
  const displayRows = viewMode === "infinite" ? infiniteScrollRows : rows;

  return (
    <div className="glass-panel" style={{ padding: "32px" }}>
      <PageHeader
        title={
          <>
            Transaction <span className="text-gradient">History</span>
          </>
        }
        description="View all your past deposits and withdrawals."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Transactions" }]}
        statusChips={
          walletAddress
            ? [
                {
                  label: `${transactions.length} Total`,
                  variant: "cyan",
                },
                {
                  label: isLoading ? "Loading..." : "Up to date",
                  variant: isLoading ? "warning" : "success",
                },
              ]
            : undefined
        }
      />

      {!walletAddress ? (
        <div style={{ textAlign: "center", padding: "48px" }}>
          <p style={{ color: "var(--text-secondary)" }}>
            Please connect your wallet to view your transaction history.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-lg">
          {error && <ApiStatusBanner error={error} />}

          <section
            className="glass-panel"
            style={{ padding: "24px", background: "var(--bg-muted)" }}
            aria-labelledby="transactions-heading"
          >
            <div className="portfolio-toolbar">
              <div>
                <h2 id="transactions-heading" style={{ marginBottom: "6px" }}>
                  Transactions
                </h2>
                <p
                  className="text-body-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Sort and filter your deposit and withdrawal history.
                </p>
              </div>

              <div className="portfolio-toolbar-controls">
                <label className="input-group" style={{ minWidth: "220px" }}>
                  <span className="text-body-sm">Search transactions</span>
                  <div className="input-wrapper">
                    <input
                      aria-label="Search transactions"
                      className="input-field"
                      type="search"
                      placeholder="Search asset, hash, type..."
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      style={{
                        fontSize: "var(--text-base)",
                        fontFamily: "var(--font-sans)",
                      }}
                    />
                  </div>
                </label>

                <label className="input-group" style={{ minWidth: "160px" }}>
                  <span className="text-body-sm">Type</span>
                  <div className="input-wrapper">
                    <select
                      aria-label="Filter by type"
                      value={txType}
                      onChange={(e) =>
                        setTxType(e.target.value as TxTypeFilter)
                      }
                      className="portfolio-select"
                    >
                      <option value="all">All</option>
                      <option value="deposit">Deposit</option>
                      <option value="withdrawal">Withdrawal</option>
                    </select>
                  </div>
                </label>

                <label className="input-group" style={{ minWidth: "140px" }}>
                  <span className="text-body-sm">From date</span>
                  <div className="input-wrapper">
                    <input
                      aria-label="Filter from date"
                      className="input-field"
                      type="date"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={(e) => setDateFrom(e.target.value)}
                      style={{
                        fontSize: "var(--text-base)",
                        fontFamily: "var(--font-sans)",
                      }}
                    />
                  </div>
                </label>

                <label className="input-group" style={{ minWidth: "140px" }}>
                  <span className="text-body-sm">To date</span>
                  <div className="input-wrapper">
                    <input
                      aria-label="Filter to date"
                      className="input-field"
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(e) => setDateTo(e.target.value)}
                      style={{
                        fontSize: "var(--text-base)",
                        fontFamily: "var(--font-sans)",
                      }}
                    />
                  </div>
                </label>

                <label className="input-group" style={{ minWidth: "120px" }}>
                  <span className="text-body-sm">Rows</span>
                  <div className="input-wrapper">
                    <select
                      aria-label="Rows per page"
                      value={state.pageSize}
                      onChange={(e) => {
                        const nextSize = Number(e.target.value);
                        persistPreferredPageSize(walletAddress, nextSize);
                        setPageSize(nextSize);
                      }}
                      className="portfolio-select"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </label>

                {/* View Mode Toggle */}
                <div className="input-group" style={{ minWidth: "140px" }}>
                  <span className="text-body-sm">View</span>
                  <div className="infinite-scroll-toggle" role="radiogroup" aria-label="View mode">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={viewMode === "paginated"}
                      className={`infinite-scroll-toggle-btn ${viewMode === "paginated" ? "active" : ""}`}
                      onClick={() => handleViewModeChange("paginated")}
                      title="Paginated view"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="1" y="1" width="14" height="3" rx="0.5" fill="currentColor" opacity="0.8" />
                        <rect x="1" y="6" width="14" height="3" rx="0.5" fill="currentColor" opacity="0.5" />
                        <rect x="1" y="11" width="14" height="3" rx="0.5" fill="currentColor" opacity="0.3" />
                      </svg>
                      <span className="sr-only">Pages</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={viewMode === "infinite"}
                      className={`infinite-scroll-toggle-btn ${viewMode === "infinite" ? "active" : ""}`}
                      onClick={() => handleViewModeChange("infinite")}
                      title="Infinite scroll view"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="1" y="1" width="14" height="2" rx="0.5" fill="currentColor" opacity="0.9" />
                        <rect x="1" y="4.5" width="14" height="2" rx="0.5" fill="currentColor" opacity="0.7" />
                        <rect x="1" y="8" width="14" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
                        <rect x="1" y="11.5" width="14" height="2" rx="0.5" fill="currentColor" opacity="0.3" />
                        <path d="M8 14.5L5 12.5H11L8 14.5Z" fill="currentColor" opacity="0.6" />
                      </svg>
                      <span className="sr-only">Scroll</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleExportCsv}
                  style={{ alignSelf: "flex-end", height: "42px" }}
                >
                  Export CSV
                </button>

                {hasActiveFilters && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={clearAllFilters}
                    style={{ alignSelf: "flex-end", height: "42px" }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            <div
              className="text-body-sm"
              style={{ color: "var(--text-secondary)", marginBottom: "16px" }}
            >
              {isLoading
                ? "Loading transactions..."
                : viewMode === "infinite"
                  ? `Showing ${infiniteScrollRows.length} of ${sortedRows.length} transactions`
                  : `${totalItems} transactions found`}
            </div>

            {isLoading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px",
                  color: "var(--text-secondary)",
                }}
              >
                Loading transactions...
              </div>
            ) : viewMode === "infinite" ? (
              /* Infinite Scroll View */
              <div className="infinite-scroll-container">
                <DataTable
                  caption="Transaction history"
                  columns={columns}
                  rows={displayRows}
                  rowKey={(row) => row.id}
                  emptyMessage={emptyMessage}
                  isLoading={isLoading}
                  skeletonRows={state.pageSize}
                  sortBy={state.sortBy}
                  sortDirection={state.sortDirection}
                  onSortChange={setSort}
                />

                {/* Infinite scroll sentinel & status */}
                {sortedRows.length > 0 && (
                  <div className="infinite-scroll-footer">
                    {hasMoreItems ? (
                      <>
                        <div
                          ref={sentinelRef}
                          className="infinite-scroll-sentinel"
                          data-testid="infinite-scroll-sentinel"
                          aria-hidden="true"
                        />
                        {isLoadingMore && (
                          <div className="infinite-scroll-loader" aria-live="polite">
                            <div className="infinite-scroll-spinner" />
                            <span>Loading more transactions...</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div
                        className="infinite-scroll-end"
                        role="status"
                        aria-live="polite"
                      >
                        <div className="infinite-scroll-end-line" />
                        <span>All {sortedRows.length} transactions loaded</span>
                        <div className="infinite-scroll-end-line" />
                      </div>
                    )}

                    {/* Progress indicator */}
                    <div className="infinite-scroll-progress" aria-hidden="true">
                      <div
                        className="infinite-scroll-progress-bar"
                        style={{
                          width: `${Math.min(100, (infiniteScrollRows.length / sortedRows.length) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Paginated View (original) */
              <DataTable
                caption="Transaction history"
                columns={columns}
                rows={displayRows}
                rowKey={(row) => row.id}
                emptyMessage={emptyMessage}
                isLoading={isLoading}
                skeletonRows={state.pageSize}
                sortBy={state.sortBy}
                sortDirection={state.sortDirection}
                onSortChange={setSort}
                pagination={{
                  page,
                  pageSize: state.pageSize,
                  totalItems,
                  totalPages,
                }}
                onPageChange={setPage}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
