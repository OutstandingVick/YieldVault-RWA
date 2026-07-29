/**
 * Filter and sort engine for the transaction history table.
 *
 * Everything here is a pure function over plain data. The table's behaviour —
 * which rows survive a filter set, in what order they come out, which page a
 * row lands on — is therefore testable without mounting React or a router.
 * The React layer (`useTransactionFilters`, `useTransactionSort`,
 * `TransactionHistory`) only reads the URL, calls into this module, and renders
 * the result.
 *
 * Two properties are load-bearing and easy to lose in a refactor:
 *
 * - **Total ordering.** `sortTransactions` always ends with an id comparison,
 *   so a given (rows, sortKeys) pair produces one ordering regardless of the
 *   input order. Without it, rows that tie on every sort key shuffle between
 *   renders as the upstream fetch returns them in a different order.
 * - **Absent values sort last.** A `null` amount or an unparseable timestamp
 *   goes to the bottom in *both* directions. Reversing "unknown" to the top on
 *   a descending sort would present missing data as the largest data.
 */

import type { Transaction, TxStatus, TxType } from "./transactionApi";

export type { TxStatus, TxType } from "./transactionApi";

// ---------------------------------------------------------------------------
// Filter value domains
// ---------------------------------------------------------------------------

export const VALID_TX_TYPES = [
  "deposit",
  "withdrawal",
  "transfer",
  "trade",
] as const satisfies readonly TxType[];

export const VALID_TX_STATUSES = [
  "pending",
  "completed",
  "failed",
] as const satisfies readonly TxStatus[];

/** Relative date shortcuts offered by the filter panel. */
export const DATE_PRESET_IDS = ["7d", "30d", "90d", "ytd"] as const;
export type DatePresetId = (typeof DATE_PRESET_IDS)[number];

/** Number of calendar days each rolling preset covers, today included. */
const PRESET_DAY_SPAN: Record<Exclude<DatePresetId, "ytd">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/**
 * Parsed filter state. Every field is a plain string or array so the whole
 * thing round-trips through the URL without a serializer.
 *
 * An empty string or empty array always means "this filter is not applied",
 * never "match nothing".
 */
export interface TransactionFilters {
  /** Free-text search over type, status, asset and hash. */
  search: string;
  /** Asset code to match exactly (case-insensitive), or "" for all. */
  asset: string;
  /** Active type filters — empty array means "all". */
  types: TxType[];
  /** Active status filters — empty array means "all". */
  statuses: TxStatus[];
  /** Inclusive lower bound as `YYYY-MM-DD`, or "". */
  dateFrom: string;
  /** Inclusive upper bound as `YYYY-MM-DD`, or "". */
  dateTo: string;
  /** Inclusive minimum amount, or "". */
  amountMin: string;
  /** Inclusive maximum amount, or "". */
  amountMax: string;
}

export const EMPTY_TRANSACTION_FILTERS: TransactionFilters = {
  search: "",
  asset: "",
  types: [],
  statuses: [],
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
};

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * Fields the table can sort by. `asset` and `hash` are deliberately absent:
 * alphabetising an asset code or a hash tells a user nothing they came to the
 * page to learn.
 */
export const SORTABLE_FIELDS = ["date", "amount", "type", "status"] as const;
export type SortField = (typeof SORTABLE_FIELDS)[number];

export type SortDirection = "asc" | "desc";

export interface SortKey {
  field: SortField;
  direction: SortDirection;
}

/**
 * Cap on simultaneous sort keys. Three is the point past which the ordering
 * stops being explicable from the header row alone.
 */
export const MAX_SORT_KEYS = 3;

/** Applied when no sort is configured: newest activity first. */
export const DEFAULT_SORT_KEYS: readonly SortKey[] = [
  { field: "date", direction: "desc" },
];

/**
 * Direction a field gets on its first click. Quantities are more useful
 * largest-first; categories read better in their natural order.
 */
export const DEFAULT_SORT_DIRECTION: Record<SortField, SortDirection> = {
  date: "desc",
  amount: "desc",
  type: "asc",
  status: "asc",
};

/**
 * Lifecycle order, not alphabetical order. Sorting by status exists so a user
 * can surface transactions that still need attention; `completed, failed,
 * pending` would bury the pending ones in the middle.
 */
