//! Strategy registration lifecycle with explicit states and transition guards.
//!
//! State is persisted as `u32` in the existing `StrategyWhitelist` storage slot:
//! `1` = Pending, `2` = Active, `3` = Retired.

use soroban_sdk::{Address, Env};

use crate::upgrade::get_admin;
use crate::DataKey;

pub const STATE_PENDING: u32 = 1;
pub const STATE_ACTIVE: u32 = 2;
pub const STATE_RETIRED: u32 = 3;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StrategyRegistrationError {
    Unauthorized,
    AlreadyRegistered,
    NotRegistered,
    InvalidTransition,
    ActiveStrategyInUse,
    StrategyNotActive,
}

pub fn read_registration_state(env: &Env, strategy: &Address) -> Option<u32> {
    env.storage()
        .instance()
        .get(&DataKey::StrategyWhitelist(strategy.clone()))
}

fn write_registration_state(env: &Env, strategy: &Address, state: u32) {
    env.storage()
        .instance()
        .set(&DataKey::StrategyWhitelist(strategy.clone()), &state);
}

fn remove_registration_state(env: &Env, strategy: &Address) {
    env.storage()
        .instance()
        .remove(&DataKey::StrategyWhitelist(strategy.clone()));
}

pub fn is_allowed_transition(from: Option<u32>, to: u32) -> bool {
    matches!(
        (from, to),
        (None, STATE_PENDING)
            | (Some(STATE_PENDING), STATE_ACTIVE)
            | (Some(STATE_PENDING), STATE_RETIRED)
            | (Some(STATE_ACTIVE), STATE_RETIRED)
    )
}

fn transition(env: &Env, strategy: &Address, to: u32) -> Result<u32, StrategyRegistrationError> {
    let from = read_registration_state(env, strategy);
    if !is_allowed_transition(from, to) {
        return Err(StrategyRegistrationError::InvalidTransition);
    }
    write_registration_state(env, strategy, to);
    Ok(to)
}

fn require_admin(env: &Env, caller: &Address) -> Result<(), StrategyRegistrationError> {
    let admin = get_admin(env).ok_or(StrategyRegistrationError::Unauthorized)?;
    if caller != &admin {
        caller.require_auth();
        return Err(StrategyRegistrationError::Unauthorized);
    }
    admin.require_auth();
    Ok(())
}

pub(crate) fn register_strategy_internal(
    env: &Env,
    strategy: &Address,
) -> Result<u32, StrategyRegistrationError> {
    if read_registration_state(env, strategy).is_some() {
        return Err(StrategyRegistrationError::AlreadyRegistered);
    }
    transition(env, strategy, STATE_PENDING)
}

pub(crate) fn activate_strategy_internal(
    env: &Env,
    strategy: &Address,
) -> Result<u32, StrategyRegistrationError> {
    transition(env, strategy, STATE_ACTIVE)
}

pub(crate) fn retire_strategy_internal(
    env: &Env,
    strategy: &Address,
    active_vault_strategy: Option<Address>,
) -> Result<u32, StrategyRegistrationError> {
    if active_vault_strategy.as_ref() == Some(strategy) {
        return Err(StrategyRegistrationError::ActiveStrategyInUse);
    }
    transition(env, strategy, STATE_RETIRED)
}

pub fn register_strategy(
    env: &Env,
    caller: &Address,
    strategy: &Address,
) -> Result<u32, StrategyRegistrationError> {
    require_admin(env, caller)?;
    register_strategy_internal(env, strategy)
}

pub fn activate_strategy(
    env: &Env,
    caller: &Address,
    strategy: &Address,
) -> Result<u32, StrategyRegistrationError> {
    require_admin(env, caller)?;
    activate_strategy_internal(env, strategy)
}

pub fn retire_strategy(
    env: &Env,
    caller: &Address,
    strategy: &Address,
    active_vault_strategy: Option<Address>,
) -> Result<u32, StrategyRegistrationError> {
    require_admin(env, caller)?;
    retire_strategy_internal(env, strategy, active_vault_strategy)
}

pub fn is_eligible_for_allocation(env: &Env, strategy: &Address) -> bool {
    matches!(
        read_registration_state(env, strategy),
        Some(STATE_PENDING) | Some(STATE_ACTIVE)
    )
}

pub fn require_active_registration(
    env: &Env,
    strategy: &Address,
) -> Result<(), StrategyRegistrationError> {
    match read_registration_state(env, strategy) {
        Some(STATE_ACTIVE) => Ok(()),
        Some(_) => Err(StrategyRegistrationError::StrategyNotActive),
        None => Err(StrategyRegistrationError::NotRegistered),
    }
}

pub fn remove_registration(env: &Env, strategy: &Address) {
    remove_registration_state(env, strategy);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allowed_transitions() {
        assert!(is_allowed_transition(None, STATE_PENDING));
        assert!(is_allowed_transition(Some(STATE_PENDING), STATE_ACTIVE));
        assert!(!is_allowed_transition(Some(STATE_RETIRED), STATE_ACTIVE));
    }
}
