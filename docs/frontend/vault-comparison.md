# Vault Comparison Screen

The vault comparison screen (`/compare`) lets users compare multiple vault strategies side by side before allocating capital. It is implemented in `frontend/src/pages/VaultComparison.tsx`, with the strategy catalog in `frontend/src/data/vaultStrategies.ts` (currently mock data; API wiring is future work).

## Selection rules

- Strategies are toggled by clicking their cards. Each card exposes `aria-pressed` to reflect its selection state.
- A minimum of **2** strategies must be selected to show the comparison table; with fewer, an empty state prompts the user to pick more.
- A maximum of **3** strategies (`MAX_VAULT_COMPARISON_SELECTION`) can be selected at once. When the limit is reached, unselected cards are marked with `aria-disabled="true"`, dimmed, and clicking them is a no-op. Deselecting a strategy frees a slot.
- On first visit (no URL param), the first two strategies in the catalog are selected by default.

## URL state (`strategies` param)

- The selection is synced to the `strategies` search param as a comma-separated list of strategy ids, e.g. `/compare?strategies=benji,credit-income`.
- On mount, the selection is initialized from the URL if it contains at least one valid strategy id; invalid or unknown ids are ignored. If no valid ids are present, the default selection (first two strategies) is used.
- Every toggle updates the param using history *replace* (no extra history entries), so comparisons are shareable and survive reloads without polluting the back button.

## Comparison metrics

The table compares the selected strategies across:

| Metric | Description |
| --- | --- |
| APY | Advertised annual yield. The highest APY cell is highlighted and marked with `data-best="true"`. |
| Liquidity | Redemption cadence (e.g. Instant, Daily, Weekly). |
| Lockup | Any lockup period applied to allocations. |
| Risk | Qualitative risk rating. |
| Settlement | Settlement timing (e.g. T+0, T+2). |

## CTA behavior

When 2 or more strategies are selected:

- **Allocate to selected** (primary) navigates to `/?tab=deposit` so the user lands directly on the deposit flow.
- **Back to vault** (secondary) navigates to `/`.

The empty state (fewer than 2 selected) offers only the secondary "Back to vault" action.

## Route wiring

`/compare` is registered in `frontend/src/lib/routePrefetch.ts` (`routeImports`, `prefetchDashboardRoutes`, and the `LazyVaultComparison` export) and rendered lazily from `frontend/src/App.tsx`.
