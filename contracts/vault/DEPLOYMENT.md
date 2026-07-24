# 🏦 YieldVault-RWA: Deployment & Operations Runbook

This document provides the necessary steps for deploying, initializing, and auditing the YieldVault-RWA smart contract on Stellar.

---

## 🛠 Pre-Deployment Checklist
- [ ] **Build:** `cargo build --target wasm32-unknown-unknown --release`
- [ ] **Optimize:** `soroban contract optimize --wasm target/wasm32-unknown-unknown/release/yield_vault_rwa.wasm`
- [ ] **Network:** Target network configured (e.g., `testnet` or `mainnet`).
- [ ] **Funding:** Deployer account has sufficient XLM.

---

## 🚀 Deployment Steps

### 1. Deploy the Contract
```bash
# This returns the CONTRACT_ID
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/yield_vault_rwa.optimized.wasm \
  --source deployer \
  --network testnet

soroban contract invoke \
  --id <PASTE_CONTRACT_ID_HERE> \
  --source deployer \
  --network testnet \
  -- \
  initialize \
  --admin <ADMIN_ADDRESS> \
  --token <TOKEN_ADDRESS>
```

---

## 🆙 Upgrade Procedures

To upgrade the contract code:

1. **Build and Optimize** the new WASM as described in the checklist.
2. **Install** the new WASM on the network to obtain its hash:
   ```bash
   soroban contract install --wasm <NEW_WASM> --network testnet
   ```
3. **Pause the Vault** (Critical Safety Check):
   ```bash
   soroban contract invoke --id <CONTRACT_ID> --source admin --network testnet -- set_pause --paused true
   ```
4. **Execute Upgrade**:
   ```bash
   soroban contract invoke --id <CONTRACT_ID> --source admin --network testnet -- upgrade --new_wasm_hash <WASM_HASH>
   ```
5. **Verify Version**:
   ```bash
   soroban contract invoke --id <CONTRACT_ID> --network testnet -- version
   ```
6. **Resume Operations**:
   ```bash
   soroban contract invoke --id <CONTRACT_ID> --source admin --network testnet -- set_pause --paused false
   ```