# Monitoring & Observability Dashboard Guide

This guide explains every metric, alert, and dashboard panel used to monitor YieldVault backend health and webhook delivery.

---

## 1. Metrics Reference

All metrics are exposed in Prometheus format at `GET /metrics`. The backend uses `prom-client` with the label `app="yieldvault-backend"` applied to every series.

### 1.1 HTTP Metrics

| Metric | Type | Labels | What it measures |
|---|---|---|---|
| `http_request_count` | Counter | `method`, `route`, `status_code` | Total requests received |
| `http_response_time_seconds` | Histogram | `method`, `route`, `status_code` | Request duration; buckets at 0.1 s, 0.3 s, 0.5 s, 0.7 s, 1 s, 3 s, 5 s, 7 s, 10 s |
| `http_active_connections` | Gauge | — | In-flight connections right now |

**Key derived queries (PromQL):**

```promql
# P95 latency per route over 5 minutes
histogram_quantile(0.95,
  sum(rate(http_response_time_seconds_bucket[5m])) by (le, route)
)

# Error rate (5xx) per route
sum(rate(http_request_count{status_code=~"5.."}[5m])) by (route)
  /
sum(rate(http_request_count[5m])) by (route)
```

### 1.2 Database Metrics

| Metric | Type | Labels | What it measures |
|---|---|---|---|
| `db_query_duration_seconds` | Histogram | `model`, `action` | Prisma query duration; buckets at 5 ms–5 s |

**Key derived query:**

```promql
# P95 DB query latency per model
histogram_quantile(0.95,
  sum(rate(db_query_duration_seconds_bucket[5m])) by (le, model, action)
)
```

### 1.3 Cache Metrics

| Metric | Type | Labels | What it measures |
|---|---|---|---|
| `cache_hit_count` | Counter | `method`, `route` | GET requests served from cache |
| `cache_miss_count` | Counter | `method`, `route` | GET requests that bypassed cache |
| `cache_eviction_count` | Counter | — | Entries evicted due to size limit |

**Cache hit ratio:**

```promql
sum(rate(cache_hit_count[5m]))
  /
(sum(rate(cache_hit_count[5m])) + sum(rate(cache_miss_count[5m])))
```

A ratio below **0.7** on read-heavy routes warrants investigation.

### 1.4 Vault-Specific Metrics

| Metric | Type | What it measures |
|---|---|---|
| `vault_tvl_usd` | Gauge | Current Total Value Locked in USD |
| `vault_share_price_usd` | Gauge | Current yvUSDC share price in USD |

These are updated by `updateVaultMetrics()` whenever vault state changes. A flat line on either gauge indicates the vault state is not being refreshed.

### 1.5 Default Node.js Process Metrics

`collectDefaultMetrics` adds standard series including:

- `process_cpu_seconds_total`
- `process_resident_memory_bytes`
- `nodejs_eventloop_lag_seconds`
- `nodejs_active_handles_total`

An event-loop lag above **100 ms** is a sign of CPU saturation.

### 1.6 Endpoint SLO Metrics

Per-route SLO breach state is exported directly from `latencyMonitoring.ts` via `syncSloMetrics()` on each `/metrics` scrape.

| Metric | Type | Labels | What it measures |
|---|---|---|---|
| `backend_slo_breach_total` | Counter | `path`, `tier`, `type` | SLO breach alerts emitted (respects alert cooldown) |
| `backend_slo_p95_latency_ms` | Gauge | `path`, `tier`, `type` | Current rolling P95 latency vs budget |
| `backend_slo_budget_ms` | Gauge | `path`, `tier`, `type` | Configured P95 latency budget |
| `backend_slo_breach` | Gauge | `path`, `tier`, `type` | `1` when breaching, `0` when within budget |

Critical tier routes (`/health`, `/ready`) use `tier="critical"` labels from `ENDPOINT_SLA_REGISTRY`.

**Key derived queries (PromQL):**

```promql
# Endpoints currently breaching latency SLO
backend_slo_breach == 1

# Alert rate per endpoint (15m window)
rate(backend_slo_breach_total[15m])
```

