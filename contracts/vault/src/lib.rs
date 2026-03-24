#![no_std]

mod test;

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    TokenAsset,
    TotalShares,
    TotalAssets,
    Admin,
    DaoThreshold,
    ProposalNonce,
    BenjiStrategy,
    Proposal(u32),
    Vote(u32, Address),
    ShareBalance(Address),
}

<<<<<<< HEAD
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StrategyProposal {
    pub strategy: Address,
    pub yes_votes: i128,
    pub no_votes: i128,
    pub executed: bool,
=======
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultError {
    AlreadyInitialized = 1,
    InsufficientShares = 2,
    InvalidAmount = 3,
>>>>>>> origin/main
}

#[contract]
pub struct YieldVault;

#[contractimpl]
impl YieldVault {
    /// Initialize the vault with the underlying asset (USDC) and an admin who controls the strategy.
    pub fn initialize(env: Env, admin: Address, token: Address) -> Result<(), VaultError> {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(VaultError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenAsset, &token);
        env.storage().instance().set(&DataKey::TotalAssets, &0i128);
<<<<<<< HEAD
        env.storage().instance().set(&DataKey::DaoThreshold, &1i128);
        env.storage().instance().set(&DataKey::ProposalNonce, &0u32);
=======
        env.storage().instance().set(&DataKey::TotalShares, &0i128);

        Ok(())
>>>>>>> origin/main
    }

    /// Read the underlying token address.
    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::TokenAsset).unwrap() // Changed DataKey::Token to DataKey::TokenAsset
    }

    /// Read the total minted shares.
    pub fn total_shares(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0)
    }

    /// Read the total underlying assets.
    pub fn total_assets(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalAssets).unwrap_or(0)
    }

    /// Read a user's share balance.
    pub fn balance(env: Env, user: Address) -> i128 {
        env.storage().instance().get(&DataKey::ShareBalance(user)).unwrap_or(0)
    }

    /// Read configured BENJI strategy contract address.
    pub fn benji_strategy(env: Env) -> Address {
        env.storage().instance().get(&DataKey::BenjiStrategy).unwrap()
    }

    /// Configure DAO quorum threshold. Only admin can update this parameter.
    pub fn set_dao_threshold(env: Env, threshold: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if threshold <= 0 {
            panic!("threshold must be > 0");
        }
        env.storage().instance().set(&DataKey::DaoThreshold, &threshold);
    }

    /// Create a proposal to update the BENJI strategy connector address.
    pub fn create_strategy_proposal(env: Env, proposer: Address, strategy: Address) -> u32 {
        proposer.require_auth();
        let mut next_nonce: u32 = env.storage().instance().get(&DataKey::ProposalNonce).unwrap_or(0);
        next_nonce += 1;
        env.storage().instance().set(&DataKey::ProposalNonce, &next_nonce);

        let proposal = StrategyProposal {
            strategy,
            yes_votes: 0,
            no_votes: 0,
            executed: false,
        };
        env.storage().instance().set(&DataKey::Proposal(next_nonce), &proposal);
        next_nonce
    }

    /// Vote on a proposal with a given voting weight.
    pub fn vote_on_proposal(env: Env, voter: Address, proposal_id: u32, support: bool, weight: i128) {
        voter.require_auth();
        if weight <= 0 {
            panic!("weight must be > 0");
        }
        if env.storage().instance().has(&DataKey::Vote(proposal_id, voter.clone())) {
            panic!("duplicate vote");
        }

        let mut proposal: StrategyProposal = env.storage().instance().get(&DataKey::Proposal(proposal_id)).unwrap();
        if proposal.executed {
            panic!("proposal already executed");
        }

        if support {
            proposal.yes_votes += weight;
        } else {
            proposal.no_votes += weight;
        }

        env.storage().instance().set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage().instance().set(&DataKey::Vote(proposal_id, voter), &true);
    }

    /// Execute a strategy proposal once it reaches threshold and has majority support.
    pub fn execute_strategy_proposal(env: Env, proposal_id: u32) {
        let mut proposal: StrategyProposal = env.storage().instance().get(&DataKey::Proposal(proposal_id)).unwrap();
        if proposal.executed {
            panic!("proposal already executed");
        }

        let threshold: i128 = env.storage().instance().get(&DataKey::DaoThreshold).unwrap_or(1);
        if proposal.yes_votes < threshold {
            panic!("quorum not reached");
        }
        if proposal.yes_votes <= proposal.no_votes {
            panic!("proposal rejected");
        }

        env.storage().instance().set(&DataKey::BenjiStrategy, &proposal.strategy);
        proposal.executed = true;
        env.storage().instance().set(&DataKey::Proposal(proposal_id), &proposal);
    }

    /// Calculates the number of shares given an asset amount based on the current exchange rate.
    pub fn calculate_shares(env: Env, assets: i128) -> i128 {
        let ts = Self::total_shares(env.clone());
        let ta = Self::total_assets(env.clone());
        if ta == 0 || ts == 0 {
            assets
        } else {
            assets * ts / ta
        }
    }

    /// Calculates the underlying asset value given an amount of shares.
    pub fn calculate_assets(env: Env, shares: i128) -> i128 {
        let ts = Self::total_shares(env.clone());
        let ta = Self::total_assets(env.clone());
        if ts == 0 {
            0
        } else {
            shares * ta / ts
        }
    }

    /// Deposits USDC into the vault and mints proportional shares to the user.
    pub fn deposit(env: Env, user: Address, amount: i128) -> Result<i128, VaultError> {
        user.require_auth();
        if amount <= 0 { 
            return Err(VaultError::InvalidAmount);
        }

        let token_addr = Self::token(env.clone());
        let token_client = token::Client::new(&env, &token_addr);

        let shares_to_mint = Self::calculate_shares(env.clone(), amount);
        
        // Transfer assets from user to vault
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        // Emit Deposit event
        env.events().publish((symbol_short!("deposit"),), (amount, shares_to_mint));

        // Update state
        let ta = Self::total_assets(env.clone());
        env.storage().instance().set(&DataKey::TotalAssets, &(ta + amount));
        
        let ts = Self::total_shares(env.clone());
        env.storage().instance().set(&DataKey::TotalShares, &(ts + shares_to_mint));

        let user_shares = Self::balance(env.clone(), user.clone());
        env.storage().instance().set(&DataKey::ShareBalance(user.clone()), &(user_shares + shares_to_mint));
        
        Ok(shares_to_mint)
    }

    /// Withdraws USDC backed by burned shares from the user.
    pub fn withdraw(env: Env, user: Address, shares: i128) -> Result<i128, VaultError> {
        user.require_auth();
        if shares <= 0 { 
            return Err(VaultError::InvalidAmount);
        }

        let user_shares = Self::balance(env.clone(), user.clone());
        if user_shares < shares { 
            return Err(VaultError::InsufficientShares);
        }

        let assets_to_return = Self::calculate_assets(env.clone(), shares);

        let token_addr = Self::token(env.clone());
        let token_client = token::Client::new(&env, &token_addr);

        // Transfer assets from vault to user
        token_client.transfer(&env.current_contract_address(), &user, &assets_to_return);

        // Update state
        let ta = Self::total_assets(env.clone());
        env.storage().instance().set(&DataKey::TotalAssets, &(ta - assets_to_return));
        
        let ts = Self::total_shares(env.clone());
        env.storage().instance().set(&DataKey::TotalShares, &(ts - shares));

        let vault_balance = Self::balance(env.clone(), user.clone());
        env.storage().instance().set(&DataKey::ShareBalance(user.clone()), &(vault_balance - shares));

        // Emit Withdraw event
        env.events().publish((symbol_short!("withdraw"), user.clone()), (assets_to_return, shares));

        Ok(assets_to_return)
    }

    /// Admin function to artificially accrue yield, simulating returns from an RWA strategy.
    /// This simply bumps the `total_assets` tracked by the vault, immediately increasing the
    /// exchange rate for all share holders. Real implementation would pull this from an RWA protocol.
    pub fn accrue_yield(env: Env, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let token_addr = Self::token(env.clone());
        let token_client = token::Client::new(&env, &token_addr);

        // Transfer the generated yield from the admin (or strategy contract) into the vault.
        token_client.transfer(&admin, &env.current_contract_address(), &amount);

        let ta = Self::total_assets(env.clone());
        env.storage().instance().set(&DataKey::TotalAssets, &(ta + amount));
    }

    /// BENJI strategy connector callback for reporting harvested yield into the vault.
    pub fn report_benji_yield(env: Env, strategy: Address, amount: i128) {
        strategy.require_auth();
        if amount <= 0 {
            panic!("yield amount must be > 0");
        }
        let configured: Address = env.storage().instance().get(&DataKey::BenjiStrategy).unwrap();
        if strategy != configured {
            panic!("unauthorized strategy");
        }

        let token_addr = Self::token(env.clone());
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&strategy, &env.current_contract_address(), &amount);

        let ta = Self::total_assets(env.clone());
        env.storage().instance().set(&DataKey::TotalAssets, &(ta + amount));
    }
}
