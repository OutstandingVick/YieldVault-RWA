# Incident Response Runbook – YieldVault RPC & Delivery Failures

## 1. Overview
This runbook documents the operational procedures for handling **RPC degradation**, **delivery (transaction) failures**, and the **recovery** steps required to restore normal service for the YieldVault smart‑contract platform.

---
## 2. Detection & Alerting
| Metric / Log | Threshold | Alert Destination |
|--------------|-----------|-------------------|
| `rpc_latency_ms` (average over 1 min) | > 1500 ms | PagerDuty / Slack `#ops` |
| `rpc_error_rate` (errors / total calls) | > 5 % | PagerDuty / Slack |
| `tx_delivery_failure_rate` (failed deliveries / total) | > 2 % | PagerDuty / Slack |
| `node_sync_lag` (blocks behind head) | > 10 blocks | PagerDuty |

*Metrics are collected via Prometheus exporters on each validator node and aggregated in Grafana.*

---
## 3. Symptom Checklist
### RPC Degradation
- Increased response times for `GET /rpc/*` endpoints.
- Spike in `500`/`504` HTTP status codes.
- Clients report time‑outs when calling contract methods.

### Delivery Failures
- Transactions submitted to the network return `TxFailed` or are not included in the next ledger.
- `tx_delivery_failure_rate` metric exceeds the threshold.
- Users see “insufficient fee” or “sequence number too low” errors.

---
## 4. Immediate Triage (First 15 min)
1. **Acknowledge alert** in the incident channel.
2. **Validate scope** – check if the issue is isolated to a single node or cluster‑wide.
3. **Gather logs**:
   ```bash
   journalctl -u soroban-node -n 200 | grep -i "rpc" > /tmp/rpc_logs.txt
   ```
4. **Check node health**:
   ```bash
   curl -s http://localhost:8000/metrics | grep -E "rpc_latency|rpc_error_rate"
   ```
5. **Confirm network health** – run a simple health‑check transaction:
   ```rust
   // minimal contract call to a known address
   ```
   If it fails, the problem is likely network‑wide.

---
## 5. Mitigation Steps
### 5.1 RPC Degradation
- **Scale‑out**: Deploy an additional validator node and add it to the load‑balancer pool.
- **Restart overloaded node**:
  ```bash
  systemctl restart soroban-node
  ```
- **Throttle traffic**: Adjust the NGINX/HAProxy rate‑limit to 200 req/s per IP.
- **Enable cache** for read‑only RPC calls (e.g., `getLedgerEntries`).

### 5.2 Delivery Failures
- **Increase fee bump**: Re‑submit pending transactions with a higher fee using the `fee-bump` utility.
- **Resubmit pending queue**: Flush the local transaction queue after confirming the node is in sync.
- **Check ledger sync**: If `node_sync_lag` > 10, trigger a **state sync** from a healthy peer:
  ```bash
  soroban-node sync --source <healthy-node>
  ```
- **Temporarily disable new submissions**: Set the API flag `accept_tx = false` to stop inflow while you recover.

---
## 6. Recovery Procedure (After Mitigation)
1. **Verify metrics** have returned below thresholds for at least 5 minutes.
2. **Run a smoke‑test suite** (included in `contracts/vault/tests/`):
   ```bash
   cargo test --workspace --quiet
   ```
3. **Re‑enable transaction ingestion** (`accept_tx = true`).
4. **Monitor** for any residual errors for the next 30 minutes.
5. **Document** the incident timeline, root cause, and actions taken in the post‑mortem.

---
## 7. Post‑mortem & Continuous Improvement
- Complete the **Post‑mortem Template** (`docs/POSTMORTEM_TEMPLATE.md`).
- Update runbook if new failure modes were discovered.
- Review alert thresholds and adjust if false‑positives occurred.
- Schedule a **runbook drill** quarterly.

---
*Prepared by the YieldVault Ops team – last updated: 2026‑06‑01*
