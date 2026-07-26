# RPC Provider Failover Strategy & Configuration Guide

**Status:** Active
**Audience:** Backend / SRE / on-call engineers
**Scope:** Stellar Horizon + Soroban RPC providers used by the YieldVault backend
**Related:** [`runbooks/RPC_FAILOVER.md`](./runbooks/RPC_FAILOVER.md) (hands-on switch procedure),
[`MONITORING_OBSERVABILITY.md`](./MONITORING_OBSERVABILITY.md),
[`SERVICE_DEPENDENCY_MATRIX.md`](./SERVICE_DEPENDENCY_MATRIX.md)

> This guide documents the **strategy and configuration** for RPC provider
> failover: how providers are ordered, how timeouts / retries / circuit
> breaking are tuned, and how an operator switches providers. It complements the
> step-by-step incident runbook in `runbooks/RPC_FAILOVER.md`, which remains the
> authoritative "do this now" checklist during an outage.

---

## 1. Why failover matters

Every deposit and withdrawal is submitted to the Stellar network through a
Soroban RPC endpoint (`submitVaultOperation` in `backend/src/sorobanClient.ts`).
If that endpoint is slow, rate-limited, or down, vault operations stall. To keep
the write path resilient the backend layers three independent protections —
**retries**, a **retry budget**, and a **circuit breaker** — in front of a
configurable provider endpoint that operators can re-point during an incident.

---

## 2. Provider ordering (priority tiers)

Providers are used in a strict priority order. The active provider is whichever
`STELLAR_RPC_URL` / `STELLAR_HORIZON_URL` currently points at; failover is the
act of promoting the next tier.

| Tier | Role | Example | When to use |
|------|------|---------|-------------|
| 0 | **Primary** | Managed/paid provider (highest quota, lowest latency) | Default, steady state |
| 1 | **Secondary** | Independent managed provider on a different network/backbone | Primary degraded, rate-limited, or down |
| 2 | **Tertiary** | Self-hosted node or public community endpoint | Both managed providers unavailable |
| 3 | **Read-only degrade** | Horizon read endpoint only | Writes paused; serve balances/history while recovery is in progress |

**Ordering principles**

1. **Diversity over duplication.** Tier 0 and Tier 1 must not share the same
   upstream operator or hosting region, or a single outage takes out both.
2. **Promote, never skip.** Always fail over to the next tier in order so
   latency/quota characteristics degrade predictably.
3. **Prefer correctness to availability for writes.** If no provider can be
   trusted (e.g. suspected fork / stale ledger), pause writes (Tier 3) rather
   than submit against an unhealthy node. See the circuit breaker below.
4. **Fail back deliberately.** Return to Tier 0 only after it has been healthy
   for a sustained window (see §6), not on the first successful probe.

Record the concrete provider URLs for each tier in the secrets manager, **not**
in this document. Keep at least Tier 0 and Tier 1 provisioned at all times.

---

## 3. Timeout, retry & circuit-breaking strategy

The backend defends the RPC call path with three tunable layers. All are
environment-driven so they can be adjusted per environment without a code
change.

### 3.1 Per-request timeout & bounded retries (`sorobanClient.ts`)

| Setting | Env var | Default | Notes |
|---------|---------|---------|-------|
| Max retries per operation | `SOROBAN_MAX_RETRIES` | `3` | Applied around simulate/submit. |
| Base retry delay | `SOROBAN_RETRY_DELAY_MS` | `1000` ms | **Exponential backoff**: `delay = base × 2^attempt`. |
| Transaction submit timeout | (in-code) | `300` s | Stellar `TransactionBuilder.setTimeout`. |

Validation errors (bad input, simulation failures) are **not** retried — only
transient/transport failures are. This prevents burning the retry budget on
requests that will never succeed.

### 3.2 Retry budget (`retryBudget.ts`)

A global retry budget stops retries from amplifying an outage into a
thundering-herd. Retries are only permitted while the recent success rate stays
healthy.

| Setting | Env var | Purpose |
|---------|---------|---------|
| Max retries in window | `RETRY_BUDGET_MAX_RETRIES` | Hard cap on retries per rolling window. |
| Failure threshold | `RETRY_BUDGET_FAILURE_THRESHOLD` | Failures before the budget tightens. |
| Minimum success rate | `RETRY_BUDGET_MIN_SUCCESS_RATE` | Below this, retries are suppressed. |
| Rolling window | `RETRY_BUDGET_WINDOW_MS` | Measurement window length. |

### 3.3 Circuit breaker (`circuitBreaker.ts`)

When failures cross the threshold the breaker **opens** and the API returns
`503 Service Unavailable` with a `Retry-After` header instead of piling more
load onto a failing provider. This is the signal to fail over.

