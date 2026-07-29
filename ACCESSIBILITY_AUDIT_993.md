# Accessibility Audit & Implementation Plan - Issue #993

## Executive Summary
This document outlines the findings from a comprehensive accessibility audit of YieldVault-RWA's UI/UX across core flows, with focus on WCAG 2.1 AA compliance for contrast and typography.

**Current Status**: Strong foundation with comprehensive ARIA implementation and axe-core testing. Identified specific gaps in contrast, typography consistency, and edge cases.

---

## 1. Audit Findings

### ✅ Existing Strengths
- **ARIA Implementation**: Comprehensive use of roles, labels, and attributes across components
- **Color Variables**: Well-defined dark/light theme tokens with documented contrast ratios
- **Keyboard Navigation**: Focus management, focus traps, skip links, keyboard shortcuts
- **Semantic HTML**: Proper heading hierarchy, table structure, form associations
- **Testing Foundation**: axe-core integration with 15+ test cases covering WCAG 2.1 AA

### ⚠️ Identified Issues

#### A. Contrast & Color Issues

1. **HealthStatusIndicator**: Tooltip text lacks sufficient contrast
   - Issue: `.6` opacity on `--text-secondary` over surface backgrounds
   - Severity: Medium
   - Fix: Increase base contrast or reduce opacity dependency

2. **Tabs Component**: Inactive tab contrast may fail in certain scenarios
   - Current: `var(--text-secondary)` on `var(--bg-muted)` with transparency
   - Issue: Semi-transparent backgrounds reduce effective contrast
   - Severity: Medium
   - Fix: Use solid background or adjust text color

3. **Badge Component (Info & Warning)**:
   - Info badge: `#3b82f6` on `rgba(59, 130, 246, 0.1)` - needs verification
   - Warning badge: `#f59e0b` on `rgba(245, 158, 11, 0.1)` - needs verification
   - Severity: Medium
   - Fix: Ensure 3:1 minimum for large text, 4.5:1 for normal

4. **Disabled Button States**:
   - Current: Uses opacity 0.5 on all disabled buttons
   - Issue: Poor contrast for users with cognitive disabilities
   - Severity: High
   - Fix: Add explicit contrast-compliant styling for disabled states

5. **Error States**:
   - Text: `#ff6b6b` vs Background: `rgba(255, 50, 50, 0.1)` (light theme: `#dc2626` vs `rgba(239, 68, 68, 0.1)`)
   - Issue: Light backgrounds + bright text may fail contrast
   - Severity: Medium
   - Fix: Verify and adjust error color palette

#### B. Typography Issues

1. **Inconsistent Font Sizes Across Themes**:
   - Dark theme body: `var(--text-base)` (16px)
   - Light theme body: Not explicitly set (defaults to base)
   - Issue: Line-height varies by context
   - Severity: Low
   - Fix: Ensure consistent sizing in light theme

2. **Small Text Contrast**:
   - `--text-xs` (12px) with `--text-tertiary` + small fonts used in several places
   - Issue: Combined small size + tertiary color reduces readability
   - Severity: Medium
   - Fix: Reduce use of `--text-xs` + `--text-tertiary` combination

3. **Missing Text Size Scaling**:
   - Some components use hardcoded pixel sizes
   - Issue: Doesn't respect user's `prefers-reduced-motion` and text scaling preferences
   - Severity: Low
   - Fix: Use CSS custom properties and `rem`-based units

4. **Breadcrumb Typography**:
   - Font size: `0.9rem` (hardcoded)
   - Color: `var(--text-secondary)`
   - Issue: Small size + secondary color = 14.4px at reduced contrast
   - Severity: Low
   - Fix: Use `var(--text-sm)` and verify contrast

5. **Modal/Dialog Title Font Size**:
   - No consistent sizing rule across modals
   - Issue: Some titles may be too small (varies by implementation)
   - Severity: Low
   - Fix: Define `--modal-title-size` and apply consistently

#### C. Focus & Keyboard Navigation

1. **Focus Styles on All Components**:
   - ✅ Most components have visible focus styles (2px cyan outline)
   - ⚠️ Some custom components (like HealthStatusIndicator button) may lack clear focus
   - Severity: Low
   - Fix: Add focus-visible to all interactive elements

2. **Modal Backdrop Interaction**:
   - ✅ Modal includes `closeOnEscape` and `closeOnBackdropClick`
   - ✅ Focus trap implemented
   - Status: Compliant

#### D. Missing Documentation

1. **Accessibility Guidelines Document**: Not present
   - Should document color contrast ranges, font sizing strategy, etc.
   - Severity: Low

2. **Component Accessibility Props**: Not documented
   - Should document available ARIA props for each component
   - Severity: Low

---

## 2. Implementation Tasks

### Phase 1: Critical Fixes (Contrast & Color)

#### Task 1.1: Fix Disabled Button Contrast
- **Files**: `frontend/src/index.css` (add `:disabled` styles)
- **Action**: Create explicit high-contrast disabled state
- **Before**: `opacity: 0.5` (variable contrast)
- **After**: Solid color with 4.5:1+ minimum contrast
- **Test**: Add test case for disabled button contrast

