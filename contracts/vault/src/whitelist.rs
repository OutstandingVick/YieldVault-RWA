//! # Secure Whitelist Module
//!
//! Manages approved strategy contract IDs for allocation operations.
//!
//! ## Features
//! - Add/remove strategy from whitelist
//! - Check if strategy is whitelisted
//! - Query whitelist status
//! - Admin-only access control
//! - Storage-backed persistence

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

/// Whitelist management for strategy contract IDs
///
/// This module provides secure operations for maintaining an approved list
/// of strategy contract addresses. Only the vault admin can modify the whitelist.
pub struct SecureWhitelist;

impl SecureWhitelist {
    /// Adds a strategy address to the whitelist.
    pub fn add_strategy(
        env: &Env,
        caller: &Address,
        strategy: &Address,
    ) -> Result<(), WhitelistError> {
        let admin = get_admin(env).ok_or(WhitelistError::Unauthorized)?;
        if caller != &admin {
            caller.require_auth();
            return Err(WhitelistError::Unauthorized);
        }
        admin.require_auth();

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
        let admin = get_admin(env).ok_or(WhitelistError::Unauthorized)?;
        if caller != &admin {
            caller.require_auth();
            return Err(WhitelistError::Unauthorized);
        }
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::StrategyWhitelist(strategy.clone()), &false);

        Ok(())
    }

    /// Checks if a strategy is whitelisted.
    pub fn is_strategy_whitelisted(env: &Env, strategy: &Address) -> bool {
        env.storage()
            .instance()
            .get::<_, bool>(&DataKey::StrategyWhitelist(strategy.clone()))
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
        let admin = get_admin(env).ok_or(WhitelistError::Unauthorized)?;
        if caller != &admin {
            caller.require_auth();
            return Err(WhitelistError::Unauthorized);
        }
        admin.require_auth();

        if approved {
            Self::add_strategy(env, caller, strategy)?;
        } else {
            Self::remove_strategy(env, caller, strategy)?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_whitelist_documentation_exists() {
        // Actual enforcement is tested in lib.rs via integration tests.
    }
}
