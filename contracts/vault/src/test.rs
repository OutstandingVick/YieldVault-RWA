//! Comprehensive test suite for YieldVault (Soroban)
//!
//! Run with:
//!   cargo test
//!
//! Coverage areas
//! ──────────────
//! 1.  initialize          – happy path, double-init, auth guard
//! 2.  deposit             – happy path, zero/negative guard, share math,
//!                           first-deposit 1:1, post-yield dilution
//! 3.  withdraw            – happy path, zero/negative guard, insufficient shares,
//!                           exact boundary, post-yield exchange rate
//! 4.  accrue_yield        – happy path, zero-amount guard, non-admin guard
//! 5.  report_benji_yield  – happy path, wrong strategy, zero amount
//! 6.  accrue_korean_yield – happy path (mock), non-positive harvest guard
//! 7.  governance          – proposal lifecycle, duplicate vote, zero weight,
//!                           below threshold, rejected, already executed
//! 8.  set_dao_threshold   – happy path, zero guard, non-admin guard
//! 9.  shipments           – add, duplicate guard, status update, same-status no-op,
//!                           multi-status isolation, pagination edge cases
//! 10. invariants          – share/asset accounting never drifts across multi-user
//!                           deposit/withdraw/yield sequences; full exit zeroes state

#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};

    (vault, usdc, usdc_sa, admin)
}

// ─── 1. initialize ───────────────────────────────────────────────────────────

#[test]
fn test_vault_with_benji_strategy() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Setup USDC (Underlying Asset)
    let token_admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &token_admin);
    let usdc_admin_client = token::StellarAssetClient::new(&env, &usdc.address);
    usdc_admin_client.mint(&user, &1000);

    // Setup BENJI Token (Strategy Asset)
    let benji_token = create_token_contract(&env, &token_admin);
    let benji_admin_client = token::StellarAssetClient::new(&env, &benji_token.address);

    // Register Contracts
    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(&env, &vault_id);
    
    let strategy_id = env.register(BenjiStrategy, ());
    let strategy = BenjiStrategyClient::new(&env, &strategy_id);

    // 1. Initialize
    vault.initialize(&admin, &usdc.address);
    strategy.initialize(&vault_id, &usdc.address, &benji_token.address);
    vault.set_strategy(&strategy_id);

    // 2. User Deposits 100 USDC
    vault.deposit(&user, &100);
    assert_eq!(vault.total_assets(), 100);
    assert_eq!(usdc.balance(&vault_id), 100);
    assert_eq!(strategy.total_value(), 0);

    // 3. Invest 60 USDC into BENJI Strategy
    vault.invest(&60);
    assert_eq!(usdc.balance(&vault_id), 40);
    assert_eq!(usdc.balance(&strategy_id), 60);
    
    // In our mock, strategy value depends on BENJI tokens held by contract
    // Let's simulate the strategy contract "buying" BENJI tokens
    benji_admin_client.mint(&strategy_id, &60);
    assert_eq!(strategy.total_value(), 60);
    assert_eq!(vault.total_assets(), 100); // 40 idle + 60 in strategy

    // 4. Yield Accrues in BENJI (Daily return)
    benji_admin_client.mint(&strategy_id, &6); // 10% yield
    assert_eq!(strategy.total_value(), 66);
    assert_eq!(vault.total_assets(), 106); // 40 idle + 66 in strategy

    // 5. User Withdraws some shares. 
    // Vault has 40 idle assets, but user wants to withdraw 50 shares (value ~53 USDC)
    // This should trigger an internal divestment
    let withdrawn = vault.withdraw(&user, &50);
    assert_eq!(withdrawn, 53); // 50 shares * 106 assets / 100 shares = 53
    
    assert_eq!(vault.total_shares(), 50);
    assert_eq!(vault.total_assets(), 53);
}

