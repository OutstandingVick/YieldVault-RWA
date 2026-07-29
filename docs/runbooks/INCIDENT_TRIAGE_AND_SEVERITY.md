# Incident Triage & Severity Classification Runbook

**Purpose:** Standardize how every on-call responder triages an alert, classifies
severity, and escalates before engaging a domain-specific playbook.
**Audience:** All on-call engineers (first responder).
**Owner:** DevOps / Platform on-call
**Last Updated:** July 26, 2026
**Related:**
[Runbooks Overview](./README.md) ·
[Quick Reference](./QUICK_REFERENCE.md) ·
[Incident Response (RPC/Delivery)](../incident_response_runbook.md) ·
[Failed Withdrawal Playbook](./FAILED_WITHDRAWAL_INCIDENT_PLAYBOOK.md) ·
[Postmortem Playbook](../postmortem-playbook.md) ·
[Triage Rotation Calendar](../TRIAGE_ROTATION_CALENDAR.md) ·
[Error Code Troubleshooting](./ERROR_CODE_TROUBLESHOOTING.md)

> **This runbook is the starting point for every incident.** Before reaching for
> a domain-specific playbook, every on-call engineer must triage and classify
> severity using this guide. Severity classification determines response
> priority, escalation path, and communication tempo.

---

## 1. When to use this runbook

Use this runbook when **any** of the following occur:

- A monitoring alert fires (PagerDuty, Grafana, Prometheus).
- A user or support agent reports unexpected behavior that could indicate a
  system-level issue.
- A CI pipeline or deployment fails in a way that affects production.
- An on-call engineer notices anomalous metrics or logs during routine review.
- A security scanning alert triggers (`secret-scanning.yml`, `slither.yml`,
  `rust-security.yml`).

**If the alert already maps to a known failure class** (e.g., RPC timeout,
withdrawal failure), proceed through this runbook for severity classification,
then use the quick-reference table in §9 to jump to the right playbook.

---

## 2. Roles

| Role | Responsibility |
|------|----------------|
| **First Responder (you)** | Acknowledge alert, triage, classify severity, escalate if needed. |
| **Incident Commander (IC)** | Owns SEV-1/SEV-2 incidents; coordinates response across teams. |
| **Domain SME** | Backend, Contracts, or Frontend expert pulled in by escalation. |
| **Comms Lead** | Status page, user messaging, stakeholder updates (§7). |

For **SEV-3 and SEV-4** incidents the first responder may own the full
lifecycle. For **SEV-1 and SEV-2**, a dedicated IC is required.

---

## 3. Severity classification

Classify every incident into one of four severity levels. When in doubt,
**round up** — it is safer to downgrade later than to under-escalate a critical
incident.

### SEV-1 — Critical

> **Definition:** Complete outage, data loss or corruption, funds at risk, or
> active security breach. User funds or data are directly threatened.

| Criteria | Examples |
|----------|----------|
| Full platform unavailability | All API routes returning 5xx; frontend unreachable |
| Funds at risk | Withdrawals debited on-chain but not received; unauthorized contract interaction |
| Data loss / corruption | Database unrecoverable; audit log gap exceeding RPO |
| Active security breach | Key compromise; exploit in progress; unauthorized admin access |
| RPO exceeded | Data loss beyond the 15-minute RPO window |

**Response:**
- **Acknowledge within 5 minutes.**
- Page **Incident Commander** immediately.
- Page relevant **domain SME** (Contracts if fund safety, Backend if API, etc.).
- Create war room (`#yieldvault-war-room`).
- Notify stakeholders via status page within 15 minutes.
- **Target mitigation:** Immediate; all hands.

### SEV-2 — High

> **Definition:** Major feature broken, significant user impact, but funds are
> **not** at risk and data is intact.

