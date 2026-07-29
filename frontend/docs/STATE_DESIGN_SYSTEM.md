# Consistent UI State Design System

This document outlines the UI state design system introduced in YieldVault RWA for handling loading, error, and empty states consistently across all components and pages.

---

## Core Components Overview

| Component | Responsibility | Default Role | Live Region |
|---|---|---|---|
| `StateWrapper` | Declarative state orchestrator (`isLoading` → `isError` → `isEmpty` → `children`) | Varies | Varies |
| `LoadingState` | Standardized loading spinner and message with skeleton fallback options | `status` | `aria-live="polite"` |
| `ErrorState` | Accessible error alert with retry triggers, severity levels, and optional detail toggle | `alert` | `aria-live="assertive"` |
| `EmptyState` | Empty state cards with pre-configured kinds (`no-data`, `no-results`, `permission`, `search`, etc.) | `status` / `alert` | `aria-live="polite"` / `assertive` |

---

## 1. `StateWrapper`

`StateWrapper` simplifies state conditional logic in container components and page views.

```tsx
import { StateWrapper } from "@/components/ui";

function VaultMetricsSection({ data, isLoading, isError, error, refetch }) {
  return (
    <StateWrapper
      isLoading={isLoading}
      isError={isError}
      isEmpty={!data || data.length === 0}
      error={error}
      onRetry={refetch}
      loadingMessage="Loading vault metrics..."
      emptyProps={{
        title: "No Metrics Available",
        description: "Deposit funds to view yield telemetry.",
        kind: "no-data"
      }}
    >
      <MetricsGrid data={data} />
    </StateWrapper>
  );
}
```

### Props

| Name | Type | Default | Description |
|---|---|---|---|
| `isLoading` | `boolean` | `false` | When true, renders `LoadingState` or `loadingFallback`. |
| `isError` | `boolean` | `false` | When true, renders `ErrorState` or `errorFallback`. |
| `isEmpty` | `boolean` | `false` | When true, renders `EmptyState` or `emptyFallback`. |
| `error` | `Error \| string \| null` | `undefined` | Error object or error string for `ErrorState`. |
| `onRetry` | `() => void` | `undefined` | Retry callback triggered on error state action click. |
| `loadingMessage` | `string` | `"Loading..."` | Custom loading message text. |
| `loadingFallback` | `ReactNode` | `undefined` | Complete custom JSX override for loading state (e.g. `DashboardCardSkeleton`). |
| `errorFallback` | `ReactNode` | `undefined` | Complete custom JSX override for error state. |
| `emptyFallback` | `ReactNode` | `undefined` | Complete custom JSX override for empty state. |

---

## 2. `LoadingState`

`LoadingState` provides a standardized spinner and message for section-level or full-page loading indicators.

```tsx
import { LoadingState } from "@/components/ui";

// Section loader
<LoadingState message="Calculating projected yields..." size="md" />

// Full-page loader
<LoadingState message="Connecting to Stellar network..." size="full" />
```

---

## 3. `ErrorState`

`ErrorState` renders accessible error notices with tone styling (`error`, `warning`, `info`), retry triggers, and optional expandable detail blocks.

```tsx
import { ErrorState } from "@/components/ui";

<ErrorState
  title="RPC Node Timeout"
  description="Could not reach Horizon RPC endpoint. Please retry."
  tone="error"
  onRetry={() => refetch()}
  showDetailsToggle={true}
  error={error}
/>
```

---

## 4. `EmptyState`

`EmptyState` displays standardized empty state messages when lists, tables, or search filters yield no data.

```tsx
import { EmptyState } from "@/components/ui";

<EmptyState
  kind="no-results"
  title="No Transactions Found"
  description="No deposit or withdrawal records match the selected filter."
  action={{
    label: "Reset Filters",
    onClick: handleResetFilters
  }}
/>
```

---

## Accessibility Guidelines

1. **Screen Readers**:
   - Loading states use `role="status"` and `aria-live="polite"` with `aria-busy="true"`.
   - Error states use `role="alert"` and `aria-live="assertive"`.
   - Decorative icons inside state containers set `aria-hidden="true"`.
2. **Focus Management**:
   - Interactive retry buttons have clear, descriptive labels and contrast meeting WCAG AA standards.
