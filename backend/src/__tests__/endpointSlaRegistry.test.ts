import { ENDPOINT_SLA_REGISTRY, getEndpointSla, listEndpointSlaRegistry } from '../endpointSlaRegistry';
import { EndpointType } from '../latencyMonitoring';

describe('endpointSlaRegistry', () => {
  it('includes critical vault read paths', () => {
    const summary = getEndpointSla('/api/v1/vault/summary');
    expect(summary).toBeDefined();
    expect(summary?.type).toBe(EndpointType.READ);
    expect(summary?.p95BudgetMs).toBe(200);
    expect(summary?.ownerTeam).toBe('backend');
  });

  it('lists a stable registry for monitoring integration', () => {
    expect(listEndpointSlaRegistry().length).toBe(ENDPOINT_SLA_REGISTRY.length);
    expect(ENDPOINT_SLA_REGISTRY.some((e) => e.path === '/health')).toBe(true);
  });

  it('annotates write endpoints with higher latency budgets', () => {
    const deposit = getEndpointSla('/api/v1/vault/deposit');
    const summary = getEndpointSla('/api/v1/vault/summary');
    expect(deposit?.p95BudgetMs).toBeGreaterThan(summary!.p95BudgetMs);
  });
});
