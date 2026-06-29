# YieldVault-RWA: Contract Threat Model & Trust Boundaries

**Target Network:** Stellar Soroban
**Language:** Rust (compiled to WebAssembly)
**soroban-sdk Version:** 22.0.0
**Last Updated:** June 27, 2026

---

## 1. Overview

This document defines the threat model, trust assumptions, and trust boundaries for the YieldVault-RWA smart contract architecture. It is intended for security reviewers, auditors, and contributors to understand the security properties of the system and the assumptions that underpin its safe operation.

---

## 2. Trust Model & Assumptions

### 2.1 Core Trust Assumptions

| # | Assumption | Rationale | Risk if Violated |
|---|-----------|-----------|-----------------|
| A1 | The vault admin is a trusted entity that will not act maliciously. | Admin controls critical operations (upgrade, pause, invest, divest, fee config). | Total loss of user funds, freeze, or theft. |
| A2 | The underlying token (USDC) behaves correctly according to the Stellar Asset Contract (SAC) interface. | The vault relies on standard `transfer`, `balance`, `approve` semantics. | Incorrect accounting, fund loss, or lock. |
| A3 | The active strategy contract is non-malicious and correctly implements `StrategyTrait`. | The vault delegates asset management to the strategy. | Theft of invested assets, yield manipulation. |
| A4 | The Stellar blockchain provides atomic execution and finality guarantees. | Soroban contract execution is atomic per transaction. | Not applicable — guaranteed by Stellar consensus. |
| A5 | Oracle price data (when enabled) is from a trusted source with bounded deviation. | Oracle validation checks freshness and deviation but does not verify source authenticity. | Manipulated pricing enables value extraction. |
| A6 | Authorized users control their own private keys and signing operations. | Standard Stellar/Freighter assumption. | Unauthorized deposits/withdrawals. |
| A7 | Governance signers are distinct, trusted entities with no collusion. | M-of-N multisig controls critical governance decisions. | Governance capture, malicious proposals. |
| A8 | Emergency approvers (primary and secondary) are distinct, non-colluding entities. | Dual-approval emergency actions require two independent parties. | Unilateral emergency actions without checks. |
| A9 | Strategy contract addresses are verified before whitelisting. | Admin whitelists strategies before they can receive funds. | Malicious strategy theft of invested assets. |

### 2.2 Non-Goals & Out-of-Scope

| Scenario | Reason |
|----------|--------|
| Stellar consensus-layer attacks (e.g., 51% attack) | Outside smart contract scope — handled by Stellar network security. |
| Phishing attacks on users | Outside contract scope — user responsibility. |
| Compromise of off-chain infrastructure (backend, frontend, relayer) | Mitigated by contract-level guards (relayer whitelist, auth). |
| Liquidity crises due to market conditions | Managed by admin param guards, not directly by contract logic. |
| Zero-day vulnerabilities in Soroban SDK or Rust compiler | Mitigated by using pinned SDK version and following security advisories. |

---

## 3. Trust Boundary Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        UNTRUSTED (Public)                               │
│                                                                         │
│  ┌──────────┐   ┌───────────┐   ┌────────────┐   ┌──────────────────┐  │
│  │ End Users│   │  Relayers │   │ Governance │   │  External Callers │  │
│  │(deposit/ │   │(batch     │   │ Signers    │   │  (any address)    │  │
│  │ withdraw)│   │ deposits) │   │ (M-of-N)   │   │                   │  │
│  └────┬─────┘   └─────┬─────┘   └──────┬─────┘   └────────┬─────────┘  │
│       │               │                │                   │            │
├───────┴───────────────┴────────────────┴───────────────────┴────────────┤
│                         TRUST BOUNDARY                                  │
│                      (Contract Authorization)                           │
├───────┬───────────────┬────────────────┬───────────────────┬────────────┤
│       │               │                │                   │            │
│  ┌────┴─────┐   ┌─────┴─────┐   ┌──────┴──────┐   ┌───────┴────────┐   │
│  │   Vault  │   │  USDC SAC │   │  Strategies │   │   Oracle(s)   │   │
│  │ Contract │◄──┤  (Token)  │◄──┤  (Active)   │   │   (Planned)   │   │
│  │          │   │           │   │             │   │               │   │
│  └──────────┘   └───────────┘   └─────────────┘   └───────────────┘   │
│                                                                         │
│                      TRUSTED (Privileged)                               │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐         │
│  │    Admin (Single)       │  │  Emergency Approvers (2-of-2)│         │
│  │  - upgrade / pause      │  │  - emergency pause/unpause  │         │
│  │  - invest / divest      │  │  - emergency divest         │         │
│  │  - fee config           │  │  - force upgrade             │         │
│  │  - whitelist strategies │  │                              │         │
│  │  - set params           │  │                              │         │
│  └─────────────────────────┘  └──────────────────────────────┘         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Boundary Interpretation

