# Cross-Repo Integration Test Ownership and Coordination Model

This document defines the ownership, coordination, and workflow for integration tests that span multiple repositories and services within the YieldVault-RWA ecosystem.

## 1. Ownership Model

Given that integration tests touch multiple services, clear ownership is required to avoid abandoned tests and broken builds.

- **Primary Owner (Initiator):** The team or developer that originates the feature requiring cross-repo coordination is the primary owner of the integration test. They are responsible for writing, maintaining, and debugging the test in the first instance.
- **Secondary Owner (Consumer/Provider):** The team managing the downstream or upstream service being integrated with. They must review the integration tests to ensure they accurately represent the API contract and expected behaviors.

## 2. Test Placement and Infrastructure

- **Dedicated Integration Repo:** For complex multi-surface features, integration tests should be housed in a centralized `integration-tests` repository or a dedicated directory in the primary consumer's repository.
- **CI/CD Triggers:** 
  - Cross-repo tests run on nightly builds to avoid slowing down individual service PRs.
  - On demand triggers can be executed via GitHub Actions `workflow_dispatch` with specific branch names for PRs that span multiple repos.

## 3. Coordination Workflow

1. **RFC / Design Phase:** Any feature spanning multiple repos must include an integration testing plan in its design document.
2. **Contract Agreement:** Service contracts (e.g., OpenAPI, ABI) must be finalized and mockable before cross-repo integration tests are written.
3. **Implementation:** The initiator writes the tests against staging/testnet environments.
4. **Review:** Maintainers from all involved repositories must approve the PR introducing or modifying the integration tests.
5. **Monitoring:** Failures in cross-repo tests should alert the `#integration-alerts` channel, tagging the Primary Owner.

## 4. Environment Standardization

Integration tests must be executed against ephemeral environments or dedicated staging instances that closely mirror production, utilizing seeded deterministic data to avoid flakiness.
