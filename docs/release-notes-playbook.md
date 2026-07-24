# Release Notes Playbook

This document describes how YieldVault-RWA release notes are structured,
which changes belong in the changelog, and the process for publishing each
release.

---

## 1. Changelog format

The project follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The file lives at `CHANGELOG.md` in the repository root.  Every entry is
written in past tense from the perspective of someone upgrading the software.

### Section order inside a release

Each version block must use the sections below in this order, omitting any
section that has no entries:

| Section | What belongs here |
|---|---|
| **Breaking Changes** | Any change that requires a manual action during upgrade (API removals, schema migrations, env-var renames). |
| **Features** | New capabilities that are immediately usable after upgrading. |
| **Bug Fixes** | Corrections to existing behaviour. |
| **Security** | Vulnerability patches.  Reference CVE or advisory where available. |
| **Performance** | Improvements with measurable throughput or latency impact. |
| **Deprecations** | Existing behaviour that will be removed in a future version. |
| **Documentation** | Notable doc-only changes that affect how integrators use the system. |
| **Chores** | Dependency upgrades, CI changes, refactors with no user-visible effect. |

### Entry style guide

- Start every line with a capital letter and end without a period.
- Reference the issue or PR number at the end: `(#712)`.
- Keep each line to one thought; split compound changes into multiple entries.
- Do not mention internal file paths or implementation details unless they are
  needed to understand the impact.

**Good**

```
- Add wallet activity heatmap aggregation endpoint for admin analytics (#712)
- Fix APY snapshot scheduler retrying completed jobs under high load (#715)
```

**Bad**

```
- added some stuff to index.ts for the wallet endpoint
- Fixed bug
```

---

## 2. Release categories and versioning

| Change type | Version bump |
|---|---|
| Breaking Change | Major |
| Feature | Minor |
| Bug Fix, Security, Performance | Patch |
| Documentation, Chores | No bump |

A release that contains both a Feature and a Bug Fix is a **Minor** release.
A release that contains a Breaking Change is always a **Major** release
regardless of what else it contains.

---

## 3. The `[Unreleased]` section

All changes merged to `main` are added to `[Unreleased]` at the top of
`CHANGELOG.md`.  The `<!-- next-release -->` marker immediately above this
section is used by the release tooling to locate and replace the section header
with the versioned heading.

**Never write a versioned heading directly when merging a PR.**  The release
engineer creates the version block during the release process.

---

## 4. Pull request requirements

Every PR that modifies user-visible behaviour must include a changelog entry.
The entry is added in the PR itself under `[Unreleased]`.

PRs that only affect internal tooling, CI configuration, or test coverage may
omit a changelog entry but must add a `chore` entry if they change a
dependency version.

The PR template at `.github/PULL_REQUEST_TEMPLATE.md` includes a checkbox
confirming the changelog has been updated.

---

## 5. Release checklist

### 5.1 Determine the version

1. Review all entries under `[Unreleased]`.
2. Apply the versioning rules from Section 2.
3. Confirm the new version with the project maintainer.

### 5.2 Prepare the release commit

1. In `CHANGELOG.md`, rename `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD` using
   today's UTC date.
2. Add a new empty `[Unreleased]` section above it with the `<!-- next-release -->`
   marker.
3. Update the version field in `package.json` (root and `backend/`) to match.
4. Commit with the message `chore(release): prepare X.Y.Z`.

### 5.3 Tag and push

```bash
git tag -a vX.Y.Z -m "Release X.Y.Z"
git push origin main --follow-tags
```

Tags trigger the GitHub Actions release workflow which:
- Builds and publishes the Docker image.
- Creates a GitHub Release with the changelog section as the release body.
- Publishes release notes to the project wiki.

### 5.4 Post-release

- Verify the GitHub Release page shows the correct changelog section.
- Announce in the `#releases` channel with a link to the GitHub Release.
- Close the milestone for this version in GitHub.

---

## 6. git-cliff configuration

The repository uses [git-cliff](https://git-cliff.org/) (`cliff.toml`) to
generate draft release notes from conventional commit messages.  The generated
draft is a starting point only.  The release engineer must:

1. Run `npx git-cliff --unreleased` to generate the draft.
2. Edit the output to match the style guide in Section 1.
3. Paste the polished entries into `CHANGELOG.md` under the correct sections.

Do not commit the raw `git-cliff` output without editing it first.

---

## 7. Hotfix process

Hotfixes are made on a `hotfix/vX.Y.Z` branch cut from the release tag.

1. Apply the fix to the hotfix branch.
2. Add a changelog entry under a new `[X.Y.Z+1]` section (patch bump).
3. Merge the hotfix branch into `main` and the release branch if one exists.
4. Tag `vX.Y.Z+1` from `main`.

---

## 8. Security releases

Security fixes must **not** be described in detail in `CHANGELOG.md` until
after the fix has been deployed to all environments and a reasonable disclosure
window has elapsed (minimum 48 hours from deployment).

Use a placeholder entry:

```
### Security
- Patch for reported vulnerability (details disclosed after deployment window)
```

Replace the placeholder with the full description and CVE reference after the
disclosure window closes.
