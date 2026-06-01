# Contract Upgrade & Migration Playbook

<<<<<<< HEAD
**Purpose:** Guide contract teams through safe Stellar Soroban contract upgrades, on-chain migration steps, rollback strategy, and post-upgrade validation.

**When to Use This Runbook**
- Deploying a new contract version to an existing vault instance
- Upgrading contract code after security or functional changes
- Migrating state during a contract version transition
- Pausing vault operations for a safe code upgrade

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
- [ ] Access to contract build artifacts and wasm binary
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

### 1.1 Confirm Current Contract State
- [ ] Verify contract is currently healthy and responding
- [ ] Confirm total asset balances, share supply, and paused state
- [ ] Confirm no pending large withdrawal timelocks or DAO actions

### 1.2 Review Upgrade Preconditions
- [ ] Validate the new WASM is built from the correct commit
- [ ] Confirm all tests passed: `cargo test`, integration tests, upgrade tests
- [ ] Confirm code review and security review are complete
- [ ] Confirm storage layout changes are documented and safe

### 1.3 Prepare Rollback Artifacts
- [ ] Record current WASM hash and store it securely
- [ ] Store the prior WASM binary artifact for rollback
- [ ] Export current contract configuration and owner admin information
- [ ] Ensure monitoring and alerting are active for the target contract

### 1.4 Coordinate with Stakeholders
- [ ] Notify operations and support channels before the upgrade
- [ ] Publish planned maintenance window if applicable
- [ ] Confirm target network (testnet, staging, mainnet)
- [ ] Verify backup of off-chain configuration values

---

## 2. Migration & Upgrade Steps

### 2.1 Build & Install New WASM
1. Build release binary:
```bash
cargo build --target wasm32-unknown-unknown --release
```
2. Optimize the produced WASM:
```bash
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/yield_vault_rwa.wasm
```
3. Install the optimized WASM to get a hash:
```bash
soroban contract install --wasm target/wasm32-unknown-unknown/release/yield_vault_rwa.optimized.wasm --network <network>
```
4. Record the returned `WASM_HASH`.

### 2.2 Pause the Vault
- Ensure vault operations are halted before code upgrade.
- Execute:
```bash
soroban contract invoke --id <CONTRACT_ID> --source <admin> --network <network> -- set_pause --paused true
```
- Confirm paused state:
```bash
soroban contract invoke --id <CONTRACT_ID> --source <admin> --network <network> -- paused
```

### 2.3 Execute Upgrade
- Upgrade contract code to the new WASM hash:
```bash
soroban contract invoke --id <CONTRACT_ID> --source <admin> --network <network> -- upgrade --new_wasm_hash <WASM_HASH>
```
- Confirm transaction success and note the ledger sequence.

### 2.4 Optional State Migration
If the upgrade includes state migration or new storage keys:
- Perform the migration in a staging/test environment first.
- Use contract-level migration functions if available.
- Verify migrated values match expected pre-upgrade state.
- Document any manual data updates or key renames.

### 2.5 Resume Normal Operations
- Once upgrade verification passes, unpause the vault:
```bash
soroban contract invoke --id <CONTRACT_ID> --source <admin> --network <network> -- set_pause --paused false
```
- Confirm vault is active and accepting deposits/withdrawals.

---

## 3. Rollback Strategy

### 3.1 Rollback Preconditions
- [ ] Keep the previous WASM hash and binary accessible
- [ ] Ensure admin credentials are available
- [ ] Confirm the contract is paused before rollback
- [ ] Confirm off-chain clients can be updated if contract ID changes

### 3.2 Rollback Option A: Revert to Previous Code Hash
If the same contract instance can be rewound:
```bash
soroban contract invoke --id <CONTRACT_ID> --source <admin> --network <network> -- upgrade --new_wasm_hash <PREVIOUS_WASM_HASH>
```
- Then re-verify state and resume the vault.

### 3.3 Rollback Option B: Deploy Separate Fallback Contract
Use when the upgrade introduced incompatible storage changes or the instance is unhealthy:
1. Deploy a new contract instance from the previous stable binary.
2. Migrate or replay state as required.
3. Update off-chain configurations to point to the fallback contract.
4. Notify users and operators of the rollback.

