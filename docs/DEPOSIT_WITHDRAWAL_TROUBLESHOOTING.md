# Deposit and Withdrawal Troubleshooting Guide

This guide explains how to diagnose failed, pending, or apparently missing USDC deposits and withdrawals in YieldVault on Stellar.

It is intended for users, support engineers, and operators. Follow the procedure in order. Do not repeatedly submit a transaction when the outcome of an earlier submission is unknown.

> **Safety first:** A Stellar transaction may have succeeded even when a wallet, browser, or backend request timed out. Always verify the transaction on the configured Stellar network before retrying.

## Quick triage

1. Identify the operation: **deposit** or **withdrawal**.
2. Confirm the Stellar network: testnet and mainnet transactions are separate.
3. Record the wallet address, asset, amount, approximate submission time, and transaction hash if available.
4. Check the wallet and Stellar explorer for the transaction result.
5. Check YieldVault transaction history and the transaction status.
6. If no transaction hash exists, determine whether the wallet signing step was reached.
7. Retry only when the previous attempt is confirmed not to have been submitted or has definitively failed.

Never share a secret key, recovery phrase, private key, or wallet password with support.

## Understand the transaction states

The exact labels shown by the frontend or backend may vary, but use these meanings when investigating:

| State | Meaning | Recommended action |
| --- | --- | --- |
| `pending` or `submitted` | The request was accepted by the application or transaction submission has not been conclusively resolved. | Wait for confirmation, then query the network and transaction history. Do not duplicate the transaction. |
| `completed` or `successful` | The transaction was confirmed and the expected operation was recorded. | Verify the resulting token or share balance. |
| `failed` | The transaction or contract invocation was rejected or failed. | Read the failure reason, correct the cause, and retry once the original failure is confirmed. |
| `cancelled` | The user rejected signing or explicitly cancelled the operation. | Correct the wallet or amount issue and start a new request if desired. |
| `unknown` or missing | The application does not have enough information to determine the result. | Use the transaction hash and network explorer to establish the on-chain result before retrying. |

A wallet UI error is not, by itself, proof that the Stellar transaction failed.

## Common checks for both deposits and withdrawals

### 1. Confirm the network

Ensure that all of the following refer to the same network:

- The YieldVault environment.
- The wallet network selected for signing.
- The Stellar explorer used for verification.
- The vault contract and USDC asset contract.

A valid transaction on testnet does not affect a mainnet balance, and vice versa.

### 2. Confirm the wallet address

Compare the wallet address shown in YieldVault with the address that signed the transaction. Check the full address, not a shortened display version.

Also confirm that the address is a Stellar account and that the wallet is connected to the expected account. An operation submitted from a different account may be valid but appear missing from the expected portfolio.

### 3. Check the transaction hash

If a hash is available:

1. Open it in an explorer configured for the correct network.
2. Confirm the transaction result and ledger inclusion.
3. Inspect the operation or contract invocation details.
4. Confirm the asset, amount, source account, destination, and contract address.
5. Compare the result with YieldVault transaction history.

If the hash is not available, search the wallet's activity and check the browser or application logs for a submission identifier or correlation ID.

### 4. Check transaction history

Use the YieldVault transaction history to verify:

- The operation type is correct.
- The wallet address is correct.
- The amount and asset are correct.
- The status is current.
- A transaction hash or submission identifier is present.

A history record can be created before on-chain confirmation. Treat a record marked `pending` as unresolved until the network result is known.

### 5. Check the vault pause state

Deposits and withdrawals may be unavailable while the vault is paused or undergoing maintenance. Check the application's status or maintenance notice before retrying. Do not attempt to bypass a pause by repeatedly submitting transactions.

## Deposit troubleshooting

A deposit transfers USDC from the user's wallet to the vault and records vault shares for the depositor. A successful wallet signing step does not guarantee that the transfer and vault call succeeded.

