# Webhook Event Schema Catalog

This document describes the event schemas available to webhook consumers of YieldVault RWA.

All webhook payloads follow a common envelope and carry a typed payload depending on the event.

---

## Common Envelope

Every webhook event is wrapped in a standard envelope.

**Schema file:** `envelope.schema.json`

- `id` (string) — Unique event identifier
- `type` (string) — Event type (e.g. `transaction.deposit.created`)
- `created_at` (string) — ISO-8601 timestamp
- `data` (object) — Event-specific payload
- `version` (string) — Schema version

---

## Supported Events

### 1. `transaction.deposit.created`

Fired when a deposit transaction is created.

**Payload schema:** `transaction.deposit.created.payload.schema.json`

Typical payload fields:

- `transaction_id` (string) — Unique transaction identifier
- `vault_id` (string) — Target vault
- `amount` (string) — Deposit amount (decimal string)
- `asset` (string) — Asset code / symbol
- `user_id` (string) — User who initiated the deposit
- `status` (string) — Current status of the transaction

---

### 2. `transaction.withdrawal.created`

Fired when a withdrawal transaction is created.

**Payload schema:** `transaction.withdrawal.created.payload.schema.json`

Typical payload fields:

- `transaction_id` (string) — Unique transaction identifier
- `vault_id` (string) — Source vault
- `amount` (string) — Withdrawal amount (decimal string)
- `asset` (string) — Asset code / symbol
- `user_id` (string) — User who initiated the withdrawal
- `status` (string) — Current status of the transaction

---

## Catalog Index

The machine-readable index of all events is available in:

- `catalog.json`

---

## Usage Notes for Consumers

- Always validate the envelope before processing the payload.
- Use the `type` field to determine which payload schema to apply.
- Treat unknown event types as non-fatal and log them for future support.
- Prefer the JSON Schema files in this directory for strict validation.

---

## Related Files

- `catalog.json` — Index of available event types
- `envelope.schema.json` — Common event envelope
- `transaction.deposit.created.payload.schema.json` — Deposit payload
- `transaction.withdrawal.created.payload.schema.json` — Withdrawal payload
