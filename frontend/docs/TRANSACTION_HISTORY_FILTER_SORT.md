# Transaction History — Advanced Filter and Sort

How the transaction history table decides which rows to show and in what order.

- Engine: [`frontend/src/lib/transactionQuery.ts`](../src/lib/transactionQuery.ts)
- Filter state: [`frontend/src/hooks/useTransactionFilters.ts`](../src/hooks/useTransactionFilters.ts)
- Sort state: [`frontend/src/hooks/useTransactionSort.ts`](../src/hooks/useTransactionSort.ts)
- UI: [`TransactionFilterPanel`](../src/components/TransactionFilterPanel.tsx),
  [`TransactionFilterChips`](../src/components/TransactionFilterChips.tsx),
  [`TransactionSortControl`](../src/components/TransactionSortControl.tsx)
- Page: [`frontend/src/pages/TransactionHistory.tsx`](../src/pages/TransactionHistory.tsx)

## Architecture

The page holds no filter or sort state of its own. The URL is the single source
of truth, the hooks parse it, and the pipeline is three pure functions:

```
transactions ──filterTransactions──▶ filtered ──sortTransactions──▶ sorted ──paginateRows──▶ page
```

All three live in `lib/transactionQuery.ts` and take their inputs as arguments —
no React, no router, no clock. That is what lets the table's behaviour be
specified in unit tests (`transactionQuery.test.ts`) instead of only observed
through the DOM, and it is why a change to ordering or matching rules should be
made there rather than in the page component.

Because state lives in the URL, every filtered, sorted view is bookmarkable,
shareable, and restored correctly by browser back/forward.

## URL parameters

| Parameter | Meaning | Example |
| --- | --- | --- |
| `search` | Free-text query; space-separated terms are ANDed | `?search=xlm+failed` |
| `types` | Comma-separated transaction types | `?types=deposit,withdrawal` |
| `statuses` | Comma-separated statuses | `?statuses=pending,failed` |
| `asset` | Asset code, matched case-insensitively | `?asset=usdc` |
| `dateFrom` / `dateTo` | Inclusive `YYYY-MM-DD` bounds | `?dateFrom=2026-01-01&dateTo=2026-03-31` |
| `amountMin` / `amountMax` | Inclusive numeric bounds | `?amountMin=100&amountMax=5000` |
| `sort` | Ordering, highest priority first | `?sort=status:asc,amount:desc` |
| `sortBy` / `direction` | Single-column ordering (legacy) | `?sortBy=amount&direction=asc` |
| `page` / `pageSize` | Pagination | `?page=2&pageSize=25` |

Every parameter is treated as untrusted input. Unknown types, statuses, sort
fields and directions are dropped; malformed dates and negative amounts are
discarded; a repeated sort field keeps only its first occurrence. A bad
parameter therefore degrades to "filter not applied" rather than an error or an
empty table.

## Sorting

### Multi-column ordering

Up to **three** columns (`MAX_SORT_KEYS`) can be sorted at once, in priority
order: later keys only decide rows that tie on every earlier key. Three is the
point past which the ordering stops being explicable from the header row alone.

Sortable fields are `date`, `amount`, `type` and `status`. `asset` and the
transaction hash are deliberately not sortable — alphabetising either tells a
user nothing they came to the page to learn.

Two gestures build the same state:

- **Click a header** — replaces the sort with that column, cycling
  `default direction → opposite → off`. Cycling back to "off" returns to the
  default ordering, so a user can always undo by clicking again.
- **Shift-click a header** — appends the column as a lower-priority tiebreaker,
  leaving existing keys and their order alone. A third shift-click on the same
  column removes it.

The **Sort** panel in the table toolbar exposes the same capability as ordinary
buttons: it names each active key, shows its priority, and offers flip, reorder,
remove and reset. Shift-click is a pointer gesture that has to be known in
advance; the panel is how the feature stays reachable without it.

### Ordering rules

Three rules matter enough to state, because a plausible-looking refactor can
silently break each one:

1. **Total ordering.** Comparison always ends with a transaction-id comparison,
   so a given (rows, sort keys) pair yields exactly one ordering regardless of
   input order. Without it, rows that tie on every key reshuffle whenever the
   upstream fetch returns them in a different sequence.
2. **Absent values sort last in both directions.** A `null` amount or an
   unparseable timestamp goes to the bottom whether the sort is ascending or
   descending. Reversing "unknown" to the top on a descending sort would present
   missing data as the largest data.
3. **Categories sort by meaning, not alphabet.** Status orders as
   `pending → completed → failed`, so sorting by status surfaces transactions
   that still need attention instead of burying them between `completed` and
   `failed`. Type orders as `deposit → withdrawal → transfer → trade`.

Amounts are compared numerically. Sorting them as strings would place `1000`
before `9`.

### URL representation

`sort` is written for every explicit ordering and absent when the table is on
its default (`date:desc`); its presence is what distinguishes "the user chose
this" from "the default". The primary key is also mirrored into the legacy
`sortBy`/`direction` params so older links keep working and so `useDataTableState`
— which rewrites those params on every page change — cannot contradict `sort`.

A legacy pair that merely restates the default is read as "no explicit sort", so
a page change is not mistaken for a sort choice.

Changing the ordering resets to page 1: a row's page number means nothing under
a different order.

## Filtering

### Matching rules

