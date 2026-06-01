//! Guard checks tests for rapid opposing actions (deposit/withdraw) in the same ledger

#[cfg(test)]
mod guard_checks_test {
    // Integration test imports
    use vault::{YieldVault, VaultError};
    use soroban_sdk::{Env, testutils::Address as TestAddress, testutils::Ledger};

    fn create_env() -> Env {
        let env = Env::default();
        // Set up a dummy admin and token addresses
        let admin = TestAddress::generate(&env);
        let token_addr = TestAddress::generate(&env);
        // Initialize the vault
        YieldVault::initialize(env, admin.clone(), token_addr.clone()).unwrap();
        // Set admin auth for subsequent calls
        env.mock_all_auths();
        env
    }

    #[test]
    fn test_deposit_then_withdraw_same_ledger_fails() {
        let env = create_env();
        let user = TestAddress::generate(&env);
        // Deposit some amount
        let deposit_amount: i128 = 1_000_000;
        let _ = YieldVault::deposit(env, user.clone(), deposit_amount).unwrap();
        // Attempt withdraw in the same ledger sequence
        let shares = YieldVault::balance(env, user.clone());
        let result = YieldVault::withdraw(env, user.clone(), shares);
        assert!(matches!(result, Err(VaultError::RapidAction)));
    }

    #[test]
    fn test_deposit_then_withdraw_next_ledger_succeeds() {
        let mut env = create_env();
        let user = TestAddress::generate(&env);
        // Deposit
        let deposit_amount: i128 = 1_000_000;
        let _ = YieldVault::deposit(env, user.clone(), deposit_amount).unwrap();
        // Advance ledger sequence
        env.ledger().with_mut(|li| { li.sequence_number += 1; });
        // Withdraw
        let shares = YieldVault::balance(env, user.clone());
        let result = YieldVault::withdraw(env, user.clone(), shares);
        assert!(result.is_ok());
    }
}