export const STATUS_ORDER: Record<TxStatus, number> = {
  pending: 0,
  completed: 1,
  failed: 2,
};

/** Money-in before money-out, then the rarer kinds. */
export const TYPE_ORDER: Record<TxType, number> = {
  deposit: 0,
  withdrawal: 1,
  transfer: 2,
  trade: 3,
};

/**
 * Narrows an arbitrary column id to a sortable field. Exported because the
 * table components pass column ids as plain strings — they are shared with
 * tables that have entirely different fields.
 */
export function isSortField(value: string): value is SortField {
  return (SORTABLE_FIELDS as readonly string[]).includes(value);
}

function isSortDirection(value: string): value is SortDirection {
  return value === "asc" || value === "desc";
}

/**
 * Reads `date:desc,amount:asc` into sort keys, dropping anything unknown.
 *
 * The value comes from the URL, so it is untrusted: unknown fields and
 * directions are discarded, a repeated field keeps only its first occurrence
 * (a field cannot be sorted two ways at once), and the list is truncated to
 * {@link MAX_SORT_KEYS}.
 */
export function parseSortParam(raw: string | null | undefined): SortKey[] {
  if (!raw) return [];

  const keys: SortKey[] = [];
  const seen = new Set<SortField>();

  for (const segment of raw.split(",")) {
    const [rawField, rawDirection = ""] = segment.split(":");
    const field = rawField.trim().toLowerCase();
    if (!isSortField(field) || seen.has(field)) continue;

    const direction = rawDirection.trim().toLowerCase();
    keys.push({
      field,
      direction: isSortDirection(direction)
        ? direction
        : DEFAULT_SORT_DIRECTION[field],
    });
    seen.add(field);

    if (keys.length === MAX_SORT_KEYS) break;
  }

  return keys;
}

/** Inverse of {@link parseSortParam}. Returns "" for an empty key list. */
export function serializeSortParam(keys: readonly SortKey[]): string {
  return keys.map((key) => `${key.field}:${key.direction}`).join(",");
}

/**
 * Reads the single-column `sortBy` / `direction` params the table used before
 * multi-column sort existed, so older bookmarks and shared links still land on
 * the ordering they were saved with.
 */
export function parseLegacySortParams(
  rawField: string | null | undefined,
  rawDirection: string | null | undefined,
): SortKey[] {
  const field = (rawField ?? "").trim().toLowerCase();
  if (!isSortField(field)) return [];

  const direction = (rawDirection ?? "").trim().toLowerCase();
  return [
    {
      field,
      direction: isSortDirection(direction)
        ? direction
        : DEFAULT_SORT_DIRECTION[field],
    },
  ];
}

function flip(direction: SortDirection): SortDirection {
  return direction === "asc" ? "desc" : "asc";
}

/**
 * Advances the sort state for a header activation.
 *
 * A plain activation replaces the whole sort with the clicked field and cycles
 * it through `default direction → opposite → off`. Landing on "off" returns an
 * empty list, which the sorter reads as {@link DEFAULT_SORT_KEYS} — a user can
 * always get back to the default ordering by clicking the same header again.
 *
 * An additive activation (shift-click) instead appends the field as a
 * lower-priority tiebreaker, leaving the existing keys and their order alone.
 *
 * Returns the **same array reference** when nothing changed — currently only
 * when an additive activation is refused because {@link MAX_SORT_KEYS} is
 * already reached. Callers use reference equality to tell "rejected" from
 * "applied" and announce the refusal instead of silently dropping the click.
 */
export function toggleSortKey(
  keys: readonly SortKey[],
  field: SortField,
  options: { additive?: boolean } = {},
): SortKey[] {
  const existingIndex = keys.findIndex((key) => key.field === field);

  if (options.additive) {
    if (existingIndex === -1) {
      if (keys.length >= MAX_SORT_KEYS) return keys as SortKey[];
      return [...keys, { field, direction: DEFAULT_SORT_DIRECTION[field] }];
    }

    const existing = keys[existingIndex];
    // Third activation drops this key rather than cycling forever, so an
    // accidental shift-click is undoable with another shift-click.
    if (existing.direction !== DEFAULT_SORT_DIRECTION[field]) {
      return keys.filter((key) => key.field !== field);
    }

    const next = [...keys];
    next[existingIndex] = { field, direction: flip(existing.direction) };
    return next;
  }

  const isOnlyKey = keys.length === 1 && existingIndex === 0;
  if (!isOnlyKey) {
    return [{ field, direction: DEFAULT_SORT_DIRECTION[field] }];
  }

  const current = keys[0];
  if (current.direction === DEFAULT_SORT_DIRECTION[field]) {
    return [{ field, direction: flip(current.direction) }];
  }

  return [];
}

