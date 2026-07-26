-- Migration: Add DB indices for query optimization on high-latency endpoints (Issue #895)
--
-- Affected models and rationale:
--
--   Transaction
--     • (user, timestamp DESC)     – primary filter on transactionEndpoints.ts: WHERE user = ?
--                                    ORDER BY timestamp DESC; avoids full scan for per-wallet queries
--     • (type, timestamp DESC)     – type-only filter path (no wallet) ORDER BY timestamp
--     • (status, timestamp DESC)   – status filter path ORDER BY timestamp
--     • (user, type, timestamp DESC) – compound for wallet + type filter (most selective combo)
--     • (user, status, timestamp DESC) – compound for wallet + status filter
--     • (timestamp DESC)           – ORDER BY timestamp for unfiltered paginated list
--
--   ReferralCode
--     • (ownerAddress)             – referralService.getOrCreateReferralCode does
--                                    findFirst({ where: { ownerAddress } }); no index existed
--
--   SharePriceSnapshot
--     • (recordedAt, id)           – calculateUserYield fetches all snapshots ordered by
--                                    (recordedAt ASC, id ASC); composite covers the sort
--
--   WebhookDelivery
--     • (endpointId, createdAt DESC) – listWebhookDeliveryPage sorts by createdAt DESC, id DESC
--                                      filtered by endpointId; composite avoids a separate sort step

-- ─── Transaction ────────────────────────────────────────────────────────────

-- Unfiltered list ordered by timestamp (default path)
CREATE INDEX IF NOT EXISTS "Transaction_timestamp_idx"
    ON "Transaction"("timestamp" DESC);

-- Per-wallet queries (most common authenticated path)
CREATE INDEX IF NOT EXISTS "Transaction_user_timestamp_idx"
    ON "Transaction"("user", "timestamp" DESC);

-- Type-only filter
CREATE INDEX IF NOT EXISTS "Transaction_type_timestamp_idx"
    ON "Transaction"("type", "timestamp" DESC);

-- Status filter
CREATE INDEX IF NOT EXISTS "Transaction_status_timestamp_idx"
    ON "Transaction"("status", "timestamp" DESC);

-- Wallet + type compound (most selective authenticated + filtered combo)
CREATE INDEX IF NOT EXISTS "Transaction_user_type_timestamp_idx"
    ON "Transaction"("user", "type", "timestamp" DESC);

-- Wallet + status compound
CREATE INDEX IF NOT EXISTS "Transaction_user_status_timestamp_idx"
    ON "Transaction"("user", "status", "timestamp" DESC);

-- ─── ReferralCode ────────────────────────────────────────────────────────────

-- getOrCreateReferralCode does findFirst({ where: { ownerAddress } })
CREATE INDEX IF NOT EXISTS "ReferralCode_ownerAddress_idx"
    ON "ReferralCode"("ownerAddress");

-- ─── SharePriceSnapshot ──────────────────────────────────────────────────────

-- calculateUserYield: orderBy [{ recordedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]
-- Composite on (recordedAt, id) covers the most common two-column sort
CREATE INDEX IF NOT EXISTS "SharePriceSnapshot_recordedAt_id_idx"
    ON "SharePriceSnapshot"("recordedAt" ASC, "id" ASC);

-- ─── WebhookDelivery ─────────────────────────────────────────────────────────

-- listWebhookDeliveryPage: sort by createdAt DESC, id DESC with optional endpointId filter
CREATE INDEX IF NOT EXISTS "WebhookDelivery_endpointId_createdAt_idx"
    ON "WebhookDelivery"("endpointId", "createdAt" DESC);
