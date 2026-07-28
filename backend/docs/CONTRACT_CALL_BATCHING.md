# Contract Call Batching (Issue #955)

## Problem

Every Soroban contract read is a separate HTTP round-trip to the Soroban RPC endpoint. Endpoints that need multiple pieces of vault state (total assets, share price, paused status, etc.) serialise those round-trips:

```
Sequential (before):  total_assets (200ms) → share_price (200ms) → is_paused (200ms) = 600ms
Batched (after):      all three fired concurrently                                   = ~210ms
```

For latency-sensitive API endpoints (e.g. `/api/v1/vault/summary`) this makes a material difference.

---

## Solution: `SorobanBatchClient`

File: `backend/src/sorobanBatchClient.ts`

The `SorobanBatchClient` class fires an array of read calls with `Promise.all`, bounded by a configurable semaphore to avoid overloading the RPC with too many simultaneous connections.

### Quick start

```typescript
import { createBatchClient } from './sorobanBatchClient';

const client = createBatchClient(); // uses STELLAR_RPC_URL + VAULT_CONTRACT_ID env vars

// Fire 4 reads concurrently
const summary = await client.getVaultSummaryBatched();
// → { totalAssets: '5000000', totalShares: '4800000', sharePrice: '...', isPaused: false }
```

### `batchRead` — all-or-nothing

```typescript
const [assets, shares, price] = await client.batchRead([
  { method: 'total_assets' },
  { method: 'total_shares' },
  { method: 'share_price' },
]);
```

Rejects if any single call fails. Use when all values are required.

### `batchReadWithFallback` — partial-failure tolerant

```typescript
const results = await client.batchReadWithFallback(
  [{ method: 'total_assets' }, { method: 'apy_snapshot' }],
  null,   // fallback value for failed calls
);

for (const r of results) {
  if (!r.success) console.warn(`${r.method} failed:`, r.error?.message);
  else console.log(`${r.method} =`, r.value);
}
```

Failed calls return the fallback value; the rest of the batch still resolves.

### `getVaultSummaryBatched` — vault summary shortcut

Fetches `total_assets`, `total_shares`, `share_price`, and `is_paused` in one concurrent batch and returns a typed `VaultSummary` object. Failed individual reads default to `'0'` / `false`.

---

## Configuration

| Option | Default | Description |
|---|---|---|
| `rpcUrl` | `STELLAR_RPC_URL` env | Soroban RPC endpoint |
| `contractId` | `VAULT_CONTRACT_ID` env | Vault contract address |
| `maxConcurrency` | `5` | Maximum simultaneous RPC calls |

The `maxConcurrency` setting is important for public RPC nodes that enforce per-IP rate limits. Keep it at 5 or lower for testnet. For a private RPC node you can increase it.

---

## Latency logging

Every `batchRead` call emits a `debug` log entry with:

- `callCount` — number of methods fetched
- `batchMs` — wall-clock time for the whole batch
- `sumIndividualMs` — sum of individual call durations
- `latencySavingMs` — `sumIndividualMs - batchMs` (positive = concurrent wins)

Example output:

```
[debug] soroban batch read complete { callCount: 4, batchMs: 210, sumIndividualMs: 780, latencySavingMs: 570 }
```

---

## Testing

All unit tests are in `backend/src/__tests__/sorobanBatchClient.test.ts`.

Tests use an injected `RpcReader` mock — no real Soroban RPC is called:

```bash
cd backend && npm test -- sorobanBatchClient
```

Coverage:
- All calls succeed → results returned in call order
- One call fails → `batchReadWithFallback` returns fallback for that slot only
- `maxConcurrency` limit is enforced (≤ N simultaneous in-flight calls)
- Latency logging asserted
- `getVaultSummaryBatched` full-success and full-failure paths
- Empty call array handled gracefully (returns `[]`, no reader invocations)
- `createBatchClient` factory reads `STELLAR_RPC_URL` / `VAULT_CONTRACT_ID` env vars
