#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# smoke-test.sh — Phase 3 testnet smoke tests
#
# Modes (SMOKE_TEST_MODE):
#   deploy       — Deploy vault WASM to testnet, run on-chain checks, write deployment.json
#   cross-stack  — Load deployment metadata, run getSharePrice unit tests, probe backend
#
# Deploy mode required environment variables:
#   TESTNET_SECRET_KEY     — Stellar secret key (S... format) for the deployer account
#   TESTNET_TOKEN_ADDRESS  — Stellar contract address (C... format) for the token
#   GIT_SHA                — Git commit SHA to embed in deployment.json
#
# Cross-stack mode environment variables:
#   DEPLOYMENT_FILE        — Path to deployment.json (default: ./deployment.json)
#   BACKEND_URL            — Backend base URL (default: http://localhost:3000)
#   VITE_SOROBAN_RPC_URL   — Optional Soroban RPC override
# ---------------------------------------------------------------------------

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MODE="${SMOKE_TEST_MODE:-deploy}"

log() {
  printf '[smoke-test] %s\n' "$1"
}

fail() {
  printf '[smoke-test] ERROR: %s\n' "$1" >&2
  exit 1
}

run_cross_stack_smoke() {
  local deployment_file="${DEPLOYMENT_FILE:-$ROOT_DIR/deployment.json}"
  local backend_url="${BACKEND_URL:-http://localhost:3000}"
  local vault_id
  local rpc_url="${VITE_SOROBAN_RPC_URL:-https://soroban-testnet.stellar.org}"
  local passphrase="${VITE_STELLAR_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"

  if [[ ! -f "$deployment_file" ]]; then
    fail "Deployment file not found: $deployment_file"
  fi

  vault_id="$(jq -r '.contract_id // .contracts.vault // empty' "$deployment_file")"

  export VITE_SOROBAN_RPC_URL="$rpc_url"
  export VITE_STELLAR_NETWORK_PASSPHRASE="$passphrase"
  export VITE_API_BASE_URL="${VITE_API_BASE_URL:-$backend_url/api/v1}"

  if [[ -n "$vault_id" ]]; then
    export VITE_VAULT_CONTRACT_ID="$vault_id"
    log "Cross-stack mode: contract=$vault_id backend=$backend_url"
  else
    log "Cross-stack mode: no contract ID in $deployment_file (mocked frontend checks only)"
    log "Backend URL: $backend_url"
  fi

  log "Running frontend getSharePrice unit tests..."
  cd "$ROOT_DIR/frontend"
  if [[ ! -d node_modules ]]; then
    npm ci
  fi
  npm run test:run -- src/lib/vaultApi.test.ts

  log "Checking backend GET /health..."
  curl -fsS "$backend_url/health" | jq -e '.status == "healthy"' >/dev/null

  log "Checking backend GET /api/v1/vault/summary..."
  curl -fsS "$backend_url/api/v1/vault/summary" | jq -e 'has("totalAssets") and has("totalShares")' >/dev/null

  if [[ -n "$vault_id" ]] && command -v stellar >/dev/null 2>&1; then
    log "Invoking on-chain get_share_price via Stellar CLI..."
    stellar contract invoke \
      --id "$vault_id" \
      --network testnet \
      -- get_share_price
    log "On-chain share price probe succeeded"
  else
    log "Stellar CLI not installed — skipping live contract invoke"
  fi

  log "Cross-stack smoke test passed"
}

run_deploy_smoke() {
  if [ -z "${TESTNET_SECRET_KEY:-}" ]; then
    fail "TESTNET_SECRET_KEY secret is not set or is empty"
  fi

  if [ -z "${TESTNET_TOKEN_ADDRESS:-}" ]; then
    fail "TESTNET_TOKEN_ADDRESS secret is not set or is empty"
  fi

  stellar keys add ci-deployer --secret-key "$TESTNET_SECRET_KEY"

  CONTRACT_ID=$(stellar contract deploy \
    --wasm artifacts/wasm/vault.wasm \
    --source ci-deployer \
    --network testnet)

  echo "Deployed contract: $CONTRACT_ID"

  stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source ci-deployer \
    --network testnet \
    -- initialize \
    --admin "$(stellar keys address ci-deployer)" \
    --token "$TESTNET_TOKEN_ADDRESS"

  stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source ci-deployer \
    --network testnet \
    -- deposit \
    --user "$(stellar keys address ci-deployer)" \
    --amount 1000000

  BALANCE=$(stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source ci-deployer \
    --network testnet \
    -- balance \
    --user "$(stellar keys address ci-deployer)")

  if [ "$BALANCE" -le 0 ]; then
    fail "Expected balance > 0, got: $BALANCE"
  fi

  echo "Balance check passed: $BALANCE"

  cat > deployment.json <<EOF
{
  "contract_id": "$CONTRACT_ID",
  "git_sha": "${GIT_SHA:-}"
}
EOF

  echo "deployment.json written successfully"
}

case "$MODE" in
  deploy)
    run_deploy_smoke
    ;;
  cross-stack)
    run_cross_stack_smoke
    ;;
  *)
    fail "Unknown SMOKE_TEST_MODE: $MODE (expected deploy or cross-stack)"
    ;;
esac
