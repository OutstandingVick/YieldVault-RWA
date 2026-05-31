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
}

pub fn read_proposal(env: &Env, id: u32) -> Option<EmergencyProposal> {
    env.storage()
        .instance()
        .get(&crate::DataKey::EmergencyProposal(id))
}

pub fn write_proposal(env: &Env, id: u32, proposal: &EmergencyProposal) {
    env.storage()
        .instance()
        .set(&crate::DataKey::EmergencyProposal(id), proposal);
}

pub fn next_proposal_id(env: &Env) -> u32 {
    let nonce: u32 = env
        .storage()
        .instance()
        .get(&crate::DataKey::EmergencyProposalNonce)
        .unwrap_or(0);
    let next = nonce.checked_add(1).expect("proposal nonce overflow");
    env.storage()
        .instance()
        .set(&crate::DataKey::EmergencyProposalNonce, &next);
    next
}

pub fn primary_approver(env: &Env) -> Option<Address> {
    env.storage()
        .instance()
        .get(&crate::DataKey::EmergencyApproverPrimary)
}

pub fn secondary_approver(env: &Env) -> Option<Address> {
    env.storage()
        .instance()
        .get(&crate::DataKey::EmergencyApproverSecondary)
}

pub fn require_distinct_approvers(primary: &Address, secondary: &Address) {
    assert!(primary != secondary, "approvers must be distinct");
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_distinct_approvers_required() {
        let env = Env::default();
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        require_distinct_approvers(&a, &b);
    }

    #[test]
    #[should_panic(expected = "approvers must be distinct")]
    fn test_same_approver_rejected() {
        let env = Env::default();
        let a = Address::generate(&env);
        require_distinct_approvers(&a, &a);
    }
}
