# Release Verification Checklist (Backend + Frontend + Contracts)

Use this checklist before every release candidate and production deployment.
A release is considered **ready** only when all required checks pass or have an approved exception.

---

## 1) Release Context

- [ ] Release version/tag prepared (e.g., `vX.Y.Z`)
- [ ] Target network/environment confirmed (dev / testnet / mainnet / production)
- [ ] Scope confirmed (backend / frontend / contracts)
- [ ] Rollback owner assigned
- [ ] Incident channel and on-call contact confirmed

### Metadata

| Field | Value |
|---|---|
| Release Version |  |
| Release Date (UTC) |  |
| Release Manager |  |
| Backend Commit SHA |  |
| Frontend Commit SHA |  |
| Contracts Commit SHA |  |
| Contract IDs (if changed) |  |
| Notes |  |

---

## 2) Preconditions (Must be true before smoke tests)

### Repository & Build Health

- [ ] CI for target commit/branch is green
- [ ] No unresolved critical/high severity issues for release scope
- [ ] Dependency install works from clean environment
- [ ] Environment variables/secrets updated and validated

### Data & Migration Safety (Backend)

- [ ] Migration scripts reviewed
- [ ] Migration tested in staging with production-like data
- [ ] Backup/snapshot completed and restorable
- [ ] Rollback steps for DB changes documented

### Contract Safety (Soroban / Rust)

- [ ] Toolchain versions verified per runbook (`docs/DEPLOYMENT.md`)
- [ ] Contract builds successfully to WASM
- [ ] Optimized WASM generated
- [ ] Upgrade path rehearsed on testnet (if upgrade release)

---

## 3) Backend Smoke Checks

> Goal: Verify API/service correctness, safety, and observability after deployment.

### Service Health

- [ ] API process starts without errors
- [ ] Health endpoint returns OK (liveness/readiness)
- [ ] DB connection established
- [ ] Redis/cache connection established (if enabled)
- [ ] Background workers/queues connected (if applicable)

### Core Functional Paths

- [ ] Auth/session flow works (if applicable)
- [ ] Vault read endpoints return valid data (TVL/share metrics)
- [ ] Deposit-related backend path works (if backend-assisted)
- [ ] Withdraw-related backend path works (if backend-assisted)
- [ ] Event ingestion/indexer catches up and processes new events
- [ ] Pagination endpoints return stable cursors/next pages

### Data Integrity

- [ ] No unexpected null/zeroed critical fields
- [ ] Contract-derived values are parsed/scaled correctly
- [ ] Time-series / analytics values are monotonic where expected
- [ ] No duplicate event processing / idempotency regressions

### Security & Reliability

- [ ] Rate limits applied to public API routes
- [ ] Protected routes reject unauthorized access
- [ ] Error responses do not leak secrets
- [ ] Logs contain correlation/request IDs
- [ ] No sustained error spike in first 15–30 min

---

## 4) Frontend Smoke Checks

> Goal: Confirm critical user journeys and display accuracy across supported clients.

### Application Boot & Connectivity

- [ ] Frontend builds successfully in release mode
- [ ] App loads with no blocking console/runtime errors
- [ ] API base URL points to intended backend
- [ ] Network/environment badge (if present) shows correct environment

### Wallet & Transaction UX

- [ ] Wallet connection flow works (Freighter)
- [ ] Correct network enforcement (testnet/mainnet) works
- [ ] Deposit form validates inputs and submits expected transaction flow
- [ ] Withdraw form validates inputs and submits expected transaction flow
- [ ] Pending / success / failure states render correctly
- [ ] User receives clear recovery guidance for failed tx

### Data & UI Correctness

- [ ] TVL, Share Price, Total Shares display expected values
- [ ] User balances/position data match backend/on-chain values
- [ ] Loading/empty/error states are user-friendly
- [ ] No critical layout breakage on desktop + mobile widths
- [ ] Accessibility quick pass (keyboard nav, focus visibility, labels)

### Browser Sanity

- [ ] Chrome latest
- [ ] Firefox latest
- [ ] Safari (or WebKit equivalent in CI/device farm)
- [ ] No critical regression across supported browsers

---

## 5) Smart Contract Smoke Checks

> Goal: Validate deploy/upgrade correctness, invariants, and operational safety.

### Build/Deploy Verification

- [ ] Contract compiled with pinned toolchain
- [ ] Optimized WASM hash recorded
- [ ] Correct contract deployed/upgraded on target network
- [ ] Deployed Contract ID documented in release metadata
- [ ] ABI/interface compatibility verified against frontend/backend clients

### Functional Contract Paths

- [ ] `initialize` (for new deploys) succeeds with expected params
- [ ] `deposit` succeeds for nominal amount
- [ ] `withdraw` (or pending-withdraw flow) succeeds
- [ ] `get_share_price` returns valid scaled value
- [ ] Strategy/yield event flow emits expected events
- [ ] Pause/unpause admin controls verified (if applicable)

### Invariants & Guardrails

- [ ] Share accounting invariants preserved after deposit/withdraw
- [ ] Access control checks enforced for admin-only calls
- [ ] Oracle/price validation guardrails functioning
- [ ] Upgrade auth checks validated (unauthorized upgrade blocked)
- [ ] Contract version endpoint reflects expected release version (if implemented)

---

## 6) Cross-Layer End-to-End Smoke

> Goal: Ensure backend + frontend + contracts work together as one system.

- [ ] Connect wallet in frontend
- [ ] Perform deposit from UI; transaction confirms
- [ ] Backend/indexer observes and reflects updated state
- [ ] Frontend refreshes with updated balances/share metrics
- [ ] Perform withdraw from UI; transaction confirms
- [ ] Final balances consistent across UI, API, and on-chain reads
- [ ] No critical errors in logs during E2E run

Record test wallet/account used: `__________________________`

---

## 7) Observability & Operational Readiness

- [ ] Dashboards reviewed (API latency, error rate, chain/indexer lag)
- [ ] Alerting channels active and tested
- [ ] Log retention and query access confirmed
- [ ] Runbooks linked and reachable by on-call
- [ ] Rollback drill confirmed for this release type

---

## 8) Release Decision

### Required Approvals

- [ ] Backend Owner
- [ ] Frontend Owner
- [ ] Contract Owner
- [ ] QA/Release Manager

### Decision

- [ ] **GO**
- [ ] **NO-GO**

If NO-GO, summarize blockers and mitigation plan:

- Blocker:
- Owner:
- ETA:
- Mitigation:

---

## 9) Post-Release Verification (First 30–60 Minutes)

- [ ] Error rate within normal baseline
- [ ] No unresolved P0/P1 alerts
- [ ] Deposit/withdraw success rates normal
- [ ] Indexer/event lag within threshold
- [ ] User-reported issues triaged
- [ ] Release note/status update posted

---

## 10) Sign-off

| Role | Name | Date (UTC) | Signature/Handle |
|---|---|---|---|
| Release Manager |  |  |  |
| Backend Owner |  |  |  |
| Frontend Owner |  |  |  |
| Contract Owner |  |  |  |