#[test]
fn test_vault_flow_legacy() {
fn test_initialize_sets_state() {
    let env = Env::default();
    env.mock_all_auths();

    let (vault, usdc, _, _) = setup_vault(&env);

    assert_eq!(vault.token(), usdc.address);
    assert_eq!(vault.total_assets(), 0);
    assert_eq!(vault.total_shares(), 0);
}

#[test]
#[should_panic]
fn test_initialize_double_init_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let usdc = create_token(&env, &token_admin);

    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(&env, &vault_id);
    vault.initialize(&admin, &usdc.address);
    // Second call must panic with AlreadyInitialized.
    vault.initialize(&admin, &usdc.address);
}

// ─── 2. deposit ──────────────────────────────────────────────────────────────

#[test]
fn test_deposit_first_user_one_to_one_shares() {
    let env = Env::default();
    env.mock_all_auths();

    let (vault, usdc, usdc_sa, _) = setup_vault(&env);
    let user = Address::generate(&env);
    usdc_sa.mint(&user, &500);

    let minted = vault.deposit(&user, &500);
    assert_eq!(minted, 500);
    assert_eq!(vault.balance(&user), 500);
    assert_eq!(vault.total_assets(), 500);
    assert_eq!(vault.total_shares(), 500);
    assert_eq!(usdc.balance(&user), 0);
}

#[test]
fn test_deposit_second_user_proportional_shares() {
    let env = Env::default();
    env.mock_all_auths();

    let (vault, _, usdc_sa, admin) = setup_vault(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    usdc_sa.mint(&user1, &100);
    usdc_sa.mint(&user2, &100);
    usdc_sa.mint(&admin, &50);

    vault.deposit(&user1, &100);
    // Accrue yield → exchange rate becomes 150/100 = 1.5 assets per share.
    vault.accrue_yield(&50);
    // user2 deposits 100 assets; should receive 100 * 100 / 150 = 66 shares (truncated).
    let minted2 = vault.deposit(&user2, &100);
    assert_eq!(minted2, 66);
    assert_eq!(vault.total_assets(), 250);
    assert_eq!(vault.total_shares(), 166);
}

#[test]
fn test_governance_sets_benji_strategy() {
fn test_deposit_zero_returns_invalid_amount_error() {
    let env = Env::default();
    env.mock_all_auths();

    let (vault, _, _, _) = setup_vault(&env);
    let user = Address::generate(&env);

    let result = vault.try_deposit(&user, &0);
    assert!(result.is_err());
}

#[test]
fn test_deposit_negative_returns_invalid_amount_error() {
    let env = Env::default();
    env.mock_all_auths();

    let (vault, _, _, _) = setup_vault(&env);
    let user = Address::generate(&env);

    let result = vault.try_deposit(&user, &-1);
    assert!(result.is_err());
}

#[test]
fn test_withdraw_invalid_amount_and_insufficient_shares() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &token_admin);
    let usdc_admin_client = token::StellarAssetClient::new(&env, &usdc.address);
    usdc_admin_client.mint(&user, &100);

    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(&env, &vault_id);

    vault.initialize(&admin, &usdc.address);
    vault.deposit(&user, &100);

    let zero_amount = vault.try_withdraw(&user, &0);
    assert_eq!(zero_amount, Err(Ok(VaultError::InvalidAmount)));

    let too_many_shares = vault.try_withdraw(&user, &101);
    assert_eq!(too_many_shares, Err(Ok(VaultError::InsufficientShares)));
}

#[test]
fn test_withdraw_fails_when_vault_token_balance_is_short() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &token_admin);
    let usdc_admin_client = token::StellarAssetClient::new(&env, &usdc.address);
    usdc_admin_client.mint(&user, &100);

    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(&env, &vault_id);

    vault.initialize(&admin, &usdc.address);
    vault.deposit(&user, &100);

    // Simulate tokens leaving the contract without updating tracked assets.
    usdc.transfer(&vault_id, &admin, &1);

    let result = vault.try_withdraw(&user, &100);
    assert_eq!(result, Err(Ok(VaultError::InsufficientAssets)));
}
