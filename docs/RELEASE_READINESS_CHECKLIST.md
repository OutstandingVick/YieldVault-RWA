# Release Readiness Checklist — YieldVault RWA

**Issue:** #896  
**Purpose:** A gate-by-gate checklist that every release owner completes before promoting
a build from staging to production.  Each section maps to an automated CI check, a manual
verification step, or an owner sign-off.  All items must be checked (or explicitly waived
with a written reason) before the release tag is pushed.

---

## How to use this checklist

1. Open a new **Release Readiness** issue using this document as the body.
2. Assign the release owner and secondary reviewer.
3. Work through each section in order.  Mark items `[x]` as you verify them.
4. For any item you waive, replace `[ ]` with `[~]` and add a one-line reason inline.
5. Tag the issue with the target version (`v*.*.*`) and milestone.
6. Only push the git tag (which triggers `production-deploy.yml`) after the issue is
   fully checked off and the secondary reviewer has approved.

---

## Section 1 — CI Gates (automated, must be green on the release commit)

> All of these are enforced by GitHub Actions before `production-deploy.yml` runs.
> Verify each workflow is passing on the commit you intend to tag.

- [ ] **Backend Governance** (`backend-governance.yml`) — lint, unit tests, API contract
  snapshot check, OpenAPI drift check, schema migration drift check, and `npm audit`
  (high severity) all pass.
- [ ] **Frontend CI** — lint and unit tests pass (`frontend.yml` / the `frontend-ci` job
  in `production-deploy.yml`).
- [ ] **Rust / WASM build** (`rust-wasm.yml`) — contracts compile to WASM with zero warnings.
- [ ] **Rust security scan** (`rust-security.yml`) — `cargo audit` and `cargo deny` pass.
- [ ] **Slither static analysis** (`slither.yml`) — no new High/Medium findings; all known
  findings documented in `contracts/.false-positives.md`.
- [ ] **Secret scanning** (`secret-scanning.yml`) — no secrets detected in the diff.
- [ ] **E2E tests** (`e2e.yml` / `cypress.yml`) — all end-to-end scenarios green on staging.
- [ ] **Integration smoke test** (`integration-smoke.yml`) — `GET /health` and `GET /ready`
  return 200 on the staging deployment.
- [ ] **Load tests** (`load-tests.yml`) — P95 latency within SLO budgets on staging
  (`/api/v1/vault/summary` ≤ 200 ms, deposits/withdrawals ≤ 500 ms).

---

## Section 2 — Code & Dependency Quality

- [ ] **No `TODO` / `FIXME` comments** in release-scoped files that haven't been tracked
  in an issue.
- [ ] **No debug logging** left enabled (`console.log`, `logger.log('debug', …)` calls
  not gated by `NODE_ENV`).
- [ ] **`npm audit` (backend)** — zero High severity findings.
  Run: `cd backend && npm audit --audit-level=high`
- [ ] **`cargo audit` (contracts)** — zero vulnerabilities in Cargo dependency tree.
  Run: `cargo audit`
- [ ] **Dependency pinning** — no open version ranges (`^` / `~`) introduced in this
  release without justification.
- [ ] **`CHANGELOG.md` updated** — `[Unreleased]` section promoted to the release version
  with today's date, following [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## Section 3 — Database & Migrations

- [ ] **All migrations are additive** — no `DROP COLUMN`, `DROP TABLE`, or destructive
  schema changes without a prior deprecation release.
- [ ] **Migration applied to staging** — `npx prisma migrate deploy` completed
  successfully on the staging database with zero errors.
- [ ] **`db:check-drift` passes on staging** — run `npm run db:check-drift` against the
  staging database; output is clean.
- [ ] **Rollback plan documented** — for any migration that cannot be automatically
  reversed, a rollback SQL script exists in
  `backend/prisma/migrations/<version>/rollback.sql` and has been reviewed.
- [ ] **Index audit** — new queries introduced in this release have corresponding indices
  (see `backend/docs/QUERY_OPTIMIZATION.md`); `EXPLAIN` output reviewed for any query
  expected to scan > 10 k rows.

---

## Section 4 — API & Contract Compatibility

- [ ] **OpenAPI document is current** — `npm run generate:openapi` produces no diff
  against the committed `backend/openapi.json`.
