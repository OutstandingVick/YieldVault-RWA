# Repository-Wide Issue Taxonomy and Labeling Standards

To maintain an organized and triagable backlog, all issues and pull requests must adhere to the standardized taxonomy and sprint labeling scheme defined below.

For complete sprint lifecycle rules, triage SLAs, and planning cadence, see **[Sprint Labeling Standards & Issue Triage Conventions](./SPRINT_AND_TRIAGE_CONVENTIONS.md)**.

---

## 1. Category Labels (`type: <category>`)
Every issue must have exactly **one** type label:
* `type: feature` — New functionality or capability.
* `type: bug` — Software defect or unintended behavior.
* `type: chore` — Maintenance, dependency updates, refactoring, or tooling.
* `type: docs` — Documentation additions or improvements.
* `type: security` — Security vulnerabilities or improvements (Note: report sensitive vulnerabilities privately via Security Policy).
* `type: refactor` — Structural code improvements without behavioral changes.
* `type: perf` — Performance and latency optimizations.

---

## 2. Surface / Component Labels (`scope: <surface>`)
Indicate which parts of the stack are affected (at least one required):
* `scope: contracts` — Smart contracts, Rust Soroban, WASM deployment.
* `scope: backend` — Node.js, Express, Prisma, indexers, APIs.
* `scope: frontend` — React, Vite, UI/UX, Web3 Freighter integration.
* `scope: infra` — Docker, CI/CD GitHub Actions workflows, Terraform.
* `scope: docs` — Technical documentation, guides, PRDs.
* `scope: governance` — Code review standards, triage rules, issue taxonomy.

---

## 3. Severity / Priority Labels (`priority: <level>`)
Bugs and feature tasks must specify a priority level:
* `priority: p0-critical` — Production outage, data loss, security emergency. Immediate response.
* `priority: p1-high` — Major feature defect or milestone blocker. Address in current sprint.
* `priority: p2-medium` — Standard issue or non-blocking bug. Target upcoming sprint.
* `priority: p3-low` — Minor improvement, cosmetic issue, or nice-to-have.

---

## 4. Workflow Status Labels (`status: <stage>`)
Used to track lifecycle progress:
* `status: needs-triage` — Default for new issues awaiting review.
* `status: triage-in-progress` — Under review by maintainer.
* `status: ready-for-dev` — Approved, specced out, and ready for development.
* `status: in-progress` — Active development underway.
* `status: in-review` — PR submitted and undergoing code review.
* `status: blocked` — Blocked by external dependency or design decision.
* `status: completed` — Merged and verified.
* `status: wontfix` — Declined or out of scope.

---

## 5. Sprint & Workstream Labels

### Sprint Labels (`sprint: <scheme>`)
* `sprint: <YYYY-WXX>` — Standard ISO calendar week sprint (e.g. `sprint: 2026-W30`).
* `sprint: current` — Active sprint issues.
* `sprint: next` — Upcoming sprint backlog.
* `sprint: backlog` — Triaged backlog items awaiting assignment.

### Epic Mapping (`epic: <name>`)
* `epic: <name>` — Tied to major initiatives (e.g., `epic: v2-vaults`, `epic: compliance-upgrade`).

---

## 6. Enforcing Standards
* GitHub Issue templates in `.github/ISSUE_TEMPLATE/` automatically pre-apply default labels.
* Run `npm run validate:sprint-and-triage` to check taxonomy and sprint labeling compliance.
* PRs should inherit the labels of the issue they resolve.