#### Task 1.2: Fix Badge Component Contrast
- **Files**: `frontend/src/components/Badge.tsx`
- **Action**: Verify all badge color combinations meet 3:1 (large) or 4.5:1 (normal) contrast
- **Severity**: Calculate contrast ratios for each variant + color combo
- **Test**: Add parametrized contrast tests for all badge combinations

#### Task 1.3: Fix HealthStatusIndicator Tooltip Contrast
- **Files**: `frontend/src/components/HealthStatusIndicator.tsx`
- **Action**: 
  - Remove opacity dependency on secondary text in tooltip
  - Use solid color or primary text color
  - Ensure status indicator dot is distinguishable from background
- **Test**: Add axe-core test for this component

#### Task 1.4: Fix Tabs Inactive State Contrast
- **Files**: `frontend/src/components/Tabs.css`, `frontend/src/components/Tabs.tsx`
- **Action**: 
  - Replace transparent tab background with solid color
  - Ensure inactive tab text meets 4.5:1 contrast
  - Consider using lighter opacity on solid background
- **Test**: Add contrast test for inactive tabs

#### Task 1.5: Fix Error State Colors
- **Files**: `frontend/src/index.css`
- **Action**: 
  - Calculate contrast for `--text-error` on `--bg-error`
  - Adjust colors if needed to meet 4.5:1
  - Update light theme error colors
- **Test**: Add error state contrast tests

### Phase 2: Typography & Readability

#### Task 2.1: Standardize Small Text Usage
- **Files**: `frontend/src/index.css`, component files using `--text-xs`
- **Action**: 
  - Replace unsafe `--text-xs` + `--text-tertiary` combinations
  - Use `--text-sm` + `--text-secondary` for minimum readability
  - Limit `--text-xs` to labels and helper text only
- **Test**: Add readability tests

#### Task 2.2: Fix Breadcrumb Typography
- **Files**: `frontend/src/components/PageHeader.tsx`
- **Action**: 
  - Change hardcoded `fontSize: "0.9rem"` to use CSS variable
  - Use `var(--text-sm)` instead
  - Verify contrast against background
- **Test**: Add breadcrumb accessibility test

#### Task 2.3: Ensure Consistent Modal Typography
- **Files**: `frontend/src/index.css`
- **Action**: 
  - Add modal-specific typography rules
  - Define `--modal-title-size: var(--text-2xl)`
  - Define `--modal-body-size: var(--text-base)`
- **Files affected**: All modal components
- **Test**: Add modal typography consistency test

#### Task 2.4: Add Text Scaling Support
- **Files**: `frontend/src/index.css`
- **Action**: 
  - Update body font-size to use `clamp()` for responsive scaling
  - Ensure heading sizes scale appropriately
  - Test with browser text scaling (125%, 150%)
- **Test**: Manual browser scaling test (document with screenshots)

### Phase 3: Focus & Keyboard Navigation

#### Task 3.1: Audit Focus Styles
- **Files**: All interactive components
- **Action**: 
  - Verify all interactive elements have `:focus-visible` styles
  - Ensure 2px cyan outline or equivalent
  - Check custom button/link components
- **Specific components**: HealthStatusIndicator, Badge (if interactive), custom buttons
- **Test**: Focus chain test with Tab key

#### Task 3.2: Test Keyboard Navigation in Core Flows
- **Test scenarios**:
  1. Home flow: Tab through vault selection
  2. Portfolio flow: Tab through buttons, charts, data table
  3. Transaction history: Tab through table, pagination, filters
  4. Settings: Tab through language/theme toggles
- **Test coverage**: Manual testing guide + automation where possible
- **Test**: Document keyboard navigation paths

### Phase 4: Testing & Documentation

#### Task 4.1: Expand axe-core Tests
- **Files**: `frontend/src/tests/accessibility.test.tsx`
- **Action**: 
  - Add tests for all badge color combinations
  - Add HealthStatusIndicator component test
  - Add Tabs component test
  - Add disabled button state test
  - Add error state test
- **Coverage**: Aim for 25+ test cases

#### Task 4.2: Add Manual Test Guide
- **Files**: Create `ACCESSIBILITY_TEST_GUIDE.md`
- **Content**:
  - Keyboard navigation paths for each page
  - Screen reader testing guide (NVDA, JAWS, Safari VoiceOver)
  - Color contrast verification checklist
  - Browser text scaling test (125%, 150%)
  - High contrast mode testing
  - Zoom level testing (200%)
- **Test**: Manual verification documented

#### Task 4.3: Create Accessibility Design System Documentation
- **Files**: Create `ACCESSIBILITY_GUIDELINES.md`
- **Content**:
  - Color usage guidelines (contrast thresholds)
  - Typography scale and sizing rules
  - Touch target sizing (minimum 44x44px)
  - Focus style conventions
  - ARIA usage patterns
  - Common pitfalls and solutions

#### Task 4.4: Update Main README
- **Files**: `frontend/README.md` (if exists) or main `README.md`
- **Action**: Add accessibility section with:
  - Current WCAG 2.1 AA compliance status
  - How to run accessibility tests
  - Links to accessibility guidelines
  - Contact info for accessibility issues

