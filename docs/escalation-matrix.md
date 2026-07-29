# Support Escalation Matrix

This document defines the support incident escalation path for YieldVault-RWA, including severity classifications, team handoffs, and response expectations. It is aligned with existing repo runbook style: top-level heading, markdown tables, checklists, and step-by-step operational guidance.

---

## Severity Levels

| Severity | Description | Expected Response | Expected Resolution |
|----------|-------------|-------------------|---------------------|
| P0 | Production down: core service unavailable, users cannot access the vault, or contract operations fail entirely. | 5 minutes | 1 hour |
| P1 | Degraded service: the vault is partially functioning, critical flows are impacted, or there is a major performance regression. | 15 minutes | 4 hours |
| P2 | Non-critical issue: important functionality is impaired but a workaround exists or impact is limited. | 1 hour | 1 business day |
| P3 | Minor / cosmetic issue: low-impact bug, documentation issue, or non-service-affecting UI/UX issue. | 4 hours | 3 business days |

> No existing severity taxonomy was found in the repository. These levels are defined here to align with standard incident classification and to match the operational runbook structure already present in `docs/runbooks/`.

---

## Team Inventory

- **Smart Contracts** – responsible for Soroban contract code, vault logic, strategy integrations, governance, and on-chain emergency controls.
- **Backend / API** – responsible for the YieldVault backend service, API health, dependency monitoring, event replay, and contract interaction.
- **Frontend / UX** – responsible for the UI, wallet integration, user messaging, and severity of user-facing errors.
- **Infrastructure / Operations** – responsible for deployment, RPC failover, database recovery, monitoring, and cloud/runtime dependencies.
- **Security / DevSecOps** – responsible for alerts, secrets management, PagerDuty/Slack integration, threat modeling, and incident review.

> These generic team names are based on repo structure and existing documentation references. Update with actual team names if the organization has a different team model.

---

## Escalation Matrix

| Severity | Initial Responder | Escalation Path | Communication Channel | Stakeholder Notification |
|----------|-------------------|-----------------|-----------------------|--------------------------|
| P0 | Infrastructure / Operations | If unresolved after 10 minutes, page Backend / API and Security. If still unresolved after 20 minutes, escalate to Smart Contracts and Engineering leadership. | PagerDuty -> Slack `#yieldvault-incidents` -> email | Notify CTO / Ops Lead, Product Owner, and Security Lead immediately. |
| P1 | Backend / API | If unresolved after 20 minutes, page Infrastructure / Operations and Security. If still unresolved after 60 minutes, involve Smart Contracts and Product. | Slack `#yieldvault-incidents` + PagerDuty for escalation | Notify Product and Engineering leadership within 1 hour. |
| P2 | Backend / API or Frontend / UX | If unresolved after 2 hours, involve Infrastructure / Operations and Smart Contracts as needed. | Slack `#yieldvault-incidents` | Notify Engineering manager and Ops Lead at next status update. |
| P3 | Frontend / UX or Documentation | Handle during next working day. Escalate to Backend or Infrastructure only if root cause indicates dependency or shared platform risk. | Slack `#yieldvault-incidents` | Notify affected team lead in normal working channel. |

> The communication channels are drawn from existing backend alert integration code (`backend/src/latencyMonitoring.ts`) and runbooks that refer to Slack and PagerDuty.

---

## Escalation Runbook

### Declaring an Incident

1. Confirm the incident scope and assign a severity level using the definitions above.
2. Create an incident ticket in the issue tracking system and capture the following details:
   - Incident summary
   - Severity level
   - Affected service(s)
   - Start time and first detection method
   - Initial responder and on-call team
3. Post the incident summary to Slack `#yieldvault-incidents` and trigger PagerDuty if the issue is P0 or P1.

### P0 – Production Down

- Acknowledge the alert immediately.
- Notify the on-call Operations engineer and page Backend / API, Smart Contracts, and Security.
- Open a war room or dedicated incident channel and add leadership.
- Run the applicable immediate triage checklist:
  - Check backend health endpoints (`/health`, `/ready`).
  - Verify RPC and contract connectivity.
  - Confirm whether database or Redis dependencies are reachable.
- Execute urgent mitigation actions from runbooks such as `docs/runbooks/RPC_FAILOVER.md`, `docs/runbooks/BACKEND_REDEPLOY.md`, or `docs/runbooks/DATABASE_RESTORE.md`.
- Provide status updates every 15 minutes until service is restored.
- When resolved, capture timeline, root cause, and next steps in the incident ticket.
- Schedule a post-mortem and update the register.

### P1 – Degraded Service

- Assign an owner and gather the first responder team.
- Notify Backend / API and Operations; involve Smart Contracts if on-chain behavior or contract access is implicated.
- Confirm there is an active workaround or degraded user impact rating.
- Monitor the incident in the incident channel and provide updates every 30 minutes.
- Escalate to Security if the degraded service appears related to external dependencies, compromise, or data integrity.
- Close the incident once the service is back within normal thresholds and confirm monitoring stability for 30 minutes.

### P2 – Non-critical Issue

- Triage with the responsible team: Backend / API, Frontend / UX, or Infrastructure.
- Document the issue and planned mitigation in the ticket.
- Send a status update once the cause is identified and once the fix is deployed.
- Escalate to Higher severity only if the impact grows or additional dependencies fail.

### P3 – Minor / Cosmetic Issue

- Resolve during normal working hours.
- Use the issue tracker and Slack for coordination.
- Monitor for any related system degradation.

### Opening a War Room

- Create a dedicated communication channel or incident thread.
- Add on-call operators, engineering leads, and security.
- Share relevant logs, health checks, and current mitigation steps.
- Keep the channel focused on resolution and updates.

### Status Updates

- Include the current severity, actions taken, next steps, and any blockers.
- Update every 15 minutes for P0, every 30 minutes for P1, and every 1–2 hours for P2.
- Confirm when the issue is resolved and when monitoring is stable.

### Closing an Incident

1. Confirm the service is healthy.
2. Record the root cause, impact, and remediation actions.
3. Identify follow-up tasks and owners.
4. Schedule a post-mortem review if the incident was P0 or P1.
5. Update the incident ticket and share the summary with stakeholders.

---

## On-call Rotation

| Team | On-call Owner | Coverage | Notes |
|------|---------------|----------|-------|
| Infrastructure / Operations | TBD | TBD | Populate with actual rotation schedule |
| Backend / API | TBD | TBD | Populate with actual rotation schedule |
| Smart Contracts | TBD | TBD | Populate with actual rotation schedule |
| Security / DevSecOps | TBD | TBD | Populate with actual rotation schedule |

> This table is a placeholder. Actual on-call rotation data must be populated from the team roster.
