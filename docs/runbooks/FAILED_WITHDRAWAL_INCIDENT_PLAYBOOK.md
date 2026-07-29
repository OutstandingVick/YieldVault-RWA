# Incident Response Playbook: Failed Vault Withdrawals

**Purpose:** Detect, escalate, mitigate, and communicate incidents where user
vault **withdrawals** fail to complete
**Severity default:** SEV-2 (funds not lost, but user cannot access funds) —
escalate to **SEV-1** if funds appear debited without being received
**RTO Target:** 30 minutes to mitigation (writes restored or safely paused)
**Owner:** Backend on-call
**Last Updated:** July 25, 2026
**Related:**
[`ERROR_CODE_TROUBLESHOOTING.md`](./ERROR_CODE_TROUBLESHOOTING.md) ·
[`RPC_FAILOVER.md`](./RPC_FAILOVER.md) ·
[`../RPC_PROVIDER_FAILOVER_STRATEGY.md`](../RPC_PROVIDER_FAILOVER_STRATEGY.md) ·
[`BACKEND_REDEPLOY.md`](./BACKEND_REDEPLOY.md) ·
[`../incident_response_runbook.md`](../incident_response_runbook.md) ·
[`../postmortem-playbook.md`](../postmortem-playbook.md)

> A "failed withdrawal" is any request to `POST /api/v1/vault/withdrawals` that
> does not reach a durable `confirmed` state — whether it errors, times out, or
> leaves the user unsure whether their funds moved. Because withdrawals move
> user funds, **communicate early and never guess about fund state — verify
> on-chain.**

---

## 1. When to use this playbook

Use this playbook when any of the following are observed:

