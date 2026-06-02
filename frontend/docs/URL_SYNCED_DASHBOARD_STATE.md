# URL-Synced Dashboard State Implementation

## Overview

The dashboard state is now fully synchronized with the URL query parameters, enabling:
- **Shareable URLs**: Users can copy and share dashboard state (tab, step, amount)
- **Browser navigation**: Back/forward buttons restore previous dashboard states
- **Deep linking**: External links can pre-populate the dashboard with specific values
- **Session persistence**: Refreshing the page restores the exact dashboard state

## Architecture

### Hook: `useDashboardUrlState`

Located in `src/hooks/useDashboardUrlState.ts`, this hook manages all dashboard state in the URL.

**State Properties:**
- `tab`: `"deposit" | "withdraw"` - Active transaction tab
- `step`: `"amount" | "review" | "result"` - Current wizard step
- `amount`: `string` - Transaction amount (empty string if not set)

**API:**

```typescript
const dashboardUrl = useDashboardUrlState();

// Read state
dashboardUrl.state.tab;      // "deposit" | "withdraw"
dashboardUrl.state.step;     // "amount" | "review" | "result"
dashboardUrl.state.amount;   // string

// Update individual properties
dashboardUrl.setTab("withdraw");
dashboardUrl.setStep("review");
dashboardUrl.setAmount("100.50");

// Update multiple properties at once
dashboardUrl.setState({
  tab: "withdraw",
  step: "review",
  amount: "50",
});

// Reset to defaults
dashboardUrl.reset();
```

## Integration with VaultDashboard

The `VaultDashboard` component has been refactored to use `useDashboardUrlState`:

### Before
```typescript
const [activeTab, setActiveTab] = useState<TransactionTab>("deposit");
const [currentStep, setCurrentStep] = useState<TransactionStep>("amount");
```

### After
```typescript
const dashboardUrl = useDashboardUrlState();

// Access state
dashboardUrl.state.tab;    // replaces activeTab
dashboardUrl.state.step;   // replaces currentStep

// Update state
dashboardUrl.setTab("withdraw");    // replaces setActiveTab()
dashboardUrl.setStep("review");     // replaces setCurrentStep()
```

## URL Format

Dashboard state is encoded in query parameters:

```
/dashboard?tab=deposit&step=amount&amount=100.50
/dashboard?tab=withdraw&step=review
/dashboard?tab=deposit&step=result
```

**Query Parameters:**
- `tab`: Transaction type (default: `"deposit"`)
- `step`: Wizard step (default: `"amount"`)
- `amount`: Transaction amount (default: empty, omitted from URL)

## Use Cases

### 1. Shareable URLs
Users can copy the current URL to share their dashboard state:
```
https://yieldvault.example.com/dashboard?tab=withdraw&step=review&amount=500
```

### 2. Deep Linking
External applications can link directly to a pre-populated state:
```
https://yieldvault.example.com/dashboard?tab=deposit&amount=1000
```

### 3. Browser Navigation
- **Back button**: Returns to previous dashboard state
- **Forward button**: Restores next dashboard state
- **Refresh**: Maintains current dashboard state

### 4. Session Recovery
If the page is accidentally closed or refreshed, the exact dashboard state is restored from the URL.

## Testing

Unit tests are provided in `src/hooks/useDashboardUrlState.test.ts`:

```bash
npm test -- useDashboardUrlState.test.ts
```

**Test Coverage:**
- Default state initialization
- Individual property updates
- Batch state updates
- State reset
- Empty amount handling

## Migration Notes

### For Developers

If you need to access dashboard state in other components:

```typescript
import { useDashboardUrlState } from "../hooks/useDashboardUrlState";

function MyComponent() {
  const dashboardUrl = useDashboardUrlState();
  
  // Read state
  if (dashboardUrl.state.tab === "deposit") {
    // ...
  }
  
  // Update state
  dashboardUrl.setTab("withdraw");
}
```

### For Component Props

If passing dashboard state to child components, prefer passing the hook result:

```typescript
<TransactionForm dashboardUrl={dashboardUrl} />
```

Rather than individual props:

```typescript
// Avoid this pattern
<TransactionForm tab={dashboardUrl.state.tab} setTab={dashboardUrl.setTab} />
```

## Performance Considerations

- **Memoization**: State is memoized using `useMemo` to prevent unnecessary re-renders
- **Shallow routing**: URL updates use React Router's default shallow routing (no full page reload)
- **Debouncing**: Consider debouncing rapid state changes if needed (not currently implemented)

## Future Enhancements

1. **Debounced updates**: Batch rapid state changes to reduce URL updates
2. **State validation**: Validate URL parameters on load
3. **Analytics**: Track state transitions for user behavior analysis
4. **Undo/Redo**: Implement history stack for dashboard state
5. **Preset URLs**: Create shareable preset configurations

## Troubleshooting

### State not persisting after refresh
- Verify browser allows query parameters in URL
- Check that React Router is properly configured
- Ensure `useDashboardUrlState` is called at the component level

### Back button not working
- Verify `setSearchParams` is being called (not `replace: true`)
- Check browser history settings
- Ensure no other code is clearing the URL

### Amount not clearing
- Use `setAmount("")` to clear the amount
- Or use `setState({ amount: "" })` for batch updates
- The URL will omit the `amount` parameter when empty
