# ADR-004: Multi-Tenant Vault Isolation via Soroban Smart Contracts

**Date:** 2024-05-05  
**Status:** Accepted  
**Author:** YieldVault Core Team  
**Reviewers:** Contracts Team, Security Lead  

---

## Context

YieldVault RWA allows multiple depositors to hold positions in a shared vault
that invests in real-world assets. We need to ensure that:

1. One depositor cannot access or move another depositor's funds.
2. The vault's total assets and individual share balances are always
   reconcilable on-chain.
3. The backend cannot unilaterally move funds; all transfers require an
   authorised on-chain transaction.

## Decision

Each vault is implemented as a **Soroban smart contract** deployed on Stellar.
The contract enforces:

- `deposit(amount, depositor)` — mints shares proportional to the current NAV.
- `withdraw(shares, depositor)` — burns shares and transfers the underlying
  asset; only callable by the depositor themselves (`require_auth`).
- `total_assets()` / `balance_of(depositor)` — read-only state accessible to
  the indexer and API for display.

The backend API never holds private keys. All mutations are submitted as
signed Soroban transactions by the depositor's wallet (Freighter or equivalent).

## Rationale

- **Non-custodial by construction:** The smart contract enforces
  `require_auth`, meaning the backend cannot move user funds even if
  compromised.
- **On-chain auditability:** Every deposit and withdrawal is a Stellar ledger
  entry, permanently queryable by anyone.
- **Composability:** Soroban contracts can be invoked by other contracts,
  enabling future integrations with lending protocols or yield aggregators
  without redesigning the vault API.

## Alternatives Considered

### Alternative 1: Custodial backend (database-only)
- **Pros:** Simpler implementation; no on-chain gas costs.
- **Cons:** Backend holds user funds; single point of failure and theft;
  incompatible with the "real-world asset" trust model.

### Alternative 2: EVM-based contracts (Ethereum / Polygon)
- **Pros:** Mature tooling; large developer ecosystem.
- **Cons:** Higher transaction costs; not native to Stellar's stablecoin
  ecosystem; would require a bridge for XLM/USDC liquidity.

### Alternative 3: Stellar classic (non-Soroban) operations
- **Pros:** No smart contract complexity; uses Stellar's built-in asset
  operations.
- **Cons:** Cannot encode custom business logic (e.g., NAV calculation,
  share minting formula) without off-chain trust; no `require_auth` equivalent
  for complex multi-step operations.

## Consequences

### Positive
- Users retain self-custody; vault funds are only moveable by the depositor.
- The backend is a thin read/indexing layer — a backend breach does not
  result in fund loss.
- On-chain state is the source of truth; the backend database is a cache.

### Negative
- Every user action requires a Stellar transaction; UX is gated on wallet
  availability and network confirmation times (~5 s on Stellar).
- Contract upgrades require a governance process; bugs cannot be patched
  server-side.
- The indexer must stay in sync with the ledger; lag between ledger and
  backend state is an operational concern.

## Related Links
- `contracts/` — Soroban contract source
- `backend/src/writeAheadAuditLog.ts` — admin audit log
- ADR-002 — Write-ahead audit log (admin operations)
- `docs/CONTRACTS_ARCHITECTURE.md`
- `docs/DEPOSIT_WITHDRAWAL_LIFECYCLE.md`
