# Contract Upgrade & Migration Playbook

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