| Criteria | Examples |
|----------|----------|
| Core feature unavailable | Deposits failing for all users; vault page not loading |
| Circuit breaker open | Soroban write path shedding load; 503s on critical endpoints |
| Widespread but partial | > 20% of requests failing on a critical path |
| Degraded performance | P95 latency > 5× baseline for > 10 minutes |
| RPC provider outage | Primary RPC unresponsive; failover required |

**Response:**
- **Acknowledge within 15 minutes.**
- Page **Incident Commander**.
- Notify domain SMEs.
- Status page update within 30 minutes.
- **Target mitigation:** 30–60 minutes (aligned with component RTO).

### SEV-3 — Medium

> **Definition:** Non-critical feature degraded, limited user impact, workaround
> available.

| Criteria | Examples |
|----------|----------|
| Non-critical feature broken | Portfolio history not loading; referral page error |
| Limited user scope | Single wallet or small subset affected |
| Workaround exists | Users can still perform core actions via alternate path |
| Non-production | Staging/testnet environment issues |
| Scheduled maintenance | Planned downtime communicated in advance |

**Response:**
- **Acknowledge within 1 hour.**
- IC optional; first responder may own.
- Create tracking issue; no war room required unless it escalates.
- **Target mitigation:** Next business day or current sprint.

### SEV-4 — Low

> **Definition:** Cosmetic issue, minor bug, or future concern. No immediate
> user impact.

| Criteria | Examples |
|----------|----------|
| Cosmetic / UI glitch | Visual layout issue; non-blocking console warning |
| Documentation gap | Outdated runbook step; missing error code entry |
| Flaky test | Intermittent CI failure with no production impact |
| Future risk | Deprecation warning; dependency EOL 6+ months out |

**Response:**
- File a GitHub issue with `priority: low`.
- No immediate action required; address in backlog grooming.

---

## 4. First responder triage flow (first 15 minutes)

Follow these steps in order. Record findings in the incident channel.

### Step 1 — Acknowledge (T+0)

- Acknowledge the PagerDuty alert or Slack notification.
- Post in `#yieldvault-incidents`:
  ```
  🚨 ACKNOWLEDGED: [Alert name]
  Investigating — will update within 15 min.
  ```
- If the alert source is unclear, note it and continue.

### Step 2 — Validate the signal (T+0–5)

Determine whether this is a real incident or a false alarm:

1. **Check dashboards.** Open Grafana and confirm the alerting metric is
   anomalous.
2. **Run health checks.**
   ```bash
   curl -s http://localhost:3000/health | jq .
   curl -s $STELLAR_RPC_URL -X POST \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' | jq .
   ```
3. **Spot-check logs.** Look for correlated errors around the alert time.
   ```bash
   journalctl -u yieldvault-backend --since "15 min ago" | grep -i "error\|fatal"
   ```
4. **If false alarm:** Post `✅ False alarm: [brief reason]` and close. Skip
   remaining steps. File a ticket if the alert threshold needs tuning.

### Step 3 — Determine scope (T+5–10)

| Question | How to answer |
|----------|---------------|
| What components are affected? | Check health endpoints for backend, DB, RPC, frontend. |
| Who is affected? | All users, a region, a single wallet? Query logs for unique affected addresses. |
| When did it start? | Correlate with deploy times, config changes, or external events. |
| Is it getting worse? | Check metric slope — flat, increasing, or recovering? |

### Step 4 — Classify severity (T+10–12)

Apply the severity criteria from §3. Be decisive — **classify within 2 minutes**
and revise later if needed.

> **Decision shortcut:** If you hesitate between two levels, pick the higher
> one. Downgrading is a Slack message; upgrading is a page.

### Step 5 — Escalate or own (T+12–15)

| Severity | Action |
|----------|--------|
| **SEV-1** | Page IC + domain SME **immediately**. Start incident report. |
| **SEV-2** | Page IC. Notify domain SMEs. Start incident report. |
| **SEV-3** | Own it. File tracking issue. Notify team lead if not resolved within 1 hour. |
| **SEV-4** | File a GitHub issue. No further immediate action. |