- **Public → Contract Boundary**: Crossed when users call `deposit()`, `withdraw()`, or query functions. Requires valid Soroban signature.
- **Relayer → Contract Boundary**: Crossed for `batch_deposit()`. Requires relayer whitelist membership.
- **Governance → Contract Boundary**: Crossed during `create_strategy_proposal()`, `vote_on_proposal()`. Requires M-of-N threshold.
- **Strategy → Contract Boundary**: Crossed during `invest()`/`divest()`. Requires active registration and whitelist.
- **Admin → Contract Boundary**: Crossed for all privileged operations. Requires admin signature.
- **Emergency → Contract Boundary**: Crossed during emergency proposals/execution. Requires 2-of-2 distinct approvers.

---

## 4. Threat Scenarios

### 4.1 Unauthorized Share Minting

| Property | Detail |
|----------|--------|
| **Threat** | Attacker mints vault shares without depositing corresponding USDC. |
| **Attack Vector** | Direct call to `deposit()` with invalid amount; exploiting rounding to mint free shares; front-running yield accrual. |
| **Impact** | Share dilution, theft from existing depositors. |
| **Likelihood** | Low |
| **Severity** | Critical |
| **Mitigations** | `require_auth()` ensures user signed; round-down conversion prevents over-minting; zero-share deposits rejected (`InvalidAmount`); CEI pattern with state update before token transfer. |
| **Residual Risk** | None if mitigations correctly enforced. |

### 4.2 Admin Abuse / Compromised Admin Key

| Property | Detail |
|----------|--------|
| **Threat** | Admin private key is compromised or admin acts maliciously. |
| **Attack Vector** | `upgrade()` to malicious WASM; `divest()` all strategy funds to attacker; `set_fee_bps(10000)` to capture 100% of yield; `pause()` to lock all users. |
| **Impact** | Total loss of user funds. |
| **Likelihood** | Low (single key compromise) |
| **Severity** | Critical |
| **Mitigations** | Two-step admin transfer (`propose_admin`/`accept_admin`); admin param change interval guard (default 3600s); emergency dual-approver can pause/divest/upgrade independently; governance M-of-N can override. |
| **Residual Risk** | During param change interval window, a compromised admin can change one sensitive parameter before being stopped. |

### 4.3 Malicious Strategy Contract

| Property | Detail |
|----------|--------|
| **Threat** | A whitelisted strategy contract behaves maliciously. |
| **Attack Vector** | Strategy `total_value()` returns inflated value; strategy `withdraw()` reverts or returns less than expected; strategy drains approved tokens. |
| **Impact** | Incorrect share pricing, withdrawal failure, loss of invested assets. |
| **Likelihood** | Low (requires admin to whitelist malicious strategy) |
| **Severity** | High |
| **Mitigations** | Strategy must be whitelisted by admin; registration lifecycle (Pending → Active → Retired); strategy heartbeat expiration check; `divest()` measures actual token balance received; oracle validation (when enabled) checks strategy values; strategy cap and risk threshold limits. |
| **Residual Risk** | Oracle integration is not yet active; without it, `total_assets()` trusts strategy `total_value()` output. |

### 4.4 Oracle Manipulation

