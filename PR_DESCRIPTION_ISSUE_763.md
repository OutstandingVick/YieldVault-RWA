# PR Description — Issue #763: Documentation: Add glossary for protocol governance and emergency controls

## Overview

This PR adds comprehensive glossary definitions for protocol governance and emergency control terminology used across the YieldVault-RWA codebase and documentation.

---

## Implementation Summary

### New Glossary Section

Added a new `## Governance & Emergency Controls` section to `docs/GLOSSARY.md` containing 19 terms organized by functional domain:

#### Admin & Access Control
- **Admin** — Privileged address for vault configuration and administrative operations
- **Pending Admin** — Address in two-step admin transfer process
- **Strategy Manager** — Authorized role for strategy operations (already existed in Strategies section)

#### Decentralized Governance
- **Governance** — Weighted voting system for strategy selection
- **Governance Signer** — Authorized address in multisig governance set
- **Governance Threshold** — Required signature count (M of N) for governance operations
- **DAO Threshold** — Minimum vote weight for proposal execution
- **Strategy Proposal** — Governance proposal to set active strategy
- **Multisig Governance** — M-of-N signature requirement framework
- **Migration Mode** — State accepting both old and new signer sets during transitions

#### Emergency Controls
- **Emergency Approver** — Dual-approval system for critical operations (primary + secondary)
- **Primary Emergency Approver** — Initiates emergency action proposals
- **Secondary Emergency Approver** — Confirms and executes after dispute window
- **Emergency Action** — Critical operations (Pause, Unpause, EmergencyDivest, ForceUpgrade)
- **EmergencyActionKind** — Enum classifying emergency action types
- **Emergency Proposal** — Dual-approval proposal with dispute deadline
- **Dispute Window** — Configurable time for admin to cancel emergency proposals
- **Emergency Unwind** — Forced liquidation simulation mechanism
- **EmergencyUnwindResult** — Simulation output with feasibility assessment

#### Pause & Risk Management
- **Pause** — Vault halt operation blocking deposits/withdrawals
- **Pause Reason** — Explicit codes: SecurityIncident, OracleFailure, LiquidityCrisis, Governance, Maintenance, Other

#### Timelock Mechanisms
- **Timelock** — Time-based lock on certain operations
- **Large Withdrawal Threshold** — Amount triggering 24-hour withdrawal delay
- **Pending Withdrawal** — Queued withdrawal awaiting unlock timestamp
- **Admin Parameter Change Interval** — Guard against rapid parameter changes

---

## Files Modified

### `docs/GLOSSARY.md`
- Updated "Last Updated" date to 2026-06-27
- Added new Table of Contents entry for Governance & Emergency Controls
- Added 87 lines of new governance and emergency control terminology

---

## Term Selection Rationale

Terms were selected based on:

1. **Code alignment** — All terms map to identifiers in `contracts/vault/src/lib.rs` and related modules (`emergency.rs`, `permissions.rs`, `upgrade.rs`)
2. **Cross-spec references** — Terms appear in multiple documentation files and code comments
3. **Operational importance** — Critical for understanding protocol safety mechanisms
4. **User-facing concepts** — Emergency procedures and governance are key user concerns

---

## Consistency with Existing Documentation

The new terms follow established glossary conventions:
- General domain terms without parenthesized identifiers
- Code-mapped terms include parenthesized identifier (e.g., `PauseReason`)
- Brief, precise definitions aligned with source code semantics
- Cross-references to related terms where applicable

---

## How to Verify

1. Review updated glossary in `docs/GLOSSARY.md`
2. Cross-reference terms with contract implementations:
   - `contracts/vault/src/lib.rs` — `PauseReason`, `DataKey`, `VaultError`
   - `contracts/vault/src/emergency.rs` — `EmergencyActionKind`, `EmergencyProposal`
   - `contracts/vault/src/permissions.rs` — `MultiSignerValidator`, `GovernanceConfig`
3. Verify Table of Contents links navigate to correct sections

---

## References

- Source implementation: `contracts/vault/src/lib.rs`
- Emergency module: `contracts/vault/src/emergency.rs`
- Permissions module: `contracts/vault/src/permissions.rs`
- Upgrade module: `contracts/vault/src/upgrade.rs`

---

**PR Status:** Ready for review
**Closes:** #763