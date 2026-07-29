# Accessibility Testing Guide - Issue #993

## Overview
This guide provides comprehensive testing procedures for accessibility compliance across YieldVault-RWA core flows. All testing should be performed against WCAG 2.1 AA standards.

---

## 1. Automated Testing

### Running Accessibility Tests
```bash
cd frontend
npm run test -- --run src/tests/accessibility.test.tsx
```

**Expected Results**: All tests pass with zero violations reported by axe-core.

### Test Coverage
- ✅ Skip-link presence and functionality
- ✅ Button accessible names
- ✅ Form label associations
- ✅ Modal ARIA attributes (role, modal, labelledby, describedby)
- ✅ Tabs keyboard navigation and ARIA roles
- ✅ Data table captions and header scopes
- ✅ Pagination accessible labels
- ✅ Alert roles on banners
- ✅ Progress bar ARIA attributes
- ✅ Color contrast ratios (dark/light themes, tertiary text)
- ✅ Keyboard focus styles
- ✅ Accordion aria-expanded and aria-controls
- ✅ Disabled button states with sufficient contrast
- ✅ Badge color variants contrast
- ✅ Tabs inactive tab contrast
- ✅ Health status indicator tooltip readability
- ✅ Breadcrumbs font size and contrast
- ✅ Small text + tertiary color combinations
- ✅ Focus visibility on interactive elements
- ✅ Error state text contrast

---

## 2. Manual Testing - Keyboard Navigation

### 2.1 Home/Dashboard Flow
**Test Path**: Home → Vault Selection → Tabs (Deposit/Withdraw)

**Keyboard Sequence**:
1. Open `/` (home page)
2. Press `Tab` to move through all interactive elements in order:
   - Skip link should be first (but off-screen)
   - Navigation bar (logo, nav links, connect wallet)
   - Vault selection cards
   - Deposit/Withdraw tabs
   - Action buttons
3. Press `Shift+Tab` to navigate backwards
4. Press `Enter`/`Space` on buttons to activate
5. Press `Escape` to close any opened modals

**Expected Results**:
- ✅ Tab order is logical and left-to-right
- ✅ No keyboard traps
- ✅ All interactive elements receive focus
- ✅ Focus outline is clearly visible (cyan 2px)
- ✅ Skip link is accessible when first focused
- ✅ Modals can be closed with Escape key

### 2.2 Portfolio/Dashboard Flow
**Test Path**: Portfolio → Charts → Holdings Table

**Keyboard Sequence**:
1. Navigate to `/portfolio`
2. Tab through:
   - Chart controls (if interactive)
   - Holdings data table
   - Pagination controls
   - Sorting header buttons
3. Use `Arrow` keys within table for cell navigation (if implemented)

**Expected Results**:
- ✅ Table headers are keyboard accessible
- ✅ Sorting buttons respond to Enter/Space
- ✅ Pagination controls are keyboard accessible
- ✅ Chart interactions (if any) are keyboard accessible

### 2.3 Transaction History Flow
**Test Path**: Transaction History → Filters → Pagination → Detail View

**Keyboard Sequence**:
1. Navigate to transaction history page
2. Tab through:
   - Filter panel buttons/selects
   - Sort buttons on table headers
   - Table rows (if selectable)
   - Pagination buttons
3. Open transaction detail drawer with Enter/Space
4. Close drawer with Escape

**Expected Results**:
- ✅ All filter controls are accessible
- ✅ Sort buttons work with keyboard
- ✅ Pagination works without mouse
- ✅ Detail drawer can be opened/closed with keyboard

### 2.4 Settings Flow
**Test Path**: Settings → Language & Theme Toggles

**Keyboard Sequence**:
1. Navigate to `/settings`
2. Tab to language switcher, activate with Space/Enter
3. Tab to theme toggle, activate with Space/Enter
4. Verify settings persist

**Expected Results**:
- ✅ All toggles are keyboard accessible
- ✅ State changes are announced to screen readers
- ✅ Settings persist after keyboard interaction

### 2.5 Modal/Dialog Interactions
**Test Path**: Any modal (Session Expiration, Confirmations, etc.)