### Phase 5: CI/CD Integration

#### Task 5.1: Add Accessibility Check to CI Pipeline
- **Files**: Update GitHub Actions workflow (if desired)
- **Action**: 
  - Add `npm run test` to ensure accessibility tests pass
  - Optional: Add pre-commit hook for accessibility lint
- **Test**: Verify CI integration works

---

## 3. Verification Checklist

### Contrast & Color Verification
- [ ] All text meets 4.5:1 contrast (normal text)
- [ ] Large text (18pt+) meets 3:1 contrast
- [ ] Disabled buttons have explicit styling with sufficient contrast
- [ ] All badge variants pass contrast tests
- [ ] Error states meet contrast requirements
- [ ] Focus indicators meet contrast requirements

### Typography Verification
- [ ] Font sizes scale appropriately from 12px to 60px
- [ ] Line heights are between 1.2 and 2
- [ ] Small text (`--text-xs`) is used only for secondary labels
- [ ] Headings use consistent font-family (display)
- [ ] Body text uses sans-serif system font stack

### Keyboard & Focus Verification
- [ ] Tab key navigates through all interactive elements in logical order
- [ ] All interactive elements have visible focus styles
- [ ] Focus trap works in modals
- [ ] Escape key closes modals and dialogs
- [ ] No keyboard traps in core flows

### Accessibility Testing Verification
- [ ] axe-core tests pass with zero violations
- [ ] Skip-link test passes
- [ ] All ARIA attributes are valid and present
- [ ] Screen reader testing completed (at least Safari VoiceOver)
- [ ] Keyboard-only navigation verified for all pages

---

## 4. Core Flows to Test

1. **Home/Dashboard Flow**
   - Landing page → Vault selection → Deposit/Withdraw tabs
   - Test contrast, typography, tab navigation

2. **Portfolio Flow**
   - Portfolio dashboard → Charts → Holdings table
   - Test chart accessibility, table navigation, text scaling

3. **Transaction History Flow**
   - Transaction list → Sorting → Pagination → Transaction details
   - Test table contrast, button states, pagination labels

4. **Settings Flow**
   - Settings page → Language toggle → Theme toggle
   - Test toggle accessibility, label visibility

5. **Error/Warning Flows**
   - Session expiration → Error states → Recovery flows
   - Test error message contrast, alert roles, recovery paths

---

## 5. Testing Tools & Methods

### Automated Testing
- **axe-core**: WCAG 2.1 AA automated audit
- **jest/vitest**: Component-level tests
- **Playwright**: End-to-end keyboard navigation tests

### Manual Testing
- **Browser DevTools**: Inspect contrast using built-in tools
- **WCAG Color Contrast Checker**: Verify specific color combinations
- **Screen Readers**:
  - macOS: Safari VoiceOver (built-in)
  - Linux: NVDA
  - Windows: JAWS
- **Zoom/Text Scaling**: Test at 125%, 150%, 200%
- **High Contrast Mode**: Windows High Contrast testing
- **Mobile**: Test touch targets on iOS/Android

### Tools & Links
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe DevTools Browser Extension](https://www.deque.com/axe/devtools/)
- [Color.review](https://color.review/) - contrast checking

---

## 6. Acceptance Criteria (Issue #993)

- [x] Implementation completed (in progress)
- [ ] Tests added or updated (unit/integration/e2e)
- [ ] Relevant documentation updated
- [ ] CI checks pass with no regressions
- [ ] Manual accessibility testing completed and documented
- [ ] All identified contrast issues resolved
- [ ] All typography consistency issues resolved
- [ ] Keyboard navigation verified on all core flows
- [ ] Zero axe-core violations on all tested components

---

## 7. Timeline & Priority

### High Priority (Week 1)
- Task 1.1: Fix disabled button contrast
- Task 1.2: Fix badge contrast
- Task 1.3: Fix HealthStatusIndicator tooltip
- Task 4.1: Expand axe-core tests

### Medium Priority (Week 2)
- Task 1.4: Fix tabs contrast
- Task 1.5: Fix error state colors
- Task 2.1: Standardize small text
- Task 4.2: Add manual test guide

### Low Priority (Week 3)
- Task 2.2: Fix breadcrumb typography
- Task 2.3: Ensure modal typography
- Task 2.4: Add text scaling support
- Task 3.1: Audit focus styles
- Task 4.3: Create design guidelines
- Task 5.1: CI/CD integration

---

## 8. Related Issues & References

- **Issue #239**: Referenced in existing accessibility tests
- **WCAG 2.1 AA**: Target compliance standard
- **Existing test file**: `frontend/src/tests/accessibility.test.tsx` (450+ lines)
- **Color variables**: `frontend/src/index.css` (well-documented)

---

## Notes

- Current implementation has a strong foundation; issues are primarily refinement-level
- Team should prioritize high-contrast scenarios for users with color vision deficiency
- Recommend regular accessibility audits as part of sprint planning
- Consider appointing accessibility champion on team for ongoing compliance