- [ ] **Schema snapshots pass** — `npm run snapshots:check` exits 0.
- [ ] **No unannounced breaking changes** — if any field was removed or its type changed,
  the deprecation policy in `docs/API_VERSIONING_POLICY.md` was followed (sunset window
  announced, migration guide published).
- [ ] **Webhook schema version bump** — if `WEBHOOK_SCHEMA_VERSION` was incremented, the
  change is documented in `backend/src/webhookDelivery.ts` and communicated to webhook
  consumers.
- [ ] **Smart contract ABI backward-compatible** — no public function signatures removed
  or parameter types changed without a new contract version and migration path.

---

## Section 5 — Environment & Secrets

- [ ] **All required production env vars are set** — verify against
  `backend/.env.production.example` and `backend/docs/ENVIRONMENT_VARIABLES.md`.
  Critical vars:

  | Variable | Notes |
  |---|---|
  | `DATABASE_URL` | PostgreSQL with `sslmode=require` |
  | `VAULT_CONTRACT_ID` | Mainnet contract address |
  | `STELLAR_RPC_URL` | Points to mainnet (`soroban-mainnet.stellar.org`) |
  | `STELLAR_NETWORK_PASSPHRASE` | `Public Global Stellar Network ; September 2015` |
  | `CORS_ALLOWED_ORIGINS` | Production domains only, no `localhost` |
  | `ADMIN_AUDIT_LOG_STORAGE` | `prisma` in production |
  | `ALERT_TYPE` + `SLACK_WEBHOOK_URL` / `PAGERDUTY_INTEGRATION_KEY` | Alert routing active |
  | `WALLET_NONCE_ENFORCEMENT` | `strict` |
  | `WALLET_SIGNATURE_MODE` | `stellar` |
  | `WEBHOOK_ALLOW_UNVERIFIED` | absent or `false` |

- [ ] **No development defaults leaked** — `NODE_ENV=production`, `STELLAR_NETWORK=mainnet`,
  `ADMIN_AUDIT_LOG_STORAGE` is not `memory`.
- [ ] **Secrets rotated if exposed** — if any secret appeared in a commit, PR comment, or
  log, it has been rotated before the release.
- [ ] **`.env.production` not committed** — `git status` and `.gitignore` confirm no
  production secret files are tracked.
- [ ] **`gitleaks` / secret-scanning workflow clean** — `secret-scanning.yml` passed on
  the release branch.

---

## Section 6 — Security Review

- [ ] **PR security checklist completed** — the PR template security section was signed
  off for every PR merged into this release.
- [ ] **Slither High/Medium finding count** compared to the previous release — document
  any new findings and their disposition (fixed / false positive / accepted risk).
- [ ] **Admin RBAC review** — no new admin route was added without a corresponding
  `Permission` entry in `src/middleware/rbac.ts` and RBAC test coverage.
- [ ] **Input validation coverage** — every new POST/PATCH endpoint uses the `validate()`
  middleware with a named Zod schema; no raw `req.body` access without prior schema
  parsing.
- [ ] **Rate limiting applied** — new public endpoints are covered by an appropriate
  rate-limiter tier (auth, summary, deposits, default).
- [ ] **Webhook input validation** — `WebhookRegisterSchema` and `WebhookUpdateSchema`
  remain enforced on all webhook management routes.
- [ ] **Impersonation sessions** — if any change touches `AdminImpersonationSession`, a
  dedicated security review was requested.

---

## Section 7 — Observability & Monitoring

- [ ] **Health endpoint returns `status: healthy`** on staging after the final deploy.
- [ ] **Readiness endpoint returns `ready: true`** on staging (all dependencies up).
- [ ] **SLA registry up to date** — new endpoints introduced in this release are registered
  in `src/endpointSlaRegistry.ts` with a `p95BudgetMs` and `tier`.
- [ ] **Prometheus metrics endpoint** (`/metrics`) scrapes cleanly with no parse errors.
- [ ] **Latency alerts configured** — `ALERT_TYPE`, `SLACK_WEBHOOK_URL`, and/or
  `PAGERDUTY_INTEGRATION_KEY` are set and a test alert was fired successfully in staging.
- [ ] **Error rate baseline** — error rate on staging over the past 24 h is below 1 % for
  all `tier: critical` endpoints.
- [ ] **Dead-letter queue empty** — `GET /admin/webhooks/dead-letter` returns an empty
  list on staging before cutover.

---

## Section 8 — Deployment Execution

