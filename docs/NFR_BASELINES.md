# Non-Functional Requirement (NFR) Baselines Specification

This document defines the production-grade Non-Functional Requirement (NFR) baselines for `YieldVault-RWA`, establishing binding Service Level Objectives (SLOs), Service Level Indicators (SLIs), Recovery Time Objectives (RTOs), Recovery Point Objectives (RPOs), Error Budget policies, and scalability ceilings.

---

## 1. Overview & Tier Taxonomy

YieldVault-RWA operates across four criticality tiers. NFR baselines and SLA/SLO expectations are governed by tier criticality:

| Tier | Component Scope | Primary Responsibility | Target Availability |
|---|---|---|---|
| **Tier 1: Core Smart Contracts** | Soroban Vault, Token Shares (`yvUSDC`), Yield Strategy connectors, Access Control | Smart Contract Maintainers & Security Lead | **99.99%** |
| **Tier 2: Backend API & Data Layer** | Express API, Prisma Postgres DB, Transaction Relayer, Webhook Engine | Backend Maintainers | **99.9%** |
| **Tier 3: Frontend UI & Client Web3** | React/Vite Dashboard, Admin Panel, Freighter integration | Frontend Maintainers | **99.9%** |
| **Tier 4: Operational Tooling & CI** | GitHub Actions, deployment scripts, monitoring dashboards | DevOps Maintainers | **99.5%** |

---

## 2. Service Level Objectives (SLO) & Service Level Indicators (SLI)

### 2.1 Tier 1: Smart Contracts (Soroban WASM)
- **Availability SLO**: **99.99%** uptime on Stellar ledger closure.
- **Transaction Finality SLI**: 100% of confirmed transactions settled within **6 seconds** (Stellar consensus target).
- **Vault Invariant Violation SLO**: **0 unhandled invariant failures** (e.g., share pricing divergence or CEI pattern violations).
- **Gas Limit Ceiling**:
  - `deposit()`: **<= 45,000 gas units**
  - `withdraw()`: **<= 50,000 gas units**

### 2.2 Tier 2: Backend API & Indexing Services
- **Availability SLO**: **99.9%** availability over a rolling 30-day window (maximum 43.8 minutes downtime/month).
- **Latency SLIs**:
  - **Read Requests (GET)**: P95 latency **< 200 ms**, P99 latency **< 500 ms**.
  - **Write Requests (POST/PUT/DELETE)**: P95 latency **< 500 ms**, P99 latency **< 1,200 ms**.
- **Error Rate SLO**: 5xx HTTP response rate **< 0.1%** over 5-minute evaluation windows.
- **Sustained Throughput**: Minimum **250 requests/second (TPS)** sustained capacity without throttling.

### 2.3 Tier 3: Frontend & User Interfaces
- **Availability SLO**: **99.9%** availability via CDN / edge distribution.
- **Web Vitals SLIs**:
  - **Largest Contentful Paint (LCP)**: **< 2.5 seconds**
  - **First Input Delay (FID)**: **< 100 ms**
  - **Cumulative Layout Shift (CLS)**: **< 0.1**
  - **Lighthouse Performance Score**: **> 90** across desktop and mobile.

---

## 3. Disaster Recovery Baselines: RTO & RPO

Recovery Time Objective (RTO) defines the maximum acceptable downtime following a disaster.  
Recovery Point Objective (RPO) defines the maximum acceptable data loss measured in time.

| Component / Surface | Target RTO (Max Downtime) | Target RPO (Max Data Loss) | Recovery Mechanism |
|---|---|---|---|
| **Tier 1: Smart Contracts** | **0 minutes** | **0 minutes** | Immutable Stellar Blockchain Ledger |
| **Tier 2: Backend Postgres DB** | **60 minutes** | **15 minutes** | Automated WAL Archiving & Point-In-Time Recovery (PITR) |
| **Tier 3: Frontend CDN** | **15 minutes** | **0 minutes** | Multi-region CDN failover & static hosting |
| **Tier 4: Webhook & Events** | **30 minutes** | **0 minutes** | Idempotent event replay with 7-day queue retention |

---

## 4. Error Budget Policy & Alert Burn Rates

Each service layer has a monthly **Error Budget** equal to `100% - SLO Availability`. For Tier 2 Backend (99.9% SLO), the monthly error budget is **0.1%** (approx. 43.8 minutes).

### Burn Rate Alert Triggers
- **Fast Burn Alert (P0 / Critical)**: **2% of monthly error budget consumed in 1 hour** (burn rate multiplier = 14.4x).
  - *Action*: Immediate page to Tech Lead and Security Lead. Freeze deployments.
- **Slow Burn Alert (P1 / High)**: **5% of monthly error budget consumed in 6 hours** (burn rate multiplier = 6x).
  - *Action*: Alert assigned maintainers. Schedule fix in current sprint.

---

## 5. Security & Compliance NFR Baselines

- **Secret Leak Scan Pass Rate**: **100%** clean scan via Gitleaks and pre-commit hooks.
- **Static Analysis Vulnerability Floor**: **0 High / Medium unresolved findings** in Slither or SonarQube.
- **Dependency Patch Window**: High/Critical severity CVEs must be patched within **48 hours** of publication.

---

## 6. Automated NFR Compliance Verification

NFR baseline configurations and thresholds are specified in [`docs/nfr-baselines.json`](./nfr-baselines.json) and validated programmatically via:
- `scripts/validate-nfr-baselines.ts` (`npm run validate:nfr-baselines`)
- Automated CI pipeline governance workflows.
