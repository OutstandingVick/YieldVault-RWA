# Query Optimization – DB Indices (Issue #895)

This document describes the database indices added to address high-latency query
patterns identified in the backend.  All indices are defined in
`prisma/schema.prisma` and applied via migration
`20260725000000_add_query_optimization_indices`.

---

## Problem

Several high-traffic read endpoints performed full table scans because the
`Transaction`, `ReferralCode`, `SharePriceSnapshot`, and `WebhookDelivery`
models lacked indices on the columns used for filtering and sorting.

The most impactful gaps were:

| Endpoint | Model | Unindexed columns |
|---|---|---|
| `GET /api/v1/transactions` | `Transaction` | `user`, `type`, `status`, `timestamp` |
| `GET /api/v1/referrals/code/:wallet` | `ReferralCode` | `ownerAddress` |
| `GET /api/v1/referrals/:wallet` (yield calc) | `SharePriceSnapshot` | `(recordedAt, id)` sort |
| `GET /admin/webhooks/deliveries` | `WebhookDelivery` | `(endpointId, createdAt)` sort |

---

## Indices Added

### `Transaction`

The list-transactions endpoint (`transactionEndpoints.ts`) builds a `WHERE`
clause from up to four predicates (`user`, `type`, `status`, `timestamp`) and
always sorts by `timestamp DESC`.

| Index | Columns | Query pattern covered |
|---|---|---|
| `Transaction_timestamp_idx` | `(timestamp DESC)` | Unfiltered paginated list |
| `Transaction_user_timestamp_idx` | `(user, timestamp DESC)` | Per-wallet list (most common authenticated path) |
| `Transaction_type_timestamp_idx` | `(type, timestamp DESC)` | Type-only filter |
| `Transaction_status_timestamp_idx` | `(status, timestamp DESC)` | Status-only filter |
| `Transaction_user_type_timestamp_idx` | `(user, type, timestamp DESC)` | Wallet + type compound filter |
| `Transaction_user_status_timestamp_idx` | `(user, status, timestamp DESC)` | Wallet + status compound filter |

The `timestamp` column is included in every index (rather than only on the
single-column index) so the database can satisfy both the `WHERE` predicate and
the `ORDER BY` from a single index scan, avoiding a separate sort step.

### `ReferralCode`

`ReferralService.getOrCreateReferralCode` calls
`prisma.referralCode.findFirst({ where: { ownerAddress } })`.  Without an index
this scans the entire table on every code lookup or creation.

| Index | Columns | Query pattern covered |
|---|---|---|
| `ReferralCode_ownerAddress_idx` | `(ownerAddress)` | `findFirst` / `findMany` by owner |

### `SharePriceSnapshot`

`ReferralService.calculateUserYield` fetches all snapshots ordered by
`(recordedAt ASC, id ASC)` to reconstruct the share-price history for yield
calculations.

| Index | Columns | Query pattern covered |
|---|---|---|
| `SharePriceSnapshot_recordedAt_id_idx` | `(recordedAt ASC, id ASC)` | Full ordered scan for yield calculation |

The pre-existing single-column `@@index([recordedAt])` is kept for the
`findFirst({ orderBy: { recordedAt: 'desc' } })` call that reads the latest
snapshot price.

### `WebhookDelivery`

`listWebhookDeliveryPage` sorts by `(createdAt DESC, id DESC)` and is
frequently called with an `endpointId` filter.  The existing single-column
`@@index([endpointId])` satisfies the filter but still requires an additional
sort pass.

| Index | Columns | Query pattern covered |
|---|---|---|
| `WebhookDelivery_endpointId_createdAt_idx` | `(endpointId, createdAt DESC)` | Delivery list filtered by endpoint, sorted newest-first |

---

## How to Apply

The migration is applied automatically by Prisma Migrate:

```sh
# development
npx prisma migrate dev

# CI / production
npx prisma migrate deploy
```

SQLite (used in development and tests) does not support `ASC`/`DESC` per-column
in `CREATE INDEX`, but Prisma handles this transparently.  The index definitions
in `schema.prisma` use `sort: Desc` / `sort: Asc` annotations which Prisma
translates correctly for each target database.

---

## Query Patterns NOT Changed

The following patterns were reviewed and need no new index:

- **`Referral.referrerAddress`** — already has `@@index([referrerAddress])`.
- **`WebhookEndpoint`** — already has indices on `createdAt`, `deletedAt`, and
  `verificationStatus`.
- **`AdminAuditLog`** — already has indices on `createdAt`, `action`, and
  `actor`.
- **`ProcessedEvent`** — already has indices on `ledgerSeq` and `txHash`.

---

## Test Coverage

`backend/src/__tests__/queryOptimizationIndices.test.ts` validates all four
model groups using the in-process SQLite database:

- Correct result ordering and isolation for every `Transaction` index
- `ReferralCode` findFirst accuracy for indexed and unindexed owners
- `SharePriceSnapshot` ascending ordered fetch
- `WebhookDelivery` pagination stability over the composite index