### 3.4 Rollback Decision Criteria
- If the upgraded contract fails critical verification, initiate rollback immediately.
- If state is corrupted or contract calls fail, prefer redeploying the stable contract and re-pointing off-chain clients.
- In all cases, preserve any post-upgrade logs and transaction evidence for analysis.

---

## 4. Post-Upgrade Verification

### 4.1 Core Contract Validation
- [ ] Query contract version or upgrade timestamp
- [ ] Confirm paused status is `false`
- [ ] Confirm total asset balances match expected values
- [ ] Confirm share supply and vault accounting are consistent

### 4.2 Functional Smoke Tests
- [ ] Deposit a small amount of USDC and confirm share minting
- [ ] Withdraw a small amount and confirm asset redemption
- [ ] Confirm events are emitted for deposit/withdraw/upgrade
- [ ] Confirm `set_pause` and governance-related calls behave normally

### 4.3 Monitoring & Alerts
- [ ] Validate RPC health and contract call response times
- [ ] Confirm off-chain services are reading the correct contract ID
- [ ] Check webhook consumers for contract upgrade events
- [ ] Confirm on-call team is watching alerts for anomalies

### 4.4 Documentation & Post-Mortem
- [ ] Update deployment notes with actual contract ID, WASM hashes, and ledger sequences
- [ ] Record the final verification results
- [ ] If any issues occurred, document root cause and corrective actions
- [ ] Update this runbook if the deployment path changed

---

## 5. Related Documentation
- `docs/CONTRACTS_ARCHITECTURE.md`
- `contracts/vault/DEPLOYMENT.md`
- `docs/SECURITY_CHECKLIST.md`
- `docs/runbooks/README.md`

**Last Updated:** June 2026


- In-place upgrades using the Vault contract's `upgrade(new_wasm_hash)` function.
- Contract deployments on Soroban Testnet and Mainnet.
- Code and state migration steps for YieldVault contract version changes.
- Rollback actions when an upgrade fails or post-upgrade verification does not pass.

## Assumptions

- The Vault contract is already deployed and initialized.
- The Vault supports the on-chain `upgrade(new_wasm_hash)` admin function.
- The admin key is available and authorized for contract upgrades.
- Contract state is preserved by Soroban during on-chain code upgrades.

## 1. Pre-Upgrade Checks

### 1.1 Operational Preconditions

- [ ] Confirm the current network and contract ID.
- [ ] Confirm admin account has sufficient XLM for transaction fees.
- [ ] Ensure the current Vault contract is paused before upgrading.
- [ ] Verify there are no in-flight deposit/withdrawal operations.
- [ ] Confirm a clean `git` working tree and that the upgrade build is produced from an audited commit.
- [ ] Record the current `version()` and `total_assets()` values for comparison.

### 1.2 Build & Deployment Preconditions

- [ ] Run contract unit and integration tests.
- [ ] Build the new WASM binary:
  - `cargo build --target wasm32-unknown-unknown --release`
- [ ] Optimize the WASM binary:
  - `soroban contract optimize --wasm target/wasm32-unknown-unknown/release/yield_vault_rwa.wasm`
- [ ] Upload/install the new WASM to the network to obtain the hash:
  - `soroban contract install --wasm target/wasm32-unknown-unknown/release/yield_vault_rwa.optimized.wasm --network <network>`
- [ ] Preserve the previous deployment artifact(s), including the old WASM hash and prior contract build.

### 1.3 Stakeholder & Communication Checks

- [ ] Notify on-call and governance stakeholders of planned upgrade.
- [ ] Confirm rollback readiness with the operations team.
- [ ] Identify monitoring dashboards and event streams that must be observed during the upgrade.

## 2. Upgrade & Migration Steps

### 2.1 Pause the Vault

- Pause the Vault contract to prevent new user operations during the upgrade.
- Example:
  ```bash
  soroban contract invoke --id <CONTRACT_ID> --source admin --network <network> -- set_pause --paused true
  ```
- Confirm pause status before proceeding.

### 2.2 Apply Contract Upgrade

- Execute the upgrade using the new WASM hash:
  ```bash
  soroban contract invoke --id <CONTRACT_ID> --source admin --network <network> -- upgrade --new_wasm_hash <NEW_WASM_HASH>
  ```
- Confirm the transaction is successful and collect the transaction ID.

### 2.3 Post-Upgrade Migration Tasks