/** Drops a field from the sort, keeping the order of the remaining keys. */
export function removeSortKey(
  keys: readonly SortKey[],
  field: SortField,
): SortKey[] {
  return keys.filter((key) => key.field !== field);
}

/**
 * Sets one key's direction. Returns the same reference when the field is not
 * part of the sort, or already points that way.
 */
export function setSortKeyDirection(
  keys: readonly SortKey[],
  field: SortField,
  direction: SortDirection,
): SortKey[] {
  const index = keys.findIndex((key) => key.field === field);
  if (index === -1 || keys[index].direction === direction) {
    return keys as SortKey[];
  }

  const next = [...keys];
  next[index] = { field, direction };
  return next;
}

/**
 * Moves a key up or down the priority list. Returns the same reference when
 * the move would fall off either end, so a disabled control and a no-op call
 * agree.
 */
export function moveSortKey(
  keys: readonly SortKey[],
  field: SortField,
  offset: number,
): SortKey[] {
  const index = keys.findIndex((key) => key.field === field);
  if (index === -1 || offset === 0) return keys as SortKey[];

  const target = index + offset;
  if (target < 0 || target >= keys.length) return keys as SortKey[];

  const next = [...keys];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

/**
 * The value a field sorts on, or `null` when the row carries no usable value.
 * `null` is what drives the sorts-last rule in {@link compareTransactions}.
 */
function sortValue(row: Transaction, field: SortField): number | string | null {
  switch (field) {
    case "date": {
      const parsed = Date.parse(row.timestamp);
      return Number.isNaN(parsed) ? null : parsed;
    }
    case "amount": {
      if (row.amount === null) return null;
      const parsed = Number.parseFloat(row.amount);
      return Number.isFinite(parsed) ? parsed : null;
    }
    case "type":
      return TYPE_ORDER[row.type] ?? Number.MAX_SAFE_INTEGER;
    case "status":
      return STATUS_ORDER[row.status] ?? Number.MAX_SAFE_INTEGER;
  }
}

/**
 * Compares two rows by every sort key in priority order, falling back to id.
 *
 * The id fallback is what makes the ordering total: two rows that tie on all
 * keys still have a fixed relative position, so the table does not reshuffle
 * equal rows when the data is refetched in a different order.
 */
export function compareTransactions(
  left: Transaction,
  right: Transaction,
  keys: readonly SortKey[],
): number {
  for (const key of keys) {
    const leftValue = sortValue(left, key.field);
    const rightValue = sortValue(right, key.field);

    // Absent values sink to the bottom in both directions.
    if (leftValue === null || rightValue === null) {
      if (leftValue === rightValue) continue;
      return leftValue === null ? 1 : -1;
    }

    if (leftValue === rightValue) continue;

    const ascending = leftValue < rightValue ? -1 : 1;
    return key.direction === "asc" ? ascending : -ascending;
  }

  return left.id.localeCompare(right.id);
}

/**
 * Returns a new sorted array; never mutates the input.
 *
 * An empty key list means "no explicit sort" and falls back to
 * {@link DEFAULT_SORT_KEYS} rather than leaving the rows in fetch order.
 */
export function sortTransactions(
  rows: readonly Transaction[],
  keys: readonly SortKey[] = DEFAULT_SORT_KEYS,
): Transaction[] {
  const effectiveKeys = keys.length > 0 ? keys : DEFAULT_SORT_KEYS;
  return [...rows].sort((left, right) =>
    compareTransactions(left, right, effectiveKeys),
  );
}

// ---------------------------------------------------------------------------
// Date presets
// ---------------------------------------------------------------------------

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Turns a relative preset into the absolute `YYYY-MM-DD` range it means at
 * `now`. `now` is a parameter rather than a `new Date()` call so the mapping is
 * deterministic and testable, and so the caller decides when "today" is read.
 *
 * Boundaries are UTC calendar days, matching {@link filterTransactions}.
 */
export function resolveDatePreset(
  preset: DatePresetId,
  now: Date,
): { dateFrom: string; dateTo: string } {
  const dateTo = toUtcDateString(now);

  if (preset === "ytd") {
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    return { dateFrom: toUtcDateString(yearStart), dateTo };
  }

  // Inclusive of today, so "7d" spans today and the six days before it.
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - (PRESET_DAY_SPAN[preset] - 1));
  return { dateFrom: toUtcDateString(start), dateTo };
}

