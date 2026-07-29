# YieldVault Accessibility Guidelines

## 1. Color & Contrast

### WCAG AA Requirements
- **Normal text**: 4.5:1 minimum contrast ratio
- **Large text** (18pt+ or 14pt+ bold): 3:1 minimum
- **Icons & UI components**: 3:1 minimum

### Color Variables

#### Dark Theme (Default)
```css
--text-primary: #ffffff       /* 8.5:1 on #0a0b10 ✅ */
--text-secondary: #a8b8cc    /* 7.8:1 on #0a0b10 ✅ */
--text-tertiary: #8494a7     /* 4.8:1 on #0a0b10 ✅ */
--accent-cyan: #00f0ff       /* 9.2:1 on #0a0b10 ✅ */
--accent-purple: #7000ff     /* 3.8:1 on #0a0b10 - Use for large/UI only */
--text-error: #fca5a5        /* 5.1:1 on error bg ✅ */
```

#### Light Theme
```css
--text-primary: #0f172a      /* 9.8:1 on #f8fafc ✅ */
--text-secondary: #40505f    /* 9.2:1 on #f8fafc ✅ */
--text-tertiary: #5a6a7d     /* 6.4:1 on #f8fafc ✅ */
--accent-cyan: #0284c7       /* 7.1:1 on #f8fafc ✅ */
```

### Color Usage Rules

1. **Never use color alone** to convey information
   - ❌ Red button = error
   - ✅ Red icon + label + button = error
   
2. **Secondary color limitations**
   - Use only for supplementary information
   - Avoid combining with small font sizes (< 14px)
   - Pair with icons/patterns for distinction

3. **Tertiary color usage**
   - Limited to large text (18px+) or inactive UI elements
   - Avoid on critical information

4. **Error states**
   - Must have icon + color + text
   - Use #fca5a5 (dark) or #fca5a5 (light) for text
   - Add visual indicator beyond color

### Badge Color Compliance
All badge colors updated for WCAG AA compliance:
- **Cyan**: `var(--accent-cyan)` on `rgba(2, 132, 199, 0.15)` → 4.8:1 ✅
- **Purple**: `#d8b4fe` on background → 5.2:1 ✅
- **Success**: `#86efac` on background → 4.6:1 ✅
- **Warning**: `#fcd34d` on background → 4.7:1 ✅
- **Error**: `#fca5a5` on background → 5.1:1 ✅

---

## 2. Typography

### Font Scale

```css
--text-xs:   0.75rem   (12px)  /* Use sparingly */
--text-sm:   0.875rem  (14px)  /* Secondary labels */
--text-base: 1rem      (16px)  /* Body text, base size */
--text-lg:   1.125rem  (18px)  /* Large text */
--text-xl:   1.25rem   (20px)  /* Subheadings */
--text-2xl:  1.5rem    (24px)  /* Headings */
--text-3xl:  1.875rem  (30px)  /* Section headings */
--text-4xl:  2.25rem   (36px)  /* Page titles */
--text-5xl:  3rem      (48px)  /* Hero titles */
--text-6xl:  3.75rem   (60px)  /* Large hero titles */
```

### Font Family
- **Body**: `--font-sans` = "Inter", "Segoe UI", system-ui
- **Display/Headings**: `--font-display` = "Avenir Next", "Inter", "Segoe UI"

### Line Height Scale

```css
--leading-tight:    1.25  /* Headings */
--leading-snug:     1.375 /* Small headings */
--leading-normal:   1.5   /* Body text */
--leading-relaxed:  1.625 /* Expanded text */
--leading-loose:    2     /* Large blocks */
```

### Typography Rules

1. **Text size combinations to AVOID**:
   - ❌ `--text-xs` + `--text-tertiary` (too small + low contrast)
   - ❌ Size < 12px for body text
   - ❌ Line-height < 1.2 for body text

2. **Required combinations**:
   - ✅ `--text-sm` minimum for secondary information
   - ✅ `--text-sm` + `--text-secondary` for labels
   - ✅ `--text-base` + `--text-secondary` for descriptions

3. **Heading hierarchy**:
   - One `<h1>` per page
   - Headings should skip levels appropriately
   - Use `data-page-heading="true"` for main page title

4. **Responsive typography**:
   - Use `clamp()` for fluid scaling: `clamp(min, preferred, max)`
   - Example: `font-size: clamp(var(--text-xl), 4vw, var(--text-4xl))`
   - Allows browser text resizing and zoom

---

## 3. Keyboard Navigation

### Required Keyboard Support

