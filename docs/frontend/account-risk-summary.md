# Account Risk Summary Card

The account risk summary card (`frontend/src/components/RiskSummaryCard.tsx`) surfaces
account-level risk signals on the vault dashboard, each paired with a single actionable
CTA. It renders above the strategy overview panel in `VaultDashboard`.

## Component contract

`RiskSummaryCard` is purely presentational: all copy arrives translated via props, and
each warning is a `RiskAction` object built by the parent.

```ts
type RiskAction = {
  id: string;
  title: string;
  description: string;
  label: string;            // CTA button text
  tone: "critical" | "warning" | "info" | "success";
  onClick: () => void;
};
```

Props:

| Prop | Purpose |
| --- | --- |
| `items` | Ordered list of active warnings (empty = all clear) |
| `title`, `subtitle` | Card heading and supporting line |
| `allClearLabel` | Badge text when there are no warnings |
| `warningsLabel` | Pre-formatted badge text, e.g. "1 warning" / "3 warnings" |
| `healthyMessage` | Body copy for the all-clear state |
| `healthyAction` | Optional `{ label, onClick }` CTA rendered in the all-clear state |

### Accessibility

- The card is a `role="region"` labelled by its heading (`aria-labelledby`), so screen
  reader users can jump to it directly.
- The warning list container uses `aria-live="polite"`, so newly appearing or clearing
  warnings are announced without interrupting the user.

## Signals and CTAs

`VaultDashboard` computes the warnings in its `riskItems` memo. All copy comes from the
`vaultDashboard.riskSummary.*` i18n keys (`frontend/src/i18n/locales/en.ts`, mirrored in
`es.ts`).

| Signal | Trigger | Tone | CTA | CTA behavior |
| --- | --- | --- | --- | --- |
| Wallet not connected | `walletAddress` is null | info | Connect wallet | Dispatches the `TRIGGER_WALLET_CONNECT` window event |
| Vault capacity reached | `isCapReached` | critical | Compare vaults | Navigates to `/compare` |
| Vault nearing capacity | `isCapWarning` (and cap not reached) | warning | Compare vaults | Navigates to `/compare` |
| Insufficient XLM for fees | `xlmBalance < feeXlm` | warning | Review deposit | Switches to the deposit tab at the amount step and dispatches `TRIGGER_DEPOSIT` |
| Vault operations paused | `summary.contractPaused` | critical | Refresh status | Re-fetches the vault summary |

The cap-reached and cap-nearing signals are mutually exclusive; cap-reached wins.

## All-clear state

When no warnings are active, the card shows a success-toned message plus a
"Compare strategies" CTA (`healthyAction`) that navigates to `/compare`, giving users a
next step even when their account is healthy.

## Badge

The pill badge in the header shows the warning count ("1 warning" / "N warnings",
keys `warningCountOne` / `warningCount`) or "All clear" (`allClear`) when the list is
empty.

## Tests

`frontend/src/components/RiskSummaryCard.test.tsx` covers warning rendering, CTA click
handlers, the labelled region role, the all-clear state with and without the healthy
CTA, and singular vs. plural badge labels.