### Step 6 — Engage the right playbook (T+15)

Use the quick-reference table in §9 to jump to the appropriate domain playbook.
Continue updating the incident channel throughout.

---

## 5. Escalation matrix

| Condition | Action |
|-----------|--------|
| SEV-1 declared | Page IC + Security on-call (if security-related) immediately. |
| SEV-2 not mitigated within RTO (30 min) | Escalate to SEV-1; page IC if not already engaged. |
| SEV-3 unresolved after 4 business hours | Notify team lead; consider SEV-2 if scope widens. |
| Suspected contract / fund-safety issue | Page Contracts SME + IC regardless of severity. |
| Security scanning alert (`secret-scanning`, `slither`, `rust-security`) | Follow [Security Scanning Guide](../SECURITY_SCANNING_GUIDE.md); page Security on-call for confirmed High/Critical findings. |

### Escalation contacts

| Role | Channel / Contact |
|------|-------------------|
| Incident Commander | PagerDuty: "YieldVault IC" |
| Backend on-call | `#backend-oncall` |
| Contracts on-call | `#contracts-oncall` |
| Frontend on-call | `#frontend-oncall` |
| Platform / Infra | `#platform-oncall` |
| Security on-call | PagerDuty: "YieldVault Security" |

> Full rotation schedule and ownership calendar is in
> [`TRIAGE_ROTATION_CALENDAR.md`](../TRIAGE_ROTATION_CALENDAR.md).

---

## 6. Triage decision tree

```
Alert fires
│
├─ Is the signal valid?
│  ├─ NO  → False alarm. Log and close.
│  └─ YES → Continue.
│
├─ Are user funds or data at risk?
│  ├─ YES → SEV-1. Page IC + SME. War room.
│  └─ NO  → Continue.
│
├─ Is a core feature completely unavailable to all users?
│  ├─ YES → SEV-2. Page IC.
│  └─ NO  → Continue.
│
├─ Is a non-critical feature degraded or limited scope?
│  ├─ YES → SEV-3. Own or assign.
│  └─ NO  → Continue.
│
└─ Cosmetic or future concern?
   └─ YES → SEV-4. File issue.
```

---

## 7. Communication templates

### Initial acknowledgment (T+0–5)

```
🚨 INCIDENT: [Brief one-liner]
Severity: [Investigating / SEV-1 / SEV-2 / SEV-3]
Scope: [What's affected, how many users]
IC: [Name or "TBD"]
Channel: #yieldvault-war-room
Next update: [Time, within 15–30 min]
```

### Status update (every 15–30 min)

```
📊 UPDATE: [Incident name]
Severity: [Unchanged / Upgraded to SEV-X]
Progress: [Current action, blockers]
Mitigation ETA: [Time or "TBD"]
Next update: [Time]
```

### Mitigated (recovery in progress)

```
🔧 MITIGATED: [Incident name]
Action taken: [Brief description]
Monitoring: [Metrics being watched]
Canary status: [Passed / In progress]
Next: Verification + postmortem
```

### Resolved

```
✅ RESOLVED: [Incident name]
Duration: [Start → End UTC]
Severity: [Final]
Impact: [Users affected, data loss if any]
Root cause (initial): [One line]
Postmortem: [Ticket/PR link or "TBD within 48h"]
```

### Status page (customer-facing, for SEV-1/SEV-2)

**Investigating:** "We are investigating reports of [symptom]. Some users may
experience [impact]. Funds remain secure. Next update in 30 minutes."

**Identified:** "We have identified the cause as [brief]. Our team is working on
a fix."

**Monitoring:** "A fix has been deployed. We are monitoring closely to confirm
resolution."

**Resolved:** "This incident has been resolved. [Brief summary]. A full
postmortem will be published within 5 business days."

---

## 8. Post-triage handoff

Once severity is classified and the domain playbook is engaged:

