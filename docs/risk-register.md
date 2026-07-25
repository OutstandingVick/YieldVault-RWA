# Risk Register

This risk register captures production risks, current controls, mitigation plans, and review workflows for YieldVault-RWA. Entries are drawn from the codebase, documented runbooks, and the threat model for the Stellar Soroban vault architecture.

---

## Risk Categories

- Smart contract vulnerabilities
- Oracle failures and price feed integrity
- Regulatory and compliance changes
- Liquidity and withdrawal queue risk
- Key management and secret exposure
- Dependency failures (RPC nodes, indexers, database, cache)
- Data integrity and event replay risk
- Governance and admin access risk

> Categories are based on the project domain (RWA/DeFi on Stellar/Soroban), the `docs/THREAT_MODEL.md` trust boundaries, and the repository's contract, backend, and infrastructure responsibilities.

---

## Risk Register

| Risk ID | Category | Description | Likelihood (1–5) | Impact (1–5) | Risk Score | Current Controls | Mitigation Plan | Owner | Status | Last Reviewed |
|---------|----------|-------------|------------------|--------------|------------|------------------|-----------------|-------|--------|---------------|
| R1 | Governance / Admin Access | Single admin or emergency approver compromise could allow malicious upgrades, strategy changes, or pause/unpause actions. | 2 | 5 | 10 | Admin auth checks, dual emergency approver model, admin param change interval, `strategy_registration` admin `require_auth()`. | Add explicit operational guardrails for key custody, rotate admin keys on schedule, and test recovery procedures. | Smart Contracts | Open | 2026-07-25 |
| R2 | Oracle Failures | Oracle price feed failure or manipulation can cause incorrect vault asset valuation during strategy evaluation or withdrawal processing. | 3 | 4 | 12 | Oracle heartbeat, deviation limits, zero/future timestamp checks in oracle validation; `vault.set_oracle_enabled()`, `vault.set_price_oracle()`, `vault.set_oracle_heartbeat()` are admin-only. | Build and test oracle fallback or fail-closed behavior, add oracle data source monitoring, and verify price sanity checks in end-to-end flows. | Smart Contracts / Security | Open | 2026-07-25 |
| R3 | Dependency Failure | Stellar RPC outage, indexer failure, or backend connectivity issue can block deposits, withdrawals, event replay, and monitoring. | 3 | 5 | 15 | Health endpoints in backend (`/health`, `/ready`), `docs/runbooks/RPC_FAILOVER.md`, `docs/incident_response_runbook.md`, `backend/src/sorobanClient.ts` uses `STELLAR_RPC_URL`. | Implement multi-RPC failover, validate backup RPC configuration, and document dependency ownership. | Infrastructure / Operations | Open | 2026-07-25 |
| R4 | Key Management Failures | Secrets in environment variables or pipeline config (e.g., `STELLAR_SECRET_KEY`, `EMAIL_API_KEY`, `PAGERDUTY_INTEGRATION_KEY`, `SLACK_WEBHOOK_URL`) could be exposed or leaked. | 3 | 4 | 12 | `gitleaks` pre-commit secret scanning, `.env.example` templates, and security documentation in `CONTRIBUTING.md`. | Harden secret storage, ensure no secret material is committed, and establish secrets rotation procedures. | Security / DevSecOps | Open | 2026-07-25 |
| R5 | Strategy Contract Risk | A whitelisted strategy contract may behave maliciously or become stale, causing inaccurate value reporting or asset loss. | 2 | 5 | 10 | Strategy whitelist lifecycle, strategy heartbeat validation, admin-only registration and activation in `contracts/vault/src/strategy_registration.rs` and `strategy_heartbeat.rs`. | Require rigorous strategy review, add automated strategy heartbeat alerts, and enforce strategy retirement procedures. | Smart Contracts | Open | 2026-07-25 |
| R6 | Data Integrity / Recovery | Database corruption, replay mismatch, or missed Stellar ledger events can cause inconsistent state between smart contracts and the backend. | 3 | 4 | 12 | Database restore and replay runbooks exist (`docs/runbooks/DATABASE_RESTORE.md`, `docs/runbooks/REPLAY_PROCEDURES.md`), event polling service in backend, readiness probes in backend. | Test database restore and replay drill procedures, add monitoring for replay drift, and confirm event replay coverage after recovery. | Backend / Operations | Open | 2026-07-25 |

---

## Mitigation Workflow

### Adding a Risk

- Any engineer may propose a new risk by opening a new issue or pull request with the risk register template below.
- The entry must include:
  - Risk category
  - Description and affected components
  - Likelihood and impact ratings
  - Current controls
  - Proposed mitigation plan
  - Suggested owner area
- Submit the new risk entry as a draft in this document or as a linked issue.

### Reviewing Risks

- The team must review all open risks on a regular cadence.
- For each risk, confirm whether the likelihood or impact has changed, and update the status and controls.
- Review meetings should include representatives from Smart Contracts, Backend/API, Infrastructure, and Security.

### Moving Risks Through Status

- **Open** — risk is identified and monitored.
- **Mitigated** — controls are implemented and verified, but the risk remains under watch.
- **Accepted** — the risk is understood and deliberately accepted due to cost or product constraints.
- **Closed** — the risk has been eliminated or no longer applies.

### Approval for Status Changes

- Risk status changes must be approved by the risk owner and one additional approver from another area (for example, Security or Infrastructure for Smart Contracts risks).
- For high-impact risks (score ≥ 12), escalate approval to Engineering leadership.

---

## Risk Review Cadence

- **Monthly:** Review P1 and P2 risks, update controls, and confirm mitigation progress.
- **Quarterly:** Review P3/P4 risks, validate that accepted risks remain acceptable, and retire closed risks.
- **After every major incident:** Update the register with any new risks discovered and perform a post-mortem triage.

> This risk register is intentionally actionable and traceable to actual repo findings. Each pre-populated risk entry is grounded in contract logic, backend configuration, or existing operational runbook evidence.
