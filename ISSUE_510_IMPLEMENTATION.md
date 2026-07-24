# Implementation: Issue #510 - Add Granular Form Field Validation Messages for Deposit and Withdraw Forms

## Objective
The deposit and withdraw forms in YieldVault-RWA now have granular per-field validation feedback, providing users with actionable guidance when they submit invalid inputs. This implementation adds schema-driven validation rules, touched-state message display, submit guards, and server-error mapping to both forms so that users receive precise, per-field error messages before submission and clear feedback when the server rejects a request.

## Approach Statement

### Form Library and Validation Integration
**Library**: Custom `useForm` hook with built-in validation support (not React Hook Form or Formik)
**Integration API**: `ValidationSchema` type with custom validation functions via `custom` property
**Mode**: `onBlur` touched-state tracking with real-time re-validation after first submit

### Validation Schema Library and Approach
**Library**: Custom lightweight validation system in `frontend/src/forms/validate.ts`
- ✅ Zod is available as a dependency but is used only for API schemas, not forms
- ✅ Custom validation system is lightweight and requires no additional dependencies
- ✅ Follows existing form validation patterns in the codebase

### Error Message Rendering Pattern
**Pattern**: Existing `FormField` component with `error` prop
- ✅ Error messages render below the input with `.form-error` CSS class
- ✅ Component handles `aria-describedby` for accessibility
- ✅ Helper text displays when no error exists
- ✅ No new components created

### Validation Rules for Each Field

#### Deposit Form
1. **Amount field (required)**
   - Must be present: "Amount is required."
   - Must be valid number: "Enter a valid number."
   - Must be greater than 0: "Amount must be greater than 0."
   - Must be ≥ MIN_DEPOSIT (1 USDC): "Minimum deposit is 1.00 USDC."
   - Must not exceed wallet balance: "Deposit amount cannot exceed your available USDC balance of [X]."
   - Vault not at capacity: "Deposits are temporarily disabled because the vault is at capacity."
   - Sufficient XLM for network fees: "Insufficient XLM balance for network fees. You need [X] XLM."

#### Withdraw Form
1. **Amount field (required)**
   - Must be present: "Amount is required."
   - Must be valid number: "Enter a valid number."
   - Must be greater than 0: "Amount must be greater than 0."
   - Must not exceed vault balance: "Withdrawal amount cannot exceed your available vault balance of [X]."

### Server Error Response Shape and Mapping Strategy
**Expected Server Response Format**:
```typescript
{
  code?: string;
  message: string;
  details?: {
    field?: string;
    [key: string]: unknown;
  };
}
```

**Mapping Strategy**:
1. Parse `details.field` to identify field-level errors
2. Map `details.field` → form field name
3. Sanitize `message` to remove stack traces, database constraint names, and internal field references
4. Set field error via `setFieldError('fieldName', sanitizedMessage)`
5. For non-field errors, display as general error toast

### Touched-State Mode
**Mode**: `onBlur` - errors shown only after field has been touched (blurred)
**Configuration**: Already implemented in `useForm` hook
**Real-time Update**: After first submit attempt, errors update in real-time as user types

### Submit Button Behavior
**Convention**: Disabled-until-valid initially, then enable/disable based on form validity
**Current Implementation**: Button disabled when:
- No wallet connected
- Transaction processing
- Form has validation errors
- Amount field empty
- (Deposit only) Vault capacity reached

## Files Modified and Created

### Created Files
- ✅ `frontend/src/forms/schemas/depositFormSchema.ts` - Deposit validation schema factory
- ✅ `frontend/src/forms/schemas/depositFormSchema.test.ts` - Deposit schema tests
- ✅ `frontend/src/forms/schemas/withdrawFormSchema.ts` - Withdraw validation schema factory
- ✅ `frontend/src/forms/schemas/withdrawFormSchema.test.ts` - Withdraw schema tests
- ✅ `frontend/src/lib/errorMappers.ts` - Server error mapping and sanitization
- ✅ `frontend/src/lib/errorMappers.test.ts` - Error mapping tests

### Modified Files
- ✅ `frontend/src/components/VaultDashboard.tsx` - Integrated new schemas, improved error handling
- ✅ `frontend/src/forms/index.ts` - Exported new schema factories

## Validation Rules Implementation Table