- Spike in `vault.withdrawal.failed` entries in the **vault lifecycle audit log**
  (Issue #888) or in `5xx`/`503` responses from `/vault/withdrawals`.
- Users report withdrawals stuck in `pending` or erroring out.
- Circuit breaker open on the Soroban write path (`503` + `Retry-After`).
- Withdrawals succeed on-chain but balances/history do not update (persistence
  or reconciliation gap).
- A withdrawal appears **debited on-chain but not received** by the user →
  **treat as SEV-1 immediately** and page the incident commander.

---

## 2. Roles

| Role | Responsibility |
|------|----------------|
| **Incident Commander (IC)** | Owns the incident, declares severity, coordinates. |
| **Backend on-call** | Diagnosis and mitigation (this playbook). |
| **Comms lead** | Status page + user/support messaging (§7). |
| **Contract/chain SME** | On-chain verification, called in for suspected fund-state issues. |

For SEV-2 the backend on-call may hold IC + engineer roles; SEV-1 requires a
dedicated IC.

---

## 3. Detection

Confirm the incident and gather scope before acting.

1. **Vault audit log (fastest product-level signal).** Query the vault
   lifecycle audit trail (Issue #888) for recent failures:
   - Filter `operation = withdrawal`, `outcome = failure`.
   - Note the dominant `errorCode` — it points directly at the failure class
     (see §4). Codes: `SOROBAN_CIRCUIT_OPEN`, `SOROBAN_SIMULATION_ERROR`,
     `IDEMPOTENCY_CONFLICT`, `VAULT_OPERATION_ERROR`.
   - Capture `correlationId` / `traceId` for a representative failure to trace.
2. **Metrics/dashboards.** Check `/vault/withdrawals` error rate & latency, the
   circuit-breaker state, and RPC error/latency panels.
3. **Logs.** Search structured logs by the captured `correlationId`/`traceId`
   for the full request path.
4. **Scope.** Determine: all withdrawals or a subset? One wallet or many? Since
   when? Correlate the start time with deploys, migrations, or RPC changes.

Record findings in the incident channel as you go.

---

## 4. Triage by failure class → mitigation

Match the dominant `errorCode` / symptom to the row below.

### 4.1 `SOROBAN_CIRCUIT_OPEN` — RPC unhealthy, breaker open

- **Meaning:** The Soroban write path is shedding load; the RPC provider is
  failing or slow.
- **Mitigate:** Fail over the RPC provider — follow
  [`RPC_FAILOVER.md`](./RPC_FAILOVER.md) and the ordering/timeout strategy in
  [`../RPC_PROVIDER_FAILOVER_STRATEGY.md`](../RPC_PROVIDER_FAILOVER_STRATEGY.md).
  Once a healthy provider is active the breaker resets and withdrawals resume.

### 4.2 `SOROBAN_SIMULATION_ERROR` — transaction rejected

- **Meaning:** The transaction failed simulation/validation (e.g. timelock not
  elapsed, insufficient shares, contract state needs restore).
- **Mitigate:** Use
  [`ERROR_CODE_TROUBLESHOOTING.md`](./ERROR_CODE_TROUBLESHOOTING.md) withdrawal
  patterns (timelock, insufficient shares, ledger restore). This is usually
  **per-request**, not a systemic outage — do **not** fail over RPC. Guide the
  user/support with the specific remediation.

### 4.3 `IDEMPOTENCY_CONFLICT` — duplicate submission

- **Meaning:** The same `Idempotency-Key` was reused with a different payload,
  or a retry raced an in-flight request.
- **Mitigate:** Confirm whether the original operation succeeded (audit log /
  on-chain). If it did, the user's withdrawal is fine — reassure. If not, have
  the client retry with a **fresh** idempotency key.

### 4.4 `VAULT_OPERATION_ERROR` / `5xx` — backend fault

- **Meaning:** Unhandled backend error (DB unavailable, bug, dependency down).
- **Mitigate:** Check DB health ([`DATABASE_RESTORE.md`](./DATABASE_RESTORE.md))
  and recent deploys. If a recent deploy correlates, **roll back** (§6).

### 4.5 Succeeded on-chain but state not updated — persistence/reconciliation gap

- **Meaning:** The tx confirmed on-chain but the DB transaction/vault state did
  not update (crash between submit and persist).
- **Mitigate:** Do **not** let the user re-submit. Run the position
  reconciliation job to re-sync state from chain, and use
  [`REPLAY_PROCEDURES.md`](./REPLAY_PROCEDURES.md) to replay the missed event.
  Verify the audit log shows `submitted` without a matching `confirmed`.

---

## 5. Escalation

| Condition | Action |
|-----------|--------|
| Failures isolated to one class and mitigable in-band | Backend on-call handles; keep IC informed. |
| Broad outage (all withdrawals failing) > 15 min | Page IC; declare **SEV-2**. |
| Funds debited on-chain but not received, or any suspected loss | Declare **SEV-1**; page IC + contract SME immediately; **pause withdrawals** (§6). |
| Suspected contract/security issue | Page security on-call; follow [`../incident_response_runbook.md`](../incident_response_runbook.md). |

Escalate on **time** as well as symptom: if not mitigated within the 30-minute
RTO, raise severity and pull in more responders.

---

## 6. Mitigation actions (rollback / hotfix / pause)

Prefer the **least invasive** action that stops user harm.

1. **RPC failover** (§4.1) — for provider-driven failures; no deploy needed.
2. **Pause withdrawals** — if fund safety is uncertain, stop new withdrawals
   while investigating. Use the maintenance-mode / feature-flag controls to gate
   the withdrawal route so users get a clear "temporarily paused" response
   instead of ambiguous errors. **Always prefer pausing to risking double-spend
   or loss.**
3. **Roll back** — if a recent deploy correlates with the onset, redeploy the
   last known-good build per [`BACKEND_REDEPLOY.md`](./BACKEND_REDEPLOY.md).
4. **Hotfix** — for a clearly identified bug with a small, tested fix: ship
   behind a flag where possible, verify on staging, then deploy.
5. **Reconcile** — after service is restored, run reconciliation/replay (§4.5)
   so any in-flight withdrawals reach a correct terminal state.

**Verification after any mitigation:** submit a low-value canary withdrawal;
confirm a clean `vault.withdrawal.confirmed` audit entry, updated balance, and
breaker closed. Re-enable withdrawals only after the canary passes.

---

## 7. Communication

- **T+0 (acknowledge):** Post in the incident channel — what's failing, scope,
  severity, IC. If user-facing, publish a status-page notice ("Some withdrawals
  may be delayed — funds are safe; investigating").
- **During:** Update at a fixed cadence (every 15–30 min) even if "no change."
  Give support a canned, accurate holding message. **Never tell a user funds are
  safe until verified on-chain.**
- **Mitigated:** Announce restoration; note whether affected withdrawals need to
  be retried by users or were reconciled automatically.
- **Resolved:** Close the incident; open a postmortem
  ([`../postmortem-playbook.md`](../postmortem-playbook.md)) using the
  [`templates/post-mortem.md`](./templates/post-mortem.md) and
  [`templates/incident-report.md`](./templates/incident-report.md) templates.

---

## 8. Post-incident

- [ ] Publish postmortem with timeline, root cause, and action items.
- [ ] File follow-ups (alerting gaps, missing guardrails, flaky dependency).
- [ ] Confirm every affected withdrawal reached a correct terminal state
      (reconciled or retried) — reconcile the audit log `submitted` vs
      `confirmed` counts to zero out orphans.
- [ ] Feed any timeout/threshold learnings back into
      [`../RPC_PROVIDER_FAILOVER_STRATEGY.md`](../RPC_PROVIDER_FAILOVER_STRATEGY.md) §3.4.
- [ ] Update this playbook if a new failure class was discovered.

---

## 9. Quick reference

| Symptom / `errorCode` | First action | Runbook |
|-----------------------|--------------|---------|
| `SOROBAN_CIRCUIT_OPEN`, 503s | Fail over RPC provider | [RPC_FAILOVER](./RPC_FAILOVER.md) |
| `SOROBAN_SIMULATION_ERROR` | Per-request troubleshooting (timelock/shares) | [ERROR_CODE_TROUBLESHOOTING](./ERROR_CODE_TROUBLESHOOTING.md) |
| `IDEMPOTENCY_CONFLICT` | Verify original succeeded; retry w/ new key | this doc §4.3 |
| `VAULT_OPERATION_ERROR` / 5xx | Check DB + recent deploys; roll back | [BACKEND_REDEPLOY](./BACKEND_REDEPLOY.md) |
| On-chain OK, state stale | Reconcile + replay; do not re-submit | [REPLAY_PROCEDURES](./REPLAY_PROCEDURES.md) |
| Funds debited, not received | **SEV-1**, pause withdrawals, page SME | [incident_response_runbook](../incident_response_runbook.md) |