| Property | Detail |
|----------|--------|
| **Threat** | Attacker manipulates oracle price feed to extract value from the vault. |
| **Attack Vector** | Stale price exploited; flash loan + price manipulation to cause incorrect share conversion; cross-price manipulation. |
| **Impact** | Incorrect asset valuation, unfair share conversions. |
| **Likelihood** | Medium (when oracle is enabled) |
| **Severity** | High |
| **Mitigations** | Multi-layer validation: heartbeat check (default 3600s), 50% max price deviation circuit breaker, zero/negative/future timestamp checks, overflow protection, max 30 decimals. All validations use **REVERT on failure** — no fallback to stale prices. |
| **Residual Risk** | Oracle validation is planned but not yet wired into vault operations. Strategy values are currently trusted without oracle cross-check. |

### 4.5 Large Withdrawal Timelock Bypass

| Property | Detail |
|----------|--------|
| **Threat** | Attacker bypasses the 24-hour timelock on large withdrawals. |
| **Attack Vector** | Splitting withdrawal into multiple below-threshold transactions; manipulating `total_assets()` to reduce apparent withdrawal value; direct token transfer from strategy. |
| **Impact** | Sudden large withdrawal without delay, bypassing risk management. |
| **Likelihood** | Low |
| **Severity** | Medium |
| **Mitigations** | Threshold check is on computed asset value, not user-submitted — splitting below threshold is a legitimate pattern (not an attack). Threshold is admin-configured. Pending withdrawals are immutable once created. |
| **Residual Risk** | Users can make multiple below-threshold withdrawals — this is by design for UX. |

### 4.6 Reentrancy / Cross-Contract Call Manipulation

| Property | Detail |
|----------|--------|
| **Threat** | Attacker exploits cross-contract call order to re-enter vault and manipulate state. |
| **Attack Vector** | Malicious strategy re-enters vault during `invest()`/`divest()`; token callback re-entrancy during `transfer()`. |
| **Impact** | State inconsistency, double-withdrawal, fund loss. |
| **Likelihood** | Very Low (Soroban atomic execution model) |
| **Severity** | High |
| **Mitigations** | Soroban provides inherent reentrancy protection (atomic execution frames); CEI pattern used in all state-changing functions; external calls are always after state updates; `cei_pattern!` macro documents the pattern at each call site. |
| **Residual Risk** | Negligible given Soroban's architecture. |

### 4.7 Governance Attack / Vote Manipulation

| Property | Detail |
|----------|--------|
| **Threat** | Attacker passes a malicious governance proposal. |
| **Attack Vector** | Acquiring voting weight to pass strategy change; duplicate voting; sybil attack on proposals. |
| **Impact** | Malicious strategy activated, funds at risk. |
| **Likelihood** | Low |
| **Severity** | High |
| **Mitigations** | Duplicate vote prevention (unique `VoteKey`); weight must be > 0; quorum threshold (`DaoThreshold`) required; yes votes must exceed no votes; M-of-N governance signer threshold for critical operations; migration-safe signer updates. |
| **Residual Risk** | Vote weight is currently unchecked — any address can vote with any weight. Vote-weight based on share balance is not yet implemented. |

### 4.8 Withdrawal Queue Manipulation

| Property | Detail |
|----------|--------|
| **Threat** | Attacker manipulates the FIFO withdrawal queue to jump ahead of other users. |
| **Attack Vector** | Front-running queue processing; enqueuing multiple small withdrawals; exploiting admin param change timing. |
| **Impact** | Queue ordering violated, unfair processing. |
| **Likelihood** | Low |
| **Severity** | Medium |
| **Mitigations** | FIFO ordering enforced by sequential `head`/`tail` pointers; entries are immutable once enqueued; admin param change interval prevents rapid reconfiguration that could affect queue processing. |
| **Residual Risk** | Admin can process queue with `max_entries` limit — partial processing is transparent due to immutable head pointer. |

### 4.9 Treasury Fee Accumulation Attack

| Property | Detail |
|----------|--------|
| **Threat** | Treasury accumulator overflow or excessive fee accumulation blocks future fee collection. |
| **Attack Vector** | Accumulating fees beyond `i128::MAX / 2` causes overflow; treasury balance becomes unusable. |
| **Impact** | Lost fee revenue, protocol insolvency. |
| **Likelihood** | Low |
| **Severity** | Medium |
| **Mitigations** | Bounded accumulator at `i128::MAX / 2`; overflow fees routed to `TreasuryRolloverExcess`; `claim_all_fees()` claims both primary and rollover balances; epoch-based claim quotas prevent single large claim. |
| **Residual Risk** | Accumulator bound is implementation-controlled — safe unless deliberately bypassed. |