- [ ] **Staging deploy is green** — `staging-deploy.yml` completed successfully on the
  release commit (contracts on testnet, backend and frontend deployed).
- [ ] **Database backup taken** — a full snapshot of the production database was taken
  within 2 hours before the deploy.
- [ ] **Drain window communicated** — if the deploy requires a maintenance window,
  `POST /admin/maintenance` was used to schedule it and users were notified.
- [ ] **Deploy command** — the production deploy is triggered by pushing the git tag:
  ```
  git tag v<MAJOR>.<MINOR>.<PATCH>
  git push origin v<MAJOR>.<MINOR>.<PATCH>
  ```
  This triggers `production-deploy.yml` → frontend CI → frontend build → Vercel deploy →
  smoke test → deployment summary.
- [ ] **Backend deploy** — if the backend is deployed separately (Railway / Render / etc.),
  confirm `npx prisma migrate deploy` ran against the production database before traffic
  was shifted.
- [ ] **Smoke test passed** — `GET /health` and `GET /ready` return 200 on the production
  URL within 5 minutes of deploy completion.
- [ ] **Vercel production URL confirmed** — the URL in the `notify` job summary matches
  the expected production domain.

---

## Section 9 — Post-Deploy Verification

- [ ] **Critical endpoint spot-check** (run within 10 minutes of deploy):

  | Endpoint | Expected | Actual |
  |---|---|---|
  | `GET /health` | `200`, `status: healthy` | |
  | `GET /ready` | `200`, `ready: true` | |
  | `GET /api/v1/vault/summary` | `200`, numeric fields | |
  | `GET /api/v1/transactions?limit=1` | `200`, pagination envelope | |
  | `GET /api/v1/vault/apy/history?days=7` | `200`, `count >= 0` | |

- [ ] **Error rate unchanged** — check Prometheus / Grafana dashboard; no spike in 5xx
  responses post-deploy compared to the pre-deploy baseline.
- [ ] **Latency within SLO** — P95 for `/api/v1/vault/summary` and `/api/v1/transactions`
  within budgets defined in `src/endpointSlaRegistry.ts`.
- [ ] **No runaway jobs** — `GET /admin/jobs/dashboard` shows all background jobs
  (APY snapshot, idempotency retention, event polling) in a healthy state.
- [ ] **Audit log entry present** — at least one entry appears in
  `GET /admin/audit-logs` from the deploy window, confirming persistence is working.
- [ ] **GitHub Release created** — `release.yml` generated the GitHub Release with the
  auto-updated `CHANGELOG.md` entry.

---

## Section 10 — Rollback Plan

- [ ] **Rollback trigger defined** — rollback is initiated if any of the following occur
  within 30 minutes of deploy:
  - `GET /health` returns non-200 for > 2 consecutive minutes
  - Error rate on any `tier: critical` endpoint exceeds 5 %
  - Any `HIGH` Sentry alert fires for a new error type

- [ ] **Rollback procedure** (document the steps for this specific release):
  ```
  1. Revert the Vercel deployment to the previous production deployment via
     the Vercel dashboard or CLI: `vercel rollback --token $VERCEL_TOKEN`
  2. If migrations were applied and are irreversible, notify the DBA team and
     execute backend/prisma/migrations/<version>/rollback.sql (if present).
  3. Re-tag the previous stable version to trigger a clean redeploy:
         git tag v<PREV_VERSION>-rollback
         git push origin v<PREV_VERSION>-rollback
  4. Confirm /health and /ready return 200 after rollback.
  5. Open a post-mortem issue within 24 hours.
  ```

- [ ] **On-call engineer identified** — name and contact for the 2-hour post-deploy
  monitoring window:  `____________________`

---

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Release owner | | | |
| Secondary reviewer | | | |
| Security reviewer (if contract changes) | | | |

---

## Related documents

- `backend/docs/ENVIRONMENT_VARIABLES.md` — latency monitoring env vars
- `backend/docs/QUERY_OPTIMIZATION.md` — DB index rationale (Issue #895)
- `backend/docs/WEBHOOK_SIGNATURES.md` — webhook security
- `docs/API_VERSIONING_POLICY.md` — breaking-change and sunset policy
- `docs/SECURITY_CHECKLIST.md` — smart contract security review guide
- `docs/FALSE_POSITIVE_HANDLING.md` — Slither false positive process
- `CHANGELOG.md` — release history
- `.github/workflows/README.md` — CI workflow index