1. **Start the incident report** using the
   [`incident-report.md` template](./templates/incident-report.md) if not
   already started.
2. **Hand off to IC** (for SEV-1/SEV-2) with a summary of:
   - What triggered the alert
   - What you validated
   - Classified severity and rationale
   - Recommended playbook
3. **Stay available** — the first responder often becomes the scribe or
   comms lead during the response.
4. **After resolution**, ensure a postmortem is scheduled per the
   [Postmortem Playbook](../postmortem-playbook.md):
   - Draft within **48 hours**.
   - Publish within **5 business days**.

---

## 9. Quick reference: symptom → playbook

| Symptom | Severity (default) | Playbook |
|---------|-------------------|----------|
| All endpoints returning 5xx | SEV-1 | [Backend Redeploy](./BACKEND_REDEPLOY.md) |
| Database unreachable or corrupted | SEV-1 | [Database Restore](./DATABASE_RESTORE.md) |
| Primary RPC unresponsive / high latency | SEV-2 | [RPC Failover](./RPC_FAILOVER.md) |
| Withdrawals failing (funds not debited) | SEV-2 | [Failed Withdrawal Playbook](./FAILED_WITHDRAWAL_INCIDENT_PLAYBOOK.md) |
| Withdrawals debited on-chain, not received | SEV-1 | [Failed Withdrawal Playbook](./FAILED_WITHDRAWAL_INCIDENT_PLAYBOOK.md) § escalate immediately |
| Transaction delivery failures spiking | SEV-2 | [Incident Response Runbook](../incident_response_runbook.md) |
| Specific error code (`SOROBAN_*`, `VAULT_*`) | SEV-2/3 | [Error Code Troubleshooting](./ERROR_CODE_TROUBLESHOOTING.md) |
| Ledger event gap / email queue stuck | SEV-3 | [Replay & State Recovery](./REPLAY_PROCEDURES.md) |
| Contract upgrade failure / rollback needed | SEV-1 | [Contract Upgrade Playbook](./CONTRACT_UPGRADE_PLAYBOOK.md) |
| Complete infrastructure loss | SEV-1 | [Full DR Procedure](./FULL_DR_PROCEDURE.md) |
| CI/CD pipeline failure (non-production) | SEV-3 | File issue; notify `#platform-oncall` |
| Security scanning alert | SEV-1/2 | [Security Scanning Guide](../SECURITY_SCANNING_GUIDE.md) |
| Rate limiting / abuse pattern | SEV-2 | Check [rateLimiter.ts](../../backend/src/rateLimiter.ts) config; page Backend on-call |

---

## 10. Post-incident

- [ ] Validate the final severity classification — did it match impact?
- [ ] Ensure an [incident report](./templates/incident-report.md) was filed and
      a [postmortem](./templates/post-mortem.md) is scheduled (SEV-1/SEV-2).
- [ ] Review any alert thresholds that triggered false positives and file
      tuning tickets.
- [ ] If this triage runbook was unclear or missing a path, **update it** in
      the same PR as the postmortem action items.
- [ ] Confirm the incident is linked in
      [`docs/incidents/README.md`](../incidents/README.md) once published.

---

## 11. Readiness checklist

Before your first on-call shift, confirm:

- [ ] You can access Grafana, PagerDuty, and the deployment dashboard.
- [ ] You have SSH / `kubectl` / cloud console access to production.
- [ ] You can run health checks:
  ```bash
  curl -s http://localhost:3000/health | jq .
  psql $DATABASE_URL -c "SELECT 1"
  curl -s $STELLAR_RPC_URL -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' | jq .
  ```
- [ ] You know where the backups are: `s3://yieldvault-backups/database/`
- [ ] You have read and understood this runbook and the
      [Quick Reference](./QUICK_REFERENCE.md).

---

**Last Updated:** July 26, 2026
**Maintained By:** DevOps / Platform Team
**Next Review:** October 26, 2026
