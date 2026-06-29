# Incident Postmortem Playbook

This document describes when YieldVault writes postmortems, how action items are
tracked, and the publication workflow for finalized reports.

---

## 1. When to write a postmortem

Write a postmortem for any of the following:

| Trigger | Examples |
|---------|----------|
| **Severity 1–2 incidents** | Full outage, data loss risk, contract pause |
| **DR events** | Database restore, RPC failover, backend redeploy under pressure |
| **Security incidents** | Key compromise, unauthorized access, exploit attempt |
| **Contract upgrades with issues** | Failed upgrade, rollback, unexpected state |

Lower-severity incidents may use a shortened report at the Incident Commander's
discretion, but must still capture root cause and action items.

---

## 2. Timeline

| Phase | Deadline | Deliverable |
|-------|----------|-------------|
| During incident | Real-time | [Incident Report Template](./runbooks/templates/incident-report.md) |
| Post-incident | Within 48 hours | Postmortem draft |
| Publication | Within 5 business days | Published report in `docs/incidents/` |

These deadlines align with the [Quick Reference](./runbooks/QUICK_REFERENCE.md)
post-mortem checklist and [Incident Response Runbooks](./runbooks/README.md).

---

## 3. Roles

| Role | Responsibility |
|------|----------------|
| **Incident Commander** | Owns timeline accuracy and severity classification |
| **Author** | Drafts postmortem from incident report and logs |
| **Reviewer** | DevOps or Security lead validates technical accuracy |
| **Release engineer** | Ensures security-sensitive details follow disclosure rules |

---

## 4. Creation flow

1. **Start from template** — Copy
   [`docs/runbooks/templates/post-mortem.md`](./runbooks/templates/post-mortem.md).
2. **Optional draft location** — Save work-in-progress to
   `docs/incidents/drafts/INCIDENT-XXX-slug.md` (not indexed until published).
3. **Gather inputs**:
   - Live [incident report](./runbooks/templates/incident-report.md)
   - Grafana / PagerDuty timelines
   - Backend diagnostics bundle (`/api/diagnostics/bundle`)
   - Relevant runbook steps exercised
4. **Complete all sections** — Summary, impact metrics, timeline, root cause,
   action items table, lessons learned.

---

## 5. Action-item tracking

Every postmortem must include an **Action Items** table with:

| Column | Required |
|--------|----------|
| ID | Yes (`AI-001`, `AI-002`, …) |
| Action | Yes |
| Owner | Yes |
| Priority | Yes (P0/P1/P2) |
| Due Date | Yes |
| Tracking Issue | Yes — link to GitHub issue |
| Status | Yes (Open / In Progress / Done) |

**Workflow:**

1. File each action item as a GitHub issue referencing the incident ID.
2. Link the issue number in the postmortem table.
3. Review open action items in the quarterly runbook review
   ([runbooks README](./runbooks/README.md) §Continuous Improvement).

---

## 6. Review and redaction

Before publication:

- [ ] Incident Commander and Reviewer sign off on timeline and severity
- [ ] Remove credentials, PII, and unreleased vulnerability details
- [ ] For **security incidents**, follow the 48-hour minimum disclosure window
  described in [Release Notes Playbook](./release-notes-playbook.md) §8
- [ ] Confirm customer-facing language is approved if published externally

---

## 7. Publication flow

1. **Open a PR** adding the finalized report to `docs/incidents/` using the
   naming convention: `YYYY-MM-DD-INCIDENT-XXX-short-slug.md`
2. **Set `Status: Published`** in the report header (drafts must not remain in
   `docs/incidents/` root)
3. **Update the index** in [`docs/incidents/README.md`](./incidents/README.md)
4. **Link action items** — Ensure every `AI-xxx` row has a merged or open GitHub
   issue
5. **Update runbooks** if new failure modes were discovered
6. **Announce** in `#yieldvault-incidents`; update status page if user-facing
7. **Merge PR** after reviewer approval

CI validates postmortem structure via `scripts/validate-postmortem.sh`. Install the
workflow from [`docs/ci/postmortem-docs.workflow.yml`](./ci/postmortem-docs.workflow.yml)
into `.github/workflows/` to enable automated PR checks.

---

## 8. DR test reports

Disaster recovery exercises that surface runbook gaps should file a
[DR Test Report](./runbooks/templates/dr-test-report.md). Significant findings
warrant a full postmortem using the same publication flow.

---

## 9. Runbook feedback loop

After each published postmortem:

1. Identify runbook sections that were unclear or missing
2. Open a follow-up PR updating the relevant runbook under `docs/runbooks/`
3. Record the change in the postmortem's **Runbook Updates Required** section

---

**Last Updated:** June 26, 2026
**Maintained By:** DevOps Team
**Issue:** [#769](https://github.com/Junirezz/YieldVault-RWA/issues/769)
