//! Timelock enforcement for sensitive admin parameter changes.
//!
//! Certain admin parameters move value directly (protocol fee rate, treasury
//! destination, price oracle address). Previously these applied the instant
//! the admin's transaction confirmed, so a compromised or malicious admin key
//! could redirect fees, swap in a hostile oracle, or set the fee to 100% with
//! no warning to depositors.
//!
//! This module backs a queue → wait → execute flow: the admin queues a new
//! value, and it only takes effect once `execute_*` is called after the
//! configured minimum delay has elapsed. Depositors watching the queued-change
//! events get that window to react (e.g. withdraw) before the change lands.
//!
//! The minimum delay is admin-configurable (see
//! `YieldVault::set_sensitive_timelock_delay`) and defaults to `0` (disabled)
//! until armed, mirroring the existing `admin_param_change_interval` guard.
//! Once armed, it cannot be set below [`MIN_SENSITIVE_TIMELOCK_DELAY_SECS`] —
//! an admin can widen the window but can't quietly shrink it to noise.

use soroban_sdk::{contracttype, Address, Env};

/// A non-zero timelock delay below this floor is rejected: short of that it
/// offers no real protection against a same-block queue-then-execute.
pub const MIN_SENSITIVE_TIMELOCK_DELAY_SECS: u64 = 3_600;

/// A queued change to an `i128`-valued sensitive parameter (e.g. protocol fee bps).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PendingI128Change {
    pub new_value: i128,
    /// Ledger timestamp at/after which this change may be executed.
    pub eta: u64,
}

/// A queued change to an `Address`-valued sensitive parameter (e.g. treasury, oracle).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PendingAddressChange {
    pub new_value: Address,
    /// Ledger timestamp at/after which this change may be executed.
    pub eta: u64,
}

/// Computes the execute-after timestamp for a change queued right now.
pub fn compute_eta(env: &Env, delay_secs: u64) -> u64 {
    env.ledger()
        .timestamp()
        .checked_add(delay_secs)
        .expect("timelock eta overflow")
}

/// Returns true once the ledger has reached the given eta.
pub fn is_ready(env: &Env, eta: u64) -> bool {
    env.ledger().timestamp() >= eta
}

/// Validates a candidate timelock delay: 0 (disabled) or at least the floor.
pub fn is_valid_delay(delay_secs: u64) -> bool {
    delay_secs == 0 || delay_secs >= MIN_SENSITIVE_TIMELOCK_DELAY_SECS
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    #[test]
    fn test_compute_eta_adds_delay_to_current_timestamp() {
        let env = Env::default();
        env.ledger().set_timestamp(1_000);
        assert_eq!(compute_eta(&env, 3_600), 4_600);
    }

    #[test]
    fn test_is_ready_true_only_once_eta_reached() {
        let env = Env::default();
        env.ledger().set_timestamp(1_000);
        assert!(!is_ready(&env, 1_001));
        assert!(is_ready(&env, 1_000));
        env.ledger().set_timestamp(1_001);
        assert!(is_ready(&env, 1_001));
    }

    #[test]
    fn test_zero_delay_disables_the_timelock() {
        assert!(is_valid_delay(0));
    }

    #[test]
    fn test_delay_below_floor_is_rejected() {
        assert!(!is_valid_delay(1));
        assert!(!is_valid_delay(MIN_SENSITIVE_TIMELOCK_DELAY_SECS - 1));
    }

    #[test]
    fn test_delay_at_or_above_floor_is_valid() {
        assert!(is_valid_delay(MIN_SENSITIVE_TIMELOCK_DELAY_SECS));
        assert!(is_valid_delay(MIN_SENSITIVE_TIMELOCK_DELAY_SECS + 1));
    }

    #[test]
    fn test_pending_i128_change_round_trip_fields() {
        let env = Env::default();
        let change = PendingI128Change {
            new_value: 500,
            eta: 42,
        };
        assert_eq!(change.new_value, 500);
        assert_eq!(change.eta, 42);
        let _ = env;
    }

    #[test]
    fn test_pending_address_change_round_trip_fields() {
        let env = Env::default();
        let addr = Address::generate(&env);
        let change = PendingAddressChange {
            new_value: addr.clone(),
            eta: 7,
        };
        assert_eq!(change.new_value, addr);
        assert_eq!(change.eta, 7);
    }
}