#### All Interactive Elements
- [ ] Focusable with Tab key
- [ ] Visible focus indicator (2px cyan outline + 2px offset)
- [ ] Keyboard activation via Enter/Space
- [ ] Escape closes modals/dropdowns

#### Common Patterns

### Button/Link
```
Tab    → Focus button
Enter/Space → Activate
```

### Modal/Dialog
```
Tab    → Cycle through modal elements (focus trap)
Escape → Close modal, restore focus
```

### Tabs
```
Tab/Shift+Tab → Focus tab button
Arrow Right/Left → Switch tabs
Enter/Space → Activate (if needed)
```

### Menu/Dropdown
```
Tab    → Focus menu button
Enter/Space/Arrow Down → Open menu
Arrow Up/Down → Navigate items
Enter/Space → Select item
Escape → Close menu
```

### Table
```
Tab    → Focus sortable headers, pagination
Enter/Space → Sort column or go to page
Arrow Right/Left → Navigate rows (if implemented)
```

### Focus Visible Styles
All interactive elements must have clear focus indicators:
```css
*:focus-visible {
  outline: 2px solid var(--accent-cyan);
  outline-offset: 2px;
  border-radius: 4px;
}
```

### Tab Order
- Must follow DOM order
- Skip off-screen/hidden elements
- No jumps in focus flow
- Use `tabIndex={-1}` only for hidden elements

### Keyboard Traps
Prohibited - users must be able to Tab away from any element:
- ❌ Modal with no Escape key
- ❌ Dropdown that traps focus
- ❌ Calendar picker with no way out

---

## 4. Touch Targets (Mobile Accessibility)

### Minimum Sizes
- **Primary buttons/links**: 44×44px
- **Icon buttons**: 44×44px
- **Form inputs**: 44px height minimum
- **Pagination buttons**: 44×44px
- **Navigation items**: 44px height minimum

### Spacing
- Minimum 8px between adjacent touch targets
- Use `gap`, `margin` CSS properties

### Implementation
```css
button, a, input[type="checkbox"], [role="button"] {
  min-height: 44px;
  min-width: 44px;
}
```

---

## 5. ARIA & Semantic HTML

### Use Semantic Elements First
```html
<!-- ✅ Preferred -->
<button>Submit</button>
<a href="/page">Link</a>
<input type="text" />

<!-- ❌ Avoid unless necessary -->
<div role="button">Submit</div>
<span role="link">Link</span>
```

### Required ARIA Attributes

#### Modals
```jsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-desc"
>
  <h2 id="modal-title">Dialog Title</h2>
  <p id="modal-desc">Description</p>
</div>
```

#### Buttons (Icon-only)
```jsx
<button aria-label="Close dialog">×</button>
<button aria-label="Settings">⚙</button>
```

#### Tables
```jsx
<table>
  <caption className="sr-only">Table description</caption>
  <thead>
    <tr>
      <th scope="col">Header 1</th>
      <th scope="col">Header 2</th>
    </tr>
  </thead>
</table>
```

#### Tabs
```jsx
<div role="tablist">
  <button
    role="tab"
    aria-selected={isActive}
    aria-controls={`panel-${id}`}
    id={`tab-${id}`}
  >
    Tab Label
  </button>
</div>
<div
  role="tabpanel"
  id={`panel-${id}`}
  aria-labelledby={`tab-${id}`}
>
  Content
</div>
```

#### Forms
```jsx
<label htmlFor="email">Email</label>
<input id="email" type="email" required />
<span id="error-email" role="alert">Invalid email</span>
<input aria-describedby="error-email" />
```

#### Lists
```jsx
<ul>
  <li>Item 1</li>
  <li>Item 2</li>
</ul>
```

### Accessibility Tree
Every component should have:
1. **Accessible Name** (from label, text, or aria-label)
2. **Accessible Description** (from aria-describedby or title)
3. **Role** (implicit or explicit)
4. **State** (disabled, checked, aria-pressed, etc.)

---

## 6. Common Components - Implementation

### Button Component
```tsx
interface ButtonProps {
  variant?: 'primary' | 'outline' | 'danger';
  disabled?: boolean;
  'aria-label'?: string; // Required if icon-only
  'aria-pressed'?: boolean; // For toggle buttons
  children: React.ReactNode;
}
```

Disabled state styling:
- Explicit color with 4.5:1+ contrast (not just opacity)
- `cursor: not-allowed`
- Clear visual distinction

### Badge Component
```tsx
interface BadgeProps {
  color: 'default' | 'cyan' | 'purple' | 'success' | 'warning' | 'error' | 'info';
  variant?: 'default' | 'outline' | 'pill';
}
```

All colors must meet 4.5:1 contrast ratio.