- If the new contract version requires explicit storage migration, execute the documented migration call immediately after upgrade.
- Example migration flow:
  - `soroban contract invoke --id <CONTRACT_ID> --source admin --network <network> -- migrate_state --params ...`
- Note: YieldVault upgrade semantics are designed to preserve Soroban instance storage. Only run a migration call if the new version explicitly defines one.

### 2.4 Verify Upgrade Success

- Check `version()` to confirm the new contract version is active:
  ```bash
  soroban contract invoke --id <CONTRACT_ID> --network <network> -- version
  ```
- Confirm storage consistency for key contract state values:
  - `total_assets()`
  - `total_shares()`
  - `admin()`
- Verify the contract is still paused and safe before resuming normal operations.

### 2.5 Resume Operations

- Resume the Vault only after verification passes:
  ```bash
  soroban contract invoke --id <CONTRACT_ID> --source admin --network <network> -- set_pause --paused false
  ```
- Confirm pause status is cleared.

## 3. Rollback Strategy

### 3.1 Rollback Preparation

- Preserve the prior WASM hash before performing the upgrade.
- Preserve the previous deployment artifact and any pre-upgrade state snapshot.
- Maintain a documented fallback plan if code rollback is not sufficient.

### 3.2 Rollback Conditions

Rollback if any of the following occur:

- Upgrade transaction fails.
- `version()` does not return the expected updated value.
- Critical post-upgrade verification checks fail.
- Smoke tests for deposit/withdrawal fail.
- Production monitoring reports abnormal errors or gas/execution anomalies.

### 3.3 Rollback Execution

- Pause the Vault contract if it is not already paused.
- Upgrade back to the previous WASM hash:
  ```bash
  soroban contract invoke --id <CONTRACT_ID> --source admin --network <network> -- upgrade --new_wasm_hash <PREVIOUS_WASM_HASH>
  ```
- Confirm the rollback transaction succeeds.
- Verify `version()` returns the previous contract version.
- Re-run post-rollback smoke tests.

### 3.4 State Corruption & Recovery

- If rollback restores code but state is corrupted, the issue may require manual recovery.
- Escalate to the security/engineering team and follow applicable disaster recovery runbooks.
- Do not resume user-facing operations until state integrity is confirmed.

## 4. Post-Upgrade Verification

### 4.1 Functional Smoke Tests

- Run a minimal deposit/withdrawal smoke test using a trusted wallet or test account.
- Validate the following contract calls:
  - `balance(<test_address>)`
  - `total_assets()`
  - `total_shares()`
  - `deposit(...)` and `withdraw(...)` behaviour if the Vault contract is not paused.
- Confirm all calls return expected results and do not revert.

### 4.2 Monitoring Verification

- Verify contract events continue to emit correctly via Soroban RPC.
- Check the backend and frontend log streams for any contract invocation failures.
- Confirm there are no repeated `API_503` or `transaction failed` errors after the upgrade.

### 4.3 Deployment Artifact Verification

- Update deployment metadata and artifacts with:
  - Contract ID
  - WASM hash
  - Git commit SHA
  - Network name
  - Upgrade transaction ID
- Store the artifact in the release tracking system.

### 4.4 Operational Handoff

- Notify stakeholders that the upgrade is complete.
- Record the final verification status and any anomalies.
- If the upgrade is on mainnet, monitor for at least one complete Stellar ledger cycle (~5 seconds per ledger) and confirm stable metrics.

## 5. Testing the Playbook

### 5.1 Test Verification Checklist

- [ ] Perform the upgrade first on Soroban Testnet.
- [ ] Execute the pause, upgrade, verify, and resume steps end-to-end.
- [ ] Validate that rollback works by intentionally reverting to the prior WASM hash in a staging environment.
- [ ] Confirm that state values such as `total_assets()` remain consistent before and after upgrade.
- [ ] Confirm deployment artifacts capture the correct hash and transaction IDs.

### 5.2 Acceptance Criteria

- The upgrade completes successfully on testnet.
- The Vault remains paused during code migration and is resumed only after verification.
- Rollback is possible and has been tested.
- Post-upgrade smoke tests pass.
- Monitoring shows no contract-level failures after the upgrade.
>>>>>>> 6aa6cab (Documentation: Added upgrade and migration playbook for contract deployments)