### Deposit fails before wallet signing

**Symptoms:** No wallet prompt appears, or the application rejects the request immediately.

Check:

- The wallet is connected and unlocked.
- The correct account is selected.
- The amount is positive and uses the supported decimal precision.
- The wallet has enough USDC for the deposit.
- The wallet has enough XLM for Stellar transaction fees and required reserves.
- The selected asset is the configured USDC asset for the current network.
- The vault is not paused.
- The application environment has the expected vault and asset contract configuration.

No on-chain transaction was normally created in this case. Correct the issue and submit again.

### Deposit is rejected by the wallet

**Symptoms:** The wallet reports that the user declined, the request expired, or authorization was rejected.

This is normally a client-side cancellation. Confirm the account and transaction details, reconnect the wallet if needed, and start a new deposit. Do not treat a rejected signing prompt as a completed deposit.

### Deposit submission times out

**Symptoms:** The browser or backend reports a timeout after signing, but no final status is shown.

Treat the result as unknown:

1. Do not submit the same deposit again.
2. Check the wallet activity for a transaction hash.
3. If a hash exists, verify it on the correct network.
4. If the transaction is successful, wait for YieldVault history and balances to update.
5. If the transaction failed, use the failure reason before retrying.
6. If no hash exists, check the transaction history and application logs. Retry only after confirming that submission did not occur.

### Deposit transaction fails on-chain

Common causes include:

- Insufficient USDC balance.
- Insufficient XLM for fees or account reserves.
- Incorrect asset contract or network.
- Invalid amount or unsupported precision.
- Vault paused.
- Contract authorization or allowance requirements not satisfied.
- The wallet or asset account is not correctly configured.

Verify the failure reason in the transaction result. Fix the identified condition, then submit a new transaction. A failed transaction does not mint shares and should not be counted as a completed deposit.

### USDC left the wallet but shares are not visible

First verify the transaction on-chain. If the transaction succeeded:

- Confirm the destination is the configured vault contract.
- Confirm the invocation is the deposit operation.
- Confirm the source wallet is the wallet shown in YieldVault.
- Refresh the portfolio and transaction history.
- Allow time for backend indexing or reconciliation.
- Use the transaction hash when contacting support.

Do not make another deposit solely because the share balance is temporarily stale. If the transaction succeeded but remains absent after the normal indexing interval, support should investigate event polling, transaction backfill, and ledger reconciliation.

## Withdrawal troubleshooting

A withdrawal burns or debits the user's vault shares and transfers the requested USDC back to the user's wallet. The displayed amount may be constrained by the user's share balance, vault liquidity, configured limits, or applicable policy.

### Withdrawal fails before wallet signing

**Symptoms:** The request is rejected before a wallet prompt appears.

Check:

- The requested amount is positive and uses supported precision.
- The wallet owns enough vault shares.
- The vault has sufficient withdrawable liquidity.
- The wallet address is correct.
- The vault is not paused or in a restricted operational state.
- The request does not exceed the configured daily withdrawal limit.
- Any allowlist, geofence, or policy requirement is satisfied.
- The selected asset and network are correct.

The daily withdrawal limit is evaluated against the wallet's withdrawals for the applicable period. If the remaining limit is lower than the requested amount, wait for the reset, request a smaller amount, or follow the approved support and administrative override process. Do not attempt to evade a limit by splitting requests across accounts.

### Withdrawal is rejected by the wallet

If the user rejects the signing prompt, no signed withdrawal should be submitted. Confirm the amount, destination, and network, then begin a new request if appropriate.

### Withdrawal submission times out

Treat a post-signing timeout as unresolved:

1. Do not submit another withdrawal.
2. Locate the transaction hash in the wallet or YieldVault history.
3. Verify the transaction result on the correct network.
4. If successful, confirm that USDC was transferred to the intended wallet.
5. If failed, record the failure reason and correct the cause before retrying.
6. If the result cannot be established, escalate with the wallet address, timestamp, and any correlation or submission ID.