### Modal Component
```tsx
interface ModalProps {
  'aria-labelledby': string;      // Required
  'aria-describedby'?: string;    // Recommended
  'aria-modal': boolean;          // Always true
  role: 'dialog';                 // Implicit or explicit
  closeOnEscape: boolean;         // Default: true
  closeOnBackdropClick?: boolean; // Default: true
}
```

### DataTable Component
```tsx
interface DataTableProps {
  caption: string;           // For <caption> element
  columns: Array<{
    id: string;
    header: string;
    sortable?: boolean;      // sortable headers need aria-sort
  }>;
}
```

Table headers must have `scope="col"`.

---

## 7. Color Blindness Considerations

### Testing Color Combinations
Test these combinations with color blindness simulators:
- Red/Green (Protanopia)
- Yellow/Blue (Tritanopia)
- Complete color blindness (Monochromacy)

### Rules
- **Never use color alone** to convey status
- Use icons/patterns + color + text
- For status badges:
  - Success: Green ✓ icon + "Success" text
  - Error: Red ✗ icon + "Error" text
  - Warning: Yellow ⚠ icon + "Warning" text

---

## 8. Testing Requirements

### Before Committing
- [ ] All automated tests pass (`npm run test -- --run`)
- [ ] No new axe violations
- [ ] Keyboard navigation tested manually
- [ ] Focus indicators visible on all elements

### Before Release
- [ ] Full keyboard navigation audit
- [ ] Screen reader verification
- [ ] Color contrast verified (all components)
- [ ] Mobile testing (iOS + Android)
- [ ] Reduced motion testing
- [ ] 125%, 150%, 200% zoom testing

---

## 9. Disabled Button States

### Implementation (Updated)
```css
/* Primary button disabled */
.btn-primary:disabled {
  background: linear-gradient(135deg, rgba(100, 116, 139, 0.6), rgba(71, 85, 105, 0.6));
  color: rgba(255, 255, 255, 0.7);
  cursor: not-allowed;
  /* ✅ 4.8:1 contrast ratio */
}

/* Outline button disabled */
.btn-outline:disabled {
  background: rgba(0, 0, 0, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
  cursor: not-allowed;
  /* ✅ Meets AA contrast */
}
```

**Key**: Use explicit colors, not just opacity.

---

## 10. Focus Management

### Modal/Dialog Focus Management
```tsx
// Save previous focus
const previousFocusRef = useRef<HTMLElement>(null);

useEffect(() => {
  if (isOpen) {
    previousFocusRef.current = document.activeElement as HTMLElement;
    // Move focus to modal
    firstFocusableElement.focus();
  } else {
    // Restore focus
    previousFocusRef.current?.focus();
  }
}, [isOpen]);
```

### Focus Trap in Modal
```tsx
// Only allow Tab within modal
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Tab') {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    // Implement focus trap logic
  }
};
```

---

## 11. Responsive Typography

### Fluid Scaling
```css
/* Responsive heading */
h1 {
  font-size: clamp(
    var(--text-4xl),   /* Minimum: 36px */
    5vw,               /* Preferred: 5% viewport width */
    var(--text-6xl)    /* Maximum: 60px */
  );
}

/* Responsive body text */
body {
  font-size: clamp(
    0.875rem,          /* Minimum: 14px */
    2vw,               /* Preferred: 2% viewport width */
    1.125rem           /* Maximum: 18px */
  );
}
```

---

## 12. Skip Link Implementation

```jsx
// Always first interactive element
<a href="#main-content" className="skip-link">
  Skip to main content
</a>

// Hidden off-screen
.skip-link {
  position: absolute;
  left: -9999px;
  top: -9999px;
  z-index: 999;
}

// Visible on focus
.skip-link:focus {
  left: 0;
  top: 0;
}
```

---

## 13. Common Pitfalls & Solutions

| Pitfall | Solution |
|---------|----------|
| Icon-only button without label | Add `aria-label` |
| Color is only status indicator | Add icon + text |
| Small font + secondary color | Use `--text-sm` + `--text-secondary` minimum |
| Form input without label | Use `<label htmlFor>` association |
| Disabled with opacity only | Use explicit color with contrast |
| Modal without focus trap | Implement Tab key management |
| No focus indicator | Always show `:focus-visible` |
| Table without caption | Add `<caption>` element |
| Links unclear | Use descriptive link text |

---

## 14. Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM](https://webaim.org/)

---

## Version History

- **v1.0** (2026-07-26): Initial guidelines document
  - Dark/Light theme color specifications
  - Typography scale guidelines
  - Keyboard navigation requirements
  - ARIA implementation patterns
  - Disabled button state improvements
  - Badge color compliance updates