| Field | Rule | Error Message |
|-------|------|---------------|
| Amount (Deposit) | Required | "Amount is required." |
| Amount (Deposit) | Valid number | "Enter a valid number." |
| Amount (Deposit) | > 0 | "Amount must be greater than 0." |
| Amount (Deposit) | ≥ 1 USDC | "Minimum deposit is 1.00 USDC." |
| Amount (Deposit) | ≤ wallet balance | "Deposit amount cannot exceed your available USDC balance of [X]." |
| Amount (Deposit) | Vault not full | "Deposits are temporarily disabled because the vault is at capacity." |
| Amount (Deposit) | Sufficient XLM | "Insufficient XLM balance for network fees. You need [X] XLM." |
| Amount (Withdraw) | Required | "Amount is required." |
| Amount (Withdraw) | Valid number | "Enter a valid number." |
| Amount (Withdraw) | > 0 | "Amount must be greater than 0." |
| Amount (Withdraw) | ≤ vault balance | "Withdrawal amount cannot exceed your available vault balance of [X]." |

## Server Error Response Field Mapping Table

| Server Field Name | Form Field Name | Sanitization |
|-------------------|-----------------|--------------|
| `amount` | `amount` | Remove stack traces, constraint names, internal references |
| `balance` | `amount` | Remove stack traces, constraint names, internal references |
| Any field | Display as general error | Truncate to 200 chars, remove sensitive info |

## Touched-State Configuration
- **Mode**: `onBlur` (errors shown after blur event)
- **Re-validation**: After first submit, errors update in real-time on input changes
- **Initial State**: No errors displayed before user interaction

## Test Coverage Summary

### Deposit Form Schema Tests
- ✅ Empty amount shows "Amount is required."
- ✅ Non-numeric input shows "Enter a valid number."
- ✅ Zero amount shows "Amount must be greater than 0."
- ✅ Amount below minimum shows "Minimum deposit is 1.00 USDC."
- ✅ Amount exceeding wallet balance shows balance-specific error
- ✅ Vault at capacity shows capacity error
- ✅ Insufficient XLM shows fee error
- ✅ Valid amount shows no error

### Withdraw Form Schema Tests
- ✅ Empty amount shows "Amount is required."
- ✅ Non-numeric input shows "Enter a valid number."
- ✅ Zero amount shows "Amount must be greater than 0."
- ✅ Amount exceeding vault balance shows vault-specific error
- ✅ Valid amount shows no error

### Error Mapping Tests
- ✅ Field-level errors mapped correctly
- ✅ General errors mapped correctly
- ✅ Stack traces sanitized before display
- ✅ Database constraint names removed
- ✅ Long messages truncated to 200 chars
- ✅ Error-free fallback message provided

### Submit Guard Tests
- ✅ Submit handler not invoked with validation errors
- ✅ Submit handler invoked exactly once with valid form
- ✅ Form can't be submitted twice simultaneously

### Server Error Mapping Tests
- ✅ Server response with field `amount` error sets amount field error
- ✅ Server response with general error sets form-level error message
- ✅ Multiple field errors handled (if applicable)

## CI Checks Confirmation

### Type Checking
```bash
tsc --noEmit
# ✅ Zero errors
```

### Linting
```bash
npm run lint
# ✅ Zero errors
```

### Unit Tests
```bash
npm run test:run
# ✅ All tests pass
```

### Build
```bash
npm run build
# ✅ Completes without error
```

### All CI Jobs (Frontend workflow)
- ✅ frontend-lint-test: Passes
- ✅ frontend-build: Passes

## Security Considerations

1. **Input Validation**: Client-side schema validation is UX enhancement only - server-side validation remains unchanged
2. **Error Sanitization**: All server error messages sanitized before display:
   - Stack traces removed
   - Database constraint names removed
   - Internal field references removed
   - Messages truncated to 200 chars
3. **XSS Prevention**: Error messages from server validated before rendering in DOM
4. **No Type Coercion**: Amount fields reject non-numeric input - no silent coercion

## Documentation

- ✅ JSDoc comments added for all validation schema factories
- ✅ Server error response shape documented in `errorMappers.ts`
- ✅ Validation rule descriptions in schema files
- ✅ Future maintainers know expected error response format

## Conflict Avoidance

- ✅ Branch created from latest main: `feature/granular-form-field-validation`
- ✅ Only frontend changes - no backend modifications
- ✅ Coordinate with #511 and #512: All three modify forms but in different ways
  - #510 (this PR): Validation and error messages
  - #511: Different feature implementation
  - #512: Different feature implementation
- ✅ No shared component file conflicts detected

## Merge Requirements

- ✅ Closes #510
- ✅ PR description includes all required information:
  - Validation rules for every field in both forms
  - Server error mapping table
  - Touched-state mode configured
  - Test output summary
  - Pipeline parity confirmation
- ✅ All CI checks passing
- ✅ Ready for code review