**Keyboard Sequence**:
1. Trigger a modal (e.g., attempt transaction that needs confirmation)
2. Tab within modal - should stay within modal (focus trap)
3. Tab to close button, press Enter
4. Verify focus returns to triggering element
5. Open modal again, press Escape
6. Verify modal closes and focus is restored

**Expected Results**:
- ✅ Focus cannot escape modal
- ✅ Escape key closes modal
- ✅ Close button works with Enter/Space
- ✅ Focus is properly restored after modal closes

---

## 3. Manual Testing - Color Contrast

### 3.1 Using Browser DevTools
1. Open any YieldVault page
2. Right-click on text element → Inspect
3. In DevTools, use the color picker to check contrast
4. Look for contrast ratio indicator (usually shown when hovering over colors)

### 3.2 Using WCAG Color Contrast Checker
**Tool**: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

**Test Cases**:
1. **Primary Text on Main Background**
   - Dark: `#ffffff` on `#0a0b10` 
   - Expected: ≥ 4.5:1 ✅

2. **Secondary Text on Main Background**
   - Dark: `#a8b8cc` on `#0a0b10`
   - Expected: ≥ 4.5:1 ✅

3. **Tertiary Text on Main Background**
   - Dark: `#8494a7` on `#0a0b10`
   - Expected: ≥ 4.5:1 ✅

4. **Disabled Button Text**
   - Dark: `rgba(255, 255, 255, 0.7)` on `rgba(100, 116, 139, 0.6)`
   - Expected: ≥ 4.5:1 ✅

5. **Badge Colors** (new)
   - Cyan: `var(--accent-cyan)` on `rgba(2, 132, 199, 0.15)`
   - Purple: `#d8b4fe` on light background
   - Success: `#86efac` on background
   - Warning: `#fcd34d` on background
   - Error: `#fca5a5` on background
   - All expected: ≥ 4.5:1 ✅

6. **Breadcrumb Text**
   - `var(--text-secondary)` on page background
   - Expected: ≥ 4.5:1 ✅

7. **Health Status Indicator Tooltip**
   - Text: `var(--text-primary)` / `var(--text-secondary)` on surface
   - Expected: ≥ 4.5:1 ✅

8. **Tabs - Active vs Inactive**
   - Active: `var(--text-primary)` on active background
   - Inactive: `var(--text-secondary)` on transparent/muted
   - Expected: ≥ 4.5:1 ✅

9. **Light Theme Equivalents** (test on `[data-theme="light"]`)
   - Primary: `#0f172a` on `#f8fafc`
   - Secondary: `#40505f` on `#f8fafc`
   - Tertiary: `#5a6a7d` on `#f8fafc`
   - All expected: ≥ 4.5:1 ✅