### 1.7 Reconciliation Drift Metrics

| Metric | Type | Labels | What it measures |
|---|---|---|---|
| `reconciliation_drift_total` | Counter | `issue` | Drift issues detected by scheduled reconciliation |
| `reconciliation_status` | Gauge | — | `1` = clean, `0` = drift detected |
| `reconciliation_last_run_timestamp` | Gauge | — | Unix timestamp of last automated reconciliation run |

---

## 2. Latency SLO Alerts

Implemented in `backend/src/latencyMonitoring.ts`. The service tracks a **5-minute rolling P95** per endpoint and fires alerts when the threshold is breached.

### 2.1 SLO Thresholds

| Endpoint category | Default threshold | Env var |
|---|---|---|
| Read (`/health`, `/ready`, `/metrics`, vault summary/metrics/APY, vault by ID, admin audit/export list) | **200 ms** | `SLO_READ_THRESHOLD_MS` |
| Write (deposit, withdraw, create, cache invalidate, API key register/rotate/revoke, export verify) | **500 ms** | `SLO_WRITE_THRESHOLD_MS` |

### 2.2 Alert Timing

| Parameter | Default | Env var |
|---|---|---|
| Evaluation window | 5 minutes | `SLO_EVALUATION_WINDOW_MS` |
| Check interval | 60 seconds | `SLO_CHECK_INTERVAL_MS` |
| Alert cooldown | 15 minutes | `SLO_ALERT_COOLDOWN_MS` |

An alert fires at most once per 15 minutes per endpoint. An **immediate** alert also fires on the first request that pushes P95 over the threshold, without waiting for the next scheduled check.

### 2.3 Alert Channels

Configured via `ALERT_TYPE` environment variable:

| Value | Behaviour |
|---|---|
| `slack` | POST to `SLACK_WEBHOOK_URL` |
| `pagerduty` | POST to PagerDuty Events API v2 using `PAGERDUTY_INTEGRATION_KEY` |
| `both` | Both channels simultaneously |

**Sample Slack alert:**
```
🚨 API Latency SLO Breach Detected

Affected Endpoints:
• /api/v1/vault/summary: P95 = 245.50ms (SLO: 200ms, 45 samples)

Time: 2026-05-29T18:00:00.000Z
Service: YieldVault Backend
```

**PagerDuty alert fields:**
- Severity: `critical`
- Component: `api-latency-monitoring`
- Group: `performance`
- Class: `latency-slo`

### 2.4 Interpreting an SLO Alert

1. Check `GET /admin/latency-status` (API key required) for the current P95 and sample count per endpoint.
2. Correlate with `http_response_time_seconds` in Prometheus to identify whether the slowdown is broad or route-specific.
3. Check `db_query_duration_seconds` — a slow DB query is the most common root cause.
4. Check `nodejs_eventloop_lag_seconds` for CPU saturation.
5. If the breach is transient (single spike), the cooldown will suppress further alerts automatically.

---

## 3. Webhook Health

### 3.1 Delivery Lifecycle

```
emitTransactionEvent()
  └─▶ pending  ──▶  delivered   (HTTP 2xx within timeout)
                └─▶ failed      (all retry attempts exhausted)
```

Retry schedule uses exponential backoff:

| Attempt | Delay |
|---|---|
| 1 → 2 | 500 ms |
| 2 → 3 | 1 000 ms |
| After attempt 3 | Marked `failed` |

Defaults are configurable via `WEBHOOK_MAX_ATTEMPTS`, `WEBHOOK_DELIVERY_TIMEOUT_MS`, and `WEBHOOK_RETRY_BASE_DELAY_MS`.

### 3.2 Webhook Delivery Metrics

`getWebhookDeliveryMetrics()` returns:

| Field | Meaning |
|---|---|
| `totalEndpoints` | All registered webhook endpoints |
| `enabledEndpoints` | Endpoints currently active |
| `totalDeliveries` | Deliveries in the in-memory retention window (default 200) |
| `delivered` | Successfully delivered count |
| `failed` | Exhausted all retries |
| `pending` | In-flight or awaiting retry |
| `maxAttempts` | Configured retry limit |
| `deliveryTimeoutMs` | Per-attempt HTTP timeout |

