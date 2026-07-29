# Canary-Safe Migration Strategy (Issue #958)

This document describes the migration patterns that keep the YieldVault database schema **backward-compatible** during canary (blue/green) deployments where old and new application code run simultaneously against the same database.

---

## The Problem

During a canary rollout:

- **v1 pods** (old code) and **v2 pods** (new code) run at the same time.
- Both hit the **same database**.
- A migration applied before v2 goes live is immediately visible to v1 code.

Any schema change that removes, renames, or type-changes something that v1 reads or writes **breaks v1 instantly**.

---

## The Expand / Contract Pattern

All schema changes follow a 3-phase lifecycle:

```
Phase 1 — Expand   (deployed before v2 rollout)
Phase 2 — Backfill (deployed with v2, or as a separate job)
Phase 3 — Contract (deployed after v1 is fully retired)
```

### Adding a column

| Phase | Action |
|---|---|
| 1 | `ALTER TABLE foo ADD COLUMN bar TEXT;` — nullable, no constraint |
| 2 | Backfill `bar` in application code; v2 writes both old + new column |
| 3 | `ALTER TABLE foo ALTER COLUMN bar SET NOT NULL;` after v1 is gone |

### Removing a column

| Phase | Action |
|---|---|
| 1 | Stop reading `legacy_col` in v2 code (keep writing it for v1 compatibility) |
| 2 | Stop writing `legacy_col` in a later release |
| 3 | `ALTER TABLE foo DROP COLUMN legacy_col;` once no code touches it |

### Renaming a column

Never rename directly. Instead:

1. Add `new_name` as nullable.
2. Dual-write to both `old_name` and `new_name` in the application.
3. Backfill `new_name` from `old_name`.
4. Stop reading `old_name` in new code.
5. Drop `old_name` in a later migration.

---

## Safe vs. Unsafe Operations

| Operation | Safe for canary? | Notes |
|---|---|---|
| `CREATE TABLE` | ✓ | Old code ignores unknown tables |
| `ADD COLUMN … DEFAULT …` | ✓ | Old code gets the default |
| `ADD COLUMN` (nullable) | ✓ | Old code gets NULL |
| `ADD COLUMN NOT NULL` (no DEFAULT) | ✗ | Fails on non-empty tables; breaks old INSERTs |
| `DROP COLUMN` | ✗ | Breaks old code reading it |
| `RENAME COLUMN` | ✗ | Breaks old code using original name |
| `RENAME TABLE` | ✗ | Breaks old code querying original name |
| `ALTER COLUMN … TYPE` | ✗ | May lock table; breaks old code casting the type |
| `CREATE INDEX CONCURRENTLY` | ✓ | No write lock |
| `CREATE INDEX` (non-concurrent) | ⚠ | Table write-locks; prefer CONCURRENTLY in prod |
| `TRUNCATE` | ✗ | Irreversible data loss |
| Unbounded `UPDATE` (no WHERE) | ⚠ | May lock table; batch in app instead |

---

## Annotation Opt-Outs

For cases where an unsafe operation is intentional (e.g., bootstrapping a fresh environment, or post-retirement cleanup), add a `-- migration-safety:` annotation at the top of the file to suppress the specific rule:

```sql
-- migration-safety: allow-drop
ALTER TABLE legacy_events DROP COLUMN old_field;
```

Available annotations:

| Annotation | Suppresses |
|---|---|
| `allow-drop` | `no-drop-column`, `no-drop-table` |
| `allow-not-null-add` | `no-not-null-without-default` |
| `allow-nonconcurrent-indexes` | `index-concurrent` |

---

## CI Enforcement

The check is enforced by `backend/scripts/canary-migration-check.ts`:

```bash
npm run check:migrations:canary
```

This script:
1. Scans all `.sql` files under `prisma/migrations/` and `migrations/`.
2. Reports errors and warnings per rule.
3. Exits with code 1 if any **errors** are found (warnings are advisory only).

It is invoked as part of the governance CI gate:

```bash
npm run ci:governance  # includes lint, test, migrations check, snapshot check
```

---

## Examples

### Good — adding a nullable column

```sql
-- 20260801000000_add_wallet_alias/migration.sql
ALTER TABLE users ADD COLUMN wallet_alias TEXT;
CREATE INDEX CONCURRENTLY idx_users_wallet_alias ON users (wallet_alias);
```

### Good — two-phase NOT NULL column

```sql
-- Phase 1: add nullable
-- 20260802000000_add_status_nullable/migration.sql
ALTER TABLE transactions ADD COLUMN new_status TEXT;

-- Phase 2: (after backfill + v1 retired)
-- 20260815000000_add_status_not_null/migration.sql
-- migration-safety: allow-not-null-add
ALTER TABLE transactions ALTER COLUMN new_status SET NOT NULL;
```

### Bad — inline column rename (breaks v1)

```sql
-- DO NOT DO THIS in a canary deployment
ALTER TABLE transactions RENAME COLUMN amount TO amount_usd;
```

---

## Decision Tree

```
Schema change needed?
├── Adding new data → ADD COLUMN (nullable) → phase-1 safe ✓
├── Removing data
│   ├── Still in use by v1? → Stop using in v2 first → wait for v1 retirement → DROP ✓
│   └── Never used? → annotate allow-drop + DROP ✓
├── Renaming → New column + dual-write + drop old later ✓
├── Type change → New column of new type + migrate data + drop old ✓
└── Indexes → Always CONCURRENTLY in production ✓
```
