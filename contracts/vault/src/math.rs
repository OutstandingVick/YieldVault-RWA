//! Vault share conversion math with deterministic rounding policy.
//!
//! # Rounding Policy
//!
//! This module enforces a **round-down** (truncation) policy for all share conversions:
//!
//! 1. **Assets → Shares (Minting)**: Always rounds DOWN
//!    - Formula: `shares = (assets × total_shares) / total_assets`
//!    - Rationale: Prevents over-minting shares, protecting existing shareholders
//!    - Effect: User may receive slightly fewer shares than the exact fractional amount
//!
//! 2. **Shares → Assets (Burning)**: Always rounds DOWN
//!    - Formula: `assets = (shares × total_assets) / total_shares`
//!    - Rationale: Prevents over-withdrawal of assets, protecting vault solvency
//!    - Effect: User may receive slightly fewer assets than the exact fractional amount
//!
//! # Safety Guarantees
//!
//! The round-down policy ensures:
//! - No user can mint more shares than their assets entitle them to
//! - No user can redeem more assets than their shares entitle them to
//! - Total supply and vault accounting remain internally consistent
//! - Round-trip conversions (assets → shares → assets) never increase value
//! - The vault is always solvent (total_assets ≥ sum of all redemption claims)
//!
//! # Edge Cases
//!
//! - **Zero supply**: First depositor receives shares equal to assets (1:1 ratio)
//! - **Tiny deposits**: May round to zero shares; caller must check and reject
//! - **Tiny withdrawals**: May round to zero assets; generally acceptable
//! - **Maximum values**: All operations use checked arithmetic to prevent overflow
//!
//! # Determinism
//!
//! All conversions are deterministic and platform-independent:
//! - Uses only integer arithmetic (no floating point)
//! - Division always truncates toward zero (Rust's default for positive integers)
//! - No platform-specific rounding modes or precision issues
//! - Identical results across all nodes, environments, and execution contexts

/// Converts assets to shares using the current vault state.
///
/// # Rounding
/// Always rounds DOWN (truncates). This prevents over-minting shares.
///
/// # Returns
/// The number of shares that should be minted for the given asset amount.
/// May return 0 if the asset amount is too small relative to the current share price.
///
/// # Panics
/// Panics on arithmetic overflow (checked operations).
pub fn assets_to_shares(assets: i128, total_shares: i128, total_assets: i128) -> i128 {
    // Bootstrap case: first deposit gets 1:1 ratio
    if total_assets == 0 || total_shares == 0 {
        return assets;
    }

    // Standard conversion: shares = (assets × total_shares) / total_assets
    // Integer division truncates (rounds down) automatically
    assets
        .checked_mul(total_shares)
        .expect("overflow in assets_to_shares multiplication")
        .checked_div(total_assets)
        .expect("division by zero in assets_to_shares")
}

