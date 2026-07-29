# Sprint Labeling Standards and Issue Triage Conventions

This document establishes the production-hardened standards for sprint labels, issue taxonomies, triage workflows, and backlog management in `YieldVault-RWA`.

---

## 1. Overview

To maintain predictable development velocity, clean release planning, and transparent issue tracking across multi-surface teams (Contracts, Backend, Frontend, DevOps), all issues must be categorized using standardized labels and assigned to a sprint lifecycle.

---

## 2. Sprint Labeling Naming Scheme

Sprint labels follow a strict naming format to enable automated filtering, metric tracking, and release alignment:

### Standard Format: `sprint: <YYYY-WXX>`
- **`YYYY`**: ISO 4-digit calendar year (e.g. `2026`).
- **`WXX`**: 2-digit ISO week number (e.g. `W30`).
- **Examples**: `sprint: 2026-W30`, `sprint: 2026-W32`.

### Dynamic Alias Labels
- **`sprint: current`**: Issues scheduled for active execution in the active sprint cycle.
- **`sprint: next`**: Prioritized issues scheduled for the upcoming sprint cycle.
- **`sprint: backlog`**: Triaged issues awaiting sprint capacity allocation.

---

## 3. Sprint Cadence & Lifecycle Procedures

YieldVault-RWA operates on a **2-week sprint cycle** running Monday to Friday (two weeks later).

| Event | Schedule | Key Outputs |
|---|---|---|
| Sprint Planning | Monday 10:00 AM UTC (Day 1) | Sprint backlog committed, issues tagged `sprint: current` |
| Mid-Sprint Checkpoint | Wednesday 14:00 UTC (Day 6) | Blocker resolution, status updates |
| Backlog Grooming | Thursday 15:00 UTC (Day 9) | Future issues estimated, tagged `sprint: next` |
| Sprint Demo & Retrospective | Friday 16:00 UTC (Day 10) | Completed work demonstrated, retro action items logged |
| Sprint Closing & Rollover | Friday 17:00 UTC (Day 10) | Unfinished items reassessed and moved to `sprint: next` or `sprint: backlog` |

---

## 4. Unified Issue Label Taxonomy

Every issue in the repository **must** carry labels from the following taxonomy namespaces:

### A. Type (`type: <category>`) — Required (Exactly 1)
- `type: feature` — New end-user functionality or capability.
- `type: bug` — Software defect or unintended behavior.
- `type: chore` — Maintenance, dependency updates, build tooling.
- `type: docs` — Technical documentation or guide updates.
- `type: security` — Vulnerability remediation or security hardening.
- `type: refactor` — Code structure improvement without behavioral changes.
- `type: perf` — Performance optimization (gas, latency, query speed).

### B. Component Scope (`scope: <surface>`) — Required (At least 1)
- `scope: contracts` — Soroban smart contracts, WASM build, deployment scripts.
- `scope: backend` — Express API, Prisma database, indexers, webhooks.
- `scope: frontend` — React/Vite UI, state management, i18n, Web3 wallet integration.
- `scope: infra` — Docker, CI/CD GitHub Actions workflows, monitoring.
- `scope: docs` — Architecture docs, PRDs, runbooks.
- `scope: governance` — Code review standards, triage rules, issue taxonomy.

### C. Priority (`priority: <level>`) — Required for Bugs & Features
- `priority: p0-critical` — Production outage, data loss, security emergency. Immediate response.
- `priority: p1-high` — Major feature defect or milestone blocker. Target current sprint.
- `priority: p2-medium` — Standard feature or non-blocking defect. Target upcoming sprint.
- `priority: p3-low` — Minor improvement, cosmetic tweak, or nice-to-have.

### D. Workflow Status (`status: <stage>`) — Required (Exactly 1)
- `status: needs-triage` — Newly created issue awaiting maintainer review.
- `status: triage-in-progress` — Currently under evaluation by triage maintainer.
- `status: ready-for-dev` — Approved, specced out, ready for pick up.
- `status: in-progress` — Active development under way.
- `status: in-review` — PR submitted and awaiting review.
- `status: blocked` — Work stopped due to external dependency or missing info.
- `status: completed` — Resolution verified and merged.
- `status: wontfix` — Intentionally declined or out of scope.

### E. Special Program Tags
- `program: stellar-wave` — Contributor program tracked items.
- `good-first-issue` — Low-complexity onboarding task.
- `help-wanted` — Maintainers welcoming external PRs.

---

## 5. Triage SLAs & Escalation Matrix

Maintainers must triage incoming issues within defined service level agreements (SLAs):

- **P0 Critical**: Initial response within **2 hours**, fix target within **24 hours**.
- **P1 High**: Initial response within **24 hours**, fix target in **current sprint**.
- **P2 Medium**: Initial response within **3 business days**, target in **upcoming sprint**.
- **P3 Low**: Initial response within **5 business days**.

---

## 6. Automated Validation & Compliance

Issue templates and taxonomy rules are validated automatically via:
- `scripts/validate-sprint-and-triage-conventions.ts` (`npm run validate:sprint-and-triage`)
- Automated repository governance workflows.