### Withdrawal transaction fails on-chain

Common causes include:

- Insufficient vault shares.
- Insufficient vault liquidity.
- Vault paused or withdrawal operations restricted.
- Daily withdrawal limit exceeded.
- Policy, allowlist, or geofence rejection.
- Invalid destination or asset configuration.
- Contract authorization failure.
- Amount precision or minimum/maximum constraint violation.

Use the on-chain result and application response together. Do not assume that a failed withdrawal reduced the user's shares; verify the share balance and transaction result before retrying.

### Withdrawal is successful but USDC is not visible

Verify all of the following:

- The transaction is successful on the correct network.
- The destination is the intended wallet address.
- The transferred asset is the configured USDC asset.
- The wallet is viewing the correct network and has the asset trustline or token visibility configured.
- The wallet balance has been refreshed.

If the chain shows a successful transfer to the correct address but the wallet does not display it, the issue is usually wallet asset visibility or indexing. If the chain does not show the expected transfer, escalate for contract and reconciliation review.

## When to retry

Retry only when one of these conditions is true:

- The user cancelled signing and no transaction was submitted.
- The application rejected the request before submission.
- The transaction is confirmed failed on-chain and the failure cause has been corrected.
- Support or an operator has confirmed that no prior transaction exists.

Do not retry when:

- A signed transaction is still pending.
- The request timed out after signing and the network result is unknown.
- The transaction succeeded but the application balance is stale.
- The user cannot distinguish between two possible submitted transactions.

When retrying, use the original failure evidence and submit only once. Record the new transaction hash separately from the original attempt.

## Support escalation checklist

Provide the following non-sensitive information:

- Operation: deposit or withdrawal.
- Wallet address.
- Asset and amount.
- Network: testnet or mainnet.
- Approximate UTC submission time.
- Transaction hash, if available.
- YieldVault transaction or submission ID, if available.
- Correlation ID from the application response or logs, if available.
- Exact user-facing error message.
- Whether the wallet signing prompt was accepted, rejected, or timed out.
- Explorer result and relevant operation details.
- Steps already taken and whether a retry was attempted.

Never include:

- Secret keys or seed phrases.
- Wallet passwords.
- API keys, bearer tokens, cookies, or signed payloads unless an approved secure support channel explicitly requires a redacted diagnostic artifact.

### Operator investigation sequence

1. Redact secrets and confirm the reported wallet address.
2. Confirm the configured network, vault contract, and USDC asset contract.
3. Query the transaction by hash when available.
4. Compare the on-chain result with the persisted transaction record.
5. Check event polling, transaction backfill, and reconciliation status.
6. Check for an active pause, maintenance window, circuit breaker, daily limit, allowlist, or geofence decision.
7. Check correlated backend logs and traces using the correlation ID.
8. Avoid manually changing a transaction to `completed` without on-chain evidence.
9. If the chain and database disagree, open a reconciliation incident and preserve the original records.
10. Communicate whether the issue is user-actionable, awaiting confirmation, or an operational incident.

## Incident indicators

Escalate as an operational incident when any of the following occur:

- Multiple users report deposits or withdrawals failing at the same time.
- Successful on-chain transactions are repeatedly missing from transaction history.
- The backend reports completed operations without matching on-chain transactions.
- The vault, asset, or strategy contract address differs from the approved deployment configuration.
- Balances, shares, or totals disagree after reconciliation has completed.
- A transaction appears successful but funds were sent to an unexpected destination.
- RPC failures, event polling gaps, dead-letter queue growth, or repeated submission timeouts are observed.
- A pause, limit, allowlist, or geofence rule is unexpectedly blocking otherwise valid users.

Preserve transaction hashes, ledger numbers, timestamps, correlation IDs, and relevant logs. Do not delete or rewrite the original transaction record during investigation.

