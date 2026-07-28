//! Integration tests for Issue #969: timelock enforcement for sensitive
//! parameter changes (protocol fee, treasury, price oracle).

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token, Address, Env};

fn create_token_contract<'a>(env: &Env, admin: &Address) -> token::Client<'a> {
    let token_address = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    token::Client::new(env, &token_address)
}

fn setup(env: &Env) -> (YieldVaultClient<'static>, Address) {
    let admin = Address::generate(env);
    let token_admin = Address::generate(env);
    let usdc = create_token_contract(env, &token_admin);

    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(env, &vault_id);
    vault.initialize(&admin, &usdc.address);
    (vault, admin)
}

// ── Fee bps ────────────────────────────────────────────────────────────────

#[test]
fn test_fee_bps_change_not_applied_until_executed() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault, _admin) = setup(&env);

    assert_eq!(vault.fee_bps(), 0);
    vault.queue_fee_bps_change(&500);
    // Queueing alone must not change the live value.
    assert_eq!(vault.fee_bps(), 0);

    vault.execute_fee_bps_change();
    assert_eq!(vault.fee_bps(), 500);
}

#[test]
fn test_fee_bps_change_blocked_before_timelock_elapses() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault, _admin) = setup(&env);

    vault.set_sensitive_timelock_delay(&86_400);
    vault.queue_fee_bps_change(&500);

    let result = vault.try_execute_fee_bps_change();
    assert_eq!(result, Err(Ok(VaultError::TimelockNotExpired)));
    assert_eq!(vault.fee_bps(), 0);

    env.ledger()
        .set_timestamp(env.ledger().timestamp() + 86_400);
    vault.execute_fee_bps_change();
    assert_eq!(vault.fee_bps(), 500);
}

#[test]
fn test_fee_bps_change_can_be_cancelled_before_execution() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault, _admin) = setup(&env);

    vault.set_sensitive_timelock_delay(&86_400);
    vault.queue_fee_bps_change(&500);
    vault.cancel_fee_bps_change();

    assert!(vault.pending_fee_bps_change().is_none());
    let result = vault.try_execute_fee_bps_change();
    assert_eq!(result, Err(Ok(VaultError::NoPendingWithdrawal)));
    assert_eq!(vault.fee_bps(), 0);
}

#[test]
fn test_execute_fee_bps_change_with_nothing_queued_returns_error() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault, _admin) = setup(&env);

    let result = vault.try_execute_fee_bps_change();
    assert_eq!(result, Err(Ok(VaultError::NoPendingWithdrawal)));
}

#[test]
fn test_cancel_fee_bps_change_with_nothing_queued_returns_error() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault, _admin) = setup(&env);

    let result = vault.try_cancel_fee_bps_change();
    assert_eq!(result, Err(Ok(VaultError::NoPendingWithdrawal)));
}

#[test]
fn test_requeueing_fee_bps_change_overwrites_the_pending_value() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault, _admin) = setup(&env);

    vault.queue_fee_bps_change(&500);
    vault.queue_fee_bps_change(&800);
    vault.execute_fee_bps_change();

    assert_eq!(vault.fee_bps(), 800);
}

#[test]
fn test_queue_fee_bps_change_rejects_out_of_range_value() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault, _admin) = setup(&env);

    let result = vault.try_queue_fee_bps_change(&10_001);
    assert_eq!(result, Err(Ok(VaultError::InvalidFeeBps)));
}

#[test]
fn test_queue_fee_bps_change_requires_admin_auth() {
    let env = Env::default();
    let (vault, _admin) = setup(&env);

    // No auths mocked — the admin's require_auth() must reject this call.
    assert!(vault.try_queue_fee_bps_change(&500).is_err());
}

// ── Treasury ───────────────────────────────────────────────────────────────

#[test]
fn test_treasury_change_not_applied_until_executed() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault, _admin) = setup(&env);
    let treasury = Address::generate(&env);

    vault.queue_treasury_change(&treasury);
    assert!(vault.treasury().is_none());

    vault.execute_treasury_change();
    assert_eq!(vault.treasury(), Some(treasury));
}

#[test]
fn test_treasury_change_blocked_before_timelock_elapses() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault, _admin) = setup(&env);
    let treasury = Address::generate(&env);

    vault.set_sensitive_timelock_delay(&3_600);
    vault.queue_treasury_change(&treasury);

    let result = vault.try_execute_treasury_change();
    assert_eq!(result, Err(Ok(VaultError::TimelockNotExpired)));

    env.ledger().set_timestamp(env.ledger().timestamp() + 3_600);
    vault.execute_treasury_change();
    assert_eq!(vault.treasury(), Some(treasury));
}

// ── Price oracle ─────────────────────────────────────────────────────────

#[test]
fn test_price_oracle_change_not_applied_until_executed() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault, _admin) = setup(&env);
    let oracle = Address::generate(&env);

    vault.queue_price_oracle_change(&oracle);
    assert!(vault.price_oracle().is_none());

    vault.execute_price_oracle_change();
    assert_eq!(vault.price_oracle(), Some(oracle));
}

#[test]
fn test_cancel_price_oracle_change_removes_pending_entry() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault, _admin) = setup(&env);
    let oracle = Address::generate(&env);

    vault.set_sensitive_timelock_delay(&3_600);
    vault.queue_price_oracle_change(&oracle);
    assert!(vault.pending_price_oracle_change().is_some());

    vault.cancel_price_oracle_change();
    assert!(vault.pending_price_oracle_change().is_none());
    assert!(vault.price_oracle().is_none());
}

// ── Timelock delay configuration ───────────────────────────────────────────

#[test]
fn test_sensitive_timelock_delay_defaults_to_disabled() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault, _admin) = setup(&env);

    assert_eq!(vault.sensitive_timelock_delay(), 0);
}

#[test]
fn test_set_sensitive_timelock_delay_rejects_values_below_floor() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault, _admin) = setup(&env);

    let result = vault.try_set_sensitive_timelock_delay(&1);
    assert_eq!(result, Err(Ok(VaultError::InvalidDaoThreshold)));

    let result = vault.try_set_sensitive_timelock_delay(&3_599);
    assert_eq!(result, Err(Ok(VaultError::InvalidDaoThreshold)));
}

#[test]
fn test_set_sensitive_timelock_delay_accepts_zero_and_values_at_or_above_floor() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault, _admin) = setup(&env);

    vault.set_sensitive_timelock_delay(&0);
    assert_eq!(vault.sensitive_timelock_delay(), 0);

    vault.set_sensitive_timelock_delay(&3_600);
    assert_eq!(vault.sensitive_timelock_delay(), 3_600);
}

#[test]
fn test_queued_eta_reflects_the_configured_delay() {
    let env = Env::default();
    env.mock_all_auths();
    let (vault, _admin) = setup(&env);

    env.ledger().set_timestamp(1_000);
    vault.set_sensitive_timelock_delay(&3_600);

    let eta = vault.queue_fee_bps_change(&500);
    assert_eq!(eta, 1_000 + 3_600);
    assert_eq!(vault.pending_fee_bps_change().unwrap().eta, eta);
}
