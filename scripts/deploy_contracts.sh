#!/usr/bin/env bash
set -euo pipefail

NETWORK="${1:-testnet}"
IDENTITY="${SOROBAN_IDENTITY:-staging}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_FILE="$ROOT_DIR/deployments/contracts.${NETWORK}.json"

if [[ "$NETWORK" != "testnet" && "$NETWORK" != "futurenet" ]]; then
  echo "Usage: $0 [testnet|futurenet]"
  exit 1
fi

echo "Verifying toolchain versions..."

# Check Stellar / Soroban CLI version (pinned to v23.0.1)
CLI_VER=""
if command -v stellar &>/dev/null; then
  CLI_VER=$(stellar --version 2>&1 || true)
elif command -v soroban &>/dev/null; then
  CLI_VER=$(soroban --version 2>&1 || true)
else
  echo "Error: Neither stellar-cli nor soroban-cli is installed."
  echo "Please install stellar-cli/soroban-cli v23.0.1 as specified in docs/DEPLOYMENT.md"
  exit 1
fi

if [[ ! "$CLI_VER" =~ "23.0.1" ]]; then
  echo "Error: CLI version mismatch. Detected version: $CLI_VER"
  echo "Required version is v23.0.1. Please align your CLI version to prevent unexpected bugs."
  exit 1
fi
echo "CLI version check passed (v23.0.1)."

# Check Rust version
if command -v rustc &>/dev/null; then
  RUST_VER=$(rustc --version 2>&1 || true)
  echo "Rust version check passed: $RUST_VER"
else
  echo "Error: Rust compiler (rustc) is not installed."
  exit 1
fi

# Ensure identity exists in CI
if ! soroban config identity ls | grep -q "$IDENTITY" 2>/dev/null; then
  if [[ -n "${SOROBAN_SECRET_KEY:-}" ]]; then
    echo "Creating soroban identity: $IDENTITY"
    soroban config identity add "$IDENTITY" --secret-key "$SOROBAN_SECRET_KEY"
  else
    echo "Using default/existing identity..."
  fi
fi

cd "$ROOT_DIR"

echo "Building WASM artifacts..."
cargo build -p vault --target wasm32-unknown-unknown --release
cargo build -p mock-strategy --target wasm32-unknown-unknown --release

VAULT_WASM="$ROOT_DIR/target/wasm32-unknown-unknown/release/vault.wasm"
STRATEGY_WASM="$ROOT_DIR/target/wasm32-unknown-unknown/release/mock_strategy.wasm"

echo "Deploying vault to $NETWORK..."
VAULT_ID=$(soroban contract deploy \
  --network "$NETWORK" \
  --source "$IDENTITY" \
  --wasm "$VAULT_WASM")

echo "Deploying mock strategy to $NETWORK..."
STRATEGY_ID=$(soroban contract deploy \
  --network "$NETWORK" \
  --source "$IDENTITY" \
  --wasm "$STRATEGY_WASM")

cat > "$OUT_FILE" <<JSON
{
  "network": "$NETWORK",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "identity": "$IDENTITY",
  "contracts": {
    "vault": "$VAULT_ID",
    "mock_korean_strategy": "$STRATEGY_ID"
  }
}
JSON

echo "Deployment complete."
echo "Vault: $VAULT_ID"
echo "Mock Strategy: $STRATEGY_ID"
echo "Saved to $OUT_FILE"
