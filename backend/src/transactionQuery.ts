/**
 * @file transactionQuery.ts
 * Pure helpers for validating and building sort/filter clauses for the
 * transaction history API (Issue #890).
 *
 * These helpers are intentionally free of Express/Prisma runtime coupling so
 * they can be unit-tested in isolation and reused by both the wallet-scoped
 * (Prisma-backed) path and the export path.
 */

/** Transaction status values recognised by the history API. */
export const TRANSACTION_STATUSES = ['pending', 'completed', 'failed'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** Transaction type values recognised by the history API. */
export const TRANSACTION_TYPES = ['deposit', 'withdrawal'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/**
 * Allowlist of fields that transactions may be sorted by, mapped to the
 * underlying Prisma column. Restricting to an allowlist prevents arbitrary
 * `orderBy` injection and keeps the API surface stable.
 *
 * `amount` is intentionally excluded because it is persisted as a decimal
 * string and would sort lexically rather than numerically.
 */
export const SORTABLE_TRANSACTION_FIELDS = {
  timestamp: 'timestamp',
  type: 'type',
  status: 'status',
} as const;

export type SortableTransactionField = keyof typeof SORTABLE_TRANSACTION_FIELDS;

export const DEFAULT_SORT_FIELD: SortableTransactionField = 'timestamp';
export const DEFAULT_SORT_ORDER: SortOrder = 'desc';

export type SortOrder = 'asc' | 'desc';

export interface ResolvedSort {
  /** The validated logical field the caller asked to sort by. */
  field: SortableTransactionField;
  /** The validated sort direction. */
  order: SortOrder;
  /** True when the requested `sortBy` was a recognised sortable field. */
  valid: boolean;
  /** The originally requested (possibly invalid) sort field, if any. */
  requested?: string;
}

/**
 * Validate a requested sort field against the allowlist.
 *
 * @param sortBy - Raw `sortBy` query value (may be undefined/invalid).
 * @param sortOrder - Raw `sortOrder` query value (defaults to desc).
 * @returns Resolved sort descriptor. `valid` is false when an unknown field
 *   was requested, in which case the caller may choose to reject the request
 *   or fall back to the default field.
 */
export function resolveTransactionSort(
  sortBy?: string,
  sortOrder?: string,
): ResolvedSort {
  const order: SortOrder = sortOrder === 'asc' ? 'asc' : DEFAULT_SORT_ORDER;

  if (sortBy === undefined || sortBy === '') {
    return { field: DEFAULT_SORT_FIELD, order, valid: true };
  }

  if (isSortableField(sortBy)) {
    return { field: sortBy, order, valid: true };
  }

  return {
    field: DEFAULT_SORT_FIELD,
    order,
    valid: false,
    requested: sortBy,
  };
}

export function isSortableField(value: string): value is SortableTransactionField {
  return Object.prototype.hasOwnProperty.call(SORTABLE_TRANSACTION_FIELDS, value);
}

/**
 * Build a deterministic Prisma `orderBy` array for the resolved sort. A
 * secondary `id` sort in the same direction guarantees a stable, total
 * ordering so cursor pagination never skips or repeats rows when the primary
 * sort key has ties (e.g. many transactions sharing a `status`).
 */
export function buildTransactionOrderBy(
  sort: Pick<ResolvedSort, 'field' | 'order'>,
): Array<Record<string, SortOrder>> {
  const column = SORTABLE_TRANSACTION_FIELDS[sort.field];
  return [{ [column]: sort.order }, { id: sort.order }];
}

/**
 * Build the Prisma `where` fragment that selects every row strictly *before*
 * the cursor row under the `(field, id)` ordering. Counting rows matching this
 * fragment yields the number of items to skip, keeping cursor pagination
 * correct for any sortable field — not just `timestamp`.
 *
 * @param sort - Resolved sort descriptor.
 * @param cursorRow - The row the cursor points at (its sort field + id).
 */
export function buildTransactionCursorFilter(
  sort: Pick<ResolvedSort, 'field' | 'order'>,
  cursorRow: { id: string } & Record<string, unknown>,
): Record<string, unknown> {
  const column = SORTABLE_TRANSACTION_FIELDS[sort.field];
  const beyond = sort.order === 'desc' ? 'gt' : 'lt';
  const cursorValue = cursorRow[column];

  // Rows come "before" the cursor when their primary key is beyond the cursor
  // value, or the primary key ties and the id is beyond the cursor id.
  return {
    OR: [
      { [column]: { [beyond]: cursorValue } },
      {
        AND: [{ [column]: cursorValue }, { id: { [beyond]: cursorRow.id } }],
      },
    ],
  };
}

/**
 * Validate a comma-separated `type` filter. Returns the parsed list plus an
 * optional error message for the first invalid value encountered.
 */
export function parseTypeFilter(
  raw: string | undefined,
): { types: string[]; error?: string } {
  if (!raw) {
    return { types: [] };
  }
  const types = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  for (const type of types) {
    if (!TRANSACTION_TYPES.includes(type as TransactionType)) {
      return {
        types: [],
        error: `Invalid type filter. Allowed values: ${TRANSACTION_TYPES.join(', ')}`,
      };
    }
  }

  return { types };
}

/**
 * Validate an optional `status` filter against the recognised statuses.
 */
export function parseStatusFilter(
  raw: string | undefined,
): { status?: string; error?: string } {
  if (!raw) {
    return {};
  }
  if (!TRANSACTION_STATUSES.includes(raw as TransactionStatus)) {
    return {
      error: `Invalid status filter. Allowed values: ${TRANSACTION_STATUSES.join(', ')}`,
    };
  }
  return { status: raw };
}