| Setting | Env var | Purpose |
|---------|---------|---------|
| Failure threshold | `CIRCUIT_BREAKER_FAILURE_THRESHOLD` | Failures that trip the breaker open. |
| Measurement window | `CIRCUIT_BREAKER_WINDOW_MS` | Window the threshold is measured over. |
| Cooldown | `CIRCUIT_BREAKER_COOLDOWN_MS` | How long to stay open before a half-open probe. |

**Interaction:** per-request retries handle blips; the retry budget prevents
retry storms; the circuit breaker sheds load and surfaces a clean `503` once a
provider is genuinely unhealthy. A sustained open breaker is the trigger for the
provider switch in §4.

### 3.4 Recommended starting values

| Environment | `SOROBAN_MAX_RETRIES` | `SOROBAN_RETRY_DELAY_MS` | `CIRCUIT_BREAKER_FAILURE_THRESHOLD` | `CIRCUIT_BREAKER_COOLDOWN_MS` |
|-------------|-----------------------|--------------------------|-------------------------------------|-------------------------------|
| Production | 3 | 1000 | 5 | 30000 |
| Staging | 3 | 500 | 5 | 15000 |
| Local/dev | 1 | 250 | 10 | 5000 |

Tune from these baselines using the RPC latency/error dashboards; do not raise
`SOROBAN_MAX_RETRIES` to mask a provider that should be failed over instead.

---

## 4. Operational switch procedure (summary)

The authoritative, copy-paste checklist lives in
[`runbooks/RPC_FAILOVER.md`](./runbooks/RPC_FAILOVER.md). At a glance:

1. **Confirm the primary is the problem** — check the RPC error-rate/latency
   dashboard and the circuit-breaker state; probe the backup with `curl` before
   switching (`getHealth` / `getLatestLedger`).
2. **Back up current config** — snapshot `.env` and log the previous
   `STELLAR_RPC_URL` for auditability.
3. **Promote the next tier** — set `STELLAR_RPC_URL` (and `STELLAR_HORIZON_URL`
   if applicable) to the next provider in the ordering table.
4. **Reload, don't rebuild** — restart / signal the process so the new endpoint
   is picked up; the circuit breaker resets on a healthy provider.
5. **Verify** — submit a canary read and a low-value write; confirm the breaker
   stays closed and error rate returns to baseline.
6. **Announce** — post status in the incident channel and update the status page
   per §7.

> **Provider ordering config:** keep the ordered list of provider URLs in the
> secrets manager as e.g. `RPC_PROVIDER_TIER_0`, `RPC_PROVIDER_TIER_1`,
> `RPC_PROVIDER_TIER_2`. The switch is then "copy Tier N into `STELLAR_RPC_URL`",
> which removes guesswork during an incident.

---

## 5. Detection & alerting

Fail over on **signals**, not vibes. Wire these to on-call:

- RPC **error rate** above baseline for N minutes.
- RPC **p95 latency** above the SLA in `SERVICE_DEPENDENCY_MATRIX.md`.
- **Circuit breaker open** (503s with `Retry-After` on `/vault/*`).
- **Retry budget exhausted** warnings in structured logs.
- **Vault lifecycle audit** failures spiking — the `vault.*.failed` entries from
  the vault audit log (Issue #888) are a direct, product-level signal that
  submissions are not completing.

---

## 6. Fail-back criteria

Return to a higher-priority provider only when **all** hold:

- Provider healthy on direct probes for a sustained window (≥ 15 min suggested).
- Circuit breaker closed and error rate at baseline on the current provider.
- No active incident depending on the current provider's state.

Fail back during low-traffic windows where possible, and watch the breaker for
one full `CIRCUIT_BREAKER_WINDOW_MS` after switching.

---

## 7. Communication

- **Internal:** announce switch start/finish in the incident channel with the
  from/to tier and the reason.
- **External:** if writes were paused or user-visible errors occurred, update
  the status page and follow the incident comms flow in
  [`incident_response_runbook.md`](./incident_response_runbook.md).
- **Post-incident:** capture provider, duration, and trigger in the postmortem
  ([`postmortem-playbook.md`](./postmortem-playbook.md)) and feed tuning changes
  back into §3.4.

---

## 8. Configuration checklist

- [ ] Tier 0 and Tier 1 providers provisioned with independent operators.
- [ ] Provider URLs stored in secrets manager as ordered tiers (not in git).
- [ ] `SOROBAN_MAX_RETRIES` / `SOROBAN_RETRY_DELAY_MS` set per environment.
- [ ] Retry-budget and circuit-breaker envs set per §3.4.
- [ ] Dashboards + alerts wired per §5.
- [ ] `runbooks/RPC_FAILOVER.md` reviewed and tested against the current
      provider list.
