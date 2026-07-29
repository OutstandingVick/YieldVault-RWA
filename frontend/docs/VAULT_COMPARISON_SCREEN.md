# Vault Comparison Screen (Multi-Strategy Selection)

## Overview

The comparison screen at `/compare` lets a user pick several vault strategies and
read them side by side before allocating capital. It answers one question:
*given my liquidity and risk constraints, which strategy should I allocate to?*

The screen is built from two pieces:

| File | Responsibility |
| --- | --- |
| `src/lib/vaultStrategies.ts` | Strategy catalog, metric definitions, and all pure selection/ranking logic |
| `src/pages/VaultComparison.tsx` | Rendering, URL synchronisation, and accessibility affordances |

Keeping the logic in `vaultStrategies.ts` means selection rules, URL parsing, and
best-in-class ranking are unit-testable without mounting React.

## Data source

`VAULT_STRATEGIES` is a **local fixture catalog**. The backend exposes no strategy
listing endpoint yet (`backend/src/vaultEndpoints.ts` has no `/vault/strategies`
route), so the screen reads from this module rather than the network.

Metrics are stored as **numbers**, not pre-formatted strings:

```ts
{
  id: "credit-income",
  apyPercent: 9.15,      // not "9.15%"
  liquidityDays: 7,      // not "Weekly"
  lockupDays: 7,
  riskTier: "elevated",  // ranked via RISK_TIER_RANK
  settlementDays: 2,     // not "T+2"
  minimumDepositUsd: 1000,
}
```

That distinction is what makes sorting, ranking, and locale-aware formatting
possible — a screen holding `"9.15%"` cannot tell you which strategy yields most.
Display strings are produced at render time by each metric's `format()`, which
delegates to `src/lib/formatters.ts` so currency and percentages follow the
user's locale.

### Migrating to an API

When a `GET /vault/strategies` endpoint lands, only the catalog needs to change:
replace `VAULT_STRATEGIES` with a `useQuery` hook (following
`src/hooks/useVaultData.ts`) and feed the result into the same helpers.
`COMPARISON_METRICS`, `toggleStrategySelection`, `sortStrategies`, and
`findBestStrategyIds` all take their inputs as arguments and need no changes.

## Comparison metrics

`COMPARISON_METRICS` defines each row of the comparison table. Every metric
declares which direction is better, so ranking is data-driven rather than
hard-coded per row:

| Metric | Better is | Source field |
| --- | --- | --- |
| APY | higher | `apyPercent` |
| Liquidity | lower | `liquidityDays` |
| Lockup | lower | `lockupDays` |
| Risk | lower | `RISK_TIER_RANK[riskTier]` |
| Settlement | lower | `settlementDays` |
| Minimum deposit | lower | `minimumDepositUsd` |

## URL state

The URL is the single source of truth for selection and ordering, so a comparison
is bookmarkable, shareable, and restored correctly by the browser's back and
forward buttons.

| Parameter | Meaning | Example |
| --- | --- | --- |
| `strategies` | Comma-separated strategy ids, in column order | `?strategies=benji,credit-income` |
| `sortBy` | Metric id the columns are ordered by | `?sortBy=apy` |
| `direction` | `asc` or `desc` | `?direction=desc` |

Example: `/compare?strategies=benji,credit-income&sortBy=apy&direction=desc`

### Untrusted input

Query parameters are user-editable, so `parseSelectionParam` treats them as
untrusted and normalises rather than trusting or throwing:

- ids not present in the catalog are dropped
- duplicates collapse to their first occurrence
- anything beyond `MAX_COMPARISON_SELECTION` (3) is truncated
- whitespace and empty segments are ignored
- a **missing** parameter falls back to `DEFAULT_SELECTION` (the first two
  strategies), while an **explicitly empty** one (`?strategies=`) is honoured as
  an empty selection, so "clear all" survives a reload

`parseSortDirection` likewise coerces anything that is not `asc`/`desc` back to a
safe default.

## Selection rules

- **Minimum 2** (`MIN_COMPARISON_SELECTION`) — below this the table is replaced
  by an empty state, with distinct copy for "nothing selected" versus "one more
  needed".
- **Maximum 3** (`MAX_COMPARISON_SELECTION`) — more columns than that stop
  fitting a laptop viewport.

`toggleStrategySelection` returns the **identical array reference** when the cap
blocks an addition. The page uses that reference check to tell "rejected" apart
from "changed", so a blocked click produces a spoken explanation instead of
silently doing nothing:

```ts
const next = toggleStrategySelection(selectedIds, strategy.id);
if (next === selectedIds) {
  // cap reached — announce, don't swallow
}
```

## Best-in-class marking

`findBestStrategyIds` returns the ids holding the optimal value for a metric:

- ties all win, so a shared best value marks every strategy that reaches it
- when **every** strategy ties, the result is empty — marking a whole row is
  noise, not signal (a two-strategy comparison where both have no lockup marks
  neither)
- fewer than two strategies yields an empty result, since there is nothing to
  compare against

## Accessibility

The screen targets WCAG 2.1 AA and is covered by axe-core audits in
`src/pages/VaultComparison.test.tsx` (both the populated table and the empty
state).

- **Strategy cards** are `<button aria-pressed>` inside a labelled
  `role="group"`, so they are keyboard operable and announce selection state.
- **Cap feedback**: at the limit, unselected cards get `aria-disabled="true"` and
  a `title` explaining the block. They stay focusable — `disabled` would remove
  them from the tab order and hide the reason.
- **Live region**: a `role="status" aria-live="polite"` paragraph announces every
  selection, deselection, blocked click, sort change, and reset. Without it these
  mutations are invisible to screen reader users.
- **Sorting**: each metric row header holds a `<button>` whose `aria-label`
  includes the metric description, and the `<th>` carries `aria-sort`
  (`ascending` / `descending` / `none`).
- **Best values are never colour-only**: the winning cell adds a `★` glyph plus
  `sr-only` text (`(best APY)`), satisfying WCAG 1.4.1 Use of Colour. Colour and
  weight are reinforcement, not the signal.
- **Table semantics**: an `sr-only` `<caption>` states the current ordering,
  column headers use `scope="col"`, and metric headers use `scope="row"`.

## Tests

| File | Covers |
| --- | --- |
| `src/lib/vaultStrategies.test.ts` | Catalog invariants, day/percent/currency formatting, cap enforcement, URL parse/serialise round-trips and sanitisation, sort stability, best-value ranking including ties |
| `src/pages/VaultComparison.test.tsx` | Rendering, URL-driven selection and restoration, add/remove/blocked interactions and their announcements, empty states, reset, sorting and `aria-sort`, best-value text cues, metric formatting, and axe audits |

Run them with:

```bash
cd frontend
npm run test:run -- src/lib/vaultStrategies.test.ts src/pages/VaultComparison.test.tsx
```
