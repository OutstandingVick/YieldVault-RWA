//! # Secure Whitelist Module
//!
//! Manages approved strategy contract IDs and their registration lifecycle state.

use soroban_sdk::{Address, Env};

use crate::strategy_registration::{self, STATE_RETIRED};
use crate::upgrade::get_admin;

/// Errors that can occur during whitelist operations
#[derive(Debug, Clone, Copy)]
pub enum WhitelistError {
    Unauthorized,
    InvalidStrategy,
    OperationFailed,
}

pub struct SecureWhitelist;

impl SecureWhitelist {
    pub fn add_strategy(
        env: &Env,
        caller: &Address,
        strategy: &Address,
    ) -> Result<(), WhitelistError> {
        let admin = get_admin(env).ok_or(WhitelistError::Unauthorized)?;
        if caller != &admin {
            return Err(WhitelistError::Unauthorized);
        }

        match strategy_registration::read_registration_state(env, strategy) {
            None => {
                let _ = strategy_registration::register_strategy_internal(env, strategy);
            }
            Some(STATE_RETIRED) => {
                return Err(WhitelistError::OperationFailed);
            }
            Some(_) => {}
        }

        Ok(())
    }

    pub fn remove_strategy(
        env: &Env,
        caller: &Address,
        strategy: &Address,
    ) -> Result<(), WhitelistError> {
        let admin = get_admin(env).ok_or(WhitelistError::Unauthorized)?;
        if caller != &admin {
            return Err(WhitelistError::Unauthorized);
        }

        strategy_registration::remove_registration(env, strategy);
        Ok(())
    }

    pub fn is_strategy_whitelisted(env: &Env, strategy: &Address) -> bool {
        strategy_registration::is_eligible_for_allocation(env, strategy)
    }

    pub fn get_whitelist_status(env: &Env, strategy: &Address) -> bool {
        Self::is_strategy_whitelisted(env, strategy)
    }

    pub fn set_whitelist_status(
        env: &Env,
        caller: &Address,
        strategy: &Address,
        approved: bool,
    ) -> Result<(), WhitelistError> {
        if approved {
            Self::add_strategy(env, caller, strategy)
        } else {
            Self::remove_strategy(env, caller, strategy)
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_whitelist_documentation_exists() {}
}
