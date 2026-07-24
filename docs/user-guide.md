# YieldVault User Guide

This guide explains how to use the vault in plain language and how to read the dashboard values.

## 1. What the Vault Does

You deposit USDC into the vault.
In return, you receive vault shares.
Those shares represent your portion of the pool.
When yield is added, each share becomes worth more USDC.

## 2. Basic Flow

```mermaid
flowchart LR
  A[Connect Wallet] --> B[Deposit USDC]
  B --> C[Receive Vault Shares]
  C --> D[Yield Added Over Time]
  D --> E[Withdraw Shares for USDC]
```

## 3. Wallet Connection States

Connecting Freighter follows a clear status flow:

1. **Disconnected** — choose **Connect Freighter**.
2. **Connecting** — Freighter is prompting; wait for approval.
3. **Connected** — your truncated address appears; you can disconnect any time.
4. **Error** — a specific message explains what failed (missing extension, cancelled prompt, missing address, or Freighter dropped the session). Use **Try again** when shown.

For implementers, see [Wallet connection state machine](./features/WALLET_CONNECTION_STATE.md).

## 4. How to Deposit

1. Connect your wallet.
2. Enter the USDC amount in the deposit input.
3. Confirm the transaction.
4. Wait for confirmation.
5. Check that your share balance increased.

## 5. How to Withdraw

1. Open the withdraw section.
2. Enter how many shares you want to redeem.
3. Confirm the transaction.
4. Your wallet receives USDC based on the current share value.

## 6. Dashboard Fields Explained

- TVL: Total Value Locked. This is the total USDC-equivalent assets tracked by the vault.
- Total Shares: Total share supply across all users.
- Your Shares: Your current ownership units in the vault.
- Share Price: Approximate value of one share.
  Formula: total_assets / total_shares.
- Strategy Yield Events: Records when strategy yield is added.

## 7. Reading Yield Correctly

If total assets go up while your share count stays the same, your position value grows.
You do not need to claim separate reward tokens in this model.
The gain is embedded in share value.

## 8. Shipment Status Pagination (For Ops Views)

If an operations page lists shipments by status, results are loaded in pages.
Use the returned next_cursor token to request the next page.

```mermaid
sequenceDiagram
  participant UI as Dashboard
  participant API as Contract Query
  UI->>API: shipment_ids_by_status(status, None, 20)
  API-->>UI: ids[...], next_cursor=120
  UI->>API: shipment_ids_by_status(status, 120, 20)
  API-->>UI: ids[...], next_cursor=140
```

## 9. Troubleshooting

- Deposit fails: Check wallet balance and network.
- Wallet connection error: Read the on-screen error code message (missing Freighter, cancelled prompt, or lost session) and use **Try again** when available.
- Withdraw returns less than expected: Share value may have changed due to prior withdrawals.
- No new yield shown: Strategy may not have reported yield in that period.
