import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { getJobMetrics, JobName } from './jobGovernance';

// Create a Registry which registers the metrics
export const register = new Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'yieldvault-backend'
});

// Enable the collection of default metrics
collectDefaultMetrics({ register });

// --- Standard HTTP Metrics ---

export const httpRequestCount = new Counter({
  name: 'http_request_count',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpResponseTime = new Histogram({
  name: 'http_response_time_seconds',
  help: 'Histogram of HTTP response time in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10], // Define custom buckets for response time
  registers: [register],
});

export const activeConnections = new Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
  registers: [register],
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Histogram of Prisma query duration in seconds',
  labelNames: ['model', 'action'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

export const cacheHitCount = new Counter({
  name: 'cache_hit_count',
  help: 'Number of cache hits for GET requests',
  labelNames: ['method', 'route'],
  registers: [register],
});

export const cacheMissCount = new Counter({
  name: 'cache_miss_count',
  help: 'Number of cache misses for GET requests',
  labelNames: ['method', 'route'],
  registers: [register],
});

export const cacheEvictionCount = new Counter({
  name: 'cache_eviction_count',
  help: 'Number of cache evictions due to size limit',
  registers: [register],
});

// --- Vault Specific Metrics ---

export const vaultTvl = new Gauge({
  name: 'vault_tvl_usd',
  help: 'Current Total Value Locked (TVL) in USD',
  registers: [register],
});

export const vaultSharePrice = new Gauge({
  name: 'vault_share_price_usd',
  help: 'Current vault share price in USD',
  registers: [register],
});

/**
 * Updates vault-specific gauges
 * @param tvl Current TVL value
 * @param sharePrice Current share price value
 */
export function updateVaultMetrics(tvl: number, sharePrice: number) {
  vaultTvl.set(tvl);
  vaultSharePrice.set(sharePrice);
}

export function observeDbQueryDuration(model: string, action: string, durationMs: number) {
  dbQueryDuration.observe(
    {
      model,
      action,
    },
    durationMs / 1000,
  );
}

// --- Job Governance Metrics ---

export const jobDeadLetterCount = new Gauge({
  name: 'job_dead_letter_count',
  help: 'Number of dead-letter records per job',
  labelNames: ['job_name'],
  registers: [register],
});

export const jobHealthStatus = new Gauge({
  name: 'job_health_status',
  help: 'Job health: 1 = up, 0 = degraded',
  labelNames: ['job_name'],
  registers: [register],
});

/**
 * Syncs job governance state into Prometheus gauges.
 * Call this before scraping /metrics so values are current.
 */
export function syncJobGovernanceMetrics(): void {
  const metrics = getJobMetrics();
  const failureCounts = metrics.failureCounts as Record<string, number>;
  const recurringFailures = metrics.recurringFailures as Partial<Record<JobName, number>>;

  for (const [jobName, count] of Object.entries(failureCounts)) {
    jobDeadLetterCount.set({ job_name: jobName }, count);
    jobHealthStatus.set(
      { job_name: jobName },
      jobName in recurringFailures ? 0 : 1,
    );
  }
}

// --- Reconciliation Drift Metrics ---

export const reconciliationDriftTotal = new Counter({
  name: 'reconciliation_drift_total',
  help: 'Total reconciliation drift issues detected by type',
  labelNames: ['issue'],
  registers: [register],
});

export const reconciliationStatus = new Gauge({
  name: 'reconciliation_status',
  help: 'Reconciliation status: 1 = clean, 0 = drift detected',
  registers: [register],
});

export const reconciliationLastRunTimestamp = new Gauge({
  name: 'reconciliation_last_run_timestamp',
  help: 'Unix timestamp of the last automated reconciliation run',
  registers: [register],
});

export function recordReconciliationDrift(issue: string): void {
  reconciliationDriftTotal.inc({ issue });
}

export function setReconciliationStatus(clean: number): void {
  reconciliationStatus.set(clean);
}

export function setReconciliationLastRunTimestamp(unixSeconds: number): void {
  reconciliationLastRunTimestamp.set(unixSeconds);
}

// --- Endpoint SLO Metrics ---

export const endpointSloBreachTotal = new Counter({
  name: 'backend_slo_breach_total',
  help: 'Total endpoint SLO breach alerts emitted',
  labelNames: ['path', 'tier', 'type'],
  registers: [register],
});

export const endpointSloP95LatencyMs = new Gauge({
  name: 'backend_slo_p95_latency_ms',
  help: 'Current rolling P95 latency per endpoint in milliseconds',
  labelNames: ['path', 'tier', 'type'],
  registers: [register],
});

export const endpointSloBudgetMs = new Gauge({
  name: 'backend_slo_budget_ms',
  help: 'Configured P95 latency budget per endpoint in milliseconds',
  labelNames: ['path', 'tier', 'type'],
  registers: [register],
});

export const endpointSloBreach = new Gauge({
  name: 'backend_slo_breach',
  help: 'Endpoint SLO breach state: 1 = breaching, 0 = within budget',
  labelNames: ['path', 'tier', 'type'],
  registers: [register],
});

export function recordSloBreachAlert(path: string, tier: string, type: string): void {
  endpointSloBreachTotal.inc({ path, tier, type });
}
