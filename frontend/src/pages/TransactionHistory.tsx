import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import ApiStatusBanner from "../components/ApiStatusBanner";
import Badge from "../components/Badge";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import {
  VirtualizedDataTable,
  shouldVirtualizeTransactionList,
} from "../components/VirtualizedDataTable";
import PageHeader from "../components/PageHeader";
import { SkeletonText } from "../components/Skeleton";
import TransactionFilterPanel from "../components/TransactionFilterPanel";
import TransactionDetailDrawer from "../components/TransactionDetailDrawer";
import EmptyState from "../components/ui/EmptyState";
import { Popover } from "../components/ui/Popover";
import { Activity, Loader2, Wallet, Columns3 } from "../components/icons";
import {
  normalizeApiError,
  isValidationError,
} from "../lib/api";
import {
  formatAmount,
  formatTimestamp,
  truncateHash,
  type Transaction,
} from "../lib/transactionApi";
import { useClientDataTable } from "../hooks/useClientDataTable";
import { useDataTableState } from "../hooks/useDataTableState";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { useTransactionFilters } from "../hooks/useTransactionFilters";
import { useTransactionHistory } from "../hooks/useTransactionData";
import { getStellarExplorerUrl } from "../lib/security";
import { networkConfig } from "../config/network";

import { useDelayedLoading } from "../hooks/useDelayedLoading";
import { useTranslation } from "../i18n";
import {
  triggerDepositIntent,
  triggerWithdrawIntent,
  triggerWalletConnectIntent,
} from "../lib/vaultIntentActions";
import { useUserPreferenceStore } from "../hooks/useUserPreferenceStore";
import type { TransactionPageSize, TransactionColumnId } from "../lib/userPreferenceStore";
import { TRANSACTION_COLUMN_IDS } from "../lib/userPreferenceStore";

interface TransactionHistoryProps {
  walletAddress: string | null;
}

type ViewMode = "paginated" | "infinite";
const INFINITE_SCROLL_BATCH_SIZE = 20;
const STATUS_COLOR_MAP: Record<Transaction["status"], "success" | "warning" | "error"> = {
  completed: "success",
  pending: "warning",
  failed: "error",
};

