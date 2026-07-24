# Contract Upgrade & Migration Playbook

**Purpose:** Guide contract teams through safe Stellar Soroban contract upgrades, on-chain migration steps, rollback strategy, and post-upgrade validation.

**Scope:**
- In-place upgrades using the Vault contract's `upgrade(new_wasm_hash)` function
- Contract deployments on Soroban Testnet and Mainnet
- Code and state migration steps for YieldVault contract version changes
- Rollback actions when an upgrade fails or post-upgrade verification does not pass

**When to Use This Runbook:**
- Deploying a new contract version to an existing vault instance
- Upgrading contract code after security or functional changes
- Migrating state during a contract version transition
- Pausing vault operations for a safe code upgrade

**Assumptions:**
- The Vault contract is already deployed and initialized
- The Vault supports the on-chain `upgrade(new_wasm_hash)` admin function
- The admin key is available and authorized for contract upgrades
- Contract state is preserved by Soroban during on-chain code upgrades

---

## Prerequisites

### Required Access
- [ ] Admin account secret key for contract `upgrade` and `set_pause`
- [ ] Access to the Stellar account that owns the deployed contract
- [ ] RPC endpoint credentials for the target network (testnet/mainnet)
- [ ] Access to frontend/backend config where the contract ID is stored

### Required Tools
- [ ] `cargo` and Rust toolchain
- [ ] Soroban CLI (`soroban`)
- [ ] Access to contract build artifacts and WASM binary
- [ ] `jq`, `curl`, or equivalent for verification calls
- [ ] Version control access for deployment documentation

### Required Information
- [ ] Current deployed contract ID
- [ ] Current deployed WASM hash and previous WASM hash
- [ ] New WASM binary path and optimized hash
- [ ] Deployment ticket or change request number
- [ ] Communication channel / incident channel for operators

---

## 1. Pre-Upgrade Checks

### 1.1 Operational Preconditions

- [ ] Confirm the current network and contract ID
- [ ] Confirm admin account has sufficient XLM for transaction fees
- [ ] Ensure there are no in-flight deposit/withdrawal operations
- [ ] Confirm a clean `git` working tree — the upgrade build must be produced from an audited, tagged commit
- [ ] Record the current `version()` and `total_assets()` values for comparison after upgrade

```bash
soroban contract invoke --id <CONTRACT_ID> --network <network> -- version
soroban contract invoke --id <CONTRACT_ID> --network <network> -- total_assets
soroban contract invoke --id <CONTRACT_ID> --network <network> -- total_shares
```

### 1.2 Build & Deployment Preconditions

- [ ] Run contract unit and integration tests — all must pass:
  ```bash
  cargo test
  ```
- [ ] Build release WASM binary:
  ```bash
  cargo build --target wasm32-unknown-unknown --release
  ```
- [ ] Optimize the WASM binary:
  ```bash
  soroban contract optimize \
    --wasm target/wasm32-unknown-unknown/release/yield_vault_rwa.wasm
  ```
- [ ] Install the optimized WASM on the target network to obtain the hash:
  ```bash
  soroban contract install \
    --wasm target/wasm32-unknown-unknown/release/yield_vault_rwa.optimized.wasm \
    --network <network>
  ```
- [ ] Record the returned `NEW_WASM_HASH`
- [ ] Preserve previous deployment artifacts — old WASM hash, binary, and any pre-upgrade state snapshot

### 1.3 Validate Storage Layout Changes

- [ ] Confirm storage layout changes are documented and backward-compatible
- [ ] If new storage keys are introduced, ensure the migration path is defined
- [ ] If storage keys are removed or renamed, confirm no active data will be lost
- [ ] Verify that upgrade has been tested end-to-end on a staging/testnet environment first

### 1.4 Prepare Rollback Artifacts

- [ ] Record and securely store the current WASM hash:
  ```bash
  soroban contract info --id <CONTRACT_ID> --network <network>
  ```
- [ ] Store the prior WASM binary artifact for rollback
- [ ] Export current contract configuration and owner/admin information
- [ ] Ensure monitoring and alerting are active for the target contract

