Production Security Checklist — Keys, CORS, Logging, Operational Controls

Purpose: actionable, repo-specific checklist to prepare YieldVault-RWA for production.

Keys & Secrets
- Use a managed secret store (AWS Secrets Manager, GCP Secret Manager, or Vault). Do NOT store production secrets in files or committed envs.
- CI secrets: keep only runtime placeholders in GitHub Actions; reference real secrets from the secret manager at deploy time. Review [.github/workflows/production-deploy.yml].
- JWT secret: migrate to KMS/HSM-backed signing (or use RS256 with private key in KMS). Ensure `JWT_SECRET` passes `validateJwtSecret()` in `backend/src/auth.ts` and fail-fast on invalid secrets.
- API keys: stop using in-memory `API_KEYS` Map (backend/src/middleware/apiKeyAuth.ts). Persist hashed key metadata in a secure DB or secrets store, support revoke/rotate, scopes, expiry, and audit trails.
- Deployment & wallet keys: store private keys in KMS/HSM, use ephemeral credentials for CI, never output keys to logs.
- Rotation & playbook: define owners, rotation schedule (e.g., 90 days), emergency rotation runbook, and automated rotation where possible.

CORS
- Use an explicit allowlist of exact origins; avoid regex patterns in `CORS_ALLOWED_ORIGINS` unless reviewed. See `backend/src/middleware/cors.ts` and `.env.production.example`.
- For browser-only endpoints, reject requests with no `Origin`. For service-to-service API clients, require alternative auth (mutual TLS, API key) rather than allowing no-origin requests silently.
- Keep `credentials: true` only when strictly required and only for exact origins; ensure cookies use `Secure` and appropriate `SameSite` attributes.
- Add a CI check that validates `CORS_ALLOWED_ORIGINS` for production (no `*`, no broad regexes).

Logging Hygiene
- Centralize logging through a structured logger (existing `backend/src/middleware/structuredLogging.ts`). Replace ad-hoc `console.log` in application code and scripts with the structured logger.
- Redaction: sanitize logs before emission. Redact full wallet addresses, raw tokens, `Authorization` headers, `JWT_SECRET`, API keys, and other PII. Use consistent truncation patterns (e.g., first 8 chars + ellipsis).
- Correlation IDs: ensure `correlationId` middleware is applied globally and propagate IDs into external request headers and monitoring breadcrumbs.
- Log levels & sampling: respect `LOG_LEVEL` and sample verbose traces. Ensure error-level logs include stack traces but are rate-limited.
- Retention & access: define retention policy, encrypted storage for logs, restricted viewer roles, and audit who accessed logs.

Operational Controls & Observability
- Token store: require a production-backed refresh token store (Redis with TLS and ACLs or a DB) instead of in-memory maps. `auth.ts` supports Redis — enforce `REDIS_URL` for production.
- Secrets scanning: keep `scripts/secrets-check.js` pre-commit hook, and add secret scanning to CI for all PRs and main branch merges.
- Monitoring & alerts: configure SLOs and alerting channels (Slack / PagerDuty). Ensure alert keys are stored securely and alerting runbooks exist.
- Audit logs: set `ADMIN_AUDIT_LOG_STORAGE` to a persistent, tamper-evident store (DB configured for append-only or a dedicated audit pipeline) and restrict access.
- CI/CD hardening: ensure deploy keys are short-lived, do not print secrets in logs, and run production builds with least privilege. Use signed artifacts for deployment.
- Incident playbooks: maintain documented steps to rotate compromised secrets, revoke keys, and restore service with minimal blast radius.

Immediate repo-specific actions (high priority)
1. Persist API keys: replace in-memory `API_KEYS` with DB-backed hashed keys and add admin endpoints to rotate/revoke (backend/src/middleware/apiKeyAuth.ts).
2. Tighten CORS: enforce explicit origin matching and disallow no-origin for browser endpoints (backend/src/middleware/cors.ts).
3. Add logging sanitizer that redacts secrets and PII before `logger.log` emits (backend/src/middleware/structuredLogging.ts).
4. Require `REDIS_URL` or equivalent token store in production and fail-fast if missing (backend/src/auth.ts already supports Redis; enforce via startup validation).
5. Add CI secret-scan step for PRs using `scripts/secrets-check.js` and fail PRs with detected secrets.

References (files to review)
- `backend/src/auth.ts`
- `backend/src/middleware/cors.ts`
- `backend/src/middleware/apiKeyAuth.ts`
- `backend/src/middleware/structuredLogging.ts`
- `scripts/secrets-check.js`
- `backend/.env.production.example`
- `.github/workflows/production-deploy.yml`

If you want, I can implement the high-priority code changes (API key persistence, CORS tightening, logging sanitizer) and open a PR.

Implementation note
- Status: checklist authored and reviewed (May 30, 2026).
- Scope: keys, CORS, logging hygiene, and operational controls — actionable repo-specific items.
- Next steps: implement high-priority items in `backend/` (API key persistence, CORS tightening, logging sanitizer), then run tests and open a PR.
- Author: Junirezz