/**
 * Which preset, if any, the current date range corresponds to at `now`.
 *
 * Applying a preset writes absolute dates into the URL rather than the preset
 * name, so that a shared link keeps the range it was shared with instead of
 * drifting with the reader's clock. Highlighting the matching button is then a
 * derivation rather than a second copy of the state that could disagree — and
 * a range stops being highlighted exactly when it stops meaning "the last 7
 * days".
 */
export function matchDatePreset(
  filters: Pick<TransactionFilters, "dateFrom" | "dateTo">,
  now: Date,
): DatePresetId | null {
  if (!filters.dateFrom || !filters.dateTo) return null;

  for (const preset of DATE_PRESET_IDS) {
    const resolved = resolveDatePreset(preset, now);
    if (
      resolved.dateFrom === filters.dateFrom &&
      resolved.dateTo === filters.dateTo
    ) {
      return preset;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Filter validation
// ---------------------------------------------------------------------------

export type FilterIssueCode = "dateRangeInverted" | "amountRangeInverted";

export interface FilterIssue {
  /** Which range is contradictory, for placing the message next to it. */
  range: "date" | "amount";
  code: FilterIssueCode;
}

/**
 * Reports ranges whose bounds cross over, e.g. a minimum above the maximum.
 *
 * Such a range can only match zero rows. An empty table with no explanation
 * reads as "you have no transactions", which is a different and alarming
 * claim, so {@link filterTransactions} skips a contradictory range and the UI
 * shows the issue instead.
 */
export function validateTransactionFilters(
  filters: TransactionFilters,
): FilterIssue[] {
  const issues: FilterIssue[] = [];

  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    issues.push({ range: "date", code: "dateRangeInverted" });
  }

  if (filters.amountMin !== "" && filters.amountMax !== "") {
    const min = Number.parseFloat(filters.amountMin);
    const max = Number.parseFloat(filters.amountMax);
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
      issues.push({ range: "amount", code: "amountRangeInverted" });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/** Splits a query into terms; every term must match (AND, not OR). */
function searchTerms(search: string): string[] {
  return search.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/** The haystack a search term is tested against. */
function searchableText(row: Transaction): string {
  return [row.type, row.status, row.asset ?? "", row.transactionHash]
    .join(" ")
    .toLowerCase();
}

function startOfUtcDay(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

function endOfUtcDay(date: string): number {
  return Date.parse(`${date}T23:59:59.999Z`);
}

function numericAmount(row: Transaction): number | null {
  if (row.amount === null) return null;
  const parsed = Number.parseFloat(row.amount);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Applies every filter to `rows` and returns the survivors, in input order.
 *
 * Notable rules:
 *
 * - **Date bounds are UTC calendar days**, inclusive at both ends. Anchoring
 *   to UTC rather than the viewer's timezone means a shared link selects the
 *   same transactions for the sender and the recipient.
 * - **A bounded amount range excludes rows with no amount.** A row whose
 *   amount is unknown cannot be shown to satisfy "at least 100"; letting it
 *   through would overstate what the filtered set contains.
 * - **A contradictory range is skipped**, not applied — see
 *   {@link validateTransactionFilters}.
 */
export function filterTransactions(
  rows: readonly Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const issues = validateTransactionFilters(filters);
  const skipDateRange = issues.some((issue) => issue.range === "date");
  const skipAmountRange = issues.some((issue) => issue.range === "amount");

  const terms = searchTerms(filters.search);
  const asset = filters.asset.trim().toLowerCase();

  const fromBound =
    !skipDateRange && filters.dateFrom ? startOfUtcDay(filters.dateFrom) : null;
  const toBound =
    !skipDateRange && filters.dateTo ? endOfUtcDay(filters.dateTo) : null;

  const min =
    !skipAmountRange && filters.amountMin !== ""
      ? Number.parseFloat(filters.amountMin)
      : null;
  const max =
    !skipAmountRange && filters.amountMax !== ""
      ? Number.parseFloat(filters.amountMax)
      : null;
  const hasMin = min !== null && Number.isFinite(min);
  const hasMax = max !== null && Number.isFinite(max);

  return rows.filter((row) => {
    if (terms.length > 0) {
      const haystack = searchableText(row);
      if (!terms.every((term) => haystack.includes(term))) return false;
    }

    if (filters.types.length > 0 && !filters.types.includes(row.type)) {
      return false;
    }

    if (filters.statuses.length > 0 && !filters.statuses.includes(row.status)) {
      return false;
    }

    if (asset && (row.asset ?? "").trim().toLowerCase() !== asset) {
      return false;
    }

    if (fromBound !== null || toBound !== null) {
      const timestamp = Date.parse(row.timestamp);
      // A row with no readable date cannot be placed in a date range.
      if (Number.isNaN(timestamp)) return false;
      if (fromBound !== null && timestamp < fromBound) return false;
      if (toBound !== null && timestamp > toBound) return false;
    }

    if (hasMin || hasMax) {
      const amount = numericAmount(row);
      if (amount === null) return false;
      if (hasMin && amount < (min as number)) return false;
      if (hasMax && amount > (max as number)) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Active filter summary
// ---------------------------------------------------------------------------

/**
 * Which filter a summary chip belongs to. `type` and `status` chips also carry
 * a `value`, because those filters hold several selections and each is removed
 * on its own.
 */
export type ActiveFilterKind =
  | "search"
  | "type"
  | "status"
  | "asset"
  | "dateFrom"
  | "dateTo"
  | "amountMin"
  | "amountMax";

export interface ActiveFilterDescriptor {
  /** Stable key for React lists and for identifying a chip in tests. */
  id: string;
  kind: ActiveFilterKind;
  /** Raw value to display, and to remove for multi-value filters. */
  value: string;
}

/**
 * Describes every applied filter as one removable chip.
 *
 * Returns data, not markup or copy: the labels are translated in the component
 * so this module stays free of i18n and rendering concerns.
 */
export function describeActiveFilters(
  filters: TransactionFilters,
): ActiveFilterDescriptor[] {
  const chips: ActiveFilterDescriptor[] = [];

  if (filters.search.trim()) {
    chips.push({ id: "search", kind: "search", value: filters.search });
  }

  for (const type of filters.types) {
    chips.push({ id: `type:${type}`, kind: "type", value: type });
  }

  for (const status of filters.statuses) {
    chips.push({ id: `status:${status}`, kind: "status", value: status });
  }

  if (filters.asset) {
    chips.push({ id: "asset", kind: "asset", value: filters.asset });
  }

  if (filters.dateFrom) {
    chips.push({ id: "dateFrom", kind: "dateFrom", value: filters.dateFrom });
  }

  if (filters.dateTo) {
    chips.push({ id: "dateTo", kind: "dateTo", value: filters.dateTo });
  }

  if (filters.amountMin !== "") {
    chips.push({ id: "amountMin", kind: "amountMin", value: filters.amountMin });
  }

  if (filters.amountMax !== "") {
    chips.push({ id: "amountMax", kind: "amountMax", value: filters.amountMax });
  }

  return chips;
}

/** How many filters are applied, counting each type/status selection once. */
export function countActiveFilters(filters: TransactionFilters): number {
  return describeActiveFilters(filters).length;
}

export function hasActiveTransactionFilters(
  filters: TransactionFilters,
): boolean {
  return countActiveFilters(filters) > 0;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginatedRows<T> {
  rows: T[];
  /** Requested page clamped into range, so an out-of-range URL still renders. */
  page: number;
  totalItems: number;
  totalPages: number;
}

export function paginateRows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): PaginatedRows<T> {
  const safePageSize = pageSize > 0 ? Math.floor(pageSize) : 1;
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (safePage - 1) * safePageSize;

  return {
    rows: rows.slice(start, start + safePageSize),
    page: safePage,
    totalItems,
    totalPages,
  };
}