### 1.5 Coordinate with Stakeholders

- [ ] Notify operations, support, and governance stakeholders before the upgrade
- [ ] Publish planned maintenance window if applicable
- [ ] Confirm target network (testnet, staging, mainnet)
- [ ] Identify monitoring dashboards and event streams to observe during the upgrade
- [ ] Confirm rollback readiness with the operations team

---

## 2. Upgrade & Migration Steps

### 2.1 Pause the Vault

Halt vault operations to prevent user activity during the upgrade:

```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source <admin> \
  --network <network> \
  -- set_pause --paused true
```

Confirm pause status before proceeding:

```bash
soroban contract invoke --id <CONTRACT_ID> --network <network> -- paused
# Expected output: true
```

### 2.2 Execute the Upgrade

Upgrade the contract code to the new WASM hash:

```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source <admin> \
  --network <network> \
  -- upgrade --new_wasm_hash <NEW_WASM_HASH>
```

- Confirm the transaction is successful and record the transaction ID and ledger sequence.

### 2.3 Post-Upgrade State Migration (if required)

> **Note:** YieldVault upgrade semantics are designed to preserve Soroban instance storage. Only execute a migration call if the new contract version explicitly defines one.

If the upgrade includes storage key additions, renames, or data transformations:

1. Perform the migration in a staging/test environment first.
2. Execute the documented migration call:
   ```bash
   soroban contract invoke \
     --id <CONTRACT_ID> \
     --source <admin> \
     --network <network> \
     -- migrate_state --params ...
   ```
3. Verify migrated values match expected pre-upgrade state.
4. Document any manual data updates or key renames.

### 2.4 Verify Upgrade Success

Confirm the new contract version is active:

```bash
soroban contract invoke --id <CONTRACT_ID> --network <network> -- version
# Must return the expected new version
```

Confirm storage consistency for key contract state values:

```bash
soroban contract invoke --id <CONTRACT_ID> --network <network> -- total_assets
soroban contract invoke --id <CONTRACT_ID> --network <network> -- total_shares
soroban contract invoke --id <CONTRACT_ID> --network <network> -- admin
```

Values must match the pre-upgrade snapshot. Confirm the contract remains paused before resuming.

### 2.5 Resume Normal Operations

Resume the Vault only after all verification passes:

```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source <admin> \
  --network <network> \
  -- set_pause --paused false
```

Confirm pause is cleared:

```bash
soroban contract invoke --id <CONTRACT_ID> --network <network> -- paused
# Expected output: false
```

---

## 3. Rollback Strategy

### 3.1 Rollback Conditions

Initiate rollback immediately if any of the following occur:

- Upgrade transaction fails on-chain
- `version()` does not return the expected updated value
- Critical post-upgrade verification checks fail
- `total_assets()` or `total_shares()` do not match pre-upgrade snapshot
- Smoke tests for deposit/withdrawal revert or produce unexpected results
- Production monitoring reports abnormal errors or execution failures

### 3.2 Rollback Option A: Revert to Previous WASM Hash

Use when state is intact and the prior code hash is available. Keep the vault paused and execute:

```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source <admin> \
  --network <network> \
  -- upgrade --new_wasm_hash <PREVIOUS_WASM_HASH>
```

Confirm the rollback transaction succeeds, then verify `version()` returns the previous value and re-run smoke tests before resuming.

### 3.3 Rollback Option B: Deploy Separate Fallback Contract

Use when the upgrade introduced incompatible storage changes or the instance is irrecoverable:

1. Deploy a new contract instance from the previous stable binary.
2. Migrate or replay state as required.
3. Update all off-chain configurations (frontend, backend, monitoring) to point to the fallback contract ID.
4. Notify users and operators of the new contract address.

### 3.4 State Corruption & Recovery

If rollback restores code but state is corrupted:

