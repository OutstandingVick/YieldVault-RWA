# Deterministic Rounding Policy for Share Conversions

## Overview

YieldVault-RWA implements a **deterministic round-down policy** for all share conversions. This document describes the policy, its rationale, and its implications for users and integrators.

## Policy Statement

All conversions between assets and shares use **integer division with truncation (round-down)**:

1. **Assets → Shares (Minting)**: Always rounds DOWN
2. **Shares → Assets (Burning)**: Always rounds DOWN

This policy is enforced uniformly across all deposit, withdrawal, and calculation functions.

## Rationale

### Why Round Down?

The round-down policy provides critical safety guarantees:

1. **Prevents Over-Minting**: When converting assets to shares, rounding down ensures users never receive more shares than their assets entitle them to. This protects existing shareholders from dilution.

2. **Prevents Over-Withdrawal**: When converting shares to assets, rounding down ensures users never withdraw more assets than their shares entitle them to. This protects vault solvency.

3. **Maintains Invariants**: The vault maintains the invariant that `total_assets ≥ sum(all redemption claims)`. Round-down ensures this invariant is never violated.

4. **Prevents Value Extraction**: Round-trip conversions (deposit → withdraw) can never increase value due to rounding. Users may lose a tiny amount to rounding, but can never profit from it.

### Why Not Round Up?

Rounding up in either direction would create security vulnerabilities:

- **Rounding up on minting**: Users could receive more shares than their assets justify, diluting existing shareholders
- **Rounding up on burning**: Users could withdraw more assets than their shares justify, potentially draining the vault

### Why Not Banker's Rounding or Other Schemes?