## Contract error code reference

YieldVault returns typed `VaultError` codes when on-chain operations fail. The table below maps each error relevant to deposits and withdrawals to the troubleshooting sections in this guide.

| Code | Error | Trigger | Troubleshooting section |
| --- | --- | --- | --- |
| `VaultError::InvalidAmount` (3) | Amount is zero or negative | Deposit or withdrawal amount is invalid | [Deposit fails before signing](#deposit-fails-before-wallet-signing), [Withdrawal fails before signing](#withdrawal-fails-before-wallet-signing) |
| `VaultError::ContractPaused` (4) | Vault is paused | All deposits and withdrawals blocked | [Check the vault pause state](#5-check-the-vault-pause-state) |
| `VaultError::ExceedsUserCap` (5) | Over per-user cap | Deposit exceeds per-user cap | [Deposit fails before signing](#deposit-fails-before-wallet-signing) |
| `VaultError::MinDepositNotMet` (6) | Below minimum deposit | Deposit below `min_deposit` threshold | [Deposit fails before signing](#deposit-fails-before-wallet-signing) |
| `VaultError::TimelockNotExpired` (7) | Timelock still active | Large withdrawal before 24h expires | [Withdrawal transaction fails on-chain](#withdrawal-transaction-fails-on-chain) |
| `VaultError::WithdrawalCooldownActive` (12) | Cooldown active | Deposit then immediate withdrawal | [Withdrawal fails before signing](#withdrawal-fails-before-wallet-signing) |
| `VaultError::InsufficientShares` (2) | Not enough shares | Withdrawal exceeds share balance | [Withdrawal fails before signing](#withdrawal-fails-before-wallet-signing) |
| `VaultError::InsufficientLiquidity` (24) | Idle liquidity too low | Vault cannot satisfy withdrawal from idle | [Withdrawal transaction fails on-chain](#withdrawal-transaction-fails-on-chain) |
| `VaultError::WithdrawalQueued` (21) | Withdrawal queued due to low liquidity | Withdrawal placed in queue instead of immediate | [Withdrawal transaction fails on-chain](#withdrawal-transaction-fails-on-chain) |
| `VaultError::SlippageExceeded` (15) | Strategy slippage too high | Strategy withdrawal exceeded slippage tolerance | [Withdrawal transaction fails on-chain](#withdrawal-transaction-fails-on-chain) |
| `VaultError::RapidAction` (49) | Opposing action same ledger | Deposit followed by withdrawal (or vice versa) in same ledger | [Withdrawal fails before signing](#withdrawal-fails-before-wallet-signing) |

For the complete catalog of all `VaultError` codes, REST API errors, and backend submission codes, see [API Error Code Catalog](../docs/api/ERROR_CODE_CATALOG.md).

## Useful references

- [Deposit and Withdrawal Lifecycle](./DEPOSIT_WITHDRAWAL_LIFECYCLE.md)
- [API Error Code Catalog](../docs/api/ERROR_CODE_CATALOG.md)
- [Monitoring and Observability](./MONITORING_OBSERVABILITY.md)
- [Domain Glossary](./GLOSSARY.md)
- [Failed Withdrawal Incident Playbook](../docs/runbooks/FAILED_WITHDRAWAL_INCIDENT_PLAYBOOK.md)
- Backend transaction history and reconciliation documentation under [`backend/docs`](../backend/docs/)

## User-facing short version

If a deposit or withdrawal fails:

1. Check that you are on the correct network and using the correct wallet.
2. Check the wallet balance, XLM fee balance, amount, and asset.
3. Check the transaction hash on a network explorer.
4. If the transaction is pending or the result is unknown, do not retry.
5. If it failed before submission or is confirmed failed on-chain, correct the issue and try once.
6. If funds moved but the balance is not updated, wait for indexing and contact support with the transaction hash.
7. Never share your secret key or recovery phrase.
