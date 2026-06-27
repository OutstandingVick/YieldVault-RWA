# Maintainer Onboarding Runbook (Governance + Operations)

This runbook documents what a **new maintainer** needs to know to participate in YieldVault-RWA governance and to perform routine operational duties safely.

It is intended for maintainers handling:
- Issue triage and PR review
- Merge readiness and release governance process
- Routine checks and escalations
- Incident coordination support (ties into the disaster-recovery runbooks)

It is **not** a substitute for the incident/disaster recovery runbooks in `docs/runbooks/`.

---

## 1) Maintainer responsibilities (what “good” looks like)

### 1.1 Governance (issues, PRs, merges)
- Triage new issues within **3 business days** (see [TRIAGE_AND_REVIEW.md](../TRIAGE_AND_REVIEW.md)).
- Apply correct labels and priorities.
- Ensure PRs meet **review criteria** and are **merge-ready** (see merge readiness checklist in [TRIAGE_AND_REVIEW.md](../TRIAGE_AND_REVIEW.md)).
- Require security steps for smart contract changes.
- Keep communication constructive and timely (initial feedback expectation: **3 business days**).

### 1.2 Release governance
- Ensure every user-visible PR includes the required changelog entry and follows the release-notes conventions.
- Support release preparation by following [docs/release-notes-playbook.md](./release-notes-playbook.md).

### 1.3 Routine operational support
- Participate in triage rotation (primary/secondary responsibilities) (see [docs/TRIAGE_ROTATION_CALENDAR.md](./TRIAGE_ROTATION_CALENDAR.md)).
- Monitor for operational signals during business hours:
  - CI failures
  - security scanning alerts
  - incident channel notifications

### 1.4 Escalation
- Escalate promptly for stalled work or production-impacting issues.
- If a situation is severe (P0/P1) or production-facing, coordinate using the incident response + runbook approach.

---

## 2) Where the “rules” live (read in order)

1. **Governance fundamentals**
   - [TRIAGE_AND_REVIEW.md](../TRIAGE_AND_REVIEW.md)
   - [docs/TRIAGE_ROTATION_CALENDAR.md](./TRIAGE_ROTATION_CALENDAR.md)
2. **Release governance**
   - [docs/release-notes-playbook.md](./release-notes-playbook.md)
3. **Incident response / recovery**
   - [docs/incident_response_runbook.md](./incident_response_runbook.md)
   - Operational runbooks in `docs/runbooks/` (DR + failover + replay)

---

## 3) Governance flow (end-to-end)

### 3.1 Issue lifecycle

1. **Validate the issue** (no duplicates; actionable; ask for missing details)
2. **Label** using the label set defined in [TRIAGE_AND_REVIEW.md](../TRIAGE_AND_REVIEW.md)
3. **Set priority** (P0/P1/P2/P3)
4. **Assign or route**
   - self-assign if you will handle it
   - use `help wanted`/`good first issue` when appropriate
   - follow Stellar Wave routing when applicable

**Outcome expectations**
- Items without enough information should be marked `needs-info`.
- Items that are actionable but not high urgency should be queued by priority.

### 3.2 PR lifecycle

1. Confirm the PR satisfies PR hygiene requirements from [CONTRIBUTING.md](../CONTRIBUTING.md) and the template in `.github/PULL_REQUEST_TEMPLATE.md`.
2. Review against:
   - correctness
   - code quality
   - tests
   - documentation
   - **security** (mandatory for smart contract changes)
3. Check **merge readiness** checklist in [TRIAGE_AND_REVIEW.md](../TRIAGE_AND_REVIEW.md).
4. If blocked, request changes with clear rationale and explicit blockers.

### 3.3 Merge readiness gate (non-negotiables)
- At least **1 approving maintainer review** (2 for smart contract changes)
- CI checks pass
- No unresolved review comments
- Security checklist completed for smart contract/auth changes
- PR linked to the relevant issue

---

## 4) Release governance: what maintainers should do

### 4.1 During development
- Ensure user-visible changes include changelog entries under `[Unreleased]`.
- Ensure PR entries follow the style guide from [docs/release-notes-playbook.md](./release-notes-playbook.md).

### 4.2 During release preparation
Follow [docs/release-notes-playbook.md](./release-notes-playbook.md), specifically:
- Determine version using the defined rules
- Prepare release commit (changelog + package.json version alignment)
- Tag and push (trigger workflows)
- Post-release verification + announcement

---

## 5) Routine operational tasks