Alternative rounding schemes (round-to-nearest, banker's rounding, etc.) introduce complexity and potential attack vectors:

- **Non-determinism**: Different implementations might round differently
- **Manipulation**: Attackers could craft inputs to exploit rounding in their favor
- **Complexity**: More complex rounding logic is harder to audit and verify

The round-down policy is simple, deterministic, and provably safe.

## Implementation

### Centralized Math Module

All conversion logic is centralized in `src/math.rs`:

```rust
pub fn assets_to_shares(assets: i128, total_shares: i128, total_assets: i128) -> i128
pub fn shares_to_assets(shares: i128, total_shares: i128, total_assets: i128) -> i128
```

These functions are used by:
- `calculate_shares()` - Public view function
- `calculate_assets()` - Public view function
- `deposit()` - Minting shares
- `withdraw()` - Burning shares
- `execute_withdrawal()` - Burning shares (timelock path)

### Conversion Formulas

#### Assets to Shares (Minting)

```
shares = (assets × total_shares) / total_assets
```

- **Bootstrap case**: If `total_assets == 0` or `total_shares == 0`, returns `assets` (1:1 ratio)
- **Standard case**: Integer division truncates (rounds down)
- **Example**: `(100 × 1000) / 1500 = 66.666... → 66`

#### Shares to Assets (Burning)

```
assets = (shares × total_assets) / total_shares
```

- **Edge case**: If `total_shares == 0`, returns `0`
- **Standard case**: Integer division truncates (rounds down)
- **Example**: `(99 × 1500) / 1000 = 148.5 → 148`

## User Impact

### Rounding Loss

Users may experience small rounding losses:

1. **On Deposit**: May receive slightly fewer shares than the exact fractional amount
2. **On Withdrawal**: May receive slightly fewer assets than the exact fractional amount
3. **Round-Trip**: Depositing then immediately withdrawing may return slightly less than deposited

### Magnitude of Loss

The maximum rounding loss per operation is **less than 1 unit** of the result:

- If you should receive 100.9 shares, you get 100 (loss of 0.9)
- If you should receive 100.1 shares, you get 100 (loss of 0.1)

For typical vault operations with reasonable share prices, this represents a negligible fraction of the total value.

### When Rounding Matters

Rounding becomes significant in two scenarios:

1. **Tiny Deposits After Yield**: If the vault has accrued significant yield, the share price increases. Very small deposits may round down to zero shares.
   - **Protection**: The contract rejects deposits that would mint zero shares
   - **Error**: Returns `VaultError::InvalidAmount`

2. **Tiny Withdrawals**: Very small share amounts may round down to zero assets.
   - **Behavior**: Withdrawal succeeds but returns zero assets
   - **Recommendation**: Users should avoid withdrawing dust amounts

## Safety Guarantees

The round-down policy ensures:

1. **No Over-Minting**: `shares_minted ≤ exact_fractional_shares`
2. **No Over-Withdrawal**: `assets_returned ≤ exact_fractional_assets`
3. **Solvency**: `total_assets ≥ sum(all_user_redemption_values)`
4. **No Value Extraction**: `withdraw(deposit(x)) ≤ x` for all x
5. **Monotonicity**: More assets → more shares, more shares → more assets
6. **Determinism**: Same inputs always produce same outputs

## Testing

The rounding policy is verified by:

1. **Unit Tests** (`src/math.rs`):
   - Rounding direction tests
   - Edge case tests (zero supply, tiny amounts)
   - Round-trip consistency tests
   - Monotonicity tests

2. **Property-Based Tests** (`src/fuzz_math.rs`):
   - 10,000+ iterations testing all input combinations
   - Overflow safety verification
   - Round-trip value extraction tests
   - Yield accrual impact tests

3. **libFuzzer Harness** (`fuzz/fuzz_targets/share_price_math.rs`):
   - Time-bounded `cargo fuzz` job in CI (60s on PR)
   - Seed corpus documented in `fuzz/seed_fixtures/` and `fuzz/corpus/share_price_math/`

4. **Integration Tests** (`src/test.rs`):
   - Multi-user deposit/withdrawal sequences
   - Share price consistency tests
   - Total supply invariant tests

Run all tests with:
```bash
cargo test
```

## Integration Guide

### For Frontend Developers

When displaying projected shares or assets:

```typescript
// Calculate projected shares (will round down)
const projectedShares = await vault.calculate_shares(depositAmount);

// Warn user if rounding to zero
if (projectedShares === 0n) {
  alert("Deposit amount too small - would mint zero shares");
}

// Show rounding loss
const exactShares = (depositAmount * totalShares) / totalAssets;
const roundingLoss = exactShares - projectedShares;
console.log(`Rounding loss: ${roundingLoss} shares`);
```

### For Smart Contract Integrators

When integrating with the vault:

```rust
// Always check for zero shares before depositing
let projected_shares = vault.calculate_shares(&amount);
if projected_shares == 0 {
    return Err(Error::DepositTooSmall);
}

// Deposit will succeed
let actual_shares = vault.deposit(&user, &amount)?;
assert_eq!(actual_shares, projected_shares);
```

### For Arbitrageurs

The round-down policy creates tiny inefficiencies that are **not exploitable**:

- Rounding always favors the vault (and existing shareholders)
- Round-trip operations always lose value
- No sequence of operations can extract value via rounding

## Edge Cases

### First Deposit (Bootstrap)

The first depositor receives shares equal to assets (1:1 ratio):

```
deposit(1000) → 1000 shares
```

This establishes the initial share price of 1.0.

### Zero Share Supply

If `total_shares == 0` (should not happen after initialization):

```
shares_to_assets(any_amount) → 0
```

### Maximum Values

The math module uses checked arithmetic to prevent overflow:

```rust
assets.checked_mul(total_shares).expect("overflow")
```

Extremely large values that would overflow will panic rather than wrap around.

### Dust Amounts

Very small amounts may round to zero:

```
// Vault state: 1000 shares, 1_000_000 assets (share price = 1000)
assets_to_shares(1) → 0 shares (rejected by deposit)
shares_to_assets(1) → 0 assets (withdrawal succeeds)
```

## Comparison with ERC-4626

The round-down policy aligns with [ERC-4626](https://eips.ethereum.org/EIPS/eip-4626) recommendations:

> "Finally, ERC-4626 Vault implementers should be aware of the need for specific, opposing rounding directions across the different mutable and view methods, as it is considered most secure to favor the Vault itself during calculations over its users."

Our implementation follows this guidance:
- Minting: Round down (favors vault)
- Burning: Round down (favors vault)
- View functions: Round down (consistent with mutable functions)

## Changelog

### Version 1.0.0 (Issue #563)
- Initial implementation of deterministic rounding policy
- Centralized conversion logic in `src/math.rs`
- Comprehensive test coverage
- Documentation of policy and rationale

## References

- [ERC-4626: Tokenized Vault Standard](https://eips.ethereum.org/EIPS/eip-4626)
- [Vault Math Security Best Practices](https://docs.openzeppelin.com/contracts/4.x/erc4626)
- [Integer Division in Rust](https://doc.rust-lang.org/book/ch03-02-data-types.html#integer-types)

## Contact

For questions or concerns about the rounding policy:
- Open an issue on GitHub
- Review the test suite in `src/math.rs` and `src/fuzz_math.rs`
- Consult the inline documentation in `src/math.rs`
