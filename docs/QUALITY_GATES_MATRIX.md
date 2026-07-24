# Quality Gates Matrix by Component Criticality

This matrix defines the required quality gates, testing standards, and review processes based on the criticality of the component being modified.

## Criticality Levels

### Tier 1: Core Smart Contracts & Value Transfer
*Components: Vault Contracts, Token Contracts, Oracle Integrations, Yield Strategies*
- **Unit Test Coverage:** 100% (Line and Branch)
- **Fuzzing/Invariant Testing:** Required (e.g., Echidna, Foundry)
- **Static Analysis:** Slither & Aderyn (0 High/Med findings allowed without documented false positive)
- **Audits:** External audit required for major releases
- **Code Review:** Minimum 2 approvals from Core Contract Maintainers

### Tier 2: Backend Services & API Layer
*Components: Indexers, Transaction Relayers, Webhooks, Data APIs*
- **Unit Test Coverage:** 90%+ 
- **Integration Tests:** Required for all critical paths (deposits, withdrawals)
- **Static Analysis:** SonarQube / ESLint with strict rules
- **Load Testing:** Required for components handling high TPS
- **Code Review:** Minimum 1 approval from Backend Maintainers

### Tier 3: Frontend & User Interfaces
*Components: Web Dashboard, Admin Panel, Mobile views*
- **Unit Test Coverage:** 80%+ (Focus on utility functions and state management)
- **E2E Testing:** Playwright/Cypress covering critical user journeys (Connect Wallet, Deposit, Withdraw)
- **Accessibility (a11y):** Automated Lighthouse checks passing (Score > 90)
- **Code Review:** Minimum 1 approval from Frontend Maintainers

### Tier 4: Operational Tooling & Scripts
*Components: Deployment scripts, CI/CD pipelines, internal CLI tools*
- **Review:** 1 approval from DevOps / Infra Maintainer
- **Testing:** Dry-run capabilities required. Bash scripts must pass `shellcheck`.
- **Documentation:** Clear runbooks and inline comments required.

## Enforcement
These gates are enforced via GitHub Actions branch protection rules. Bypassing these gates requires explicit sign-off from the Tech Lead or Security Lead.