### 5.1 Triage rotation responsibilities
This repo uses rotating ownership.

Refer to [docs/TRIAGE_ROTATION_CALENDAR.md](./TRIAGE_ROTATION_CALENDAR.md) for your team’s schedule.

**Primary triage (within business hours)**
- Triage new issues within **3 business days**
- Apply labels, priority, and “help wanted” routing
- Review PRs in your domain
- Monitor incidents/CI failure signals during business hours

**Secondary backup**
- Cover triage if primary is unavailable (>4 business hours)
- Approve hotfix PRs for P0/P1 in primary’s domain
- Escalate if SLA is missed

### 5.2 Weekly checklist (recommended)
- [ ] Review open issues with no recent maintainer activity
- [ ] Ensure P0/P1 issues have assignees or explicit next actions
- [ ] Review PRs older than ~3 days and confirm review status
- [ ] Check for CI failure patterns (if repeatedly failing, create an issue)
- [ ] Verify security scanning has no unresolved High/Medium items

### 5.3 Monthly checklist (recommended)
- [ ] Run a quick “governance audit”:
  - [ ] confirm all P0/P1 issues are actively progressed
  - [ ] confirm stale items are either resolved or properly tagged
- [ ] Ensure runbooks are referenced correctly (no dead links)

---

## 6) Escalation paths

### 6.1 Stalled issues / PRs
If work appears stalled beyond the expectations in [TRIAGE_AND_REVIEW.md](../TRIAGE_AND_REVIEW.md):
- Tag/mention the relevant maintainer or team
- If still unresolved, escalate to the maintainer group and mark the issue appropriately

### 6.2 P0/P1 production or security
- Follow [docs/incident_response_runbook.md](./incident_response_runbook.md) for detection/triage/recovery steps.
- If the incident requires infrastructure-level action, use the relevant runbook in `docs/runbooks/`.

---

## 7) Access, secrets, and safe maintenance

- Maintain code review and governance without exposing secrets.
- When working with environment variables, follow:
  - local setup docs: [docs/LOCAL_DEVELOPMENT_QUICKSTART.md](./LOCAL_DEVELOPMENT_QUICKSTART.md)
  - environment references: [docs/ENV_VARIABLE_MATRIX.md](./ENV_VARIABLE_MATRIX.md)
  - secret handling expectations from [CONTRIBUTING.md](../CONTRIBUTING.md)

**Rule of thumb**
- If it’s a credential or token: keep it out of issues/PRs and do not paste raw values into chat.

---

## 8) New maintainer onboarding checklist (first week)

### Day 1–2: Read and map responsibilities
- [ ] Read [TRIAGE_AND_REVIEW.md](../TRIAGE_AND_REVIEW.md)
- [ ] Read [docs/TRIAGE_ROTATION_CALENDAR.md](./TRIAGE_ROTATION_CALENDAR.md)
- [ ] Read [docs/release-notes-playbook.md](./release-notes-playbook.md)
- [ ] Skim [docs/incident_response_runbook.md](./incident_response_runbook.md)
- [ ] Review DR runbook index: [docs/runbooks/README.md](./runbooks/README.md)

### Day 2–4: Shadow governance work
- [ ] Shadow triage for at least one rotation period (or a full set of new issues)
- [ ] Take over 1–2 issues from the current primary triager with clear next steps

### Day 4–6: Shadow PR review
- [ ] Review at least 2 PRs within your domain using the checklist in [TRIAGE_AND_REVIEW.md](../TRIAGE_AND_REVIEW.md)
- [ ] Confirm security checklist steps for any smart contract PRs

### Day 6–7: Operational confidence check
- [ ] Participate in a tabletop-style walkthrough (if available)
- [ ] Confirm the incident/runbook escalation flow is understood (who to page; what doc to open)

---

## 9) “Don’t do this” (governance anti-patterns)

- Don’t merge directly to `main`.
- Don’t ignore security checklist requirements for smart contract changes.
- Don’t disclose security vulnerability details publicly before the project’s disclosure guidance.
- Don’t bypass the secret scanning workflow without a legitimate reason.
- Don’t leave P0/P1 items without an assignee or clear next action.

---

## 10) Runbook updates (how to maintain this document)

Update this onboarding runbook when:
- Governance policies change (triage SLA, label taxonomy, merge readiness requirements)
- Release governance rules change
- Incident handling steps or runbook structure is updated

Suggested cadence:
- Quick review monthly
- Full review quarterly

---

**Last updated:** 2026-06-27

