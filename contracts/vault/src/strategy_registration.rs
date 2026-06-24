//! Strategy registration lifecycle with explicit states and transition guards.
//!
//! Each strategy address progresses through:
//! `Pending` → `Active` → `Retired`
//!
//! State is persisted in the existing `StrategyWhitelist` storage slot.

use soroban_sdk::{contracttype, Address, Env};

use crate::upgrade::get_admin;
use crate::DataKey;

/// Lifecycle state for a registered strategy contract.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum StrategyRegistrationState {
    Pending = 1,
    Active = 2,
    Retired = 3,
}

/// Errors returned by registration lifecycle operations.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum StrategyRegistrationError {
    Unauthorized = 1,
    AlreadyRegistered = 2,
    NotRegistered = 3,
    InvalidTransition = 4,
    ActiveStrategyInUse = 5,
    StrategyNotActive = 6,
}

/// Returns whether `to` is a valid next state from `from`.
pub fn is_allowed_transition(
    from: Option<StrategyRegistrationState>,
    to: StrategyRegistrationState,
) -> bool {
    match (from, to) {
        (None, StrategyRegistrationState::Pending) => true,
        (Some(StrategyRegistrationState::Pending), StrategyRegistrationState::Active) => true,
        (
            Some(StrategyRegistrationState::Pending | StrategyRegistrationState::Active),
            StrategyRegistrationState::Retired,
        ) => true,
        _ => false,
    }
}

pub fn read_registration_state(env: &Env, strategy: &Address) -> Option<StrategyRegistrationState> {
    env.storage()
        .instance()
        .get(&DataKey::StrategyWhitelist(strategy.clone()))
}

fn write_registration_state(env: &Env, strategy: &Address, state: StrategyRegistrationState) {
    env.storage()
        .instance()
        .set(&DataKey::StrategyWhitelist(strategy.clone()), &state);
}

fn remove_registration_state(env: &Env, strategy: &Address) {
    env.storage()
        .instance()
        .remove(&DataKey::StrategyWhitelist(strategy.clone()));
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

fn transition(
    env: &Env,
    strategy: &Address,
    to: StrategyRegistrationState,
) -> Result<StrategyRegistrationState, StrategyRegistrationError> {
    let from = read_registration_state(env, strategy);
    if !is_allowed_transition(from, to) {
        return Err(StrategyRegistrationError::InvalidTransition);
    }
    write_registration_state(env, strategy, to);
    Ok(to)
}

/// Admin registers a strategy in the `Pending` state.
pub fn register_strategy(
    env: &Env,
    caller: &Address,
    strategy: &Address,
) -> Result<StrategyRegistrationState, StrategyRegistrationError> {
    require_admin(env, caller)?;
    if read_registration_state(env, strategy).is_some() {
        return Err(StrategyRegistrationError::AlreadyRegistered);
    }
    transition(env, strategy, StrategyRegistrationState::Pending)
}

/// Admin promotes a `Pending` strategy to `Active`.
pub fn activate_strategy(
    env: &Env,
    caller: &Address,
    strategy: &Address,
) -> Result<StrategyRegistrationState, StrategyRegistrationError> {
    require_admin(env, caller)?;
    transition(env, strategy, StrategyRegistrationState::Active)
}

/// Admin retires a `Pending` or `Active` strategy.
pub fn retire_strategy(
    env: &Env,
    caller: &Address,
    strategy: &Address,
    active_vault_strategy: Option<Address>,
) -> Result<StrategyRegistrationState, StrategyRegistrationError> {
    require_admin(env, caller)?;
    if active_vault_strategy.as_ref() == Some(strategy) {
        return Err(StrategyRegistrationError::ActiveStrategyInUse);
    }
    transition(env, strategy, StrategyRegistrationState::Retired)
}

/// Returns true when the strategy is eligible for allocation (`Pending` or `Active`).
pub fn is_eligible_for_allocation(env: &Env, strategy: &Address) -> bool {
    matches!(
        read_registration_state(env, strategy),
        Some(StrategyRegistrationState::Pending | StrategyRegistrationState::Active)
    )
}

/// Ensures a strategy is registered and in the `Active` state.
pub fn require_active_registration(
    env: &Env,
    strategy: &Address,
) -> Result<(), StrategyRegistrationError> {
    match read_registration_state(env, strategy) {
        Some(StrategyRegistrationState::Active) => Ok(()),
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
        assert!(is_allowed_transition(
            None,
            StrategyRegistrationState::Pending
        ));
        assert!(is_allowed_transition(
            Some(StrategyRegistrationState::Pending),
            StrategyRegistrationState::Active
        ));
        assert!(!is_allowed_transition(
            Some(StrategyRegistrationState::Retired),
            StrategyRegistrationState::Active
        ));
    }
}
