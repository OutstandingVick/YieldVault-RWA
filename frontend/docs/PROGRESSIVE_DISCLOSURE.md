# Progressive Disclosure in Deposit/Withdraw Forms

## Overview

This document describes the progressive disclosure improvements made to the deposit and withdraw forms in the YieldVault RWA application. Progressive disclosure is a UX pattern that shows users only the information they need when they need it, reducing cognitive load and improving form completion rates.

## Key Improvements

### 1. Conditional Fee Breakdown Display

**Before:** Fee breakdown was always visible, even when no amount was entered.

**After:** Fee breakdown only appears when a valid amount is entered, with a smooth fade-in animation.

**Benefits:**
- Reduces visual clutter on initial form load
- Draws user attention to fees only when relevant
- Provides positive feedback that amount validation passed

**Implementation:**
```tsx
{isValidAmount && (
  <div className="glass-panel animate-in fade-in duration-300">
    <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
      <Check size={14} color="var(--accent-cyan)" />
      <span>Transaction Preview</span>
    </div>
    {/* Fee details... */}
  </div>
)}
```

### 2. Early Approval Warning

**Before:** Users only learned about the required USDC approval step when they reached the review screen.

**After:** An approval warning appears on the amount step as soon as a valid deposit amount is entered.

**Benefits:**
- Sets user expectations earlier in the flow
- Reduces surprise and potential abandonment at review step
- Provides context about the two-step process upfront

**Visual Indicator:**
- Orange warning panel with AlertCircle icon
- Clear messaging: "You'll need to approve USDC spending before depositing"

### 3. Estimated Shares Display (Deposits)

**Before:** Only net amount was shown.

**After:** Estimated vault shares (yvUSDC) the user will receive are displayed in the fee breakdown.

**Benefits:**
- Helps users understand what they're getting
- Provides transparency about share price
- Aids in decision-making

### 4. Collapsible Advanced Settings (Withdrawals)

**Before:** Slippage settings were always visible on the review step.

**After:** Slippage settings are in a collapsible `<details>` element labeled "Advanced Settings" with an "Optional" badge.

**Benefits:**
- Simplifies the interface for users who don't need to customize slippage
- Reduces form height and scrolling
- Advanced users can still easily access settings
- Progressive disclosure principle: show simple by default, complexity on demand

**Implementation:**
```tsx
<details className="glass-panel animate-in fade-in duration-300">
  <summary>
    <span>⚙️</span>
    Advanced Settings
    <span>Optional</span>
  </summary>
  <div>
    {/* Slippage controls... */}
  </div>
</details>
```

### 5. Visual Vault Capacity Indicator

**Before:** Capacity warnings were text-only at the top of the form.

**After:** Visual progress bar appears when vault is ≥70% full, showing utilization percentage with color coding.

**Benefits:**
- Immediate visual understanding of vault status
- Color-coded (cyan → orange → red) for different urgency levels
- Integrates naturally with the form flow
- Only appears when relevant

**Color Coding:**
- **70-89% full:** Orange warning (can still deposit)
- **90-100% full:** Red error (deposits may be limited)
- **100% full:** Deposits disabled with explicit message

### 6. Field Validation Visual Feedback

**Before:** Only error states were visually distinct.

**After:** Valid amount fields show a green checkmark animation.

**Benefits:**
- Positive reinforcement for correct input
- Clear indication that validation passed
- Reduces uncertainty about form state

**CSS Implementation:**
```css
.input-wrapper.input-valid::after {
  content: '✓';
  color: #22c55e;
  animation: scaleIn 0.3s ease-out;
}
```

### 7. Enhanced Animations

**New animation classes:**
- `.animate-in` - General fade-in
- `.fade-in` - Opacity transition
- `.slide-in` - Horizontal slide with fade
- `.duration-200` / `.duration-300` - Timing control

**Benefits:**
- Smooth transitions draw attention appropriately
- Reduce jarring appearance of conditional elements
- Professional, polished feel

## User Flow Examples

### Deposit Flow with Progressive Disclosure

1. **Initial state:** Clean form with amount input, balance display, and MAX button
2. **User enters amount:**
   - Checkmark appears on valid input
   - Fee breakdown fades in
   - Approval warning appears (if needed)
   - Capacity indicator shows (if vault ≥70% full)
3. **User clicks "Review Transaction":**
   - Moves to review step with full transaction summary
   - Two-step approval indicator (if needed)
   - High fee warnings (if applicable)
4. **User confirms:** Transaction executes
5. **Result screen:** Success/error feedback

### Withdraw Flow with Progressive Disclosure

1. **Initial state:** Clean form with amount input and balance display
2. **User enters amount:**
   - Checkmark appears on valid input
   - Fee breakdown fades in
   - "Advanced Settings" toggle appears (collapsed)
3. **User optionally expands advanced settings:**
   - Slippage controls revealed
   - Minimum received calculation shown
4. **User clicks "Review Transaction":**
   - Moves to review step with summary
   - Advanced settings section on review (if customized)
5. **User confirms:** Transaction executes
6. **Result screen:** Success/error feedback

## Accessibility Considerations

All progressive disclosure elements maintain proper accessibility:

- **ARIA roles:** `role="alert"` for errors, `role="status"` for status messages
- **Focus management:** No focus traps in collapsible sections
- **Keyboard navigation:** `<details>` elements fully keyboard accessible
- **Screen readers:** Announcements for dynamic content changes
- **Color independence:** Not relying solely on color for meaning (icons + text)

## Testing

### Unit Tests
- Form validation schemas (existing tests cover validation logic)
- Field-level validation feedback

### E2E Tests
New test cases added in `deposit-withdraw.spec.ts`:
- `progressive disclosure: fee breakdown appears when amount is valid`
- `progressive disclosure: approval warning appears for deposits needing approval`
- `progressive disclosure: advanced settings are collapsible on withdraw`
- `progressive disclosure: vault capacity indicator shows when near capacity`

### Manual Testing Checklist
- [ ] Fee breakdown only shows with valid amount
- [ ] Approval warning appears early for deposits
- [ ] Estimated shares calculation is accurate
- [ ] Advanced settings collapse/expand smoothly
- [ ] Vault capacity bar updates correctly
- [ ] Checkmark appears/disappears appropriately
- [ ] All animations are smooth (no jank)
- [ ] Works with screen reader
- [ ] Works with keyboard only
- [ ] Works on mobile devices

## Performance Considerations

- **Animations:** CSS-based for GPU acceleration
- **Conditional rendering:** React's virtual DOM efficiently handles show/hide
- **No layout shift:** Elements reserve space or use absolute positioning
- **Debouncing:** Amount validation is debounced to avoid excessive re-renders

## Future Enhancements

Potential areas for further progressive disclosure improvements:

1. **First-time user tooltips:** Step-by-step guide for new users
2. **Transaction time estimates:** Show expected time to completion
3. **Gas price recommendations:** Dynamic fee suggestions
4. **Success probability indicator:** Based on current network conditions
5. **Batch transaction preview:** For users making multiple deposits
6. **Historical context:** "You last deposited X days ago"

## Related Documentation

- [Form Validation Patterns](./FORM_VALIDATION.md)
- [Component Library](./COMPONENTS.md)
- [Accessibility Guidelines](./ACCESSIBILITY.md)
- [Animation Standards](./ANIMATIONS.md)
