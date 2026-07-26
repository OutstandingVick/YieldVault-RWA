//! Safety checks for admitting withdrawals into the queue under thin liquidity.
//!
//! The queue is only as safe as the liquidity backing it: admitting a request
//! the vault cannot honour turns a queued withdrawal into a silent failure at
//! execution time. [`check_queue_admission`] is a pure guard evaluated *before*
//! a request is queued, so the caller is rejected with a typed error while the
//! vault state is still untouched.
//!
//! Edge cases explicitly covered:
//! - non-positive or overflowing request amounts,
//! - corrupt (negative) idle or queued balances,
//! - a request that fits idle liquidity but would eat the reserve buffer,
//! - a buffer configuration outside `0..=10_000` bps.

use crate::errors::VaultError;

/// Basis-point denominator.
pub const BPS_DENOMINATOR: i128 = 10_000;

/// Liquidity snapshot used to evaluate a queue admission.
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub struct QueueLiquidity {
    /// Assets held by the vault itself, not deployed into a strategy.
    pub idle_assets: i128,
    /// Assets already promised to earlier queued withdrawals.
    pub queued_assets: i128,
    /// Share of idle liquidity that must stay untouched, in basis points.
    pub buffer_bps: u32,
}

impl QueueLiquidity {
    /// Idle liquidity that must remain after all queued withdrawals settle.
    pub fn reserved(&self) -> Result<i128, VaultError> {
        self.idle_assets
            .checked_mul(self.buffer_bps as i128)
            .and_then(|v| v.checked_div(BPS_DENOMINATOR))
            .ok_or(VaultError::MathOverflow)
    }

    /// Idle liquidity actually available to back queued withdrawals.
    pub fn available(&self) -> Result<i128, VaultError> {
        let reserved = self.reserved()?;
        self.idle_assets
            .checked_sub(reserved)
            .ok_or(VaultError::MathOverflow)
    }
}

/// Validates that `request` can be admitted to the withdrawal queue.
///
/// Returns the resulting queued total on success.
///
/// # Errors
/// - [`VaultError::InvalidAmount`] — non-positive request or corrupt balances.
/// - [`VaultError::InvalidLiquidityBuffer`] — buffer outside `0..=10_000` bps.
/// - [`VaultError::MathOverflow`] — the queued total would overflow.
/// - [`VaultError::InsufficientLiquidity`] — the total exceeds idle liquidity.
/// - [`VaultError::LiquidityBufferNotMet`] — the total fits idle liquidity but
///   would draw down the reserve buffer.
pub fn check_queue_admission(state: &QueueLiquidity, request: i128) -> Result<i128, VaultError> {
    if request <= 0 {
        return Err(VaultError::InvalidAmount);
    }
    if state.idle_assets < 0 || state.queued_assets < 0 {
        return Err(VaultError::InvalidAmount);
    }
    if state.buffer_bps as i128 > BPS_DENOMINATOR {
        return Err(VaultError::InvalidLiquidityBuffer);
    }

    let queued_total = state
        .queued_assets
        .checked_add(request)
        .ok_or(VaultError::MathOverflow)?;

    if queued_total > state.idle_assets {
        return Err(VaultError::InsufficientLiquidity);
    }
    if queued_total > state.available()? {
        return Err(VaultError::LiquidityBufferNotMet);
    }

    Ok(queued_total)
}

/// Largest amount that can still be admitted to the queue right now.
///
/// Returns `0` when the queue is already at or beyond capacity, so callers can
/// surface a "max withdrawable" hint without handling errors.
pub fn max_admissible(state: &QueueLiquidity) -> Result<i128, VaultError> {
    if state.idle_assets < 0 || state.queued_assets < 0 {
        return Err(VaultError::InvalidAmount);
    }
    if state.buffer_bps as i128 > BPS_DENOMINATOR {
        return Err(VaultError::InvalidLiquidityBuffer);
    }

    let headroom = state
        .available()?
        .checked_sub(state.queued_assets)
        .ok_or(VaultError::MathOverflow)?;

    Ok(if headroom > 0 { headroom } else { 0 })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state(idle: i128, queued: i128, buffer_bps: u32) -> QueueLiquidity {
        QueueLiquidity {
            idle_assets: idle,
            queued_assets: queued,
            buffer_bps,
        }
    }

    #[test]
    fn admits_request_within_available_liquidity() {
        let s = state(1_000, 100, 1_000); // 10% buffer -> 900 available
        assert_eq!(check_queue_admission(&s, 500), Ok(600));
    }

    #[test]
    fn admits_request_at_exact_boundary() {
        let s = state(1_000, 100, 1_000);
        assert_eq!(check_queue_admission(&s, 800), Ok(900));
    }

    #[test]
    fn rejects_non_positive_request() {
        let s = state(1_000, 0, 0);
        assert_eq!(check_queue_admission(&s, 0), Err(VaultError::InvalidAmount));
        assert_eq!(
            check_queue_admission(&s, -1),
            Err(VaultError::InvalidAmount)
        );
    }

    #[test]
    fn rejects_request_beyond_idle_liquidity() {
        let s = state(1_000, 0, 0);
        assert_eq!(
            check_queue_admission(&s, 1_001),
            Err(VaultError::InsufficientLiquidity)
        );
    }

    #[test]
    fn rejects_request_that_eats_the_buffer() {
        let s = state(1_000, 100, 1_000); // 900 available, 1_000 idle
        assert_eq!(
            check_queue_admission(&s, 850),
            Err(VaultError::LiquidityBufferNotMet)
        );
    }

    #[test]
    fn rejects_queue_total_overflow() {
        let s = state(i128::MAX, i128::MAX, 0);
        assert_eq!(check_queue_admission(&s, 1), Err(VaultError::MathOverflow));
    }

    #[test]
    fn rejects_invalid_buffer_configuration() {
        let s = state(1_000, 0, 10_001);
        assert_eq!(
            check_queue_admission(&s, 1),
            Err(VaultError::InvalidLiquidityBuffer)
        );
    }

    #[test]
    fn rejects_corrupt_balances() {
        assert_eq!(
            check_queue_admission(&state(-1, 0, 0), 1),
            Err(VaultError::InvalidAmount)
        );
        assert_eq!(
            check_queue_admission(&state(1_000, -1, 0), 1),
            Err(VaultError::InvalidAmount)
        );
    }

    #[test]
    fn empty_vault_admits_nothing() {
        let s = state(0, 0, 0);
        assert_eq!(
            check_queue_admission(&s, 1),
            Err(VaultError::InsufficientLiquidity)
        );
        assert_eq!(max_admissible(&s), Ok(0));
    }

    #[test]
    fn max_admissible_matches_admission_boundary() {
        let s = state(1_000, 100, 1_000);
        let max = max_admissible(&s).unwrap();
        assert_eq!(max, 800);
        assert!(check_queue_admission(&s, max).is_ok());
        assert!(check_queue_admission(&s, max + 1).is_err());
    }

    #[test]
    fn max_admissible_is_zero_when_queue_is_saturated() {
        let s = state(1_000, 1_000, 1_000);
        assert_eq!(max_admissible(&s), Ok(0));
    }

    #[test]
    fn full_buffer_blocks_all_withdrawals() {
        let s = state(1_000, 0, 10_000);
        assert_eq!(max_admissible(&s), Ok(0));
        assert_eq!(
            check_queue_admission(&s, 1),
            Err(VaultError::LiquidityBufferNotMet)
        );
    }
}