/// Converts shares to assets using the current vault state.
///
/// # Rounding
/// Always rounds DOWN (truncates). This prevents over-withdrawal of assets.
///
/// # Returns
/// The number of assets that should be returned for the given share amount.
/// May return 0 if the share amount is too small relative to the current share price.
///
/// # Panics
/// Panics on arithmetic overflow (checked operations).
pub fn shares_to_assets(shares: i128, total_shares: i128, total_assets: i128) -> i128 {
    // Edge case: no shares exist (should not happen in practice after initialization)
    if total_shares == 0 {
        return 0;
    }

    // Standard conversion: assets = (shares × total_assets) / total_shares
    // Integer division truncates (rounds down) automatically
    shares
        .checked_mul(total_assets)
        .expect("overflow in shares_to_assets multiplication")
        .checked_div(total_shares)
        .expect("division by zero in shares_to_assets")
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── Bootstrap / Zero-State Tests ─────────────────────────────────────────

    #[test]
    fn test_first_deposit_one_to_one() {
        // First deposit: zero total_shares and zero total_assets
        let shares = assets_to_shares(1000, 0, 0);
        assert_eq!(shares, 1000, "first deposit should get 1:1 ratio");
    }

    #[test]
    fn test_shares_to_assets_zero_supply() {
        // Edge case: no shares exist
        let assets = shares_to_assets(100, 0, 1000);
        assert_eq!(assets, 0, "zero share supply should return zero assets");
    }

    // ── Rounding Direction Tests ─────────────────────────────────────────────

    #[test]
    fn test_assets_to_shares_rounds_down() {
        // Vault state: 1000 shares, 1500 assets (share price = 1.5)
        // Deposit 100 assets: exact calculation = 100 × 1000 / 1500 = 66.666...
        // Should round DOWN to 66
        let shares = assets_to_shares(100, 1000, 1500);
        assert_eq!(shares, 66, "should round down to 66 shares");
    }

    #[test]
    fn test_shares_to_assets_rounds_down() {
        // Vault state: 1000 shares, 1500 assets (share price = 1.5)
        // Redeem 100 shares: exact calculation = 100 × 1500 / 1000 = 150
        let assets = shares_to_assets(100, 1000, 1500);
        assert_eq!(assets, 150, "exact division should return 150");

        // Redeem 99 shares: exact calculation = 99 × 1500 / 1000 = 148.5
        // Should round DOWN to 148
        let assets = shares_to_assets(99, 1000, 1500);
        assert_eq!(assets, 148, "should round down to 148 assets");
    }

    #[test]
    fn test_tiny_deposit_rounds_to_zero() {
        // Vault state: 1000 shares, 1_000_000 assets (share price = 1000)
        // Deposit 1 asset: exact calculation = 1 × 1000 / 1_000_000 = 0.001
        // Should round DOWN to 0
        let shares = assets_to_shares(1, 1000, 1_000_000);
        assert_eq!(shares, 0, "tiny deposit should round to zero shares");
    }

    #[test]
    fn test_tiny_withdrawal_rounds_to_zero() {
        // Vault state: 1_000_000 shares, 1000 assets (share price = 0.001)
        // Redeem 1 share: exact calculation = 1 × 1000 / 1_000_000 = 0.001
        // Should round DOWN to 0
        let assets = shares_to_assets(1, 1_000_000, 1000);
        assert_eq!(assets, 0, "tiny withdrawal should round to zero assets");
    }

    // ── Round-Trip Consistency Tests ─────────────────────────────────────────

    #[test]
    fn test_round_trip_never_increases_value() {
        // Vault state: 1000 shares, 1500 assets
        let original_assets = 300;

        // Convert assets → shares → assets
        let shares = assets_to_shares(original_assets, 1000, 1500);
        let recovered_assets = shares_to_assets(shares, 1000 + shares, 1500 + original_assets);

        assert!(
            recovered_assets <= original_assets,
            "round-trip should never increase value: {} > {}",
            recovered_assets,
            original_assets
        );
    }

    #[test]
    fn test_round_trip_loss_bounded() {
        // Vault state: 1000 shares, 1500 assets
        let original_assets = 300;

        let shares = assets_to_shares(original_assets, 1000, 1500);
        let recovered_assets = shares_to_assets(shares, 1000 + shares, 1500 + original_assets);

        let loss = original_assets - recovered_assets;
        assert!(
            loss <= 2,
            "round-trip loss should be minimal (at most 2 units): loss = {}",
            loss
        );
    }

    // ── Monotonicity Tests ───────────────────────────────────────────────────

    #[test]
    fn test_more_assets_yields_more_shares() {
        // Vault state: 1000 shares, 1500 assets
        let shares_100 = assets_to_shares(100, 1000, 1500);
        let shares_200 = assets_to_shares(200, 1000, 1500);

        assert!(
            shares_200 >= shares_100,
            "more assets should yield at least as many shares"
        );
    }

    #[test]
    fn test_more_shares_yields_more_assets() {
        // Vault state: 1000 shares, 1500 assets
        let assets_100 = shares_to_assets(100, 1000, 1500);
        let assets_200 = shares_to_assets(200, 1000, 1500);

        assert!(
            assets_200 >= assets_100,
            "more shares should yield at least as many assets"
        );
    }

    // ── Yield Accrual Tests ──────────────────────────────────────────────────

    #[test]
    fn test_yield_increases_share_value() {
        // Initial state: 1000 shares, 1000 assets (share price = 1.0)
        let assets_before = shares_to_assets(100, 1000, 1000);

        // After yield: 1000 shares, 1500 assets (share price = 1.5)
        let assets_after = shares_to_assets(100, 1000, 1500);

        assert!(
            assets_after > assets_before,
            "yield should increase redemption value: {} <= {}",
            assets_after,
            assets_before
        );
    }

    #[test]
    fn test_yield_decreases_shares_per_asset() {
        // Initial state: 1000 shares, 1000 assets (share price = 1.0)
        let shares_before = assets_to_shares(100, 1000, 1000);

        // After yield: 1000 shares, 1500 assets (share price = 1.5)
        let shares_after = assets_to_shares(100, 1000, 1500);

        assert!(
            shares_after < shares_before,
            "yield should decrease shares minted per asset: {} >= {}",
            shares_after,
            shares_before
        );
    }

    // ── Symmetry Tests ───────────────────────────────────────────────────────

    #[test]
    fn test_full_redemption_symmetry() {
        // User deposits 1000 assets into empty vault
        let deposit = 1000;
        let shares = assets_to_shares(deposit, 0, 0);
        assert_eq!(shares, deposit, "first deposit should be 1:1");

        // User immediately redeems all shares
        let redeemed = shares_to_assets(shares, shares, deposit);
        assert_eq!(
            redeemed, deposit,
            "full redemption should return all assets"
        );
    }

    #[test]
    fn test_proportional_redemption() {
        // Vault state: 1000 shares, 2000 assets
        // User owns 500 shares (50% of supply)
        let user_shares = 500;
        let total_shares = 1000;
        let total_assets = 2000;

        let redeemed = shares_to_assets(user_shares, total_shares, total_assets);

        // User should get exactly 50% of assets (1000)
        assert_eq!(
            redeemed, 1000,
            "50% of shares should redeem for 50% of assets"
        );
    }

    // ── Edge Case Tests ──────────────────────────────────────────────────────

    #[test]
    fn test_single_stroop_deposit() {
        // Vault state: 1 share, 1 asset
        let shares = assets_to_shares(1, 1, 1);
        assert_eq!(shares, 1, "1:1 ratio should mint 1 share for 1 asset");
    }

    #[test]
    fn test_maximum_value_handling() {
        // Test with large but safe values (avoid overflow in multiplication)
        let large_value = 1_000_000_000_000i128; // 1 trillion
        let shares = assets_to_shares(large_value, 1, 1);
        assert_eq!(shares, large_value, "large values should work correctly");
    }

    #[test]
    #[should_panic(expected = "overflow")]
    fn test_overflow_protection_assets_to_shares() {
        // This should panic due to overflow in multiplication
        let _ = assets_to_shares(i128::MAX, i128::MAX, 1);
    }

    #[test]
    #[should_panic(expected = "overflow")]
    fn test_overflow_protection_shares_to_assets() {
        // This should panic due to overflow in multiplication
        let _ = shares_to_assets(i128::MAX, 1, i128::MAX);
    }
}
