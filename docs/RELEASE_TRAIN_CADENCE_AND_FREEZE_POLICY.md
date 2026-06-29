# Release Train Cadence and Freeze-Window Policy

This document defines a predictable **release train cadence** for YieldVault-RWA, a **freeze-window** that limits change risk, and an **exception handling** policy.

---

## 1) Goals

- Predictable release timing for users and integrators
- Reduced risk of late-breaking changes
- Clear governance for exceptions and emergency releases

---

## 2) Release train cadence (default)

Use a two-speed model:

### 2.1 Scheduled releases
- **Cadence:** every **2 weeks**
- **Release day:** **Friday** (UTC)
- **Cutoff for normal changes:** end of day **Wednesday** (UTC)

### 2.2 Hotfixes
- Hotfixes can be shipped outside the train schedule for P0/P1 issues

---

## 3) Freeze-window policy

A freeze window starts after the cutoff and blocks most changes.

### 3.1 Freeze window definition
- **Start:** Thursday **00:00 UTC**
- **End:** Friday **end of release** (after tagging + verification)

### 3.2 What is frozen
During the freeze window:
- No new user-visible features
- No dependency upgrades without explicit approval
- No schema or migration changes unless required for a known P0/P1
- No large refactors that can’t be risk-bounded

### 3.3 What is allowed during freeze
- Bug fixes that are:
  - clearly scoped
  - fully tested
  - low-risk (or have a rollback plan)
- Documentation-only changes (changelog, runbooks) are allowed
- Release engineering steps (changelog/version/tagging) are allowed

---

## 4) Exception handling

Exceptions to the freeze are allowed only via a lightweight governance path.

### 4.1 Exception criteria
An exception PR must be one of:
- P0/P1 defect with demonstrated user impact
- Security fix
- Critical reliability/production issue

### 4.2 Exception request workflow
1. Author opens/updates the PR with:
   - expected impact
   - testing performed
   - why the change can’t wait for the next train
   - rollback plan (if applicable)
2. Request approval from:
   - project maintainer (release owner / maintainer group)
3. Maintainer records the decision in the PR description or a tracking issue.

---

## 5) Release branch and tagging workflow

Maintain the existing release governance rules from [docs/release-notes-playbook.md](./release-notes-playbook.md):
- Determine version from `[Unreleased]`
- Prepare release commit
- Tag and push to trigger workflows

If your process uses temporary branches, they must be created/updated before the freeze window starts.

---

## 6) Operational checklist for maintainers during the train

### 6.1 Wednesday (end of cutoff)
- [ ] Ensure all accepted user-visible changes are merged
- [ ] Ensure changelog entries exist for user-visible PRs (see release notes playbook)
- [ ] Confirm remaining open PRs are either:
  - bugfixes eligible for freeze
  - or explicitly deferred

### 6.2 Thursday (freeze start)
- [ ] Stop merging feature PRs
- [ ] Confirm only eligible bugfix/doc changes remain

### 6.3 Friday (release day)
- [ ] Verify CI green
- [ ] Run/confirm release checklist from release playbook
- [ ] Tag and push
- [ ] Monitor post-release signals (CI/workflows, error rates)

---

## 7) Emergency/hotfix policy

Hotfixes must:
- Be tagged as P0/P1 with justification
- Include changelog entry (as appropriate)
- Follow the hotfix process described in [docs/release-notes-playbook.md](./release-notes-playbook.md)

---

## 8) Maintenance

- Review this policy at least quarterly.
- Update if release tooling, CI, or governance cadence changes.

---

**Last updated:** 2026-06-27

