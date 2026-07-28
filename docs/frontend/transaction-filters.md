# Transaction History — Advanced Filter & Sort

## Overview

The Transaction History page (`frontend/src/pages/TransactionHistory.tsx`) supports
advanced, URL-synced filtering and sorting of a wallet's transaction list. All
filter state lives in the URL query string, which means filtered views are:

- **Shareable** — copy/paste the URL to share a specific filtered view
- **Bookmarkable** — save a filtered view for later
- **Restorable** — refresh or use browser back/forward without losing filters

Filtering itself is entirely client-side (see `useClientDataTable`), applied on
top of the full transaction list already fetched for the connected wallet.

## Architecture

- **`useTransactionFilters`** (`frontend/src/hooks/useTransactionFilters.ts`) —
  owns filter state, parsed from and synced back to the URL query string via
  `useSearchParams`. Provides setters for each filter plus a `clearAll()` helper.
- **`TransactionFilterPanel`** (`frontend/src/components/TransactionFilterPanel.tsx`) —
  presentational panel that renders the filter controls (search box, date range,
  asset select, amount range, type/status checkboxes) and calls the setters
  passed down as props. Text/number inputs are locally debounced (300ms) before
  being written to the URL to avoid excessive history churn.
- **`TransactionHistory`** (`frontend/src/pages/TransactionHistory.tsx`) — wires
  `useTransactionFilters` into `useClientDataTable`'s `filterRow` predicate, and
  derives the available `assets` options from the currently loaded transactions.

## URL Query Parameters

All filter parameters are optional. Omitting a parameter (or setting it to an
empty string) means "no filter" for that field. Setting any filter resets
`page` back to `1`.

| Parameter    | Type                              | Example                  | Notes |
|--------------|-----------------------------------|---------------------------|-------|
| `search`     | string                             | `search=abcdef12`         | Free-text match against type, asset, and transaction hash. |
| `asset`      | string                             | `asset=USDC`              | Exact, case-sensitive match against `row.asset`. Empty/absent = all assets. |
| `types`      | comma-separated list               | `types=deposit,withdrawal`| Valid values: `deposit`, `withdrawal`, `transfer`, `trade`. Unknown values are silently discarded. |
| `statuses`   | comma-separated list               | `statuses=pending,failed` | Valid values: `pending`, `completed`, `failed`. Unknown values are silently discarded. |
| `dateFrom`   | ISO date (`YYYY-MM-DD`)            | `dateFrom=2026-01-01`     | Inclusive lower bound on transaction timestamp (00:00:00 local). Invalid/malformed dates are discarded. |
| `dateTo`     | ISO date (`YYYY-MM-DD`)            | `dateTo=2026-06-30`       | Inclusive upper bound on transaction timestamp (23:59:59.999 local). Invalid/malformed dates are discarded. |
| `amountMin`  | non-negative numeric string        | `amountMin=10`            | Inclusive lower bound on transaction amount. Negative/non-numeric values are discarded. |
| `amountMax`  | non-negative numeric string        | `amountMax=5000.5`        | Inclusive upper bound on transaction amount. Negative/non-numeric values are discarded. |
| `sortBy`     | string                             | `sortBy=amount`           | Managed by `useDataTableState`; one of the sortable column ids (`type`, `status`, `amount`, `date`). |
| `sortDirection` | `asc` \| `desc`                 | `sortDirection=desc`      | Managed by `useDataTableState`. |
| `page`       | integer                            | `page=2`                  | Paginated view only; reset to `1` whenever a filter changes. |
| `pageSize`   | integer (`10`, `25`, `50`)         | `pageSize=25`              | Paginated view only. |

### Example URLs

```
/transactions?asset=USDC&statuses=completed
/transactions?types=deposit,transfer&dateFrom=2026-01-01&dateTo=2026-03-31
/transactions?search=eurc&amountMin=100&amountMax=1000
```

## Filter Semantics

All active filters are combined with logical **AND** — a row must satisfy every
active filter to be shown (see `filterRow` in `TransactionHistory.tsx`):

1. `types` — row is hidden if `types` is non-empty and does not include `row.type`.
2. `statuses` — row is hidden if `statuses` is non-empty and does not include `row.status`.
3. `dateFrom` / `dateTo` — row is hidden if its timestamp falls outside the range.
4. `amountMin` / `amountMax` — row is hidden if its parsed amount falls outside the range.
5. `asset` — row is hidden unless `row.asset` is an **exact, case-sensitive** match
   for the selected asset (e.g. `asset=USDC` will not match a row with `asset: "usdc"`).

The asset options shown in the filter panel's `<select>` are derived from the
unique, non-empty `asset` values present in the currently loaded transactions
(sorted alphabetically) — no options are hard-coded.

## Sorting

Sorting is handled separately by `useDataTableState` / `useClientDataTable` and
is independent of the filter state above. Sortable columns are `type`, `status`,
`amount`, and `date`; `asset` and `hash` are not sortable.

## Infinite Scroll & Filters

When the page's view mode is `infinite`, the visible row count resets back to
the first batch (`INFINITE_SCROLL_BATCH_SIZE`) whenever the search, sort, or
**any** filter value changes — including `types`, `statuses`, `dateFrom`,
`dateTo`, `amountMin`, `amountMax`, and `asset`. This prevents stale scroll
positions from persisting across a filter change and ensures the loaded-item
count and "Showing X of Y" summary stay consistent with the new result set.

## Clearing Filters

`clearAll()` removes every filter parameter (`search`, `asset`, `types`,
`statuses`, `dateFrom`, `dateTo`, `amountMin`, `amountMax`) from the URL and
resets `page` to `1`. It is wired to:

- The "Clear Filters" button in `TransactionFilterPanel` (visible only when
  `hasActiveFilters` is `true`).
- The "Reset filters" action shown in the empty state when an active filter
  set yields zero rows.

## Testing

- `frontend/src/hooks/useTransactionFilters.test.ts` — URL parsing/serialization
  for every filter field, including `asset`, plus setter and `clearAll` behavior.
- `frontend/src/components/TransactionFilterPanel.test.tsx` — rendering of
  filter controls, asset selection, clear-all behavior, and expand/collapse.
- `frontend/src/pages/TransactionHistory.test.tsx` — integration tests verifying
  that filters (including `asset`) correctly restrict the rendered rows.

Run the full suite for this feature with:

```bash
npm --prefix frontend run test:run -- src/hooks/useTransactionFilters.test.ts src/components/TransactionFilterPanel.test.tsx src/pages/TransactionHistory.test.tsx
```
