#![cfg(test)]

use super::*;
use mock_strategy::MockKoreanSovereignStrategy;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env, Vec};

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

    let token_admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &token_admin);
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
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
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
}

#[test]
fn test_shipment_cursor_pagination_no_duplicates_or_skips() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &token_admin);

    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(&env, &vault_id);
    vault.initialize(&admin, &usdc.address);

    vault.add_shipment(&30, &ShipmentStatus::Pending);
    vault.add_shipment(&10, &ShipmentStatus::Pending);
    vault.add_shipment(&20, &ShipmentStatus::Pending);
    vault.add_shipment(&40, &ShipmentStatus::Pending);
    vault.add_shipment(&999, &ShipmentStatus::Delivered);

    let page_1 = vault.shipment_ids_by_status(&ShipmentStatus::Pending, &None, &2);
    assert_eq!(page_1.shipment_ids, Vec::from_array(&env, [10, 20]));
    assert_eq!(page_1.next_cursor, Some(20));

    let page_2 = vault.shipment_ids_by_status(&ShipmentStatus::Pending, &page_1.next_cursor, &2);
    assert_eq!(page_2.shipment_ids, Vec::from_array(&env, [30, 40]));
    assert_eq!(page_2.next_cursor, None);

    let page_3 = vault.shipment_ids_by_status(&ShipmentStatus::Pending, &Some(40), &2);
    assert_eq!(page_3.shipment_ids, Vec::new(&env));
    assert_eq!(page_3.next_cursor, None);
}

#[test]
fn test_shipment_cursor_pagination_bounded_page_size() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &token_admin);

    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(&env, &vault_id);
    vault.initialize(&admin, &usdc.address);

    let mut i: u64 = 1;
    while i <= 60 {
        vault.add_shipment(&i, &ShipmentStatus::InTransit);
        i += 1;
    }

    let page_1 = vault.shipment_ids_by_status(&ShipmentStatus::InTransit, &None, &200);
    assert_eq!(page_1.shipment_ids.len(), 50);
    assert_eq!(page_1.next_cursor, Some(50));

    let page_2 = vault.shipment_ids_by_status(&ShipmentStatus::InTransit, &page_1.next_cursor, &200);
    assert_eq!(page_2.shipment_ids, Vec::from_array(&env, [51, 52, 53, 54, 55, 56, 57, 58, 59, 60]));
    assert_eq!(page_2.next_cursor, None);
}

#[test]
fn test_korean_strategy_predictable_yield_integration() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &token_admin);

    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(&env, &vault_id);
    vault.initialize(&admin, &usdc.address);

    let strategy_id = env.register(MockKoreanSovereignStrategy, ());
    let strategy = mock_strategy::MockKoreanSovereignStrategyClient::new(&env, &strategy_id);
    strategy.initialize(&admin, &vault_id, &7, &3);

    vault.configure_korean_strategy(&strategy_id);

    let y1 = vault.accrue_korean_debt_yield();
    let y2 = vault.accrue_korean_debt_yield();
    let y3 = vault.accrue_korean_debt_yield();

    assert_eq!(y1, 7);
    assert_eq!(y2, 10);
    assert_eq!(y3, 13);
    assert_eq!(vault.total_assets(), 30);
}

#[test]
fn test_full_lifecycle_deposit_accrue_withdraw_integration() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &token_admin);
    let usdc_admin_client = token::StellarAssetClient::new(&env, &usdc.address);
    usdc_admin_client.mint(&user1, &2_000);
    usdc_admin_client.mint(&user2, &2_000);
    usdc_admin_client.mint(&admin, &500);

    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(&env, &vault_id);
    vault.initialize(&admin, &usdc.address);

    // Deposit phase.
    let minted_user1 = vault.deposit(&user1, &400);
    let minted_user2 = vault.deposit(&user2, &600);
    assert_eq!(minted_user1, 400);
    assert_eq!(minted_user2, 600);
    assert_eq!(vault.total_assets(), 1_000);
    assert_eq!(vault.total_shares(), 1_000);

    // Accrue phase.
    vault.accrue_yield(&120);
    vault.accrue_yield(&80);
    assert_eq!(vault.total_assets(), 1_200);
    assert_eq!(vault.total_shares(), 1_000);

    // Partial withdrawal to verify exchange-rate math mid lifecycle.
    let withdrawn_partial = vault.withdraw(&user1, &200);
    assert_eq!(withdrawn_partial, 240);
    assert_eq!(vault.balance(&user1), 200);
    assert_eq!(vault.total_assets(), 960);
    assert_eq!(vault.total_shares(), 800);

    // Full exit: no residual shares or assets.
    let user1_remaining = vault.balance(&user1);
    let user2_all = vault.balance(&user2);
    let withdrawn_user1_rest = vault.withdraw(&user1, &user1_remaining);
    let withdrawn_user2_all = vault.withdraw(&user2, &user2_all);

    assert_eq!(withdrawn_user1_rest + withdrawn_user2_all, 960);
    assert_eq!(vault.balance(&user1), 0);
    assert_eq!(vault.balance(&user2), 0);
    assert_eq!(vault.total_assets(), 0);
    assert_eq!(vault.total_shares(), 0);
}

#[test]
fn test_full_lifecycle_with_korean_strategy_yield_integration() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &token_admin);
    let usdc_admin_client = token::StellarAssetClient::new(&env, &usdc.address);
    usdc_admin_client.mint(&user, &1_000);

    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(&env, &vault_id);
    vault.initialize(&admin, &usdc.address);

    let strategy_id = env.register(MockKoreanSovereignStrategy, ());
    let strategy = mock_strategy::MockKoreanSovereignStrategyClient::new(&env, &strategy_id);
    strategy.initialize(&admin, &vault_id, &10, &5);
    vault.configure_korean_strategy(&strategy_id);

    let minted = vault.deposit(&user, &500);
    assert_eq!(minted, 500);
    assert_eq!(vault.total_assets(), 500);

    // Strategy-driven accrual lifecycle.
    assert_eq!(vault.accrue_korean_debt_yield(), 10);
    assert_eq!(vault.accrue_korean_debt_yield(), 15);
    assert_eq!(vault.accrue_korean_debt_yield(), 20);
    assert_eq!(vault.total_assets(), 545);

    // Mock strategy accrual updates accounting, so mint backing liquidity for redeemability checks.
    usdc_admin_client.mint(&vault_id, &45);

    let withdrawn_all = vault.withdraw(&user, &500);
    assert_eq!(withdrawn_all, 545);
    assert_eq!(vault.balance(&user), 0);
    assert_eq!(vault.total_assets(), 0);
    assert_eq!(vault.total_shares(), 0);
}
