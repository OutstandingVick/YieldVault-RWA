import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "../i18n";
import { Pagination } from "./Pagination";
import { TableSkeleton } from "./Skeleton";
import { useDelayedLoading } from "../hooks/useDelayedLoading";
import type { DataTableColumn, TableSortDirection } from "./DataTable";

/** Row height in pixels — keep in sync with .data-table th/td padding. */
export const VIRTUALIZED_ROW_HEIGHT = 52;

/** Enable virtualization when row count meets or exceeds this threshold. */
export const VIRTUALIZATION_THRESHOLD = 50;

interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface VirtualizedDataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  emptyMessage: ReactNode;
  sortBy?: string;
  sortDirection?: TableSortDirection;
  onSortChange?: (columnId: string) => void;
  pagination?: PaginationState;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  renderRowDetails?: (row: T) => ReactNode;
  isLoading?: boolean;
  skeletonRows?: number;
  /** Fixed viewport height for the scrollable body. */
  maxHeight?: number;
}

function getCellAlignment(align: DataTableColumn<unknown>["align"]) {
  if (align === "center") return "center";
  if (align === "right") return "right";
  return "left";
}

export function shouldVirtualizeTransactionList(rowCount: number): boolean {
  return rowCount >= VIRTUALIZATION_THRESHOLD;
}

export function VirtualizedDataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  emptyMessage,
  sortBy,
  sortDirection = "asc",
  onSortChange,
  pagination,
  onPageChange,
  onPageSizeChange,
  renderRowDetails,
  isLoading = false,
  skeletonRows = 5,
  maxHeight = 600,
}: VirtualizedDataTableProps<T>) {
  const { t } = useTranslation();
  const delayedLoading = useDelayedLoading(isLoading);
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => VIRTUALIZED_ROW_HEIGHT,
    overscan: 8,
  });

  const handleHeaderKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    columnId: string,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSortChange?.(columnId);
    }
  };

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalHeight - virtualRows[virtualRows.length - 1].end
      : 0;

  return (
    <div className="data-table-shell glass-panel" aria-busy={delayedLoading}>
      <div className="data-table-scroll">
        <table className="data-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => {
                const isSorted = sortBy === column.id;
                const ariaSort = !column.sortable
                  ? "none"
                  : isSorted
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none";

                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={ariaSort}
                    style={{
                      width: column.width,
                      textAlign: getCellAlignment(column.align),
                    }}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        className="data-table-sort"
                        onClick={() => onSortChange?.(column.id)}
                        onKeyDown={(event) =>
                          handleHeaderKeyDown(event, column.id)
                        }
                        aria-label={`${t("dataTable.sortBy")} ${column.header}`}
                      >
                        <span>{column.header}</span>
                        <span className="data-table-sort-indicator" aria-hidden="true">
                          {isSorted ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    ) : (
                      <span>{column.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
        </table>

        <div
          ref={parentRef}
          className="virtualized-data-table-body"
          style={{ maxHeight, overflow: "auto" }}
          data-testid="virtualized-table-body"
        >
          {delayedLoading ? (
            <table className="data-table">
              <tbody>
                <TableSkeleton columns={columns.length} rows={skeletonRows} />
              </tbody>
            </table>
          ) : rows.length === 0 && !isLoading ? (
            <table className="data-table">
              <tbody>
                <tr>
                  <td colSpan={columns.length} className="data-table-empty">
                    {emptyMessage}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <table className="data-table" style={{ width: "100%" }}>
              <tbody>
                {paddingTop > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={columns.length}
                      style={{ height: paddingTop, padding: 0, border: "none" }}
                    />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <tr
                      key={rowKey(row)}
                      tabIndex={0}
                      className="data-table-row"
                      data-index={virtualRow.index}
                      style={{ height: VIRTUALIZED_ROW_HEIGHT }}
                    >
                      {columns.map((column, columnIndex) => {
                        const content = column.cell
                          ? column.cell(row)
                          : column.accessor?.(row);

                        return (
                          <td
                            key={column.id}
                            data-label={column.header}
                            style={{
                              textAlign: getCellAlignment(column.align),
                            }}
                          >
                            {content}
                            {renderRowDetails && columnIndex === 0 && (
                              <div className="data-table-mobile-detail">
                                {renderRowDetails(row)}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={columns.length}
                      style={{ height: paddingBottom, padding: 0, border: "none" }}
                    />
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="data-table-pagination">
          <div className="data-table-pagination-summary">
            {t("dataTable.pageLabel")} {pagination.page}{" "}
            {t("dataTable.pageOf")} {pagination.totalPages}
          </div>
          <div className="data-table-pagination-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              {t("dataTable.previous")}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              {t("dataTable.next")}
            </button>
          </div>
        </div>
      )}
      {pagination && (
        <div className="data-table-pagination" style={{ padding: 0 }}>
          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}
    </div>
  );
}
