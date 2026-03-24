#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Events as _};
use soroban_sdk::{token, Address, Env, IntoVal, TryFromVal};

fn create_token_contract<'a>(e: &Env, admin: &Address) -> token::Client<'a> {
    let token_address = e.register_stellar_asset_contract_v2(admin.clone()).address();
    token::Client::new(e, &token_address)
}

#[test]
fn test_vault_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    // Setup underlying token (USDC mock)
    let token_admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &token_admin);
    let usdc_admin_client = token::StellarAssetClient::new(&env, &usdc.address);
    usdc_admin_client.mint(&user1, &1000);
    usdc_admin_client.mint(&user2, &1000);

    // Register Vault Contract
    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(&env, &vault_id);

    // 1. Initialize
    vault.initialize(&admin, &usdc.address);

    // 2. User 1 Deposits 100 USDC -> gets 100 shares
    let minted_user1 = vault.deposit(&user1, &100);
    assert_eq!(minted_user1, 100);
    assert_eq!(vault.balance(&user1), 100);
    assert_eq!(vault.total_assets(), 100);
    assert_eq!(vault.total_shares(), 100);
    assert_eq!(usdc.balance(&user1), 900); // 1000 - 100

    // 3. User 2 Deposits 200 USDC -> gets 200 shares
    let minted_user2 = vault.deposit(&user2, &200);
    assert_eq!(minted_user2, 200);
    assert_eq!(vault.balance(&user2), 200);
    assert_eq!(vault.total_assets(), 300);
    assert_eq!(vault.total_shares(), 300);

    // 4. Admin accrues yield (simulates 30 USDC strategy return)
    usdc_admin_client.mint(&admin, &30);
    vault.accrue_yield(&30);
    
    // Exchange rate is now 330 assets / 300 shares = 1.1 USDC per share
    assert_eq!(vault.total_assets(), 330);

    // 5. User 1 Withdraws all 100 shares. Expects 110 USDC.
    let withdrawn_user1 = vault.withdraw(&user1, &100);
    assert_eq!(withdrawn_user1, 110);
    assert_eq!(usdc.balance(&user1), 1010); // 900 + 110
    assert_eq!(vault.balance(&user1), 0);

    // Vault tracks the new totals: 220 assets, 200 shares
    assert_eq!(vault.total_assets(), 220);
    assert_eq!(vault.total_shares(), 200);

    // 6. User 2 Withdraws half their shares (100). Expects 110 USDC.
    let withdrawn_user2 = vault.withdraw(&user2, &100);
    assert_eq!(withdrawn_user2, 110);
    assert_eq!(usdc.balance(&user2), 910); // 800 + 110
}

#[test]
<<<<<<< HEAD
fn test_governance_sets_benji_strategy() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let voter_1 = Address::generate(&env);
    let voter_2 = Address::generate(&env);
    let benji_strategy = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &token_admin);

    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(&env, &vault_id);
    vault.initialize(&admin, &usdc.address);

    vault.set_dao_threshold(&2);

    let proposal_id = vault.create_strategy_proposal(&admin, &benji_strategy);
    vault.vote_on_proposal(&voter_1, &proposal_id, &true, &1);
    vault.vote_on_proposal(&voter_2, &proposal_id, &true, &1);
    vault.execute_strategy_proposal(&proposal_id);

    assert_eq!(vault.benji_strategy(), benji_strategy);
}

#[test]
fn test_benji_connector_reports_yield() {
=======
fn test_deposit_invalid_amount() {
>>>>>>> origin/main
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
<<<<<<< HEAD
    let benji_strategy = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &token_admin);
    let usdc_admin_client = token::StellarAssetClient::new(&env, &usdc.address);
    usdc_admin_client.mint(&user, &1000);
    usdc_admin_client.mint(&benji_strategy, &100);

    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(&env, &vault_id);
    vault.initialize(&admin, &usdc.address);

    vault.set_dao_threshold(&1);
    let proposal_id = vault.create_strategy_proposal(&admin, &benji_strategy);
    vault.vote_on_proposal(&admin, &proposal_id, &true, &1);
    vault.execute_strategy_proposal(&proposal_id);

    vault.deposit(&user, &500);
    assert_eq!(vault.total_assets(), 500);

    vault.report_benji_yield(&benji_strategy, &40);
    assert_eq!(vault.total_assets(), 540);
=======

    // Setup underlying token
    let token_admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &token_admin);

    // Register Vault Contract
    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(&env, &vault_id);

    vault.initialize(&admin, &usdc.address);

    // Try depositing 0 - should fail
    let result = vault.try_deposit(&user, &0);
    assert!(result.is_err());

    // Try depositing -1 - should fail
    let result = vault.try_deposit(&user, &-1);
    assert!(result.is_err());
>>>>>>> origin/main
}
