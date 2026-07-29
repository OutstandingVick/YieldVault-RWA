# PR Description: UI/UX: Introduce consistent empty/loading/error state design system (#991)

## Summary
Resolves issue #991 by introducing a production-hardened, consistent Empty / Loading / Error State design system for YieldVault RWA.

This PR provides:
1. Standardized UI state components (`LoadingState`, `ErrorState`, `EmptyState`, `StateWrapper`).
2. Declarative state orchestration (`StateWrapper`) for handling state transitions (`isLoading` → `isError` → `isEmpty` → `children`).
3. Refactored backward-compatible `ViewState` delegate.
4. Comprehensive unit test suites covering rendering, tone variants, custom fallbacks, and accessibility attributes.
5. Complete design system documentation (`frontend/docs/STATE_DESIGN_SYSTEM.md`).

---

## Key Changes

### Component Design System Layer (`frontend/src/components/ui/`)
- **`LoadingState.tsx` & `LoadingState.css`**: Standardized loading spinner and message supporting sizes (`sm`, `md`, `lg`, `full`), custom fallback components (e.g. skeletons), and accessible `role="status"` / `aria-busy="true"` attributes.
- **`ErrorState.tsx` & `ErrorState.css`**: Accessible error notice component with tone styling (`error`, `warning`, `info`), actionable retry/secondary actions, expandable technical error detail view, and `role="alert"`.
- **`StateWrapper.tsx`**: Declarative state orchestrator component managing conditional rendering (`isLoading` → `isError` → `isEmpty` → `children`) cleanly.
- **`EmptyState.tsx` & `EmptyState.css`**: Enhanced with consistent styling, kind presets, and size support.
- **`ViewState.tsx`**: Updated to utilize `ErrorState` / `EmptyState` under the hood while maintaining 100% backward compatibility.
- **`index.ts`**: Re-exports `LoadingState`, `ErrorState`, `EmptyState`, and `StateWrapper`.

### Tests (`frontend/src/components/ui/`)
- **`LoadingState.test.tsx`**: Unit tests verifying message rendering, ARIA attributes, custom fallback rendering, and size classes.
- **`ErrorState.test.tsx`**: Unit tests verifying tone variants, retry action triggers, title/description rendering, and technical detail toggling.
- **`StateWrapper.test.tsx`**: Unit tests verifying state precedence (`loading` → `error` → `empty` → content) and custom fallback handlers.

### Documentation (`frontend/docs/`)
- **`STATE_DESIGN_SYSTEM.md`**: Complete design system guide covering usage examples, component APIs, accessibility standards, and state management best practices.

---

## Verification & Compliance
- [x] All state components adhere to project design tokens and dark mode glassmorphism theme.
- [x] WCAG AA compliance verified for color contrast and ARIA live regions.
- [x] Full backward compatibility maintained for existing components (`EmptyState`, `Skeleton`, `ErrorFallback`, `ViewState`).
- [x] Unit test suites added for all new UI state components.