A healthy system should have `failed` near zero. A rising `failed` count with `pending` also elevated indicates the target endpoint is down or rejecting requests.

### 3.3 Webhook Admin Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /admin/webhooks` | API key | List all registered endpoints |
| `GET /admin/webhooks/deliveries` | API key | Paginated delivery log |
| `GET /admin/webhooks/metrics` | API key | Aggregated delivery counts |

---

## 4. Dashboard Panel Layout (Grafana)

Recommended panel arrangement for a single dashboard pointed at the Prometheus `/metrics` scrape target:

### Row 1 — Traffic Overview
- **Request rate** — `sum(rate(http_request_count[1m])) by (route)`
- **Error rate** — `sum(rate(http_request_count{status_code=~"5.."}[1m])) / sum(rate(http_request_count[1m]))`
- **Active connections** — `http_active_connections`

### Row 2 — Latency SLOs
- **P95 latency heatmap** — `histogram_quantile(0.95, sum(rate(http_response_time_seconds_bucket[5m])) by (le, route))`
- **SLO breach indicator** — threshold line at 200 ms (read) / 500 ms (write)
- **DB query P95** — `histogram_quantile(0.95, sum(rate(db_query_duration_seconds_bucket[5m])) by (le, model))`

### Row 3 — Vault State
- **TVL** — `vault_tvl_usd`
- **Share price** — `vault_share_price_usd`

### Row 4 — Cache Efficiency
- **Hit ratio** — derived from `cache_hit_count` / (`cache_hit_count` + `cache_miss_count`)
- **Eviction rate** — `rate(cache_eviction_count[5m])`

### Row 5 — Process Health
- **Event-loop lag** — `nodejs_eventloop_lag_seconds` (alert threshold: 100 ms)
- **Heap used** — `nodejs_heap_size_used_bytes`
- **CPU** — `rate(process_cpu_seconds_total[1m])`

### Row 6 — Webhook Health
- **Delivery success rate** — `delivered / totalDeliveries` from `/admin/webhooks/metrics`
- **Failed deliveries** — absolute count, alert if > 0 sustained for > 5 min
- **Pending deliveries** — should drain to 0 between events

---

## 5. Admin Endpoint Reference

| Endpoint | Auth | Returns |
|---|---|---|
| `GET /metrics` | None | Prometheus text format |
| `GET /health` | None | `{ status: "ok" }` |
| `GET /ready` | None | Readiness probe |
| `GET /admin/latency-status` | API key | Per-endpoint P95, threshold, breach flag, sample count, last alert time |
| `GET /admin/webhooks/metrics` | API key | Aggregated webhook delivery counts |

---

## 6. Environment Variable Summary

| Variable | Default | Purpose |
|---|---|---|
| `SLO_READ_THRESHOLD_MS` | `200` | P95 alert threshold for read endpoints |
| `SLO_WRITE_THRESHOLD_MS` | `500` | P95 alert threshold for write endpoints |
| `SLO_EVALUATION_WINDOW_MS` | `300000` | Rolling window for P95 calculation |
| `SLO_CHECK_INTERVAL_MS` | `60000` | How often SLO violations are checked |
| `SLO_ALERT_COOLDOWN_MS` | `900000` | Minimum time between repeated alerts per endpoint |
| `ALERT_TYPE` | `slack` | `slack`, `pagerduty`, or `both` |
| `SLACK_WEBHOOK_URL` | — | Slack incoming webhook URL |
| `PAGERDUTY_INTEGRATION_KEY` | — | PagerDuty Events API v2 integration key |
| `WEBHOOK_MAX_ATTEMPTS` | `3` | Max delivery attempts per webhook event |
| `WEBHOOK_DELIVERY_TIMEOUT_MS` | `5000` | Per-attempt HTTP timeout |
| `WEBHOOK_RETRY_BASE_DELAY_MS` | `500` | Base delay for exponential backoff |
| `WEBHOOK_DELIVERY_RETENTION` | `200` | Max delivery records kept in memory |