### 3.3 Browser Extension Testing
**Tool**: [axe DevTools](https://www.deque.com/axe/devtools/)

**Steps**:
1. Install axe DevTools extension
2. Open any YieldVault page
3. Run axe scan
4. Filter for "Contrast" issues
5. Expected: 0 issues found ✅

---

## 4. Screen Reader Testing

### 4.1 macOS Safari VoiceOver (Built-in)

**Enable VoiceOver**:
- Go to System Preferences → Accessibility → VoiceOver
- Enable VoiceOver
- Use `Caps Lock` as modifier key (or `Ctrl+Option`)

**Test Cases**:

#### Home Page
1. Press `Caps Lock + U` to open rotor
2. Navigate to headings:
   - Expected: "Portfolio Heading Level 1"
   - Expected: "Select a Vault Heading Level 2"
3. Navigate to buttons:
   - Verify button names are announced (e.g., "Deposit Tab selected", "Withdraw Tab")
4. Press `Caps Lock + Right Arrow` to read page content in order
   - Verify skip link is first interactive element

#### Portfolio Page
1. Navigate to table with rotor (Caps Lock + U)
2. VoiceOver should announce:
   - "Table with caption: Holdings"
   - Table column headers with `scope="col"`
   - Row data with proper cell associations
3. Tab through and verify:
   - Column sort buttons announce sortability
   - Pagination buttons announce current page and navigation

#### Transaction History
1. Navigate to data table
2. Expected announcements:
   - Table caption: "Transaction history"
   - Column headers with proper scope
   - Row numbers for each transaction
3. Test pagination:
   - "Page 1 of 5, Previous page button disabled"
   - "Next page button"

#### Settings Page
1. Navigate language selector
   - Expected: "Language Switcher Popup Button" or similar
   - Verify options are announced when opened
2. Navigate theme toggle
   - Expected: "Toggle switch" or "Dark mode toggle"
   - Verify state is announced (e.g., "checked" / "unchecked")

#### Modal/Dialog
1. Trigger a modal
2. Expected VoiceOver will:
   - Announce modal title (if present with ID matching aria-labelledby)
   - Announce modal description (if present with ID matching aria-describedby)
   - Read role="dialog" and aria-modal="true"
3. Tab through modal content
4. Press Escape to close
5. Expected: Focus should return to triggering element

### 4.2 Testing Keyboard Shortcuts with Screen Reader
1. Open Command Palette: `Ctrl+K` (Windows/Linux) or `Cmd+K` (Mac)
2. With VoiceOver enabled, verify:
   - Search box is announced
   - Results are read as they appear
   - Arrow keys navigate results
   - Enter selects result

### 4.3 NVDA Testing (Windows/Linux)
**Similar tests to VoiceOver**:
1. Enable NVDA screen reader
2. Use Insert key + keyboard shortcuts to navigate
3. Run same tests as above

---

## 5. Text Scaling & Zoom Testing

### 5.1 Browser Text Size Adjustment
**Chrome/Edge/Firefox**: Settings → Zoom

1. Set zoom to **125%**
   - Verify layout doesn't break
   - All text remains readable
   - No horizontal scrolling (ideally)
   - Buttons remain 44×44px or larger

2. Set zoom to **150%**
   - Same verification as 125%
   - Columns may stack on wider screens (acceptable)

3. Set zoom to **200%**
   - Verify usability is maintained
   - Focus indicators remain visible
   - Interactive elements are still clickable

### 5.2 OS-Level Text Scaling (macOS)
1. System Preferences → Accessibility → Display
2. Increase text size to maximum
3. Test YieldVault application
4. Verify:
   - Custom fonts scale appropriately
   - Layout adjusts gracefully
   - No text cutoff

### 5.3 Mobile Browser Zoom
1. Open on iOS/Android device
2. Pinch to zoom in/out
3. Verify:
   - Content remains readable
   - Interactive elements remain accessible
   - No horizontal scrolling at normal zoom levels

---

## 6. High Contrast Mode Testing

### 6.1 Windows High Contrast Mode
1. Settings → Ease of Access → Display
2. Enable "High Contrast" mode
3. Test YieldVault:
   - Verify all UI elements remain visible
   - Focus indicators should be extra prominent
   - Cyan accent should maintain contrast

### 6.2 Browser High Contrast Emulation
**Chrome DevTools**:
1. Right-click → Inspect
2. Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows) → "Emulate CSS media feature prefers-contrast"
3. Verify:
   - All text remains readable
   - Interactive elements are clearly visible
   - No content is hidden

---

## 7. Color Blindness Simulation

### 7.1 Using Accessibility Insights
**Tool**: Microsoft Accessibility Insights browser extension

1. Install extension
2. Click extension icon → "View issues"
3. Look for color-only dependency issues
4. Navigate page and verify:
   - Color is NOT the only way to convey information
   - Status indicators use icons + color + text
   - Charts have legends and labels

### 7.2 Manual Color Blindness Testing
**Simulate**: Protanopia (Red-Blind), Deuteranopia (Green-Blind), Tritanopia (Blue-Yellow-Blind)

