-- migration-safety: allow-nonconcurrent-indexes
-- This is the bootstrap migration; all indexed tables are created empty in the
-- same deployment. Later migrations must create production indexes concurrently.

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    transaction_hash TEXT NOT NULL UNIQUE,
    wallet_address TEXT NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal')),
    status TEXT NOT NULL DEFAULT 'pending',
    amount NUMERIC(38, 18) NOT NULL CHECK (amount >= 0),
    asset_code TEXT NOT NULL DEFAULT 'USDC',
    ledger_sequence BIGINT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_wallet_created_at_idx
    ON transactions (wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_status_created_at_idx
    ON transactions (status, created_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    key_hash TEXT PRIMARY KEY,
    request_fingerprint TEXT NOT NULL,
    response_status INTEGER,
    response_body JSONB,
    state TEXT NOT NULL DEFAULT 'processing'
        CHECK (state IN ('processing', 'completed', 'failed')),
    locked_until TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idempotency_keys_expires_at_idx
    ON idempotency_keys (expires_at);

CREATE TABLE IF NOT EXISTS vault_metrics_snapshots (
    id BIGSERIAL PRIMARY KEY,
    vault_address TEXT NOT NULL,
    total_assets NUMERIC(38, 18) NOT NULL CHECK (total_assets >= 0),
    total_shares NUMERIC(38, 18) NOT NULL CHECK (total_shares >= 0),
    share_price NUMERIC(38, 18) NOT NULL CHECK (share_price >= 0),
    apy NUMERIC(12, 6),
    ledger_sequence BIGINT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vault_metrics_snapshots_vault_recorded_at_idx
    ON vault_metrics_snapshots (vault_address, recorded_at DESC);

CREATE TABLE IF NOT EXISTS apy_snapshots (
    date DATE PRIMARY KEY,
    apy NUMERIC(12, 6) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
