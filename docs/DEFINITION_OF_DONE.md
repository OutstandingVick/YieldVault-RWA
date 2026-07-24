# Definition of Done (DoD) for Multi-Surface Features

Features that span across multiple surfaces (Backend, Frontend, Smart Contracts, Infrastructure) require a rigorous Definition of Done to ensure complete, secure, and maintainable delivery. 

Use this checklist before marking a multi-surface feature as "Done".

## 1. Smart Contracts
- [ ] Code is fully implemented and peer-reviewed by at least two core maintainers.
- [ ] 100% Unit test coverage achieved.
- [ ] Fuzzing and invariant tests implemented and passing.
- [ ] Slither / Static analysis run and all findings addressed or documented.
- [ ] Gas optimization report generated and regressions justified.
- [ ] Contract deployed to testnet and addresses documented.

## 2. Backend & APIs
- [ ] API endpoints implemented and matching the agreed-upon OpenAPI spec.
- [ ] Database migrations created, tested (up/down), and reviewed.
- [ ] Unit and Integration tests written and passing.
- [ ] Logging (with correlation IDs) and metrics implemented for new flows.
- [ ] Rate limiting and security constraints applied.

## 3. Frontend
- [ ] UI components implemented matching Figma designs.
- [ ] State management handles loading, success, and error states gracefully.
- [ ] E2E tests (Playwright/Cypress) written for the happy path of the new feature.
- [ ] Feature is responsive across mobile and desktop breakpoints.
- [ ] Web3 integration handles wallet disconnects, network switching, and pending transactions.

## 4. Documentation
- [ ] User-facing documentation/guides updated.
- [ ] API documentation (Swagger/Postman) updated.
- [ ] Runbooks and incident response procedures updated (if infra/ops changed).
- [ ] Architecture diagrams updated (if new services/components added).

## 5. Security & Observability
- [ ] Threat modeling considered for the holistic feature.
- [ ] Alerts and dashboards created for new critical metrics (e.g., failure rates).
- [ ] Feature flagged appropriately (if using gradual rollout).

## 6. Release Management
- [ ] Cross-repo integration tests passing in the staging environment.
- [ ] Deployment checklist and rollback plan created.
- [ ] PR descriptions clearly link to all related PRs across different repositories.