**Tool**: [Coblis Color Blindness Simulator](https://www.color-blindness.com/coblis-color-blindness-simulator/)

**Test Cases**:
1. Status indicators (Healthy, Degraded, Unhealthy)
   - Expected: Visible differences beyond color alone
2. Alert banners (Warning, Error, Success)
   - Expected: Icon + text + color used for distinction
3. Badge colors
   - Expected: Text labels make status clear regardless of color

---

## 8. Reduced Motion Testing

### 8.1 Enable Reduced Motion (macOS)
1. System Preferences → Accessibility → Display
2. Enable "Reduce motion"
3. Test YieldVault:
   - Animations should be minimal or non-existent
   - Transitions should be instant or very quick
   - All functionality remains intact

### 8.2 Enable Reduced Motion (Windows)
1. Settings → Ease of Access → Display
2. Enable "Show animations"
3. Turn OFF animations (same effect)
4. Test application

### 8.3 Browser Emulation
**Chrome DevTools**:
1. Cmd+Shift+P (Mac) → "Emulate CSS media feature prefers-reduced-motion"
2. Verify animations are disabled

---

## 9. Mobile Accessibility Testing

### 9.1 Touch Target Size
Use a ruler or browser DevTools to verify:
- All buttons: minimum 44×44px ✅
- Link text within paragraphs: sufficient spacing
- Form inputs: minimum 44px height ✅

### 9.2 Mobile Screen Reader (iOS VoiceOver)
1. Enable VoiceOver: Settings → Accessibility → VoiceOver
2. Swipe right to move forward, swipe left to move backward
3. Double-tap to activate
4. Test same flows as desktop (Home, Portfolio, etc.)

### 9.3 Mobile Screen Reader (Android TalkBack)
1. Enable TalkBack: Settings → Accessibility → TalkBack
2. Swipe down then right for next item
3. Double-tap to activate
4. Test core flows

### 9.4 Responsive Design
Test at breakpoints:
- **Mobile**: 375px width (iPhone SE)
- **Tablet**: 768px width (iPad)
- **Desktop**: 1200px+ width

Expected: All accessibility features work at each breakpoint

---

## 10. Form Accessibility Testing

### 10.1 Label Association
1. Inspect form inputs with DevTools
2. Verify each input has:
   - Associated `<label>` element
   - Label has `for` attribute matching input `id`
   - Screen reader announces label when input is focused

### 10.2 Error Messages
1. Submit form with errors
2. Verify:
   - Error message is associated with input (`aria-describedby`)
   - Error text has sufficient contrast (≥ 4.5:1)
   - Error is announced to screen reader
   - Error icon is not the only visual indicator

### 10.3 Required Fields
1. Check form inputs
2. Verify:
   - Required fields have `required` attribute or `aria-required="true"`
   - Label indicates required (text + asterisk or icon)
   - Screen reader announces requirement

---

## 11. Chart Accessibility Testing

### 11.1 Chart Data Accessibility
For charts (APY Trend, Yield Breakdown, Vault Performance):
1. Inspect chart components
2. Verify:
   - Chart has accessible title/caption
   - Chart data is available in table format
   - Tooltip data is keyboard accessible
   - Color is not the only way to distinguish data

### 11.2 Manual Verification
1. Look for alternative text representation
2. Check if data table is provided
3. Verify legend is keyboard accessible

---

## 12. Documentation Testing

### 12.1 Accessibility Attributes Documentation
Verify documentation exists for:
- [ ] `aria-label` usage patterns
- [ ] `aria-labelledby` patterns
- [ ] `aria-describedby` patterns
- [ ] `role=` attribute guidelines
- [ ] Focus management strategies

### 12.2 Component Guidelines
Verify documentation for:
- [ ] Required ARIA attributes per component
- [ ] Expected keyboard interactions
- [ ] Color contrast requirements
- [ ] Font size requirements

---

## 13. Testing Checklist

### Pre-Test Checklist
- [ ] Browser is up-to-date
- [ ] Screen reader is enabled (if testing with screen reader)
- [ ] Browser extensions don't interfere
- [ ] Test environment is clean (clear cache if needed)

### Dark Theme Testing
- [ ] Primary text contrast ✅ (4.5:1+)
- [ ] Secondary text contrast ✅ (4.5:1+)
- [ ] Interactive elements visible ✅
- [ ] Focus indicators visible ✅
- [ ] Disabled states visible ✅

### Light Theme Testing  
- [ ] Primary text contrast ✅ (4.5:1+)
- [ ] Secondary text contrast ✅ (4.5:1+)
- [ ] Interactive elements visible ✅
- [ ] Focus indicators visible ✅
- [ ] Disabled states visible ✅

### Keyboard Navigation Checklist
- [ ] Tab order is logical ✅
- [ ] No keyboard traps ✅
- [ ] All interactive elements focused ✅
- [ ] Focus visible on all elements ✅
- [ ] Escape closes modals ✅
- [ ] Enter/Space activates buttons ✅

### Screen Reader Checklist
- [ ] Page structure announced correctly ✅
- [ ] Headings hierarchy is proper ✅
- [ ] Links have descriptive text ✅
- [ ] Buttons have accessible names ✅
- [ ] Form labels associated ✅
- [ ] Tables have captions ✅
- [ ] Alerts/live regions announced ✅

---

## 14. Bug Reporting Template

When reporting accessibility issues, use this template:

```
**Title**: [Component] Accessibility Issue - [Specific Problem]

**Environment**:
- Browser: [e.g., Chrome 120]
- Screen Reader: [e.g., Safari VoiceOver / NVDA]
- Theme: [Dark/Light]
- Page: [e.g., /portfolio]

**Issue**:
[Describe what fails WCAG 2.1 AA requirement]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected**:
[What should happen per WCAG 2.1 AA]

**Actual**:
[What currently happens]

**Severity**: [Critical/High/Medium/Low]

**WCAG Criteria**: [e.g., 1.4.3 Contrast (Minimum)]
```

---

## 15. Continuous Testing

### Automated Testing (CI/CD)
Run before every commit:
```bash
npm run test -- src/tests/accessibility.test.tsx --run
```

### Monthly Manual Audit
- [ ] Full keyboard navigation test (all flows)
- [ ] Screen reader verification (Safari VoiceOver + NVDA)
- [ ] Color contrast verification (all components)
- [ ] Responsive design testing (mobile/tablet/desktop)
- [ ] High contrast mode testing
- [ ] Reduced motion testing

### Quarterly Accessibility Review
- [ ] Full WCAG 2.1 AA audit
- [ ] External accessibility audit (optional)
- [ ] Update guidelines if needed
- [ ] Review and close accessibility issues

---

## 16. Resources & Tools

### Automated Testing
- [axe-core](https://github.com/dequelabs/axe-core) - Integrated in tests
- [axe DevTools](https://www.deque.com/axe/devtools/) - Browser extension
- [WebAIM](https://webaim.org/) - Accessibility resources
- [WCAG 2.1 Guideline](https://www.w3.org/WAI/WCAG21/quickref/)

### Manual Testing
- [WAVE Browser Extension](https://wave.webaim.org/extension/) - Visual feedback
- [WCAG Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Accessibility Insights](https://accessibilityinsights.io/) - Microsoft tool
- [Color Blindness Simulator](https://www.color-blindness.com/coblis-color-blindness-simulator/)

### Screen Readers
- macOS: Safari VoiceOver (built-in)
- Windows: NVDA (free), JAWS (commercial)
- Linux: Orca (free)
- Mobile: iOS VoiceOver, Android TalkBack

### Documentation
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Articles](https://webaim.org/articles/)

---

## 17. Quick Reference - Common Issues & Fixes

| Issue | WCAG | Fix |
|-------|------|-----|
| Low contrast text | 1.4.3 | Increase luminance difference |
| Missing alt text | 1.1.1 | Add descriptive alt attribute |
| Form label missing | 1.3.1 | Associate label with input |
| No focus indicator | 2.4.7 | Add `:focus-visible` style |
| Keyboard trap | 2.1.2 | Ensure Tab can exit |
| Unclear button text | 2.4.3 | Use descriptive button labels |
| Color only | 1.4.1 | Add text/icon/pattern in addition |
| Not resizable | 1.4.4 | Allow text resizing/zoom |
| Animation autoplays | 2.2.2 | Add pause/stop controls |
| Unclear link purpose | 2.4.4 | Make link text descriptive |

---

## Completion Tracking

- [ ] All automated tests passing (0 violations)
- [ ] Keyboard navigation verified on all flows
- [ ] Screen reader testing completed (macOS + at least one other)
- [ ] Color contrast verified (all components, both themes)
- [ ] Mobile accessibility tested
- [ ] Reduced motion respected
- [ ] High contrast mode tested
- [ ] Text scaling tested (125%, 150%, 200%)
- [ ] Documentation updated
- [ ] Issues resolved and documented
