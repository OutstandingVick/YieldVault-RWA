# ADR-002: Write-Ahead Audit Log for Admin Configuration Changes

**Date:** 2024-03-10  
**Status:** Accepted  
**Author:** YieldVault Core Team  
**Reviewers:** Security Lead, Backend Team  

---

## Context

Admin operations (rate-limit overrides, feature-flag changes, allowlist edits)
need to be auditable and recoverable. Previously these mutations were applied
in-place with no record of what changed, who changed it, or what the prior
state was. A security incident or misconfiguration had no rollback path.

Additionally, with multiple backend pods in production, a crash during a
multi-step admin operation left the system in an inconsistent state with no
way to detect or recover.

## Decision

We introduce a **write-ahead audit log (WAL)** stored in PostgreSQL
(`WriteAheadAuditEntry` table).

Every admin configuration change follows a **prepare → commit / rollback**
lifecycle:

1. `prepare` — record the pre-change snapshot in the WAL, status = `pending`.
2. Apply the change.
3. `commit` — record the post-change snapshot, status = `committed`.
4. On failure, `rollback` — record the reason, status = `rolled_back`.

The WAL entries are persisted to Postgres (not in-memory) so they survive
process restarts and are queryable from any pod in a multi-instance deployment
(see issue #856).

## Rationale

- **Durability:** Entries survive pod restarts; no data is lost in a crash.
- **Multi-instance consistency:** Any pod can read the WAL to detect pending
  (uncommitted) operations left by a crashed peer.
- **Auditability:** Every admin change has a before/after snapshot and an actor
  identity attached to it.
- **Rollback signal:** The WAL makes it trivial to surface "what was the last
  committed state?" to a human operator or automated reconciler.

## Alternatives Considered

### Alternative 1: Application-level event log (append-only table)
- **Pros:** Simple; no lifecycle coordination needed.
- **Cons:** No before/after snapshot; no way to detect uncommitted operations.

### Alternative 2: Database triggers
- **Pros:** Transparent; always fires regardless of application code.
- **Cons:** Hard to attach actor identity or request metadata; difficult to
  test at the application layer.

### Alternative 3: In-memory WAL (original implementation)
- **Pros:** Zero infrastructure cost; fast.
- **Cons:** Lost on restart; not visible across pods; violates the durability
  requirement for a financial system.

## Consequences

### Positive
- Crash recovery: a startup routine can detect and alert on `pending` entries
  that were never committed or rolled back.
- Compliance: every admin mutation has a permanent, immutable record.
- Multi-instance safe: Postgres serializes concurrent writes.

### Negative
- Every admin operation now incurs two extra database writes (prepare + commit).
- The `WriteAheadAuditEntry` table will grow indefinitely without a retention
  policy; the `purgeExpiredEntries()` method and `WAL_RETENTION_MS` env var
  must be scheduled (see `POST /admin/wal/purge`).

## Related Links
- Issue #856 — Persist WAL entries to Prisma for multi-instance durability
- `backend/src/writeAheadAuditLog.ts`
- `backend/src/__tests__/writeAheadAuditLog.test.ts`
- `backend/migrations/002_write_ahead_audit_entries.sql`
- `backend/prisma/schema.prisma` → `WriteAheadAuditEntry` model
