//! Guard checks for withdrawal cooldown (deposit then immediate withdraw).

use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{token, Address, Env};
use vault::{VaultError, YieldVault, YieldVaultClient};

fn setup_vault(env: &Env) -> (YieldVaultClient<'_>, token::StellarAssetClient<'_>, Address) {
    let admin = Address::generate(env);
    let token_admin = Address::generate(env);
    let token_addr = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let usdc_sa = token::StellarAssetClient::new(env, &token_addr);
    let vault_id = env.register(YieldVault, ());
    let vault = YieldVaultClient::new(env, &vault_id);
    vault.initialize(&admin, &token_addr);
    (vault, usdc_sa, admin)
}

#[test]
fn test_withdraw_blocked_during_cooldown() {
    let env = Env::default();
    env.mock_all_auths();

    let (vault, usdc_sa, admin) = setup_vault(&env);
    let user = Address::generate(&env);

    vault.set_withdrawal_cooldown(&3600);
    usdc_sa.mint(&user, &1_000_000);
    usdc_sa.mint(&admin, &100_000);

    vault.deposit(&user, &1_000_000);
    let shares = vault.balance(&user);
    let result = vault.try_withdraw(&user, &shares);
    assert_eq!(result, Err(Ok(VaultError::WithdrawalCooldownActive)));
}

#[test]
fn test_withdraw_allowed_after_cooldown() {
    let env = Env::default();
    env.mock_all_auths();

    let (vault, usdc_sa, admin) = setup_vault(&env);
    let user = Address::generate(&env);

    vault.set_withdrawal_cooldown(&60);
    usdc_sa.mint(&user, &1_000_000);
    usdc_sa.mint(&admin, &100_000);

    vault.deposit(&user, &1_000_000);
    env.ledger().with_mut(|li| {
        li.timestamp += 61;
    });

    let shares = vault.balance(&user);
    let result = vault.try_withdraw(&user, &shares);
    assert!(result.is_ok());
}
