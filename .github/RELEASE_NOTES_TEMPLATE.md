# Release Notes Template — YieldVault-RWA

Use this template when creating GitHub Releases or drafting version release notes. All major and minor releases must include populated **Security Highlights** and **Performance Highlights** sections.

---

# YieldVault-RWA `vX.Y.Z` — [Release Title / Tagline]

**Release Date:** `YYYY-MM-DD`  
**Git Tag:** `vX.Y.Z`  
**Target Commit / SHA:** `[Commit SHA]`  
**Release Lead:** `@username`  

---

## 🚀 Release Overview & Executive Summary

[Provide a high-level summary (2-4 sentences) explaining the key objectives, strategic improvements, and major deliverables in this release.]

---

## 🔒 Security Highlights & Vulnerability Fixes

> [!IMPORTANT]
> All security fixes, audit findings, access control enhancements, and dependency vulnerability patches must be cataloged below.

### 🛡️ Security Audit & Vulnerability Patches
- **CVE Reference / Advisory ID**: `[e.g., CVE-2026-XXXX or GHSA-xxxx-xxxx-xxxx | N/A]`
- **Vulnerability Patch**: [Describe the security fix, root cause remediated, and components affected].
- **Access Control & Verification**: [Detail any new permission guards, role checks, or CEI pattern enforcement].

### 🔍 Static Analysis & Scanner Sign-Off
- **Slither Static Analysis**: `Passed (0 High/Med findings)` / `[Documented False Positives: FP-XXX]`
- **Dependency Audit**: `npm audit passed (0 high/critical vulnerabilities)`
- **Secret Scanning**: `0 active leaks detected via Gitleaks`
- **Security Lead Sign-Off**: `@security-lead` ✅

---

## ⚡ Performance & Gas Optimizations

> [!TIP]
> Detail quantitative performance improvements, smart contract gas unit savings, RPC latency reductions, or database query optimizations.

### ⛽ Smart Contract Gas Benchmark Highlights
| Contract / Operation | Baseline Gas | New Gas | Improvement (%) | Notes |
|---|---|---|---|---|
| `deposit()` | `45,200` | `39,100` | `-13.5%` | Optimized storage layout & CEI loop |
| `withdraw()` | `52,800` | `46,400` | `-12.1%` | Reduced storage read operations |

### 🚀 Backend & API Latency Metrics
- **API Endpoint Throughput**: Increased throughput from `X req/sec` to `Y req/sec` (`+Z%`).
- **Database Query Latency**: Reduced p99 query latency from `X ms` to `Y ms` on indexing endpoints.
- **RPC Provider Failover**: [Detail failover latency or connection pooling improvements].

---

## 💥 Breaking Changes & Migration Guide

> [!CAUTION]
> Detail any breaking API changes, database schema migrations, or environment variable renames requiring operator action.

- [ ] **Migration Action Required**: `[Describe step-by-step migration instructions]`
- **API Removals / Deprecations**: `[Details]`
- **Database Migrations**: `npx prisma migrate deploy`

---

## ✨ New Features & Enhancements

- **Feature Title**: Brief description of new functionality. (#Issue)
- **Feature Title**: Brief description of new functionality. (#Issue)

---

## 🐛 Bug Fixes & System Stability

- **Fix Title**: Description of fix and issue resolved. (#Issue)
- **Fix Title**: Description of fix and issue resolved. (#Issue)

---

## 📖 Documentation & Developer Tooling

- Updated architecture documentation and domain glossary. (#Issue)
- Added new CLI validation scripts and CI workflow improvements. (#Issue)

---

## 📦 Dependency & Infrastructure Updates

- Upgraded `@stellar/stellar-sdk` to `vX.Y.Z`.
- Upgraded `postgres` base image to `16.2`.

---

## 👥 Contributors & Acknowledgments

Thank you to all community members and maintainers who contributed to this release!
- `@contributor1`
- `@contributor2`
