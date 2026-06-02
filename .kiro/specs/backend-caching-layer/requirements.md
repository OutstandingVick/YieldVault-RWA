# Requirements Document

## Introduction

This feature formalizes and extends the caching layer for the YieldVault-RWA NestJS/Express backend to reduce latency and database load on hot read paths (GitHub Issue #197). The backend already has a partial in-memory cache (`src/middleware/cache.ts`), Prometheus cache metrics defined (`cacheHitCount`, `cacheMissCount`, `cacheEvictionCount`), and both `ioredis` and `node-cache` installed — but these are not fully wired together or consistently applied. This feature completes the caching strategy by: auditing and applying the cache middleware to all eligible read endpoints, connecting hit/miss metrics to the middleware, implementing pattern-scoped cache invalidation tied to write operations, and defining a clear freshness SLA per endpoint class.

---

## Glossary

- **Cache_Middleware**: The Express middleware in `src/middleware/cache.ts` responsible for storing and serving cached GET responses.
- **Cache_Store**: The in-memory Map (or a configurable Redis-backed store) that holds `CacheEntry` objects keyed by `METHOD:PATH`.
- **Cache_Key**: A string identifying a cached response, currently derived from `METHOD:PATH`. Extended to include query-string parameters where responses vary by query.
- **TTL**: Time-to-live — the maximum age (in milliseconds) a cached entry may be served before being considered stale.
- **Cache_Hit**: A request served from the Cache_Store without querying the database or upstream service.
- **Cache_Miss**: A request for which no valid entry exists in the Cache_Store, resulting in a database or upstream query.
- **Invalidation**: The act of removing one or more Cache_Store entries when the underlying data changes.
- **Invalidation_Pattern**: A regex string used to selectively remove matching Cache_Store keys on write operations.
- **Hit_Rate**: The ratio of Cache_Hits to total cacheable requests, expressed as a percentage.
- **Freshness_SLA**: The maximum time (in seconds) a consumer may observe stale data for a given endpoint class.
- **Hot_Read_Endpoint**: A GET endpoint identified as high-traffic based on request volume metrics or architectural reasoning.
- **APY_Snapshot_Endpoint**: `GET /api/v1/vault/apy/history` — serves daily APY snapshots.
- **Vault_Summary_Endpoint**: `GET /api/v1/vault/summary` — serves aggregate vault state (TVL, shares, APY).
- **Vault_Metrics_Endpoint**: `GET /api/v1/vault/metrics` — serves vault performance metrics.
- **Vault_APY_Endpoint**: `GET /api/v1/vault/apy` — serves current APY.
- **Vault_History_Endpoint**: `GET /api/v1/vault/history` — serves paginated historical vault value points.
- **Transactions_Endpoint**: `GET /api/v1/transactions` — serves paginated transaction history.
- **Portfolio_Holdings_Endpoint**: `GET /api/v1/portfolio/holdings` — serves paginated portfolio holdings.
- **Referral_Stats_Endpoint**: `GET /api/v1/referrals/:wallet` — serves referral stats per wallet.
- **Referral_Code_Endpoint**: `GET /api/v1/referrals/code/:wallet` — serves or creates a wallet's referral code.
- **Admin_Audit_Endpoint**: `GET /admin/audit/logs` and related admin read endpoints.
- **Write_Endpoint**: Any POST, PUT, PATCH, or DELETE endpoint that mutates application state.
- **Prometheus_Registry**: The `prom-client` Registry instance in `src/metrics.ts`.
- **CACHE_TTL_MS**: Environment variable that sets default TTL for vault metric endpoints (default 60 000 ms).
- **CACHE_LIST_ENDPOINTS_TTL_MS**: Environment variable that sets TTL for list endpoints (default 30 000 ms).

---

## Requirements

### Requirement 1: Cache Key Includes Query Parameters

**User Story:** As a backend developer, I want cache keys to include relevant query parameters, so that responses for different filter or pagination inputs are cached independently and consumers receive correct data.

#### Acceptance Criteria

1. THE Cache_Middleware SHALL derive the Cache_Key by combining the HTTP method, the request path, and a deterministic serialization of all query-string parameters in the format `METHOD:PATH:key1=value1&key2=value2`, where parameter names are sorted alphabetically and, for parameters with multiple values, the values for each name are also sorted alphabetically before joining with `&`.
2. WHEN two requests share the same path but differ in any query parameter name or value, THE Cache_Middleware SHALL treat them as distinct Cache_Keys and store their responses independently.
3. WHEN a request carries no query parameters, THE Cache_Middleware SHALL produce a Cache_Key in the format `METHOD:PATH` with no trailing separator, preserving backward compatibility with the existing key format.
4. THE Cache_Middleware SHALL sort query parameter names alphabetically and, for any parameter name that appears more than once, sort its values alphabetically before serialization, so that `?a=2&a=1&b=3` and `?b=3&a=2&a=1` produce the same Cache_Key.

---

### Requirement 2: Cache Hit/Miss Metrics Are Tracked

**User Story:** As an operator, I want every cache hit and miss to increment the corresponding Prometheus counter, so that I can monitor hit rate and diagnose caching effectiveness.

#### Acceptance Criteria

1. WHEN a request is served from the Cache_Store (Cache_Hit), THE Cache_Middleware SHALL increment `cacheHitCount` with labels `{ method, route }` where `route` is the Express route pattern (e.g., `/api/v1/vault/summary`), not the resolved path.
2. WHEN a request bypasses the Cache_Store and proceeds to the handler (Cache_Miss), THE Cache_Middleware SHALL increment `cacheMissCount` with labels `{ method, route }`.
3. THE Cache_Middleware SHALL import `cacheHitCount` and `cacheMissCount` from `src/metrics.ts` and MUST NOT define duplicate counter instances.
4. WHEN the Cache_Store evicts an entry because the entry count has reached the maximum of 512 and a new entry must be inserted, THE Cache_Middleware SHALL increment `cacheEvictionCount` before the eviction occurs.
5. WHEN a request is made to `GET /metrics`, THE Prometheus_Registry SHALL include `cache_hit_count`, `cache_miss_count`, and `cache_eviction_count` in the response output.

---

### Requirement 3: Consistent Cache Coverage for Hot Read Endpoints

**User Story:** As a backend developer, I want all identified hot read endpoints to use the Cache_Middleware with appropriate TTLs, so that repeated identical requests are served from cache without hitting the database.

#### Acceptance Criteria

1. THE Cache_Middleware SHALL be applied to the following Hot_Read_Endpoints with the TTLs listed:
   - Vault_Summary_Endpoint: TTL = `CACHE_TTL_MS` (default 60 000 ms)
   - Vault_Metrics_Endpoint: TTL = `CACHE_TTL_MS` (default 60 000 ms)
   - Vault_APY_Endpoint: TTL = `CACHE_TTL_MS` (default 60 000 ms)
   - APY_Snapshot_Endpoint (`/api/v1/vault/apy/history`): TTL = `CACHE_TTL_MS` (default 60 000 ms)
   - Transactions_Endpoint: TTL = `CACHE_LIST_ENDPOINTS_TTL_MS` (default 30 000 ms)
   - Vault_History_Endpoint: TTL = `CACHE_LIST_ENDPOINTS_TTL_MS` (default 30 000 ms)
   - Portfolio_Holdings_Endpoint: TTL = `CACHE_LIST_ENDPOINTS_TTL_MS` (default 30 000 ms)
   - Referral_Stats_Endpoint: TTL = `CACHE_LIST_ENDPOINTS_TTL_MS` (default 30 000 ms)
   - Referral_Code_Endpoint: TTL = `CACHE_LIST_ENDPOINTS_TTL_MS` (default 30 000 ms)
2. WHEN a GET request is received for any Hot_Read_Endpoint and a valid Cache_Hit exists, THE Cache_Middleware SHALL return the cached response without invoking the downstream handler.
3. IF the downstream handler returns a non-2xx status code, THEN THE Cache_Middleware SHALL NOT store the response in the Cache_Store (only HTTP 2xx responses are eligible for caching).
4. WHEN a Cache_Hit occurs for a Hot_Read_Endpoint, THE Cache_Middleware SHALL set the `X-Cache-Hit` response header to `"true"`.
5. WHEN a Cache_Miss occurs for a Hot_Read_Endpoint, THE Cache_Middleware SHALL set the `X-Cache-Hit` response header to `"false"`.

---

### Requirement 4: Freshness SLA Enforcement via TTL Configuration

**User Story:** As a product owner, I want each endpoint class to have a defined maximum staleness window, so that consumers can rely on data freshness within a documented SLA.

#### Acceptance Criteria

1. WHEN a cached entry's `expiresAt` timestamp is less than or equal to `Date.now()`, THE Cache_Middleware SHALL treat the request as a Cache_Miss, remove the stale entry from the Cache_Store, fetch a fresh response from the downstream handler, store it with a new `expiresAt` of `Date.now() + ttl`, and return the fresh response to the caller.
2. THE system SHALL allow operators to adjust the Freshness_SLA for vault metric endpoints by setting `CACHE_TTL_MS` and for list endpoints by setting `CACHE_LIST_ENDPOINTS_TTL_MS` to any integer value between 1 and 86 400 000 (milliseconds), without requiring a code change.
3. IF `CACHE_TTL_MS` or `CACHE_LIST_ENDPOINTS_TTL_MS` is set to a value that is not a positive integer within the range 1–86 400 000, THEN THE Cache_Middleware SHALL fall back to the default TTL for the affected endpoint class and emit a warning-level log entry identifying the invalid value.
4. WHERE the `CACHE_TTL_MS` environment variable is not set, THE Cache_Middleware SHALL default to a TTL of 60 000 ms for vault metric endpoints.
5. WHERE the `CACHE_LIST_ENDPOINTS_TTL_MS` environment variable is not set, THE Cache_Middleware SHALL default to a TTL of 30 000 ms for list endpoints.

---

### Requirement 5: Pattern-Scoped Cache Invalidation on Write Operations

**User Story:** As a backend developer, I want write operations to invalidate only the cache entries relevant to the mutated resource, so that reads remain fresh after mutations without unnecessarily clearing unrelated cached data.

#### Acceptance Criteria

1. WHEN a POST request to `/api/v1/vault/deposits` or `/api/v1/vault/withdrawals` completes with a 2xx status code, THE Cache_Middleware SHALL invalidate all Cache_Store entries whose Cache_Key matches `GET:/api/v1/vault`, `GET:/api/v1/transactions`, or `GET:/api/v1/portfolio` (each pattern applied as a prefix match against the Cache_Key).
2. WHEN the APY snapshot job (`runApySnapshotJob`) completes successfully, THE Cache_Middleware SHALL invalidate all Cache_Store entries whose Cache_Key begins with `GET:/api/v1/vault/apy`.
3. WHEN a referral deposit is recorded via `referralService.recordDeposit`, THE Cache_Middleware SHALL invalidate all Cache_Store entries whose Cache_Key begins with `GET:/api/v1/referrals`.
4. WHEN `invalidateCache` is called without arguments, THE Cache_Middleware SHALL clear the entire Cache_Store, removing all entries regardless of key.
5. WHEN `invalidateCache` is called with an Invalidation_Pattern string, THE Cache_Middleware SHALL remove only Cache_Store entries whose Cache_Key matches the given regex pattern, and SHALL leave all non-matching entries intact.
6. IF a write operation completes with a non-2xx status code, THEN THE Cache_Middleware SHALL NOT invalidate any Cache_Store entries.

---

### Requirement 6: Cache-Control Headers on Cached Responses

**User Story:** As an API consumer, I want HTTP caching headers on GET responses, so that my HTTP client or CDN can apply its own caching logic in alignment with the server's TTL.

#### Acceptance Criteria

1. WHEN a response is stored in the Cache_Store (Cache_Miss path), THE Cache_Middleware SHALL set the `Cache-Control` header to `public, max-age=<N>` where `<N>` is the full per-endpoint TTL in whole seconds, rounded up to the nearest second (e.g., 60 000 ms → `max-age=60`), computed at store time.
2. WHEN a response is served from the Cache_Store (Cache_Hit path), THE Cache_Middleware SHALL set the `Cache-Control` header to `public, max-age=<N>` where `<N>` is the remaining TTL in whole seconds computed as `ceil((expiresAt − Date.now()) / 1000)`, or `max-age=0` if the entry is at or past its expiry at serve time.
3. IF the request method is not GET, THEN THE Cache_Middleware SHALL NOT set a `Cache-Control` header on the response.
4. IF the downstream handler returns a non-2xx status code, THEN THE Cache_Middleware SHALL NOT set a `Cache-Control` header on the response.

---

### Requirement 7: Cache Size Limit and Eviction

**User Story:** As an operator, I want the Cache_Store to have a configurable maximum entry count, so that unbounded memory growth is prevented in high-traffic scenarios.

#### Acceptance Criteria

1. THE Cache_Store SHALL enforce a maximum entry count configurable via the `CACHE_MAX_ENTRIES` environment variable, which must be a positive integer ≥ 1; WHERE `CACHE_MAX_ENTRIES` is not set, THE Cache_Store SHALL default to a maximum of 500 entries.
2. WHEN a new entry would cause the Cache_Store entry count to exceed the configured maximum, THE Cache_Store SHALL evict the least-recently-used entry before inserting the new one; IF a write to an existing key does not increase the entry count, THEN no eviction SHALL occur.
3. WHEN an eviction occurs, THE Cache_Middleware SHALL increment `cacheEvictionCount`.
4. IF `CACHE_MAX_ENTRIES` is set to a value that is not a positive integer (e.g., zero, negative, or non-numeric), THEN THE Cache_Store SHALL fall back to the default maximum of 500 entries and emit a warning-level log entry identifying the invalid value.

---

### Requirement 8: Admin Cache Inspection and Manual Invalidation Endpoint

**User Story:** As an operator, I want an admin endpoint that shows current cache state and allows manual invalidation, so that I can diagnose cache issues and force-refresh stale data in production without restarting the service.

#### Acceptance Criteria

1. THE system SHALL expose `GET /admin/cache/stats` that returns a JSON object containing: the current Cache_Store entry count as an integer, the list of active Cache_Keys as an array of strings, and the Hit_Rate as a numeric ratio rounded to 4 decimal places (e.g., `0.7500`), computed as `cacheHitCount / (cacheHitCount + cacheMissCount)` since the last process start; WHERE no cacheable requests have been made, Hit_Rate SHALL be returned as `null`.
2. THE system SHALL expose `DELETE /admin/cache` (with no `pattern` parameter) that clears the entire Cache_Store and returns a JSON object containing the count of entries removed.
3. THE system SHALL expose `DELETE /admin/cache?pattern=<regex>` that removes only Cache_Store entries whose Cache_Key matches the provided regex pattern and returns a JSON object containing the count of entries removed.
4. WHEN a request is made to `GET /admin/cache/stats`, `DELETE /admin/cache`, or `DELETE /admin/cache?pattern=<regex>`, THE system SHALL require a valid API key via the existing `validateApiKey` middleware and reject requests with a missing or invalid API key with a 401 status code.
5. IF the `pattern` query parameter supplied to `DELETE /admin/cache?pattern=` is an empty string or contains a syntactically invalid regex, THEN THE system SHALL return a 400 status code with a JSON error response containing a `message` field that identifies the invalid pattern and describes why it was rejected.

---

### Requirement 9: Baseline Latency Comparison Metric

**User Story:** As an operator, I want the existing latency monitoring service to record separate P50/P95/P99 latency samples for cached versus uncached responses, so that I can measure the latency improvement attributable to the cache.

#### Acceptance Criteria

1. WHEN a Cache_Hit occurs, THE Cache_Middleware SHALL record the response latency under the label `cached=true` using the existing `latencyMonitoringService.recordLatency` call signature or an equivalent extension.
2. WHEN a Cache_Miss occurs and the downstream handler completes, THE Cache_Middleware SHALL record the response latency under the label `cached=false`.
3. THE `GET /admin/latency-status` endpoint SHALL include per-route latency breakdowns distinguishing `cached` from `uncached` samples.

---

### Requirement 10: No Caching of Authenticated or Sensitive Endpoints

**User Story:** As a security engineer, I want authenticated or user-specific endpoints to be excluded from the shared Cache_Store, so that one user's data is never accidentally served to another user.

#### Acceptance Criteria

1. THE Cache_Middleware SHALL NOT cache responses for any request that carries an `Authorization` header, unless the route is explicitly opted in via a `sharedCache: true` option.
2. THE Cache_Middleware SHALL NOT cache responses for Admin_Audit_Endpoint routes (paths beginning with `/admin/audit`).
3. WHEN an endpoint is excluded from caching per criteria 1 or 2 above, THE Cache_Middleware SHALL pass the request to the next handler without setting any `X-Cache-Hit` or `Cache-Control` headers.
4. THE Referral_Stats_Endpoint and Referral_Code_Endpoint MAY be cached because their responses are wallet-address-scoped and the wallet address is part of the URL path (and therefore the Cache_Key), not an authorization credential.