- **Search** matches type, status, asset and hash, case-insensitively. Multiple
  terms are ANDed, so adding a term narrows the result rather than widening it.
- **Types and statuses** are OR within a filter and AND across filters: an empty
  selection means "all", never "none".
- **Asset** is matched case-insensitively and ignores surrounding whitespace.
- **Date bounds are inclusive UTC calendar days** — `dateFrom` starts at
  `T00:00:00.000Z` and `dateTo` ends at `T23:59:59.999Z`. Anchoring to UTC rather
  than the viewer's timezone means a shared link selects the same transactions
  for the sender and the recipient.
- **A bounded amount range excludes rows with no amount.** A row whose amount is
  unknown cannot be shown to satisfy "at least 100"; letting it through would
  overstate what the filtered set contains. With no bound set, such rows appear
  normally.

### Contradictory ranges

A range whose bounds cross over (`dateFrom` after `dateTo`, `amountMin` above
`amountMax`) can only ever match zero rows. Rather than render an empty table —
which reads as "you have no transactions", a different and alarming claim — the
engine **skips that range** and `validateTransactionFilters` reports the issue,
which the panel renders as an inline message with `aria-invalid` and
`aria-describedby` on both inputs. Other filters continue to apply.

The date inputs carry no native `min`/`max` bounds. Bounding each by the other
blocks a range from being shifted earlier or later with no explanation, and
leaves a contradictory range arriving from a shared URL undiagnosed.

### Quick ranges

The preset buttons (last 7 / 30 / 90 days, year to date) resolve to **absolute**
dates that are written into the URL, so a shared link keeps the range it was
shared with instead of drifting with the reader's clock. Rolling windows include
today, so "last 7 days" spans today and the six days before it.

Which preset is highlighted is *derived* by comparing the current range back
against "now" (`matchDatePreset`) rather than stored, so there is no second copy
of the state to disagree — and a range stops being highlighted exactly when it
stops meaning "the last 7 days".

`resolveDatePreset` takes `now` as an argument rather than reading the clock, so
the mapping is deterministic and testable.

### Active filter chips

Every applied filter is summarised as one removable chip.
`describeActiveFilters` returns structured descriptors, not copy — labels are
translated in the component — and each `type`/`status` selection gets its own
chip so one value can be dropped without clearing the rest.

The chips sit **outside** the panel's collapsible body: collapsing the panel must
not hide the fact that rows are being filtered out.

## Accessibility

- Sorted headers carry `aria-sort`; the priority badges and arrow glyphs are
  `aria-hidden`, since the same information reaches assistive technology through
  `aria-sort` and the sort panel. Keeping them out of the accessible name also
  keeps each header's name equal to its label.
- A polite live region announces the new ordering after every sort change —
  `aria-sort` on an unfocused header is not announced when it changes.
- A refused sort (the three-key cap) is announced rather than silently dropped.
- The sort panel states each key's direction in words ("Amount: Descending"),
  not only as an arrow.
- Range validation messages are wired to their inputs with `aria-describedby`
  and announced politely.
- Sort priority is never conveyed by colour alone: the badge carries a number.

## Shared table components

`DataTable` and `VirtualizedDataTable` accept multi-sort through two optional
props, additive to the existing single-column API:

| Prop | Purpose |
| --- | --- |
| `sortKeys` | Active `{ field, direction }[]`; supersedes `sortBy`/`sortDirection` |
| `onSortToggle` | `(columnId, additive) => void`; `additive` mirrors the Shift modifier |

Header presentation is resolved by `getColumnSortState` in
[`dataTableSort.ts`](../src/components/dataTableSort.ts), shared by both tables.
Tables that pass only `sortBy`/`sortDirection` — Portfolio, for one — are
unaffected.

## Tests

| File | Covers |
| --- | --- |
| `src/lib/transactionQuery.test.ts` | Filter matching, ordering rules, sort-param parsing, presets, validation, pagination |
| `src/hooks/useTransactionSort.test.ts` | Multi-sort URL round-trip, legacy params, cap refusal, page reset |
| `src/hooks/useTransactionFilters.test.ts` | Filter param parsing and setters |
| `src/components/dataTableSort.test.ts` | Header sort-state resolution for both prop shapes |
| `src/components/TransactionSortControl.test.tsx` | Sort panel behaviour and labelling |
| `src/components/TransactionFilterChips.test.tsx` | Chip labelling and per-value removal |
| `src/components/TransactionFilterPanel.test.tsx` | Presets, validation messaging, chips while collapsed |
| `src/pages/TransactionHistory.test.tsx` | End-to-end filter/sort behaviour in the rendered table |

## Extending

- **A new sortable column**: add the field to `SORTABLE_FIELDS`, give it a
  default direction in `DEFAULT_SORT_DIRECTION`, add a case to `sortValue`, add
  an i18n key to `SORT_FIELD_LABEL_KEY`, and mark the column `sortable` in the
  page's column definitions.
- **A new filter**: extend `TransactionFilters`, parse its param in
  `useTransactionFilters`, apply it in `filterTransactions`, and emit a chip from
  `describeActiveFilters` so it appears in the summary.
- **Server-side filtering**: the engine functions take rows and filters as
  arguments, so moving the work behind the API means calling the endpoint in
  `useTransactionHistory` and dropping the client-side call — the URL contract,
  the panel and the sort control need no changes.
