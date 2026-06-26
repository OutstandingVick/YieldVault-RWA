//! Guard checks tests for rapid opposing actions (deposit/withdraw) in the same ledger

#[cfg(test)]
mod guard_checks_test {
    // Integration test imports
    use soroban_sdk::{testutils::Address as TestAddress, testutils::Ledger, Env};
    use vault::{VaultError, YieldVault};

    fn create_env() -> Env {
        let env = Env::default();
        // Set up a dummy admin and token addresses
        let admin = <soroban_sdk::Address as soroban_sdk::testutils::Address>::generate(&env);
        let token_addr = <soroban_sdk::Address as soroban_sdk::testutils::Address>::generate(&env);
        let user = <soroban_sdk::Address as soroban_sdk::testutils::Address>::generate(&env);
        // Initialize the vault
        YieldVault::initialize(env.clone(), admin.clone(), token_addr.clone()).unwrap();
        // Set admin auth for subsequent calls
        env.mock_all_auths();
        env
    }

    #[test]
    fn test_deposit_then_withdraw_same_ledger_fails() {
        let env = create_env();
        let user = <soroban_sdk::Address as soroban_sdk::testutils::Address>::generate(&env);
        // Deposit some amount
        let deposit_amount: i128 = 1_000_000;
        let _ = YieldVault::deposit(env.clone(), user.clone(), deposit_amount).unwrap();
        // Attempt withdraw in the same ledger sequence
        let shares = YieldVault::balance(env.clone(), user.clone());
        let result = YieldVault::withdraw(env.clone(), user.clone(), shares);
        assert!(matches!(result, Err(VaultError::AdminParamChangeTooSoon)));
    }

    #[test]
    fn test_deposit_then_withdraw_next_ledger_succeeds() {
        let env = create_env();
        let user = <soroban_sdk::Address as TestAddress>::generate(&env);
        // Deposit
        let deposit_amount: i128 = 1_000_000;
        let _ = YieldVault::deposit(env.clone(), user.clone(), deposit_amount).unwrap();
        // Advance ledger sequence
        env.ledger().with_mut(|li| {
            li.sequence_number += 1;
        });
        // Withdraw
        let shares = YieldVault::balance(env.clone(), user.clone());
        let result = YieldVault::withdraw(env.clone(), user.clone(), shares);
        assert!(result.is_ok());
    }

    #[test]
    fn test_time_lock_withdrawal() {
        let env = create_env();
        let user = <soroban_sdk::Address as soroban_sdk::testutils::Address>::generate(&env);
        // Deposit
        let deposit_amount: i128 = 1_000_000;
        let _ = YieldVault::deposit(env.clone(), user.clone(), deposit_amount).unwrap();
        // Advance ledger sequence
        env.ledger().with_mut(|li| {
            li.sequence_number += 1; // Needs at least 1 ledger sequence advance
        });
        // Attempt withdraw
        let shares = YieldVault::balance(env.clone(), user.clone());
        let result = YieldVault::withdraw(env.clone(), user.clone(), shares);
        assert!(result.is_ok());
    }
}
