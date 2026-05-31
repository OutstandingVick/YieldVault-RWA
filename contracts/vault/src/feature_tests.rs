use super::*;
use crate::emergency::EmergencyActionKind;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};

fn setup_vault(
    e: &Env,
) -> (
    YieldVaultClient<'_>,
    token::Client<'_>,
    token::StellarAssetClient<'_>,
    Address,
) {
    let admin = Address::generate(e);
    let token_admin = Address::generate(e);
    let usdc = e
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let usdc_client = token::Client::new(e, &usdc);
    let usdc_sa = token::StellarAssetClient::new(e, &usdc);

    let vault_id = e.register(YieldVault, ());
    let vault = YieldVaultClient::new(e, &vault_id);
    vault.initialize(&admin, &usdc);

    (vault, usdc_client, usdc_sa, admin)
}

#[test]
fn test_pause_reason_stored_and_cleared() {
    let env = Env::default();
    env.mock_all_auths();

    let (vault, _, _, _) = setup_vault(&env);
    assert_eq!(vault.pause_reason(), None);

    vault.pause(&PauseReason::OracleFailure);
    assert!(vault.is_paused());
    assert_eq!(vault.pause_reason(), Some(PauseReason::OracleFailure));

    vault.unpause();
    assert_eq!(vault.pause_reason(), None);
}

#[test]
fn test_dual_approval_emergency_pause() {
    let env = Env::default();
    env.mock_all_auths();

    let (vault, _, _, _admin) = setup_vault(&env);
    let primary = Address::generate(&env);
    let secondary = Address::generate(&env);

    vault.set_emergency_approvers(&primary, &secondary);

    let proposal_id = vault.propose_emergency_action(
        &primary,
        &EmergencyActionKind::Pause,
        &(PauseReason::SecurityIncident as u32),
        &None,
        &None,
    );

    let proposal = vault.emergency_proposal(&proposal_id).unwrap();
    assert!(!proposal.confirmed);
    assert!(!proposal.executed);

    vault.confirm_emergency_action(&secondary, &proposal_id);

    assert!(vault.is_paused());
    assert_eq!(vault.pause_reason(), Some(PauseReason::SecurityIncident));

    let executed = vault.emergency_proposal(&proposal_id).unwrap();
    assert!(executed.confirmed);
    assert!(executed.executed);
}

#[test]
#[should_panic(expected = "only primary approver can initiate")]
fn test_emergency_proposal_rejects_non_primary() {
    let env = Env::default();
    env.mock_all_auths();

    let (vault, _, _, _admin) = setup_vault(&env);
    let primary = Address::generate(&env);
    let secondary = Address::generate(&env);
    let outsider = Address::generate(&env);

    vault.set_emergency_approvers(&primary, &secondary);

    vault.propose_emergency_action(
        &outsider,
        &EmergencyActionKind::Pause,
        &(PauseReason::Governance as u32),
        &None,
        &None,
    );
}

#[test]
fn test_storage_key_registry_valid() {
    let env = Env::default();
    env.mock_all_auths();

    let (vault, _, _, _) = setup_vault(&env);
    let registry = vault.storage_key_registry();
    assert!(registry.valid);
    assert!(registry.keys.len() >= 20);
}

#[test]
fn test_accrue_yield_fee_rounding_deterministic() {
    let env = Env::default();
    env.mock_all_auths();

    let (vault, _, usdc_sa, admin) = setup_vault(&env);
    vault.set_fee_bps(&100); // 1%

    usdc_sa.mint(&admin, &333);
    vault.accrue_yield(&333);

    // floor(333 * 100 / 10000) = floor(3.33) = 3
    assert_eq!(vault.treasury_balance(), 3);
    assert_eq!(vault.total_assets(), 330);
}
