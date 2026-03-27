#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};

fn create_token_contract<'a>(e: &Env, admin: &Address) -> token::Client<'a> {
    let token_address = e.register_stellar_asset_contract_v2(admin.clone()).address();
    token::Client::new(e, &token_address)
}

#[test]
fn test_vault_flow() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let usdc = create_token(&env, &token_admin);
    let usdc_admin_client = token::StellarAssetClient::new(&env, &usdc.address);
    usdc_admin_client.mint(&user1, &1000);
    usdc_admin_client.mint(&user2, &1000);

    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(&env, &vault_id);

    vault.initialize(&admin, &usdc.address);

    let minted_user1 = vault.deposit(&user1, &100);
    assert_eq!(minted_user1, 100);
    assert_eq!(vault.balance(&user1), 100);
    assert_eq!(vault.total_assets(), 100);
    assert_eq!(vault.total_shares(), 100);
    assert_eq!(usdc.balance(&user1), 900);

    let minted_user2 = vault.deposit(&user2, &200);
    assert_eq!(minted_user2, 200);
    assert_eq!(vault.balance(&user2), 200);
    assert_eq!(vault.total_assets(), 300);
    assert_eq!(vault.total_shares(), 300);

    usdc_admin_client.mint(&admin, &30);
    vault.accrue_yield(&30);
    assert_eq!(vault.total_assets(), 330);

    let withdrawn_user1 = vault.withdraw(&user1, &100);
    assert_eq!(withdrawn_user1, 110);
    assert_eq!(usdc.balance(&user1), 1010);
    assert_eq!(vault.balance(&user1), 0);
    assert_eq!(vault.total_assets(), 220);
    assert_eq!(vault.total_shares(), 200);

    let withdrawn_user2 = vault.withdraw(&user2, &100);
    assert_eq!(withdrawn_user2, 110);
    assert_eq!(usdc.balance(&user2), 910);
}

#[test]
fn test_deposit_invalid_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &token_admin);

    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(&env, &vault_id);
    vault.initialize(&admin, &usdc.address);

    assert!(vault.try_deposit(&user, &0).is_err());
    assert!(vault.try_deposit(&user, &-1).is_err());
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

    usdc.transfer(&vault_id, &admin, &1);

    let result = vault.try_withdraw(&user, &100);
    assert_eq!(result, Err(Ok(VaultError::InsufficientAssets)));
}