- Do **not** resume user-facing operations.
- Escalate to the security/engineering team immediately.
- Follow the [Full DR Procedure](./FULL_DR_PROCEDURE.md) and [Database Restore](./DATABASE_RESTORE.md) runbooks as applicable.
- Preserve all post-upgrade logs and transaction evidence for root-cause analysis.

---

## 4. Post-Upgrade Verification

### 4.1 Core Contract Validation

- [ ] `version()` returns the new expected version
- [ ] `paused` status is `false`
- [ ] `total_assets()` matches the pre-upgrade snapshot
- [ ] `total_shares()` matches the pre-upgrade snapshot
- [ ] `admin()` returns the correct admin address

### 4.2 Functional Smoke Tests

Run using a trusted wallet or dedicated test account:

- [ ] Deposit a small amount of USDC and confirm share minting:
  ```bash
  soroban contract invoke --id <CONTRACT_ID> --source <test_user> --network <network> \
    -- deposit --user <test_user> --amount 1000000
  ```
- [ ] Withdraw a small amount and confirm asset redemption
- [ ] Confirm `balance(<test_address>)` reflects correct share balance
- [ ] Confirm events are emitted for `deposit`, `withdraw`, and `upgrade`
- [ ] Confirm `set_pause` and governance-related calls behave normally

### 4.3 Monitoring & Alerts

- [ ] Verify contract events emit correctly via Soroban RPC
- [ ] Confirm RPC health and contract call response times are normal
- [ ] Check backend and frontend log streams for contract invocation failures
- [ ] Confirm webhook consumers are receiving contract upgrade events
- [ ] Confirm off-chain services are reading the correct contract ID
- [ ] Verify no repeated `API_503` or `transaction failed` errors after the upgrade
- [ ] On mainnet: monitor for at least one complete Stellar ledger cycle (~5 seconds/ledger) and confirm stable metrics

### 4.4 Deployment Artifact Verification

Update deployment metadata with:
- [ ] Contract ID
- [ ] New WASM hash
- [ ] Previous WASM hash (for rollback reference)
- [ ] Git commit SHA
- [ ] Network name
- [ ] Upgrade transaction ID and ledger sequence
- [ ] Timestamp of upgrade

Store the artifact in the release tracking system.

### 4.5 Documentation & Post-Mortem

- [ ] Update deployment notes with actual contract ID, WASM hashes, and ledger sequences
- [ ] Record final verification results
- [ ] If any issues occurred, document root cause and corrective actions
- [ ] Notify stakeholders that the upgrade is complete
- [ ] Update this runbook if the deployment path changed

---

## 5. Testing the Playbook

### 5.1 Test Verification Checklist

- [ ] Perform the full upgrade flow first on Soroban Testnet
- [ ] Execute pause → upgrade → verify → resume steps end-to-end
- [ ] Validate that rollback works by intentionally reverting to the prior WASM hash in staging
- [ ] Confirm `total_assets()` and `total_shares()` remain consistent before and after upgrade
- [ ] Confirm deployment artifacts capture the correct hash and transaction IDs

### 5.2 Acceptance Criteria

- The upgrade completes successfully on testnet before any mainnet attempt
- The Vault remains paused during code migration and is resumed only after all verification passes
- Rollback has been tested and confirmed to work in staging
- Post-upgrade smoke tests pass
- Monitoring shows no contract-level failures after the upgrade

---

## 6. Related Documentation

- [`docs/CONTRACTS_ARCHITECTURE.md`](../CONTRACTS_ARCHITECTURE.md) — Contract module responsibilities and interface reference
- [`docs/SECURITY_CHECKLIST.md`](../SECURITY_CHECKLIST.md) — Pre-deployment security requirements
- [`docs/runbooks/FULL_DR_PROCEDURE.md`](./FULL_DR_PROCEDURE.md) — Full disaster recovery procedure
- [`docs/runbooks/DATABASE_RESTORE.md`](./DATABASE_RESTORE.md) — Database restoration runbook
- [`docs/runbooks/README.md`](./README.md) — Runbook index

**Last Updated:** June 2026  
**Issue:** [#578](https://github.com/Junirezz/YieldVault-RWA/issues/578)