---

## 5. Attack Surface Summary

| Component | Attack Surface | Exposure |
|-----------|---------------|----------|
| **`deposit()`** | Input validation, share calculation, token transfer | Public |
| **`withdraw()`** | Input validation, share calculation, large-withdrawal threshold, token transfer, cooldown check | Public |
| **`invest()`** | Strategy call, token approval, cap/risk checks | Admin |
| **`divest()`** | Strategy call, actual balance measurement | Admin |
| **`rebalance()`** | Double strategy call, slippage validation | Admin |
| **`accrue_yield()`** | Token transfer, fee calculation, share price invariant | Admin |
| **`report_benji_yield()`** | Strategy callback authentication, fee calculation | Whitelisted strategy |
| **`upgrade()`** | WASM deployment | Admin |
| **`set_strategy()`** | Strategy whitelist check, registration transition | Admin |
| **`batch_deposit()`** | Relayer auth, batch size limits, per-entry validation | Whitelisted relayer |
| **Oracle (future)** | Price data validation, heartbeat, deviation | Public reads |
| **Emergency proposals** | Dual-approver auth, dispute window, kind checks | Primary + secondary approvers |
| **Governance** | Signer threshold, migration mode, vote dedup | Governance signers |

---

## 6. Known Limitations & Accepted Risks

1. **Oracle not yet integrated** (`docs/CONTRACTS_ARCHITECTURE.md` §10): Strategy `total_value()` is trusted without cross-validation. Accepting this risk until oracle integration is complete.

2. **Vote weight not bound to share balance**: Any address can vote with arbitrary weight. Accepting this risk — governance is currently admin-gated and the voting mechanism is a placeholder for future weighted voting.

3. **Single active strategy**: No diversification across multiple strategies. Accepting this risk — multi-strategy allocation is a planned feature.

4. **No emergency withdrawal for users during pause**: Users cannot withdraw if admin pauses the vault. Accepting this risk — pause is reserved for emergencies and admin is expected to unpause after resolution.

5. **Storage TTL not explicitly extended**: Soroban instance storage auto-extends on contract invocation, but no dedicated heartbeat extends TTL. Accepting this risk — regular usage provides implicit extension.

---

## 7. Security Testing Coverage

| Scenario | Covered By |
|----------|-----------|
| Unauthorized access to admin functions | Integration tests, auth gating tests |
| Overflow/underflow in share math | Fuzz tests (10,000+ iterations), property tests |
| Deposit/withdraw round-trip invariance | `test::test_deposit_withdraw_scenarios` |
| Pause/unpause state enforcement | `test::test_pause` |
| Large withdrawal timelock | `test::test_large_withdrawal` |
| Strategy registration lifecycle | `strategy_registration::test_allowed_transitions` |
| Oracle price validation | `oracle_tests::test_*` (10+ tests) |
| Emergency dual-approver flow | `test::test_emergency_action_*` |
| Governance threshold enforcement | `permissions::test_threshold_*` |
| Whitelist auth checks | `test::test_whitelist_strategy` |
| Relayer authorization | `test::test_batch_deposit_relayer_auth` |
| Admin param change interval | `guard_checks_test::*` |

---

## 8. References

- **Architecture Document**: [`CONTRACTS_ARCHITECTURE.md`](./CONTRACTS_ARCHITECTURE.md)
- **Security Checklist**: [`SECURITY_CHECKLIST.md`](./SECURITY_CHECKLIST.md)
- **Production Security**: [`PRODUCTION_SECURITY_CHECKLIST.md`](./PRODUCTION_SECURITY_CHECKLIST.md)
- **False Positives**: [`../contracts/.false-positives.md`](../contracts/.false-positives.md)
- **Soroban Security Model**: https://developers.stellar.org/docs/soroban/security
- **STRIDE Methodology**: https://en.wikipedia.org/wiki/STRIDE_(security)

---

**Document Version:** 1.0
**Created:** June 27, 2026
**Maintainers:** YieldVault Development Team
