# YieldVault-RWA Webhook Payload Evolution Guide

## Table of Contents

1. [Overview](#overview)
2. [Payload Schema Contract](#payload-schema-contract)
3. [Versioning Strategy](#versioning-strategy)
4. [Evolution Rules](#evolution-rules)
5. [Backward Compatibility](#backward-compatibility)
6. [Deprecation Policy](#deprecation-policy)
7. [Consumer Migration Guide](#consumer-migration-guide)
8. [Schema Changelog](#schema-changelog)

---

## Overview

This document outlines the contract for YieldVault-RWA webhook payloads and the evolution rules that govern how the schema changes over time. These rules ensure that webhook consumers can reliably process events without unexpected breaks, even as the protocol evolves.

### Goals

- **Predictability**: Consumers should know what to expect when processing webhook events
- **Resilience**: The system should handle schema changes gracefully
- **Transparency**: Schema changes should be documented and announced
- **Safety**: Consumers should be able to upgrade at their own pace

---

## Payload Schema Contract

### Event Envelope Structure

Every webhook payload is wrapped in a standardized envelope:

```json
{
  "eventType": "transaction.deposit.created",
  "sentAt": "2026-06-26T10:30:00.000Z",
  "payload": { ... },
  "version": "1.0"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `eventType` | `string` | The type of event (see Event Types below) |
| `sentAt` | `ISO 8601` | Timestamp when the event was dispatched |
| `payload` | `object` | Event-specific data payload |
| `version` | `string` | Schema version (semver format) |

### Event Types

#### `transaction.deposit.created`

Emitted when a user successfully deposits USDC into the vault.

```json
{
  "eventType": "transaction.deposit.created",
  "sentAt": "2026-06-26T10:30:00.000Z",
  "payload": {
    "transactionId": "tx_deposit_abc123",
    "amount": "1000000000",
    "asset": "USDC",
    "walletAddress": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    "transactionHash": "abc123def456",
    "status": "completed",
    "timestamp": "2026-06-26T10:29:55.000Z"
  },
  "version": "1.0"
}
```

| Field | Type | Description | Introduced |
|-------|------|-------------|------------|
| `transactionId` | `string` | Unique identifier for the deposit | 1.0 |
| `amount` | `string` | Amount in stroops (10^6 = 1 USDC) | 1.0 |
| `asset` | `string` | Asset code (always USDC for v1) | 1.0 |
| `walletAddress` | `string` | Stellar address of the depositor | 1.0 |
| `transactionHash` | `string` | Hash of the on-chain transaction | 1.0 |
| `status` | `string` | Current transaction status | 1.0 |
| `timestamp` | `ISO 8601` | When the deposit was recorded | 1.0 |

#### `transaction.withdrawal.created`

Emitted when a user initiates or completes a withdrawal.

```json
{
  "eventType": "transaction.withdrawal.created",
  "sentAt": "2026-06-26T10:30:00.000Z",
  "payload": {
    "transactionId": "tx_withdraw_xyz789",
    "amount": "950000000",
    "asset": "USDC",
    "walletAddress": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    "transactionHash": "xyz789abc123",
    "status": "completed",
    "timestamp": "2026-06-26T10:29:58.000Z"
  },
  "version": "1.0"
}
```

### Additional Headers

When a webhook endpoint is configured with a secret, the following headers are included:

| Header | Description |
|--------|-------------|
| `X-YieldVault-Signature` | HMAC-SHA256 signature of the request body |
| `X-YieldVault-Event` | The event type (same as `eventType`) |
| `X-YieldVault-Delivery-Id` | Unique identifier for this delivery attempt |

---

## Versioning Strategy

### Version Format

The schema version follows **Semantic Versioning (SemVer)**:

```
MAJOR.MINOR.PATCH
```

- **MAJOR**: Incompatible structural changes (removed fields, renamed fields, changed types)
- **MINOR**: Backward-compatible new features (new optional fields)
- **PATCH**: Backward-compatible bug fixes (field type refinements, documentation)

### Version Header

The schema version is included in two places:

1. **`version` field in envelope**: Indicates the schema version used
2. **`Accept` header in requests**: Consumers can specify minimum accepted version

Example consumer request:

```http
GET /webhook-endpoint HTTP/1.1
Accept: application/json
X-YieldVault-Version: >=1.0
```

---

## Evolution Rules

### Rule 1: Never Remove Required Fields Without Major Version Bump

**Before (v1.0):**
```json
{
  "payload": {
    "transactionId": "tx_123",
    "amount": "1000000000"
  }
}
```

**After (v2.0) - Breaking Change:**
```json
{
  "payload": {
    "id": "tx_123",
    "value": "1000000000"
  }
}
```

Consumers using v1.0 will fail if they expect `transactionId` and `amount`.

### Rule 2: New Optional Fields Can Be Added Anytime

Adding new optional fields is a **MINOR** version bump and does not require consumer changes.

**v1.0:**
```json
{
  "payload": {
    "transactionId": "tx_123",
    "amount": "1000000000"
  }
}
```

**v1.1:**
```json
{
  "payload": {
    "transactionId": "tx_123",
    "amount": "1000000000",
    "fee": "1000000"
  }
}
```

Consumers on v1.0 can safely ignore the new `fee` field.

### Rule 3: Field Deprecation Follows a Grace Period

When a field is deprecated:

1. The field is marked as deprecated in documentation
2. The field continues to be sent with the same value
3. After minimum 6 months, the field may be removed in a MAJOR version

**Deprecation Notice Example:**

> ⚠️ **Deprecation Notice**: The `timestamp` field in `transaction.deposit.created` is deprecated as of version 1.2. Use `createdAt` instead. This field will be removed in version 2.0.

### Rule 4: Type Changes Require Major Version Bump

Changing a field's type is a breaking change.

```typescript
// v1.0: string
"amount": "1000000000"

// v2.0: number (breaking change)
"amount": 1000000000
```

### Rule 5: Event Type Addition Is Non-Breaking

New event types can be added without breaking existing consumers.

```typescript
// Existing
type TransactionEventType = 'transaction.deposit.created' | 'transaction.withdrawal.created';

// v1.1: Added new type
type TransactionEventType = 'transaction.deposit.created' | 'transaction.withdrawal.created' | 'transaction.fee.collected';
```

---

## Backward Compatibility

### What Is Guaranteed

The following are guaranteed to work without breaking:

1. **Optional fields**: New optional fields will not break consumers that don't understand them
2. **Field ordering**: JSON object field ordering is not guaranteed; never rely on it
3. **Extra fields**: Unknown fields should be ignored (consumers must not fail on unknown fields)
4. **Event type filtering**: Consumers can filter by event types they care about

### What Is NOT Guaranteed

1. **Field presence**: Required fields will always be present, but always validate
2. **Exact values**: Field values may change format (e.g., string to number in major versions)
3. **Latency**: Event delivery time is not guaranteed

### Consumer Best Practices

```typescript
// ❌ BAD: Rely on field ordering
const amount = payload[0];

// ✅ GOOD: Use field names
const amount = payload.amount;

// ❌ BAD: Fail on unknown fields
function processEvent(payload: any) {
  const knownFields = ['transactionId', 'amount', 'asset'];
  for (const key of Object.keys(payload)) {
    if (!knownFields.includes(key)) {
      throw new Error(`Unknown field: ${key}`);
    }
  }
  // process...
}

// ✅ GOOD: Ignore unknown fields
function processEvent(payload: any) {
  const { transactionId, amount, asset } = payload;
  if (!transactionId || !amount) {
    throw new Error('Missing required fields');
  }
  // process...
}

// ❌ BAD: Assume specific field types
const amount: number = payload.amount;

// ✅ GOOD: Validate and coerce types
function parseAmount(value: any): number {
  if (typeof value === 'string') {
    return parseInt(value, 10);
  }
  if (typeof value === 'number') {
    return value;
  }
  throw new Error(`Invalid amount type: ${typeof value}`);
}
```

---

## Deprecation Policy

### Deprecation Timeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Deprecation Lifecycle                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  v1.0: Field introduced                                                     │
│         │                                                                  │
│         │ (6+ months)                                                       │
│         ▼                                                                  │
│  v1.1: Field marked deprecated                                             │
│         │                                                                  │
│         │ (6+ months)                                                      │
│         ▼                                                                  │
│  v2.0: Field removed (major version bump)                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Deprecation Communication

1. **Release Notes**: Deprecations are announced in release notes
2. **Schema Documentation**: Deprecated fields are marked with ⚠️ in this document
3. **Runtime Warnings**: Deprecated fields may include warning headers:
   ```
   X-YieldVault-Deprecated: transactionId
   X-YieldVault-Deprecation-Warning: Use 'id' instead. Removed in v2.0.
   ```

---

## Consumer Migration Guide

### Upgrading Between Versions

#### From v1.0 to v1.1

**Changes:**
- New optional fields added
- No action required for existing consumers

**Action:**
```bash
# No code changes needed
# Simply redeploy with new library version
```

#### From v1.x to v2.0 (Major Version)

**Changes:**
- Field renamed (`transactionId` → `id`)
- Field type changed (string → number)
- Some fields removed

**Action:**
```typescript
// Before (v1.x)
function processDeposit(payload: any) {
  const { transactionId, amount, asset } = payload;
  return { id: transactionId, value: amount, currency: asset };
}

// After (v2.0)
function processDeposit(payload: any) {
  const { id, value, currency, ...unknown } = payload;
  // Handle migration
  return {
    id: id ?? unknown.transactionId,  // backward compat
    value: typeof value === 'string' ? parseInt(value, 10) : value,
    currency: currency ?? 'USDC'
  };
}
```

### Feature Detection

Consumers can detect available features using the version field:

```typescript
function canUseFeature(payload: any, feature: string): boolean {
  const version = payload.version || '1.0';
  const [major, minor] = version.split('.').map(Number);

  const featureVersions: Record<string, [number, number]> = {
    'fee': [1, 1],
    'metadata': [1, 2],
    'batch': [2, 0],
  };

  const [reqMajor, reqMinor] = featureVersions[feature] || [999, 999];
  return major > reqMajor || (major === reqMajor && minor >= reqMinor);
}
```

---

## Schema Changelog

### v1.0 (Initial Release)

- `transaction.deposit.created` - Deposit events
- `transaction.withdrawal.created` - Withdrawal events

### v1.1 (Minor Update)

- Added optional `fee` field to deposit/withdrawal payloads
- Added `version` field to envelope

### v1.2 (Minor Update)

- Added `metadata` field for additional context
- Added deprecation notices for future removal

### v2.0 (Major Update) - *Planned*

- Field renaming: `transactionId` → `id`, `amount` → `value`
- Type changes: string amounts → number
- New event types: `transaction.fee.collected`

---

## Appendix: Compatibility Matrix

| Consumer Version | Provider 1.0 | Provider 1.1 | Provider 2.0 |
|-----------------|---------------|--------------|---------------|
| 1.0 | ✅ Works | ✅ Works | ❌ Breaks |
| 1.1 | ✅ Works | ✅ Works | ❌ Breaks |
| 2.0 | ⚠️ Ignores new fields | ⚠️ Ignores new fields | ✅ Works |

---

## Additional Resources

- [Webhook Integration Guide](./WEBHOOK_INTEGRATION.md)
- [Webhook Signature Verification](./backend/docs/WEBHOOK_SIGNATURES.md)
- [Contract Upgrade Playbook](./runbooks/CONTRACT_UPGRADE_PLAYBOOK.md)