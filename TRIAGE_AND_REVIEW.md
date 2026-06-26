# Issue Triage, Review Criteria, and Merge Readiness

This document defines how issues are triaged, how pull requests are reviewed, and what is required before a PR can be merged into `main`.

For the **cross-team triage rotation schedule**, primary/secondary ownership, and escalation timelines, see [docs/TRIAGE_ROTATION_CALENDAR.md](./docs/TRIAGE_ROTATION_CALENDAR.md).

---

## Issue Triage Workflow

When a new issue is opened, a maintainer will triage it within **3 business days** using the following steps:

### 1. Validate the Issue
- Confirm the issue is not a duplicate (search open and closed issues).
- Confirm it is actionable — bug reports must include reproduction steps; feature requests must describe the expected behavior.
- If the issue is unclear, add the `needs-info` label and ask the author for clarification.

### 2. Assign Labels
| Label | When to apply |
|---|---|
| `bug` | Confirmed defect in existing behavior |
| `enhancement` | New feature or improvement request |
| `documentation` | Docs-only change |
| `good first issue` | Well-scoped, low-complexity task suitable for new contributors |
| `help wanted` | Maintainers welcome external contributions |
| `needs-info` | More information required from the author |
| `wontfix` | Out of scope or intentionally not addressed |
| `security` | Security-related issue (handle with care — avoid public disclosure of vulnerabilities) |
| `Stellar Wave` | Tracked as part of the Stellar Wave contributor program |

### 3. Set Priority
- **P0 – Critical**: Production outage, data loss, or security vulnerability. Address immediately.
- **P1 – High**: Significant user-facing breakage. Target next release.
- **P2 – Medium**: Non-blocking bug or valuable enhancement. Schedule in upcoming sprint.
- **P3 – Low**: Minor improvement, cosmetic issue, or nice-to-have. Address when bandwidth allows.

### 4. Assign or Leave Open
- If a maintainer will handle it, self-assign.
- If open for community contribution, add `help wanted` and optionally `good first issue`.
- For Stellar Wave program issues, follow the Wave assignment process via Drips.

---

## Pull Request Review Criteria

All PRs must be reviewed before merging. Reviewers should evaluate the following:

### Correctness
- [ ] The code does what the linked issue or PR description says it does.
- [ ] Edge cases and error paths are handled.
- [ ] No regressions introduced in existing functionality.

### Code Quality
- [ ] Code follows the project's existing style and conventions (TypeScript, Rust, etc.).
- [ ] No unnecessary complexity or over-engineering.
- [ ] No dead code, debug statements, or TODO comments left in.

### Tests
- [ ] New behavior is covered by unit or integration tests.
- [ ] Existing tests still pass (`cargo test`, `npm test`).
- [ ] For smart contract changes: security-critical paths have dedicated test cases.

### Security (required for smart contract and auth changes)
- [ ] PR author completed the security checklist in the PR template.
- [ ] Slither static analysis passed or all findings are documented as false positives.
- [ ] No new attack surfaces introduced (reentrancy, access control, input validation).
- [ ] See [`docs/SECURITY_CHECKLIST.md`](docs/SECURITY_CHECKLIST.md) for the full checklist.

### Documentation
- [ ] Public APIs, contract functions, and non-obvious logic are commented.
- [ ] If the change affects user-facing behavior, relevant docs are updated.

### PR Hygiene
- [ ] PR title follows the format: `<Type>: <Short description>` (e.g., `Fix: Resolve deposit rounding error`).
- [ ] PR description includes **Goal**, **Changes**, and **Testing** sections.
- [ ] The PR is linked to its issue (e.g., `Closes #585`).
- [ ] Branch is up to date with `main` and has no merge conflicts.
- [ ] Commits are clean and descriptive.

---

## Merge Readiness Checklist

A PR is ready to merge when **all** of the following are true:

- [ ] At least **1 approving review** from a maintainer (2 for smart contract changes).
- [ ] All CI checks pass:
  - Frontend lint and tests (`frontend.yml`)
  - Rust/WASM build and tests (`rust-wasm.yml`)
  - Secret scanning (`secret-scanning.yml`)
  - Slither analysis (`slither.yml`) — no unresolved High/Medium findings
- [ ] No unresolved review comments.
- [ ] PR is linked to the relevant issue.
- [ ] The branch is up to date with `main`.
- [ ] For smart contract changes: security checklist is fully signed off.

### Who Can Merge
- Maintainers with write access may merge after the above criteria are met.
- Contributors must not merge their own PRs unless explicitly granted permission.
- Do not merge directly to `main` — all changes go through a PR.

---

## Reviewer Expectations

- **Response time**: Reviewers should provide initial feedback within **3 business days** of a PR being marked ready for review.
- **Constructive feedback**: Comments should explain *why* a change is needed, not just *what* to change.
- **Blocking vs. non-blocking**: Prefix non-blocking suggestions with `nit:` or `optional:` so the author knows what must be addressed before merge.
- **Re-review**: After an author addresses feedback, re-review within **2 business days**.

---

## Escalation

If a PR or issue is stalled (no response for 5+ business days), the contributor may:
1. Leave a comment tagging a maintainer.
2. Mention it in the project's community channel.

Maintainers reserve the right to close stale PRs (no activity for 30 days) with a comment explaining why.