const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  walletAddress,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    tables: tablePreferences,
    setTransactionViewMode,
    setTransactionPageSize,
    toggleTransactionColumnVisibility,
  } = useUserPreferenceStore(walletAddress);
  const { data: queryTransactions, isLoading, error: queryError } = useTransactionHistory(walletAddress);
  const delayedLoading = useDelayedLoading(isLoading);
  const transactions = React.useMemo(
    () => queryTransactions ?? [],
    [queryTransactions],
  );

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const handleRowSelect = useCallback((row: Transaction) => {
    setSelectedTransaction(row);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setSelectedTransaction(null);
  }, []);

  const columns: DataTableColumn<Transaction>[] = React.useMemo(() => [
    {
      id: "type",
      header: t("txHistory.typeHeader"),
      sortable: true,
      cell: (row) => (
        <Badge variant="status" color={row.type === "deposit" ? "cyan" : "error"}>
          {row.type}
        </Badge>
      ),
    },
    {
      id: "status",
      header: t("txHistory.statusHeader"),
      sortable: true,
      cell: (row) => (
        <Badge
          variant="status"
          color={STATUS_COLOR_MAP[row.status]}
          icon={row.status === "pending" ? <Loader2 size={12} className="animate-spin" /> : undefined}
        >
          {row.status}
        </Badge>
      ),
    },
    {
      id: "amount",
      header: t("txHistory.amountHeader"),
      sortable: true,
      cell: (row) => <span>{formatAmount(row.amount, row.asset)}</span>,
    },
    {
      id: "asset",
      header: t("txHistory.assetHeader"),
      sortable: false,
      cell: (row) => <span>{row.asset ?? "—"}</span>,
    },
    {
      id: "date",
      header: t("txHistory.dateHeader"),
      sortable: true,
      cell: (row) => <span>{formatTimestamp(row.timestamp)}</span>,
    },
    {
      id: "hash",
      header: t("txHistory.hashHeader"),
      sortable: false,
      cell: (row) => (
        <a
          href={getStellarExplorerUrl(
            row.transactionHash,
            networkConfig.isTestnet ? "testnet" : "mainnet",
          )}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          style={{ color: "var(--accent-cyan)", textDecoration: "none" }}
          title={row.transactionHash}
        >
          {truncateHash(row.transactionHash)}
        </a>
      ),
    },
  ], [t]);

  const visibleColumnIds = tablePreferences.transactionVisibleColumns;
  const visibleColumns = React.useMemo(
    () => columns.filter((column) => visibleColumnIds[column.id as TransactionColumnId]),
    [columns, visibleColumnIds],
  );

  const columnLabelById: Record<TransactionColumnId, string> = {
    type: t("txHistory.typeHeader"),
    status: t("txHistory.statusHeader"),
    amount: t("txHistory.amountHeader"),
    asset: t("txHistory.assetHeader"),
    date: t("txHistory.dateHeader"),
    hash: t("txHistory.hashHeader"),
  };

  const visibleColumnCount = TRANSACTION_COLUMN_IDS.filter((id) => visibleColumnIds[id]).length;

  const error = queryError 
    ? (isValidationError(queryError) ? queryError : normalizeApiError(queryError)) 
    : null;

  const preferredPageSize = tablePreferences.transactionPageSize;
  const viewMode: ViewMode = tablePreferences.transactionViewMode;

  // Infinite scroll state
  const [visibleCount, setVisibleCount] = useState(INFINITE_SCROLL_BATCH_SIZE);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const loadMoreLockRef = useRef(false);

  // ── Sort / pagination state (URL-synced via useDataTableState) ──────────
  const { state, setSearch, setSort, setPage, setPageSize } = useDataTableState(
    {
      defaultSortBy: "date",
      defaultSortDirection: "desc",
      defaultPageSize: preferredPageSize,
    },
  );

  // ── Multi-filter state (URL-synced via useTransactionFilters) ───────────
  const {
    filters,
    hasActiveFilters,
    setSearch: setFilterSearch,
    setTypes,
    setStatuses,
    setDateFrom,
    setDateTo,
    setAmountMin,
    setAmountMax,
    clearAll,
    setAsset,
  } = useTransactionFilters();

  // Keep useDataTableState's search in sync with the filter panel's search
  // so that useClientDataTable's text-search logic still runs correctly.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const urlSearch = searchParams.get("search") ?? "";
    if (urlSearch !== state.search) {
      setSearch(urlSearch);
    }
  }, [searchParams, state.search, setSearch]);

  // Client-side filtering is handled by useClientDataTable.

  // ── Client-side filtering ───────────────────────────────────────────────
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
          case "status":
            return row.status;
          case "amount":
            return row.amount !== null ? parseFloat(row.amount) : 0;
          case "date":
            return row.timestamp;
          default:
            return row.timestamp;
        }
      },
      filterRow: (row) => {
        // Multi-type filter (client-side)
        if (filters.types.length > 0 && !filters.types.includes(row.type)) {
          return false;
        }

        // Status filter (client-side)
        if (
          filters.statuses.length > 0 &&
          !filters.statuses.includes(row.status)
        ) {
          return false;
        }

        // Date range
        if (filters.dateFrom) {
          const from = new Date(filters.dateFrom);
          from.setHours(0, 0, 0, 0);
          if (new Date(row.timestamp) < from) return false;
        }
        if (filters.dateTo) {
          const to = new Date(filters.dateTo);
          to.setHours(23, 59, 59, 999);
          if (new Date(row.timestamp) > to) return false;
        }

        // Amount range (numeric)
        if (filters.amountMin !== "" && row.amount !== null) {
          const min = parseFloat(filters.amountMin);
          const amt = parseFloat(row.amount);
          if (!isNaN(min) && !isNaN(amt) && amt < min) return false;
        }
        if (filters.amountMax !== "" && row.amount !== null) {
          const max = parseFloat(filters.amountMax);
          const amt = parseFloat(row.amount);
          if (!isNaN(max) && !isNaN(amt) && amt > max) return false;
        }

        return true;
      },
    },
  );

  // Available assets for the asset filter (unique, non-empty)
  const assetOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const t of transactions) {
      if (t.asset) set.add(t.asset);
    }
    return Array.from(set).sort();
  }, [transactions]);

  // Infinite scroll: compute visible rows from sorted/filtered set
  const infiniteScrollRows = React.useMemo(() => {
    return sortedRows.slice(0, visibleCount);
  }, [sortedRows, visibleCount]);

  // Update hasMoreItems when the data or visibleCount changes
  useEffect(() => {
    queueMicrotask(() => setHasMoreItems(visibleCount < sortedRows.length));
  }, [visibleCount, sortedRows.length]);

  // Reset visible count when filters/search/sort change
  useEffect(() => {
    queueMicrotask(() => setVisibleCount(INFINITE_SCROLL_BATCH_SIZE));
  }, [
    state.search,
    state.sortBy,
    state.sortDirection,
    filters.types,
    filters.dateFrom,
    filters.dateTo,
  ]);

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
    setTransactionViewMode(mode);
    if (mode === "infinite") {
      setVisibleCount(INFINITE_SCROLL_BATCH_SIZE);
    }
  };

  // ── CSV export ──────────────────────────────────────────────────────────
  const buildCsvContent = (transactionsToExport: Transaction[]) => {
    const headers = ["date", "type", "status", "amount", "share price", "fee", "tx hash"];

    const escapeCsvValue = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const csvRows = transactionsToExport.map((transaction) => [
      formatTimestamp(transaction.timestamp),
      transaction.type,
      transaction.status,
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

  // ── Empty state ─────────────────────────────────────────────────────────
  const hasDeposits = transactions.some((tx) => tx.type === "deposit");
  const hasWithdrawals = transactions.some((tx) => tx.type === "withdrawal");
  const withdrawalFilterOnly =
    filters.types.length === 1 && filters.types[0] === "withdrawal";
  const showWithdrawIntent =
    !hasActiveFilters &&
    withdrawalFilterOnly &&
    hasDeposits &&
    !hasWithdrawals;

  const emptyMessage = (
    <EmptyState
      kind={hasActiveFilters ? "search" : "no-data"}
      title={
        hasActiveFilters
          ? t("txHistory.noResults.title")
          : showWithdrawIntent
            ? t("txHistory.noWithdrawals.title")
            : t("txHistory.noTransactions.title")
      }
      description={
        hasActiveFilters
          ? t("txHistory.noResults.desc")
          : showWithdrawIntent
            ? t("txHistory.noWithdrawals.desc")
            : t("txHistory.noTransactions.desc")
      }
      icon={<Activity size={24} />}
      action={
        hasActiveFilters
          ? {
              label: t("txHistory.resetFilters"),
              onClick: clearAll,
              variant: "secondary",
            }
          : showWithdrawIntent
            ? {
                label: t("emptyState.withdrawNow"),
                onClick: () => triggerWithdrawIntent(navigate, walletAddress),
              }
            : {
                label: t("emptyState.depositNow"),
                onClick: () => triggerDepositIntent(navigate, walletAddress),
              }
      }
    />
  );

  // Determine which rows to show based on view mode
  const displayRows = viewMode === "infinite" ? infiniteScrollRows : rows;
  const useVirtualizedTable = shouldVirtualizeTransactionList(displayRows.length);
  const TransactionTable = useVirtualizedTable ? VirtualizedDataTable : DataTable;

  const sharedTableProps = {
    caption: "Transaction history",
    columns: visibleColumns,
    rows: displayRows,
    rowKey: (row: Transaction) => row.id,
    emptyMessage,
    isLoading: delayedLoading,
    skeletonRows: state.pageSize,
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
    onSortChange: setSort,
    onRowClick: handleRowSelect,
    selectedRowKey: selectedTransaction?.id,
  } as const;

  return (
    <div className="glass-panel" style={{ padding: "32px" }}>
      <PageHeader
        title={
          <>
            {t("txHistory.pageTitle").replace("Transaction ", "Transaction ")}{" "}
            <span className="text-gradient">History</span>
          </>
        }
        description={t("txHistory.pageDesc")}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: t("txHistory.pageTitle") }]}
        statusChips={
          walletAddress
            ? [
                {
                  label: `${transactions.length} Total`,
                  variant: "cyan",
                },
                {
                  label: isLoading ? t("txHistory.loadingLabel") : t("txHistory.upToDateLabel"),
                  variant: isLoading ? "warning" : "success",
                },
              ]
            : undefined
        }
      />

      {!walletAddress ? (
        <EmptyState
          kind="permission"
          title={t("txHistory.connectWallet.title")}
          description={t("txHistory.connectWallet.desc")}
          icon={<Wallet />}
          action={{
            label: t("txHistory.connectWallet.action"),
            onClick: triggerWalletConnectIntent,
          }}
        />
      ) : (
        <div className="flex flex-col gap-lg">
          {error && <ApiStatusBanner error={error} />}

          {/* ── Filter panel ──────────────────────────────────────── */}
          <TransactionFilterPanel
            filters={filters}
            onSearchChange={setFilterSearch}
            onTypesChange={setTypes}
            onStatusesChange={setStatuses}
            assets={assetOptions}
            onAssetChange={setAsset}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onAmountMinChange={setAmountMin}
            onAmountMaxChange={setAmountMax}
            onClearAll={clearAll}
            hasActiveFilters={hasActiveFilters}
          />

          {/* ── Data table ────────────────────────────────────────── */}
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
                <label className="input-group" style={{ minWidth: "120px" }}>
                  <span className="text-body-sm">Rows</span>
                  <div className="input-wrapper">
                    <select
                      aria-label="Rows per page"
                      value={state.pageSize}
                      onChange={(e) => {
                        const nextSize = Number(e.target.value) as TransactionPageSize;
                        setTransactionPageSize(nextSize);
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

                <Popover
                  title={t("txHistory.columns.title")}
                  content={
                    <div className="flex flex-col gap-sm" role="group" aria-label={t("txHistory.columns.title")}>
                      {TRANSACTION_COLUMN_IDS.map((columnId) => {
                        const isVisible = visibleColumnIds[columnId];
                        const isLastVisible = isVisible && visibleColumnCount <= 1;
                        return (
                          <label
                            key={columnId}
                            className="flex items-center gap-sm"
                            style={{
                              cursor: isLastVisible ? "not-allowed" : "pointer",
                              opacity: isLastVisible ? 0.6 : 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isVisible}
                              disabled={isLastVisible}
                              onChange={() => toggleTransactionColumnVisibility(columnId)}
                            />
                            <span className="text-body-sm">{columnLabelById[columnId]}</span>
                          </label>
                        );
                      })}
                    </div>
                  }
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ alignSelf: "flex-end", height: "42px", display: "flex", gap: "8px" }}
                    aria-label={t("txHistory.columns.toggle")}
                  >
                    <Columns3 size={16} />
                    {t("txHistory.columns.button")}
                  </button>
                </Popover>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleExportCsv}
                  style={{ alignSelf: "flex-end", height: "42px" }}
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div
              className="text-body-sm"
              style={{ color: "var(--text-secondary)", marginBottom: "16px" }}
            >
              {delayedLoading
                ? <SkeletonText width="180px" />
                : viewMode === "infinite"
                  ? `Showing ${infiniteScrollRows.length} of ${sortedRows.length} transactions`
                  : `${totalItems} transactions found`}
            </div>

            {viewMode === "infinite" ? (
              /* Infinite Scroll View */
              <div className="infinite-scroll-container">
                <TransactionTable {...sharedTableProps} />

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
              <TransactionTable
                {...sharedTableProps}
                pagination={{
                  page,
                  pageSize: state.pageSize,
                  totalItems,
                  totalPages,
                }}
                onPageChange={setPage}
              />
            )}

            <TransactionDetailDrawer
              transaction={selectedTransaction}
              isOpen={!!selectedTransaction}
              onClose={handleDrawerClose}
            />
          </section>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
