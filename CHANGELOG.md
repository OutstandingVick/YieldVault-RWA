# Changelog

All notable changes to YieldVault-RWA are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- next-release -->

## [Unreleased]

### Features
- CORS configuration for cross-origin API access
- Structured logging, graceful shutdown, caching, and API key authentication
- Network badge showing testnet vs mainnet status in the frontend
- Add wallet activity heatmap aggregation endpoint for admin analytics without exposing raw wallet records (#712)
- Add replay-safe deduplication store for webhook event processing to prevent duplicate downstream delivery during retries and restarts (#710)
- Add deterministic request ID propagation across HTTP handlers, queued jobs, and worker logs using AsyncLocalStorage (#700)

### Bug Fixes
- Vault performance dynamic date filter

### Documentation
- Add release notes playbook and changelog curation guidelines (#618)

### Chores
- Resolve merge conflict in Skeleton and dateUtils imports
