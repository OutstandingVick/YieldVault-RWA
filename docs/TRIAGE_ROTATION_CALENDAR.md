# Cross-Team Bug Triage Rotation & Ownership Calendar

This document defines the rotating triage ownership model and escalation timeline for YieldVault-RWA. It extends [TRIAGE_AND_REVIEW.md](../TRIAGE_AND_REVIEW.md) with team assignments and on-call expectations.

## Teams & Domains

| Team | Primary domain | GitHub label filter | Escalation contact |
|------|----------------|---------------------|--------------------|
| **Platform** | CI/CD, infra, observability, security scanning | `platform`, `ci`, `monitoring` | `#platform-oncall` |
| **Backend** | API, indexer, caching, webhooks | `backend`, `api` | `#backend-oncall` |
| **Contracts** | Soroban vault, oracle, upgrades | `contracts`, `enhancement` + `contracts/` path | `#contracts-oncall` |
| **Frontend** | React app, wallet UX, accessibility | `frontend`, `ui` | `#frontend-oncall` |

## Weekly Rotation Schedule

Rotations start **Monday 00:00 UTC** and run for one calendar week. Each week one team serves as **Primary Triage** and another as **Secondary Backup**.

| Week (UTC, 2026) | Primary | Secondary |
|------------------|---------|-----------|
| Jun 30 – Jul 6 | Backend | Platform |
| Jul 7 – Jul 13 | Contracts | Backend |
| Jul 14 – Jul 20 | Frontend | Contracts |
| Jul 21 – Jul 27 | Platform | Frontend |
| Jul 28 – Aug 3 | Backend | Platform |

The cycle repeats every four weeks. Update this table at the start of each quarter.

### Primary responsibilities

1. Triage all new issues within **3 business days** (see [TRIAGE_AND_REVIEW.md](../TRIAGE_AND_REVIEW.md)).
2. Apply labels, priority, and `help wanted` where appropriate.
3. Review PRs owned by the primary team's domain first.
4. Monitor `#incidents` and CI failure alerts during business hours.

### Secondary responsibilities

1. Cover triage if primary is unavailable (>4 business hours).
2. Approve hotfix PRs for P0/P1 issues in the primary team's domain.
3. Escalate to maintainers if rotation SLA is missed.

## Escalation Timeline

| Elapsed time | Action |
|--------------|--------|
| **0–24 h** | Primary triages new issues; author notified of labels/priority |
| **24–72 h** | Primary assigns or requests `needs-info`; Stellar Wave issues routed per program rules |
| **72 h – 5 business days** | Secondary takes un triaged items; `@mention` team lead in issue |
| **> 5 business days** | Escalate to maintainer group; issue tagged `triage-overdue` |
| **P0 security/production** | Immediate page to Primary **and** Platform; bypass normal queue |

## Ownership Calendar (Standing Meetings)

| Day | Time (UTC) | Meeting | Attendees |
|-----|------------|---------|-----------|
| Monday | 15:00 | Triage handoff | Outgoing + incoming Primary |
| Wednesday | 16:00 | Cross-team bug review | All team leads |
| Friday | 14:00 | Stellar Wave backlog grooming | Primary + program coordinator |

## Handoff Checklist

At rotation handoff, outgoing Primary confirms:

- [ ] Zero open issues older than 3 business days without label
- [ ] All P0/P1 issues have an assignee or explicit `help wanted`
- [ ] Open PRs > 3 days old have a review comment or reviewer assigned
- [ ] `#incidents` channel has no unresolved threads > 24 h

## Related documents

- [TRIAGE_AND_REVIEW.md](../TRIAGE_AND_REVIEW.md) — Review criteria and merge readiness
- [docs/MONITORING_OBSERVABILITY.md](./MONITORING_OBSERVABILITY.md) — Alert routing
- [CONTRIBUTING.md](../CONTRIBUTING.md) — Contributor workflow
