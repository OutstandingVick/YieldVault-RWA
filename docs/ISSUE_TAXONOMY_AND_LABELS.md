# Repository-Wide Issue Taxonomy and Labeling Standards

To maintain an organized and triagable backlog, all issues and pull requests must adhere to the following taxonomy and labeling standards.

## 1. Category Labels (Type)
Every issue must have exactly **one** type label:
* `type: feature` - New functionality or enhancement.
* `type: bug` - Something is broken or not behaving as intended.
* `type: chore` - Maintenance, dependency updates, refactoring, or tooling.
* `type: docs` - Documentation additions or improvements.
* `type: security` - Security vulnerabilities or improvements (Note: sensitive issues should be reported via security policy, not public issues).

## 2. Surface / Component Labels (Scope)
Indicate which parts of the stack are affected (multiple allowed):
* `scope: contracts` - Smart contracts, Solidity, Foundry.
* `scope: backend` - Node.js, databases, indexers, APIs.
* `scope: frontend` - React, Next.js, UI/UX, Web3 integration.
* `scope: infra` - Deployment, Terraform, CI/CD, GitHub Actions.

## 3. Severity / Priority Labels
Bugs and critical tasks must have a priority:
* `priority: critical` - Production down, funds at risk. Drop everything.
* `priority: high` - Major feature broken, no workaround. Address in current sprint.
* `priority: medium` - Minor bug, edge case, or has a workaround.
* `priority: low` - Trivial issue, cosmetic bug, nice-to-have.

## 4. Status / Workflow Labels
Used by PMs and maintainers to track progress:
* `status: needs-triage` - Default for new issues. Needs review.
* `status: ready-for-dev` - Approved, specced out, and ready to be picked up.
* `status: blocked` - Waiting on a dependency, external team, or design.
* `status: in-progress` - Currently being worked on.

## 5. Workstream / Epic Mapping
For larger initiatives, issues should be tied to a specific workstream:
* `epic: [Name]` - e.g., `epic: v2-vaults`, `epic: compliance-upgrade`.

## Enforcing Standards
* The triage bot will automatically flag issues missing a `type:` or `scope:` label.
* PRs should inherit the labels of the issue they resolve.
* Avoid creating custom labels without proposing them in the `#engineering` channel first.
