# ADR-001: Use Prisma as the Database ORM

**Date:** 2024-01-15  
**Status:** Accepted  
**Author:** YieldVault Core Team  
**Reviewers:** Engineering Lead, Backend Team  

---

## Context

YieldVault RWA requires a reliable, type-safe database access layer for
PostgreSQL. The backend is written in TypeScript and needs an ORM that
supports schema migrations, type generation, and connection pooling, while
remaining maintainable by a small team.

Candidates evaluated: Prisma, TypeORM, Drizzle, raw `pg` with a query
builder (Knex).

## Decision

We use **Prisma** (`@prisma/client`) as the single ORM for all
PostgreSQL access in the backend service.

Prisma's schema file (`prisma/schema.prisma`) is the single source of truth
for the data model. Migration history lives in `prisma/migrations/`.

## Rationale

- **Type safety end-to-end:** Prisma generates fully typed client code from the
  schema, eliminating a class of runtime errors that TypeORM decorators and raw
  Knex queries cannot catch at compile time.
- **Migration tooling:** `prisma migrate dev` / `prisma migrate deploy`
  provides reproducible, reviewable SQL migrations that map directly to schema
  changes.
- **Active ecosystem:** Prisma has first-class Next.js and Node.js support and
  is widely adopted, making it easier to onboard new contributors.
- **Introspection:** `prisma db pull` lets us verify the live schema against
  the migration history, which the `db:check-drift` CI check exploits.

## Alternatives Considered

### Alternative 1: TypeORM
- **Pros:** Mature, decorator-based, supports many databases.
- **Cons:** Decorator magic introduces runtime surprises; migration tooling is
  less reliable; active maintenance has slowed.

### Alternative 2: Drizzle
- **Pros:** Extremely lightweight, fully type-safe, SQL-first.
- **Cons:** Younger ecosystem; fewer integrations; migration story was less
  mature at the time of evaluation.

### Alternative 3: Raw Knex + pg
- **Pros:** Maximum control, minimal abstraction.
- **Cons:** No automatic type generation; migrations require manual SQL
  authoring; high maintenance burden.

## Consequences

### Positive
- Compile-time type errors on database queries.
- Schema drift detected automatically in CI (`npm run db:check-drift`).
- New contributors can understand the data model from a single `.prisma` file.

### Negative
- Prisma generates a large client bundle; not suitable for edge runtimes
  without the Prisma Accelerate adapter.
- Schema changes require running `prisma generate` locally; CI must also
  regenerate the client (`npx prisma generate` before `tsc`).

## Related Links
- `backend/prisma/schema.prisma`
- `backend/scripts/check-postgres-drift.js`
- `backend/package.json` → `db:migrate`, `db:check-drift`
