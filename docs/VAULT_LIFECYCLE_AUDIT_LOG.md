# Vault Lifecycle Audit Log

**Status:** Active
**Module:** `backend/src/vaultAuditLog.ts`
**Wired into:** `backend/src/vaultEndpoints.ts` (`POST /api/v1/vault/deposits`, `POST /api/v1/vault/withdrawals`)
**Related:** [`MONITORING_OBSERVABILITY.md`](./MONITORING_OBSERVABILITY.md) ·
[`runbooks/FAILED_WITHDRAWAL_INCIDENT_PLAYBOOK.md`](./runbooks/FAILED_WITHDRAWAL_INCIDENT_PLAYBOOK.md)

Structured, queryable audit trail for vault deposit/withdrawal lifecycle
operations (Issue #888). Every operation is recorded at each state transition so
operators can answer *"what happened to this withdrawal, and when?"* without
reconstructing it from ad-hoc logs.

---

## Lifecycle state machine

```
initiated ── submitted ── confirmed
                     └──── failed
```

| Phase | Emitted when | Outcome |
|-------|--------------|---------|
| `initiated` | Request accepted, wallet lock acquired, about to attempt | `pending` |
| `submitted` | Soroban RPC accepted the transaction (tx hash known) | `pending` |
| `confirmed` | Transaction durably persisted **and** vault state updated | `success` |
| `failed` | Operation errored at any point | `failure` |

A healthy operation emits `initiated → submitted → confirmed`. Any orphaned
`submitted` without a matching `confirmed` indicates a persistence/reconciliation
gap (see the withdrawal incident playbook).

---

## Entry schema

Each entry (`VaultAuditEntry`) contains:

| Field | Description |
|-------|-------------|
| `id` | Unique audit id (`vaudit_…`). |
| `timestamp` | ISO-8601 time recorded. |
| `action` | `vault.<operation>.<phase>`, e.g. `vault.withdrawal.failed`. |
| `operation` | `deposit` \| `withdrawal`. |
| `phase` | `initiated` \| `submitted` \| `confirmed` \| `failed`. |
| `outcome` | `pending` \| `success` \| `failure`. |
| `actor` | Normalized wallet address performing the operation. |
| `amount` / `asset` | Operation amount (string) and asset code. |
| `txHash` | On-chain transaction hash once known. |
| `correlationId` / `traceId` | Request correlation + OTel trace ids. |
| `errorCode` / `errorMessage` | Populated on `failed` phases. |
| `metadata` | Extra context, passed through sensitive-attribute redaction. |

`errorCode` values on failure: `SOROBAN_CIRCUIT_OPEN`,
`SOROBAN_SIMULATION_ERROR`, `IDEMPOTENCY_CONFLICT`, `VAULT_OPERATION_ERROR`.

---

## Where entries go

1. **Structured log line** — emitted via the shared structured logger
   (`info`, or `warn` for `failed`) with `audit: "vault-lifecycle"`, so entries
   flow into the existing log pipeline / SIEM.
2. **In-memory ring buffer** — bounded by `VAULT_AUDIT_LOG_RETENTION`
   (default `1000`), most-recent-first, for querying without a log backend.

Metadata is filtered through `redactSensitiveAttributes` before storage or
logging, so secrets in `metadata` are never persisted in the clear.

---

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `VAULT_AUDIT_LOG_RETENTION` | `1000` | Max entries retained in memory. |

---

## Querying (programmatic)

```ts
import { getVaultAuditLogs, getVaultAuditMetrics } from './vaultAuditLog';

// Recent failed withdrawals
getVaultAuditLogs({ operation: 'withdrawal', outcome: 'failure', limit: 50 });

// Trace a specific on-chain tx
getVaultAuditLogs({ txHash: 'abc123' });

// Dashboard counters (totals + per-phase breakdown)
getVaultAuditMetrics();
```

`getVaultAuditLogs` supports filtering by `operation`, `phase`, `outcome`,
`actor` (substring), and `txHash`; `limit` is clamped to
`[1, VAULT_AUDIT_LOG_RETENTION]`.

---

## Operational use

The `vault.*.failed` entries are a direct, product-level signal used by the
[Failed Withdrawal Incident Playbook](./runbooks/FAILED_WITHDRAWAL_INCIDENT_PLAYBOOK.md)
and the [RPC Provider Failover Strategy](./RPC_PROVIDER_FAILOVER_STRATEGY.md)
detection sections. Filter by `outcome = failure` and read the dominant
`errorCode` to route to the correct mitigation.
