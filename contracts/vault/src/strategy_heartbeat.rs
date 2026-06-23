//! Strategy heartbeat validation for allocation safety.
//!
//! Strategies must periodically record a heartbeat so the vault can reject
//! allocation and rebalance operations when a strategy has gone stale.

use soroban_sdk::{Address, Env};

use crate::{DataKey, VaultError};

/// Default maximum age of a strategy heartbeat before allocation is blocked.
pub const DEFAULT_STRATEGY_HEARTBEAT_SECONDS: u64 = 3600;

/// Returns true when `strategy` has a heartbeat newer than `max_age_seconds`.
pub fn is_strategy_heartbeat_fresh(env: &Env, strategy: &Address, max_age_seconds: u64) -> bool {
    if max_age_seconds == 0 {
        return true;
    }

    let last: Option<u64> = env
        .storage()
        .instance()
        .get(&DataKey::StrategyLastHeartbeat(strategy.clone()));

    match last {
        None => false,
        Some(last_ts) => {
            let now = env.ledger().timestamp();
            now.saturating_sub(last_ts) <= max_age_seconds
        }
    }
}

/// Ensures the strategy heartbeat is within the configured freshness window.
pub fn ensure_strategy_heartbeat_fresh(
    env: &Env,
    strategy: &Address,
    max_age_seconds: u64,
) -> Result<(), VaultError> {
    if is_strategy_heartbeat_fresh(env, strategy, max_age_seconds) {
        Ok(())
    } else {
        Err(VaultError::StrategyHeartbeatExpired)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger as _};

    #[test]
    fn test_missing_heartbeat_is_stale() {
        let env = Env::default();
        let strategy = Address::generate(&env);
        assert!(!is_strategy_heartbeat_fresh(&env, &strategy, 3600));
    }

    #[test]
    fn test_recent_heartbeat_is_fresh() {
        let env = Env::default();
        let strategy = Address::generate(&env);
        let now = env.ledger().timestamp();
        env.storage()
            .instance()
            .set(&DataKey::StrategyLastHeartbeat(strategy.clone()), &now);
        assert!(is_strategy_heartbeat_fresh(&env, &strategy, 3600));
    }

    #[test]
    fn test_expired_heartbeat_is_stale() {
        let env = Env::default();
        let strategy = Address::generate(&env);
        let now = env.ledger().timestamp();
        env.storage()
            .instance()
            .set(&DataKey::StrategyLastHeartbeat(strategy.clone()), &now);

        env.ledger().with_mut(|li| {
            li.timestamp = now + 3601;
        });

        assert!(!is_strategy_heartbeat_fresh(&env, &strategy, 3600));
    }

    #[test]
    fn test_zero_max_age_disables_check() {
        let env = Env::default();
        let strategy = Address::generate(&env);
        assert!(is_strategy_heartbeat_fresh(&env, &strategy, 0));
    }
}
