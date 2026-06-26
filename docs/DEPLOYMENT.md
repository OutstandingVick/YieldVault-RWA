# 🚀 YieldVault-RWA: Deployment & Operations Runbook

This document defines the requirements, constraints, and step-by-step procedures for building and deploying the YieldVault-RWA smart contracts to the Stellar network.

---

## 📌 Toolchain Version Pinning

To ensure reproducible builds and prevent contract size optimization issues or unexpected runtime anomalies (e.g., protocol version mismatches, transaction resource exhaustion, or deserialization failures), the toolchain versions are strictly pinned:

| Component | Target Version | Check Command |
|---|---|---|
| **Stellar CLI** | `v23.0.1` | `stellar --version` (or `soroban --version`) |
| **Rust Toolchain** | `1.79.0` | `rustc --version` |
| **WASM Target** | `wasm32-unknown-unknown` | `rustup target list \| grep installed` |

---

## 🛠 Pre-Deployment Checklist

1. **Verify Tool Versions:** Run the deployment script or verify manually that your environment matches the target versions listed above.
2. **Build Contracts:** Compile the contracts using the correct target:
   ```bash
   cargo build --target wasm32-unknown-unknown --release
   ```
3. **Optimize WASM:** Optimize the compiled contract to reduce gas costs and meet size limitations:
   ```bash
   soroban contract optimize --wasm target/wasm32-unknown-unknown/release/vault.wasm
   ```
4. **Funding:** Ensure the deployer account has sufficient XLM to cover deployment fees.

---

## 🚀 Deployment Steps

### 1. Deploy the Contract
Run the deploy script or execute the commands manually:

```bash
# This returns the CONTRACT_ID
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/vault.optimized.wasm \
  --source deployer \
  --network testnet
```

### 2. Initialize the Vault
Invoke the `initialize` function on the newly deployed contract:

```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
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
