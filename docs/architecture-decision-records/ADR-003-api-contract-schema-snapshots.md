# ADR-003: API Contract Schema Snapshots for Backward-Compatibility Enforcement

**Date:** 2024-04-20  
**Status:** Accepted  
**Author:** YieldVault Core Team  
**Reviewers:** API Team, Frontend Team  

---

## Context

YieldVault exposes a REST API consumed by the frontend, the SDK, and
third-party integrators. Without an automated guard, a developer can
accidentally remove a field, rename a route, or change a response shape —
breaking consumers silently. Code review alone is insufficient because
the impact of a schema change is not always obvious from the diff.

## Decision

We maintain **API contract schema snapshots**: serialised JSON files in
`backend/src/__snapshots__/` that capture the shape of every public API
response. A CI step (`npm run snapshots:check`) compares the current snapshot
against the committed baseline and fails if they diverge.

Snapshots are regenerated intentionally with `npm run snapshots:write` and
the updated files are committed, making schema evolution explicit and
reviewable in PRs.

## Rationale

- **Consumer protection:** Frontend, SDK, and third-party integrators break on
  silent API changes. Snapshots make schema changes a deliberate, visible act.
- **Low ceremony:** Snapshot files are plain JSON diffs — easy to read in
  code review without specialist tooling.
- **CI integration:** The check runs in under one second alongside lint and
  unit tests; no extra infrastructure required.
- **OpenAPI complementarity:** `openapi.json` is also regenerated in CI and
  checked for drift; snapshots capture internal response shapes that may not
  be fully described in the OpenAPI spec.

## Alternatives Considered

### Alternative 1: Consumer-driven contract tests (Pact)
- **Pros:** Tests real consumer expectations; catches integration bugs.
- **Cons:** Requires maintaining a Pact broker; significantly higher setup and
  operational cost for a small team.

### Alternative 2: TypeScript type checking across packages
- **Pros:** Compile-time guarantee; no test maintenance.
- **Cons:** Only catches type-level changes, not value-shape or HTTP-status
  changes; requires a shared type package to be kept in sync.

### Alternative 3: No automated check
- **Pros:** Zero cost.
- **Cons:** Schema regressions reach production silently; discovered only when
  a consumer breaks.

## Consequences

### Positive
- Every API shape change is visible in the PR diff.
- CI blocks merges that accidentally break the API contract.
- Snapshots double as lightweight documentation of response shapes.

### Negative
- Intentional API changes require a two-step commit: change the code, then
  run `snapshots:write` and commit the updated snapshot.
- Snapshots can accumulate over time; a periodic audit is needed to remove
  snapshots for deprecated endpoints.

## Related Links
- `backend/scripts/check-schema-snapshots.ts`
- `backend/package.json` → `snapshots:check`, `snapshots:write`
- `.github/workflows/backend-governance.yml` → "Check API contract schema snapshots"
- `backend/openapi.json`
