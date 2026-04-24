# Focus Management Pattern

This project uses a consistent focus management pattern so keyboard and screen reader users have predictable navigation.

## 1) Move focus to the page heading after route navigation

- Use `usePageHeadingFocus()` from `frontend/src/hooks/usePageHeadingFocus.ts`.
- Attach the returned ref to the page `h1`.
- Add `tabIndex={-1}` and `data-page-heading="true"` on the heading.

Example:

```tsx
const headingRef = usePageHeadingFocus<HTMLHeadingElement>();

<h1 ref={headingRef} tabIndex={-1} data-page-heading="true">
  Portfolio
</h1>
```

Why: keyboard users land in a predictable place and screen readers announce the new page context.

## 2) Preserve and restore focus for overlays

When opening a modal/dialog:

- Store the currently focused element (`document.activeElement`).
- Move focus into the modal container or first interactive control.
- Trap `Tab`/`Shift+Tab` inside the modal while open.
- Restore focus to the previously focused element when modal closes.

Why: users do not lose context when opening/closing overlays, and focus cannot move behind the active dialog.

## 3) Dialog semantics

All modals should include:

- `role="dialog"`
- `aria-modal="true"`
- `aria-labelledby` (required)
- `aria-describedby` (recommended when descriptive text exists)

## 4) Implementation checklist for feature teams

- [ ] Route destination has one primary `h1`.
- [ ] `h1` uses `usePageHeadingFocus` + `tabIndex={-1}`.
- [ ] Overlay captures and restores prior focus.
- [ ] Overlay traps keyboard focus while open.
- [ ] Overlay has correct ARIA dialog attributes.
- [ ] Keyboard-only test: navigate route, open/close overlay, verify focus order.
