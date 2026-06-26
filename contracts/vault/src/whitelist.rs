//! # Secure Whitelist Module
//!
//! Manages approved strategy contract IDs for allocation operations.

use soroban_sdk::{Address, Env};

use crate::upgrade::get_admin;
use crate::DataKey;

/// Errors that can occur during whitelist operations
#[derive(Debug, Clone, Copy)]
pub enum WhitelistError {
    /// Caller is not authorized to perform whitelist operations
    Unauthorized,
    /// Strategy address is invalid
    InvalidStrategy,
    /// Whitelist operation failed
    OperationFailed,
}

/// Whitelist management for strategy contract IDs.
pub struct SecureWhitelist;

impl SecureWhitelist {
    fn ensure_admin(caller: &Address, env: &Env) -> Result<(), WhitelistError> {
        let admin = get_admin(env).ok_or(WhitelistError::Unauthorized)?;
        if caller != &admin {
            return Err(WhitelistError::Unauthorized);
        }
        Ok(())
    }

    /// Adds a strategy address to the whitelist.
    pub fn add_strategy(
        env: &Env,
        caller: &Address,
        strategy: &Address,
    ) -> Result<(), WhitelistError> {
        Self::ensure_admin(caller, env)?;

        env.storage()
            .instance()
            .set(&DataKey::StrategyWhitelist(strategy.clone()), &true);

        Ok(())
    }

    /// Removes a strategy address from the whitelist.
    pub fn remove_strategy(
        env: &Env,
        caller: &Address,
        strategy: &Address,
    ) -> Result<(), WhitelistError> {
        Self::ensure_admin(caller, env)?;

        env.storage()
            .instance()
            .remove(&DataKey::StrategyWhitelist(strategy.clone()));

        Ok(())
    }

    /// Checks if a strategy is whitelisted.
    pub fn is_strategy_whitelisted(env: &Env, strategy: &Address) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::StrategyWhitelist(strategy.clone()))
            .unwrap_or(false)
    }

    /// Gets the whitelist status of a strategy with defaults.
    pub fn get_whitelist_status(env: &Env, strategy: &Address) -> bool {
        Self::is_strategy_whitelisted(env, strategy)
    }

    /// Updates the whitelist status of a strategy.
    pub fn set_whitelist_status(
        env: &Env,
        caller: &Address,
        strategy: &Address,
        approved: bool,
    ) -> Result<(), WhitelistError> {
        // Verify caller is the admin
        let admin = get_admin(env).ok_or(WhitelistError::Unauthorized)?;
        if caller != &admin {
            caller.require_auth();
            return Err(WhitelistError::Unauthorized);
        }
        if approved {
            env.storage()
                .instance()
                .set(&DataKey::StrategyWhitelist(strategy.clone()), &true);
        } else {
            env.storage()
                .instance()
                .remove(&DataKey::StrategyWhitelist(strategy.clone()));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_whitelist_documentation_exists() {
        // This test documents that the whitelist module is implemented
        // Actual enforcement is tested in lib.rs via integration tests
    }
}
