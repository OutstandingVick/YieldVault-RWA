//! Dual-approval flow for critical emergency contract actions.
//!
//! High-impact operations require authorization from **two distinct approvers**
//! configured via `set_emergency_approvers`. The primary initiates a proposal;
//! the secondary confirms and triggers execution.

use soroban_sdk::{contracttype, Address, BytesN, Env};

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum EmergencyActionKind {
    Pause = 1,
    Unpause = 2,
    EmergencyDivest = 3,
    ForceUpgrade = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmergencyProposal {
    pub kind: EmergencyActionKind,
    /// Pause reason code (`0` = not applicable). See [`PauseReason`].
    pub pause_reason_code: u32,
    pub divest_amount: Option<i128>,
    pub wasm_hash: Option<BytesN<32>>,
    pub initiator: Address,
    pub confirmed: bool,
    pub executed: bool,
    pub cancelled: bool,
    /// Ledger timestamp after which the secondary approver may confirm.
    /// The admin may cancel the proposal before this deadline passes.
    pub dispute_deadline: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
/// Result of an emergency unwind simulation.
pub struct EmergencyUnwindResult {
    /// Total assets that would be recovered
    pub total_assets_recovered: i128,
    /// Estimated losses from forced liquidation (slippage + fees)
    pub estimated_losses: i128,
    /// Net amount available to users after losses
    pub net_amount_available: i128,
    /// Cost of the operation (gas, external call fees)
    pub operational_cost: i128,
    /// Whether the unwind is feasible with current strategy allocations
    pub feasible: bool,
}

use crate::{DataKey, EmergencyStorageKey};

pub fn read_proposal(env: &Env, id: u32) -> Option<EmergencyProposal> {
    env.storage()
        .instance()
        .get(&DataKey::Emergency(EmergencyStorageKey::Proposal(id)))
}

pub fn write_proposal(env: &Env, id: u32, proposal: &EmergencyProposal) {
    env.storage()
        .instance()
        .set(&DataKey::Emergency(EmergencyStorageKey::Proposal(id)), proposal);
}

pub fn next_proposal_id(env: &Env) -> u32 {
    let nonce: u32 = env
        .storage()
        .instance()
        .get(&DataKey::Emergency(EmergencyStorageKey::ProposalNonce))
        .unwrap_or(0);
    let next = nonce.checked_add(1).expect("proposal nonce overflow");
    env.storage()
        .instance()
        .set(&DataKey::Emergency(EmergencyStorageKey::ProposalNonce), &next);
    next
}

pub fn primary_approver(env: &Env) -> Option<Address> {
    env.storage()
        .instance()
        .get(&DataKey::Emergency(EmergencyStorageKey::ApproverPrimary))
}

pub fn secondary_approver(env: &Env) -> Option<Address> {
    env.storage()
        .instance()
        .get(&DataKey::Emergency(EmergencyStorageKey::ApproverSecondary))
}

pub fn require_distinct_approvers(primary: &Address, secondary: &Address) {
    assert!(primary != secondary, "approvers must be distinct");
}

/// Simulate an emergency unwind scenario without executing state changes.
/// Provides governance with estimated outcomes before committing to emergency actions.
///
/// ### Parameters
/// * `total_assets` - Total vault assets currently allocated
/// * `strategy_count` - Number of active strategy allocations
/// * `estimated_slippage_bps` - Estimated slippage from forced liquidations (basis points)
/// * `estimated_fee_bps` - Estimated operational fees (basis points)
///
/// ### Returns
/// `EmergencyUnwindResult` with simulated outcomes
pub fn simulate_emergency_unwind(
    total_assets: i128,
    _strategy_count: u32,
    estimated_slippage_bps: i128,
    estimated_fee_bps: i128,
) -> EmergencyUnwindResult {
    if total_assets <= 0 {
        return EmergencyUnwindResult {
            total_assets_recovered: 0,
            estimated_losses: 0,
            net_amount_available: 0,
            operational_cost: 0,
            feasible: true,
        };
    }

    // Calculate slippage loss
    let slippage_loss = total_assets
        .saturating_mul(estimated_slippage_bps)
        .checked_div(10_000)
        .unwrap_or(0)
        .max(0);

    // Calculate operational fees
    let op_cost = total_assets
        .saturating_mul(estimated_fee_bps)
        .checked_div(10_000)
        .unwrap_or(0)
        .max(0);

    let total_losses = slippage_loss.saturating_add(op_cost);
    let net_available = total_assets.saturating_sub(total_losses).max(0);

    // Feasibility check: unwind is feasible if we can recover at least 80% of assets
    let feasible = net_available >= total_assets / 5;

    EmergencyUnwindResult {
        total_assets_recovered: total_assets,
        estimated_losses: total_losses,
        net_amount_available: net_available,
        operational_cost: op_cost,
        feasible,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_distinct_approvers_required() {
        let env = Env::default();
        let a = <soroban_sdk::Address as TestAddress>::generate(&env);
        let b = <soroban_sdk::Address as TestAddress>::generate(&env);
        require_distinct_approvers(&a, &b);
    }

    #[test]
    #[should_panic(expected = "approvers must be distinct")]
    fn test_same_approver_rejected() {
        let env = Env::default();
        let a = <soroban_sdk::Address as TestAddress>::generate(&env);
        require_distinct_approvers(&a, &a);
    }

    #[test]
    fn test_emergency_unwind_zero_assets() {
        let result = simulate_emergency_unwind(0, 1, 500, 100);
        assert_eq!(result.total_assets_recovered, 0);
        assert_eq!(result.net_amount_available, 0);
        assert!(result.feasible);
    }

    #[test]
    fn test_emergency_unwind_normal_scenario() {
        let result = simulate_emergency_unwind(1_000_000, 3, 300, 50);
        // Slippage: 1_000_000 * 300 / 10_000 = 30_000
        // Fees: 1_000_000 * 50 / 10_000 = 5_000
        // Total losses: 35_000
        // Net: 965_000
        assert_eq!(result.total_assets_recovered, 1_000_000);
        assert_eq!(result.estimated_losses, 35_000);
        assert_eq!(result.net_amount_available, 965_000);
        assert!(result.feasible);
    }

    #[test]
    fn test_emergency_unwind_high_slippage() {
        let result = simulate_emergency_unwind(1_000_000, 5, 3000, 500);
        // Slippage: 1_000_000 * 3000 / 10_000 = 300_000
        // Fees: 1_000_000 * 500 / 10_000 = 50_000
        // Total: 350_000
        // Net: 650_000 (65% recovery)
        assert_eq!(result.net_amount_available, 650_000);
        assert!(result.feasible);
    }

    #[test]
    fn test_emergency_unwind_severe_losses() {
        let result = simulate_emergency_unwind(1_000_000, 5, 8000, 1000);
        // Slippage: 1_000_000 * 8000 / 10_000 = 800_000
        // Fees: 1_000_000 * 1000 / 10_000 = 100_000
        // Total: 900_000
        // Net: 100_000 (10% recovery) - infeasible
        assert_eq!(result.net_amount_available, 100_000);
        assert!(!result.feasible);
    }
}
